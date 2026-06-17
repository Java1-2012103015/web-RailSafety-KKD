import type { NextFunction, Request, Response } from "express";
import { UserRepository } from "../repositories/user.repository";
import { RoleRepository } from "../repositories/role.repository";
import { HttpError } from "../utils/http-error";
import { hashPassword } from "../utils/password";
import { parseIpRestrictionInput } from "../utils/client-ip";

export class UserController {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly roleRepository: RoleRepository,
  ) {}

  listUsers = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const users = await this.userRepository.findAll();
      const sanitizedUsers = users.map(({ password, ...user }) => user);

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
      const { email, password, name, roleId, ipRestrictionEnabled, allowedIp } = req.body as {
        email?: string;
        password?: string;
        name?: string;
        roleId?: number;
        ipRestrictionEnabled?: boolean;
        allowedIp?: string | null;
      };

      if (!email?.trim() || !password || !name?.trim() || !Number.isInteger(roleId) || (roleId ?? 0) < 1) {
        throw new HttpError(400, "email, password, name, roleId are required.");
      }

      const role = await this.roleRepository.findById(roleId as number);
      if (!role) {
        throw new HttpError(400, "Invalid role ID.");
      }

      const existingUser = await this.userRepository.findByEmail(email.trim());
      if (existingUser) {
        throw new HttpError(409, "Email already in use.");
      }

      const ipSettings = parseIpRestrictionInput({ ipRestrictionEnabled, allowedIp });

      const user = await this.userRepository.create({
        email: email.trim(),
        password: await hashPassword(password),
        name: name.trim(),
        roleId: roleId as number,
        ...ipSettings,
      });

      const { password: _, ...result } = user;

      res.status(201).json({
        message: "User created successfully.",
        data: result,
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

      const { name, email, roleId, password, ipRestrictionEnabled, allowedIp } = req.body as {
        name?: string;
        email?: string;
        roleId?: number;
        password?: string;
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
        ipRestrictionEnabled?: boolean;
        allowedIp?: string | null;
      } = {};

      if (name !== undefined) {
        if (!name.trim()) throw new HttpError(400, "Name cannot be empty.");
        updateData.name = name.trim();
      }

      if (email !== undefined) {
        if (!email.trim()) throw new HttpError(400, "Email cannot be empty.");
        updateData.email = email.trim();
      }

      if (roleId !== undefined) {
        const role = await this.roleRepository.findById(roleId);
        if (!role) {
          throw new HttpError(400, "Invalid role ID.");
        }
        updateData.roleId = roleId;
      }

      if (password !== undefined && password.trim() !== "") {
        updateData.password = await hashPassword(password);
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
      const { password: _, ...result } = updatedUser;

      res.status(200).json({
        message: "User updated successfully.",
        data: result,
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
