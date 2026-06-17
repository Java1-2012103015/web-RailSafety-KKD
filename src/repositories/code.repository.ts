import { prisma } from "../config/prisma";
import {
  buildLineCode,
  REGISTRATION_AGENCY_CODE_PRESETS,
  suggestInstitutionCode,
  UNREGISTERED_AGENCY_CODE,
  UNREGISTERED_AGENCY_NAME,
} from "../utils/registration-agency-codes";
import type { RegistrationAgencyLine } from "../repositories/accident.repository";

type InstitutionRecord = { id: number; code: string; name: string };
type LineRecord = { id: number; code: string; name: string; institutionId: number };

export class CodeRepository {
  private readonly db = prisma as any;

  findCodeTree() {
    return this.db.institutionCode.findMany({
      orderBy: [{ code: "asc" }],
      include: {
        lines: {
          orderBy: [{ code: "asc" }],
          include: {
            stations: {
              orderBy: [{ code: "asc" }],
            },
          },
        },
      },
    });
  }

  async replaceInstitutions(rows: { code: string; name: string }[]) {
    await this.db.$transaction(async (tx: any) => {
      await tx.stationCode.deleteMany({});
      await tx.lineCode.deleteMany({});
      await tx.institutionCode.deleteMany({});
      if (rows.length > 0) {
        await tx.institutionCode.createMany({ data: rows, skipDuplicates: true });
      }
    });
  }

  async replaceLines(rows: { institutionCode: string; code: string; name: string }[]) {
    await this.db.$transaction(async (tx: any) => {
      await tx.stationCode.deleteMany({});
      await tx.lineCode.deleteMany({});

      const institutions: { code: string; id: number }[] = await tx.institutionCode.findMany();
      const institutionIdByCode = new Map(institutions.map((i: { code: string; id: number }) => [i.code, i.id]));
      const createRows = rows
        .map((row) => ({ institutionId: institutionIdByCode.get(row.institutionCode), code: row.code, name: row.name }))
        .filter((row): row is { institutionId: number; code: string; name: string } => Boolean(row.institutionId));
      if (createRows.length > 0) {
        await tx.lineCode.createMany({ data: createRows, skipDuplicates: true });
      }
    });
  }

  async replaceStations(rows: { lineCode: string; code: string; name: string }[]) {
    await this.db.$transaction(async (tx: any) => {
      await tx.stationCode.deleteMany({});
      const lines: { code: string; id: number }[] = await tx.lineCode.findMany();
      const lineIdByCode = new Map(lines.map((l: { code: string; id: number }) => [l.code, l.id]));
      const createRows = rows
        .map((row) => ({ lineId: lineIdByCode.get(row.lineCode), code: row.code, name: row.name }))
        .filter((row): row is { lineId: number; code: string; name: string } => Boolean(row.lineId));
      if (createRows.length > 0) {
        await tx.stationCode.createMany({ data: createRows, skipDuplicates: true });
      }
    });
  }

  async upsertCodeTree(
    tree: Array<{
      code: string;
      name: string;
      lines?: Array<{
        code: string;
        name: string;
        stations?: Array<{ code: string; name: string }>;
      }>;
    }>,
  ) {
    for (const inst of tree) {
      const institution = await this.db.institutionCode.upsert({
        where: { code: inst.code },
        update: { name: inst.name },
        create: { code: inst.code, name: inst.name },
      });

      for (const line of inst.lines ?? []) {
        const lineRecord = await this.db.lineCode.upsert({
          where: { code: line.code },
          update: { name: line.name, institutionId: institution.id },
          create: { code: line.code, name: line.name, institutionId: institution.id },
        });

        for (const station of line.stations ?? []) {
          await this.db.stationCode.upsert({
            where: { code: station.code },
            update: { name: station.name, lineId: lineRecord.id },
            create: { code: station.code, name: station.name, lineId: lineRecord.id },
          });
        }
      }
    }
  }

