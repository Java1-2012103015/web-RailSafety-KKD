import type { AccidentType, RailwayAccident } from "@prisma/client";
import {
  ACCIDENT_KIND_CATEGORIES,
  normalizeAccidentKindCategories,
  rowMatchesAccidentKindCategories,
  type AccidentKindCategory,
} from "../constants/accident-kind-category";
import { ROLES } from "../constants/roles";
import { normalizeLocationScope } from "../constants/query-location-scope";
import { HttpError } from "../utils/http-error";
import { AccidentRepository } from "../repositories/accident.repository";
import { PermissionRepository } from "../repositories/permission.repository";
import type { AccidentDetailPublicationService } from "./accident-detail-publication.service";
import { buildPublicationMeta } from "../utils/accident-detail-publication";
import { ALL_ACCIDENT_DETAIL_COLUMN_KEYS } from "../constants/accident-detail-column-groups";
import { ALL_ACCIDENT_DETAIL_TAB_IDS } from "../constants/accident-detail-ui-tabs";
import { parseQueryEndDate, parseQueryStartDate } from "../utils/query-date";
import {
  buildInvestigationReportLinksFromUrls,
  formatInvestigationReportSavedAtText,
  inferInvestigationReportFilename,
  normalizeInvestigationReportLinksInput,
  parseInvestigationReportLinks,
  serializeInvestigationReportLinks,
} from "../utils/investigation-report-links";

interface GetAccidentsInput {
  startDate?: string;
  endDate?: string;
  lineName?: string;
  accidentType?: string;
  accidentKindCategory?: string;
  accidentKinds?: string;
  registrationAgency?: string;
  page?: string;
  pageSize?: string;
}

interface BulkAccidentInput {
  records?: Array<{
    base?: Record<string, unknown>;
    detail?: Record<string, unknown>;
  }>;
}

interface DeleteAccidentsInput {
  ids?: unknown;
}

interface BulkInvestigationReportInput {
  records?: Array<{
    accidentNumber?: unknown;
    urls?: unknown;
  }>;
}

const BULK_MAX_RECORDS = 20000;

const DETAIL_INT_KEYS = new Set([
  "year", "month", "day", "hour", "minute", "deaths", "seriousInjuries", "minorInjuries",
  "carCount", "unitCount", "derailedCars", "damagedCars", "severeDamage", "moderateDamage", "minorDamage",
  "totalDelayedTrains", "highSpeedDelayedTrains", "regularDelayedTrains", "urbanDelayedTrains",
  "dedicatedDelayedTrains", "otherDelayedTrains", "relatedPersonCount", "relatedPersonAge",
]);

const DETAIL_DECIMAL_KEYS = new Set([
  "totalDamageAmount", "casualtyCompensationAmount", "propertyDamageAmount", "otherDamageAmount",
  "humanLossCostTotal", "deathProductionLossCost", "deathMedicalCost", "deathAdministrativeCost", "deathPsychologicalCost",
  "seriousProductionLossCost", "seriousMedicalCost", "seriousAdministrativeCost", "seriousPsychologicalCost",
  "minorProductionLossCost", "minorMedicalCost", "minorAdministrativeCost", "minorPsychologicalCost",
  "materialDamageCostTotal", "vehicleRecoveryCost", "trackRecoveryCost", "signalRecoveryCost", "electricalRecoveryCost",
  "otherFacilityRecoveryCost", "facilityDamageCostTotal", "operationLossCostTotal", "delayLossCost",
  "substituteTransportCost", "fareRefundCost", "otherCostTotal", "investigationCost", "legalCost", "reputationCost",
  "otherMiscCost", "accidentPointKm", "totalDelayMin", "totalDelayMax", "highSpeedDelayMin", "highSpeedDelayMax",
  "regularDelayMin", "regularDelayMax", "urbanDelayMin", "urbanDelayMax", "dedicatedDelayMin", "dedicatedDelayMax",
  "otherDelayMin", "otherDelayMax", "mainLineBlockTime", "mainLineRecoveryTime", "temperature", "rainfall",
  "snowfall", "visibility", "wind", "speedLimit", "accidentSpeedA", "accidentSpeedB",
]);

