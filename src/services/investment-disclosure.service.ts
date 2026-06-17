import {
  DEFAULT_INVESTMENT_DISCLOSURE_ROWS,
  INVESTMENT_DISCLOSURE_SAMPLE_CSV,
} from "../constants/investment-disclosure-default";
import { InvestmentDisclosureRepository } from "../repositories/investment-disclosure.repository";
import {
  buildDashboardAnalytics,
  filterRowsForTable,
  paginateRecords,
  type DisclosureFilters,
} from "../utils/investment-disclosure-analytics";
import { buildInvestmentDisclosureReport } from "../utils/investment-disclosure-report";
import {
  buildInvestmentDisclosureExportCsv,
  parseInvestmentDisclosureCsv,
} from "../utils/investment-disclosure-csv";
export class InvestmentDisclosureService {
  constructor(private readonly repository: InvestmentDisclosureRepository) {}

  async ensureSeeded(): Promise<void> {
    await this.repository.seedDefaultsIfEmpty([...DEFAULT_INVESTMENT_DISCLOSURE_ROWS]);
  }

  private async loadRecords() {
    await this.ensureSeeded();
    const rows = await this.repository.findAll();
    return rows.map((r) => ({
      id: r.id,
      agencyName: r.agencyName,
      disclosureYear: r.disclosureYear,
      category1: r.category1,
      category2: r.category2,
      category3: r.category3,
      yearLabel: r.yearLabel,
      amountMillion: r.amountMillion,
    }));
  }

  async getPortalDashboard(query: {
    agencies?: string[];
    category1?: string;
    search?: string;
    compareYear?: string;
    page?: string;
    pageSize?: string;
  }) {
    const all = await this.loadRecords();
    const filters: DisclosureFilters = {
      agencies: query.agencies,
      category1: query.category1,
      search: query.search,
      compareYear: query.compareYear,
    };

    const page = Math.max(1, parseInt(query.page ?? "1", 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(query.pageSize ?? "10", 10) || 10));

    const agencies = Array.from(new Set(all.map((d) => d.agencyName))).sort((a, b) =>
      a.localeCompare(b, "ko"),
    );
    const categories = ["ALL", ...Array.from(new Set(all.map((d) => d.category1)))];

    const filtered = filterRowsForTable(all, filters);
    const analytics = buildDashboardAnalytics(all, filters);

    return {
      meta: {
        totalRecords: all.length,
        agencies,
        categories,
      },
      analytics,
      records: paginateRecords(filtered, page, pageSize),
      pagination: {
        page,
        pageSize,
        totalRecords: filtered.length,
        totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
      },
    };
  }

  async uploadCsv(csv?: string) {
    const parsed = parseInvestmentDisclosureCsv(csv);
    const count = await this.repository.replaceAll(parsed);
    return { importedCount: count };
  }

  async getAdminInfo() {
    const count = await this.repository.count();
    const rows = count > 0 ? await this.repository.findAll() : [];
    const agencies = Array.from(new Set(rows.map((r) => r.agencyName)));
    return { recordCount: count, agencies };
  }

  getSampleCsv(): string {
    return INVESTMENT_DISCLOSURE_SAMPLE_CSV;
  }

  async getExportCsv(): Promise<string> {
    const rows = await this.loadRecords();
    return buildInvestmentDisclosureExportCsv(rows);
  }

  async getFilteredExportCsv(filters: DisclosureFilters): Promise<string> {
    const all = await this.loadRecords();
    const filtered = filterRowsForTable(all, filters);
    return buildInvestmentDisclosureExportCsv(filtered);
  }

  async getFilteredExportRows(filters: DisclosureFilters) {
    const all = await this.loadRecords();
    return filterRowsForTable(all, filters);
  }

  async getPrintReport(disclosureYear?: number) {
    const all = await this.loadRecords();
    return buildInvestmentDisclosureReport(all, disclosureYear);
  }
}
