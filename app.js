const state = {
  session: null,
  users: [],
  companies: [],
  userCount: 0,
  statuses: {
    auth: null,
    users: null,
    companies: null,
  },
  filters: {
    users: "",
    companies: "",
  },
  selectedUserIds: new Set(),
  selectedCompanyIds: new Set(),
  selectedEstablishmentIds: new Set(),
  selectedSeatCountIds: new Set(),
  userForm: createEmptyUserForm(),
  companyForm: createEmptyCompanyForm(),
};

const routes = new Map([
  ["/", renderLoginPage],
  ["/login", renderLoginPage],
  ["/settings", renderSettingsPage],
]);

document.addEventListener("click", (event) => {
  const link = event.target.closest("[data-link]");
  if (link) {
    event.preventDefault();
    navigate(link.getAttribute("href"));
    return;
  }

  const button = event.target.closest("[data-action]");
  if (!button) {
    return;
  }

  event.preventDefault();
  handleAction(button.dataset.action, button.dataset).catch(() => {});
});

window.addEventListener("popstate", () => {
  render();
});

document.addEventListener("submit", async (event) => {
  if (event.target.matches("[data-login-form]")) {
    event.preventDefault();
    await handleLogin(event.target);
    return;
  }

  if (event.target.matches("[data-user-form]")) {
    event.preventDefault();
    await handleUserSubmit(event.target);
    return;
  }

  if (event.target.matches("[data-company-form]")) {
    event.preventDefault();
    await handleCompanySubmit(event.target);
  }
});

document.addEventListener("input", (event) => {
  if (event.target.matches("[data-user-search]")) {
    state.filters.users = event.target.value;
    render();
    return;
  }

  if (event.target.matches("[data-company-search]")) {
    state.filters.companies = event.target.value;
    render();
  }
});

