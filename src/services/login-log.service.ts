import type { LoginLogStatus } from "@prisma/client";
import { LoginLogRepository } from "../repositories/login-log.repository";

export interface LoginAttemptContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class LoginLogService {
  constructor(private readonly loginLogRepository: LoginLogRepository) {}

  recordSuccess(
    user: { id: number; email: string; name: string; role: { name: string } },
    context: LoginAttemptContext,
  ): Promise<void> {
    return this.loginLogRepository
      .create({
        userId: user.id,
        email: user.email,
        name: user.name,
        roleName: user.role.name,
        status: "SUCCESS",
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      })
      .then(() => undefined);
  }

  recordFailure(
    params: { email: string; userId?: number | null; name?: string | null; roleName?: string | null; failReason: string },
    context: LoginAttemptContext,
  ): Promise<void> {
    return this.loginLogRepository
      .create({
        userId: params.userId ?? null,
        email: params.email,
        name: params.name ?? null,
        roleName: params.roleName ?? null,
        status: "FAILURE",
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
        failReason: params.failReason,
      })
      .then(() => undefined);
  }

  listForAdmin(query: { page?: string; pageSize?: string; email?: string; status?: string }) {
    const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(10, Number.parseInt(query.pageSize ?? "30", 10) || 30));
    const status =
      query.status === "SUCCESS" || query.status === "FAILURE" ? (query.status as LoginLogStatus) : undefined;

    return this.loginLogRepository.list({
      page,
      pageSize,
      email: query.email,
      status,
    });
  }
}