const DETAIL_TEXT_KEYS = new Set([
  "primaryCauseOther",
  "secondaryCauseOther",
  "rootCauseDetail",
  "riskIncidentDisruptionStatus",
  "riskIncidentDisruptionCause",
  "riskIncidentCauseDetail",
  "nearMissStatus",
  "nearMissCause",
  "nearMissDetail",
  "delayOperationStatus",
  "delayOperationCause",
  "delayOperationCauseDetail",
  "facilityDamage",
  "accidentOverview",
  "actionContent",
  "preventionPlan",
  "investigationReportLinks",
]);

const VARCHAR_LIMIT = 191;

function normalizeDetailValue(key: string, value: unknown): unknown {
  if (value === null || value === undefined || value === "") return null;
  if (DETAIL_INT_KEYS.has(key)) {
    const parsed = Number(String(value).replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }
  if (DETAIL_DECIMAL_KEYS.has(key)) {
    const parsed = Number(String(value).replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  const text = String(value);
  if (DETAIL_TEXT_KEYS.has(key)) {
    return text;
  }
  return text.length > VARCHAR_LIMIT ? text.slice(0, VARCHAR_LIMIT) : text;
}

function trimToVarchar(value: unknown, fallback: string): string {
  const text = String(value ?? "").trim() || fallback;
  return text.length > VARCHAR_LIMIT ? text.slice(0, VARCHAR_LIMIT) : text;
}

export class AccidentService {
  constructor(
    private readonly accidentRepository: AccidentRepository,
    private readonly permissionRepository: PermissionRepository,
    private readonly publicationService?: AccidentDetailPublicationService,
  ) {}

  async getAccidents(input: GetAccidentsInput, auth: { roleId: number; role: string }) {
    const page = Number(input.page ?? 1);
    const pageSize = Number(input.pageSize ?? 10);

    if (!Number.isInteger(page) || page < 1) {
      throw new HttpError(400, "page must be an integer greater than 0.");
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new HttpError(400, "pageSize must be an integer between 1 and 100.");
    }

    const startDate = input.startDate ? parseQueryStartDate(input.startDate) : undefined;
    const endDate = input.endDate ? parseQueryEndDate(input.endDate) : undefined;

    if (startDate && Number.isNaN(startDate.getTime())) {
      throw new HttpError(400, "Invalid startDate format.");
    }
    if (endDate && Number.isNaN(endDate.getTime())) {
      throw new HttpError(400, "Invalid endDate format.");
    }
    if (startDate && endDate && startDate > endDate) {
      throw new HttpError(400, "startDate cannot be greater than endDate.");
    }

    const allowedTypes: AccidentType[] = [
      "COLLISION",
      "DERAILMENT",
      "FIRE",
      "SIGNAL_FAILURE",
      "HUMAN_ERROR",
      "TRACK_DEFECT",
      "OTHER",
    ];

    let accidentType: AccidentType | undefined;
    if (input.accidentType) {
      if (!allowedTypes.includes(input.accidentType as AccidentType)) {
        throw new HttpError(400, "Invalid accidentType value.");
      }
      accidentType = input.accidentType as AccidentType;
    }

    let finalStartDate = startDate;
    let finalEndDate = endDate;
    let finalLineNames = input.lineName?.trim() ? [input.lineName.trim()] : undefined;
    let finalAccidentTypes = accidentType ? [accidentType] : undefined;
    let finalAccidentKindCategories = undefined as AccidentKindCategory[] | undefined;
    let finalAccidentKinds = undefined as string[] | undefined;
    let finalLocationScope = undefined as ReturnType<typeof normalizeLocationScope> | undefined;

    if (input.accidentKindCategory) {
      const category = input.accidentKindCategory.trim();
      if (!(ACCIDENT_KIND_CATEGORIES as readonly string[]).includes(category)) {
        throw new HttpError(400, "Invalid accidentKindCategory value.");
      }
      finalAccidentKindCategories = [category as AccidentKindCategory];
    }

    if (input.accidentKinds) {
      finalAccidentKinds = input.accidentKinds
        .split(",")
        .map((kind) => kind.trim())
        .filter(Boolean);
      if (!finalAccidentKinds.length) {
        throw new HttpError(400, "Invalid accidentKinds value.");
      }
    }

    if (auth.role !== ROLES.ADMIN) {
      const queryPermission = await this.permissionRepository.findRoleQueryPermission(auth.roleId);
      if (queryPermission) {
        const permissionLineNames = Array.isArray(queryPermission.allowedLineNames)
          ? (queryPermission.allowedLineNames as string[])
          : undefined;
        const permissionCategories = normalizeAccidentKindCategories(queryPermission.allowedTypes);
        const permissionLocationScope = normalizeLocationScope(queryPermission.allowedLocationScope);

        if (queryPermission.minAccidentAt && (!finalStartDate || finalStartDate < queryPermission.minAccidentAt)) {
          if (queryPermission.enforcementMode === "BLOCK" && finalStartDate) {
            throw new HttpError(403, "Requested startDate is outside allowed range.");
          }
          finalStartDate = queryPermission.minAccidentAt;
        }

        if (queryPermission.maxAccidentAt && (!finalEndDate || finalEndDate > queryPermission.maxAccidentAt)) {
          if (queryPermission.enforcementMode === "BLOCK" && finalEndDate) {
            throw new HttpError(403, "Requested endDate is outside allowed range.");
          }
          finalEndDate = queryPermission.maxAccidentAt;
        }

        if (queryPermission.enforcedLineName) {
          if (
            queryPermission.enforcementMode === "BLOCK" &&
            finalLineNames &&
            !finalLineNames.includes(queryPermission.enforcedLineName)
          ) {
            throw new HttpError(403, "Only enforced line is allowed for this role.");
          }
          finalLineNames = [queryPermission.enforcedLineName];
        } else if (permissionLocationScope.length === 0 && permissionLineNames && permissionLineNames.length > 0) {
          if (finalLineNames && finalLineNames.length > 0) {
            const intersection = finalLineNames.filter((line) => permissionLineNames.includes(line));
            if (intersection.length === 0) {
              if (queryPermission.enforcementMode === "BLOCK") {
                throw new HttpError(403, "Requested lineName is not allowed for this role.");
              }
              finalLineNames = permissionLineNames;
            } else {
              finalLineNames = intersection;
            }
          } else {
            finalLineNames = permissionLineNames;
          }
        }

        if (permissionCategories.length > 0) {
          if (finalAccidentKinds?.length) {
            const allowedKinds = finalAccidentKinds.filter((kind) =>
              rowMatchesAccidentKindCategories(kind, permissionCategories),
            );
            if (!allowedKinds.length) {
              if (queryPermission.enforcementMode === "BLOCK") {
                throw new HttpError(403, "Requested accidentKinds are not allowed for this role.");
              }
              finalAccidentKinds = undefined;
            } else {
              finalAccidentKinds = allowedKinds;
            }
          }

          if (finalAccidentKindCategories && finalAccidentKindCategories.length > 0) {
            const intersectionCategories = finalAccidentKindCategories.filter((category) =>
              permissionCategories.includes(category),
            );
            if (intersectionCategories.length === 0) {
              if (queryPermission.enforcementMode === "BLOCK") {
                throw new HttpError(403, "Requested accidentKindCategory is not allowed for this role.");
              }
              finalAccidentKindCategories = permissionCategories;
            } else {
              finalAccidentKindCategories = intersectionCategories;
            }
          } else {
            finalAccidentKindCategories = permissionCategories;
          }
        }

        if (permissionLocationScope.length > 0) {
          finalLocationScope = permissionLocationScope;
        }
      }
    }

    const { items, total } = await this.accidentRepository.findMany({
      startDate: finalStartDate,
      endDate: finalEndDate,
      lineNames: finalLineNames,
      accidentTypes: finalAccidentTypes,
      accidentKindCategories: finalAccidentKindCategories,
      accidentKinds: finalAccidentKinds,
      locationScope: finalLocationScope,
      registrationAgency: input.registrationAgency?.trim() || undefined,
      page,
      pageSize,
    });

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      sort: {
        by: "accidentAt",
        order: "desc",
      },
    };
  }

  async getFilterOptions(
    auth: { roleId: number; role: string },
  ): Promise<{ registrationAgencies: string[]; lineNames: string[]; railCategories: string[] }> {
    if (auth.role === ROLES.ADMIN) {
      const [registrationAgencies, lineNames, railCategories] = await Promise.all([
        this.accidentRepository.findDistinctRegistrationAgencies(),
        this.accidentRepository.findDistinctLineNames(),
        this.accidentRepository.findDistinctRailCategories(),
      ]);
      return { registrationAgencies, lineNames, railCategories };
    }

    const queryPermission = await this.permissionRepository.findRoleQueryPermission(auth.roleId);
    const locationScope = normalizeLocationScope(queryPermission?.allowedLocationScope);
    const permissionLineNames = Array.isArray(queryPermission?.allowedLineNames)
      ? (queryPermission.allowedLineNames as string[]).map((line) => line.trim()).filter(Boolean)
      : undefined;

    const scopeFilters: { lineNames?: string[]; locationScope?: ReturnType<typeof normalizeLocationScope> } = {};

    if (queryPermission?.enforcedLineName?.trim()) {
      scopeFilters.lineNames = [queryPermission.enforcedLineName.trim()];
    } else if (locationScope.length === 0 && permissionLineNames && permissionLineNames.length > 0) {
      scopeFilters.lineNames = permissionLineNames;
    }

    if (locationScope.length > 0) {
      scopeFilters.locationScope = locationScope;
    }

    let registrationAgencies: string[];
    if (locationScope.length > 0) {
      registrationAgencies = [...new Set(locationScope.map((rule) => rule.institutionName))].sort((a, b) =>
        a.localeCompare(b, "ko"),
      );
    } else {
      registrationAgencies = await this.accidentRepository.findDistinctRegistrationAgencies();
    }

    const [lineNames, railCategories] = await Promise.all([
      this.accidentRepository.findDistinctLineNames(scopeFilters),
      this.accidentRepository.findDistinctRailCategories(scopeFilters),
    ]);

    let resolvedLineNames = lineNames;
    if (queryPermission?.enforcedLineName?.trim() && resolvedLineNames.length === 0) {
      resolvedLineNames = [queryPermission.enforcedLineName.trim()];
    }

    return { registrationAgencies, lineNames: resolvedLineNames, railCategories };
  }

  async getAccidentById(
    id: number,
    auth: { roleId: number; role: string },
  ): Promise<{ accident: RailwayAccident; publication: ReturnType<typeof buildPublicationMeta> }> {
    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "Invalid accident id.");
    }

    const accident = await this.accidentRepository.findById(id);
    if (!accident) {
      throw new HttpError(404, "Accident not found.");
    }

    if (auth.role !== ROLES.ADMIN) {
      const { items } = await this.getAccidents(
        {
          page: "1",
          pageSize: "100",
          lineName: accident.lineName,
          accidentType: accident.accidentType,
        },
        auth,
      );

      const allowed = items.some((item) => item.id === accident.id);
      if (!allowed) {
        throw new HttpError(403, "You do not have permission to view this accident.");
      }
    }

    if (this.publicationService) {
      const filtered = await this.publicationService.applyPublicationFilter(
        accident as unknown as Record<string, unknown>,
        auth,
      );
      return {
        accident: filtered.record as unknown as RailwayAccident,
        publication: filtered.publication,
      };
    }

    return {
      accident,
      publication: buildPublicationMeta([...ALL_ACCIDENT_DETAIL_COLUMN_KEYS], [...ALL_ACCIDENT_DETAIL_TAB_IDS]),
    };
  }

  async upsertBulk(input: BulkAccidentInput, auth: { roleId: number; role: string }) {
    if (auth.role !== ROLES.ADMIN) {
      throw new HttpError(403, "Only admin can use bulk registration.");
    }

    const records = Array.isArray(input.records) ? input.records : [];
    if (records.length === 0) {
      throw new HttpError(400, "records is required.");
    }
    if (records.length > BULK_MAX_RECORDS) {
      throw new HttpError(400, `일괄등록은 최대 ${BULK_MAX_RECORDS.toLocaleString("ko-KR")}건까지 가능합니다.`);
    }

    const normalized = records.map((record, index) => {
      const base = record.base ?? {};
      const detail = record.detail ?? {};

      const accidentAtValue = base.accidentAt;
      const accidentAt = new Date(typeof accidentAtValue === "string" ? accidentAtValue : "");
      if (Number.isNaN(accidentAt.getTime())) {
        throw new HttpError(400, `records[${index}].base.accidentAt is invalid.`);
      }

      const lineName = trimToVarchar(base.lineName, "");
      if (!lineName) {
        throw new HttpError(400, `records[${index}].base.lineName is required.`);
      }

      const type = String(base.accidentType ?? "").trim() as AccidentType;
      const allowedTypes: AccidentType[] = [
        "COLLISION",
        "DERAILMENT",
        "FIRE",
        "SIGNAL_FAILURE",
        "HUMAN_ERROR",
        "TRACK_DEFECT",
        "OTHER",
      ];
      if (!allowedTypes.includes(type)) {
        throw new HttpError(400, `records[${index}].base.accidentType is invalid.`);
      }

      const toNumber = (value: unknown): number => {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return 0;
        return parsed;
      };

      const trainCountRaw = Number(base.trainCount);
      const normalizedDetail: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(detail)) {
        normalizedDetail[key] = normalizeDetailValue(key, value);
      }

      return {
        base: {
          accidentAt,
          location: trimToVarchar(base.location, "미상"),
          lineName,
          accidentType: type,
          cause: trimToVarchar(base.cause, "미상"),
          damageScale: trimToVarchar(base.damageScale, "미상"),
          deaths: Math.max(0, toNumber(base.deaths)),
          injuries: Math.max(0, toNumber(base.injuries)),
          trainCount: Number.isFinite(trainCountRaw) ? trainCountRaw : null,
          weather: trimToVarchar(base.weather, "").trim() || null,
        },
        detail: normalizedDetail,
      };
    });

    return this.accidentRepository.upsertBulk(normalized);
  }

  async deleteAccidents(input: DeleteAccidentsInput, auth: { roleId: number; role: string }) {
    if (auth.role !== ROLES.ADMIN) {
      throw new HttpError(403, "Only admin can delete accidents.");
    }

    const rawIds = Array.isArray(input.ids) ? input.ids : [];
    if (rawIds.length === 0) {
      throw new HttpError(400, "ids is required.");
    }

    const ids = rawIds
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);

    if (ids.length === 0) {
      throw new HttpError(400, "No valid ids provided.");
    }

    if (ids.length > 500) {
      throw new HttpError(400, "Cannot delete more than 500 records at once.");
    }

    const deleted = await this.accidentRepository.deleteByIds(Array.from(new Set(ids)));
    return { deleted };
  }

  async bulkUpdateInvestigationReports(
    input: BulkInvestigationReportInput,
    auth: { roleId: number; role: string },
  ) {
    if (auth.role !== ROLES.ADMIN) {
      throw new HttpError(403, "Only admin can bulk update investigation reports.");
    }

    const records = Array.isArray(input.records) ? input.records : [];
    if (records.length === 0) {
      throw new HttpError(400, "records is required.");
    }
    if (records.length > BULK_MAX_RECORDS) {
      throw new HttpError(400, `일괄등록은 최대 ${BULK_MAX_RECORDS.toLocaleString("ko-KR")}건까지 가능합니다.`);
    }

    const savedAtText = formatInvestigationReportSavedAtText();
    const normalized: Array<{ accidentNumber: string; investigationReportLinks: string; savedAtText: string }> = [];

    for (const [index, record] of records.entries()) {
      const accidentNumber = String(record.accidentNumber ?? "").trim();
      if (!accidentNumber) {
        continue;
      }

      const urls = Array.isArray(record.urls)
        ? record.urls.map((value) => String(value ?? "").trim()).filter(Boolean)
        : [];

      let links;
      try {
        links = buildInvestigationReportLinksFromUrls(urls);
      } catch (error) {
        throw new HttpError(
          400,
          `records[${index}].urls: ${error instanceof Error ? error.message : "Invalid URLs."}`,
        );
      }

      if (links.length === 0) {
        continue;
      }

      normalized.push({
        accidentNumber,
        investigationReportLinks: serializeInvestigationReportLinks(links),
        savedAtText,
      });
    }

    if (normalized.length === 0) {
      throw new HttpError(400, "No valid records with accident number and attachment URLs.");
    }

    const skipped = records.length - normalized.length;
    const result = await this.accidentRepository.bulkUpdateInvestigationReportLinksByAccidentNumber(normalized);

    return {
      updated: result.updated,
      notFound: result.notFound,
      skipped: skipped + result.skipped,
    };
  }

  async updateInvestigationReports(
    id: number,
    linksInput: unknown,
    auth: { roleId: number; role: string },
  ) {
    if (auth.role !== ROLES.ADMIN) {
      throw new HttpError(403, "Only admin can update investigation reports.");
    }

    if (!Number.isInteger(id) || id < 1) {
      throw new HttpError(400, "Invalid accident id.");
    }

    const accident = await this.accidentRepository.findById(id);
    if (!accident) {
      throw new HttpError(404, "Accident not found.");
    }

    let links;
    try {
      links = normalizeInvestigationReportLinksInput(linksInput);
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : "Invalid links.");
    }

    const savedAtText = formatInvestigationReportSavedAtText();
    try {
      await this.accidentRepository.updateInvestigationReportLinks(
        id,
        serializeInvestigationReportLinks(links),
        savedAtText,
      );
    } catch (error) {
      if (error instanceof Error && error.message === "Accident detail not found.") {
        throw new HttpError(404, error.message);
      }
      throw error;
    }

    return {
      investigationReportLinks: links,
      savedAtText,
    };
  }

  async downloadInvestigationReportFile(
    id: number,
    linkId: string,
    auth: { roleId: number; role: string },
  ) {
    const trimmedLinkId = linkId.trim();
    if (!trimmedLinkId) {
      throw new HttpError(400, "linkId is required.");
    }

    const { accident } = await this.getAccidentById(id, auth);
    const detail = (accident as RailwayAccident & { detail?: { investigationReportLinks?: string | null } | null })
      .detail;
    const links = parseInvestigationReportLinks(detail?.investigationReportLinks);
    const link = links.find((item) => item.id === trimmedLinkId);
    if (!link) {
      throw new HttpError(404, "Report link not found.");
    }

    let response: Response;
    try {
      response = await fetch(link.url, { redirect: "follow" });
    } catch {
      throw new HttpError(502, "Failed to fetch report file.");
    }

    if (!response.ok) {
      throw new HttpError(502, "Failed to fetch report file.");
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const filename = inferInvestigationReportFilename(
      link.url,
      link.title,
      response.headers.get("content-disposition"),
    );
    const contentType = response.headers.get("content-type") || "application/octet-stream";

    return { buffer, filename, contentType };
  }
}
