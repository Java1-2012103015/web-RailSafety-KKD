const PORTAL_SECTIONS = [
  {
    key: "board",
    matchPath(path) {
      const current = normalizePortalPath(path);
      return current.startsWith("/notices") || current.startsWith("/archive");
    },
    getActivePath(path = window.location.pathname) {
      const current = normalizePortalPath(path);
      if (current.startsWith("/archive")) return "/archive";
      return "/notices";
    },
    findMenu(menus) {
      return (
        menus.find(
          (menu) =>
            menu.title === "게시판" ||
            (!menu.path &&
              menu.children?.some((child) => {
                const p = normalizePortalPath(child.path);
                return p.startsWith("/notices") || p.startsWith("/archive");
              })),
        ) ?? null
      );
    },
    defaultTitle: "게시판",
    defaultItems: [
      { title: "공지사항", path: "/notices" },
      { title: "자료실", path: "/archive" },
    ],
  },
  {
    key: "dashboard",
    matchPath(path) {
      const current = normalizePortalPath(path);
      return (
        current === "/portal" ||
        current === "/dashboard" ||
        current.startsWith("/dashboard/")
      );
    },
    getActivePath(path = window.location.pathname) {
      const current = normalizePortalPath(path);
      if (current === "/portal" || current === "/dashboard") {
        return "/dashboard/accidents";
      }
      if (current.startsWith("/dashboard/investment-disclosure")) {
        return "/dashboard/investment-disclosure";
      }
      if (current.startsWith("/dashboard/pre-flood-alert")) {
        return "/dashboard/pre-flood-alert";
      }
      if (current.startsWith("/dashboard/self-report")) {
        return "/dashboard/self-report";
      }
      return "/dashboard/accidents";
    },
    findMenu(menus) {
      return (
        menus.find(
          (menu) =>
            menu.title === "대시보드" ||
            menu.children?.some((child) => normalizePortalPath(child.path).startsWith("/dashboard/")),
        ) ?? null
      );
    },
    defaultTitle: "대시보드",
    defaultItems: [
      { title: "철도사고·장애", path: "/dashboard/accidents" },
      { title: "철도안전투자공시", path: "/dashboard/investment-disclosure" },
      { title: "철도시설사전침수경보", path: "/dashboard/pre-flood-alert" },
    ],
  },
  {
    key: "railwayDb",
    matchPath(path) {
      const current = normalizePortalPath(path);
      if (current.startsWith("/dashboard/")) return false;
      return (
        current.startsWith("/accidents") ||
        current.startsWith("/investment-disclosure") ||
        current.startsWith("/flood-alert")
      );
    },
    getActivePath(path = window.location.pathname) {
      const current = normalizePortalPath(path);
      if (current.startsWith("/flood-alert")) return "/flood-alert";
      if (current.startsWith("/investment-disclosure")) return "/investment-disclosure";
      return "/accidents";
    },
    findMenu(menus) {
      return (
        menus.find(
          (menu) =>
            menu.title === "철도 데이터시트" || menu.title === "철도 데이터베이스",
        ) ?? null
      );
    },
    defaultTitle: "철도 데이터시트",
    defaultItems: [
      { title: "철도사고장애정보 조회", path: "/accidents" },
      { title: "철도안전 투자공시 조회", path: "/investment-disclosure" },
      { title: "철도시설침수경보 조회", path: "/flood-alert" },
    ],
  },
];

function normalizePortalPath(path) {
  return String(path ?? "").replace(/\/$/, "") || "/";
}

function getSidebarElement() {
  return document.getElementById("portal-section-sidebar") || document.getElementById("board-sidebar");
}

function getCurrentPortalSection(path = window.location.pathname) {
  return PORTAL_SECTIONS.find((section) => section.matchPath(path)) ?? null;
}

function isPortalSectionPath(path = window.location.pathname) {
  return Boolean(getCurrentPortalSection(path));
}

function isBoardSectionPath(path = window.location.pathname) {
  return getCurrentPortalSection(path)?.key === "board";
}

function isSubnavItemActive(childPath, activePath) {
  const target = normalizePortalPath(childPath);
  if (!target || target === "#") return false;
  if (activePath === target) return true;
  return activePath.startsWith(`${target}/`);
}

