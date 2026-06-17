const PUBLIC_DASHBOARD_ITEMS = [
  { title: "사고·장애정보 대시보드", path: "/public/dashboard/accidents" },
  { title: "투자공시 대시보드", path: "/public/dashboard/investment-disclosure" },
  { title: "사전침수경보 대시보드", path: "/public/dashboard/pre-flood-alert" },
];

function normalizePublicPath(path) {
  return String(path ?? "").replace(/\/$/, "") || "/";
}

function getPublicDashboardActivePath(path = window.location.pathname) {
  const current = normalizePublicPath(path);
  if (
    current === "/" ||
    current === "/public/dashboard" ||
    current.startsWith("/public/dashboard/accidents")
  ) {
    return "/public/dashboard/accidents";
  }
  if (current.startsWith("/public/dashboard/investment-disclosure")) {
    return "/public/dashboard/investment-disclosure";
  }
  if (current.startsWith("/public/dashboard/pre-flood-alert")) {
    return "/public/dashboard/pre-flood-alert";
  }
  return current;
}

function isPublicDashboardPath(path = window.location.pathname) {
  const current = normalizePublicPath(path);
  return (
    current === "/" ||
    current === "/public/dashboard" ||
    current.startsWith("/public/dashboard/")
  );
}

function publicSubnavLinkClass(active) {
  return active
    ? "portal-subnav-link portal-subnav-link-active"
    : "portal-subnav-link";
}

function isPublicSubnavItemActive(itemPath, activePath) {
  const target = normalizePublicPath(itemPath);
  return activePath === target;
}

function ensurePublicSubnavStyles() {
  if (document.getElementById("portal-subnav-styles")) return;
  if (typeof ensurePortalSubnavStyles === "function") {
    ensurePortalSubnavStyles();
    return;
  }

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

function renderPublicDashboardSidebar() {
  const aside = document.getElementById("public-section-sidebar");
  if (!aside) return;

  ensurePublicSubnavStyles();

  const activePath = getPublicDashboardActivePath();
  aside.classList.remove("hidden");
  aside.innerHTML = `
    <nav aria-label="대시보드 하위 메뉴" class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p class="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-gray-400">대시보드</p>
      <ul class="space-y-1">
        ${PUBLIC_DASHBOARD_ITEMS.map(
          (item) => `
            <li>
              <a href="${item.path}" class="${publicSubnavLinkClass(isPublicSubnavItemActive(item.path, activePath))}">${item.title}</a>
            </li>
          `,
        ).join("")}
      </ul>
    </nav>
  `;
}

function initPublicBoardLayout() {
  if (!isPublicDashboardPath()) return;
  renderPublicDashboardSidebar();
}
