let srAdminInstitutions = [];
let srAdminSelectedInstitutionId = null;
let srAdminStaffEmailCheck = null;

async function loadSelfReportAdminTab() {
  await loadSelfReportInstitutions();
  bindSelfReportAdminEvents();
}

async function loadSelfReportInstitutions() {
  const result = await apiFetch("/api/admin/self-report/institutions", { auth: true });
  srAdminInstitutions = result.data ?? [];
  renderSelfReportInstitutions();
}

function renderSelfReportInstitutions() {
  const tbody = document.getElementById("sr-admin-institutions-body");
  if (!tbody) return;
  tbody.innerHTML = srAdminInstitutions
    .map(
      (item) => `
    <tr>
      <td class="px-3 py-2">${item.name}</td>
      <td class="px-3 py-2 font-mono text-xs">${item.code}</td>
      <td class="px-3 py-2">${item.regionalHq ?? "-"}</td>
      <td class="px-3 py-2">${item.enabled ? "사용" : "중지"}</td>
      <td class="px-3 py-2">
        <button type="button" data-inst-id="${item.id}" class="sr-admin-staff-btn rounded border px-2 py-1 text-xs">담당 관리</button>
        <button type="button" data-inst-edit="${item.id}" class="sr-admin-edit-btn rounded border px-2 py-1 text-xs">수정</button>
        <button type="button" data-inst-del="${item.id}" class="sr-admin-del-btn rounded border px-2 py-1 text-xs text-red-600">삭제</button>
      </td>
    </tr>`,
    )
    .join("");
}

function resetSrAdminStaffEmailCheckDom() {
  const authKeyEl = document.getElementById("sr-admin-staff-auth-key");
  const msgEl = document.getElementById("sr-admin-staff-email-check-msg");
  if (authKeyEl) {
    authKeyEl.value = "";
    authKeyEl.disabled = true;
    authKeyEl.classList.add("bg-gray-100");
    authKeyEl.placeholder = "이메일 중복확인 후 패스키 입력";
  }
  if (msgEl) {
    msgEl.textContent = "";
    msgEl.className = "hidden text-xs";
  }
}

function clearSrAdminStaffEmailCheck() {
  srAdminStaffEmailCheck = null;
  resetSrAdminStaffEmailCheckDom();
}

