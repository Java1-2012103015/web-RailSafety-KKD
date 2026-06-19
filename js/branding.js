function getSystemNameTypographyClasses() {
  const systemNameEl = document.querySelector('[data-branding="system-name"]');
  if (!systemNameEl) {
    return ["font-bold", "tracking-tight", "text-sm", "sm:text-base", "md:text-lg"];
  }

  return [...systemNameEl.classList].filter(
    (cls) =>
      cls === "font-bold" ||
      cls === "tracking-tight" ||
      cls.startsWith("text-") ||
      /^(sm|md|lg|xl):text-/.test(cls),
  );
}

function applyCiMarkElement(config) {
  const ciMarkEl = document.getElementById("branding-ci-mark");
  if (!ciMarkEl) return;

  const show = Boolean(config.showCiMark && config.ciMarkLabel);
  ciMarkEl.textContent = show ? config.ciMarkLabel : "";

  const typography = getSystemNameTypographyClasses();
  ciMarkEl.className = ["shrink-0", ...typography, show ? "" : "hidden"].filter(Boolean).join(" ");
}

function applyBranding(config) {
  if (!config) return;

  if (config.pageTitle) {
    document.title = config.pageTitle;
  }

  document.querySelectorAll('[data-branding="system-name"]').forEach((el) => {
    el.textContent = config.systemName;
  });

  document.querySelectorAll('[data-branding="hero-title"]').forEach((el) => {
    if (config.heroTitle) el.textContent = config.heroTitle;
  });

  document.querySelectorAll('[data-branding="hero-subtitle"]').forEach((el) => {
    if (config.heroSubtitle) el.textContent = config.heroSubtitle;
  });

  const logoWrap = document.querySelector('[data-branding-wrap="logo"]');
  const logoImg = document.getElementById("branding-logo");
  if (logoWrap && logoImg) {
    if (config.showLogo && config.logoUrl) {
      logoWrap.classList.remove("hidden");
      logoImg.src = config.logoUrl;
      logoImg.alt = `${config.systemName} CI`;
    } else {
      logoWrap.classList.add("hidden");
      logoImg.removeAttribute("src");
    }
  }

  applyCiMarkElement(config);

  document.querySelectorAll('[data-branding-wrap="hero"]').forEach((el) => {
    el.classList.toggle("hidden", !config.showHero);
  });

  document.querySelectorAll('[data-branding-wrap="footer"]').forEach((el) => {
    el.classList.toggle("hidden", !config.showFooter);
  });
}

async function loadPublicBranding() {
  const result = await apiFetch("/api/public/branding");
  applyBranding(result.data);
  return result.data;
}

async function loadPortalBranding() {
  const result = await apiFetch("/api/branding/me", { auth: true });
  applyBranding(result.data);
  return result.data;
}
