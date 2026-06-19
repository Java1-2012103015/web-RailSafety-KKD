import { prisma } from "../config/prisma";

export class AccidentDetailPublicationRepository {
  findByRoleId(roleId: number) {
    return prisma.roleAccidentDetailPublication.findUnique({ where: { roleId } });
  }

  findAll() {
    return prisma.roleAccidentDetailPublication.findMany();
  }

  upsert(roleId: number, visibleColumnKeys: string[], visibleTabKeys: string[]) {
    return prisma.roleAccidentDetailPublication.upsert({
      where: { roleId },
      create: { roleId, visibleColumnKeys, visibleTabKeys },
      update: { visibleColumnKeys, visibleTabKeys },
    });
  }
}
