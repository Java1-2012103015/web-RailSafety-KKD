function formatAssigneeLabel(assignee) {
  if (!assignee?.name) return "-";
  const email = assignee.email?.trim();
  if (email) return `${escapeHtml(assignee.name)} (${escapeHtml(email)})`;
  return escapeHtml(assignee.name);
}

function formatAssigneesSummary(item) {
  const tier1 = formatAssigneeLabel(item.tier1Assignee);
  const tier2 = formatAssigneeLabel(item.tier2Assignee);
  if (tier1 === "-" && tier2 === "-") return "-";
  if (tier1 !== "-" && tier2 !== "-") {
    return `<span class="block">1차 ${tier1}</span><span class="block text-gray-600">2차 ${tier2}</span>`;
  }
  if (tier1 !== "-") return `1차 ${tier1}`;
  return `2차 ${tier2}`;
}

const SR_SESSION_KEY = "selfReportSession";
const STATUS_LABELS = {
  RECEIVED: "접수",
  ADMIN_ASSIGNED: "관리자 배정",
  TIER1_PROCESSING: "1차 처리중",
  TIER2_ASSIGNMENT: "2차담당 배정",
  TIER2_PROCESSING: "2차 처리중",
  TRANSFERRED: "이첩",
  COMPLETED: "처리완료",
  CLOSED: "종결",
  UNPROCESSABLE: "처리불가",
  UNPROCESSABLE_PENDING: "처리불가 확인대기",
  RETURNED_TO_ADMIN: "관리자 반려",
};

const INTAKE_DECISION_LABELS = {
  PROCESS: "처리 결정",
  UNPROCESSABLE: "처리불가 결정",
  RETURN_TO_ADMIN: "담당기관 이첩",
  ALREADY_COMPLETED: "기완료",
};

const FINAL_INTAKE_DECISIONS = ["UNPROCESSABLE", "RETURN_TO_ADMIN", "ALREADY_COMPLETED"];

const PROCESSING_PATH_LABELS = {
  TIER2_ASSIGN: "2차 담당 배정",
  DIRECT_INPUT: "직접 입력",
};

const srState = {
  session: null,
  cases: [],
  institutions: [],
  staff: [],
  tier2Staff: [],
  currentCase: null,
  smsTemplates: null,
  smsDashboardUrl: null,
  showPriorCompletionForm: false,
  pendingTier2Staff: null,
  tier2EmailCheck: null,
  tier2AssignSmsEdited: false,
  tier2AssignSmsVisible: false,
  smsMessageEdited: false,
  tier2ActionPanel: null,
  scrollToTier2Panel: false,
  pendingTransferStaff: null,
  transferEmailCheck: null,
  transferSmsEdited: false,
  transferReason: "",
  historyExpanded: false,
  adminAssignMode: "new",
  adminTier1EmailCheck: null,
  pendingTier1Staff: null,
  selectedCaseIds: new Set(),
  listPage: 1,
  listPageSize: 15,
  listTotal: 0,
  listTotalPages: 1,
};

const SR_SMS_TEMPLATE_DEFAULTS = {
  ADMIN_TO_INSTITUTION:
    "[자율보고] {receiptNumber} 보고 배정 안내\n" +
    "이메일 ; {email}\n" +
    "패스키 ; {authKey}\n" +
    "접속 사이트 | {dashboardUrl}\n" +
    "로 접속하여 확인하시기 바랍니다.\n" +
    "(배정자 ; {assignerName} (배정자 이메일 ; {assignerEmail}))",
  TIER1_TO_TIER2:
    "[자율보고] {receiptNumber} 보고 배정 안내\n" +
    "이메일 ; {email}\n" +
    "패스키 ; {authKey}\n" +
    "접속 사이트 | {dashboardUrl}\n" +
    "로 접속하여 확인하시기 바랍니다.\n" +
    "(배정자 ; {assignerName} (배정자 이메일 ; {assignerEmail}))",
  TIER2_TRANSFER:
    "[자율보고] {receiptNumber} 보고 이첩 안내\n" +
    "이첩사유 ; {transferReason}\n" +
    "이메일 ; {email}\n" +
    "패스키 ; {authKey}\n" +
    "접속 사이트 | {dashboardUrl}\n" +
    "로 접속하여 확인하시기 바랍니다.\n" +
    "(배정자 ; {assignerName} (배정자 이메일 ; {assignerEmail}))",
};

const SR_TIER1_ACCOUNT_SMS_TEMPLATE =
  "[자율보고] 1차 담당 계정 안내\n" +
  "이메일 ; {email}\n" +
  "패스키 ; {authKey}\n" +
  "접속 사이트 | {dashboardUrl}\n" +
  "로 접속하여 확인하시기 바랍니다.\n" +
  "(배정자 ; {assignerName} (배정자 이메일 ; {assignerEmail}))";

const SR_TIER2_ACCOUNT_SMS_TEMPLATE =
  "[자율보고] 2차 담당 계정 안내\n" +
  "이메일 ; {email}\n" +
  "패스키 ; {authKey}\n" +
  "접속 사이트 | {dashboardUrl}\n" +
  "로 접속하여 확인하시기 바랍니다.\n" +
  "(배정자 ; {assignerName} (배정자 이메일 ; {assignerEmail}))";

const SR_TIER2_AUTH_KEY_STORAGE = "sr_tier2_auth_keys";
const SR_STAFF_AUTH_KEY_BY_EMAIL = "sr_staff_auth_keys_by_email";
const SR_PORTAL_BRIDGE_ROLES = ["ADMIN"];

function saveAuthKeyByEmail(email, authKey) {
  if (!email || !authKey) return;
  try {
    const map = JSON.parse(sessionStorage.getItem(SR_STAFF_AUTH_KEY_BY_EMAIL) || "{}");
    map[email.trim().toLowerCase()] = authKey;
    sessionStorage.setItem(SR_STAFF_AUTH_KEY_BY_EMAIL, JSON.stringify(map));
  } catch (_) {}
}

function loadAuthKeyByEmail(email) {
  if (!email) return null;
  try {
    const map = JSON.parse(sessionStorage.getItem(SR_STAFF_AUTH_KEY_BY_EMAIL) || "{}");
    return map[email.trim().toLowerCase()] ?? null;
  } catch {
    return null;
  }
}

function getPortalBridgeSession() {
  const token = typeof getToken === "function" ? getToken() : null;
  const user = typeof getUser === "function" ? getUser() : null;
  if (!token || !user?.role) return null;
  if (!SR_PORTAL_BRIDGE_ROLES.includes(user.role)) return null;

  if (user.role === "ADMIN") {
    return {
      accessToken: token,
      role: "ADMIN",
      email: user.email,
      name: user.name,
      label: `${user.name ?? user.email} (관리자)`,
      fromPortal: true,
    };
  }

  return null;
}

function getSelfReportDashboardUrl() {
  if (srState.smsDashboardUrl) return srState.smsDashboardUrl;
  return `${window.location.origin}/dashboard/self-report`;
}

function loadStoredTier2AuthKey(caseId, staffId) {
  try {
    const map = JSON.parse(sessionStorage.getItem(SR_TIER2_AUTH_KEY_STORAGE) || "{}");
    return map[`${caseId}:${staffId}`] ?? null;
  } catch {
    return null;
  }
}

function saveStoredTier2AuthKey(caseId, staffId, email, authKey) {
  if (!caseId || !staffId || !authKey) return;
  try {
    const map = JSON.parse(sessionStorage.getItem(SR_TIER2_AUTH_KEY_STORAGE) || "{}");
    map[`${caseId}:${staffId}`] = { email: email ?? "", authKey };
    sessionStorage.setItem(SR_TIER2_AUTH_KEY_STORAGE, JSON.stringify(map));
  } catch (_) {}
}

function saveStoredStaffAuthKey(caseId, staffId, email, authKey) {
  saveStoredTier2AuthKey(caseId, staffId, email, authKey);
}

function resolveAdminTier1Credentials(item) {
  const pending = srState.pendingTier1Staff;
  const assigned = item?.assigneeStaff?.tier === 1 ? item.assigneeStaff : null;
  const formEmail = document.getElementById("sr-admin-tier1-email")?.value.trim() ?? "";
  const formAuthKey = document.getElementById("sr-admin-tier1-auth-key")?.value.trim() ?? "";
  const authDisabled = document.getElementById("sr-admin-tier1-auth-key")?.disabled;
  const smsEmail = document.getElementById("sr-sms-email")?.value.trim() ?? "";
  const smsAuthKey = document.getElementById("sr-sms-auth-key")?.value.trim() ?? "";

  let email = smsEmail || pending?.email || assigned?.email || formEmail || "";
  let authKey = smsAuthKey || pending?.authKey || "";
  if (!authKey && formAuthKey && !authDisabled) authKey = formAuthKey;
  if (!authKey && email) authKey = loadAuthKeyByEmail(email) ?? "";

  if (assigned && item?.id) {
    const stored = loadStoredTier2AuthKey(item.id, assigned.id);
    if (stored) {
      if (!email) email = stored.email ?? "";
      if (!authKey) authKey = stored.authKey ?? "";
    }
  }

  return { email, authKey };
}

function resolveSmsCredentialFields(item, session) {
  if (session?.role === "ADMIN") return resolveAdminTier1Credentials(item);
  if (session?.role === "SELF_REPORT_TIER1") return resolveTier2AssigneeCredentials(item);
  return resolveTransferStaffCredentials(item);
}

function ensureCredentialLinesInSmsTemplate(template) {
  if (!template) return template;
  if (template.includes("{email}") && template.includes("{authKey}")) return template;
  return (
    `${template.trimEnd()}\n` +
    "이메일 ; {email}\n" +
    "패스키 ; {authKey}\n" +
    "접속 사이트 | {dashboardUrl}\n" +
    "로 접속하여 확인하시기 바랍니다."
  );
}

function syncSmsCredentialFields(item, session, force = false) {
  const emailEl = document.getElementById("sr-sms-email");
  const authEl = document.getElementById("sr-sms-auth-key");
  if (!emailEl || !authEl || !session) return;
  const creds = resolveSmsCredentialFields(item, session);
  if (force || !emailEl.value.trim()) emailEl.value = creds.email;
  if (force || !authEl.value.trim()) authEl.value = creds.authKey;
}

function buildTier1CredentialSmsMessage(pending) {
  if (!pending) return "";
  const session = getSrSession();
  return applySmsPreviewVars(SR_TIER1_ACCOUNT_SMS_TEMPLATE, {
    email: pending.email || "",
    authKey: pending.authKey || "",
    dashboardUrl: getSelfReportDashboardUrl(),
    assignerName: "관리자",
    assignerEmail: session?.label?.replace(/\s*\(관리자\)\s*$/, "") ?? session?.email ?? "",
  });
}

function renderAdminAssignHtml(item) {
  const assignedTier1 = item.assigneeStaff?.tier === 1 ? item.assigneeStaff : null;
  if (assignedTier1) {
    return `
      <div class="rounded border border-green-100 bg-green-50 p-3 text-sm">
        <p class="font-semibold text-gray-900">배정된 1차 담당자</p>
        <p class="mt-1">이름: ${escapeHtml(assignedTier1.name)}</p>
        <p>이메일: ${escapeHtml(assignedTier1.email ?? "-")}</p>
      </div>`;
  }

  const tier1Staff = (srState.staff ?? []).filter((s) => s.tier === 1);
  const mode = srState.adminAssignMode ?? (tier1Staff.length ? "existing" : "new");
  const selectedInstitutionId = document.getElementById("sr-assign-institution")?.value ?? "";

  return `
    <div id="sr-admin-assign-panel" class="space-y-3">
      <p class="text-xs font-bold text-gray-800">1차 담당 배정 (관리자 → 1차)</p>
      <label class="block text-xs font-semibold text-gray-700" for="sr-assign-institution">기관</label>
      <select id="sr-assign-institution" class="w-full rounded border border-gray-300 px-3 py-2 text-sm">
        <option value="">기관 선택</option>
        ${srState.institutions.map((i) => `<option value="${i.id}" ${String(i.id) === String(selectedInstitutionId) ? "selected" : ""}>${escapeHtml(i.name)}</option>`).join("")}
      </select>
      <div class="space-y-2 text-sm">
        <label class="flex cursor-pointer items-center gap-2">
          <input type="radio" name="sr-admin-assign-mode" value="existing" class="sr-admin-assign-mode-radio" ${mode === "existing" ? "checked" : ""} ${tier1Staff.length ? "" : "disabled"} />
          <span>기존 1차 담당자 선택</span>
        </label>
        <label class="flex cursor-pointer items-center gap-2">
          <input type="radio" name="sr-admin-assign-mode" value="new" class="sr-admin-assign-mode-radio" ${mode === "new" ? "checked" : ""} />
          <span>신규 1차 담당자 등록</span>
        </label>
      </div>
      <div id="sr-admin-assign-existing" class="${mode === "existing" ? "space-y-2" : "hidden space-y-2"}">
        <label class="block text-xs font-semibold text-gray-700" for="sr-assign-tier1-existing">1차 담당자</label>
        <select id="sr-assign-tier1-existing" class="w-full rounded border border-gray-300 px-3 py-2 text-sm">
          <option value="">담당자 선택</option>
          ${tier1Staff.map((s) => `<option value="${s.id}">${escapeHtml(s.name)} (${escapeHtml(s.email ?? "-")})</option>`).join("")}
        </select>
      </div>
      <div id="sr-admin-assign-new" class="${mode === "new" ? "space-y-2 rounded border border-gray-200 bg-gray-50 p-3" : "hidden space-y-2 rounded border border-gray-200 bg-gray-50 p-3"}">
        <label class="block text-xs font-semibold text-gray-700" for="sr-admin-tier1-name">이름</label>
        <input id="sr-admin-tier1-name" type="text" placeholder="1차 담당자 이름" class="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
        <label class="block text-xs font-semibold text-gray-700" for="sr-admin-tier1-email">이메일</label>
        <div class="flex gap-2">
          <input id="sr-admin-tier1-email" type="email" placeholder="로그인 이메일" class="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 text-sm" autocomplete="off" />
          <button type="button" id="sr-admin-tier1-email-check-btn" class="shrink-0 rounded border border-navy-700 bg-white px-3 py-2 text-xs font-semibold text-navy-900 hover:bg-navy-50">중복확인</button>
        </div>
        <p id="sr-admin-tier1-email-check-msg" class="hidden text-xs"></p>
        <label class="block text-xs font-semibold text-gray-700" for="sr-admin-tier1-phone">휴대폰 (접속안내 문자)</label>
        <input id="sr-admin-tier1-phone" type="tel" inputmode="numeric" placeholder="01012345678" class="w-full rounded border border-gray-300 px-3 py-2 text-sm" autocomplete="off" />
        <label class="block text-xs font-semibold text-gray-700" for="sr-admin-tier1-auth-key">패스키</label>
        <input id="sr-admin-tier1-auth-key" type="text" placeholder="이메일 중복확인 후 입력" class="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-sm" autocomplete="off" disabled />
      </div>
      <input id="sr-assign-note-admin" placeholder="배정 메모" class="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
      <button type="button" id="sr-assign-admin-btn" class="rounded bg-navy-900 px-4 py-2 text-sm font-semibold text-white">1차 담당 배정</button>
    </div>`;
}

function resetAdminTier1EmailCheckDom() {
  const authKeyEl = document.getElementById("sr-admin-tier1-auth-key");
  const msgEl = document.getElementById("sr-admin-tier1-email-check-msg");
  if (authKeyEl) {
    authKeyEl.value = "";
    authKeyEl.disabled = true;
    authKeyEl.classList.add("bg-gray-100");
    authKeyEl.placeholder = "이메일 중복확인 후 입력";
  }
  if (msgEl) {
    msgEl.textContent = "";
    msgEl.className = "hidden text-xs";
  }
}

function clearAdminTier1EmailCheck() {
  srState.adminTier1EmailCheck = null;
  resetAdminTier1EmailCheckDom();
}

function applyAdminTier1EmailCheckUI(check) {
  const authKeyEl = document.getElementById("sr-admin-tier1-auth-key");
  const msgEl = document.getElementById("sr-admin-tier1-email-check-msg");
  if (!authKeyEl || !msgEl) return;

  msgEl.classList.remove("hidden");
  if (check.status === "available") {
    authKeyEl.disabled = false;
    authKeyEl.classList.remove("bg-gray-100");
    authKeyEl.placeholder = "로그인 패스키";
    msgEl.textContent = check.message;
    msgEl.className = "text-xs text-green-700";
  } else if (check.status === "existing") {
    authKeyEl.disabled = true;
    authKeyEl.value = check.authKey ?? "";
    authKeyEl.classList.add("bg-gray-100");
    authKeyEl.placeholder = check.authKey ? "기존 계정 패스키 (자동 조회)" : "기존 계정 — 저장된 패스키 없음";
    msgEl.textContent = check.message;
    msgEl.className = "text-xs text-amber-700";
  }
}

