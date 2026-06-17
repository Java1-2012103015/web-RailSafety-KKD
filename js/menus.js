function getActiveMenuPath() {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  if (path === "/portal" || path === "/dashboard") return "/dashboard/accidents";
  return path;
}

function isMenuActive(menuPath, children = []) {
  if (children.length) {
    return children.some((child) => isMenuActive(child.path, child.children ?? []));
  }
  if (!menuPath) return false;
  const current = getActiveMenuPath();
  const target = menuPath.replace(/\/$/, "") || "/";
  return current === target || current.startsWith(`${target}/`);
}

function menuLinkClass(active) {
  const base = "block transition hover:text-gray-200";
  return active ? `${base} text-white font-semibold underline underline-offset-4` : base;
}

function renderChildMenus(children) {
  if (!children.length) return "";

  return `
    <ul class="absolute right-0 top-full z-30 hidden min-w-[11rem] rounded-sm bg-navy-700 py-1 shadow-lg group-hover:block group-focus-within:block">
      ${children
        .map((child) => {
          const href = child.path || "#";
          const active = isMenuActive(child.path, child.children ?? []);
          return `
            <li>
              <a href="${href}" class="${menuLinkClass(active)} px-4 py-2 text-sm">${child.title}</a>
            </li>
          `;
        })
        .join("")}
    </ul>
  `;
}

function getMenuHref(node) {
  if (node.path) return node.path;
  if (node.children?.length) {
    const firstChild = node.children.find((child) => child.path);
    if (firstChild?.path) return firstChild.path;
  }
  return "#";
}

function renderMenuNode(node) {
  const href = getMenuHref(node);
  const hasChildren = node.children && node.children.length > 0;
  const active = hasChildren
    ? isMenuActive(node.path, node.children)
    : isMenuActive(node.path);

  if (hasChildren) {
    return `
      <li class="group relative">
        <a href="${href}" class="${menuLinkClass(active)} py-1">${node.title}</a>
        ${renderChildMenus(node.children)}
      </li>
    `;
  }

  return `
    <li>
      <a href="${href}" class="${menuLinkClass(active)} py-1">${node.title}</a>
    </li>
  `;
}

async function loadPortalMenus() {
  const navList = document.getElementById("portal-nav-list");
  if (!navList) return;

  try {
    const result = await apiFetch("/api/menus", { auth: true });
    const menus = result.data ?? [];

    if (!menus.length) {
      navList.innerHTML = `<li class="text-sm text-gray-300">표시할 메뉴가 없습니다.</li>`;
      return;
    }

    navList.innerHTML = menus.map(renderMenuNode).join("");
    if (typeof initBoardLayout === "function") {
      await initBoardLayout(menus);
    }
  } catch (error) {
    console.error(error);
    navList.innerHTML = `<li class="text-sm text-red-300">메뉴를 불러오지 못했습니다.</li>`;
  }
}

function scrollToPortalSection() {
  const path = window.location.pathname.replace(/\/$/, "");
  if (path === "/dashboard/notices") {
    const section = document.getElementById("notices-section");
    if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
