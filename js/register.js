let emailVerified = false;
let verifiedEmail = "";

function setEmailStatus(message, type) {
  const el = document.getElementById("reg-email-status");
  if (!el) return;
  el.textContent = message;
  el.classList.remove("hidden", "text-green-700", "text-red-600", "text-gray-500");
  if (type === "success") el.classList.add("text-green-700");
  else if (type === "error") el.classList.add("text-red-600");
  else el.classList.add("text-gray-500");
}

function resetEmailVerification() {
  emailVerified = false;
  verifiedEmail = "";
}

function initRegisterPage() {
  const form = document.getElementById("register-form");
  const emailInput = document.getElementById("reg-email");
  const checkBtn = document.getElementById("reg-check-email-btn");
  const errorEl = document.getElementById("register-error");
  const successEl = document.getElementById("register-success");
  const submitBtn = document.getElementById("register-submit");

  emailInput?.addEventListener("input", () => {
    const current = emailInput.value.trim().toLowerCase();
    if (current !== verifiedEmail) {
      resetEmailVerification();
      setEmailStatus("", "muted");
      document.getElementById("reg-email-status")?.classList.add("hidden");
    }
  });

  checkBtn?.addEventListener("click", async () => {
    const email = emailInput?.value.trim().toLowerCase();
    if (!email) {
      setEmailStatus("이메일을 입력해 주세요.", "error");
      return;
    }

    checkBtn.disabled = true;
    checkBtn.textContent = "확인 중...";

    try {
      const result = await apiFetch(`/api/auth/check-email?email=${encodeURIComponent(email)}`);
      if (result.data?.available) {
        emailVerified = true;
        verifiedEmail = email;
        setEmailStatus(result.data.message || "사용 가능한 이메일입니다.", "success");
      } else {
        resetEmailVerification();
        setEmailStatus(result.data?.message || "사용할 수 없는 이메일입니다.", "error");
      }
    } catch (error) {
      resetEmailVerification();
      setEmailStatus(error.message || "중복 확인에 실패했습니다.", "error");
    } finally {
      checkBtn.disabled = false;
      checkBtn.textContent = "중복확인";
    }
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEl?.classList.add("hidden");
    successEl?.classList.add("hidden");

    const email = emailInput?.value.trim().toLowerCase();
    const affiliation = document.getElementById("reg-affiliation")?.value.trim();
    const name = document.getElementById("reg-name")?.value.trim();
    const password = document.getElementById("reg-password")?.value ?? "";
    const passwordConfirm = document.getElementById("reg-password-confirm")?.value ?? "";

    if (!emailVerified || email !== verifiedEmail) {
      if (errorEl) {
        errorEl.textContent = "이메일 중복확인을 완료해 주세요.";
        errorEl.classList.remove("hidden");
      }
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "신청 중...";

    try {
      await apiFetch("/api/auth/registration-request", {
        method: "POST",
        body: { email, affiliation, name, password, passwordConfirm },
      });

      if (successEl) {
        successEl.textContent = "신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.";
        successEl.classList.remove("hidden");
      }
      form.reset();
      resetEmailVerification();
      document.getElementById("reg-email-status")?.classList.add("hidden");
    } catch (error) {
      if (errorEl) {
        errorEl.textContent = error.message || "신청에 실패했습니다.";
        errorEl.classList.remove("hidden");
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "신청하기";
    }
  });
}