function bindAdminAssignActions() {
  const institutionSelect = document.getElementById("sr-assign-institution");
  if (!institutionSelect) return;

  institutionSelect.addEventListener("change", async () => {
    const institutionId = Number(institutionSelect.value);
    clearAdminTier1EmailCheck();
    if (institutionId) {
      await loadStaffForInstitution(institutionId);
      const tier1Count = (srState.staff ?? []).filter((s) => s.tier === 1).length;
      srState.adminAssignMode = tier1Count ? srState.adminAssignMode : "new";
    } else {
      srState.staff = [];
    }
    const panel = document.getElementById("sr-admin-assign-panel");
    if (panel && srState.currentCase) {
      panel.outerHTML = renderAdminAssignHtml(srState.currentCase);
      bindAdminAssignActions();
    }
  });

  document.querySelectorAll(".sr-admin-assign-mode-radio").forEach((radio) => {
    radio.addEventListener("change", () => {
      srState.adminAssignMode = radio.value;
      const existing = document.getElementById("sr-admin-assign-existing");
      const fresh = document.getElementById("sr-admin-assign-new");
      if (radio.value === "existing") {
        existing?.classList.remove("hidden");
        fresh?.classList.add("hidden");
      } else {
        existing?.classList.add("hidden");
        fresh?.classList.remove("hidden");
      }
    });
  });

  document.getElementById("sr-admin-tier1-email")?.addEventListener("input", clearAdminTier1EmailCheck);

  document.getElementById("sr-admin-tier1-email-check-btn")?.addEventListener("click", async () => {
    const institutionId = Number(institutionSelect.value);
    const email = document.getElementById("sr-admin-tier1-email")?.value.trim() ?? "";
    if (!institutionId) return alert("기관을 먼저 선택해 주세요.");
    if (!email) return alert("이메일을 입력해 주세요.");
    try {
      const result = await srApiFetch("/api/self-report/tier1-staff/check-email", {
        method: "POST",
        body: { institutionId, email },
      });
      const data = result.data;
      srState.adminTier1EmailCheck = {
        email,
        institutionId,
        status: data.status,
        message: data.message ?? result.message,
        authKey: data.authKey ?? null,
      };
      applyAdminTier1EmailCheckUI(srState.adminTier1EmailCheck);
      if (data.authKey) saveAuthKeyByEmail(email, data.authKey);
      if (data.status === "existing" && data.name) {
        const nameEl = document.getElementById("sr-admin-tier1-name");
        if (nameEl && !nameEl.value.trim()) nameEl.value = data.name;
      }
    } catch (error) {
      clearAdminTier1EmailCheck();
      alert(error.message ?? "이메일 중복확인에 실패했습니다.");
    }
  });

  if (srState.adminTier1EmailCheck) {
    const emailInput = document.getElementById("sr-admin-tier1-email");
    if (emailInput?.value.trim() === srState.adminTier1EmailCheck.email) {
      applyAdminTier1EmailCheckUI(srState.adminTier1EmailCheck);
    }
  }

  document.getElementById("sr-assign-admin-btn")?.addEventListener("click", async () => {
    const institutionId = Number(institutionSelect.value);
    const note = document.getElementById("sr-assign-note-admin")?.value.trim() ?? "";
    const mode =
      document.querySelector('input[name="sr-admin-assign-mode"]:checked')?.value ?? srState.adminAssignMode;

    if (!institutionId) return alert("기관을 선택해 주세요.");

    const body = { institutionId, note };

    if (mode === "existing") {
      const toStaffId = Number(document.getElementById("sr-assign-tier1-existing")?.value);
      if (!toStaffId) return alert("1차 담당자를 선택해 주세요.");
      body.toStaffId = toStaffId;
    } else {
      const staffName = document.getElementById("sr-admin-tier1-name")?.value.trim() ?? "";
      const staffEmail = document.getElementById("sr-admin-tier1-email")?.value.trim() ?? "";
      const staffPhone = document.getElementById("sr-admin-tier1-phone")?.value.trim() ?? "";
      const staffAuthKey = document.getElementById("sr-admin-tier1-auth-key")?.value.trim() ?? "";
      const check = srState.adminTier1EmailCheck;

      if (!staffName || !staffEmail) return alert("이름과 이메일을 입력해 주세요.");
      if (!check || check.email !== staffEmail || check.institutionId !== institutionId) {
        return alert("이메일 중복확인을 먼저 해 주세요.");
      }
      if (check.status === "available" && !staffAuthKey) {
        return alert("패스키를 입력해 주세요.");
      }

      body.staffName = staffName;
      body.staffEmail = staffEmail;
      body.staffPhone = staffPhone;
      if (check.status === "available") body.staffAuthKey = staffAuthKey;
    }

    try {
      const result = await srApiFetch(`/api/self-report/cases/${srState.currentCase.id}/assign-admin`, {
        method: "POST",
        body,
      });
      const data = result.data;
      const assigned = data.assignedStaff;
      const staffEmail =
        mode === "new"
          ? document.getElementById("sr-admin-tier1-email")?.value.trim() ?? assigned?.email ?? ""
          : assigned?.email ?? "";
      const check = srState.adminTier1EmailCheck;
      let authKey = "";
      if (mode === "new") {
        if (check?.status === "existing" && check.email === staffEmail) {
          authKey =
            assigned?.authKey ?? check.authKey ?? loadAuthKeyByEmail(staffEmail) ?? "";
        } else {
          authKey = document.getElementById("sr-admin-tier1-auth-key")?.value.trim() ?? "";
        }
      } else {
        authKey = assigned?.authKey ?? loadAuthKeyByEmail(staffEmail) ?? "";
      }

      if (assigned?.staffId) {
        if (authKey && staffEmail) saveAuthKeyByEmail(staffEmail, authKey);
        srState.pendingTier1Staff = {
          caseId: srState.currentCase.id,
          staffId: assigned.staffId,
          name: assigned.name,
          email: assigned.email ?? "",
          authKey: authKey || null,
          isExisting: Boolean(assigned.isExisting),
        };
        if (authKey) {
          saveStoredStaffAuthKey(srState.currentCase.id, assigned.staffId, assigned.email, authKey);
        }
      }

      srState.adminTier1EmailCheck = null;
      const phone =
        mode === "new"
          ? document.getElementById("sr-admin-tier1-phone")?.value.trim() ?? assigned?.phone ?? ""
          : assigned?.phone ?? "";

      if (authKey && phone) {
        if (window.confirm("1차 담당자에게 배정했습니다. 접속안내 문자를 발송하시겠습니까?")) {
          try {
            const smsResult = await srApiFetch(
              `/api/admin/self-report/institutions/${institutionId}/staff/send-account-sms`,
              {
                method: "POST",
                body: { phone, email: assigned.email, authKey, tier: 1 },
              },
            );
            alert(smsResult.message ?? "접속안내 문자를 발송했습니다.");
          } catch (smsError) {
            alert(smsError.message ?? "접속안내 문자 발송에 실패했습니다.");
          }
        } else {
          alert(result.message ?? "1차 담당자에게 배정했습니다. 아래 '문자 발송'으로 배정 안내를 보낼 수 있습니다.");
        }
      } else if (assigned?.isExisting && !authKey) {
        alert(
          result.message ??
            "1차 담당자에게 배정했습니다. 저장된 패스키가 없어 접속안내 문자에 패스키를 넣을 수 없습니다. 비밀번호를 재설정한 뒤 다시 발송해 주세요.",
        );
      } else {
        alert(result.message ?? "1차 담당자에게 배정했습니다. 아래 '문자 발송'으로 배정 안내를 보낼 수 있습니다.");
      }

      await loadCases();
      await openCaseDetail(srState.currentCase.id);
    } catch (error) {
      alert(error.message ?? "배정에 실패했습니다.");
    }
  });
}

function resolveTier2AssigneeCredentials(item) {
  const pending = srState.pendingTier2Staff;
  const assigned = item?.assigneeStaff?.tier === 2 ? item.assigneeStaff : null;
  const formEmail = document.getElementById("sr-tier2-email")?.value.trim() ?? "";
  const formAuthKey = document.getElementById("sr-tier2-auth-key")?.value.trim() ?? "";
  const authDisabled = document.getElementById("sr-tier2-auth-key")?.disabled;

  const smsEmail = document.getElementById("sr-tier2-assign-sms-email")?.value.trim() ?? "";
  const smsAuthKey = document.getElementById("sr-tier2-assign-sms-auth-key")?.value.trim() ?? "";
  const generalSmsEmail = document.getElementById("sr-sms-email")?.value.trim() ?? "";
  const generalSmsAuthKey = document.getElementById("sr-sms-auth-key")?.value.trim() ?? "";

  let email = smsEmail || generalSmsEmail || pending?.email || assigned?.email || formEmail || "";
  let authKey = smsAuthKey || generalSmsAuthKey || pending?.authKey || "";
  if (!authKey && formAuthKey && !authDisabled) authKey = formAuthKey;

  if (assigned && item?.id) {
    const stored = loadStoredTier2AuthKey(item.id, assigned.id);
    if (stored) {
      if (!email) email = stored.email ?? "";
      if (!authKey) authKey = stored.authKey ?? "";
    }
  }

  return { email, authKey };
}

function syncTier2AssignSmsCredentialFields(item, force = false) {
  const emailEl = document.getElementById("sr-tier2-assign-sms-email");
  const authEl = document.getElementById("sr-tier2-assign-sms-auth-key");
  if (!emailEl || !authEl) return;

  const pending = srState.pendingTier2Staff;
  const assigned = item?.assigneeStaff?.tier === 2 ? item.assigneeStaff : null;
  const formEmail = document.getElementById("sr-tier2-email")?.value.trim() ?? "";
  const formAuthKey = document.getElementById("sr-tier2-auth-key")?.value.trim() ?? "";
  const authDisabled = document.getElementById("sr-tier2-auth-key")?.disabled;

  let email = pending?.email ?? assigned?.email ?? formEmail ?? "";
  let authKey = pending?.authKey ?? "";
  if (!authKey && formAuthKey && !authDisabled) authKey = formAuthKey;

  if (assigned && item?.id) {
    const stored = loadStoredTier2AuthKey(item.id, assigned.id);
    if (stored) {
      if (!email) email = stored.email ?? "";
      if (!authKey) authKey = stored.authKey ?? "";
    }
  }

  if (force || !emailEl.value.trim()) emailEl.value = email;
  if (force || !authEl.value.trim()) authEl.value = authKey;
  if (pending?.isExisting || (assigned && !authKey && !formAuthKey)) {
    authEl.readOnly = true;
    authEl.placeholder = "기존 계정 — 당시 발급 인증키";
  } else {
    authEl.readOnly = false;
    authEl.placeholder = "배정 대상 인증키";
  }
}

