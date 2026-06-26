import type { NextFunction, Request, Response } from "express";
import { UserRepository } from "../repositories/user.repository";
import { RoleRepository } from "../repositories/role.repository";
import { SelfReportRepository } from "../repositories/self-report.repository";
import {
  isSelfReportRole,
  SelfReportUserSyncService,
} from "../services/self-report-user-sync.service";
import { HttpError } from "../utils/http-error";
import { hashPassword } from "../utils/password";
import { decryptSelfReportAuthKey, encryptSelfReportAuthKey } from "../utils/self-report-auth-key";
import { parseIpRestrictionInput } from "../utils/client-ip";

function resolvePasskeyForAdmin(user: {
  passkeyEnc?: string | null;
  selfReportAuthKeyEnc?: string | null;
}): string | null {
  return decryptSelfReportAuthKey(user.passkeyEnc ?? user.selfReportAuthKeyEnc);
}

function sanitizeUserForAdmin<
  T extends {
    password: string;
    selfReportAuthKeyHash?: string | null;
    selfReportAuthKeyEnc?: string | null;
    passkeyEnc?: string | null;
  },
>(user: T) {
  const { password, selfReportAuthKeyHash, selfReportAuthKeyEnc, passkeyEnc, ...rest } = user;
  return {
    ...rest,
    passkey: resolvePasskeyForAdmin({ passkeyEnc, selfReportAuthKeyEnc }),
  };
}