function subnavLinkClass(active) {
  return active
    ? "portal-subnav-link portal-subnav-link-active"
    : "portal-subnav-link";
}

function mergeSectionDefaultItems(children, defaults) {
  const merged = [...(children ?? [])];
  const childPaths = new Set(merged.map((child) => normalizePortalPath(child.path)));

  for (const item of defaults ?? []) {
    const path = normalizePortalPath(item.path);
    if (!path || childPaths.has(path)) continue;
    merged.push({ ...item, children: [] });
  }

  const order = new Map((defaults ?? []).map((item, index) => [normalizePortalPath(item.path), index]));
  merged.sort((a, b) => {
    const aOrder = order.get(normalizePortalPath(a.path));
    const bOrder = order.get(normalizePortalPath(b.path));
    const aIndex = aOrder === undefined ? Number.MAX_SAFE_INTEGER : aOrder;
    const bIndex = bOrder === undefined ? Number.MAX_SAFE_INTEGER : bOrder;
    return aIndex - bIndex || String(a.title).localeCompare(String(b.title), "ko");
  });

  return merged;
}

function enrichMenusWithSectionDefaults(menus) {
  return (menus ?? []).map((menu) => {
    const section = PORTAL_SECTIONS.find((item) => {
      const sectionMenu = item.findMenu([menu]);
      return sectionMenu?.id === menu.id || sectionMenu?.title === menu.title;
    });

    if (!section?.defaultItems?.length) {
      return menu;
    }

    return {
      ...menu,
      children: mergeSectionDefaultItems(menu.children, section.defaultItems),
    };
  });
}

function getSectionSidebarItems(section, menus) {
  const sectionMenu = section.findMenu(menus ?? []);
  const children = (sectionMenu?.children ?? []).filter((child) => child.path);
  const defaults = section.defaultItems ?? [];

  if (!children.length) {
    return { sectionTitle: section.defaultTitle, items: defaults };
  }

  return {
    sectionTitle: sectionMenu?.title ?? section.defaultTitle,
    items: mergeSectionDefaultItems(children, defaults),
  };
}

function ensurePortalSubnavStyles() {
  if (document.getElementById("portal-subnav-styles")) return;

  const style = document.createElement("style");
  style.id = "portal-subnav-styles";
  style.textContent = `
    .portal-subnav-link {
      display: block;
      border-radius: 0.375rem;
      padding: 0.625rem 0.75rem;
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
      transition: background-color 0.15s, color 0.15s;
    }
    .portal-subnav-link:hover {
      background-color: #f9fafb;
      color: #1f2747;
    }
    .portal-subnav-link-active {
      background-color: #2e3a67;
      color: #ffffff !important;
      font-weight: 600;
      border-left: 4px solid #f59e0b;
      padding-left: calc(0.75rem - 4px);
    }
  `;
  document.head.appendChild(style);
}

function renderPortalSectionSidebar(menus) {
  const aside = getSidebarElement();
  const section = getCurrentPortalSection();
  if (!aside || !section) return;

  const { sectionTitle, items } = getSectionSidebarItems(section, menus);
  if (!items.length) {
    aside.classList.add("hidden");
    return;
  }

  ensurePortalSubnavStyles();

  const activePath = section.getActivePath(window.location.pathname);
  aside.classList.remove("hidden");
  aside.innerHTML = `
    <nav aria-label="${sectionTitle} 하위 메뉴" class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p class="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-gray-400">${sectionTitle}</p>
      <ul class="space-y-1">
        ${items
          .map(
            (item) => `
              <li>
                <a href="${item.path}" class="${subnavLinkClass(isSubnavItemActive(item.path, activePath))}">${item.title}</a>
              </li>
            `,
          )
          .join("")}
      </ul>
    </nav>
  `;
}

async function initBoardLayout(menus) {
  if (!isPortalSectionPath()) return;

  let menuData = menus;
  if (!menuData) {
    try {
      const result = await apiFetch("/api/menus", { auth: true });
      menuData = result.data ?? [];
    } catch {
      menuData = [];
    }
  }

  renderPortalSectionSidebar(menuData);
}
