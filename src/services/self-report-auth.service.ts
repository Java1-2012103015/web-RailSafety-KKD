import { ROLES } from "../constants/roles";
import { UserRepository } from "../repositories/user.repository";
import { SelfReportRepository } from "../repositories/self-report.repository";
import {
  isSelfReportRole,
  SelfReportUserSyncService,
  tierFromRole,
} from "../services/self-report-user-sync.service";
import { HttpError } from "../utils/http-error";
import { comparePassword, hashPassword } from "../utils/password";
import { signSelfReportToken, type SelfReportJwtPayload } from "../utils/jwt";

interface InstitutionLoginInput {
  institutionCode?: string;
  email: string;
  password?: string;
  authKey?: string;
}

export class SelfReportAuthService {
  private readonly userRepository = new UserRepository();
  private readonly selfReportUserSyncService: SelfReportUserSyncService;

  constructor(private readonly selfReportRepository: SelfReportRepository) {
    this.selfReportUserSyncService = new SelfReportUserSyncService(selfReportRepository);
  }

  private async findEnabledInstitution(institutionCode: string) {
    const institution = await this.selfReportRepository.findInstitutionByCode(institutionCode.trim());
    if (!institution || !institution.enabled) {
      throw new HttpError(401, "선택한 기관을 찾을 수 없습니다.");
    }
    return institution;
  }

  private async assertInstitutionAuth(institutionCode: string, authKey: string) {
    const institution = await this.findEnabledInstitution(institutionCode);

    const matched = await comparePassword(authKey, institution.authKeyHash);
    if (!matched) {
      throw new HttpError(401, "기관 인증키가 올바르지 않습니다.");
    }

    return institution;
  }

  private buildSession(
    institution: { id: number; name: string },
    staff: { id: number; name: string },
    tier: 1 | 2,
  ): { accessToken: string; session: SelfReportJwtPayload } {
    const role = tier === 1 ? ROLES.SELF_REPORT_TIER1 : ROLES.SELF_REPORT_TIER2;
    const payload: SelfReportJwtPayload = {
      role,
      selfReportInstitutionId: institution.id,
      selfReportStaffId: staff.id,
      selfReportTier: tier,
      selfReportInstitutionName: institution.name,
      selfReportStaffName: staff.name,
    };
    return { accessToken: signSelfReportToken(payload), session: payload };
  }

  private async loginWithUserAccount(
    institution: { id: number; name: string; authKeyHash: string },
    email: string,
    authKey: string,
    options?: { allowInstitutionKeyFallback?: boolean },
  ) {
    const normalizedEmail = email.trim();
    const user = await this.userRepository.findByEmailForSelfReport(normalizedEmail);
    if (!user || !isSelfReportRole(user.role.name)) {
      throw new HttpError(401, "이메일 또는 인증키가 올바르지 않습니다.");
    }

    if (user.selfReportInstitutionId !== institution.id) {
      throw new HttpError(401, "등록된 담당 기관과 선택한 기관이 일치하지 않습니다.");
    }

    const storedKeyHash = user.selfReportAuthKeyHash ?? user.password;
    let keyOk = await comparePassword(authKey, storedKeyHash);
    if (!keyOk && options?.allowInstitutionKeyFallback) {
      keyOk = await comparePassword(authKey, institution.authKeyHash);
    }
    if (!keyOk) {
      throw new HttpError(401, "이메일 또는 인증키가 올바르지 않습니다.");
    }

    const staff = await this.selfReportUserSyncService.syncStaffFromUser(user);
    if (!staff) {
      throw new HttpError(401, "자율보고 담당자 정보를 확인할 수 없습니다.");
    }

    const tier = tierFromRole(user.role.name);
    if (!tier) {
      throw new HttpError(401, "자율보고 권한이 올바르지 않습니다.");
    }

    return this.buildSession(institution, staff, tier);
  }

