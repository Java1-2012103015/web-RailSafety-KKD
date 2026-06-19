import { ROLES } from "../constants/roles";
import { AccidentDetailPublicationRepository } from "../repositories/accident-detail-publication.repository";
import { RoleRepository } from "../repositories/role.repository";
import { HttpError } from "../utils/http-error";
import {
  buildPublicationCatalog,
  buildPublicationMeta,
  filterAccidentRecordByVisibleColumns,
  normalizeVisibleColumnKeys,
  normalizeVisibleTabKeys,
  resolveVisibleColumnKeys,
  resolveVisibleTabKeys,
} from "../utils/accident-detail-publication";
import { ALL_ACCIDENT_DETAIL_COLUMN_KEYS } from "../constants/accident-detail-column-groups";
import { ALL_ACCIDENT_DETAIL_TAB_IDS } from "../constants/accident-detail-ui-tabs";

export class AccidentDetailPublicationService {
  constructor(
    private readonly publicationRepository: AccidentDetailPublicationRepository,
    private readonly roleRepository: RoleRepository,
  ) {}

  getAdminCatalog() {
    return buildPublicationCatalog();
  }

  async getAdminSettings() {
    const [roles, stored] = await Promise.all([
      this.roleRepository.findAll(),
      this.publicationRepository.findAll(),
    ]);

    const storedMap = new Map(
      stored.map((row) => [
        row.roleId,
        {
          columns: normalizeVisibleColumnKeys(row.visibleColumnKeys),
          tabs: normalizeVisibleTabKeys(row.visibleTabKeys),
        },
      ]),
    );

    return {
      catalog: buildPublicationCatalog(),
      roles: roles.map((role) => {
        const storedEntry = storedMap.get(role.id);
        const visibleColumnKeys = resolveVisibleColumnKeys(storedEntry?.columns);
        const visibleTabKeys = resolveVisibleTabKeys(storedEntry?.tabs);
        return {
          roleId: role.id,
          roleName: role.name,
          ...buildPublicationMeta(visibleColumnKeys, visibleTabKeys),
        };
      }),
    };
  }

  async updateRolePublication(roleId: number, visibleColumnKeys: string[], visibleTabKeys: string[]) {
    const role = await this.roleRepository.findById(roleId);
    if (!role) {
      throw new HttpError(404, "Role not found.");
    }

    const allowed = new Set<string>(ALL_ACCIDENT_DETAIL_COLUMN_KEYS);
    const filteredColumns = visibleColumnKeys.filter((key) => allowed.has(key));
    const filteredTabs = normalizeVisibleTabKeys(visibleTabKeys);
    await this.publicationRepository.upsert(roleId, filteredColumns, filteredTabs);

    return {
      roleId: role.id,
      roleName: role.name,
      ...buildPublicationMeta(filteredColumns, resolveVisibleTabKeys(filteredTabs)),
    };
  }

  async getVisibleColumnKeysForRole(roleId: number, role: string): Promise<string[]> {
    if (role === ROLES.ADMIN) {
      return [...ALL_ACCIDENT_DETAIL_COLUMN_KEYS];
    }
    const stored = await this.publicationRepository.findByRoleId(roleId);
    return resolveVisibleColumnKeys(normalizeVisibleColumnKeys(stored?.visibleColumnKeys));
  }

  async getVisibleTabKeysForRole(roleId: number, role: string): Promise<string[]> {
    if (role === ROLES.ADMIN) {
      return [...ALL_ACCIDENT_DETAIL_TAB_IDS];
    }
    const stored = await this.publicationRepository.findByRoleId(roleId);
    return resolveVisibleTabKeys(normalizeVisibleTabKeys(stored?.visibleTabKeys));
  }

  async applyPublicationFilter<T extends Record<string, unknown>>(
    record: T,
    auth: { roleId: number; role: string },
  ): Promise<{ record: T; publication: ReturnType<typeof buildPublicationMeta> }> {
    const visibleColumnKeys = await this.getVisibleColumnKeysForRole(auth.roleId, auth.role);
    const visibleTabKeys = await this.getVisibleTabKeysForRole(auth.roleId, auth.role);
    const visibleSet = new Set(visibleColumnKeys);
    const publication = buildPublicationMeta(visibleColumnKeys, visibleTabKeys);

    if (auth.role === ROLES.ADMIN) {
      return { record, publication };
    }

    return {
      record: filterAccidentRecordByVisibleColumns(record, visibleSet),
      publication,
    };
  }
}
