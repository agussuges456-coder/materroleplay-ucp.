import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const config = window.UCP_CONFIG || {};
const validConfig = isConfigured(config.supabaseUrl, config.supabaseAnonKey);
const supabase = validConfig ? createClient(config.supabaseUrl, config.supabaseAnonKey) : null;

const elements = {
  authView: document.querySelector("#auth-view"),
  dashboardView: document.querySelector("#dashboard-view"),
  warning: document.querySelector("#config-warning"),
  registerForm: document.querySelector("#register-form"),
  loginForm: document.querySelector("#login-form"),
  registerMessage: document.querySelector("#register-message"),
  loginMessage: document.querySelector("#login-message"),
  logoutButton: document.querySelector("#logout-button"),
  accountUsername: document.querySelector("#account-username"),
  accountEmail: document.querySelector("#account-email"),
  accountStatus: document.querySelector("#account-status"),
  accountCreated: document.querySelector("#account-created")
};

if (!validConfig) {
  elements.warning.classList.remove("hidden");
  elements.registerForm.querySelector("button[type=submit]").disabled = true;
  elements.loginForm.querySelector("button[type=submit]").disabled = true;
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => switchPanel(tab.dataset.panel));
});

elements.registerForm.addEventListener("submit", handleRegister);
elements.loginForm.addEventListener("submit", handleLogin);
elements.logoutButton.addEventListener("click", async () => {
  if (supabase) await supabase.auth.signOut();
});

if (supabase) {
  supabase.auth.onAuthStateChange((_event, session) => {
    void renderSession(session);
  });
  supabase.auth.getSession().then(({ data: { session } }) => renderSession(session));
}

function isConfigured(url, key) {
  return typeof url === "string" && url.startsWith("https://") && !url.includes("YOUR_PROJECT") &&
    typeof key === "string" && key.length > 20 && !key.includes("YOUR_");
}

function switchPanel(panelName) {
  document.querySelectorAll(".tab").forEach((tab) => {
    const active = tab.dataset.panel === panelName;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  elements.registerForm.classList.toggle("active", panelName === "register");
  elements.loginForm.classList.toggle("active", panelName === "login");
  clearMessage(elements.registerMessage);
  clearMessage(elements.loginMessage);
}

async function handleRegister(event) {
  event.preventDefault();
  if (!supabase) return;

  const form = new FormData(elements.registerForm);
  const username = String(form.get("username") || "").trim().toLowerCase();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const confirm = String(form.get("confirm") || "");

  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    return showMessage(elements.registerMessage, "Username hanya boleh berisi huruf kecil, angka, dan underscore (3–24 karakter).", true);
  }
  if (password.length < 8) {
    return showMessage(elements.registerMessage, "Password harus memiliki minimal 8 karakter.", true);
  }
  if (password !== confirm) {
    return showMessage(elements.registerMessage, "Konfirmasi password tidak cocok.", true);
  }

  setFormBusy(elements.registerForm, true);
  clearMessage(elements.registerMessage);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } }
  });
  setFormBusy(elements.registerForm, false);

  if (error) return showMessage(elements.registerMessage, readableError(error), true);
  elements.registerForm.reset();
  if (data.session) {
    showMessage(elements.registerMessage, "Akun berhasil dibuat. Selamat datang!", false);
  } else {
    showMessage(elements.registerMessage, "Akun berhasil dibuat. Cek email untuk konfirmasi akun sebelum login.", false);
  }
}

async function handleLogin(event) {
  event.preventDefault();
  if (!supabase) return;

  const form = new FormData(elements.loginForm);
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");

  setFormBusy(elements.loginForm, true);
  clearMessage(elements.loginMessage);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  setFormBusy(elements.loginForm, false);

  if (error) return showMessage(elements.loginMessage, "Email atau password salah.", true);
  elements.loginForm.reset();
}

async function renderSession(session) {
  const loggedIn = Boolean(session);
  elements.authView.classList.toggle("hidden", loggedIn);
  elements.dashboardView.classList.toggle("hidden", !loggedIn);
  if (!session || !supabase) return;

  elements.accountEmail.textContent = session.user.email || "-";
  elements.accountUsername.textContent = session.user.user_metadata?.username || "-";
  elements.accountStatus.textContent = "Active";
  elements.accountCreated.textContent = formatDate(session.user.created_at);

  const { data: profile } = await supabase
    .from("profiles")
    .select("username,email,status,created_at")
    .eq("id", session.user.id)
    .single();

  if (profile) {
    elements.accountUsername.textContent = profile.username || elements.accountUsername.textContent;
    elements.accountEmail.textContent = profile.email || elements.accountEmail.textContent;
    elements.accountStatus.textContent = profile.status === "banned" ? "Banned" : "Active";
    elements.accountStatus.classList.toggle("status-active", profile.status !== "banned");
    elements.accountCreated.textContent = formatDate(profile.created_at);
  }
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(value));
}

function setFormBusy(form, busy) {
  form.querySelectorAll("input, button").forEach((control) => { control.disabled = busy; });
}

function showMessage(target, message, error) {
  target.textContent = message;
  target.classList.toggle("error", error);
  target.classList.toggle("success", !error);
}

function clearMessage(target) {
  target.textContent = "";
  target.classList.remove("error", "success");
}

function readableError(error) {
  if (error?.message?.toLowerCase().includes("already registered")) return "Email tersebut sudah terdaftar.";
  return error?.message || "Pendaftaran gagal. Coba lagi.";
}
