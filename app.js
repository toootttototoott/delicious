const state = {
  session: null,
  users: [],
  maskedUsers: [],
  userCount: 0,
  status: null,
};

const routes = new Map([
  ["/", renderLoginPage],
  ["/login", renderLoginPage],
  ["/settings", renderSettingsPage],
]);

document.addEventListener("click", (event) => {
  const link = event.target.closest("[data-link]");
  if (!link) {
    return;
  }

  event.preventDefault();
  navigate(link.getAttribute("href"));
});

window.addEventListener("popstate", () => {
  render();
});

document.addEventListener("submit", async (event) => {
  if (event.target.matches("[data-login-form]")) {
    event.preventDefault();
    await handleLogin(event.target);
  }

  if (event.target.matches("[data-user-form]")) {
    event.preventDefault();
    await handleUserCreate(event.target);
  }
});

document.addEventListener("click", async (event) => {
  if (event.target.matches("[data-logout]")) {
    await logout();
  }
});

async function boot() {
  await loadSession();
  if (location.pathname === "/") {
    history.replaceState({}, "", "/login");
  }
  render();
}

async function loadSession() {
  state.status = null;
  const response = await fetch("/api/session");
  const payload = await readApiResponse(response);
  state.session = payload.session;
  state.users = payload.users ?? [];
  state.maskedUsers = payload.maskedUsers ?? [];
  state.userCount = payload.userCount ?? 0;
}

function navigate(pathname) {
  history.pushState({}, "", pathname);
  render();
}

function setStatus(kind, message) {
  state.status = message ? { kind, message } : null;
  render();
}

function render() {
  if (
    location.pathname === "/settings" &&
    state.userCount > 0 &&
    state.session?.authLevel !== "admin"
  ) {
    history.replaceState({}, "", "/login");
    if (!state.status) {
      state.status = { kind: "error", message: "Admin access required to open settings." };
    }
  }

  const app = document.querySelector("#app");
  const topnav = document.querySelector(".topnav");
  const renderer = routes.get(location.pathname) ?? renderLoginPage;
  topnav.innerHTML = renderTopnav();
  app.innerHTML = renderer();
  hydrateStatus();
}

function renderTopnav() {
  const canViewSettings = state.userCount === 0 || state.session?.authLevel === "admin";

  return `
    <a href="/login" data-link>Display</a>
    ${canViewSettings ? '<a href="/settings" data-link>Settings</a>' : ""}
  `;
}

function hydrateStatus() {
  const statusNode = document.querySelector("[data-status]");
  if (!statusNode || !state.status) {
    return;
  }

  statusNode.textContent = state.status.message;
  statusNode.classList.add(state.status.kind);
}

function renderSessionSummary() {
  if (!state.session) {
    return `
      <p class="meta">No active session.</p>
    `;
  }

  return `
    <div class="stack">
      <div class="identity">
        Signed in as <strong>${escapeHtml(state.session.firstName)} ${escapeHtml(state.session.lastName)}</strong>
      </div>
      <p class="meta">${escapeHtml(state.session.email)} | ${escapeHtml(state.session.authLevel)}</p>
      <button type="button" class="ghost-button" data-logout>Sign out</button>
    </div>
  `;
}

function renderLoginPage() {
  return `
    <section class="layout">
      <article class="panel wide">
        <p class="eyebrow">Display page</p>
        <h2>Sign in</h2>
        <p class="meta">Use an email and password from a user created in settings.</p>
        <form class="stack" data-login-form>
          <div class="form-grid">
            <div class="field full">
              <label for="login-email">Email</label>
              <input id="login-email" name="email" type="email" autocomplete="username" required />
            </div>
            <div class="field full">
              <label for="login-password">Password</label>
              <input id="login-password" name="password" type="password" autocomplete="current-password" required />
            </div>
          </div>
          <div class="status" data-status></div>
          <button type="submit">Sign in</button>
        </form>
      </article>
      <aside class="panel side">
        <p class="eyebrow">Current user</p>
        <h3>Your details</h3>
        ${renderSessionSummary()}
      </aside>
    </section>
  `;
}

