import type { RoleBranding } from "@prisma/client";
import { BrandingRepository, type BrandingUpsertInput } from "../repositories/branding.repository";
import { RoleRepository } from "../repositories/role.repository";
import { HttpError } from "../utils/http-error";
import {
  deleteBrandingLogo,
  parseLogoDataUrl,
  saveBrandingLogo,
} from "../utils/branding-logo-storage";

const DEFAULT_BRANDING: BrandingUpsertInput = {
  pageTitle: "철도안전정보종합관리시스템",
  systemName: "철도안전정보종합관리시스템",
  heroTitle: "철도안전정보종합관리시스템",
  heroSubtitle:
    "철도안전 관련 업무의 효율성을 강화하고 정확한 정보 공유를 지원하는 통합 관리 시스템입니다.",
  showLogo: false,
  logoUrl: null,
  showCiMark: false,
  ciMarkLabel: null,
  showHero: true,
  showFooter: true,
};

export type BrandingDto = {
  scope: "GLOBAL" | "ROLE";
  roleId: number | null;
  roleName: string | null;
  pageTitle: string;
  systemName: string;
  heroTitle: string | null;
  heroSubtitle: string | null;
  showLogo: boolean;
  logoUrl: string | null;
  showCiMark: boolean;
  ciMarkLabel: string | null;
  showHero: boolean;
  showFooter: boolean;
};

export class BrandingService {
  constructor(
    private readonly brandingRepository: BrandingRepository,
    private readonly roleRepository: RoleRepository,
  ) {}

  private toDto(record: RoleBranding, roleName: string | null): BrandingDto {
    return {
      scope: record.roleId === null ? "GLOBAL" : "ROLE",
      roleId: record.roleId,
      roleName,
      pageTitle: record.pageTitle,
      systemName: record.systemName,
      heroTitle: record.heroTitle,
      heroSubtitle: record.heroSubtitle,
      showLogo: record.showLogo,
      logoUrl: record.logoUrl,
      showCiMark: record.showCiMark,
      ciMarkLabel: record.ciMarkLabel,
      showHero: record.showHero,
      showFooter: record.showFooter,
    };
  }

  private async cleanupOldLogo(oldUrl: string | null, newUrl: string | null): Promise<void> {
    if (oldUrl && oldUrl !== newUrl) {
      await deleteBrandingLogo(oldUrl);
    }
  }

  async uploadLogo(input: { scope: "GLOBAL" | "ROLE"; roleId?: number; logoData: string }): Promise<{ logoUrl: string }> {
    if (!input.logoData?.trim()) {
      throw new HttpError(400, "logoData is required.");
    }
    if (input.scope === "ROLE") {
      if (!Number.isInteger(input.roleId) || (input.roleId ?? 0) < 1) {
        throw new HttpError(400, "roleId is required for role branding.");
      }
      const role = await this.roleRepository.findById(input.roleId as number);
      if (!role) {
        throw new HttpError(404, "Role not found.");
      }
    }

    const buffer = parseLogoDataUrl(input.logoData);
    const scopeKey = input.scope === "GLOBAL" ? "global" : `role-${input.roleId}`;
    const logoUrl = await saveBrandingLogo(buffer, scopeKey);
    return { logoUrl };
  }

  private validateInput(input: Partial<BrandingUpsertInput>): BrandingUpsertInput {
    const pageTitle = input.pageTitle?.trim();
    const systemName = input.systemName?.trim();

    if (!pageTitle) {
      throw new HttpError(400, "pageTitle is required.");
    }
    if (!systemName) {
      throw new HttpError(400, "systemName is required.");
    }

    return {
      pageTitle,
      systemName,
      heroTitle: input.heroTitle?.trim() || null,
      heroSubtitle: input.heroSubtitle?.trim() || null,
      showLogo: Boolean(input.showLogo),
      logoUrl: input.logoUrl?.trim() || null,
      showCiMark: Boolean(input.showCiMark),
      ciMarkLabel: input.ciMarkLabel?.trim() || null,
      showHero: input.showHero !== false,
      showFooter: input.showFooter !== false,
    };
  }

  async getGlobalBranding(): Promise<BrandingDto> {
    const record = await this.brandingRepository.findGlobal();
    if (!record) {
      return this.toDto(
        {
          id: 0,
          roleId: null,
          ...DEFAULT_BRANDING,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as RoleBranding,
        null,
      );
    }
    return this.toDto(record, null);
  }

  async getBrandingForRole(roleId: number, roleName: string): Promise<BrandingDto> {
    const roleBranding = await this.brandingRepository.findByRoleId(roleId);
    if (roleBranding) {
      return this.toDto(roleBranding, roleName);
    }

    const global = await this.getGlobalBranding();
    return { ...global, scope: "ROLE", roleId, roleName };
  }

  async listAdminBranding(): Promise<BrandingDto[]> {
    const roles = await this.roleRepository.findAll();
    const records = await this.brandingRepository.findAllWithRoles();
    const recordByRoleId = new Map(records.filter((r) => r.roleId !== null).map((r) => [r.roleId as number, r]));
    const globalRecord = records.find((r) => r.roleId === null);

    const result: BrandingDto[] = [
      globalRecord
        ? this.toDto(globalRecord, null)
        : await this.getGlobalBranding(),
    ];

    for (const role of roles) {
      const record = recordByRoleId.get(role.id);
      if (record) {
        result.push(this.toDto(record, role.name));
      } else {
        const fallback = await this.getGlobalBranding();
        result.push({ ...fallback, scope: "ROLE", roleId: role.id, roleName: role.name });
      }
    }

    return result;
  }

  async updateGlobalBranding(input: Partial<BrandingUpsertInput>): Promise<BrandingDto> {
    const existing = await this.brandingRepository.findGlobal();
    const data = this.validateInput({ ...DEFAULT_BRANDING, ...input });
    await this.cleanupOldLogo(existing?.logoUrl ?? null, data.logoUrl ?? null);
    const record = await this.brandingRepository.upsertGlobal(data);
    return this.toDto(record, null);
  }

  async updateRoleBranding(roleId: number, input: Partial<BrandingUpsertInput>): Promise<BrandingDto> {
    const role = await this.roleRepository.findById(roleId);
    if (!role) {
      throw new HttpError(404, "Role not found.");
    }

    const global = await this.getGlobalBranding();
    const data = this.validateInput({
      pageTitle: global.pageTitle,
      systemName: global.systemName,
      heroTitle: global.heroTitle,
      heroSubtitle: global.heroSubtitle,
      showLogo: global.showLogo,
      logoUrl: global.logoUrl,
      showCiMark: global.showCiMark,
      ciMarkLabel: global.ciMarkLabel,
      showHero: global.showHero,
      showFooter: global.showFooter,
      ...input,
    });

    const existing = await this.brandingRepository.findByRoleId(roleId);
    await this.cleanupOldLogo(existing?.logoUrl ?? null, data.logoUrl ?? null);
    const record = await this.brandingRepository.upsertForRole(roleId, data);
    return this.toDto(record, role.name);
  }
}
