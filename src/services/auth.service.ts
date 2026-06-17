import { RoleRepository } from "../repositories/role.repository";
import { UserRepository } from "../repositories/user.repository";
import { PermissionRepository } from "../repositories/permission.repository";
import { ROLES, type RoleName } from "../constants/roles";
import type { MenuActionFlags, MenuActionPath } from "../constants/menu-action-permissions";
import { HttpError } from "../utils/http-error";
import { comparePassword, hashPassword } from "../utils/password";
import { signToken } from "../utils/jwt";
import { assertIpAllowed } from "../utils/client-ip";
import { MenuActionPermissionService } from "./menu-action-permission.service";
import type { LoginLogService } from "./login-log.service";

interface RegisterInput {
  email: string;
  password: string;
  name: string;
  role?: RoleName;
}

interface LoginInput {
  email: string;
  password: string;
}

export class AuthService {
  private readonly menuActionPermissionService: MenuActionPermissionService;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly roleRepository: RoleRepository,
    private readonly loginLogService?: LoginLogService,
  ) {
    this.menuActionPermissionService = new MenuActionPermissionService(new PermissionRepository());
  }

  private async writeLoginLog(action: () => Promise<void>): Promise<void> {
    if (!this.loginLogService) return;
    try {
      await action();
    } catch (error) {
      console.error("[login-log] Failed to persist login attempt:", error);
    }
  }

  async register(input: RegisterInput): Promise<{ id: number; email: string; name: string; role: string }> {
    const existingUser = await this.userRepository.findByEmail(input.email);
    if (existingUser) {
      throw new HttpError(409, "Email already in use.");
    }

    const roleName = input.role ?? ROLES.GUEST;
    const role = await this.roleRepository.findByName(roleName);
    if (!role) {
      throw new HttpError(400, `Role not found: ${roleName}`);
    }

    const hashedPassword = await hashPassword(input.password);
    const user = await this.userRepository.create({
      email: input.email,
      password: hashedPassword,
      name: input.name,
      roleId: role.id,
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: role.name,
    };
  }

  async login(
    input: LoginInput,
    clientIp: string,
    context: { userAgent?: string | null } = {},
  ): Promise<{
    accessToken: string;
    user: {
      id: number;
      email: string;
      name: string;
      role: string;
      menuActions: Record<MenuActionPath, MenuActionFlags>;
    };
  }> {
    const logContext = { ipAddress: clientIp, userAgent: context.userAgent ?? null };

    const user = await this.userRepository.findByEmail(input.email);
    if (!user) {
      await this.writeLoginLog(() =>
        this.loginLogService!.recordFailure(
          { email: input.email, failReason: "이메일 또는 비밀번호가 올바르지 않습니다." },
          logContext,
        ),
      );
      throw new HttpError(401, "Invalid email or password.");
    }

    const isMatched = await comparePassword(input.password, user.password);
    if (!isMatched) {
      await this.writeLoginLog(() =>
        this.loginLogService!.recordFailure(
          {
            email: input.email,
            userId: user.id,
            name: user.name,
            roleName: user.role.name,
            failReason: "이메일 또는 비밀번호가 올바르지 않습니다.",
          },
          logContext,
        ),
      );
      throw new HttpError(401, "Invalid email or password.");
    }

    try {
      assertIpAllowed(user, clientIp);
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "IP 접속이 제한되어 있습니다.";
      await this.writeLoginLog(() =>
        this.loginLogService!.recordFailure(
          {
            email: user.email,
            userId: user.id,
            name: user.name,
            roleName: user.role.name,
            failReason: message,
          },
          logContext,
        ),
      );
      throw error;
    }

    const menuActions = await this.menuActionPermissionService.getMenuActionsForRole(user.roleId, user.role.name);

    const accessToken = signToken({
      userId: user.id,
      roleId: user.roleId,
      email: user.email,
      role: user.role.name,
    });

    await this.writeLoginLog(() => this.loginLogService!.recordSuccess(user, logContext));

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.name,
        menuActions,
      },
    };
  }

  async getSession(userId: number): Promise<{
    id: number;
    email: string;
    name: string;
    role: string;
    menuActions: Record<MenuActionPath, MenuActionFlags>;
  }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new HttpError(401, "Invalid or expired token.");
    }

    const role = await this.roleRepository.findById(user.roleId);
    if (!role) {
      throw new HttpError(401, "Invalid or expired token.");
    }

    const menuActions = await this.menuActionPermissionService.getMenuActionsForRole(user.roleId, role.name);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: role.name,
      menuActions,
    };
  }
}
