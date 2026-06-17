async function apiFetch(path, options = {}) {
  const { auth = false, method = "GET", body, headers = {} } = options;

  const requestHeaders = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (auth) {
    const token = localStorage.getItem("accessToken");
    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(path, {
    method,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (auth && response.status === 401) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user");
      window.location.href = "/login";
      throw new Error("로그인이 만료되었습니다. 다시 로그인해 주세요.");
    }
    let message = payload.message ?? `Request failed (${response.status})`;
    if (response.status === 413 && !payload.message) {
      message =
        "업로드 용량이 서버 제한을 초과했습니다. 파일을 나눠서 업로드하거나 서버 관리자에게 nginx 업로드 용량 설정을 요청하세요.";
    }
    throw new Error(message);
  }

  return payload;
}