function getSrSession() {
  if (srState.session) return srState.session;

  const portalSession = getPortalBridgeSession();
  if (portalSession) return portalSession;

  try {
    const raw = localStorage.getItem(SR_SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}

async function refreshPortalUserSafely() {
  const token = typeof getToken === "function" ? getToken() : null;
  if (!token) return null;

  try {
    const response = await fetch("/api/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) return typeof getUser === "function" ? getUser() : null;
    const payload = await response.json();
    if (payload?.data) {
      localStorage.setItem("user", JSON.stringify(payload.data));
      return payload.data;
    }
  } catch (_) {
    /* 네트워크 오류 시 localStorage 사용자 정보 유지 */
  }
  return typeof getUser === "function" ? getUser() : null;
}

function saveSrSession(session) {
  srState.session = session;
  if (session.fromPortal || session.role === "ADMIN") return;
  localStorage.setItem(SR_SESSION_KEY, JSON.stringify(session));
}

function clearSrSession() {
  srState.session = null;
  localStorage.removeItem(SR_SESSION_KEY);
}

function clearSelfReportSessionOnly() {
  srState.session = null;
  localStorage.removeItem(SR_SESSION_KEY);
}

async function srApiFetch(path, options = {}) {
  const session = getSrSession();
  if (!session?.accessToken) throw new Error("로그인이 필요합니다.");

  const headers = { ...(options.headers ?? {}) };
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  headers.Authorization = `Bearer ${session.accessToken}`;

  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? (typeof options.body === "string" ? options.body : JSON.stringify(options.body)) : undefined,
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    throw new Error(payload?.message ?? `요청 실패 (${response.status})`);
  }
  return payload;
}

function showLogin() {
  document.getElementById("sr-login-section").classList.remove("hidden");
  document.getElementById("sr-dashboard-section").classList.add("hidden");
  document.getElementById("sr-header-actions").classList.add("hidden");
}

function showDashboard() {
  document.getElementById("sr-login-section").classList.add("hidden");
  document.getElementById("sr-dashboard-section").classList.remove("hidden");
  document.getElementById("sr-header-actions").classList.remove("hidden");

  const session = getSrSession();
  document.getElementById("sr-session-label").textContent = session?.label ?? "";
  document.getElementById("sr-admin-link").classList.toggle("hidden", session?.role !== "ADMIN");
  document.getElementById("sr-admin-create-wrap").classList.toggle("hidden", session?.role !== "ADMIN");
  document.getElementById("sr-bulk-delete-btn")?.classList.toggle("hidden", session?.role !== "ADMIN");
  document.getElementById("sr-th-select")?.classList.toggle("hidden", session?.role !== "ADMIN");
  if (session?.role !== "ADMIN") {
    srState.selectedCaseIds.clear();
  }

  const desc = {
    ADMIN: "전체 보고를 조회하고 기관에 배정할 수 있습니다.",
    SELF_REPORT_TIER1: "소속 기관 보고를 2차 실무담당에게 배정할 수 있습니다.",
    SELF_REPORT_TIER2: "본인에게 배정된 보고를 처리·이첩할 수 있습니다.",
  };
  document.getElementById("sr-role-desc").textContent = desc[session?.role] ?? "";
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ko-KR");
}

function formatDateOnly(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("ko-KR");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toDateInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isImageAttachment(mimeType) {
  return typeof mimeType === "string" && mimeType.startsWith("image/");
}

function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function readFilesForUpload(fileList) {
  const files = Array.from(fileList ?? []);
  if (!files.length) return Promise.resolve([]);

  return Promise.all(
    files.map(
      (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve({
              fileName: file.name,
              mimeType: file.type || "application/octet-stream",
              data: String(reader.result ?? ""),
            });
          reader.onerror = () => reject(new Error(`파일을 읽지 못했습니다: ${file.name}`));
          reader.readAsDataURL(file);
        }),
    ),
  );
}

async function uploadCaseAttachments(caseId, fileList) {
  const files = await readFilesForUpload(fileList);
  if (!files.length) return;
  await srApiFetch(`/api/self-report/cases/${caseId}/attachments`, {
    method: "POST",
    body: { files },
  });
}

function filterAttachmentsByKind(attachments, kind) {
  return (attachments ?? []).filter((attachment) => {
    if (kind === "CASE") return !attachment.kind || attachment.kind === "CASE";
    return attachment.kind === kind;
  });
}

function renderAttachmentItemsHtml(attachments, session) {
  if (!attachments?.length) return "";

  return attachments
    .map((attachment) => {
      const sizeLabel = formatFileSize(attachment.fileSize);
      const imageClass = isImageAttachment(attachment.mimeType) ? "sr-attachment-image-link" : "";
      const imageAttr = isImageAttachment(attachment.mimeType)
        ? ` data-sr-image-url="${attachment.url}"`
        : "";
      const deleteBtn =
        session?.role === "ADMIN"
          ? `<button type="button" class="sr-delete-attachment ml-2 text-xs text-red-600 hover:underline" data-attachment-id="${attachment.id}">삭제</button>`
          : "";
      return `<li class="flex flex-wrap items-center gap-1">
        <a href="${attachment.url}" target="_blank" rel="noopener" class="text-navy-700 ${imageClass}"${imageAttr}>${escapeHtml(attachment.fileName)}</a>
        <span class="text-[11px] text-gray-400">${sizeLabel}</span>${deleteBtn}
      </li>`;
    })
    .join("");
}

function renderAttachmentsHtml(attachments, session) {
  const caseAttachments = filterAttachmentsByKind(attachments, "CASE");
  if (!caseAttachments.length) {
    return `<div><h4 class="font-semibold text-gray-900">첨부파일</h4><p class="mt-1 text-xs text-gray-500">등록된 첨부파일이 없습니다.</p></div>`;
  }

  return `
    <div>
      <h4 class="font-semibold text-gray-900">첨부파일</h4>
      <ul class="mt-2 space-y-1 text-sm">${renderAttachmentItemsHtml(caseAttachments, session)}</ul>
    </div>`;
}

const SR_HISTORY_PREVIEW_COUNT = 2;

function renderHistoryItemHtml(h) {
  return `[${formatDate(h.createdAt)}] ${h.action}${h.note ? ` — ${h.note}` : ""} (${h.actorName ?? ""})`;
}

function renderCaseHistoryHtml(histories, expanded) {
  const list = histories ?? [];
  const visible = expanded ? list : list.slice(0, SR_HISTORY_PREVIEW_COUNT);
  const itemsHtml =
    list.length === 0
      ? "<li>이력 없음</li>"
      : visible.map((h) => `<li>${renderHistoryItemHtml(h)}</li>`).join("");

  let toggleHtml = "";
  if (list.length > SR_HISTORY_PREVIEW_COUNT) {
    toggleHtml = expanded
      ? `<button type="button" id="sr-history-collapse-btn" class="mt-2 text-xs font-semibold text-navy-800 hover:underline">접기</button>`
      : `<button type="button" id="sr-history-expand-btn" class="mt-2 text-xs font-semibold text-navy-800 hover:underline">상세보기 (${list.length}건)</button>`;
  }

  return `
    <div id="sr-case-history">
      <h4 class="font-semibold text-gray-900">처리 이력</h4>
      <ul class="mt-2 space-y-1 text-xs text-gray-600">${itemsHtml}</ul>
      ${toggleHtml}
    </div>`;
}

function refreshCaseHistorySection() {
  const el = document.getElementById("sr-case-history");
  if (!el || !srState.currentCase) return;
  el.outerHTML = renderCaseHistoryHtml(srState.currentCase.histories, srState.historyExpanded);
  bindCaseHistoryToggle();
}

function bindCaseHistoryToggle() {
  document.getElementById("sr-history-expand-btn")?.addEventListener("click", () => {
    srState.historyExpanded = true;
    refreshCaseHistorySection();
  });
  document.getElementById("sr-history-collapse-btn")?.addEventListener("click", () => {
    srState.historyExpanded = false;
    refreshCaseHistorySection();
  });
}

function renderProcessingResultDisplayHtml(item, session) {
  const resultAttachments = filterAttachmentsByKind(item.attachments, "RESULT");
  const hasResult =
    item.processingResultDate || item.processingResultContent || resultAttachments.length > 0;
  if (!hasResult) return "";

  const attachmentList = resultAttachments.length
    ? `<ul class="mt-2 space-y-1 text-sm">${renderAttachmentItemsHtml(resultAttachments, session)}</ul>`
    : `<p class="mt-1 text-xs text-gray-500">등록된 첨부파일이 없습니다.</p>`;

  return `
    <div class="mt-2 rounded border border-green-100 bg-green-50 p-3 text-sm">
      <h4 class="font-semibold text-gray-900">처리결과</h4>
      <p class="mt-1"><strong>처리완료일:</strong> ${formatDateOnly(item.processingResultDate)}</p>
      ${
        item.processingResultContent
          ? `<p class="mt-1"><strong>처리 내용:</strong></p><p class="mt-1 whitespace-pre-wrap text-gray-700">${escapeHtml(item.processingResultContent)}</p>`
          : ""
      }
      <div class="mt-2">
        <p class="text-xs font-semibold text-gray-700">첨부파일</p>
        ${attachmentList}
      </div>
    </div>`;
}

function renderPriorCompletionDisplayHtml(item, session) {
  const priorAttachments = filterAttachmentsByKind(item.attachments, "PRIOR_COMPLETION");
  const hasPrior =
    item.priorCompletionDate || item.priorCompletionContent || priorAttachments.length > 0;
  if (!hasPrior) return "";

  const attachmentList = priorAttachments.length
    ? `<ul class="mt-2 space-y-1 text-sm">${renderAttachmentItemsHtml(priorAttachments, session)}</ul>`
    : `<p class="mt-1 text-xs text-gray-500">등록된 첨부파일이 없습니다.</p>`;

  return `
    <div class="mt-2 rounded border border-purple-100 bg-purple-50 p-3 text-sm">
      <h4 class="font-semibold text-gray-900">기완료</h4>
      <p class="mt-1"><strong>기완료 일자:</strong> ${formatDateOnly(item.priorCompletionDate)}</p>
      ${
        item.priorCompletionContent
          ? `<p class="mt-1"><strong>기완료 내용:</strong></p><p class="mt-1 whitespace-pre-wrap text-gray-700">${escapeHtml(item.priorCompletionContent)}</p>`
          : ""
      }
      <div class="mt-2">
        <p class="text-xs font-semibold text-gray-700">첨부파일</p>
        ${attachmentList}
      </div>
    </div>`;
}

function renderIntakeDisplayHtml(item) {
  if (!item.intakeDecision) return "";
  const label = item.intakeDecisionLabel ?? INTAKE_DECISION_LABELS[item.intakeDecision] ?? item.intakeDecision;
  return `
    <div class="mt-2 rounded border border-amber-100 bg-amber-50 p-3 text-sm">
      <h4 class="font-semibold text-gray-900">접수</h4>
      <p class="mt-1"><strong>접수 결정:</strong> ${escapeHtml(label)}</p>
    </div>`;
}

function renderIntakeRadiosHtml(selectedValue) {
  const decisions = [
    { value: "PROCESS", label: "처리 결정" },
    { value: "UNPROCESSABLE", label: "처리불가 결정" },
    { value: "RETURN_TO_ADMIN", label: "담당기관 이첩" },
    { value: "ALREADY_COMPLETED", label: "기완료" },
  ];
  const buttonLabel = selectedValue === "ALREADY_COMPLETED" ? "확정" : "확인";
  return `
    <div id="sr-intake-section" class="space-y-3 rounded border border-amber-100 bg-amber-50 p-3">
      <p class="text-xs font-bold text-gray-800">접수</p>
      <div class="space-y-2 text-sm">
        ${decisions
          .map(
            (decision) => `
          <label class="flex cursor-pointer items-center gap-2">
            <input type="radio" name="sr-intake-decision" value="${decision.value}" class="sr-intake-radio"${selectedValue === decision.value ? " checked" : ""} />
            <span>${decision.label}</span>
          </label>`,
          )
          .join("")}
      </div>
      <button type="button" id="sr-intake-action-btn" class="rounded bg-navy-900 px-4 py-2 text-sm font-semibold text-white">${buttonLabel}</button>
    </div>`;
}

function renderPriorCompletionFormHtml(item) {
  return `
    <div id="sr-prior-completion-section" class="mt-4 space-y-2 rounded border border-purple-200 bg-purple-50 p-3">
      <p class="text-xs font-bold text-gray-800">기완료 입력</p>
      <label class="block text-xs font-semibold text-gray-700" for="sr-prior-date">기완료 일자</label>
      <input id="sr-prior-date" type="date" value="${toDateInputValue(item.priorCompletionDate)}" class="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
      <label class="block text-xs font-semibold text-gray-700" for="sr-prior-content">기완료 내용</label>
      <textarea id="sr-prior-content" rows="3" placeholder="기완료 내용을 입력하세요" class="w-full rounded border border-gray-300 px-3 py-2 text-sm">${escapeHtml(item.priorCompletionContent ?? "")}</textarea>
      <label class="block text-xs font-semibold text-gray-700" for="sr-prior-files">첨부파일</label>
      <input id="sr-prior-files" type="file" multiple class="block w-full text-sm text-gray-700 file:mr-3 file:rounded file:border-0 file:bg-navy-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-navy-800" />
      <p class="text-[11px] text-gray-500">사진 등 첨부 가능 · 파일당 10MB</p>
      <button type="button" id="sr-submit-prior-btn" class="rounded bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800">제출</button>
    </div>`;
}

function renderTier2AssignmentSmsHtml(staffName = "") {
  return `
    <div id="sr-tier2-assign-sms-section" class="mt-4 space-y-2 rounded border border-blue-100 bg-blue-50 p-3">
      <p class="text-xs font-bold text-gray-800">배정알림 문자 보내기</p>
      <label class="block text-xs font-semibold text-gray-700" for="sr-tier2-assign-sms-phone">수신 연락처</label>
      <input id="sr-tier2-assign-sms-phone" type="tel" inputmode="numeric" placeholder="01012345678" class="w-full rounded border border-gray-300 px-3 py-2 text-sm" autocomplete="off" />
      <label class="block text-xs font-semibold text-gray-700" for="sr-tier2-assign-sms-recipient-name">수신자명 (선택, 미저장)</label>
      <input id="sr-tier2-assign-sms-recipient-name" type="text" value="${escapeHtml(staffName)}" placeholder="문자 본문에 표시할 이름" class="w-full rounded border border-gray-300 px-3 py-2 text-sm" autocomplete="off" />
      <label class="block text-xs font-semibold text-gray-700" for="sr-tier2-assign-sms-email">이메일 (ID)</label>
      <input id="sr-tier2-assign-sms-email" type="email" placeholder="배정 대상 이메일" class="w-full rounded border border-gray-300 px-3 py-2 text-sm" autocomplete="off" />
      <label class="block text-xs font-semibold text-gray-700" for="sr-tier2-assign-sms-auth-key">패스키</label>
      <input id="sr-tier2-assign-sms-auth-key" type="text" placeholder="배정 대상 인증키" class="w-full rounded border border-gray-300 px-3 py-2 text-sm" autocomplete="off" />
      <label class="block text-xs font-semibold text-gray-700" for="sr-tier2-assign-sms-message">문자 내용</label>
      <textarea id="sr-tier2-assign-sms-message" rows="7" class="w-full rounded border border-gray-300 px-3 py-2 text-sm" placeholder="템플릿 내용이 자동으로 채워집니다. 필요 시 수정하세요."></textarea>
      <p class="text-[11px] text-gray-500">이메일·패스키·접속 사이트가 문자에 포함됩니다. 접속 사이트는 관리자 메뉴에서 설정할 수 있습니다.</p>
      <button type="button" id="sr-tier2-assign-sms-send-btn" class="rounded bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800">전송</button>
    </div>`;
}

function renderTier2AssignSmsBlockHtml(staffName = "") {
  if (!srState.tier2AssignSmsVisible) {
    return `<button type="button" id="sr-tier2-assign-sms-open-btn" class="mt-3 rounded bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800">배정알림 문자 보내기</button>`;
  }
  return renderTier2AssignmentSmsHtml(staffName);
}

function buildTier2CredentialSmsMessage(pending) {
  if (!pending) return "";
  const session = getSrSession();
  const creds = resolveTier2AssigneeCredentials(srState.currentCase);
  return applySmsPreviewVars(SR_TIER2_ACCOUNT_SMS_TEMPLATE, {
    email: creds.email || pending.email || "",
    authKey: creds.authKey || pending.authKey || "",
    dashboardUrl: getSelfReportDashboardUrl(),
    assignerName: session?.staffName ?? "",
    assignerEmail: session?.email ?? "",
  });
}

function renderTier2CredentialSmsPreview() {
  const previewEl = document.getElementById("sr-tier2-credential-sms-preview");
  if (!previewEl) return;
  previewEl.textContent = buildTier2CredentialSmsMessage(srState.pendingTier2Staff);
}

function renderTier2CredentialSmsHtml() {
  return `
    <div id="sr-tier2-credential-sms-section" class="mt-3 space-y-2 rounded border border-gray-200 bg-gray-50 p-3">
      <p class="text-xs font-bold text-gray-800">접속안내 문자 발송 (선택)</p>
      <label class="block text-xs font-semibold text-gray-700" for="sr-tier2-credential-phone">수신 번호</label>
      <input id="sr-tier2-credential-phone" type="tel" inputmode="numeric" placeholder="01012345678" class="w-full rounded border border-gray-300 px-3 py-2 text-sm" autocomplete="off" />
      <p class="text-[11px] text-gray-500">이메일·패스키·접속 주소가 문자로 전송됩니다. 번호는 저장되지 않습니다.</p>
      <p class="text-[11px] font-semibold text-gray-600">문자 미리보기</p>
      <p id="sr-tier2-credential-sms-preview" class="rounded border border-gray-200 bg-white p-2 text-xs text-gray-600 whitespace-pre-wrap"></p>
      <button type="button" id="sr-tier2-credential-sms-btn" class="rounded bg-navy-900 px-4 py-2 text-sm font-semibold text-white">접속안내 문자 발송</button>
    </div>`;
}

function renderIntakeProcessHeaderHtml(item) {
  const pathLine = item.processingPath
    ? `<p class="mt-1 text-gray-700">처리 방법: ${escapeHtml(item.processingPathLabel ?? PROCESSING_PATH_LABELS[item.processingPath] ?? item.processingPath)}</p>`
    : "";
  return `
    <div class="rounded border border-gray-200 bg-gray-50 p-3 text-sm">
      <p class="font-semibold text-gray-900">접수</p>
      <p class="mt-1 text-gray-700">처리 결정</p>
      ${pathLine}
    </div>`;
}

function renderProcessingPathChoiceHtml() {
  return `
    <div id="sr-processing-path-section" class="mt-4 space-y-3 rounded border border-blue-100 bg-blue-50 p-3">
      <p class="text-xs font-bold text-gray-800">처리 방법 선택</p>
      <div class="space-y-2 text-sm">
        <label class="flex cursor-pointer items-center gap-2">
          <input type="radio" name="sr-processing-path" value="TIER2_ASSIGN" class="sr-processing-path-radio" />
          <span>2차 담당 배정</span>
        </label>
        <label class="flex cursor-pointer items-center gap-2">
          <input type="radio" name="sr-processing-path" value="DIRECT_INPUT" class="sr-processing-path-radio" />
          <span>직접 입력</span>
        </label>
      </div>
      <button type="button" id="sr-processing-path-confirm-btn" class="rounded bg-navy-900 px-4 py-2 text-sm font-semibold text-white">확인</button>
    </div>`;
}

function renderTier2AssignBlockHtml(item) {
  const assignedTier2 = item.assigneeStaff?.tier === 2 ? item.assigneeStaff : null;
  const pending = srState.pendingTier2Staff;

  if (assignedTier2) {
    const credentialSms = srState.pendingTier2Staff?.authKey ? renderTier2CredentialSmsHtml() : "";
    return `
      <div class="rounded border border-green-100 bg-green-50 p-3 text-sm">
        <p class="font-semibold text-gray-900">배정된 2차 담당자</p>
        <p class="mt-1">이름: ${escapeHtml(assignedTier2.name)}</p>
        <p>이메일: ${escapeHtml(assignedTier2.email ?? "-")}</p>
      </div>
      ${renderTier2AssignSmsBlockHtml(assignedTier2.name)}
      ${credentialSms}`;
  }
  if (pending?.staffId) {
    const authKeyLine = pending.isExisting
      ? `<p class="text-amber-700">기존 계정 — 당시 설정된 인증키 사용</p>`
      : `<p>인증키: ${escapeHtml(pending.authKey ?? "")}</p>`;
    const credentialSms = pending.isExisting ? "" : renderTier2CredentialSmsHtml();
    return `
      <div class="rounded border border-green-100 bg-green-50 p-3 text-sm">
        <p class="font-semibold text-green-800">2차 담당자 생성 완료</p>
        <p class="mt-1">이름: ${escapeHtml(pending.name)}</p>
        <p>이메일: ${escapeHtml(pending.email)}</p>
        ${authKeyLine}
      </div>
      ${renderTier2AssignSmsBlockHtml(pending.name)}
      ${credentialSms}
      <input type="hidden" id="sr-tier2-staff-id" value="${pending.staffId}" />`;
  }
  return `
    <div id="sr-tier2-create-section" class="space-y-2 rounded border border-gray-200 bg-gray-50 p-3">
      <p class="text-xs font-semibold text-gray-800">2차 담당자 정보 입력</p>
      <label class="block text-xs font-semibold text-gray-700" for="sr-tier2-name">이름</label>
      <input id="sr-tier2-name" type="text" placeholder="2차 담당자 이름" class="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
      <label class="block text-xs font-semibold text-gray-700" for="sr-tier2-email">이메일</label>
      <div class="flex gap-2">
        <input id="sr-tier2-email" type="email" placeholder="로그인 이메일" class="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 text-sm" autocomplete="off" />
        <button type="button" id="sr-tier2-email-check-btn" class="shrink-0 rounded border border-navy-700 bg-white px-3 py-2 text-xs font-semibold text-navy-900 hover:bg-navy-50">중복확인</button>
      </div>
      <p id="sr-tier2-email-check-msg" class="hidden text-xs"></p>
      <label class="block text-xs font-semibold text-gray-700" for="sr-tier2-phone">휴대폰 (접속안내 문자)</label>
      <input id="sr-tier2-phone" type="tel" inputmode="numeric" placeholder="01012345678" class="w-full rounded border border-gray-300 px-3 py-2 text-sm" autocomplete="off" />
      <label class="block text-xs font-semibold text-gray-700" for="sr-tier2-auth-key">패스키</label>
      <input id="sr-tier2-auth-key" type="text" placeholder="이메일 중복확인 후 입력" class="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-sm" autocomplete="off" disabled />
      <button type="button" id="sr-tier2-confirm-btn" class="rounded bg-navy-800 px-4 py-2 text-sm font-semibold text-white">확인</button>
    </div>`;
}

function renderTier1StatusChangeHtml(hasAssignedTier2) {
  const processOption = hasAssignedTier2
    ? `
        <label class="flex cursor-pointer items-center gap-2">
          <input type="radio" name="sr-tier1-status-change" value="REASSIGN_TIER2" class="sr-tier1-status-change-radio" />
          <span>처리변경(2차 담당자 재배정)</span>
        </label>`
    : `
        <label class="flex cursor-pointer items-center gap-2">
          <input type="radio" name="sr-tier1-status-change" value="PROCESS" class="sr-tier1-status-change-radio" />
          <span>처리 결정</span>
        </label>`;
  const helpText = hasAssignedTier2
    ? "처리변경 선택 시 현재 2차 담당 배정을 해제하고 다른 담당자를 다시 지정할 수 있습니다."
    : "처리 결정 선택 시 1차 기관 최초 배정 상태로 되돌아가 접수부터 다시 진행합니다.";

  return `
    <div id="sr-tier1-status-change-panel" class="hidden mt-3 space-y-3 rounded border border-orange-100 bg-orange-50 p-3">
      <p class="text-xs font-bold text-gray-800">상태변경</p>
      <div class="space-y-2 text-sm">
        ${processOption}
        <label class="flex cursor-pointer items-center gap-2">
          <input type="radio" name="sr-tier1-status-change" value="UNPROCESSABLE" class="sr-tier1-status-change-radio" />
          <span>처리불가 결정</span>
        </label>
        <label class="flex cursor-pointer items-center gap-2">
          <input type="radio" name="sr-tier1-status-change" value="RETURN_TO_ADMIN" class="sr-tier1-status-change-radio" />
          <span>이첩 결정</span>
        </label>
      </div>
      <p class="text-[11px] text-gray-600">${helpText}</p>
      <button type="button" id="sr-tier1-status-change-confirm-btn" class="rounded bg-orange-700 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800">확인</button>
    </div>`;
}

function renderTier1Tier2AssignHtml(item) {
  const assignedTier2 = item.assigneeStaff?.tier === 2 ? item.assigneeStaff : null;
  const pending = srState.pendingTier2Staff;

  const assignBtn =
    !assignedTier2 && pending?.staffId
      ? `<button type="button" id="sr-assign-tier1-btn" class="mt-3 rounded bg-navy-900 px-4 py-2 text-sm font-semibold text-white">2차 담당자 배정하기</button>`
      : !assignedTier2
        ? `<button type="button" id="sr-assign-tier1-btn" class="mt-3 cursor-not-allowed rounded bg-gray-300 px-4 py-2 text-sm font-semibold text-gray-500" disabled>2차 담당자 배정하기</button>`
        : "";

  return `
    <div id="sr-tier1-tier2-assign" class="mt-4 space-y-3 border-t border-gray-200 pt-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <label class="block text-xs font-semibold text-gray-700">2차 실무담당 배정 (1차 → 2차)</label>
        <button type="button" id="sr-tier1-status-change-btn" class="rounded border border-orange-600 bg-white px-3 py-1.5 text-xs font-semibold text-orange-800 hover:bg-orange-50">상태변경</button>
      </div>
      ${renderTier1StatusChangeHtml(Boolean(assignedTier2))}
      ${renderTier2AssignBlockHtml(item)}
      ${assignBtn}
    </div>`;
}

function scrollToTier2ActionPanel() {
  const panelMap = {
    TRANSFER: "sr-tier2-transfer-panel",
    PLAN: "sr-tier2-plan-panel",
    RESULT: "sr-tier2-result-panel",
    UNPROCESSABLE: "sr-tier2-unprocessable-panel",
    PRIOR: "sr-tier2-prior-panel",
  };
  const panelId = panelMap[srState.tier2ActionPanel];
  if (!panelId) return;
  requestAnimationFrame(() => {
    document.getElementById(panelId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function renderTier2ActionChoiceHtml(item) {
  const panel = srState.tier2ActionPanel;
  const showResultOption = hasProcessingPlan(item);
  const resultRadio = showResultOption
    ? `
        <label class="flex cursor-pointer items-center gap-2">
          <input type="radio" name="sr-tier2-action" value="RESULT" class="sr-tier2-action-radio" ${panel === "RESULT" ? "checked" : ""} />
          <span>처리결과 입력</span>
        </label>`
    : "";
  return `
    <div id="sr-tier2-action-choice" class="space-y-3 rounded border border-gray-200 bg-gray-50 p-3">
      <p class="text-xs font-bold text-gray-800">처리 선택</p>
      <div class="space-y-2 text-sm">
        <label class="flex cursor-pointer items-center gap-2">
          <input type="radio" name="sr-tier2-action" value="TRANSFER" class="sr-tier2-action-radio" ${panel === "TRANSFER" ? "checked" : ""} />
          <span>2차담당자 이첩 <span class="text-gray-500">(기관 내 이첩)</span></span>
        </label>
        <label class="flex cursor-pointer items-center gap-2">
          <input type="radio" name="sr-tier2-action" value="PLAN" class="sr-tier2-action-radio" ${panel === "PLAN" ? "checked" : ""} />
          <span>처리계획 입력</span>
        </label>
        ${resultRadio}
        <label class="flex cursor-pointer items-center gap-2">
          <input type="radio" name="sr-tier2-action" value="UNPROCESSABLE" class="sr-tier2-action-radio" ${panel === "UNPROCESSABLE" ? "checked" : ""} />
          <span>처리불가</span>
        </label>
        <label class="flex cursor-pointer items-center gap-2">
          <input type="radio" name="sr-tier2-action" value="PRIOR" class="sr-tier2-action-radio" ${panel === "PRIOR" ? "checked" : ""} />
          <span>기처리</span>
        </label>
      </div>
      <button type="button" id="sr-tier2-action-confirm-btn" class="rounded bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800">확인</button>
    </div>`;
}

function ensureTransferReasonInSmsTemplate(template) {
  if (!template || template.includes("{transferReason}")) return template;
  const line = "이첩사유 ; {transferReason}\n";
  const nl = template.indexOf("\n");
  return nl >= 0 ? `${template.slice(0, nl + 1)}${line}${template.slice(nl + 1)}` : `${line}${template}`;
}

function renderTransferReasonFieldHtml() {
  const reason = srState.transferReason || srState.pendingTransferStaff?.transferReason || "";
  return `
    <label class="block text-xs font-semibold text-gray-700" for="sr-transfer-reason">이첩사유</label>
    <textarea id="sr-transfer-reason" rows="2" placeholder="이첩 사유를 입력하세요 (문자 내용에 자동 반영)" class="w-full rounded border border-gray-300 px-3 py-2 text-sm">${escapeHtml(reason)}</textarea>`;
}

function renderTier2TransferSmsHtml(staffName = "") {
  return `
    <div id="sr-transfer-sms-section" class="mt-4 space-y-2 rounded border border-blue-100 bg-blue-50 p-3">
      <p class="text-xs font-bold text-gray-800">이첩알림 문자 보내기</p>
      <label class="block text-xs font-semibold text-gray-700" for="sr-transfer-sms-phone">수신 연락처</label>
      <input id="sr-transfer-sms-phone" type="tel" inputmode="numeric" placeholder="01012345678" class="w-full rounded border border-gray-300 px-3 py-2 text-sm" autocomplete="off" />
      <label class="block text-xs font-semibold text-gray-700" for="sr-transfer-sms-recipient-name">수신자명 (선택, 미저장)</label>
      <input id="sr-transfer-sms-recipient-name" type="text" value="${escapeHtml(staffName)}" class="w-full rounded border border-gray-300 px-3 py-2 text-sm" autocomplete="off" />
      <label class="block text-xs font-semibold text-gray-700" for="sr-transfer-sms-email">이메일 (ID)</label>
      <input id="sr-transfer-sms-email" type="email" placeholder="이첩 대상 이메일" class="w-full rounded border border-gray-300 px-3 py-2 text-sm" autocomplete="off" />
      <label class="block text-xs font-semibold text-gray-700" for="sr-transfer-sms-auth-key">패스키</label>
      <input id="sr-transfer-sms-auth-key" type="text" placeholder="이첩 대상 인증키" class="w-full rounded border border-gray-300 px-3 py-2 text-sm" autocomplete="off" />
      <label class="block text-xs font-semibold text-gray-700" for="sr-transfer-sms-message">문자 내용</label>
      <textarea id="sr-transfer-sms-message" rows="7" class="w-full rounded border border-gray-300 px-3 py-2 text-sm" placeholder="템플릿 내용이 자동으로 채워집니다. 필요 시 수정하세요."></textarea>
      <p class="text-[11px] text-gray-500">이첩사유·이메일·패스키·접속 사이트가 문자에 포함됩니다.</p>
      <button type="button" id="sr-transfer-sms-send-btn" class="rounded bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800">이첩알림 문자 보내기</button>
    </div>`;
}

function resolveTransferStaffCredentials(item) {
  const pending = srState.pendingTransferStaff;
  const formEmail = document.getElementById("sr-transfer-email")?.value.trim() ?? "";
  const formAuthKey = document.getElementById("sr-transfer-auth-key")?.value.trim() ?? "";
  const authDisabled = document.getElementById("sr-transfer-auth-key")?.disabled;

  const smsEmail = document.getElementById("sr-transfer-sms-email")?.value.trim() ?? "";
  const smsAuthKey = document.getElementById("sr-transfer-sms-auth-key")?.value.trim() ?? "";

  let email = smsEmail || pending?.email || formEmail || "";
  let authKey = smsAuthKey || pending?.authKey || "";
  if (!authKey && formAuthKey && !authDisabled) authKey = formAuthKey;

  if (pending?.staffId && item?.id) {
    const stored = loadStoredTier2AuthKey(item.id, pending.staffId);
    if (stored) {
      if (!email) email = stored.email ?? "";
      if (!authKey) authKey = stored.authKey ?? "";
    }
  }

  return { email, authKey };
}

function syncTransferSmsCredentialFields(item, force = false) {
  const emailEl = document.getElementById("sr-transfer-sms-email");
  const authEl = document.getElementById("sr-transfer-sms-auth-key");
  if (!emailEl || !authEl) return;

  const pending = srState.pendingTransferStaff;
  const formEmail = document.getElementById("sr-transfer-email")?.value.trim() ?? "";
  const formAuthKey = document.getElementById("sr-transfer-auth-key")?.value.trim() ?? "";
  const authDisabled = document.getElementById("sr-transfer-auth-key")?.disabled;

  let email = pending?.email ?? formEmail ?? "";
  let authKey = pending?.authKey ?? "";
  if (!authKey && formAuthKey && !authDisabled) authKey = formAuthKey;

  if (pending?.staffId && item?.id) {
    const stored = loadStoredTier2AuthKey(item.id, pending.staffId);
    if (stored) {
      if (!email) email = stored.email ?? "";
      if (!authKey) authKey = stored.authKey ?? "";
    }
  }

  if (force || !emailEl.value.trim()) emailEl.value = email;
  if (force || !authEl.value.trim()) authEl.value = authKey;
  if (pending?.isExisting) {
    authEl.readOnly = true;
    authEl.placeholder = "기존 계정 — 당시 발급 인증키";
  } else {
    authEl.readOnly = false;
    authEl.placeholder = "이첩 대상 인증키";
  }
}

function getTransferReason() {
  const fromInput = document.getElementById("sr-transfer-reason")?.value ?? "";
  if (fromInput.trim()) return fromInput.trim();
  return (srState.transferReason || srState.pendingTransferStaff?.transferReason || "").trim();
}

function renderTier2TransferSmsPreview(force = false) {
  const item = srState.currentCase;
  const messageEl = document.getElementById("sr-transfer-sms-message");
  if (!item || !messageEl) return;
  if (srState.transferSmsEdited && !force) return;

  if (force) syncTransferSmsCredentialFields(item, true);

  const session = getSrSession();
  let recipientName = document.getElementById("sr-transfer-sms-recipient-name")?.value ?? "";
  if (!recipientName.trim()) {
    recipientName =
      document.getElementById("sr-transfer-name")?.value.trim() ||
      srState.pendingTransferStaff?.name ||
      "";
  }
  const creds = resolveTransferStaffCredentials(item);
  const rawTemplate =
    srState.smsTemplates?.TIER2_TRANSFER ?? SR_SMS_TEMPLATE_DEFAULTS.TIER2_TRANSFER ?? "";
  const template = ensureTransferReasonInSmsTemplate(rawTemplate);
  messageEl.value = applySmsPreviewVars(template, {
    receiptNumber: item.receiptNumber ?? "",
    title: item.title ?? "",
    institutionName: item.institution?.name ?? "",
    staffName: recipientName,
    regionalHq: item.regionalHq ?? "",
    reporterName: item.reporterName ?? "",
    email: creds.email,
    authKey: creds.authKey,
    dashboardUrl: getSelfReportDashboardUrl(),
    assignerName: session?.staffName ?? "",
    assignerEmail: session?.email ?? "",
    transferReason: getTransferReason(),
  });
}

function renderTransferStaffBlockHtml(item) {
  const pending = srState.pendingTransferStaff;

  if (pending?.staffId) {
    const authKeyLine = pending.isExisting
      ? `<p class="text-amber-700">기존 계정 — 당시 설정된 인증키 사용</p>`
      : `<p>인증키: ${escapeHtml(pending.authKey ?? "")}</p>`;
    return `
      <div class="rounded border border-green-100 bg-green-50 p-3 text-sm">
        <p class="font-semibold text-green-800">이첩 대상 확인</p>
        <p class="mt-1">이름: ${escapeHtml(pending.name)}</p>
        <p>이메일: ${escapeHtml(pending.email)}</p>
        ${authKeyLine}
      </div>
      <input type="hidden" id="sr-transfer-staff-id" value="${pending.staffId}" />`;
  }

  return `
    <div id="sr-transfer-create-section" class="space-y-2">
      <p class="text-xs font-semibold text-gray-800">이첩 대상 정보 입력</p>
      <label class="block text-xs font-semibold text-gray-700" for="sr-transfer-name">이름</label>
      <input id="sr-transfer-name" type="text" placeholder="2차 담당자 이름" class="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
      <label class="block text-xs font-semibold text-gray-700" for="sr-transfer-email">이메일</label>
      <div class="flex gap-2">
        <input id="sr-transfer-email" type="email" placeholder="로그인 이메일" class="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 text-sm" autocomplete="off" />
        <button type="button" id="sr-transfer-email-check-btn" class="shrink-0 rounded border border-navy-700 bg-white px-3 py-2 text-xs font-semibold text-navy-900 hover:bg-navy-50">중복확인</button>
      </div>
      <p id="sr-transfer-email-check-msg" class="hidden text-xs"></p>
      <label class="block text-xs font-semibold text-gray-700" for="sr-transfer-auth-key">패스키</label>
      <input id="sr-transfer-auth-key" type="text" placeholder="이메일 중복확인 후 입력" class="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-sm" autocomplete="off" disabled />
      <button type="button" id="sr-transfer-confirm-btn" class="rounded bg-navy-800 px-4 py-2 text-sm font-semibold text-white">확인</button>
    </div>`;
}

function renderTier2TransferPanelHtml(item) {
  const pending = srState.pendingTransferStaff;
  const staffName = pending?.name ?? "";
  const executeBtn = pending?.staffId
    ? `<button type="button" id="sr-transfer-execute-btn" class="rounded bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800">이첩</button>`
    : "";
  return `
    <div id="sr-tier2-transfer-panel" class="mt-4 space-y-3 rounded border border-blue-100 bg-blue-50 p-3">
      <p class="text-xs font-bold text-gray-800">2차 담당 이첩 (기관 내 이첩)</p>
      ${renderTransferReasonFieldHtml()}
      ${renderTransferStaffBlockHtml(item)}
      ${renderTier2TransferSmsHtml(staffName)}
      ${executeBtn}
    </div>`;
}

function hasProcessingPlan(item) {
  return Boolean(item.processingPlanDate || item.processingPlanContent?.trim());
}

function renderTier2ResultPanelHtml(item) {
  return `
    <div id="sr-tier2-result-panel" class="mt-4 space-y-2 rounded border border-green-100 bg-green-50 p-3">
      <p class="text-xs font-bold text-gray-800">처리결과 입력</p>
      <label class="block text-xs font-semibold text-gray-700" for="sr-tier2-result-date">처리완료일</label>
      <input id="sr-tier2-result-date" type="date" value="${toDateInputValue(item.processingResultDate)}" class="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
      <label class="block text-xs font-semibold text-gray-700" for="sr-tier2-result-content">처리 내용</label>
      <textarea id="sr-tier2-result-content" rows="3" placeholder="처리 내용을 입력하세요" class="w-full rounded border border-gray-300 px-3 py-2 text-sm">${escapeHtml(item.processingResultContent ?? "")}</textarea>
      <label class="block text-xs font-semibold text-gray-700" for="sr-tier2-result-files">첨부파일</label>
      <input id="sr-tier2-result-files" type="file" multiple class="block w-full text-sm text-gray-700 file:mr-3 file:rounded file:border-0 file:bg-navy-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-navy-800" />
      <p class="text-[11px] text-gray-500">이미지·PDF·문서 등, 파일당 10MB, 최대 10개</p>
      <button type="button" id="sr-tier2-submit-result-btn" class="rounded bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">처리결과 저장</button>
    </div>`;
}

function renderTier2PlanPanelHtml(item) {
  return `
    <div id="sr-tier2-plan-panel" class="mt-4 space-y-2 rounded border border-green-100 bg-green-50 p-3">
      <p class="text-xs font-bold text-gray-800">처리계획 입력</p>
      <label class="block text-xs font-semibold text-gray-700" for="sr-tier2-plan-date">처리계획일</label>
      <input id="sr-tier2-plan-date" type="date" value="${toDateInputValue(item.processingPlanDate)}" class="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
      <label class="block text-xs font-semibold text-gray-700" for="sr-tier2-plan-content">처리계획 내용</label>
      <textarea id="sr-tier2-plan-content" rows="3" placeholder="처리계획을 입력하세요" class="w-full rounded border border-gray-300 px-3 py-2 text-sm">${escapeHtml(item.processingPlanContent ?? "")}</textarea>
      <button type="button" id="sr-tier2-submit-plan-btn" class="rounded bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800">처리계획 저장</button>
    </div>`;
}

function renderTier2UnprocessablePanelHtml(item) {
  return `
    <div id="sr-tier2-unprocessable-panel" class="mt-4 space-y-2 rounded border border-red-100 bg-red-50 p-3">
      <p class="text-xs font-bold text-gray-800">처리불가</p>
      <p class="text-[11px] text-gray-600">저장 시 1차 배정 담당자에게 검토 요청 문자가 발송됩니다. 1차 담당자 확인 후 보고자에게 안내됩니다.</p>
      <label class="block text-xs font-semibold text-gray-700" for="sr-tier2-unprocessable-reason">처리불가 사유</label>
      <textarea id="sr-tier2-unprocessable-reason" rows="3" placeholder="처리불가 사유를 입력하세요" class="w-full rounded border border-gray-300 px-3 py-2 text-sm">${escapeHtml(item.unprocessableReason ?? "")}</textarea>
      <button type="button" id="sr-tier2-submit-unprocessable-btn" class="rounded bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800">처리불가 저장</button>
    </div>`;
}

function renderTier2PriorPanelHtml(item) {
  return `
    <div id="sr-tier2-prior-panel" class="mt-4 space-y-2 rounded border border-purple-100 bg-purple-50 p-3">
      <p class="text-xs font-bold text-gray-800">기처리</p>
      <label class="block text-xs font-semibold text-gray-700" for="sr-tier2-prior-date">기처리 일자</label>
      <input id="sr-tier2-prior-date" type="date" value="${toDateInputValue(item.priorCompletionDate)}" class="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
      <label class="block text-xs font-semibold text-gray-700" for="sr-tier2-prior-content">기처리 내용</label>
      <textarea id="sr-tier2-prior-content" rows="3" placeholder="기처리 내용을 입력하세요" class="w-full rounded border border-gray-300 px-3 py-2 text-sm">${escapeHtml(item.priorCompletionContent ?? "")}</textarea>
      <button type="button" id="sr-tier2-submit-prior-btn" class="rounded bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800">기처리 저장</button>
    </div>`;
}

function renderTier2ActionsHtml(item, tier2List) {
  const finalized = ["COMPLETED", "CLOSED", "UNPROCESSABLE"].includes(item.status);
  if (item.status === "UNPROCESSABLE_PENDING") {
    return `
      <div class="rounded border border-amber-200 bg-amber-50 p-3 text-sm">
        <p class="font-semibold text-amber-900">처리불가 확인 대기</p>
        <p class="mt-1 text-gray-700">1차 배정 담당자 확인을 기다리는 중입니다.</p>
        ${
          item.unprocessableReason
            ? `<p class="mt-2"><strong>요청 사유:</strong></p><p class="mt-1 whitespace-pre-wrap text-gray-700">${escapeHtml(item.unprocessableReason)}</p>`
            : ""
        }
      </div>`;
  }
  if (finalized) {
    return `<p class="text-sm text-gray-600">종결된 보고입니다.</p>`;
  }

  let panelHtml = "";
  if (srState.tier2ActionPanel === "TRANSFER") {
    panelHtml = renderTier2TransferPanelHtml(item);
  } else if (srState.tier2ActionPanel === "PLAN") {
    panelHtml = renderTier2PlanPanelHtml(item);
  } else if (srState.tier2ActionPanel === "RESULT") {
    panelHtml = renderTier2ResultPanelHtml(item);
  } else if (srState.tier2ActionPanel === "UNPROCESSABLE") {
    panelHtml = renderTier2UnprocessablePanelHtml(item);
  } else if (srState.tier2ActionPanel === "PRIOR") {
    panelHtml = renderTier2PriorPanelHtml(item);
  }

  return `${renderTier2ActionChoiceHtml(item)}${panelHtml}`;
}

function renderTier1UnprocessableConfirmHtml(item) {
  const tier1Name = item.unprocessableTier1Staff?.name ?? "1차 배정 담당자";
  return `
    <div id="sr-tier1-unprocessable-confirm" class="space-y-3 rounded border border-amber-200 bg-amber-50 p-3">
      <p class="text-xs font-bold text-amber-900">처리불가 검토 요청</p>
      <p class="text-sm text-gray-700">2차 담당자가 처리불가를 요청했습니다. 확인 시 보고자에게 안내 문자가 발송됩니다.</p>
      <p class="text-xs text-gray-600">확인 담당: ${escapeHtml(tier1Name)}</p>
      ${
        item.unprocessableReason
          ? `<div class="rounded border border-amber-100 bg-white p-2 text-sm"><p class="text-xs font-semibold text-gray-700">처리불가 사유</p><p class="mt-1 whitespace-pre-wrap text-gray-800">${escapeHtml(item.unprocessableReason)}</p></div>`
          : ""
      }
      <button type="button" id="sr-tier1-confirm-unprocessable-btn" class="rounded bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800">확인</button>
    </div>`;
}

function renderTier1DirectInputHtml(item) {
  return `
    <div id="sr-tier1-direct-input" class="mt-4 space-y-3 border-t border-gray-200 pt-4">
      <div class="space-y-2">
        <p class="text-xs font-bold text-gray-800">조치계획</p>
        <label class="block text-xs font-semibold text-gray-700" for="sr-direct-plan-date">조치계획일</label>
        <input id="sr-direct-plan-date" type="date" value="${toDateInputValue(item.processingPlanDate)}" class="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
        <label class="block text-xs font-semibold text-gray-700" for="sr-direct-plan-content">조치계획 내용</label>
        <textarea id="sr-direct-plan-content" rows="3" placeholder="조치계획을 입력하세요" class="w-full rounded border border-gray-300 px-3 py-2 text-sm">${escapeHtml(item.processingPlanContent ?? "")}</textarea>
        <button type="button" id="sr-submit-plan-btn" class="rounded bg-navy-900 px-4 py-2 text-sm font-semibold text-white">조치계획 저장</button>
      </div>
      ${renderDirectInputResultHtml(item)}
    </div>`;
}

function renderDirectInputResultHtml(item) {
  return `
    <div class="mt-4 space-y-2 border-t border-gray-200 pt-4">
      <p class="text-xs font-bold text-gray-800">조치결과</p>
      <label class="block text-xs font-semibold text-gray-700" for="sr-result-date">조치완료일</label>
      <input id="sr-result-date" type="date" value="${toDateInputValue(item.processingResultDate)}" class="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
      <label class="block text-xs font-semibold text-gray-700" for="sr-result-content">조치 내용</label>
      <textarea id="sr-result-content" rows="3" placeholder="조치 내용을 입력하세요" class="w-full rounded border border-gray-300 px-3 py-2 text-sm">${escapeHtml(item.processingResultContent ?? "")}</textarea>
      <label class="block text-xs font-semibold text-gray-700" for="sr-result-files">첨부파일</label>
      <input id="sr-result-files" type="file" multiple class="block w-full text-sm text-gray-700 file:mr-3 file:rounded file:border-0 file:bg-navy-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-navy-800" />
      <p class="text-[11px] text-gray-500">이미지·PDF·문서 등, 파일당 10MB, 최대 10개</p>
      <button type="button" id="sr-submit-result-btn" class="rounded bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">조치결과 저장</button>
    </div>`;
}

function renderTier1ActionsHtml(item, session) {
  if (item.status === "UNPROCESSABLE_PENDING") {
    return renderTier1UnprocessableConfirmHtml(item);
  }

  const intakeFinalized = FINAL_INTAKE_DECISIONS.includes(item.intakeDecision);
  const showDownstream = item.intakeDecision === "PROCESS";
  const showPriorForm = srState.showPriorCompletionForm && !intakeFinalized;

  if (intakeFinalized) {
    let statusMessage = "";
    if (item.intakeDecision === "UNPROCESSABLE") statusMessage = "처리불가 처리 되었습니다.";
    if (item.intakeDecision === "RETURN_TO_ADMIN") statusMessage = "관리자에게 반려되었습니다.";
    if (item.intakeDecision === "ALREADY_COMPLETED") statusMessage = "기완료 처리 되었습니다.";
    return `
      <div class="rounded border border-gray-200 bg-gray-50 p-3 text-sm">
        <p class="font-semibold text-gray-900">접수</p>
        <p class="mt-1">${escapeHtml(item.intakeDecisionLabel ?? INTAKE_DECISION_LABELS[item.intakeDecision] ?? "")}</p>
        <p class="mt-2 font-medium text-gray-800">${statusMessage}</p>
      </div>`;
  }

  if (showPriorForm) {
    return `${renderIntakeRadiosHtml("ALREADY_COMPLETED")}${renderPriorCompletionFormHtml(item)}`;
  }

  if (showDownstream) {
    const header = renderIntakeProcessHeaderHtml(item);
    if (!item.processingPath) {
      return `${header}${renderProcessingPathChoiceHtml()}`;
    }
    if (item.processingPath === "TIER2_ASSIGN") {
      return `${header}${renderTier1Tier2AssignHtml(item, session)}`;
    }
    if (item.processingPath === "DIRECT_INPUT") {
      return `${header}${renderTier1DirectInputHtml(item)}`;
    }
  }

  return renderIntakeRadiosHtml();
}

function renderProcessingResultInputsHtml(item) {
  return `
    <div class="mt-4 space-y-2 border-t border-gray-200 pt-4">
      <p class="text-xs font-bold text-gray-800">처리결과</p>
      <label class="block text-xs font-semibold text-gray-700" for="sr-result-date">처리완료일</label>
      <input id="sr-result-date" type="date" value="${toDateInputValue(item.processingResultDate)}" class="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
      <label class="block text-xs font-semibold text-gray-700" for="sr-result-content">처리 내용</label>
      <textarea id="sr-result-content" rows="3" placeholder="처리 내용을 입력하세요" class="w-full rounded border border-gray-300 px-3 py-2 text-sm">${escapeHtml(item.processingResultContent ?? "")}</textarea>
      <label class="block text-xs font-semibold text-gray-700" for="sr-result-files">첨부파일</label>
      <input id="sr-result-files" type="file" multiple class="block w-full text-sm text-gray-700 file:mr-3 file:rounded file:border-0 file:bg-navy-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-navy-800" />
      <p class="text-[11px] text-gray-500">이미지·PDF·문서 등, 파일당 10MB, 최대 10개</p>
      <button type="button" id="sr-submit-result-btn" class="rounded bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">처리결과 저장</button>
    </div>`;
}

function renderTier2AssignmentSmsPreview(force = false) {
  const item = srState.currentCase;
  const messageEl = document.getElementById("sr-tier2-assign-sms-message");
  if (!item || !messageEl) return;
  if (srState.tier2AssignSmsEdited && !force) return;

  if (force) syncTier2AssignSmsCredentialFields(item, true);

  const session = getSrSession();
  const recipientName = document.getElementById("sr-tier2-assign-sms-recipient-name")?.value ?? "";
  const creds = resolveTier2AssigneeCredentials(item);
  const template =
    srState.smsTemplates?.TIER1_TO_TIER2 ?? SR_SMS_TEMPLATE_DEFAULTS.TIER1_TO_TIER2 ?? "";
  messageEl.value = applySmsPreviewVars(template, {
    receiptNumber: item.receiptNumber ?? "",
    title: item.title ?? "",
    institutionName: item.institution?.name ?? "",
    staffName: recipientName,
    regionalHq: item.regionalHq ?? "",
    reporterName: item.reporterName ?? "",
    email: creds.email,
    authKey: creds.authKey,
    dashboardUrl: getSelfReportDashboardUrl(),
    assignerName: session?.staffName ?? "",
    assignerEmail: session?.email ?? "",
  });
}

function resetTier2EmailCheckDom() {
  const authKeyEl = document.getElementById("sr-tier2-auth-key");
  const msgEl = document.getElementById("sr-tier2-email-check-msg");
  if (authKeyEl) {
    authKeyEl.value = "";
    authKeyEl.disabled = true;
    authKeyEl.classList.add("bg-gray-100");
    authKeyEl.placeholder = "이메일 중복확인 후 입력";
  }
  if (msgEl) {
    msgEl.textContent = "";
    msgEl.className = "hidden text-xs";
  }
}

function clearTier2EmailCheck() {
  srState.tier2EmailCheck = null;
  resetTier2EmailCheckDom();
}

function applyTier2EmailCheckUI(check) {
  const authKeyEl = document.getElementById("sr-tier2-auth-key");
  const msgEl = document.getElementById("sr-tier2-email-check-msg");
  if (!authKeyEl || !msgEl) return;

  msgEl.classList.remove("hidden");
  if (check.status === "available") {
    authKeyEl.disabled = false;
    authKeyEl.classList.remove("bg-gray-100");
    authKeyEl.placeholder = "로그인 인증키";
    msgEl.textContent = check.message;
    msgEl.className = "text-xs text-green-700";
  } else if (check.status === "existing") {
    authKeyEl.disabled = true;
    authKeyEl.value = "";
    authKeyEl.classList.add("bg-gray-100");
    authKeyEl.placeholder = "기존 계정 — 인증키 변경 불가";
    msgEl.textContent = check.message;
    msgEl.className = "text-xs text-amber-700";
  }
}

function bindTier2StaffActions() {
  const emailInput = document.getElementById("sr-tier2-email");
  if (emailInput) {
    emailInput.addEventListener("input", clearTier2EmailCheck);
    if (srState.tier2EmailCheck && emailInput.value.trim() === srState.tier2EmailCheck.email) {
      applyTier2EmailCheckUI(srState.tier2EmailCheck);
    } else {
      srState.tier2EmailCheck = null;
      resetTier2EmailCheckDom();
    }
  }

  document.getElementById("sr-tier2-email-check-btn")?.addEventListener("click", async () => {
    const email = document.getElementById("sr-tier2-email")?.value.trim() ?? "";
    if (!email) return alert("이메일을 입력해 주세요.");
    try {
      const result = await srApiFetch("/api/self-report/tier2-staff/check-email", {
        method: "POST",
        body: { email },
      });
      const data = result.data;
      srState.tier2EmailCheck = {
        email,
        status: data.status,
        message: data.message ?? result.message,
      };
      applyTier2EmailCheckUI(srState.tier2EmailCheck);
      if (data.status === "existing" && data.name) {
        const nameEl = document.getElementById("sr-tier2-name");
        if (nameEl && !nameEl.value.trim()) nameEl.value = data.name;
      }
    } catch (error) {
      clearTier2EmailCheck();
      alert(error.message ?? "이메일 중복확인에 실패했습니다.");
    }
  });

  document.getElementById("sr-tier2-confirm-btn")?.addEventListener("click", async () => {
    const name = document.getElementById("sr-tier2-name")?.value.trim() ?? "";
    const email = document.getElementById("sr-tier2-email")?.value.trim() ?? "";
    const phone = document.getElementById("sr-tier2-phone")?.value.trim() ?? "";
    const authKey = document.getElementById("sr-tier2-auth-key")?.value.trim() ?? "";
    const check = srState.tier2EmailCheck;

    if (!name || !email) return alert("이름과 이메일을 입력해 주세요.");
    if (!check || check.email !== email) {
      return alert("이메일 중복확인을 먼저 해 주세요.");
    }
    if (check.status === "available" && !authKey) {
      return alert("패스키를 입력해 주세요.");
    }

    try {
      const body = { name, email, phone };
      if (check.status === "available") body.authKey = authKey;

      const result = await srApiFetch("/api/self-report/tier2-staff", {
        method: "POST",
        body,
      });
      const data = result.data;

      await srApiFetch(`/api/self-report/cases/${srState.currentCase.id}/assign-tier1`, {
        method: "POST",
        body: { toStaffId: data.staffId },
      });

      srState.pendingTier2Staff = {
        caseId: srState.currentCase.id,
        staffId: data.staffId,
        name: data.name,
        email: data.email,
        authKey: data.isExisting ? null : authKey,
        isExisting: Boolean(data.isExisting),
        institutionCode: data.institutionCode,
      };
      if (!data.isExisting && authKey) {
        saveStoredTier2AuthKey(srState.currentCase.id, data.staffId, data.email, authKey);
      }
      srState.tier2EmailCheck = null;

      if (!data.isExisting && authKey && phone) {
        if (window.confirm("2차 담당자를 배정했습니다. 접속안내 문자를 발송하시겠습니까?")) {
          try {
            const smsResult = await srApiFetch("/api/self-report/send-tier2-account-sms", {
              method: "POST",
              body: {
                phone,
                name: data.name,
                email: data.email,
                authKey,
                message: buildTier2CredentialSmsMessage(srState.pendingTier2Staff),
              },
            });
            alert(smsResult.message ?? "접속안내 문자를 발송했습니다.");
          } catch (smsError) {
            alert(smsError.message ?? "접속안내 문자 발송에 실패했습니다.");
          }
        } else {
          alert("2차 담당자를 배정했습니다. '배정알림 문자 보내기' 또는 '접속안내 문자 발송'을 이용해 주세요.");
        }
      } else {
        alert("2차 담당자를 배정했습니다. '배정알림 문자 보내기'를 눌러 문자를 발송해 주세요.");
      }

      await loadCases();
      await openCaseDetail(srState.currentCase.id);
    } catch (error) {
      alert(error.message ?? "2차 담당자 생성에 실패했습니다.");
    }
  });

  document.getElementById("sr-tier2-credential-sms-btn")?.addEventListener("click", async () => {
    const pending = srState.pendingTier2Staff;
    const phone = document.getElementById("sr-tier2-credential-phone")?.value.trim() ?? "";
    if (!phone) return alert("수신 번호를 입력해 주세요.");
    if (!pending?.authKey) {
      return alert("기존 계정은 패스키를 알 수 없어 접속안내 문자를 발송할 수 없습니다.");
    }
    try {
      const result = await srApiFetch("/api/self-report/send-tier2-account-sms", {
        method: "POST",
        body: {
          phone,
          name: pending.name,
          email: pending.email,
          authKey: pending.authKey,
          message: buildTier2CredentialSmsMessage(pending),
        },
      });
      document.getElementById("sr-tier2-credential-phone").value = "";
      alert(result.message ?? "접속안내 문자를 발송했습니다.");
    } catch (error) {
      alert(error.message ?? "문자 발송에 실패했습니다.");
    }
  });

  renderTier2CredentialSmsPreview();

  document.getElementById("sr-tier2-assign-sms-open-btn")?.addEventListener("click", async () => {
    srState.tier2AssignSmsVisible = true;
    srState.tier2AssignSmsEdited = false;
    await openCaseDetail(srState.currentCase.id);
    requestAnimationFrame(() => {
      document.getElementById("sr-tier2-assign-sms-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  if (document.getElementById("sr-tier2-assign-sms-section")) {
    srState.tier2AssignSmsEdited = false;
    loadSmsTemplatesIfNeeded().then(() => renderTier2AssignmentSmsPreview(true));
  }

  document.getElementById("sr-tier2-assign-sms-message")?.addEventListener("input", () => {
    srState.tier2AssignSmsEdited = true;
  });

  ["sr-tier2-assign-sms-email", "sr-tier2-assign-sms-auth-key"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", () => {
      srState.tier2AssignSmsEdited = false;
      renderTier2AssignmentSmsPreview(false);
    });
  });

  const tier2EmailInput = document.getElementById("sr-tier2-email");
  const tier2AuthInput = document.getElementById("sr-tier2-auth-key");
  tier2EmailInput?.addEventListener("input", () => {
    if (document.getElementById("sr-tier2-assign-sms-section")) {
      srState.tier2AssignSmsEdited = false;
      renderTier2AssignmentSmsPreview(true);
    }
  });
  tier2AuthInput?.addEventListener("input", () => {
    if (document.getElementById("sr-tier2-assign-sms-section") && !tier2AuthInput.disabled) {
      srState.tier2AssignSmsEdited = false;
      renderTier2AssignmentSmsPreview(true);
    }
  });

  document.getElementById("sr-assign-tier1-btn")?.addEventListener("click", async () => {
    const toStaffId = Number(
      document.getElementById("sr-tier2-staff-id")?.value || srState.pendingTier2Staff?.staffId,
    );
    if (!toStaffId) return alert("먼저 2차 담당자 정보를 입력하고 확인을 눌러 주세요.");
    try {
      await srApiFetch(`/api/self-report/cases/${srState.currentCase.id}/assign-tier1`, {
        method: "POST",
        body: { toStaffId },
      });
      alert("2차 담당자에게 배정했습니다. '배정알림 문자 보내기'를 눌러 문자를 발송해 주세요.");
      await loadCases();
      await openCaseDetail(srState.currentCase.id);
    } catch (error) {
      alert(error.message ?? "배정에 실패했습니다.");
    }
  });

  const assignNameInput = document.getElementById("sr-tier2-assign-sms-recipient-name");
  assignNameInput?.addEventListener("input", () => renderTier2AssignmentSmsPreview());
  assignNameInput?.addEventListener("keyup", () => renderTier2AssignmentSmsPreview());
  renderTier2AssignmentSmsPreview(true);

  document.getElementById("sr-tier2-assign-sms-send-btn")?.addEventListener("click", async () => {
    const phone = document.getElementById("sr-tier2-assign-sms-phone")?.value.trim() ?? "";
    const recipientName = document.getElementById("sr-tier2-assign-sms-recipient-name")?.value.trim() ?? "";
    const message = document.getElementById("sr-tier2-assign-sms-message")?.value.trim() ?? "";
    const creds = resolveTier2AssigneeCredentials(srState.currentCase);
    if (!phone) return alert("수신 연락처를 입력해 주세요.");
    if (!message) return alert("문자 내용을 입력해 주세요.");
    try {
      const result = await srApiFetch(`/api/self-report/cases/${srState.currentCase.id}/send-sms`, {
        method: "POST",
        body: {
          phone,
          recipientName: recipientName || undefined,
          templateType: "TIER1_TO_TIER2",
          message,
          email: creds.email || undefined,
          authKey: creds.authKey || undefined,
        },
      });
      document.getElementById("sr-tier2-assign-sms-phone").value = "";
      srState.tier2AssignSmsEdited = false;
      renderTier2AssignmentSmsPreview(true);
      alert(result.message ?? "배정알림 문자를 발송했습니다.");
      await openCaseDetail(srState.currentCase.id);
    } catch (error) {
      alert(error.message ?? "문자 발송에 실패했습니다.");
    }
  });
}

function bindAttachmentPreview() {
  const preview = document.getElementById("sr-image-preview");
  const img = document.getElementById("sr-image-preview-img");
  if (!preview || !img) return;

  const positionPreview = (event) => {
    const offset = 16;
    let left = event.clientX + offset;
    let top = event.clientY + offset;
    const rect = preview.getBoundingClientRect();
    if (left + rect.width > window.innerWidth - 8) {
      left = event.clientX - rect.width - offset;
    }
    if (top + rect.height > window.innerHeight - 8) {
      top = event.clientY - rect.height - offset;
    }
    preview.style.left = `${Math.max(8, left)}px`;
    preview.style.top = `${Math.max(8, top)}px`;
  };

  document.querySelectorAll("[data-sr-image-url]").forEach((el) => {
    el.addEventListener("mouseenter", (event) => {
      img.src = el.dataset.srImageUrl;
      preview.classList.remove("hidden");
      positionPreview(event);
    });
    el.addEventListener("mousemove", positionPreview);
    el.addEventListener("mouseleave", () => {
      preview.classList.add("hidden");
      img.removeAttribute("src");
    });
  });
}

function bindAttachmentDeleteHandlers() {
  document.querySelectorAll(".sr-delete-attachment").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const attachmentId = Number(btn.dataset.attachmentId);
      if (!attachmentId || !confirm("첨부파일을 삭제하시겠습니까?")) return;
      try {
        await srApiFetch(
          `/api/self-report/cases/${srState.currentCase.id}/attachments/${attachmentId}`,
          { method: "DELETE" },
        );
        await openCaseDetail(srState.currentCase.id);
      } catch (error) {
        alert(error.message ?? "삭제에 실패했습니다.");
      }
    });
  });
}

async function loadCases(requestedPage) {
  if (requestedPage !== undefined) {
    srState.listPage = Math.max(1, Number(requestedPage) || 1);
  }

  const status = document.getElementById("sr-status-filter").value;
  const search = document.getElementById("sr-search").value.trim();
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (search) params.set("search", search);
  params.set("page", String(srState.listPage));
  params.set("pageSize", String(srState.listPageSize));

  const result = await srApiFetch(`/api/self-report/cases?${params.toString()}`);
  const data = result.data ?? {};
  srState.cases = data.items ?? [];
  srState.listTotal = data.total ?? srState.cases.length;
  srState.listPage = data.page ?? srState.listPage;
  srState.listTotalPages = Math.max(1, data.totalPages ?? 1);
  srState.listPageSize = data.pageSize ?? srState.listPageSize;

  if (srState.listPage > srState.listTotalPages && srState.listTotal > 0) {
    return loadCases(srState.listTotalPages);
  }

  const visibleIds = new Set(srState.cases.map((item) => item.id));
  srState.selectedCaseIds = new Set([...srState.selectedCaseIds].filter((id) => visibleIds.has(id)));
  renderCaseTable();
  updateSrPaginationUI();
}

function updateSrPaginationUI() {
  const totalEl = document.getElementById("sr-total-count");
  const currentEl = document.getElementById("sr-current-page");
  const totalPagesEl = document.getElementById("sr-total-pages");
  const pageSizeEl = document.getElementById("sr-page-size");
  const numbers = document.getElementById("sr-page-numbers");
  const pagination = document.getElementById("sr-pagination");

  if (totalEl) totalEl.textContent = String(srState.listTotal);
  if (currentEl) currentEl.textContent = String(srState.listPage);
  if (totalPagesEl) totalPagesEl.textContent = String(srState.listTotalPages);
  if (pageSizeEl) pageSizeEl.value = String(srState.listPageSize);
  if (pagination) {
    pagination.classList.toggle("hidden", srState.listTotal === 0);
  }

  const firstBtn = document.getElementById("sr-page-first");
  const prevBtn = document.getElementById("sr-page-prev");
  const nextBtn = document.getElementById("sr-page-next");
  const lastBtn = document.getElementById("sr-page-last");
  const onFirstPage = srState.listPage <= 1;
  const onLastPage = srState.listPage >= srState.listTotalPages;
  if (firstBtn) firstBtn.disabled = onFirstPage;
  if (prevBtn) prevBtn.disabled = onFirstPage;
  if (nextBtn) nextBtn.disabled = onLastPage;
  if (lastBtn) lastBtn.disabled = onLastPage;

  if (!numbers) return;
  numbers.innerHTML = "";

  const maxButtons = 5;
  let start = Math.max(1, srState.listPage - Math.floor(maxButtons / 2));
  let end = Math.min(srState.listTotalPages, start + maxButtons - 1);
  start = Math.max(1, end - maxButtons + 1);

  for (let page = start; page <= end; page += 1) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = String(page);
    btn.className =
      page === srState.listPage
        ? "min-w-[28px] rounded border border-navy-800 bg-navy-800 px-2 py-1 text-xs text-white"
        : "min-w-[28px] rounded border border-gray-300 px-2 py-1 text-xs hover:bg-white";
    btn.addEventListener("click", () => {
      loadCases(page).catch((error) => alert(error.message ?? "목록을 불러오지 못했습니다."));
    });
    numbers.appendChild(btn);
  }
}

function isAdminSession() {
  return getSrSession()?.role === "ADMIN";
}

function syncCaseSelectAllCheckbox() {
  const selectAll = document.getElementById("sr-select-all-cases");
  if (!selectAll || !isAdminSession()) return;
  const ids = srState.cases.map((item) => item.id);
  const selectedOnPage = ids.filter((id) => srState.selectedCaseIds.has(id));
  selectAll.checked = ids.length > 0 && selectedOnPage.length === ids.length;
  selectAll.indeterminate = selectedOnPage.length > 0 && selectedOnPage.length < ids.length;
  const deleteBtn = document.getElementById("sr-bulk-delete-btn");
  if (deleteBtn) {
    deleteBtn.textContent =
      srState.selectedCaseIds.size > 0
        ? `선택 삭제 (${srState.selectedCaseIds.size})`
        : "선택 삭제";
  }
}

function renderCaseTable() {
  const tbody = document.getElementById("sr-table-body");
  const empty = document.getElementById("sr-empty-msg");
  const showSelect = isAdminSession();
  if (!srState.cases.length) {
    tbody.innerHTML = "";
    empty.classList.remove("hidden");
    syncCaseSelectAllCheckbox();
    return;
  }
  empty.classList.add("hidden");
  tbody.innerHTML = srState.cases
    .map((item) => {
      const checked = srState.selectedCaseIds.has(item.id);
      const selectCell = showSelect
        ? `<td class="sr-case-select px-3 py-2" data-case-id="${item.id}">
            <input type="checkbox" class="sr-case-checkbox h-4 w-4 rounded border-gray-300" data-case-id="${item.id}" ${
              checked ? "checked" : ""
            } aria-label="${escapeHtml(item.receiptNumber)} 선택" />
          </td>`
        : "";
      return `
    <tr class="sr-case-row cursor-pointer transition-colors hover:bg-gray-100" data-case-id="${item.id}">
      ${selectCell}
      <td class="px-3 py-2 font-mono text-xs">${escapeHtml(item.receiptNumber)}</td>
      <td class="px-3 py-2">${escapeHtml(item.title)}</td>
      <td class="px-3 py-2">${escapeHtml(item.statusLabel ?? STATUS_LABELS[item.status] ?? item.status)}</td>
      <td class="px-3 py-2">${escapeHtml(item.institution?.name ?? "-")}</td>
      <td class="px-3 py-2 text-xs">${formatAssigneesSummary(item)}</td>
      <td class="px-3 py-2 whitespace-nowrap">${formatDate(item.createdAt)}</td>
      <td class="px-3 py-2">
        <span class="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700">상세</span>
      </td>
    </tr>`;
    })
    .join("");
  syncCaseSelectAllCheckbox();
}

async function deleteSelectedCases() {
  const ids = [...srState.selectedCaseIds];
  if (!ids.length) {
    alert("삭제할 보고를 선택해 주세요.");
    return;
  }
  if (!confirm(`선택한 ${ids.length}건의 보고를 삭제하시겠습니까?\n첨부파일과 처리 이력도 함께 삭제됩니다.`)) {
    return;
  }
  try {
    const result = await srApiFetch("/api/self-report/cases/bulk-delete", {
      method: "POST",
      body: { ids },
    });
    srState.selectedCaseIds.clear();
    if (srState.currentCase && ids.includes(srState.currentCase.id)) {
      closeDetailModal();
      srState.currentCase = null;
    }
    alert(result.message ?? "선택한 보고를 삭제했습니다.");
    await loadCases();
  } catch (error) {
    alert(error.message ?? "삭제에 실패했습니다.");
  }
}

async function loadInstitutionsIfNeeded() {
  if (srState.institutions.length) return;
  const result = await srApiFetch("/api/self-report/institutions");
  srState.institutions = result.data ?? [];
}

async function loadStaffForInstitution(institutionId) {
  const result = await srApiFetch(`/api/self-report/staff?institutionId=${institutionId}`);
  srState.staff = result.data ?? [];
  return srState.staff;
}

function getSmsTemplateKeyForRole(role) {
  if (role === "ADMIN") return "ADMIN_TO_INSTITUTION";
  if (role === "SELF_REPORT_TIER1") return "TIER1_TO_TIER2";
  return "TIER2_TRANSFER";
}

async function loadSmsTemplatesIfNeeded() {
  if (srState.smsTemplates) return srState.smsTemplates;
  try {
    const result = await srApiFetch("/api/self-report/sms/templates");
    const data = result.data ?? {};
    if (data.TIER1_TO_TIER2 || data.ADMIN_TO_INSTITUTION) {
      srState.smsTemplates = { ...SR_SMS_TEMPLATE_DEFAULTS, ...data };
    } else {
      srState.smsTemplates = { ...SR_SMS_TEMPLATE_DEFAULTS, ...(data.templates ?? {}) };
      srState.smsDashboardUrl = data.dashboardUrl?.trim() || null;
    }
  } catch {
    srState.smsTemplates = { ...SR_SMS_TEMPLATE_DEFAULTS };
  }
  for (const key of ["ADMIN_TO_INSTITUTION", "TIER1_TO_TIER2", "TIER2_TRANSFER"]) {
    if (srState.smsTemplates[key]) {
      srState.smsTemplates[key] = ensureCredentialLinesInSmsTemplate(srState.smsTemplates[key]);
    }
  }
  return srState.smsTemplates;
}

function applySmsPreviewVars(template, vars) {
  let text = template;
  const staffName = vars.staffName ?? "";
  const hasStaffPlaceholder = text.includes("{staffName}");

  for (const [key, value] of Object.entries(vars)) {
    if (key === "staffName") continue;
    text = text.split(`{${key}}`).join(value ?? "");
  }

  if (hasStaffPlaceholder) {
    text = text.split("{staffName}").join(staffName);
  } else if (staffName) {
    text = `${staffName}님, ${text}`;
  }

  return text;
}

function renderSmsTemplatePreview(force = false) {
  const item = srState.currentCase;
  const session = getSrSession();
  const messageEl = document.getElementById("sr-sms-message");
  if (!item || !messageEl || !session) return;
  if (srState.smsMessageEdited && !force) return;

  if (force) syncSmsCredentialFields(item, session, true);

  const recipientName = document.getElementById("sr-sms-recipient-name")?.value ?? "";
  const templateKey = getSmsTemplateKeyForRole(session.role);
  const rawTemplate = srState.smsTemplates?.[templateKey] ?? SR_SMS_TEMPLATE_DEFAULTS[templateKey] ?? "";
  const template = ensureCredentialLinesInSmsTemplate(rawTemplate);
  const creds = resolveSmsCredentialFields(item, session);
  const adminSession = session.role === "ADMIN" ? getSrSession() : null;

  messageEl.value = applySmsPreviewVars(template, {
    receiptNumber: item.receiptNumber ?? "",
    title: item.title ?? "",
    institutionName: item.institution?.name ?? "",
    staffName: recipientName,
    regionalHq: item.regionalHq ?? "",
    reporterName: item.reporterName ?? "",
    email: creds.email,
    authKey: creds.authKey,
    dashboardUrl: getSelfReportDashboardUrl(),
    assignerName: session.role === "ADMIN" ? "관리자" : session.staffName ?? "",
    assignerEmail:
      session.role === "ADMIN"
        ? (adminSession?.email ?? adminSession?.label?.replace(/\s*\(관리자\)\s*$/, "") ?? "")
        : session.email ?? "",
  });
}

function bindSmsSendActions() {
  const phoneInput = document.getElementById("sr-sms-phone");
  const nameInput = document.getElementById("sr-sms-recipient-name");
  if (!phoneInput && !nameInput) return;

  phoneInput?.addEventListener("input", renderSmsTemplatePreview);
  nameInput?.addEventListener("input", renderSmsTemplatePreview);
  nameInput?.addEventListener("keyup", renderSmsTemplatePreview);
  ["sr-sms-email", "sr-sms-auth-key"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", () => {
      srState.smsMessageEdited = false;
      renderSmsTemplatePreview(false);
    });
  });
  document.getElementById("sr-sms-message")?.addEventListener("input", () => {
    srState.smsMessageEdited = true;
  });

  document.getElementById("sr-sms-send-btn")?.addEventListener("click", async () => {
    const phone = document.getElementById("sr-sms-phone")?.value.trim() ?? "";
    const recipientName = document.getElementById("sr-sms-recipient-name")?.value.trim() ?? "";
    const message = document.getElementById("sr-sms-message")?.value.trim() ?? "";
    if (!phone) return alert("수신 휴대폰 번호를 입력해 주세요.");
    if (!message) return alert("문자 내용을 입력해 주세요.");
    try {
      const result = await srApiFetch(`/api/self-report/cases/${srState.currentCase.id}/send-sms`, {
        method: "POST",
        body: { phone, recipientName: recipientName || undefined, message },
      });
      document.getElementById("sr-sms-phone").value = "";
      document.getElementById("sr-sms-recipient-name").value = "";
      srState.smsMessageEdited = false;
      renderSmsTemplatePreview(true);
      alert(result.message ?? "문자를 발송했습니다.");
      await openCaseDetail(srState.currentCase.id);
    } catch (error) {
      alert(error.message ?? "문자 발송에 실패했습니다.");
    }
  });
}