  async syncInstitutionsFromRegistrationAgencies(
    agencyNames: string[],
  ): Promise<{ created: number; updated: number; total: number }> {
    const names = [...new Set(agencyNames.map((name) => name.trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "ko"),
    );

    const existing: InstitutionRecord[] = await this.db.institutionCode.findMany();
    const byName = new Map<string, InstitutionRecord>(
      existing.map((item) => [item.name, item]),
    );
    const byCode = new Map<string, InstitutionRecord>(
      existing.map((item) => [item.code, item]),
    );
    const usedCodes = new Set<string>(existing.map((item) => item.code));

    /** GYEONGGI_QUERY_TREE upsert 대상 — 사고DB 동기화로 기관명이 바뀌지 않도록 보호 */
    const PROTECTED_INSTITUTION_CODES = new Set([
      "GIMPO_GOLD",
      "YONGIN",
      "UIJEONGBU",
      "GURI",
      "SEOUL_METRO",
    ]);

    let created = 0;
    let updated = 0;

    for (let index = 0; index < names.length; index += 1) {
      const name = names[index];
      let institution: InstitutionRecord | undefined = byName.get(name);

      if (!institution) {
        const presetCode = REGISTRATION_AGENCY_CODE_PRESETS[name];
        if (presetCode && byCode.has(presetCode)) {
          institution = byCode.get(presetCode);
        }
      }

      if (institution) {
        if (
          institution.name !== name &&
          !PROTECTED_INSTITUTION_CODES.has(institution.code)
        ) {
          const updatedInstitution = await this.db.institutionCode.update({
            where: { id: institution.id },
            data: { name },
          });
          byName.delete(institution.name);
          byName.set(name, updatedInstitution);
          updated += 1;
        }
        continue;
      }

      const code = suggestInstitutionCode(name, usedCodes, index + 1);
      usedCodes.add(code);
      const createdInstitution = await this.db.institutionCode.create({
        data: { code, name },
      });
      byName.set(name, createdInstitution);
      byCode.set(code, createdInstitution);
      created += 1;
    }

    return { created, updated, total: names.length };
  }

  async syncLinesFromAccidentData(
    pairs: RegistrationAgencyLine[],
  ): Promise<{ created: number; updated: number; skipped: number; total: number }> {
    let fallbackInstitution = await this.db.institutionCode.findFirst({
      where: { code: UNREGISTERED_AGENCY_CODE },
    });
    if (!fallbackInstitution) {
      fallbackInstitution = await this.db.institutionCode.create({
        data: { code: UNREGISTERED_AGENCY_CODE, name: UNREGISTERED_AGENCY_NAME },
      });
    }

    const institutions: InstitutionRecord[] = await this.db.institutionCode.findMany();
    const institutionByName = new Map<string, InstitutionRecord>(
      institutions.map((item) => [item.name, item]),
    );
    institutionByName.set(UNREGISTERED_AGENCY_NAME, fallbackInstitution);

    const existingLines: LineRecord[] = await this.db.lineCode.findMany();
    const lineByInstitutionAndName = new Map<string, LineRecord>(
      existingLines.map((line) => [`${line.institutionId}:${line.name}`, line]),
    );
    const usedLineCodes = new Set<string>(existingLines.map((line) => line.code));

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const pair of pairs) {
      const lineName = pair.lineName.trim();
      if (!lineName) {
        skipped += 1;
        continue;
      }

      const agencyName = pair.registrationAgency?.trim() || UNREGISTERED_AGENCY_NAME;
      const institution = institutionByName.get(agencyName);
      if (!institution) {
        skipped += 1;
        continue;
      }

      const lineKey = `${institution.id}:${lineName}`;
      const existing = lineByInstitutionAndName.get(lineKey);
      if (existing) {
        if (existing.name !== lineName) {
          const updatedLine = await this.db.lineCode.update({
            where: { id: existing.id },
            data: { name: lineName },
          });
          lineByInstitutionAndName.set(lineKey, updatedLine);
          updated += 1;
        }
        continue;
      }

      const code = buildLineCode(institution.code, lineName, usedLineCodes);
      usedLineCodes.add(code);
      const createdLine = await this.db.lineCode.create({
        data: {
          code,
          name: lineName,
          institutionId: institution.id,
        },
      });
      lineByInstitutionAndName.set(lineKey, createdLine);
      created += 1;
    }

    return { created, updated, skipped, total: pairs.length };
  }
}
