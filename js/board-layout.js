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
      return current === "/dashboard" || current.startsWith("/dashboard/");
    },
    getActivePath(path = window.location.pathname) {
      const current = normalizePortalPath(path);
      if (current.startsWith("/dashboard/investment-disclosure")) {
        return "/dashboard/investment-disclosure";
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
    ],
  },
  {
    key: "railwayDb",
    matchPath(path) {
      const current = normalizePortalPath(path);
      if (current.startsWith("/dashboard/")) return false;
      return current.startsWith("/accidents") || current.startsWith("/investment-disclosure");
    },
    getActivePath(path = window.location.pathname) {
      const current = normalizePortalPath(path);
      if (current.startsWith("/investment-disclosure")) return "/investment-disclosure";
      return "/accidents";
    },
    findMenu(menus) {
      return menus.find((menu) => menu.title === "철도 데이터베이스") ?? null;
    },
    defaultTitle: "철도 데이터베이스",
    defaultItems: [
      { title: "철도사고장애정보 DB", path: "/accidents" },
      { title: "철도안전 투자공시 DB", path: "/investment-disclosure" },
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

function getSectionSidebarItems(section, menus) {
  const sectionMenu = section.findMenu(menus ?? []);
  const children = (sectionMenu?.children ?? []).filter((child) => child.path);

  if (children.length) {
    return { sectionTitle: sectionMenu?.title ?? section.defaultTitle, items: children };
  }

  return { sectionTitle: section.defaultTitle, items: section.defaultItems };
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
