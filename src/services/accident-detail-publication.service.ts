import { ROLES } from "../constants/roles";
import { AccidentDetailPublicationRepository } from "../repositories/accident-detail-publication.repository";
import { RoleRepository } from "../repositories/role.repository";
import { HttpError } from "../utils/http-error";
import {
  buildPublicationCatalog,
  buildPublicationMeta,
  filterAccidentRecordByVisibleColumns,
  normalizeVisibleColumnKeys,
  resolveVisibleColumnKeys,
} from "../utils/accident-detail-publication";
import { ALL_ACCIDENT_DETAIL_COLUMN_KEYS } from "../constants/accident-detail-column-groups";

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

    const storedMap = new Map(stored.map((row) => [row.roleId, normalizeVisibleColumnKeys(row.visibleColumnKeys)]));

    return {
      catalog: buildPublicationCatalog(),
      roles: roles.map((role) => {
        const visibleColumnKeys = resolveVisibleColumnKeys(storedMap.get(role.id));
        return {
          roleId: role.id,
          roleName: role.name,
          ...buildPublicationMeta(visibleColumnKeys),
        };
      }),
    };
  }

  async updateRolePublication(roleId: number, visibleColumnKeys: string[]) {
    const role = await this.roleRepository.findById(roleId);
    if (!role) {
      throw new HttpError(404, "Role not found.");
    }

    const allowed = new Set<string>(ALL_ACCIDENT_DETAIL_COLUMN_KEYS);
    const filtered = visibleColumnKeys.filter((key) => allowed.has(key));
    await this.publicationRepository.upsert(roleId, filtered);

    return {
      roleId: role.id,
      roleName: role.name,
      ...buildPublicationMeta(filtered),
    };
  }

  async getVisibleColumnKeysForRole(roleId: number, role: string): Promise<string[]> {
    if (role === ROLES.ADMIN) {
      return [...ALL_ACCIDENT_DETAIL_COLUMN_KEYS];
    }
    const stored = await this.publicationRepository.findByRoleId(roleId);
    return resolveVisibleColumnKeys(normalizeVisibleColumnKeys(stored?.visibleColumnKeys));
  }

  async applyPublicationFilter<T extends Record<string, unknown>>(
    record: T,
    auth: { roleId: number; role: string },
  ): Promise<{ record: T; publication: ReturnType<typeof buildPublicationMeta> }> {
    const visibleColumnKeys = await this.getVisibleColumnKeysForRole(auth.roleId, auth.role);
    const visibleSet = new Set(visibleColumnKeys);
    const publication = buildPublicationMeta(visibleColumnKeys);

    if (auth.role === ROLES.ADMIN) {
      return { record, publication };
    }

    return {
      record: filterAccidentRecordByVisibleColumns(record, visibleSet),
      publication,
    };
  }
}