async function appendSmsSendSection(session, item) {
  const actionsEl = document.getElementById("sr-detail-actions");
  if (!session || !["ADMIN", "SELF_REPORT_TIER1", "SELF_REPORT_TIER2"].includes(session.role)) return;

  const institutionId = session.role === "ADMIN" ? item.institutionId : session.institutionId;
  if (!institutionId) return;

  await loadSmsTemplatesIfNeeded();

  actionsEl.insertAdjacentHTML(
    "beforeend",
    `
    <div class="mt-4 space-y-2 border-t border-gray-200 pt-4">
      <label class="block text-xs font-semibold text-gray-700" for="sr-sms-phone">문자 발송</label>
      <input id="sr-sms-phone" type="tel" inputmode="numeric" placeholder="01012345678" class="w-full rounded border border-gray-300 px-3 py-2 text-sm" autocomplete="off" />
      <p class="text-[11px] text-gray-500">수신 번호는 발송 시에만 사용되며 저장되지 않습니다.</p>
      <label class="block text-xs font-semibold text-gray-700" for="sr-sms-recipient-name">수신자명 (선택, 미저장)</label>
      <input id="sr-sms-recipient-name" type="text" placeholder="수신자명 입력 시 아래 미리보기에 바로 반영" class="w-full rounded border border-gray-300 px-3 py-2 text-sm" autocomplete="off" />
      <p class="text-[11px] text-gray-500">템플릿에 {staffName}이 있으면 치환되고, 없으면 문장 앞에 붙습니다.</p>
      <label class="block text-xs font-semibold text-gray-700" for="sr-sms-email">이메일 (ID)</label>
      <input id="sr-sms-email" type="email" placeholder="배정 대상 이메일" class="w-full rounded border border-gray-300 px-3 py-2 text-sm" autocomplete="off" />
      <label class="block text-xs font-semibold text-gray-700" for="sr-sms-auth-key">패스키</label>
      <input id="sr-sms-auth-key" type="text" placeholder="배정 대상 패스키" class="w-full rounded border border-gray-300 px-3 py-2 text-sm" autocomplete="off" />
      <p class="text-[11px] text-gray-500">이메일·패스키·접속 사이트가 문자에 포함됩니다. 신규 배정 시 자동으로 채워집니다.</p>
      <label class="block text-xs font-semibold text-gray-700" for="sr-sms-message">문자 내용</label>
      <textarea id="sr-sms-message" rows="7" class="w-full rounded border border-gray-300 px-3 py-2 text-sm" placeholder="템플릿 내용이 자동으로 채워집니다. 필요 시 수정하세요."></textarea>
      <button type="button" id="sr-sms-send-btn" class="rounded border border-navy-700 bg-white px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-navy-50">문자 발송</button>
    </div>`,
  );
  renderSmsTemplatePreview(true);
  bindSmsSendActions();
  if (session.role === "ADMIN" && item.assigneeStaff?.tier === 1) {
    const phoneEl = document.getElementById("sr-sms-phone");
    const nameEl = document.getElementById("sr-sms-recipient-name");
    if (phoneEl && !phoneEl.value.trim() && item.assigneeStaff.phone) {
      phoneEl.value = item.assigneeStaff.phone;
    }
    if (nameEl && !nameEl.value.trim()) {
      nameEl.value = item.assigneeStaff.name ?? "";
    }
  }
  syncSmsCredentialFields(item, session, true);
  renderSmsTemplatePreview(true);
}