function renderSettingsPage() {
  const hasUsers = state.userCount > 0;
  const isAdmin = state.session?.authLevel === "admin";

  if (!hasUsers) {
    return `
      <section class="layout">
        <article class="panel wide">
          <p class="eyebrow">Settings page</p>
          <h2>Create the first admin</h2>
          <p class="meta">This is the one-time bootstrap step. After that, only admins can add users.</p>
          ${renderUserForm("Create admin", "admin", true)}
        </article>
        <aside class="panel side">
          <p class="eyebrow">Security</p>
          <h3>Encrypted storage</h3>
          <p class="meta">Names and email are encrypted before being written to Cockroach. Passwords are stored as password hashes, not as reversible text.</p>
        </aside>
      </section>
    `;
  }

  if (!state.session) {
    return `
      <section class="layout">
        <article class="panel wide">
          <p class="eyebrow">Settings page</p>
          <h2>Redirecting to login</h2>
          <p class="meta">Settings is restricted to admins.</p>
          <a class="button-primary" href="/login" data-link>Go to login</a>
        </aside>
      </section>
    `;
  }

  if (!isAdmin) {
    return `
      <section class="layout">
        <article class="panel wide">
          <p class="eyebrow">Settings page</p>
          <h2>Access denied</h2>
          <p class="meta">Only users with the admin auth level can add more users.</p>
        </article>
        <aside class="panel side">
          ${renderSessionSummary()}
        </aside>
      </section>
    `;
  }

  return `
    <section class="layout">
      <article class="panel wide">
        <p class="eyebrow">Settings page</p>
        <h2>Add a user</h2>
        <p class="meta">Create admins and standard users for the booking system.</p>
        ${renderUserForm("Create user", "user", false)}
      </article>
      <aside class="panel side stack">
        <div>
          <p class="eyebrow">Signed in</p>
          ${renderSessionSummary()}
        </div>
        <div>
          <p class="eyebrow">Users</p>
          <div class="users">
            ${renderUsers()}
          </div>
        </div>
      </aside>
    </section>
  `;
}

function renderUserForm(buttonLabel, defaultAuthLevel, lockAdminLevel) {
  return `
    <form class="stack" data-user-form>
      <div class="form-grid">
        <div class="field">
          <label for="firstName">First name</label>
          <input id="firstName" name="firstName" autocomplete="given-name" required />
        </div>
        <div class="field">
          <label for="lastName">Last name</label>
          <input id="lastName" name="lastName" autocomplete="family-name" required />
        </div>
        <div class="field full">
          <label for="email">Email</label>
          <input id="email" name="email" type="email" autocomplete="email" required />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="new-password" minlength="8" required />
        </div>
        <div class="field">
          <label for="authLevel">Auth level</label>
          <select id="authLevel" name="authLevel" ${lockAdminLevel ? "disabled" : ""}>
            <option value="admin" ${defaultAuthLevel === "admin" ? "selected" : ""}>Admin</option>
            <option value="user" ${defaultAuthLevel === "user" ? "selected" : ""}>User</option>
          </select>
          ${lockAdminLevel ? '<input type="hidden" name="authLevel" value="admin" />' : ""}
        </div>
      </div>
      <div class="status" data-status></div>
      <button type="submit">${buttonLabel}</button>
    </form>
  `;
}

function renderUsers() {
  if (!state.users.length) {
    return '<div class="empty">No users yet.</div>';
  }

  return state.users
    .map(
      (user) => `
        <article class="user-card">
          <div>
            <strong>${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</strong>
            <p class="meta">${escapeHtml(user.email)}</p>
          </div>
          <span class="badge">${escapeHtml(user.authLevel)}</span>
        </article>
      `,
    )
    .join("");
}

function renderMaskedUsers() {
  if (!state.maskedUsers.length) {
    return '<div class="empty">No saved users detected yet.</div>';
  }

  return state.maskedUsers
    .map(
      (user) => `
        <article class="user-card">
          <div>
            <strong>${escapeHtml(user.name)}</strong>
            <p class="meta">${escapeHtml(user.email)}</p>
          </div>
          <span class="badge">${escapeHtml(user.authLevel)}</span>
        </article>
      `,
    )
    .join("");
}

async function handleLogin(form) {
  setStatus(null, null);
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await readApiResponse(response);

  if (!response.ok) {
    setStatus("error", data.error ?? "Unable to sign in.");
    return;
  }

  state.session = data.session;
  setStatus("success", "Signed in.");
  await refreshUsers();
}

async function handleUserCreate(form) {
  setStatus(null, null);
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  const response = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await readApiResponse(response);

  if (!response.ok) {
    setStatus("error", data.error ?? "Unable to create user.");
    return;
  }

  form.reset();
  const authSelect = form.querySelector("#authLevel");
  if (authSelect && !authSelect.disabled) {
    authSelect.value = "user";
  }

  await loadSession();
  setStatus("success", data.message ?? "User created.");
}

async function logout() {
  await fetch("/api/logout", { method: "POST" });
  await loadSession();
  setStatus("success", "Signed out.");
}

async function refreshUsers() {
  const response = await fetch("/api/session");
  const data = await readApiResponse(response);
  state.session = data.session;
  state.users = data.users ?? [];
  render();
}

async function readApiResponse(response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return {
    error: text || `Request failed with status ${response.status}.`,
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

boot().catch(() => {
  setStatus("error", "Unable to load the app.");
});