  private async loginWithLegacyStaff(
    institutionCode: string,
    institution: { id: number; name: string },
    email: string,
    authKey: string,
  ) {
    await this.assertInstitutionAuth(institutionCode, authKey);

    const staff = await this.selfReportRepository.findStaffByInstitutionEmailAnyTier(institution.id, email);
    if (!staff) {
      throw new HttpError(401, "등록되지 않은 담당자 이메일입니다. 관리자에게 계정 등록을 요청하세요.");
    }

    return this.buildSession(institution, staff, staff.tier as 1 | 2);
  }

  async verifyInstitution(institutionCode: string, email: string, password?: string, authKey?: string) {
    const institution = await this.findEnabledInstitution(institutionCode);
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      throw new HttpError(400, "이메일을 입력해 주세요.");
    }

    if (password?.trim()) {
      await this.loginWithUserAccount(institution, normalizedEmail, password.trim());
      const user = await this.userRepository.findByEmailForSelfReport(normalizedEmail);
      const staff = user ? await this.selfReportUserSyncService.syncStaffFromUser(user) : null;
      return {
        institution: {
          id: institution.id,
          name: institution.name,
          code: institution.code,
          regionalHq: institution.regionalHq,
        },
        staff: staff
          ? {
              id: staff.id,
              name: staff.name,
              email: staff.email,
              tier: user ? tierFromRole(user.role.name) : staff.tier,
            }
          : null,
      };
    }

    if (authKey?.trim()) {
      await this.assertInstitutionAuth(institutionCode, authKey);
      const staff = await this.selfReportRepository.findStaffByInstitutionEmailAnyTier(
        institution.id,
        normalizedEmail,
      );
      if (!staff) {
        throw new HttpError(401, "등록되지 않은 담당자 이메일입니다.");
      }
      return {
        institution: {
          id: institution.id,
          name: institution.name,
          code: institution.code,
          regionalHq: institution.regionalHq,
        },
        staff: {
          id: staff.id,
          name: staff.name,
          email: staff.email,
          tier: staff.tier,
        },
      };
    }

    throw new HttpError(400, "인증키를 입력해 주세요.");
  }

  async login(input: InstitutionLoginInput): Promise<{ accessToken: string; session: SelfReportJwtPayload }> {
    const email = input.email?.trim();
    if (!email) {
      throw new HttpError(400, "이메일을 입력해 주세요.");
    }

    const authKey = input.password?.trim() || input.authKey?.trim();
    if (!authKey) {
      throw new HttpError(400, "인증키를 입력해 주세요.");
    }

    const institutionCode = input.institutionCode?.trim();

    if (institutionCode) {
      const institution = await this.selfReportRepository.findInstitutionByCode(institutionCode);
      if (!institution || !institution.enabled) {
        throw new HttpError(401, "선택한 기관을 찾을 수 없습니다.");
      }

      const user = await this.userRepository.findByEmailForSelfReport(email);
      if (user && isSelfReportRole(user.role.name)) {
        return this.loginWithUserAccount(institution, email, authKey, { allowInstitutionKeyFallback: true });
      }

      return this.loginWithLegacyStaff(institutionCode, institution, email, authKey);
    }

    const user = await this.userRepository.findByEmailForSelfReport(email);
    if (!user || !isSelfReportRole(user.role.name)) {
      throw new HttpError(401, "이메일 또는 인증키가 올바르지 않습니다.");
    }
    if (!user.selfReportInstitutionId) {
      throw new HttpError(401, "등록된 담당 기관이 없습니다. 관리자에게 문의하세요.");
    }

    const institution = await this.selfReportRepository.findInstitutionById(user.selfReportInstitutionId);
    if (!institution || !institution.enabled) {
      throw new HttpError(401, "소속 기관을 사용할 수 없습니다.");
    }

    return this.loginWithUserAccount(institution, email, authKey);
  }

  async hashAuthKey(authKey: string): Promise<string> {
    return hashPassword(authKey);
  }
}