async function openCaseDetail(caseId) {
  if (srState.currentCase?.id !== caseId) {
    srState.tier2ActionPanel = null;
    srState.scrollToTier2Panel = false;
    srState.pendingTransferStaff = null;
    srState.transferEmailCheck = null;
    srState.transferReason = "";
    srState.historyExpanded = false;
    srState.tier2AssignSmsVisible = false;
  }
  const result = await srApiFetch(`/api/self-report/cases/${caseId}`);
  srState.currentCase = result.data;
  const item = srState.currentCase;
  const session = getSrSession();

  const processingPlanHtml =
    item.processingPlanDate || item.processingPlanContent
      ? `<div class="mt-2 rounded border border-blue-100 bg-blue-50 p-3 text-sm">
          <h4 class="font-semibold text-gray-900">처리계획</h4>
          <p class="mt-1"><strong>처리계획일:</strong> ${formatDateOnly(item.processingPlanDate)}</p>
          ${
            item.processingPlanContent
              ? `<p class="mt-1"><strong>처리계획 내용:</strong></p><p class="mt-1 whitespace-pre-wrap text-gray-700">${escapeHtml(item.processingPlanContent)}</p>`
              : ""
          }
        </div>`
      : "";

  const processingResultHtml = renderProcessingResultDisplayHtml(item, session);
  const priorCompletionHtml = renderPriorCompletionDisplayHtml(item, session);
  const intakeDisplayHtml = renderIntakeDisplayHtml(item);

  document.getElementById("sr-detail-title").textContent = `${item.receiptNumber} · ${item.title}`;
  const reporterPhoneHtml =
    session?.role === "ADMIN" && item.reporterPhone
      ? ` / ${escapeHtml(item.reporterPhone)}`
      : session?.role === "ADMIN"
        ? " / -"
        : "";
  document.getElementById("sr-detail-body").innerHTML = `
    <p><strong>상태:</strong> ${item.statusLabel ?? STATUS_LABELS[item.status]}</p>
    <p><strong>신고자:</strong> ${item.reporterName ?? "-"}${reporterPhoneHtml}</p>
    <p><strong>위치:</strong> ${item.location ?? "-"}</p>
    <p><strong>배정기관:</strong> ${item.institution?.name ?? "-"}</p>
    <p><strong>담당자 1차:</strong> ${formatAssigneeLabel(item.tier1Assignee)}</p>
    <p><strong>담당자 2차:</strong> ${formatAssigneeLabel(item.tier2Assignee)}</p>
    <p><strong>지역본부:</strong> ${item.regionalHq ?? "-"}</p>
    ${intakeDisplayHtml}
    ${processingPlanHtml}
    ${processingResultHtml}
    ${priorCompletionHtml}
    <div class="rounded border border-gray-200 bg-gray-50 p-3 whitespace-pre-wrap">${item.content}</div>
    ${renderAttachmentsHtml(item.attachments, session)}
    ${renderCaseHistoryHtml(item.histories, srState.historyExpanded)}`;

  bindAttachmentPreview();
  bindAttachmentDeleteHandlers();
  bindCaseHistoryToggle();

  const actionsEl = document.getElementById("sr-detail-actions");
  actionsEl.innerHTML = "";

  if (session?.role === "ADMIN") {
    await loadInstitutionsIfNeeded();
    if (item.institutionId) {
      await loadStaffForInstitution(item.institutionId);
    }
    if (item.assigneeStaff?.tier === 1) {
      const stored = loadStoredTier2AuthKey(item.id, item.assigneeStaff.id);
      srState.pendingTier1Staff = {
        caseId: item.id,
        staffId: item.assigneeStaff.id,
        name: item.assigneeStaff.name,
        email: stored?.email || item.assigneeStaff.email || "",
        authKey: stored?.authKey ?? srState.pendingTier1Staff?.authKey ?? null,
        isExisting: !stored?.authKey && !srState.pendingTier1Staff?.authKey,
      };
    } else if (srState.pendingTier1Staff?.caseId !== item.id) {
      srState.pendingTier1Staff = null;
      srState.adminTier1EmailCheck = null;
    }
    actionsEl.innerHTML = renderAdminAssignHtml(item);
  } else if (session?.role === "SELF_REPORT_TIER1") {
    if (FINAL_INTAKE_DECISIONS.includes(item.intakeDecision)) {
      srState.showPriorCompletionForm = false;
    }
    if (item.assigneeStaff?.tier === 2) {
      const stored = loadStoredTier2AuthKey(item.id, item.assigneeStaff.id);
      srState.pendingTier2Staff = {
        caseId: item.id,
        staffId: item.assigneeStaff.id,
        name: item.assigneeStaff.name,
        email: stored?.email || item.assigneeStaff.email || "",
        authKey: stored?.authKey ?? srState.pendingTier2Staff?.authKey ?? null,
        isExisting: !stored?.authKey && !srState.pendingTier2Staff?.authKey,
      };
    } else if (srState.pendingTier2Staff?.caseId !== item.id) {
      srState.pendingTier2Staff = null;
    }
    actionsEl.innerHTML = renderTier1ActionsHtml(item, session);
  } else if (session?.role === "SELF_REPORT_TIER2") {
    if (srState.pendingTransferStaff?.caseId !== item.id) {
      srState.pendingTransferStaff = null;
      srState.transferEmailCheck = null;
    }
    actionsEl.innerHTML = renderTier2ActionsHtml(item);
  }

  const tier1CanUseExtras =
    session?.role !== "SELF_REPORT_TIER1" ||
    (item.intakeDecision === "PROCESS" &&
      item.processingPath === "DIRECT_INPUT" &&
      !FINAL_INTAKE_DECISIONS.includes(item.intakeDecision));

  if (tier1CanUseExtras) {
    if (session?.role === "ADMIN") {
      await appendSmsSendSection(session, item);
    } else if (session?.role === "SELF_REPORT_TIER1") {
      await loadSmsTemplatesIfNeeded();
    }

    const showAttachments =
      session?.role !== "SELF_REPORT_TIER2" ||
      srState.tier2ActionPanel === "PLAN" ||
      srState.tier2ActionPanel === "RESULT" ||
      srState.tier2ActionPanel === "UNPROCESSABLE" ||
      srState.tier2ActionPanel === "PRIOR";
    if (showAttachments) {
      actionsEl.insertAdjacentHTML(
        "beforeend",
        `
      <div class="mt-4 space-y-2 border-t border-gray-200 pt-4">
        <label class="block text-xs font-semibold text-gray-700" for="sr-detail-files">첨부파일 추가</label>
        <input id="sr-detail-files" type="file" multiple class="block w-full text-sm text-gray-700 file:mr-3 file:rounded file:border-0 file:bg-navy-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-navy-800" />
        <p class="text-[11px] text-gray-500">저장 시 접수번호 일련번호_01, _02 형식으로 파일명이 지정됩니다.</p>
        <button type="button" id="sr-detail-upload-btn" class="rounded border border-navy-700 bg-white px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-navy-50">첨부파일 업로드</button>
      </div>`,
      );
    }
  }

  document.getElementById("sr-detail-modal").classList.remove("hidden");
  document.getElementById("sr-detail-modal").classList.add("flex");
  bindDetailActions();
  bindAdminAssignActions();
  bindIntakeActions();
  bindProcessingPathActions();
  bindTier1StatusChangeActions();
  bindTier2StaffActions();
  bindTier2ActionActions();
  bindTier2TransferActions();

  if (srState.scrollToTier2Panel && srState.tier2ActionPanel) {
    srState.scrollToTier2Panel = false;
    scrollToTier2ActionPanel();
  }
}

