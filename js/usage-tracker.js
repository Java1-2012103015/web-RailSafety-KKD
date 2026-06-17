(function initUsageTracker() {
  const SKIP_PATH_PREFIXES = ["/login", "/register", "/public/"];

  function shouldTrack() {
    if (typeof getToken !== "function" || !getToken()) return false;
    const path = window.location.pathname.replace(/\/$/, "") || "/";
    return !SKIP_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix));
  }

  function createSessionKey() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  function getPagePath() {
    return `${window.location.pathname}${window.location.search}`;
  }

  function postUsage(path, body, keepalive) {
    const token = typeof getToken === "function" ? getToken() : null;
    if (!token) return;

    fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      keepalive: Boolean(keepalive),
    }).catch(() => {});
  }

  function recordView(sessionKey) {
    postUsage("/api/usage/view", {
      sessionKey,
      path: getPagePath(),
      pageTitle: document.title || null,
    }, false);
  }

  function recordLeave(sessionKey, startedAt) {
    const dwellSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    postUsage("/api/usage/leave", { sessionKey, dwellSeconds }, true);
  }

  function startTracking() {
    if (!shouldTrack()) return;

    const sessionKey = createSessionKey();
    const startedAt = Date.now();
    let leaveSent = false;

    const flushLeave = () => {
      if (leaveSent) return;
      leaveSent = true;
      recordLeave(sessionKey, startedAt);
    };

    recordView(sessionKey);

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        flushLeave();
      }
    });

    window.addEventListener("pagehide", flushLeave);
    window.addEventListener("beforeunload", flushLeave);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startTracking);
  } else {
    startTracking();
  }
})();
