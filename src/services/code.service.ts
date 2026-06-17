import { AccidentRepository } from "../repositories/accident.repository";
import { CodeRepository } from "../repositories/code.repository";
import { HttpError } from "../utils/http-error";

type CodeCsvType = "institutions" | "lines" | "stations";
type CodeTree = {
  code: string;
  name: string;
  lines: {
    code: string;
    name: string;
    stations: { code: string; name: string }[];
  }[];
};

const SAMPLE: Record<CodeCsvType, string> = {
  institutions: "code,name\nKORAIL,한국철도공사\nMETRO_DG,대구교통공사\n",
  lines: "institutionCode,code,name\nKORAIL,GYEONGBU,경부선\nMETRO_DG,LINE1,대구도시철도 1호선\n",
  stations: "lineCode,code,name\nGYEONGBU,SEOUL,서울역\nLINE1,DAEGU,대구역\n",
};

export class CodeService {
  constructor(
    private readonly codeRepository: CodeRepository,
    private readonly accidentRepository: AccidentRepository,
  ) {}

  getSampleCsv(type: CodeCsvType): string {
    return SAMPLE[type];
  }

  async getCodeTree() {
    return this.codeRepository.findCodeTree();
  }

  async getExportCsv(type: CodeCsvType): Promise<string> {
    const tree = (await this.codeRepository.findCodeTree()) as CodeTree[];
    if (type === "institutions") {
      const rows = tree.map((i) => `${i.code},${i.name}`).join("\n");
      return `code,name\n${rows}\n`;
    }
    if (type === "lines") {
      const rows = tree
        .flatMap((i) => i.lines.map((line) => `${i.code},${line.code},${line.name}`))
        .join("\n");
      return `institutionCode,code,name\n${rows}\n`;
    }

    const rows = tree
      .flatMap((i) => i.lines.flatMap((line) => line.stations.map((s) => `${line.code},${s.code},${s.name}`)))
      .join("\n");
    return `lineCode,code,name\n${rows}\n`;
  }

  private parseCsv(csv: string): string[][] {
    return csv
      .trim()
      .split(/\r?\n/)
      .map((line) => line.split(",").map((part) => part.trim()));
  }

  async uploadCsv(type: CodeCsvType, csv?: string) {
    if (!csv?.trim()) {
      throw new HttpError(400, "csv is required.");
    }

    const rows = this.parseCsv(csv);
    if (rows.length < 2) {
      throw new HttpError(400, "CSV must include header and rows.");
    }

    const [header, ...dataRows] = rows;
    if (type === "institutions") {
      if (header.join(",") !== "code,name") {
        throw new HttpError(400, "institutions CSV header must be: code,name");
      }
      await this.codeRepository.replaceInstitutions(
        dataRows
          .filter((row) => row.length >= 2 && row[0] && row[1])
          .map((row) => ({ code: row[0], name: row[1] })),
      );
      return { uploaded: dataRows.length };
    }

    if (type === "lines") {
      if (header.join(",") !== "institutionCode,code,name") {
        throw new HttpError(400, "lines CSV header must be: institutionCode,code,name");
      }
      await this.codeRepository.replaceLines(
        dataRows
          .filter((row) => row.length >= 3 && row[0] && row[1] && row[2])
          .map((row) => ({ institutionCode: row[0], code: row[1], name: row[2] })),
      );
      return { uploaded: dataRows.length };
    }

    if (header.join(",") !== "lineCode,code,name") {
      throw new HttpError(400, "stations CSV header must be: lineCode,code,name");
    }
    await this.codeRepository.replaceStations(
      dataRows
        .filter((row) => row.length >= 3 && row[0] && row[1] && row[2])
        .map((row) => ({ lineCode: row[0], code: row[1], name: row[2] })),
    );
    return { uploaded: dataRows.length };
  }

  async syncRegistrationAgenciesFromAccidents() {
    const agencies = await this.accidentRepository.findDistinctRegistrationAgencies();
    const institutions = await this.codeRepository.syncInstitutionsFromRegistrationAgencies(agencies);
    const pairs = await this.accidentRepository.findDistinctRegistrationAgencyLines();
    const lines = await this.codeRepository.syncLinesFromAccidentData(pairs);
    return { institutions, lines };
  }
}

export type { CodeCsvType };