function closeDetailModal() {
  document.getElementById("sr-detail-modal").classList.add("hidden");
  document.getElementById("sr-detail-modal").classList.remove("flex");
}

function bindIntakeActions() {
  const actionBtn = document.getElementById("sr-intake-action-btn");
  if (!actionBtn) return;

  const updateButtonLabel = () => {
    const selected = document.querySelector('input[name="sr-intake-decision"]:checked');
    actionBtn.textContent = selected?.value === "ALREADY_COMPLETED" ? "확정" : "확인";
  };

  document.querySelectorAll(".sr-intake-radio").forEach((radio) => {
    radio.addEventListener("change", updateButtonLabel);
  });
  updateButtonLabel();

  actionBtn.addEventListener("click", async () => {
    const selected = document.querySelector('input[name="sr-intake-decision"]:checked');
    if (!selected) return alert("접수 결정을 선택해 주세요.");

    if (selected.value === "ALREADY_COMPLETED") {
      srState.showPriorCompletionForm = true;
      await openCaseDetail(srState.currentCase.id);
      return;
    }

    try {
      const result = await srApiFetch(`/api/self-report/cases/${srState.currentCase.id}/intake-decision`, {
        method: "POST",
        body: { decision: selected.value },
      });
      srState.showPriorCompletionForm = false;
      alert(result.message ?? "접수 결정이 저장되었습니다.");
      await loadCases();
      await openCaseDetail(srState.currentCase.id);
    } catch (error) {
      alert(error.message ?? "접수 결정 저장에 실패했습니다.");
    }
  });

  document.getElementById("sr-submit-prior-btn")?.addEventListener("click", async () => {
    const priorCompletionDate = document.getElementById("sr-prior-date")?.value.trim() ?? "";
    const priorCompletionContent = document.getElementById("sr-prior-content")?.value.trim() ?? "";
    const fileInput = document.getElementById("sr-prior-files");
    try {
      let files;
      if (fileInput?.files?.length) {
        files = await readFilesForUpload(fileInput.files);
      }
      const result = await srApiFetch(`/api/self-report/cases/${srState.currentCase.id}/prior-completion`, {
        method: "POST",
        body: {
          priorCompletionDate: priorCompletionDate || undefined,
          priorCompletionContent: priorCompletionContent || undefined,
          files,
        },
      });
      srState.showPriorCompletionForm = false;
      alert(result.message ?? "기완료 처리 되었습니다.");
      await loadCases();
      await openCaseDetail(srState.currentCase.id);
    } catch (error) {
      alert(error.message ?? "기완료 처리에 실패했습니다.");
    }
  });
}

