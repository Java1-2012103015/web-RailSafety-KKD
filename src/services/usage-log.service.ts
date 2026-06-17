import { UsageLogRepository } from "../repositories/usage-log.repository";
import { UserRepository } from "../repositories/user.repository";
import { HttpError } from "../utils/http-error";
import type { JwtPayload } from "../utils/jwt";

export interface UsageEventContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class UsageLogService {
  constructor(
    private readonly usageLogRepository: UsageLogRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async recordPageView(
    auth: JwtPayload,
    input: { path: string; pageTitle?: string | null; sessionKey: string },
    context: UsageEventContext,
  ): Promise<void> {
    const path = input.path?.trim();
    const sessionKey = input.sessionKey?.trim();
    if (!path || !sessionKey) {
      throw new HttpError(400, "path and sessionKey are required.");
    }

    const user = await this.userRepository.findById(auth.userId);
    if (!user) {
      throw new HttpError(401, "Invalid or expired token.");
    }

    try {
      await this.usageLogRepository.create({
        userId: auth.userId,
        email: auth.email,
        name: user.name,
        roleName: auth.role,
        path: path.slice(0, 500),
        pageTitle: input.pageTitle?.trim()?.slice(0, 200) ?? null,
        sessionKey: sessionKey.slice(0, 64),
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Unique constraint")) {
        return;
      }
      throw error;
    }
  }

  async recordPageLeave(
    auth: JwtPayload,
    input: { sessionKey: string; dwellSeconds: number },
  ): Promise<void> {
    const sessionKey = input.sessionKey?.trim();
    if (!sessionKey) {
      throw new HttpError(400, "sessionKey is required.");
    }

    const dwellSeconds = Math.max(0, Math.min(86400, Math.floor(input.dwellSeconds)));

    await this.usageLogRepository.updateDwell(sessionKey, auth.userId, dwellSeconds);
  }

  listForAdmin(query: {
    page?: string;
    pageSize?: string;
    email?: string;
    path?: string;
    fromDate?: string;
    toDate?: string;
  }) {
    const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(10, Number.parseInt(query.pageSize ?? "30", 10) || 30));

    return this.usageLogRepository.list({
      page,
      pageSize,
      email: query.email,
      path: query.path,
      fromDate: parseDateStart(query.fromDate),
      toDate: parseDateEnd(query.toDate),
    });
  }

  getSummaryForAdmin(query: { fromDate?: string; toDate?: string }) {
    return this.usageLogRepository.getSummary({
      fromDate: parseDateStart(query.fromDate),
      toDate: parseDateEnd(query.toDate),
    });
  }
}

function parseDateStart(value?: string): Date | undefined {
  if (!value?.trim()) return undefined;
  const date = new Date(`${value.trim()}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseDateEnd(value?: string): Date | undefined {
  if (!value?.trim()) return undefined;
  const date = new Date(`${value.trim()}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
