import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/utils/password";
import { env } from "../src/config/env";
import { ROLES } from "../src/constants/roles";
import { MENU_ACTION_PATHS } from "../src/constants/menu-action-permissions";
import {
  GYEONGGI_DEFAULT_ALLOWED_LINE_NAMES,
  GYEONGGI_DEFAULT_LOCATION_SCOPE,
  GYEONGGI_QUERY_TREE,
  GYEONGGI_ROLE_NAME,
} from "../src/constants/query-location-scope";
import { CodeRepository } from "../src/repositories/code.repository";
import { AccidentRepository } from "../src/repositories/accident.repository";
import { InvestmentDisclosureRepository } from "../src/repositories/investment-disclosure.repository";
import { DEFAULT_INVESTMENT_DISCLOSURE_ROWS } from "../src/constants/investment-disclosure-default";
import { syncDefaultMenus } from "../src/services/default-menu-sync.service";

const prisma = new PrismaClient();

async function syncRoleMenuActionPermissions(
  roleId: number,
  options: { read?: boolean; create?: boolean; update?: boolean; delete?: boolean },
): Promise<void> {
  const canRead = options.read ?? true;
  const canCreate = options.create ?? false;
  const canUpdate = options.update ?? false;
  const canDelete = options.delete ?? false;

  await prisma.roleMenuActionPermission.deleteMany({ where: { roleId } });
  await prisma.roleMenuActionPermission.createMany({
    data: MENU_ACTION_PATHS.map((menuPath) => ({
      roleId,
      menuPath,
      canRead,
      canCreate,
      canUpdate,
      canDelete,
    })),
    skipDuplicates: true,
  });
}