function bindProcessingPathActions() {
  document.getElementById("sr-processing-path-confirm-btn")?.addEventListener("click", async () => {
    const selected = document.querySelector('input[name="sr-processing-path"]:checked');
    if (!selected) return alert("처리 방법을 선택해 주세요.");
    try {
      const result = await srApiFetch(`/api/self-report/cases/${srState.currentCase.id}/processing-path`, {
        method: "POST",
        body: { path: selected.value },
      });
      alert(result.message ?? "처리 방법이 저장되었습니다.");
      await loadCases();
      await openCaseDetail(srState.currentCase.id);
    } catch (error) {
      alert(error.message ?? "처리 방법 저장에 실패했습니다.");
    }
  });
}

function bindTier2ActionActions() {
  document.getElementById("sr-tier2-action-confirm-btn")?.addEventListener("click", async () => {
    const selected = document.querySelector('input[name="sr-tier2-action"]:checked');
    if (!selected) return alert("처리 방법을 선택해 주세요.");
    srState.tier2ActionPanel = selected.value;
    if (selected.value !== "TRANSFER") {
      srState.pendingTransferStaff = null;
      srState.transferEmailCheck = null;
      srState.transferReason = "";
    }
    if (selected.value === "RESULT" && !hasProcessingPlan(srState.currentCase)) {
      return alert("먼저 처리계획을 등록해 주세요.");
    }
    srState.scrollToTier2Panel = true;
    await openCaseDetail(srState.currentCase.id);
  });

  document.getElementById("sr-tier2-submit-plan-btn")?.addEventListener("click", async () => {
    const processingPlanDate = document.getElementById("sr-tier2-plan-date")?.value.trim() ?? "";
    const processingPlanContent = document.getElementById("sr-tier2-plan-content")?.value.trim() ?? "";
    if (!processingPlanDate && !processingPlanContent) {
      return alert("처리계획일 또는 처리계획 내용을 입력해 주세요.");
    }
    try {
      const result = await srApiFetch(`/api/self-report/cases/${srState.currentCase.id}/processing-plan`, {
        method: "POST",
        body: { processingPlanDate: processingPlanDate || undefined, processingPlanContent },
      });
      alert(result.message ?? "처리계획을 저장했습니다.");
      srState.tier2ActionPanel = "PLAN";
      await loadCases();
      await openCaseDetail(srState.currentCase.id);
    } catch (error) {
      alert(error.message ?? "처리계획 저장에 실패했습니다.");
    }
  });

  document.getElementById("sr-tier2-submit-result-btn")?.addEventListener("click", async () => {
    const processingResultDate = document.getElementById("sr-tier2-result-date")?.value.trim() ?? "";
    const processingResultContent = document.getElementById("sr-tier2-result-content")?.value.trim() ?? "";
    const fileInput = document.getElementById("sr-tier2-result-files");
    try {
      let files;
      if (fileInput?.files?.length) {
        files = await readFilesForUpload(fileInput.files);
      }
      const result = await srApiFetch(`/api/self-report/cases/${srState.currentCase.id}/processing-result`, {
        method: "POST",
        body: {
          processingResultDate: processingResultDate || undefined,
          processingResultContent: processingResultContent || undefined,
          files,
        },
      });
      srState.tier2ActionPanel = null;
      alert(result.message ?? "처리결과를 저장했습니다.");
      await loadCases();
      await openCaseDetail(srState.currentCase.id);
    } catch (error) {
      alert(error.message ?? "처리결과 저장에 실패했습니다.");
    }
  });

  document.getElementById("sr-tier2-submit-prior-btn")?.addEventListener("click", async () => {
    const priorCompletionDate = document.getElementById("sr-tier2-prior-date")?.value.trim() ?? "";
    const priorCompletionContent = document.getElementById("sr-tier2-prior-content")?.value.trim() ?? "";
    if (!priorCompletionDate && !priorCompletionContent) {
      return alert("기처리 일자 또는 내용을 입력해 주세요.");
    }
    try {
      const result = await srApiFetch(`/api/self-report/cases/${srState.currentCase.id}/prior-completion`, {
        method: "POST",
        body: {
          priorCompletionDate: priorCompletionDate || undefined,
          priorCompletionContent: priorCompletionContent || undefined,
        },
      });
      srState.tier2ActionPanel = null;
      alert(result.message ?? "기처리 처리 되었습니다.");
      await loadCases();
      await openCaseDetail(srState.currentCase.id);
    } catch (error) {
      alert(error.message ?? "기처리 저장에 실패했습니다.");
    }
  });

  document.getElementById("sr-tier2-submit-unprocessable-btn")?.addEventListener("click", async () => {
    const reason = document.getElementById("sr-tier2-unprocessable-reason")?.value.trim() ?? "";
    if (!reason) return alert("처리불가 사유를 입력해 주세요.");
    if (!window.confirm("처리불가를 요청하고 1차 배정 담당자에게 문자를 발송합니다. 계속하시겠습니까?")) return;
    try {
      const result = await srApiFetch(`/api/self-report/cases/${srState.currentCase.id}/unprocessable-request`, {
        method: "POST",
        body: { reason },
      });
      srState.tier2ActionPanel = null;
      alert(result.message ?? "처리불가 요청을 등록했습니다.");
      await loadCases();
      await openCaseDetail(srState.currentCase.id);
    } catch (error) {
      alert(error.message ?? "처리불가 요청에 실패했습니다.");
    }
  });

  document.getElementById("sr-tier1-confirm-unprocessable-btn")?.addEventListener("click", async () => {
    if (!window.confirm("처리불가를 확정하고 보고자에게 안내 문자를 발송합니다. 계속하시겠습니까?")) return;
    try {
      const result = await srApiFetch(`/api/self-report/cases/${srState.currentCase.id}/unprocessable-confirm`, {
        method: "POST",
        body: {},
      });
      alert(result.message ?? "처리불가를 확정했습니다.");
      await loadCases();
      await openCaseDetail(srState.currentCase.id);
    } catch (error) {
      alert(error.message ?? "처리불가 확정에 실패했습니다.");
    }
  });
}

function resetTransferEmailCheckDom() {
  const authKeyEl = document.getElementById("sr-transfer-auth-key");
  const msgEl = document.getElementById("sr-transfer-email-check-msg");
  if (authKeyEl) {
    authKeyEl.value = "";
    authKeyEl.disabled = true;
    authKeyEl.classList.add("bg-gray-100");
    authKeyEl.placeholder = "이메일 중복확인 후 입력";
  }
  if (msgEl) {
    msgEl.textContent = "";
    msgEl.className = "hidden text-xs";
  }
}

function clearTransferEmailCheck() {
  srState.transferEmailCheck = null;
  resetTransferEmailCheckDom();
}

function applyTransferEmailCheckUI(check) {
  const authKeyEl = document.getElementById("sr-transfer-auth-key");
  const msgEl = document.getElementById("sr-transfer-email-check-msg");
  if (!authKeyEl || !msgEl) return;

  msgEl.classList.remove("hidden");
  if (check.status === "available") {
    authKeyEl.disabled = false;
    authKeyEl.classList.remove("bg-gray-100");
    authKeyEl.placeholder = "로그인 패스키";
    msgEl.textContent = check.message;
    msgEl.className = "text-xs text-green-700";
  } else if (check.status === "existing") {
    authKeyEl.disabled = true;
    authKeyEl.value = "";
    authKeyEl.classList.add("bg-gray-100");
    authKeyEl.placeholder = "기존 계정 — 패스키 변경 불가";
    msgEl.textContent = check.message;
    msgEl.className = "text-xs text-amber-700";
  }
}

function bindTier2TransferActions() {
  const emailInput = document.getElementById("sr-transfer-email");
  if (emailInput) {
    emailInput.addEventListener("input", clearTransferEmailCheck);
    if (srState.transferEmailCheck && emailInput.value.trim() === srState.transferEmailCheck.email) {
      applyTransferEmailCheckUI(srState.transferEmailCheck);
    } else {
      srState.transferEmailCheck = null;
      resetTransferEmailCheckDom();
    }
  }

  document.getElementById("sr-transfer-email-check-btn")?.addEventListener("click", async () => {
    const email = document.getElementById("sr-transfer-email")?.value.trim() ?? "";
    if (!email) return alert("이메일을 입력해 주세요.");
    try {
      const result = await srApiFetch("/api/self-report/tier2-staff/check-email", {
        method: "POST",
        body: { email },
      });
      const data = result.data;
      srState.transferEmailCheck = {
        email,
        status: data.status,
        message: data.message ?? result.message,
      };
      applyTransferEmailCheckUI(srState.transferEmailCheck);
      if (data.status === "existing" && data.name) {
        const nameEl = document.getElementById("sr-transfer-name");
        if (nameEl && !nameEl.value.trim()) nameEl.value = data.name;
      }
    } catch (error) {
      clearTransferEmailCheck();
      alert(error.message ?? "이메일 중복확인에 실패했습니다.");
    }
  });

  document.getElementById("sr-transfer-confirm-btn")?.addEventListener("click", async () => {
    const name = document.getElementById("sr-transfer-name")?.value.trim() ?? "";
    const email = document.getElementById("sr-transfer-email")?.value.trim() ?? "";
    const authKey = document.getElementById("sr-transfer-auth-key")?.value.trim() ?? "";
    const check = srState.transferEmailCheck;

    if (!name || !email) return alert("이름과 이메일을 입력해 주세요.");
    if (!check || check.email !== email) {
      return alert("이메일 중복확인을 먼저 해 주세요.");
    }
    if (check.status === "available" && !authKey) {
      return alert("패스키를 입력해 주세요.");
    }

    try {
      const body = { name, email };
      if (check.status === "available") body.authKey = authKey;

      const result = await srApiFetch("/api/self-report/tier2-staff", {
        method: "POST",
        body,
      });
      const data = result.data;

      const transferReason = getTransferReason();
      srState.transferReason = transferReason;

      srState.pendingTransferStaff = {
        caseId: srState.currentCase.id,
        staffId: data.staffId,
        name: data.name,
        email: data.email,
        authKey: data.isExisting ? null : authKey,
        isExisting: Boolean(data.isExisting),
        transferReason,
      };
      if (!data.isExisting && authKey) {
        saveStoredTier2AuthKey(srState.currentCase.id, data.staffId, data.email, authKey);
      }
      srState.transferEmailCheck = null;
      srState.transferSmsEdited = false;
      await openCaseDetail(srState.currentCase.id);
    } catch (error) {
      alert(error.message ?? "이첩 대상 등록에 실패했습니다.");
    }
  });

  if (document.getElementById("sr-transfer-sms-section")) {
    srState.transferSmsEdited = false;
    loadSmsTemplatesIfNeeded().then(() => renderTier2TransferSmsPreview(true));
  }

  document.getElementById("sr-transfer-reason")?.addEventListener("input", (e) => {
    srState.transferReason = e.target.value;
    if (srState.pendingTransferStaff) {
      srState.pendingTransferStaff = { ...srState.pendingTransferStaff, transferReason: e.target.value };
    }
    srState.transferSmsEdited = false;
    renderTier2TransferSmsPreview(false);
  });

  document.getElementById("sr-transfer-name")?.addEventListener("input", () => {
    const nameEl = document.getElementById("sr-transfer-sms-recipient-name");
    const typedName = document.getElementById("sr-transfer-name")?.value.trim() ?? "";
    if (nameEl && !nameEl.dataset.userEdited && typedName) {
      nameEl.value = typedName;
    }
    renderTier2TransferSmsPreview(false);
  });

  document.getElementById("sr-transfer-sms-message")?.addEventListener("input", () => {
    srState.transferSmsEdited = true;
  });

  const transferRecipientNameInput = document.getElementById("sr-transfer-sms-recipient-name");
  transferRecipientNameInput?.addEventListener("input", (e) => {
    e.target.dataset.userEdited = e.target.value.trim() ? "1" : "";
    renderTier2TransferSmsPreview();
  });

  ["sr-transfer-sms-email", "sr-transfer-sms-auth-key"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", () => {
      srState.transferSmsEdited = false;
      renderTier2TransferSmsPreview(false);
    });
  });

  document.getElementById("sr-transfer-sms-send-btn")?.addEventListener("click", async () => {
    const phone = document.getElementById("sr-transfer-sms-phone")?.value.trim() ?? "";
    const recipientName = document.getElementById("sr-transfer-sms-recipient-name")?.value.trim() ?? "";
    const message = document.getElementById("sr-transfer-sms-message")?.value.trim() ?? "";
    const creds = resolveTransferStaffCredentials(srState.currentCase);
    if (!phone) return alert("수신 연락처를 입력해 주세요.");
    if (!message) return alert("문자 내용을 입력해 주세요.");
    try {
      const result = await srApiFetch(`/api/self-report/cases/${srState.currentCase.id}/send-sms`, {
        method: "POST",
        body: {
          phone,
          recipientName: recipientName || undefined,
          templateType: "TIER2_TRANSFER",
          message,
          email: creds.email || undefined,
          authKey: creds.authKey || undefined,
          transferReason: getTransferReason() || undefined,
        },
      });
      document.getElementById("sr-transfer-sms-phone").value = "";
      srState.transferSmsEdited = false;
      renderTier2TransferSmsPreview(true);
      alert(result.message ?? "이첩알림 문자를 발송했습니다.");
    } catch (error) {
      alert(error.message ?? "문자 발송에 실패했습니다.");
    }
  });

  renderTier2TransferSmsPreview(true);

  document.getElementById("sr-transfer-execute-btn")?.addEventListener("click", async () => {
    const toStaffId = Number(
      document.getElementById("sr-transfer-staff-id")?.value || srState.pendingTransferStaff?.staffId,
    );
    const note = getTransferReason();
    if (!toStaffId) return alert("먼저 이첩 대상 정보를 입력하고 확인을 눌러 주세요.");
    try {
      await srApiFetch(`/api/self-report/cases/${srState.currentCase.id}/transfer-tier2`, {
        method: "POST",
        body: { toStaffId, note },
      });
      srState.pendingTransferStaff = null;
      srState.tier2ActionPanel = null;
      srState.transferReason = "";
      alert("이첩했습니다.");
      closeDetailModal();
      await loadCases();
    } catch (error) {
      alert(error.message ?? "이첩에 실패했습니다.");
    }
  });
}