function applySrAdminStaffEmailCheckUI(check) {
  const authKeyEl = document.getElementById("sr-admin-staff-auth-key");
  const msgEl = document.getElementById("sr-admin-staff-email-check-msg");
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

async function loadSelfReportStaff(institutionId) {
  srAdminSelectedInstitutionId = institutionId;
  clearSrAdminStaffEmailCheck();
  const result = await apiFetch(`/api/admin/self-report/institutions/${institutionId}/staff`, { auth: true });
  const staff = result.data ?? [];
  const inst = srAdminInstitutions.find((i) => i.id === institutionId);
  document.getElementById("sr-admin-staff-title").textContent = `${inst?.name ?? ""} 담당자`;
  document.getElementById("sr-admin-staff-panel").classList.remove("hidden");
  document.getElementById("sr-admin-staff-body").innerHTML = staff
    .map(
      (s) => `
    <tr>
      <td class="px-3 py-2">${s.tier === 1 ? "1차" : "2차"}</td>
      <td class="px-3 py-2">${s.name}</td>
      <td class="px-3 py-2">${s.phone ?? "-"}</td>
      <td class="px-3 py-2">${s.email ?? "-"}</td>
      <td class="px-3 py-2">${s.enabled ? "사용" : "중지"}</td>
      <td class="px-3 py-2">
        <button type="button" data-staff-del="${s.id}" class="sr-admin-staff-del rounded border px-2 py-1 text-xs text-red-600">삭제</button>
      </td>
    </tr>`,
    )
    .join("");
}

async function sendSrAdminStaffAccessSms({ phone, email, authKey, tier }) {
  return apiFetch(`/api/admin/self-report/institutions/${srAdminSelectedInstitutionId}/staff/send-account-sms`, {
    auth: true,
    method: "POST",
    body: { phone, email, authKey, tier },
  });
}

function bindSelfReportAdminEvents() {
  document.getElementById("sr-admin-create-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await apiFetch("/api/admin/self-report/institutions", {
      auth: true,
      method: "POST",
      body: {
        name: document.getElementById("sr-admin-name").value.trim(),
        regionalHq: document.getElementById("sr-admin-regional").value.trim(),
      },
    });
    document.getElementById("sr-admin-create-form").reset();
    await loadSelfReportInstitutions();
    alert("기관을 등록했습니다.");
  });

  document.getElementById("sr-admin-institutions-body")?.addEventListener("click", async (event) => {
    const staffBtn = event.target.closest(".sr-admin-staff-btn");
    if (staffBtn) {
      await loadSelfReportStaff(Number(staffBtn.dataset.instId));
      return;
    }
    const delBtn = event.target.closest(".sr-admin-del-btn");
    if (delBtn) {
      if (!window.confirm("기관을 삭제하시겠습니까?")) return;
      await apiFetch(`/api/admin/self-report/institutions/${delBtn.dataset.instDel}`, {
        auth: true,
        method: "DELETE",
      });
      await loadSelfReportInstitutions();
      return;
    }
    const editBtn = event.target.closest(".sr-admin-edit-btn");
    if (editBtn) {
      const inst = srAdminInstitutions.find((i) => i.id === Number(editBtn.dataset.instEdit));
      if (!inst) return;
      const name = window.prompt("기관명", inst.name);
      if (name === null) return;
      const regionalHq = window.prompt("지역본부", inst.regionalHq ?? "");
      await apiFetch(`/api/admin/self-report/institutions/${inst.id}`, {
        auth: true,
        method: "PUT",
        body: { name, regionalHq: regionalHq ?? "" },
      });
      await loadSelfReportInstitutions();
    }
  });

  document.getElementById("sr-admin-staff-email")?.addEventListener("input", clearSrAdminStaffEmailCheck);
  document.getElementById("sr-admin-staff-tier")?.addEventListener("change", clearSrAdminStaffEmailCheck);

  document.getElementById("sr-admin-staff-email-check-btn")?.addEventListener("click", async () => {
    if (!srAdminSelectedInstitutionId) return;
    const email = document.getElementById("sr-admin-staff-email")?.value.trim() ?? "";
    const tier = Number(document.getElementById("sr-admin-staff-tier")?.value ?? 1);
    if (!email) return alert("이메일을 입력해 주세요.");
    try {
      const result = await apiFetch(
        `/api/admin/self-report/institutions/${srAdminSelectedInstitutionId}/staff/check-email`,
        { auth: true, method: "POST", body: { email, tier } },
      );
      const data = result.data;
      srAdminStaffEmailCheck = {
        email,
        tier,
        status: data.status,
        message: data.message ?? result.message,
      };
      applySrAdminStaffEmailCheckUI(srAdminStaffEmailCheck);
      if (data.status === "existing" && data.name) {
        const nameEl = document.getElementById("sr-admin-staff-name");
        if (nameEl && !nameEl.value.trim()) nameEl.value = data.name;
      }
    } catch (error) {
      clearSrAdminStaffEmailCheck();
      alert(error.message ?? "이메일 중복확인에 실패했습니다.");
    }
  });

  document.getElementById("sr-admin-staff-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!srAdminSelectedInstitutionId) return;

    const name = document.getElementById("sr-admin-staff-name").value.trim();
    const phone = document.getElementById("sr-admin-staff-phone").value.trim();
    const email = document.getElementById("sr-admin-staff-email").value.trim();
    const tier = Number(document.getElementById("sr-admin-staff-tier").value);
    const authKey = document.getElementById("sr-admin-staff-auth-key").value.trim();
    const check = srAdminStaffEmailCheck;

    if (!name || !email) return alert("이름과 이메일을 입력해 주세요.");
    if (!check || check.email !== email || check.tier !== tier) {
      return alert("이메일 중복확인을 먼저 해 주세요.");
    }
    if (check.status === "available" && !authKey) {
      return alert("패스키를 입력해 주세요.");
    }

    try {
      const body = { name, phone, email, tier };
      if (check.status === "available") body.authKey = authKey;

      const result = await apiFetch(`/api/admin/self-report/institutions/${srAdminSelectedInstitutionId}/staff`, {
        auth: true,
        method: "POST",
        body,
      });
      const data = result.data;

      document.getElementById("sr-admin-staff-form").reset();
      clearSrAdminStaffEmailCheck();
      await loadSelfReportStaff(srAdminSelectedInstitutionId);

      if (!data.isExisting && authKey && phone) {
        if (window.confirm("접속안내 문자를 발송하시겠습니까?")) {
          try {
            const smsResult = await sendSrAdminStaffAccessSms({ phone, email, authKey, tier });
            alert(smsResult.message ?? "접속안내 문자를 발송했습니다.");
          } catch (smsError) {
            alert(smsError.message ?? "접속안내 문자 발송에 실패했습니다.");
          }
        } else {
          alert(result.message ?? "담당자를 등록했습니다.");
        }
      } else {
        alert(result.message ?? "담당자를 등록했습니다.");
      }
    } catch (error) {
      alert(error.message ?? "담당자 등록에 실패했습니다.");
    }
  });

  document.getElementById("sr-admin-staff-body")?.addEventListener("click", async (event) => {
    const delBtn = event.target.closest(".sr-admin-staff-del");
    if (!delBtn || !srAdminSelectedInstitutionId) return;
    if (!window.confirm("담당자를 삭제하시겠습니까?")) return;
    await apiFetch(
      `/api/admin/self-report/institutions/${srAdminSelectedInstitutionId}/staff/${delBtn.dataset.staffDel}`,
      { auth: true, method: "DELETE" },
    );
    await loadSelfReportStaff(srAdminSelectedInstitutionId);
  });
}