async function main(): Promise<void> {
  const roleNames = Object.values(ROLES);

  for (const roleName of roleNames) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
  }

  const adminRole = await prisma.role.findUnique({ where: { name: ROLES.ADMIN } });
  if (!adminRole) {
    throw new Error("ADMIN role not found.");
  }

  const hashedPassword = await hashPassword(env.adminPassword);

  await prisma.user.upsert({
    where: { email: env.adminEmail },
    update: {
      password: hashedPassword,
      name: env.adminName,
      roleId: adminRole.id,
    },
    create: {
      email: env.adminEmail,
      password: hashedPassword,
      name: env.adminName,
      roleId: adminRole.id,
    },
  });

  const existingAccidents = await prisma.railwayAccident.count();
  if (existingAccidents < 10) {
    await prisma.railwayAccident.createMany({
      data: [
        {
          accidentAt: new Date("2026-05-01T08:10:00Z"),
          location: "서울역 3번 승강장",
          lineName: "경부선",
          accidentType: "COLLISION",
          cause: "신호 오인",
          damageScale: "차량 일부 파손",
          deaths: 0,
          injuries: 3,
          trainCount: 2,
          weather: "맑음",
        },
        {
          accidentAt: new Date("2026-04-14T12:35:00Z"),
          location: "대전조차장 인근",
          lineName: "호남선",
          accidentType: "DERAILMENT",
          cause: "레일 유지보수 미흡",
          damageScale: "객차 1량 탈선",
          deaths: 0,
          injuries: 6,
          trainCount: 1,
          weather: "흐림",
        },
        {
          accidentAt: new Date("2026-03-29T21:05:00Z"),
          location: "부산역 진입 구간",
          lineName: "경부고속선",
          accidentType: "FIRE",
          cause: "전기 배선 합선",
          damageScale: "기관차 내부 화재",
          deaths: 1,
          injuries: 4,
          trainCount: 1,
          weather: "비",
        },
        {
          accidentAt: new Date("2026-03-10T06:20:00Z"),
          location: "용산역 분기기",
          lineName: "경원선",
          accidentType: "SIGNAL_FAILURE",
          cause: "신호설비 장애",
          damageScale: "운행 지연 55분",
          deaths: 0,
          injuries: 0,
          trainCount: 3,
          weather: "맑음",
        },
        {
          accidentAt: new Date("2026-02-18T17:42:00Z"),
          location: "광명역 부근",
          lineName: "경부고속선",
          accidentType: "HUMAN_ERROR",
          cause: "관제 지시 전달 착오",
          damageScale: "열차 접촉 직전 긴급정지",
          deaths: 0,
          injuries: 1,
          trainCount: 2,
          weather: "맑음",
        },
        {
          accidentAt: new Date("2026-02-03T11:15:00Z"),
          location: "청량리역 인근",
          lineName: "중앙선",
          accidentType: "TRACK_DEFECT",
          cause: "침목 균열",
          damageScale: "차량 하부 손상",
          deaths: 0,
          injuries: 2,
          trainCount: 1,
          weather: "눈",
        },
        {
          accidentAt: new Date("2026-01-22T04:55:00Z"),
          location: "익산역 화물 야드",
          lineName: "전라선",
          accidentType: "COLLISION",
          cause: "입환 작업 중 충돌",
          damageScale: "화차 2량 파손",
          deaths: 0,
          injuries: 2,
          trainCount: 2,
          weather: "안개",
        },
        {
          accidentAt: new Date("2025-12-30T13:08:00Z"),
          location: "동대구역 북단",
          lineName: "대구선",
          accidentType: "OTHER",
          cause: "외부 물체 비산",
          damageScale: "전면 유리 파손",
          deaths: 0,
          injuries: 1,
          trainCount: 1,
          weather: "강풍",
        },
        {
          accidentAt: new Date("2025-11-17T19:30:00Z"),
          location: "수원역 인근",
          lineName: "수인분당선",
          accidentType: "FIRE",
          cause: "브레이크 과열",
          damageScale: "객실 연기 발생",
          deaths: 0,
          injuries: 5,
          trainCount: 1,
          weather: "맑음",
        },
        {
          accidentAt: new Date("2025-10-05T09:50:00Z"),
          location: "김천구미역 접근 구간",
          lineName: "경부고속선",
          accidentType: "DERAILMENT",
          cause: "차륜 결함",
          damageScale: "동력차 탈선",
          deaths: 2,
          injuries: 9,
          trainCount: 1,
          weather: "비",
        },
        {
          accidentAt: new Date("2025-09-11T15:12:00Z"),
          location: "춘천역 인근",
          lineName: "경춘선",
          accidentType: "SIGNAL_FAILURE",
          cause: "제어 소프트웨어 오류",
          damageScale: "운행 중단 35분",
          deaths: 0,
          injuries: 0,
          trainCount: 2,
          weather: "흐림",
        },
        {
          accidentAt: new Date("2025-08-23T07:40:00Z"),
          location: "오송역 분기 구간",
          lineName: "충북선",
          accidentType: "HUMAN_ERROR",
          cause: "점검 절차 미준수",
          damageScale: "경미한 장비 손상",
          deaths: 0,
          injuries: 1,
          trainCount: 1,
          weather: "맑음",
        },
      ],
    });
  }

  await syncDefaultMenus();

  const guestRole = await prisma.role.findUnique({ where: { name: ROLES.GUEST } });
  const guestARole = await prisma.role.findUnique({ where: { name: ROLES.GUEST_A } });
  const guestBRole = await prisma.role.findUnique({ where: { name: ROLES.GUEST_B } });

  const allMenus = await prisma.menu.findMany();
  const guestAllowedMenuIds = allMenus
    .filter((menu) => {
      const path = menu.path ?? "";
      return (
        path.startsWith("/dashboard") ||
        path.startsWith("/accidents") ||
        path.startsWith("/investment-disclosure") ||
        path.startsWith("/flood-alert") ||
        path.startsWith("/notices") ||
        path.startsWith("/archive")
      );
    })
    .map((menu) => menu.id);

  const scopedGuestRoles = [guestRole, guestARole, guestBRole].filter((role): role is { id: number } => Boolean(role));

  for (const role of scopedGuestRoles) {
    await prisma.roleMenuPermission.deleteMany({ where: { roleId: role.id } });
    if (guestAllowedMenuIds.length > 0) {
      await prisma.roleMenuPermission.createMany({
        data: guestAllowedMenuIds.map((menuId) => ({ roleId: role.id, menuId })),
        skipDuplicates: true,
      });
    }
    await syncRoleMenuActionPermissions(role.id, { read: true, create: false, update: false, delete: false });
  }

  if (guestRole) {
    await prisma.roleQueryPermission.upsert({
      where: { roleId: guestRole.id },
      update: {},
      create: {
        roleId: guestRole.id,
        enforcementMode: "OVERWRITE",
        allowedLineNames: ["경부선", "중앙선", "경춘선"],
        allowedTypes: ["사고", "준사고", "운행장애"],
      },
    });
  }

  if (guestARole) {
    await prisma.roleQueryPermission.upsert({
      where: { roleId: guestARole.id },
      update: {},
      create: {
        roleId: guestARole.id,
        enforcementMode: "BLOCK",
        allowedLineNames: ["경부고속선"],
        allowedTypes: ["사고", "운행장애"],
        enforcedLineName: "경부고속선",
      },
    });
  }

  if (guestBRole) {
    await prisma.roleQueryPermission.upsert({
      where: { roleId: guestBRole.id },
      update: {},
      create: {
        roleId: guestBRole.id,
        enforcementMode: "OVERWRITE",
        minAccidentAt: new Date("2025-01-01T00:00:00Z"),
        maxAccidentAt: new Date("2026-12-31T23:59:59Z"),
        allowedTypes: ["준사고", "운행장애(관리)"],
      },
    });
  }

  const gyeonggiRole = await prisma.role.upsert({
    where: { name: GYEONGGI_ROLE_NAME },
    update: {},
    create: { name: GYEONGGI_ROLE_NAME },
  });

  await prisma.roleQueryPermission.upsert({
    where: { roleId: gyeonggiRole.id },
    update: {
      allowedLocationScope: GYEONGGI_DEFAULT_LOCATION_SCOPE,
      allowedLineNames: [...GYEONGGI_DEFAULT_ALLOWED_LINE_NAMES],
    },
    create: {
      roleId: gyeonggiRole.id,
      enforcementMode: "OVERWRITE",
      allowedLocationScope: GYEONGGI_DEFAULT_LOCATION_SCOPE,
      allowedLineNames: [...GYEONGGI_DEFAULT_ALLOWED_LINE_NAMES],
    },
  });

  await prisma.roleMenuPermission.deleteMany({ where: { roleId: gyeonggiRole.id } });
  if (guestAllowedMenuIds.length > 0) {
    await prisma.roleMenuPermission.createMany({
      data: guestAllowedMenuIds.map((menuId) => ({ roleId: gyeonggiRole.id, menuId })),
      skipDuplicates: true,
    });
  }
  await syncRoleMenuActionPermissions(gyeonggiRole.id, { read: true, create: false, update: false, delete: false });

  const globalBrandingData = {
    pageTitle: "철도안전 대시보드 | 철도안전정보종합관리시스템",
    systemName: "철도안전정보종합관리시스템",
    heroTitle: "철도안전 공개 대시보드",
    heroSubtitle: "국민에게 공개되는 철도사고 통계·현황 정보입니다.",
    showLogo: true,
    logoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Emblem_of_South_Korea.svg/120px-Emblem_of_South_Korea.svg.png",
    showCiMark: true,
    ciMarkLabel: "국토교통부",
    showHero: false,
    showFooter: true,
  };

  const existingGlobalBranding = await prisma.roleBranding.findFirst({ where: { roleId: null } });
  if (!existingGlobalBranding) {
    await prisma.roleBranding.create({ data: { roleId: null, ...globalBrandingData } });
  }

  const roleBrandingDefaults: Record<string, Omit<Parameters<typeof prisma.roleBranding.create>[0]["data"], "roleId">> = {
    [ROLES.ADMIN]: {
      pageTitle: "관리자 포털 | 철도안전정보종합관리시스템",
      systemName: "철도안전정보종합관리시스템 [관리자]",
      heroTitle: "철도안전 통합관리 포털",
      heroSubtitle: "관리자 전용 업무 화면입니다. 메뉴·권한·CI 설정을 관리할 수 있습니다.",
      showLogo: true,
      logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Emblem_of_South_Korea.svg/120px-Emblem_of_South_Korea.svg.png",
      showCiMark: true,
      ciMarkLabel: "철도안전관리원",
      showHero: true,
      showFooter: true,
    },
    [ROLES.GUEST]: {
      pageTitle: "게스트 포털 | 철도안전정보",
      systemName: "철도안전정보 [게스트]",
      heroTitle: "철도안전정보 조회",
      heroSubtitle: "게스트 권한으로 허용된 메뉴·데이터만 조회할 수 있습니다.",
      showLogo: false,
      showCiMark: true,
      ciMarkLabel: "GUEST",
      showHero: true,
      showFooter: true,
    },
    [ROLES.GUEST_A]: {
      pageTitle: "게스트A 포털 | 경부고속선",
      systemName: "철도안전정보 [게스트A]",
      heroTitle: "경부고속선 안전정보",
      heroSubtitle: "경부고속선 관련 사고·통계 정보를 제공합니다.",
      showLogo: false,
      showCiMark: true,
      ciMarkLabel: "경부고속선",
      showHero: true,
      showFooter: false,
    },
    [ROLES.GUEST_B]: {
      pageTitle: "게스트B 포털 | 사고분석",
      systemName: "철도안전정보 [게스트B]",
      heroTitle: "사고 원인·통계 분석",
      heroSubtitle: "인적·설비 사고 유형 중심의 분석 화면입니다.",
      showLogo: false,
      showCiMark: false,
      showHero: true,
      showFooter: true,
    },
  };

  for (const [roleName, branding] of Object.entries(roleBrandingDefaults)) {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) continue;

    await prisma.roleBranding.upsert({
      where: { roleId: role.id },
      update: {},
      create: { roleId: role.id, ...branding },
    });
  }

  const codeRepository = new CodeRepository();
  const accidentRepository = new AccidentRepository();
  const syncResult = await codeRepository.syncInstitutionsFromRegistrationAgencies(
    await accidentRepository.findDistinctRegistrationAgencies(),
  );
  const lineSyncResult = await codeRepository.syncLinesFromAccidentData(
    await accidentRepository.findDistinctRegistrationAgencyLines(),
  );
  // 사고DB 동기화 후 경기도 기준 트리(기관·노선·역명)로 덮어씀
  await codeRepository.upsertCodeTree(GYEONGGI_QUERY_TREE);
  console.log(
    `Registration agencies synced to institution codes: ${syncResult.total} total (${syncResult.created} created, ${syncResult.updated} updated).`,
  );
  console.log(
    `Railway lines synced to line codes: ${lineSyncResult.total} total (${lineSyncResult.created} created, ${lineSyncResult.updated} updated, ${lineSyncResult.skipped} skipped).`,
  );

  const noticeCount = await prisma.notice.count();
  if (noticeCount === 0) {
    const adminUser = await prisma.user.findUnique({ where: { email: env.adminEmail } });
    const authorName = adminUser?.name ?? env.adminName;

    await prisma.notice.createMany({
      data: [
        {
          title: "2026 철도안전 정책 변경 안내",
          content:
            "2026년부터 적용되는 철도안전 정책 변경 사항을 안내드립니다.\n\n주요 변경 내용은 사고 등록 항목 보완, 통계 조회 권한 세분화, 안전교육 이수 의무화 등입니다.\n\n자세한 내용은 담당 부서로 문의해 주시기 바랍니다.",
          authorName,
          createdById: adminUser?.id ?? null,
          createdAt: new Date("2026-01-16T09:00:00+09:00"),
        },
        {
          title: "2026년도 안전교육 계획 공지",
          content:
            "2026년도 철도안전 교육 일정 및 이수 대상, 교육 방법(온·오프라인)을 공지합니다.\n\n교육 미이수 시 시스템 일부 기능 이용이 제한될 수 있으니 기한 내 이수해 주시기 바랍니다.",
          authorName,
          createdById: adminUser?.id ?? null,
          createdAt: new Date("2026-01-03T09:00:00+09:00"),
        },
        {
          title: "신규 사용자 권한 신청 방법 안내",
          content:
            "신규 사용자는 관리자에게 권한 신청서를 제출한 후 계정 발급을 받을 수 있습니다.\n\n신청 시 소속 기관, 조회 필요 노선·역, 사고 종류 범위를 명시해 주세요.",
          authorName,
          createdById: adminUser?.id ?? null,
          createdAt: new Date("2025-12-21T09:00:00+09:00"),
        },
        {
          title: "안전점검 결과 등록 시스템 점검 일정",
          content:
            "시스템 안정화를 위한 점검이 2025년 11월 20일(목) 02:00~06:00 예정입니다.\n\n점검 시간 동안 일시적으로 서비스 이용이 제한될 수 있습니다.",
          authorName,
          createdById: adminUser?.id ?? null,
          createdAt: new Date("2025-11-19T09:00:00+09:00"),
        },
        {
          title: "사고통계 분석 기능 개선 사항 배포",
          content:
            "대시보드 통계 차트 및 사고 목록 조회 기능이 개선되었습니다.\n\n조회 권한에 따른 기관별 통계, 월별 발생 현황 등을 확인할 수 있습니다.",
          authorName,
          createdById: adminUser?.id ?? null,
          createdAt: new Date("2025-10-17T09:00:00+09:00"),
        },
      ],
    });
  }

  const investmentRepo = new InvestmentDisclosureRepository();
  const seededInvestment = await investmentRepo.seedDefaultsIfEmpty([...DEFAULT_INVESTMENT_DISCLOSURE_ROWS]);
  if (seededInvestment) {
    // eslint-disable-next-line no-console
    console.log(`Investment disclosure: seeded ${DEFAULT_INVESTMENT_DISCLOSURE_ROWS.length} default records.`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    // eslint-disable-next-line no-console
    console.log("Seed completed.");
  })
  .catch(async (error) => {
    await prisma.$disconnect();
    // eslint-disable-next-line no-console
    console.error("Seed failed:", error);
    process.exit(1);
  });
