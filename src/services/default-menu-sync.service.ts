import { prisma } from "../config/prisma";

async function upsertRootMenu(title: string, path: string | null, sequence: number) {
  const byPath = path
    ? await prisma.menu.findFirst({ where: { path, parentId: null } })
    : null;
  const existing =
    byPath ?? (await prisma.menu.findFirst({ where: { title, parentId: null } }));

  if (existing) {
    return prisma.menu.update({
      where: { id: existing.id },
      data: { title, path, sequence },
    });
  }

  return prisma.menu.create({
    data: { title, path, sequence, parentId: null },
  });
}

async function upsertChildMenu(
  parentId: number,
  title: string,
  path: string | null,
  sequence: number,
) {
  const byPath = path
    ? await prisma.menu.findFirst({ where: { path, parentId } })
    : null;
  const existing =
    byPath ?? (await prisma.menu.findFirst({ where: { title, parentId } }));

  if (existing) {
    return prisma.menu.update({
      where: { id: existing.id },
      data: { title, path, sequence, parentId },
    });
  }

  return prisma.menu.create({
    data: { title, path, sequence, parentId },
  });
}

function isGuestScopedMenuPath(path: string | null): boolean {
  const value = path ?? "";
  return (
    value.startsWith("/dashboard") ||
    value.startsWith("/accidents") ||
    value.startsWith("/investment-disclosure") ||
    value.startsWith("/flood-alert") ||
    value.startsWith("/notices") ||
    value.startsWith("/archive")
  );
}

async function syncGuestScopedMenuPermissions(): Promise<void> {
  const scopedMenus = await prisma.menu.findMany({
    where: {
      OR: [
        { path: { startsWith: "/dashboard" } },
        { path: { startsWith: "/accidents" } },
        { path: { startsWith: "/investment-disclosure" } },
        { path: { startsWith: "/flood-alert" } },
        { path: { startsWith: "/notices" } },
        { path: { startsWith: "/archive" } },
      ],
    },
  });

  if (!scopedMenus.length) return;

  const roles = await prisma.role.findMany({
    where: {
      name: { in: ["GUEST", "GUEST_A", "GUEST_B"] },
    },
    select: { id: true },
  });

  for (const role of roles) {
    const existing = await prisma.roleMenuPermission.findMany({
      where: { roleId: role.id },
      select: { menuId: true },
    });
    const allowedIds = new Set(existing.map((item) => item.menuId));
    const hasScopedAccess = scopedMenus.some((menu) => allowedIds.has(menu.id));
    if (!hasScopedAccess) continue;

    const missing = scopedMenus.filter((menu) => !allowedIds.has(menu.id));
    if (!missing.length) continue;

    await prisma.roleMenuPermission.createMany({
      data: missing.map((menu) => ({ roleId: role.id, menuId: menu.id })),
      skipDuplicates: true,
    });
  }
}

export async function syncDefaultMenus(): Promise<void> {
  await prisma.menu.deleteMany({
    where: {
      OR: [
        { path: "/dashboard/notices" },
        { path: "/accidents/stats" },
        { path: "/accidents/causes" },
        { parentId: null, path: "/accidents" },
        { parentId: null, path: "/dashboard" },
        { parentId: null, path: "/investment-disclosure" },
        { parentId: null, title: "철도사고 DB 조회" },
        { parentId: null, title: "철도안전 투자공시 DB" },
      ],
    },
  });

  const dashboard = await upsertRootMenu("대시보드", null, 1);
  const board = await upsertRootMenu("게시판", null, 2);
  const railwayDb = await upsertRootMenu("철도 데이터베이스", null, 3);
  const admin = await upsertRootMenu("관리자", "/admin", 4);

  await upsertChildMenu(dashboard.id, "철도사고·장애", "/dashboard/accidents", 1);
  await upsertChildMenu(dashboard.id, "철도안전투자공시", "/dashboard/investment-disclosure", 2);
  await upsertChildMenu(dashboard.id, "철도시설사전침수경보", "/dashboard/pre-flood-alert", 3);

  await upsertChildMenu(board.id, "공지사항", "/notices", 1);
  await upsertChildMenu(board.id, "자료실", "/archive", 2);

  await upsertChildMenu(railwayDb.id, "철도사고장애정보 DB", "/accidents", 1);
  await upsertChildMenu(railwayDb.id, "철도안전 투자공시 DB", "/investment-disclosure", 2);
  await upsertChildMenu(railwayDb.id, "철도시설침수경보 DB", "/flood-alert", 3);

  await upsertChildMenu(admin.id, "사용자 관리", "/admin/users", 1);
  await upsertChildMenu(admin.id, "사용 등록 신청", "/admin/registrations", 2);
  await upsertChildMenu(admin.id, "메뉴 관리", "/admin/menus", 3);
  await upsertChildMenu(admin.id, "권한 관리", "/admin/roles", 4);
  await upsertChildMenu(admin.id, "코드 관리", "/admin/codes", 5);
  await upsertChildMenu(admin.id, "코드 종속관계 설정", "/admin/code-relations", 6);
  await upsertChildMenu(admin.id, "철도사고 DB 공개", "/admin/accident-db-publication", 7);
  await upsertChildMenu(admin.id, "철도안전 투자공시", "/admin/investment-disclosure", 8);
  await upsertChildMenu(admin.id, "철도시설침수경보 DB", "/admin/flood-alert", 9);
  await upsertChildMenu(admin.id, "외부 API · 주소/지도", "/admin/external-apis", 10);
  await upsertChildMenu(admin.id, "외부 API · 기상(침수경보)", "/admin/external-apis/weather", 11);
  await upsertChildMenu(admin.id, "외부 API · 뉴스", "/admin/external-apis/news", 12);

  await prisma.menu.deleteMany({
    where: {
      OR: [{ path: "/dashboard/notices" }, { title: "시스템 공지", parentId: dashboard.id }],
    },
  });

  await syncGuestScopedMenuPermissions();
}

export { isGuestScopedMenuPath };