document.addEventListener("change", (event) => {
  if (event.target.matches("[data-user-select]")) {
    toggleSelection(state.selectedUserIds, event.target.value, event.target.checked);
    render();
    return;
  }

  if (event.target.matches("[data-company-select]")) {
    toggleSelection(state.selectedCompanyIds, event.target.value, event.target.checked);
    render();
    return;
  }

  if (event.target.matches("[data-establishment-select]")) {
    toggleSelection(state.selectedEstablishmentIds, event.target.value, event.target.checked);
    render();
    return;
  }

  if (event.target.matches("[data-seat-count-select]")) {
    toggleSelection(state.selectedSeatCountIds, event.target.value, event.target.checked);
    render();
    return;
  }

  if (event.target.matches("[data-user-select-all]")) {
    setVisibleSelection("users", event.target.checked);
    render();
    return;
  }

  if (event.target.matches("[data-company-select-all]")) {
    setVisibleSelection("companies", event.target.checked);
    render();
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
  const response = await fetch("/api/session");
  const payload = await readApiResponse(response);
  state.session = payload.session;
  state.users = payload.users ?? [];
  state.companies = payload.companies ?? [];
  state.userCount = Number(payload.userCount ?? 0);
  pruneSelections();
}

function navigate(pathname) {
  history.pushState({}, "", pathname);
  render();
}

function render() {
  if (
    location.pathname === "/settings" &&
    state.userCount > 0 &&
    state.session?.authLevel !== "admin"
  ) {
    history.replaceState({}, "", "/login");
    if (!state.statuses.auth) {
      state.statuses.auth = { kind: "error", message: "Admin access required to open settings." };
    }
  }

  const app = document.querySelector("#app");
  const topnav = document.querySelector(".topnav");
  topnav.innerHTML = renderTopnav();
  app.innerHTML = (routes.get(location.pathname) ?? renderLoginPage)();
}

function renderTopnav() {
  const canViewSettings = state.userCount === 0 || state.session?.authLevel === "admin";
  return `
    <a href="/login" data-link>Display</a>
    ${canViewSettings ? '<a href="/settings" data-link>Settings</a>' : ""}
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
          ${renderStatus("auth")}
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
          <p class="meta">This is the one-time bootstrap step. After that, only admins can access settings.</p>
          ${renderUserForm(true)}
          ${renderStatus("users")}
        </article>
        <aside class="panel side">
          <p class="eyebrow">Security</p>
          <h3>Encrypted storage</h3>
          <p class="meta">Names and email are encrypted before being written to Cockroach. Passwords are stored as password hashes, not as reversible text.</p>
        </aside>
      </section>
    `;
  }

  if (!isAdmin) {
    return `
      <section class="layout">
        <article class="panel wide">
          <p class="eyebrow">Settings page</p>
          <h2>Admin only</h2>
          <p class="meta">Settings is restricted to admins.</p>
          <a class="button-primary" href="/login" data-link>Go to login</a>
        </article>
      </section>
    `;
  }

  return `
    <section class="layout">
      <article class="panel full-width">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Admin session</p>
            <h2>Settings</h2>
            <p class="meta">Manage users, companies, establishments, and seat counts.</p>
          </div>
          <div class="stack-inline">
            ${renderSessionSummary(true)}
          </div>
        </div>
      </article>
      <article class="panel admin-panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Users panel</p>
            <h3>${state.userForm.mode === "edit" ? "Edit user" : "Create user"}</h3>
          </div>
          <span class="badge">${state.users.length} users</span>
        </div>
        ${renderUserForm(false)}
        <div class="list-toolbar">
          <input
            type="search"
            placeholder="Search users, emails, auth, company"
            value="${escapeHtml(state.filters.users)}"
            data-user-search
          />
          <button type="button" class="ghost-button" data-action="bulkDeleteUsers">
            Delete selected (${state.selectedUserIds.size})
          </button>
        </div>
        ${renderStatus("users")}
        <div class="list-header">
          <label class="checkbox">
            <input
              type="checkbox"
              data-user-select-all
              ${areAllVisibleSelected("users") ? "checked" : ""}
            />
            <span>Select visible</span>
          </label>
        </div>
        <div class="users">${renderUsers()}</div>
      </article>
      <article class="panel admin-panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Companies panel</p>
            <h3>${state.companyForm.mode === "edit" ? "Edit company" : "Create company"}</h3>
          </div>
          <span class="badge">${state.companies.length} companies</span>
        </div>
        ${renderCompanyForm()}
        <div class="list-toolbar">
          <input
            type="search"
            placeholder="Search companies, establishments, seat counts"
            value="${escapeHtml(state.filters.companies)}"
            data-company-search
          />
          <button type="button" class="ghost-button" data-action="bulkDeleteCompanies">
            Delete selected (${state.selectedCompanyIds.size})
          </button>
          <button type="button" class="ghost-button" data-action="bulkDeleteEstablishments">
            Delete establishments (${state.selectedEstablishmentIds.size})
          </button>
          <button type="button" class="ghost-button" data-action="bulkDeleteSeatCounts">
            Delete seat counts (${state.selectedSeatCountIds.size})
          </button>
        </div>
        ${renderStatus("companies")}
        <div class="list-header">
          <label class="checkbox">
            <input
              type="checkbox"
              data-company-select-all
              ${areAllVisibleSelected("companies") ? "checked" : ""}
            />
            <span>Select visible</span>
          </label>
        </div>
        <div class="company-list">${renderCompanies()}</div>
      </article>
    </section>
  `;
}

function renderSessionSummary(compact = false) {
  if (!state.session) {
    return `<p class="meta">No active session.</p>`;
  }

  if (compact) {
    return `
      <div class="identity-card">
        <div class="identity">
          ${escapeHtml(state.session.firstName)} ${escapeHtml(state.session.lastName)}
        </div>
        <p class="meta">${escapeHtml(state.session.email)} | ${escapeHtml(state.session.authLevel)}</p>
        <button type="button" class="ghost-button" data-action="logout">Sign out</button>
      </div>
    `;
  }

  return `
    <div class="stack">
      <div class="identity">
        Signed in as <strong>${escapeHtml(state.session.firstName)} ${escapeHtml(state.session.lastName)}</strong>
      </div>
      <p class="meta">${escapeHtml(state.session.email)} | ${escapeHtml(state.session.authLevel)}</p>
      <button type="button" class="ghost-button" data-action="logout">Sign out</button>
    </div>
  `;
}

function renderUserForm(lockAdminLevel) {
  const companyOptions = [
    '<option value="">No company</option>',
    ...state.companies.map(
      (company) => `
        <option value="${company.id}" ${state.userForm.companyId === company.id ? "selected" : ""}>
          ${escapeHtml(company.name)}
        </option>
      `,
    ),
  ].join("");

  return `
    <form class="stack" data-user-form>
      <div class="form-grid">
        <div class="field">
          <label for="firstName">First name</label>
          <input id="firstName" name="firstName" value="${escapeHtml(state.userForm.firstName)}" autocomplete="given-name" required />
        </div>
        <div class="field">
          <label for="lastName">Last name</label>
          <input id="lastName" name="lastName" value="${escapeHtml(state.userForm.lastName)}" autocomplete="family-name" required />
        </div>
        <div class="field full">
          <label for="email">Email</label>
          <input id="email" name="email" value="${escapeHtml(state.userForm.email)}" type="email" autocomplete="email" required />
        </div>
        <div class="field">
          <label for="password">${state.userForm.mode === "edit" ? "New password (optional)" : "Password"}</label>
          <input id="password" name="password" type="password" autocomplete="new-password" ${state.userForm.mode === "create" ? 'minlength="8" required' : 'minlength="8"'} />
        </div>
        <div class="field">
          <label for="authLevel">Auth level</label>
          <select id="authLevel" name="authLevel" ${lockAdminLevel ? "disabled" : ""}>
            <option value="admin" ${state.userForm.authLevel === "admin" ? "selected" : ""}>Admin</option>
            <option value="user" ${state.userForm.authLevel === "user" ? "selected" : ""}>User</option>
          </select>
          ${lockAdminLevel ? '<input type="hidden" name="authLevel" value="admin" />' : ""}
        </div>
        <div class="field full">
          <label for="companyId">Company</label>
          <select id="companyId" name="companyId">${companyOptions}</select>
        </div>
      </div>
      <div class="stack-inline">
        <button type="submit">${state.userForm.mode === "edit" ? "Save user" : lockAdminLevel ? "Create admin" : "Create user"}</button>
        ${
          state.userForm.mode === "edit"
            ? '<button type="button" class="ghost-button" data-action="cancelUserEdit">Cancel</button>'
            : ""
        }
      </div>
    </form>
  `;
}

function renderCompanyForm() {
  return `
    <form class="stack" data-company-form>
      <div class="field">
        <label for="company-name">Company name</label>
        <input id="company-name" name="name" value="${escapeHtml(state.companyForm.name)}" required />
      </div>
      <div class="stack-inline">
        <button type="submit">${state.companyForm.mode === "edit" ? "Save company" : "Create company"}</button>
        ${
          state.companyForm.mode === "edit"
            ? '<button type="button" class="ghost-button" data-action="cancelCompanyEdit">Cancel</button>'
            : ""
        }
      </div>
    </form>
  `;
}

function renderUsers() {
  const companiesById = new Map(state.companies.map((company) => [company.id, company.name]));
  const users = getFilteredUsers();

  if (!users.length) {
    return '<div class="empty">No users match the current search.</div>';
  }

  return users
    .map((user) => {
      const companyName = user.companyId ? companiesById.get(user.companyId) ?? "Unknown company" : "No company";
      return `
        <article class="entity-card">
          <label class="checkbox entity-select">
            <input
              type="checkbox"
              value="${user.id}"
              data-user-select
              ${state.selectedUserIds.has(user.id) ? "checked" : ""}
            />
            <span></span>
          </label>
          <div class="entity-body">
            <div class="entity-row">
              <div>
                <strong>${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</strong>
                <p class="meta">${escapeHtml(user.email)}</p>
                <p class="meta">${escapeHtml(user.authLevel)} | ${escapeHtml(companyName)}</p>
              </div>
              <div class="stack-inline">
                <button type="button" class="ghost-button" data-action="editUser" data-user-id="${user.id}">Edit</button>
                <button type="button" class="ghost-button" data-action="deleteUser" data-user-id="${user.id}">Delete</button>
              </div>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderCompanies() {
  const companies = getFilteredCompanies();

  if (!companies.length) {
    return '<div class="empty">No companies match the current search.</div>';
  }

  return companies
    .map((company) => {
      const linkedUsers = state.users.filter((user) => user.companyId === company.id);
      return `
        <article class="company-card">
          <div class="entity-row">
            <label class="checkbox entity-select">
              <input
                type="checkbox"
                value="${company.id}"
                data-company-select
                ${state.selectedCompanyIds.has(company.id) ? "checked" : ""}
              />
              <span></span>
            </label>
            <div class="entity-body">
              <strong>${escapeHtml(company.name)}</strong>
              <p class="meta">${linkedUsers.length} users | ${company.establishments.length} establishments</p>
            </div>
            <div class="stack-inline">
              <button type="button" class="ghost-button" data-action="editCompany" data-company-id="${company.id}">Edit</button>
              <button type="button" class="ghost-button" data-action="deleteCompany" data-company-id="${company.id}">Delete</button>
              <button type="button" class="ghost-button" data-action="addEstablishment" data-company-id="${company.id}">Add establishment</button>
            </div>
          </div>
          ${
            linkedUsers.length
              ? `<div class="subsection">
                  <p class="eyebrow">Users</p>
                  <div class="chip-row">${linkedUsers
                    .map((user) => `<span class="chip">${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</span>`)
                    .join("")}</div>
                </div>`
              : ""
          }
          <div class="subsection">
            <p class="eyebrow">Establishments</p>
            ${
              company.establishments.length
                ? company.establishments.map((establishment) => renderEstablishment(company, establishment)).join("")
                : '<div class="empty">No establishments yet.</div>'
            }
          </div>
        </article>
      `;
    })
    .join("");
}

function renderEstablishment(company, establishment) {
  return `
    <div class="nested-card">
      <div class="entity-row">
        <label class="checkbox entity-select">
          <input
            type="checkbox"
            value="${establishment.id}"
            data-establishment-select
            ${state.selectedEstablishmentIds.has(establishment.id) ? "checked" : ""}
          />
          <span></span>
        </label>
        <div class="entity-body">
          <strong>${escapeHtml(establishment.name)}</strong>
          <p class="meta">${escapeHtml(company.name)}</p>
        </div>
        <div class="stack-inline">
          <button
            type="button"
            class="ghost-button"
            data-action="editEstablishment"
            data-company-id="${company.id}"
            data-establishment-id="${establishment.id}"
          >Edit</button>
          <button
            type="button"
            class="ghost-button"
            data-action="deleteEstablishment"
            data-establishment-id="${establishment.id}"
          >Delete</button>
          <button
            type="button"
            class="ghost-button"
            data-action="addSeatCount"
            data-establishment-id="${establishment.id}"
          >Add seat count</button>
        </div>
      </div>
      <div class="chip-row">
        ${
          establishment.seatCounts.length
            ? establishment.seatCounts
                .map(
                  (seatCount) => `
                    <span class="chip chip-action">
                      <label class="checkbox compact-checkbox">
                        <input
                          type="checkbox"
                          value="${seatCount.id}"
                          data-seat-count-select
                          ${state.selectedSeatCountIds.has(seatCount.id) ? "checked" : ""}
                        />
                        <span></span>
                      </label>
                      ${seatCount.seatCount} seats
                      <button
                        type="button"
                        class="mini-button"
                        data-action="editSeatCount"
                        data-establishment-id="${establishment.id}"
                        data-seat-count-id="${seatCount.id}"
                        data-seat-count="${seatCount.seatCount}"
                      >Edit</button>
                      <button
                        type="button"
                        class="mini-button"
                        data-action="deleteSeatCount"
                        data-seat-count-id="${seatCount.id}"
                      >Delete</button>
                    </span>
                  `,
                )
                .join("")
            : '<span class="meta">No seat counts yet.</span>'
        }
      </div>
    </div>
  `;
}

async function handleAction(action, dataset) {
  if (action === "logout") {
    await logout();
    return;
  }

  if (action === "cancelUserEdit") {
    state.userForm = createEmptyUserForm();
    clearStatus("users");
    render();
    return;
  }

  if (action === "cancelCompanyEdit") {
    state.companyForm = createEmptyCompanyForm();
    clearStatus("companies");
    render();
    return;
  }

  if (action === "editUser") {
    const user = state.users.find((item) => item.id === dataset.userId);
    if (!user) {
      return;
    }

    state.userForm = {
      mode: "edit",
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      password: "",
      authLevel: user.authLevel,
      companyId: user.companyId ?? "",
    };
    clearStatus("users");
    render();
    return;
  }

  if (action === "deleteUser") {
    if (!confirm("Delete this user?")) {
      return;
    }

    await postJson("/api/users", { action: "delete", userId: dataset.userId }, "users");
    state.selectedUserIds.delete(dataset.userId);
    await refreshAdminState();
    setStatus("users", "success", "User deleted.");
    return;
  }

  if (action === "bulkDeleteUsers") {
    if (!state.selectedUserIds.size || !confirm("Delete the selected users?")) {
      return;
    }

    await postJson(
      "/api/users",
      { action: "bulkDelete", userIds: Array.from(state.selectedUserIds) },
      "users",
    );
    state.selectedUserIds.clear();
    await refreshAdminState();
    setStatus("users", "success", "Selected users deleted.");
    return;
  }

  if (action === "editCompany") {
    const company = state.companies.find((item) => item.id === dataset.companyId);
    if (!company) {
      return;
    }

    state.companyForm = {
      mode: "edit",
      companyId: company.id,
      name: company.name,
    };
    clearStatus("companies");
    render();
    return;
  }

  if (action === "deleteCompany") {
    if (!confirm("Delete this company and its establishments/seat counts?")) {
      return;
    }

    await postJson(
      "/api/companies",
      { action: "deleteCompany", companyId: dataset.companyId },
      "companies",
    );
    state.selectedCompanyIds.delete(dataset.companyId);
    await refreshAdminState();
    setStatus("companies", "success", "Company deleted.");
    return;
  }

  if (action === "bulkDeleteCompanies") {
    if (!state.selectedCompanyIds.size || !confirm("Delete the selected companies?")) {
      return;
    }

    await postJson(
      "/api/companies",
      { action: "bulkDeleteCompanies", companyIds: Array.from(state.selectedCompanyIds) },
      "companies",
    );
    state.selectedCompanyIds.clear();
    await refreshAdminState();
    setStatus("companies", "success", "Selected companies deleted.");
    return;
  }

  if (action === "bulkDeleteEstablishments") {
    if (!state.selectedEstablishmentIds.size || !confirm("Delete the selected establishments?")) {
      return;
    }

    await postJson(
      "/api/companies",
      {
        action: "bulkDeleteEstablishments",
        establishmentIds: Array.from(state.selectedEstablishmentIds),
      },
      "companies",
    );
    state.selectedEstablishmentIds.clear();
    await refreshAdminState();
    setStatus("companies", "success", "Selected establishments deleted.");
    return;
  }

  if (action === "bulkDeleteSeatCounts") {
    if (!state.selectedSeatCountIds.size || !confirm("Delete the selected seat counts?")) {
      return;
    }

    await postJson(
      "/api/companies",
      {
        action: "bulkDeleteSeatCounts",
        seatCountIds: Array.from(state.selectedSeatCountIds),
      },
      "companies",
    );
    state.selectedSeatCountIds.clear();
    await refreshAdminState();
    setStatus("companies", "success", "Selected seat counts deleted.");
    return;
  }

  if (action === "addEstablishment") {
    const name = prompt("Establishment name");
    if (!name) {
      return;
    }

    await postJson(
      "/api/companies",
      { action: "createEstablishment", companyId: dataset.companyId, name },
      "companies",
    );
    await refreshAdminState();
    setStatus("companies", "success", "Establishment created.");
    return;
  }

  if (action === "editEstablishment") {
    const company = state.companies.find((item) => item.id === dataset.companyId);
    const establishment = company?.establishments.find((item) => item.id === dataset.establishmentId);
    if (!establishment) {
      return;
    }

    const name = prompt("Establishment name", establishment.name);
    if (!name) {
      return;
    }

    await postJson(
      "/api/companies",
      {
        action: "updateEstablishment",
        establishmentId: dataset.establishmentId,
        companyId: dataset.companyId,
        name,
      },
      "companies",
    );
    await refreshAdminState();
    setStatus("companies", "success", "Establishment updated.");
    return;
  }

  if (action === "deleteEstablishment") {
    if (!confirm("Delete this establishment and its seat counts?")) {
      return;
    }

    await postJson(
      "/api/companies",
      { action: "deleteEstablishment", establishmentId: dataset.establishmentId },
      "companies",
    );
    state.selectedEstablishmentIds.delete(dataset.establishmentId);
    await refreshAdminState();
    setStatus("companies", "success", "Establishment deleted.");
    return;
  }

  if (action === "addSeatCount") {
    const seatCount = prompt("Seat count");
    if (!seatCount) {
      return;
    }

    await postJson(
      "/api/companies",
      { action: "createSeatCount", establishmentId: dataset.establishmentId, seatCount },
      "companies",
    );
    await refreshAdminState();
    setStatus("companies", "success", "Seat count created.");
    return;
  }

  if (action === "editSeatCount") {
    const seatCount = prompt("Seat count", dataset.seatCount);
    if (!seatCount) {
      return;
    }

    await postJson(
      "/api/companies",
      {
        action: "updateSeatCount",
        seatCountId: dataset.seatCountId,
        establishmentId: dataset.establishmentId,
        seatCount,
      },
      "companies",
    );
    await refreshAdminState();
    setStatus("companies", "success", "Seat count updated.");
    return;
  }

  if (action === "deleteSeatCount") {
    if (!confirm("Delete this seat count?")) {
      return;
    }

    await postJson(
      "/api/companies",
      { action: "deleteSeatCount", seatCountId: dataset.seatCountId },
      "companies",
    );
    state.selectedSeatCountIds.delete(dataset.seatCountId);
    await refreshAdminState();
    setStatus("companies", "success", "Seat count deleted.");
  }
}

async function handleLogin(form) {
  clearStatus("auth");
  const payload = Object.fromEntries(new FormData(form).entries());
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await readApiResponse(response);

  if (!response.ok) {
    setStatus("auth", "error", data.error ?? "Unable to sign in.");
    return;
  }

  state.session = data.session;
  await refreshAdminState();
  setStatus("auth", "success", "Signed in.");
}

async function handleUserSubmit(form) {
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.action = state.userForm.mode === "edit" ? "update" : "create";

  if (state.userForm.mode === "edit") {
    payload.userId = state.userForm.userId;
  }

  const data = await postJson("/api/users", payload, "users");
  state.userForm = createEmptyUserForm();
  state.selectedUserIds.clear();
  state.selectedEstablishmentIds.clear();
  state.selectedSeatCountIds.clear();
  await refreshAdminState();
  setStatus("users", "success", data.message ?? "User saved.");
}

async function handleCompanySubmit(form) {
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.action = state.companyForm.mode === "edit" ? "updateCompany" : "createCompany";

  if (state.companyForm.mode === "edit") {
    payload.companyId = state.companyForm.companyId;
  }

  const data = await postJson("/api/companies", payload, "companies");
  state.companyForm = createEmptyCompanyForm();
  state.selectedCompanyIds.clear();
  state.selectedEstablishmentIds.clear();
  state.selectedSeatCountIds.clear();
  await refreshAdminState();
  setStatus("companies", "success", data.message ?? "Company saved.");
}

async function logout() {
  await fetch("/api/logout", { method: "POST" });
  state.session = null;
  state.users = [];
  state.companies = [];
  state.selectedUserIds.clear();
  state.selectedCompanyIds.clear();
  state.selectedEstablishmentIds.clear();
  state.selectedSeatCountIds.clear();
  state.userForm = createEmptyUserForm();
  state.companyForm = createEmptyCompanyForm();
  await loadSession();
  setStatus("auth", "success", "Signed out.");
  navigate("/login");
}

async function refreshAdminState() {
  await loadSession();
  render();
}

async function postJson(url, payload, scope) {
  clearStatus(scope);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await readApiResponse(response);

  if (!response.ok) {
    setStatus(scope, "error", data.error ?? "Request failed.");
    throw new Error(data.error ?? "Request failed.");
  }

  return data;
}

async function readApiResponse(response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return { error: text || `Request failed with status ${response.status}.` };
}

function createEmptyUserForm() {
  return {
    mode: "create",
    userId: null,
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    authLevel: "user",
    companyId: "",
  };
}

function createEmptyCompanyForm() {
  return {
    mode: "create",
    companyId: null,
    name: "",
  };
}

function setStatus(scope, kind, message) {
  state.statuses[scope] = message ? { kind, message } : null;
  render();
}

function clearStatus(scope) {
  state.statuses[scope] = null;
}

function renderStatus(scope) {
  const status = state.statuses[scope];
  return `<div class="status ${status?.kind ?? ""}">${escapeHtml(status?.message ?? "")}</div>`;
}

function getFilteredUsers() {
  const term = state.filters.users.trim().toLowerCase();
  const companiesById = new Map(state.companies.map((company) => [company.id, company.name.toLowerCase()]));

  if (!term) {
    return state.users;
  }

  return state.users.filter((user) => {
    const haystack = [
      user.firstName,
      user.lastName,
      user.email,
      user.authLevel,
      companiesById.get(user.companyId) ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(term);
  });
}

function getFilteredCompanies() {
  const term = state.filters.companies.trim().toLowerCase();
  if (!term) {
    return state.companies;
  }

  return state.companies.filter((company) => {
    const seatText = company.establishments
      .flatMap((establishment) => establishment.seatCounts.map((seatCount) => String(seatCount.seatCount)))
      .join(" ");
    const establishmentNames = company.establishments.map((establishment) => establishment.name).join(" ");
    return `${company.name} ${establishmentNames} ${seatText}`.toLowerCase().includes(term);
  });
}

function setVisibleSelection(scope, checked) {
  const visibleIds =
    scope === "users"
      ? getFilteredUsers().map((item) => item.id)
      : getFilteredCompanies().map((item) => item.id);

  const selection = scope === "users" ? state.selectedUserIds : state.selectedCompanyIds;
  if (checked) {
    visibleIds.forEach((id) => selection.add(id));
  } else {
    visibleIds.forEach((id) => selection.delete(id));
  }
}

function areAllVisibleSelected(scope) {
  const visibleIds =
    scope === "users"
      ? getFilteredUsers().map((item) => item.id)
      : getFilteredCompanies().map((item) => item.id);

  const selection = scope === "users" ? state.selectedUserIds : state.selectedCompanyIds;
  return visibleIds.length > 0 && visibleIds.every((id) => selection.has(id));
}

function toggleSelection(selection, id, checked) {
  if (checked) {
    selection.add(id);
  } else {
    selection.delete(id);
  }
}

function pruneSelections() {
  const userIds = new Set(state.users.map((item) => item.id));
  const companyIds = new Set(state.companies.map((item) => item.id));
  const establishmentIds = new Set(
    state.companies.flatMap((company) => company.establishments.map((item) => item.id)),
  );
  const seatCountIds = new Set(
    state.companies.flatMap((company) =>
      company.establishments.flatMap((establishment) =>
        establishment.seatCounts.map((item) => item.id),
      ),
    ),
  );

  state.selectedUserIds = new Set(Array.from(state.selectedUserIds).filter((id) => userIds.has(id)));
  state.selectedCompanyIds = new Set(
    Array.from(state.selectedCompanyIds).filter((id) => companyIds.has(id)),
  );
  state.selectedEstablishmentIds = new Set(
    Array.from(state.selectedEstablishmentIds).filter((id) => establishmentIds.has(id)),
  );
  state.selectedSeatCountIds = new Set(
    Array.from(state.selectedSeatCountIds).filter((id) => seatCountIds.has(id)),
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

boot().catch(() => {
  setStatus("auth", "error", "Unable to load the app.");
});
