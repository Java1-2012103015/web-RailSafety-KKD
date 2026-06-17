const TOKEN_KEY = "accessToken";
const USER_KEY = "user";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveSession(accessToken, user) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

async function refreshSession() {
  if (!getToken()) return null;

  try {
    const result = await apiFetch("/api/auth/me", { auth: true });
    const user = result.data;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  } catch {
    return getUser();
  }
}

function hasMenuAction(menuPath, action) {
  const user = getUser();
  if (user?.role === "ADMIN") return true;
  return Boolean(user?.menuActions?.[menuPath]?.[action]);
}

function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.location.href = "/";
}

function requireAuth(redirectTo = "/login") {
  if (!getToken()) {
    window.location.href = redirectTo;
    return false;
  }
  return true;
}

async function login(email, password) {
  const result = await apiFetch("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });

  const { accessToken, user } = result.data;
  saveSession(accessToken, user);
  return user;
}

function bindPortalHeader() {
  const user = getUser();
  if (!user) return;

  const nameEl = document.getElementById("portal-user-name");
  if (nameEl) {
    nameEl.textContent = `${user.name}님`;
  }

  const adminEl = document.getElementById("portal-admin-link");
  if (adminEl && user.role === "ADMIN") {
    adminEl.classList.remove("hidden");
  }

  const logoutBtn = document.getElementById("portal-logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }
}