export class UserController {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly roleRepository: RoleRepository,
    private readonly selfReportRepository: SelfReportRepository,
    private readonly selfReportUserSyncService: SelfReportUserSyncService,
  ) {}

  private async resolveSelfReportInstitution(
    roleId: number,
    selfReportInstitutionId?: number | null,
  ): Promise<{ roleName: string; institutionId: number | null }> {
    const role = await this.roleRepository.findById(roleId);
    if (!role) {
      throw new HttpError(400, "Invalid role ID.");
    }

    if (isSelfReportRole(role.name)) {
      if (!selfReportInstitutionId) {
        throw new HttpError(400, "자율보고 권한(1·2차) 사용자는 담당 기관을 지정해야 합니다.");
      }
      const institution = await this.selfReportRepository.findInstitutionById(selfReportInstitutionId);
      if (!institution) {
        throw new HttpError(400, "유효하지 않은 담당 기관입니다.");
      }
      return { roleName: role.name, institutionId: selfReportInstitutionId };
    }

    if (selfReportInstitutionId) {
      throw new HttpError(400, "담당 기관은 자율보고 권한 사용자에게만 설정할 수 있습니다.");
    }

    return { roleName: role.name, institutionId: null };
  }

  listUsers = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const users = await this.userRepository.findAll();
      const sanitizedUsers = users.map((user) => sanitizeUserForAdmin(user));

      res.status(200).json({
        message: "Users retrieved successfully.",
        data: sanitizedUsers,
      });
    } catch (error) {
      next(error);
    }
  };

  createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password, name, roleId, selfReportInstitutionId, ipRestrictionEnabled, allowedIp } =
        req.body as {
          email?: string;
          password?: string;
          name?: string;
          roleId?: number;
          selfReportInstitutionId?: number | null;
          ipRestrictionEnabled?: boolean;
          allowedIp?: string | null;
        };

      if (!email?.trim() || !password || !name?.trim() || !Number.isInteger(roleId) || (roleId ?? 0) < 1) {
        throw new HttpError(400, "email, password, name, roleId are required.");
      }

      const { roleName, institutionId } = await this.resolveSelfReportInstitution(
        roleId as number,
        selfReportInstitutionId ?? null,
      );

      const existingUser = await this.userRepository.findByEmail(email.trim());
      if (existingUser) {
        throw new HttpError(409, "Email already in use.");
      }

      const ipSettings = parseIpRestrictionInput({ ipRestrictionEnabled, allowedIp });
      const hashedPassword = await hashPassword(password);

      const passkeyEnc = encryptSelfReportAuthKey(password);

      const user = await this.userRepository.create({
        email: email.trim(),
        password: hashedPassword,
        name: name.trim(),
        roleId: roleId as number,
        selfReportInstitutionId: institutionId,
        selfReportAuthKeyHash: isSelfReportRole(roleName) ? hashedPassword : null,
        selfReportAuthKeyEnc: isSelfReportRole(roleName) ? passkeyEnc : null,
        passkeyEnc,
        ...ipSettings,
      });

      const userWithRole = await this.userRepository.findByIdWithRole(user.id);
      if (userWithRole && institutionId) {
        await this.selfReportUserSyncService.syncStaffFromUser(userWithRole);
      }

      res.status(201).json({
        message: "User created successfully.",
        data: sanitizeUserForAdmin(user),
      });
    } catch (error) {
      next(error);
    }
  };

  updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) {
        throw new HttpError(400, "Invalid user ID.");
      }

      const { name, email, roleId, password, selfReportInstitutionId, ipRestrictionEnabled, allowedIp } =
        req.body as {
          name?: string;
          email?: string;
          roleId?: number;
          password?: string;
          selfReportInstitutionId?: number | null;
          ipRestrictionEnabled?: boolean;
          allowedIp?: string | null;
        };

      const user = await this.userRepository.findById(id);
      if (!user) {
        throw new HttpError(404, "User not found.");
      }

      const updateData: {
        name?: string;
        email?: string;
        roleId?: number;
        password?: string;
        selfReportInstitutionId?: number | null;
        selfReportAuthKeyHash?: string | null;
        selfReportAuthKeyEnc?: string | null;
        passkeyEnc?: string | null;
        ipRestrictionEnabled?: boolean;
        allowedIp?: string | null;
      } = {};

      let resolvedRoleName: string | null = null;

      if (name !== undefined) {
        if (!name.trim()) throw new HttpError(400, "Name cannot be empty.");
        updateData.name = name.trim();
      }

      if (email !== undefined) {
        if (!email.trim()) throw new HttpError(400, "Email cannot be empty.");
        updateData.email = email.trim();
      }

      const effectiveRoleId = roleId ?? user.roleId;
      const institutionProvided = selfReportInstitutionId !== undefined || roleId !== undefined;
      if (institutionProvided) {
        const institutionInput =
          selfReportInstitutionId !== undefined ? selfReportInstitutionId : user.selfReportInstitutionId;
        const resolved = await this.resolveSelfReportInstitution(effectiveRoleId, institutionInput);
        resolvedRoleName = resolved.roleName;
        updateData.selfReportInstitutionId = resolved.institutionId;
        if (roleId !== undefined) {
          updateData.roleId = roleId;
        }
      } else if (roleId !== undefined) {
        const resolved = await this.resolveSelfReportInstitution(roleId, user.selfReportInstitutionId);
        resolvedRoleName = resolved.roleName;
        updateData.roleId = roleId;
        updateData.selfReportInstitutionId = resolved.institutionId;
      }

      if (password !== undefined && password.trim() !== "") {
        const hashedPassword = await hashPassword(password);
        const passkeyEnc = encryptSelfReportAuthKey(password.trim());
        updateData.password = hashedPassword;
        updateData.passkeyEnc = passkeyEnc;
      }

      const finalRole =
        resolvedRoleName !== null
          ? { name: resolvedRoleName }
          : await this.roleRepository.findById(roleId ?? user.roleId);
      if (finalRole && isSelfReportRole(finalRole.name)) {
        if (updateData.password) {
          updateData.selfReportAuthKeyHash = updateData.password;
          if (updateData.passkeyEnc) {
            updateData.selfReportAuthKeyEnc = updateData.passkeyEnc;
          }
        }
      } else if (institutionProvided || roleId !== undefined) {
        updateData.selfReportAuthKeyHash = null;
        updateData.selfReportAuthKeyEnc = null;
      }

      if (ipRestrictionEnabled !== undefined || allowedIp !== undefined) {
        const currentRestriction =
          ipRestrictionEnabled !== undefined ? Boolean(ipRestrictionEnabled) : user.ipRestrictionEnabled;
        const currentAllowedIp = allowedIp !== undefined ? allowedIp : user.allowedIp;
        Object.assign(updateData, parseIpRestrictionInput({
          ipRestrictionEnabled: currentRestriction,
          allowedIp: currentAllowedIp,
        }));
      }

      const updatedUser = await this.userRepository.update(id, updateData);
      const userWithRole = await this.userRepository.findByIdWithRole(id);
      if (userWithRole) {
        if (isSelfReportRole(userWithRole.role.name) && userWithRole.selfReportInstitutionId) {
          await this.selfReportUserSyncService.syncStaffFromUser(userWithRole);
        } else {
          await this.selfReportUserSyncService.clearStaffLinkForUser(id);
        }
      }

      res.status(200).json({
        message: "User updated successfully.",
        data: sanitizeUserForAdmin(updatedUser),
      });
    } catch (error) {
      next(error);
    }
  };

  deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) {
        throw new HttpError(400, "Invalid user ID.");
      }

      if (req.user && req.user.userId === id) {
        throw new HttpError(400, "You cannot delete yourself.");
      }

      const user = await this.userRepository.findById(id);
      if (!user) {
        throw new HttpError(404, "User not found.");
      }

      await this.selfReportUserSyncService.clearStaffLinkForUser(id);
      await this.userRepository.delete(id);

      res.status(200).json({
        message: "User deleted successfully.",
        data: { id },
      });
    } catch (error) {
      next(error);
    }
  };
}