function bindTier1StatusChangeActions() {
  const toggleBtn = document.getElementById("sr-tier1-status-change-btn");
  const panel = document.getElementById("sr-tier1-status-change-panel");
  if (!toggleBtn || !panel) return;

  toggleBtn.addEventListener("click", () => {
    panel.classList.toggle("hidden");
  });

  document.getElementById("sr-tier1-status-change-confirm-btn")?.addEventListener("click", async () => {
    const selected = document.querySelector('input[name="sr-tier1-status-change"]:checked');
    if (!selected) return alert("상태변경 결정을 선택해 주세요.");

    const confirmMessages = {
      PROCESS: "1차 기관 최초 배정 상태로 되돌리고 접수부터 다시 진행합니다. 계속하시겠습니까?",
      REASSIGN_TIER2: "현재 2차 담당 배정을 해제하고 다른 담당자를 다시 지정합니다. 계속하시겠습니까?",
      UNPROCESSABLE: "처리불가로 종결합니다. 계속하시겠습니까?",
      RETURN_TO_ADMIN: "관리자에게 이첩(반려)합니다. 계속하시겠습니까?",
    };
    if (!window.confirm(confirmMessages[selected.value] ?? "상태를 변경하시겠습니까?")) return;

    try {
      const result = await srApiFetch(`/api/self-report/cases/${srState.currentCase.id}/tier1-status-change`, {
        method: "POST",
        body: { decision: selected.value },
      });
      srState.pendingTier2Staff = null;
      srState.tier2EmailCheck = null;
      alert(result.message ?? "상태가 변경되었습니다.");
      await loadCases();
      await openCaseDetail(srState.currentCase.id);
    } catch (error) {
      alert(error.message ?? "상태 변경에 실패했습니다.");
    }
  });
}

function bindDetailActions() {
  document.getElementById("sr-submit-result-btn")?.addEventListener("click", async () => {
    const processingResultDate = document.getElementById("sr-result-date")?.value.trim() ?? "";
    const processingResultContent = document.getElementById("sr-result-content")?.value.trim() ?? "";
    const fileInput = document.getElementById("sr-result-files");
    try {
      let files;
      if (fileInput?.files?.length) {
        files = await readFilesForUpload(fileInput.files);
      }
      await srApiFetch(`/api/self-report/cases/${srState.currentCase.id}/processing-result`, {
        method: "POST",
        body: {
          processingResultDate: processingResultDate || undefined,
          processingResultContent: processingResultContent || undefined,
          files,
        },
      });
      alert("조치결과를 저장했습니다.");
      await loadCases();
      await openCaseDetail(srState.currentCase.id);
    } catch (error) {
      alert(error.message ?? "조치결과 저장에 실패했습니다.");
    }
  });

  document.getElementById("sr-submit-plan-btn")?.addEventListener("click", async () => {
    const processingPlanDate = document.getElementById("sr-direct-plan-date")?.value.trim() ?? "";
    const processingPlanContent = document.getElementById("sr-direct-plan-content")?.value.trim() ?? "";
    if (!processingPlanDate && !processingPlanContent) {
      return alert("조치계획일 또는 조치계획 내용을 입력해 주세요.");
    }
    try {
      const result = await srApiFetch(`/api/self-report/cases/${srState.currentCase.id}/processing-plan`, {
        method: "POST",
        body: {
          processingPlanDate: processingPlanDate || undefined,
          processingPlanContent: processingPlanContent || undefined,
        },
      });
      alert(result.message ?? "조치계획을 저장했습니다.");
      await loadCases();
      await openCaseDetail(srState.currentCase.id);
    } catch (error) {
      alert(error.message ?? "조치계획 저장에 실패했습니다.");
    }
  });

  document.getElementById("sr-detail-upload-btn")?.addEventListener("click", async () => {
    const fileInput = document.getElementById("sr-detail-files");
    if (!fileInput?.files?.length) {
      alert("업로드할 파일을 선택해 주세요.");
      return;
    }
    try {
      await uploadCaseAttachments(srState.currentCase.id, fileInput.files);
      fileInput.value = "";
      alert("첨부파일을 업로드했습니다.");
      await openCaseDetail(srState.currentCase.id);
    } catch (error) {
      alert(error.message ?? "업로드에 실패했습니다.");
    }
  });
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const errorEl = document.getElementById("sr-login-error");
  errorEl.classList.add("hidden");

  const email = document.getElementById("sr-email").value.trim();
  const password = document.getElementById("sr-auth-key").value;

  if (!email) {
    errorEl.textContent = "이메일을 입력해 주세요.";
    errorEl.classList.remove("hidden");
    return;
  }
  if (!password) {
    errorEl.textContent = "인증키를 입력해 주세요.";
    errorEl.classList.remove("hidden");
    return;
  }

  try {
    const result = await fetch("/api/self-report/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const payload = await result.json();
    if (!result.ok) throw new Error(payload.message ?? "로그인 실패");

    const session = payload.data.session;
    const label =
      session.role === "SELF_REPORT_TIER2"
        ? `${session.selfReportInstitutionName} · ${session.selfReportStaffName} (2차)`
        : `${session.selfReportInstitutionName} · ${session.selfReportStaffName ?? "1차"} (1차)`;

    saveSrSession({
      accessToken: payload.data.accessToken,
      role: session.role,
      institutionId: session.selfReportInstitutionId,
      institutionName: session.selfReportInstitutionName,
      staffId: session.selfReportStaffId,
      staffName: session.selfReportStaffName,
      email,
      regionalHq: null,
      label,
    });

    showDashboard();
    await loadCases();
  } catch (error) {
    errorEl.textContent = error.message ?? "로그인에 실패했습니다.";
    errorEl.classList.remove("hidden");
  }
}

function downloadSrCsv(filename, content) {
  const blob = new Blob(["\uFEFF", content ?? ""], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function downloadSelfReportSampleCsv() {
  const result = await srApiFetch("/api/self-report/cases/sample-csv");
  downloadSrCsv("self-report-cases-sample.csv", result.data);
}

function openBulkCsvModal() {
  document.getElementById("sr-bulk-csv-status").textContent = "";
  document.getElementById("sr-bulk-csv-file").value = "";
  document.getElementById("sr-bulk-csv-modal").classList.remove("hidden");
  document.getElementById("sr-bulk-csv-modal").classList.add("flex");
}

function closeBulkCsvModal() {
  document.getElementById("sr-bulk-csv-modal").classList.add("hidden");
  document.getElementById("sr-bulk-csv-modal").classList.remove("flex");
}

async function uploadSelfReportBulkCsv() {
  const fileInput = document.getElementById("sr-bulk-csv-file");
  const statusEl = document.getElementById("sr-bulk-csv-status");
  const file = fileInput?.files?.[0];
  if (!file) {
    statusEl.textContent = "CSV 파일을 선택해 주세요.";
    return;
  }
  statusEl.textContent = "업로드 중...";
  try {
    const csv = await file.text();
    const result = await srApiFetch("/api/self-report/cases/bulk-csv", {
      method: "POST",
      body: { csv },
    });
    statusEl.textContent = result.message ?? `${result.data?.created ?? 0}건 등록 완료`;
    alert(result.message ?? "보고를 일괄 등록했습니다.");
    closeBulkCsvModal();
    await loadCases();
  } catch (error) {
    statusEl.textContent = error.message ?? "업로드에 실패했습니다.";
    alert(error.message ?? "업로드에 실패했습니다.");
  }
}

function openBulkAttachmentsModal() {
  document.getElementById("sr-bulk-attachments-status").textContent = "";
  document.getElementById("sr-bulk-attachments-file").value = "";
  document.getElementById("sr-bulk-attachments-modal").classList.remove("hidden");
  document.getElementById("sr-bulk-attachments-modal").classList.add("flex");
}

function closeBulkAttachmentsModal() {
  document.getElementById("sr-bulk-attachments-modal").classList.add("hidden");
  document.getElementById("sr-bulk-attachments-modal").classList.remove("flex");
}

async function uploadSelfReportBulkAttachments() {
  const fileInput = document.getElementById("sr-bulk-attachments-file");
  const statusEl = document.getElementById("sr-bulk-attachments-status");
  if (!fileInput?.files?.length) {
    statusEl.textContent = "업로드할 파일을 선택해 주세요.";
    return;
  }
  statusEl.textContent = "업로드 중...";
  try {
    const files = await readFilesForUpload(fileInput.files);
    const result = await srApiFetch("/api/self-report/cases/bulk-attachments", {
      method: "POST",
      body: { files },
    });
    const data = result.data ?? {};
    const errorLines = (data.errors ?? [])
      .slice(0, 5)
      .map((item) => `${item.fileName}: ${item.reason}`)
      .join("\n");
    const extra = data.errors?.length > 5 ? `\n…외 ${data.errors.length - 5}건` : "";
    statusEl.textContent = result.message ?? "업로드 완료";
    alert(
      [result.message, errorLines ? `\n\n실패:\n${errorLines}${extra}` : ""].filter(Boolean).join(""),
    );
    if ((data.uploaded ?? 0) > 0) {
      closeBulkAttachmentsModal();
      await loadCases();
    }
  } catch (error) {
    statusEl.textContent = error.message ?? "업로드에 실패했습니다.";
    alert(error.message ?? "업로드에 실패했습니다.");
  }
}

function bindEvents() {
  document.getElementById("sr-login-form").addEventListener("submit", handleLoginSubmit);
  document.getElementById("sr-logout-btn").addEventListener("click", () => {
    const session = getSrSession();
    clearSelfReportSessionOnly();
    if (session?.fromPortal) {
      window.location.href = "/portal";
      return;
    }
    showLogin();
  });
  document.getElementById("sr-search-btn").addEventListener("click", () => {
    srState.listPage = 1;
    loadCases().catch((e) => alert(e.message));
  });
  document.getElementById("sr-search")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      srState.listPage = 1;
      loadCases().catch((e) => alert(e.message));
    }
  });
  document.getElementById("sr-status-filter")?.addEventListener("change", () => {
    srState.listPage = 1;
    loadCases().catch((e) => alert(e.message));
  });
  document.getElementById("sr-page-size")?.addEventListener("change", (event) => {
    srState.listPageSize = Number(event.target.value) || 15;
    srState.listPage = 1;
    loadCases().catch((e) => alert(e.message));
  });
  document.getElementById("sr-page-first")?.addEventListener("click", () => {
    loadCases(1).catch((e) => alert(e.message));
  });
  document.getElementById("sr-page-prev")?.addEventListener("click", () => {
    if (srState.listPage > 1) loadCases(srState.listPage - 1).catch((e) => alert(e.message));
  });
  document.getElementById("sr-page-next")?.addEventListener("click", () => {
    if (srState.listPage < srState.listTotalPages) {
      loadCases(srState.listPage + 1).catch((e) => alert(e.message));
    }
  });
  document.getElementById("sr-page-last")?.addEventListener("click", () => {
    loadCases(srState.listTotalPages).catch((e) => alert(e.message));
  });
  document.getElementById("sr-bulk-delete-btn")?.addEventListener("click", () => {
    deleteSelectedCases().catch((error) => alert(error.message ?? "삭제에 실패했습니다."));
  });
  document.getElementById("sr-select-all-cases")?.addEventListener("change", (event) => {
    const checked = event.target.checked;
    if (checked) {
      srState.cases.forEach((item) => srState.selectedCaseIds.add(item.id));
    } else {
      srState.cases.forEach((item) => srState.selectedCaseIds.delete(item.id));
    }
    renderCaseTable();
  });
  document.getElementById("sr-table-body").addEventListener("click", (event) => {
    const checkbox = event.target.closest(".sr-case-checkbox");
    if (checkbox) {
      const caseId = Number(checkbox.dataset.caseId);
      if (!caseId) return;
      if (checkbox.checked) srState.selectedCaseIds.add(caseId);
      else srState.selectedCaseIds.delete(caseId);
      syncCaseSelectAllCheckbox();
      return;
    }
    if (event.target.closest(".sr-case-select")) return;
    const row = event.target.closest("tr.sr-case-row");
    if (!row) return;
    openCaseDetail(Number(row.dataset.caseId)).catch((e) => alert(e.message));
  });
  document.getElementById("sr-detail-close").addEventListener("click", closeDetailModal);
  document.getElementById("sr-create-case-btn")?.addEventListener("click", () => {
    document.getElementById("sr-create-modal").classList.remove("hidden");
    document.getElementById("sr-create-modal").classList.add("flex");
  });
  document.getElementById("sr-download-sample-csv-btn")?.addEventListener("click", () => {
    downloadSelfReportSampleCsv().catch((error) => alert(error.message ?? "샘플 다운로드에 실패했습니다."));
  });
  document.getElementById("sr-bulk-csv-btn")?.addEventListener("click", openBulkCsvModal);
  document.getElementById("sr-bulk-csv-cancel")?.addEventListener("click", closeBulkCsvModal);
  document.getElementById("sr-bulk-csv-upload")?.addEventListener("click", () => {
    uploadSelfReportBulkCsv().catch((error) => alert(error.message ?? "업로드에 실패했습니다."));
  });
  document.getElementById("sr-bulk-attachments-btn")?.addEventListener("click", openBulkAttachmentsModal);
  document.getElementById("sr-bulk-attachments-cancel")?.addEventListener("click", closeBulkAttachmentsModal);
  document.getElementById("sr-bulk-attachments-upload")?.addEventListener("click", () => {
    uploadSelfReportBulkAttachments().catch((error) => alert(error.message ?? "업로드에 실패했습니다."));
  });
  document.getElementById("sr-create-cancel")?.addEventListener("click", () => {
    document.getElementById("sr-create-modal").classList.add("hidden");
    document.getElementById("sr-create-modal").classList.remove("flex");
  });
  document.getElementById("sr-create-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fileInput = document.getElementById("sr-create-files");
    const createResult = await srApiFetch("/api/self-report/cases", {
      method: "POST",
      body: {
        title: document.getElementById("sr-create-title").value.trim(),
        content: document.getElementById("sr-create-content").value.trim(),
        reporterName: document.getElementById("sr-create-reporter").value.trim(),
        reporterPhone: document.getElementById("sr-create-phone").value.trim(),
        location: document.getElementById("sr-create-location").value.trim(),
      },
    });
    const createdCase = createResult.data;
    if (fileInput?.files?.length && createdCase?.id) {
      await uploadCaseAttachments(createdCase.id, fileInput.files);
    }
    document.getElementById("sr-create-modal").classList.add("hidden");
    document.getElementById("sr-create-modal").classList.remove("flex");
    document.getElementById("sr-create-form").reset();
    await loadCases();
  });
}

async function initSelfReportDashboard() {
  loadPublicBranding().catch(() => {});
  bindEvents();

  if (getPortalBridgeSession()) {
    localStorage.removeItem(SR_SESSION_KEY);
  }

  await refreshPortalUserSafely();

  const session = getSrSession();
  if (session) {
    srState.session = session;
    showDashboard();
    try {
      await loadCases();
    } catch (error) {
      if (getPortalBridgeSession()) {
        alert(error.message ?? "보고 목록을 불러오지 못했습니다.");
      } else {
        clearSelfReportSessionOnly();
        showLogin();
      }
    }
    return;
  }

  showLogin();
}

document.addEventListener("DOMContentLoaded", initSelfReportDashboard);
