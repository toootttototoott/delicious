const SECTION_PANEL_STORAGE_KEY = "booking-admin:section-panels";
const THEME_EDITOR_MODEL_STORAGE_PREFIX = "booking-theme-editor:model:";
const THEME_EDITOR_REASONING_STORAGE_PREFIX = "booking-theme-editor:reasoning:";
const THEME_EDITOR_SAVED_BASELINE_STORAGE_PREFIX = "booking-theme-editor:saved-baseline:";

const state = {
  booting: true,
  session: null,
  users: [],
  companies: [],
  userCount: 0,
  sectionPanels: loadSectionPanelState(),
  appSettings: createDefaultAppSettings(),
  openAiModelDraft: createDefaultAppSettings().openAiModel,
  openAiReasoningEffortDraft: createDefaultAppSettings().openAiReasoningEffort,
  widgetEditorMaxOutputTokensDraft: String(
    createDefaultAppSettings().widgetEditorMaxOutputTokens,
  ),
  widgetEditorUploadLimitDraftMb: formatMegabytes(
    createDefaultAppSettings().widgetEditorUploadLimitBytes,
  ),
  emailTestDraft: createDefaultEmailTestDraft(),
  authForms: createDefaultAuthForms(),
  widgetCatalog: [],
  widgetAvailability: [],
  statuses: {
    auth: null,
    workspace: null,
    users: null,
    companies: null,
    bookings: null,
    widget: null,
    widgetSetup: null,
    openaiSettings: null,
    emailSettings: null,
    widgetEditor: null,
    passwordReset: null,
  },
  filters: {
    users: "",
    companies: "",
  },
  selectedUserIds: new Set(),
  selectedCompanyIds: new Set(),
  selectedEstablishmentIds: new Set(),
  selectedSeatCountIds: new Set(),
  dirtyOpeningHoursEstablishmentIds: new Set(),
  userForm: createEmptyUserForm(),
  companyForm: createEmptyCompanyForm(),
  widgetSetup: {
    companyId: "",
    establishmentId: "",
    seatCountId: "",
  },
  bookingWorkspace: createBookingWorkspaceState(),
  widgetEditor: createEmptyWidgetEditorState(),
  widget: {
    seatCountId: "",
    currentMonth: monthKey(todayString()),
    selectedDate: "",
    selectedTime: "",
    modal: null,
    confirmationMessage: "",
    enquiryPartySize: "",
  },
  adminCalendar: {
    companyId: "",
    establishmentId: "",
    seatCountId: "",
    currentMonth: monthKey(todayString()),
    selectedDate: "",
    selectedTime: "",
    modal: null,
    editingBookingId: "",
  },
  adminAvailability: [],
};

const routes = new Map([
  ["/", renderLoginPage],
  ["/login", renderLoginPage],
  ["/settings", renderSettingsPage],
  ["/widget", renderWidgetPage],
  ["/page-view", renderPageViewPage],
  ["/widget-setup", renderWidgetSetupPage],
  ["/widget-editor", renderWidgetEditorPage],
  ["/page-view-editor", renderPageViewEditorPage],
]);

let widgetLiveRefreshHandle = null;
let adminLiveRefreshHandle = null;
let widgetRefreshInFlight = false;
let adminRefreshInFlight = false;
let widgetHeightSyncHandle = null;
const derivedAdminDataCache = {
  companiesRef: null,
  usersRef: null,
  allEstablishments: [],
  companyNamesById: new Map(),
  establishmentsById: new Map(),
  usersByCompanyId: new Map(),
  filteredUsersTerm: null,
  filteredUsersResult: [],
  filteredCompaniesTerm: null,
  filteredCompaniesResult: [],
  topnavMarkup: null,
};

document.addEventListener("click", (event) => {
  const modalPanel = event.target.closest("[data-modal-panel]");
  const actionTarget = event.target.closest("[data-action]");

  if (
    modalPanel &&
    (!actionTarget || actionTarget.classList.contains("widget-modal-backdrop"))
  ) {
    return;
  }

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
  redirectSignedInUserFromLogin();
  syncAuthRouteState();

  if (isPublicBookingRoute() && (!getSeatCountById(getSeatCountIdFromLocation()) || !state.widgetCatalog.length)) {
    loadPublicWidgetCatalog().catch(() => {
      setStatus("widget", "error", "Widget data could not be loaded.");
    });
  }

  if (
    location.pathname === "/settings" &&
    hasSettingsAccess() &&
    !state.companies.length
  ) {
    beginScopedWorkspaceLoad();
    loadAdminData()
      .then(() => refreshAdminAvailability())
      .then(() => clearStatus("workspace"))
      .catch(() => {
        setStatus("workspace", "error", "Your establishment workspace could not be loaded.");
        setStatus("auth", "error", "Admin data could not be loaded.");
      });
  }

  if (
    (location.pathname === "/widget-setup" ||
      location.pathname === "/widget-editor" ||
      location.pathname === "/page-view-editor") &&
    isAdminSession() &&
    !state.companies.length
  ) {
    loadAdminData()
      .then(() => refreshAdminAvailability())
      .catch(() => {
        setStatus("auth", "error", "Admin data could not be loaded.");
      });
  }

  syncWidgetFromLocation();
  if (location.pathname === "/widget-editor" || location.pathname === "/page-view-editor") {
    syncWidgetEditorSelections();
  }
  render();
});

window.addEventListener("resize", () => {
  scheduleWidgetHeightSync();
});

document.addEventListener("visibilitychange", () => {
  syncLiveRefresh();

  if (document.visibilityState !== "visible") {
    return;
  }

  if (isPublicBookingRoute() && state.widget.seatCountId) {
    refreshWidgetAvailability({ silent: true }).then(render).catch(() => {});
  }

  if (
    location.pathname === "/settings" &&
    hasSettingsAccess() &&
    state.adminCalendar.seatCountId
  ) {
    refreshAdminAvailability({ silent: true }).then(render).catch(() => {});
  }
});

document.addEventListener("submit", async (event) => {
  if (event.target.matches("[data-login-form]")) {
    event.preventDefault();
    await handleLogin(event.target);
    return;
  }

  if (event.target.matches("[data-forgot-password-form]")) {
    event.preventDefault();
    await handleForgotPasswordSubmit(event.target);
    return;
  }

  if (event.target.matches("[data-reset-password-form]")) {
    event.preventDefault();
    await handleResetPasswordSubmit(event.target);
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
    return;
  }

  if (event.target.matches("[data-widget-form]")) {
    event.preventDefault();
    await handleWidgetBooking(event.target);
    return;
  }

  if (event.target.matches("[data-widget-enquiry-form]")) {
    event.preventDefault();
    await handleWidgetEnquiry(event.target);
    return;
  }

  if (event.target.matches("[data-admin-booking-form]")) {
    event.preventDefault();
    await handleAdminBookingSubmit(event.target);
    return;
  }

  if (event.target.matches("[data-openai-settings-form]")) {
    event.preventDefault();
    await handleOpenAiSettingsSubmit(event.target);
    return;
  }

  if (event.target.matches("[data-email-test-form]")) {
    event.preventDefault();
    await handleEmailTestSubmit(event.target);
    return;
  }

  if (event.target.matches("[data-widget-editor-generate-form]")) {
    event.preventDefault();
    await handleWidgetEditorGenerate(event.target);
    return;
  }

  if (event.target.matches("[data-widget-editor-save-form]")) {
    event.preventDefault();
    await handleWidgetEditorSave(event.target);
  }
});

document.addEventListener("input", (event) => {
  if (syncAdminFormDraft(event.target)) {
    return;
  }

  if (event.target.matches("[data-user-search]")) {
    state.filters.users = event.target.value;
    render();
    return;
  }

  if (event.target.matches("[data-company-search]")) {
    state.filters.companies = event.target.value;
    render();
    return;
  }

  if (event.target.matches("[data-login-email-draft]")) {
    state.authForms.loginEmail = event.target.value;
    return;
  }

  if (event.target.matches("[data-login-password-draft]")) {
    state.authForms.loginPassword = event.target.value;
    return;
  }

  if (event.target.matches("[data-forgot-email-draft]")) {
    state.authForms.forgotEmail = event.target.value;
    return;
  }

  if (event.target.matches("[data-reset-password-draft]")) {
    state.authForms.resetPassword = event.target.value;
    return;
  }

  if (event.target.matches("[data-reset-confirm-password-draft]")) {
    state.authForms.resetConfirmPassword = event.target.value;
    return;
  }

  if (event.target.matches("[data-openai-model-draft]")) {
    state.openAiModelDraft = event.target.value;
    return;
  }

  if (event.target.matches("[data-openai-reasoning-effort-draft]")) {
    state.openAiReasoningEffortDraft = event.target.value;
    return;
  }

  if (event.target.matches("[data-widget-editor-max-output-tokens-draft]")) {
    state.widgetEditorMaxOutputTokensDraft = event.target.value;
    return;
  }

  if (event.target.matches("[data-email-test-draft]")) {
    state.emailTestDraft[event.target.name] = event.target.value;
    return;
  }

  if (event.target.matches("[data-widget-editor-upload-limit-draft]")) {
    state.widgetEditorUploadLimitDraftMb = event.target.value;
    return;
  }

  if (event.target.matches("[data-widget-editor-prompt]")) {
    state.widgetEditor.prompt = event.target.value;
    return;
  }

  if (event.target.matches("[data-widget-editor-prompt-name]")) {
    state.widgetEditor.promptName = event.target.value;
    return;
  }

  if (event.target.matches("[data-widget-editor-content]")) {
    state.widgetEditor.draftContentText = event.target.value;
    return;
  }

  if (event.target.matches("[data-widget-editor-css]")) {
    state.widgetEditor.draftCss = event.target.value;
    return;
  }

  if (event.target.matches("[data-widget-editor-model]")) {
    state.widgetEditor.model = event.target.value;
    persistThemeEditorModelChoice(getActiveThemeEditorKey(), event.target.value);
    return;
  }

  if (event.target.matches("[data-widget-editor-reasoning]")) {
    state.widgetEditor.reasoningEffort = event.target.value;
    persistThemeEditorReasoningChoice(getActiveThemeEditorKey(), event.target.value);
    return;
  }

  if (event.target.matches("[data-widget-editor-use-saved-baseline]")) {
    state.widgetEditor.useSavedBaseline = event.target.checked;
    persistThemeEditorSavedBaselineChoice(getActiveThemeEditorKey(), event.target.checked);
    return;
  }

  if (event.target.matches("[data-widget-party-size]")) {
    clampWidgetPartySizeInput(event.target);
    return;
  }

  if (
    event.target.matches("[data-hours-open]") ||
    event.target.matches("[data-hours-start]") ||
    event.target.matches("[data-hours-end]")
  ) {
    markOpeningHoursDirty(event.target);
  }
});

document.addEventListener("change", async (event) => {
  if (syncAdminFormDraft(event.target)) {
    return;
  }

  if (event.target.matches("[data-widget-party-size]")) {
    clampWidgetPartySizeInput(event.target);
    return;
  }

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
    return;
  }

  if (event.target.matches("[data-setup-company]")) {
    state.widgetSetup.companyId = event.target.value;
    syncWidgetSetupSelections();
    render();
    return;
  }

  if (event.target.matches("[data-setup-establishment]")) {
    state.widgetSetup.establishmentId = event.target.value;
    syncWidgetSetupSelections();
    render();
    return;
  }

  if (event.target.matches("[data-setup-seat-count]")) {
    state.widgetSetup.seatCountId = event.target.value;
    render();
    return;
  }

  if (event.target.matches("[data-widget-editor-company]")) {
    state.widgetEditor.companyId = event.target.value;
    state.widgetEditor.draftCss = "";
    syncWidgetEditorSelections();
    render();
    return;
  }

  if (event.target.matches("[data-widget-editor-establishment]")) {
    state.widgetEditor.establishmentId = event.target.value;
    state.widgetEditor.draftCss = "";
    syncWidgetEditorSelections();
    render();
    return;
  }

  if (event.target.matches("[data-widget-editor-files]")) {
    await handleWidgetEditorFiles(event.target.files);
    return;
  }

  if (event.target.matches("[data-booking-company]")) {
    state.adminCalendar.companyId = event.target.value;
    clearBookingWorkspaceResults();
    syncAdminCalendarSelections();
    refreshAdminAvailability().then(render);
    return;
  }

  if (event.target.matches("[data-booking-establishment]")) {
    state.adminCalendar.establishmentId = event.target.value;
    clearBookingWorkspaceResults();
    syncAdminCalendarSelections();
    refreshAdminAvailability().then(render);
    return;
  }

  if (event.target.matches("[data-booking-seat-count]")) {
    state.adminCalendar.seatCountId = event.target.value;
    clearBookingWorkspaceResults();
    syncAdminCalendarSelections();
    refreshAdminAvailability().then(render);
    return;
  }

  if (event.target.matches("[data-booking-search-query]")) {
    state.bookingWorkspace.searchQuery = event.target.value;
    return;
  }

  if (event.target.matches("[data-booking-report-from-date]")) {
    state.bookingWorkspace.report.fromDate = event.target.value;
    return;
  }

  if (event.target.matches("[data-booking-report-to-date]")) {
    state.bookingWorkspace.report.toDate = event.target.value;
    return;
  }

  if (event.target.matches("[data-booking-report-from-time]")) {
    state.bookingWorkspace.report.fromTime = event.target.value;
    return;
  }

  if (event.target.matches("[data-booking-report-to-time]")) {
    state.bookingWorkspace.report.toTime = event.target.value;
  }
});

document.addEventListener("paste", async (event) => {
  if (location.pathname !== "/widget-editor" && location.pathname !== "/page-view-editor") {
    return;
  }

  const files = getClipboardFiles(event.clipboardData);
  if (!files.length) {
    return;
  }

  event.preventDefault();
  await handleWidgetEditorFiles(files, { append: true, sourceLabel: "pasted" });
});

document.addEventListener("toggle", (event) => {
  if (!(event.target instanceof HTMLElement) || !event.target.matches("[data-section-panel-id]")) {
    return;
  }

  setSectionPanelState(event.target.dataset.sectionPanelId, event.target.open);
}, true);

async function boot() {
  if (location.pathname === "/") {
    history.replaceState({}, "", "/login");
  }

  render();

  try {
    if (isPublicBookingRoute()) {
      const widgetResult = await Promise.allSettled([loadPublicWidgetCatalog()]);
      if (widgetResult[0]?.status === "rejected") {
        setStatus("widget", "error", "Widget data could not be loaded.");
      }
      syncWidgetFromLocation();
    } else {
      const sessionResult = await Promise.allSettled([loadSession()]);
      if (sessionResult[0]?.status === "rejected") {
        setStatus("auth", "error", "Session could not be loaded.");
      }

      redirectSignedInUserFromLogin();
      syncAuthRouteState();

      if (
        location.pathname === "/settings" &&
        hasSettingsAccess()
      ) {
        beginScopedWorkspaceLoad();
        const adminResult = await Promise.allSettled([loadAdminData()]);
        if (adminResult[0]?.status === "rejected") {
          setStatus("workspace", "error", "Your establishment workspace could not be loaded.");
          setStatus("auth", "error", "Admin data could not be loaded.");
        } else {
          clearStatus("workspace");
        }
      }

      if (
        (location.pathname === "/widget-setup" ||
          location.pathname === "/widget-editor" ||
          location.pathname === "/page-view-editor") &&
        isAdminSession()
      ) {
        const adminResult = await Promise.allSettled([loadAdminData()]);
        if (adminResult[0]?.status === "rejected") {
          setStatus("auth", "error", "Admin data could not be loaded.");
        }
      }

      syncWidgetFromLocation();
      if (hasSettingsAccess()) {
        await refreshAdminAvailability();
      }
    }
  } finally {
    state.booting = false;
    render();
  }
}

async function loadSession() {
  const response = await fetch("/api/session");
  const payload = await readApiResponse(response);
  state.session = payload.session;
  state.userCount = Number(payload.userCount ?? 0);
  if (!state.emailTestDraft.recipientEmail && state.session?.email) {
    state.emailTestDraft.recipientEmail = state.session.email;
  }
  if (!hasSettingsAccess()) {
    state.users = [];
    state.companies = [];
    state.appSettings = createDefaultAppSettings();
    state.openAiModelDraft = state.appSettings.openAiModel;
    state.openAiReasoningEffortDraft = state.appSettings.openAiReasoningEffort;
    state.widgetEditorMaxOutputTokensDraft = String(state.appSettings.widgetEditorMaxOutputTokens);
    state.widgetEditorUploadLimitDraftMb = formatMegabytes(state.appSettings.widgetEditorUploadLimitBytes);
  }
  pruneSelections();
  syncWidgetSetupSelections();
  syncWidgetEditorSelections();
  syncAdminCalendarSelections();
}

async function loadAdminData() {
  const response = await fetch("/api/admin-data");
  const payload = await readApiResponse(response);

  if (!response.ok) {
    throw new Error(payload.error ?? "Admin data could not be loaded.");
  }

  state.users = payload.users ?? [];
  state.companies = payload.companies ?? [];
  state.appSettings = payload.appSettings ?? createDefaultAppSettings();
  state.widgetEditor.savedPrompts = normalizeWidgetEditorPrompts(payload.widgetEditorPrompts);
  state.openAiModelDraft = state.appSettings.openAiModel;
  state.openAiReasoningEffortDraft = state.appSettings.openAiReasoningEffort;
  state.widgetEditorMaxOutputTokensDraft = String(state.appSettings.widgetEditorMaxOutputTokens);
  state.widgetEditorUploadLimitDraftMb = formatMegabytes(state.appSettings.widgetEditorUploadLimitBytes);
  pruneSelections();
  syncWidgetSetupSelections();
  syncWidgetEditorSelections();
  syncAdminCalendarSelections();
}

async function loadWidgetCatalog() {
  const response = await fetch("/api/widget?action=config");
  const payload = await readApiResponse(response);

  if (!response.ok) {
    throw new Error(payload.error ?? "Widget configuration failed.");
  }

  state.widgetCatalog = payload.catalog ?? [];
  syncWidgetSetupSelections();
}

async function loadPublicWidgetCatalog() {
  const seatCountId = getSeatCountIdFromLocation();
  if (!seatCountId) {
    state.widgetCatalog = [];
    return;
  }

  const response = await fetch(`/api/widget?action=config&seatCountId=${encodeURIComponent(seatCountId)}`);
  const payload = await readApiResponse(response);

  if (!response.ok) {
    throw new Error(payload.error ?? "Widget configuration failed.");
  }

  state.widgetCatalog = payload.catalog ?? [];
}

function navigate(target, options = {}) {
  const replace = options.replace === true;
  const historyMethod = replace ? "replaceState" : "pushState";
  history[historyMethod]({}, "", target);
  redirectSignedInUserFromLogin();
  syncAuthRouteState();
  if (isPublicBookingRoute() && (!getSeatCountById(getSeatCountIdFromLocation()) || !state.widgetCatalog.length)) {
    loadPublicWidgetCatalog()
      .then(() => {
        syncWidgetFromLocation();
        render();
      })
      .catch(() => {
        setStatus("widget", "error", "Widget data could not be loaded.");
      });
  }

  if (
    location.pathname === "/settings" &&
    hasSettingsAccess() &&
    !state.companies.length
  ) {
    beginScopedWorkspaceLoad();
    loadAdminData()
      .then(async () => {
        await refreshAdminAvailability();
        clearStatus("workspace");
        render();
      })
      .catch(() => {
        setStatus("workspace", "error", "Your establishment workspace could not be loaded.");
        setStatus("auth", "error", "Admin data could not be loaded.");
      });
  }

  if (
    (location.pathname === "/widget-setup" ||
      location.pathname === "/widget-editor" ||
      location.pathname === "/page-view-editor") &&
    isAdminSession() &&
    !state.companies.length
  ) {
    loadAdminData()
      .then(async () => {
        await refreshAdminAvailability();
        render();
      })
      .catch(() => {
        setStatus("auth", "error", "Admin data could not be loaded.");
      });
  }

  syncWidgetFromLocation();
  if (location.pathname === "/widget-editor" || location.pathname === "/page-view-editor") {
    syncWidgetEditorSelections();
  }
  render();
}

function render() {
  redirectSignedInUserFromLogin();
  applyRouteChrome();
  syncLiveRefresh();

  if (location.pathname === "/widget-editor" || location.pathname === "/page-view-editor") {
    syncWidgetEditorSelections();
  }

  const app = document.querySelector("#app");
  const topnav = document.querySelector(".topnav");
  const isLoginRoute = location.pathname === "/login" || location.pathname === "/";

  if (state.booting) {
    topnav.innerHTML = "";
    derivedAdminDataCache.topnavMarkup = "";
    app.innerHTML = isPublicBookingRoute()
      ? renderPublicBookingLoadingPage()
      : isLoginRoute
      ? renderLoginPage()
      : renderBootPage();
    scheduleWidgetHeightSync();
    return;
  }

  if (needsSettingsRedirect()) {
    history.replaceState({}, "", "/login");
    if (!state.statuses.auth) {
      state.statuses.auth = { kind: "error", message: "Settings access required." };
    }
  }

  if (needsAdminOnlyRedirect()) {
    history.replaceState({}, "", getSignedInLandingPath());
    if (!state.statuses.auth) {
      state.statuses.auth = { kind: "error", message: "Admin access required." };
    }
  }

  const topnavMarkup = renderTopnav();
  if (derivedAdminDataCache.topnavMarkup !== topnavMarkup) {
    topnav.innerHTML = topnavMarkup;
    derivedAdminDataCache.topnavMarkup = topnavMarkup;
  }
  app.innerHTML = (routes.get(location.pathname) ?? renderLoginPage)();
  scheduleWidgetHeightSync();
}

function applyRouteChrome() {
  const root = document.documentElement;
  const body = document.body;
  const shell = document.querySelector(".shell");
  const masthead = document.querySelector(".masthead");
  const isWidgetRoute = isPublicBookingRoute();
  const isLoginRoute = location.pathname === "/login" || location.pathname === "/";
  const hideChrome = state.booting || isWidgetRoute || isLoginRoute || isManagerSession() || isStaffSession();

  root.classList.toggle("route-widget", isWidgetRoute);
  root.classList.toggle("route-login", isLoginRoute);
  body.classList.toggle("widget-embed", isWidgetRoute);
  body.classList.toggle("login-standalone", isLoginRoute);
  shell?.classList.toggle("widget-embed-shell", isWidgetRoute);
  shell?.classList.toggle("login-shell", isLoginRoute);
  masthead?.classList.toggle("is-hidden", hideChrome);
}

function renderTopnav() {
  if (
    isPublicBookingRoute() ||
    location.pathname === "/login" ||
    location.pathname === "/" ||
    isManagerSession() ||
    isStaffSession()
  ) {
    return "";
  }

  const canViewSettings = state.userCount === 0 || hasSettingsAccess();
  const widgetHref =
    (canViewSettings ? getWidgetUrl() : "") ||
    `/widget${state.widget.seatCountId ? `?seatCountId=${encodeURIComponent(state.widget.seatCountId)}` : ""}`;
  const links = [
    renderTopnavLink(widgetHref, "Widget", location.pathname === "/widget"),
    canViewSettings
      ? isAdminSession()
        ? renderTopnavLink("/widget-setup", "Embed Setup", location.pathname === "/widget-setup")
        : ""
      : "",
    canViewSettings
      ? isAdminSession()
        ? renderTopnavLink("/widget-editor", "Theme Editor", location.pathname === "/widget-editor")
        : ""
      : "",
    canViewSettings
      ? isAdminSession()
        ? renderTopnavLink("/page-view-editor", "Page View Editor", location.pathname === "/page-view-editor")
        : ""
      : "",
    canViewSettings
      ? renderTopnavLink("/settings", "Admin", location.pathname === "/settings")
      : "",
  ]
    .filter(Boolean)
    .join("");

  return `
    <div class="topnav-links">${links}</div>
    <div class="topnav-session">
      ${
        state.session
          ? `
            <div class="topnav-user">
              <strong>${escapeHtml(state.session.firstName)} ${escapeHtml(state.session.lastName)}</strong>
              <span>${escapeHtml(state.session.authLevel)}</span>
            </div>
            <button type="button" class="ghost-button" data-action="logout">Sign out</button>
          `
          : renderTopnavLink("/login", "Sign in", location.pathname === "/login")
      }
    </div>
  `;
}

function renderTopnavLink(href, label, active) {
  return `<a href="${href}" class="${active ? "is-active" : ""}" ${active ? 'aria-current="page"' : ""} data-link>${label}</a>`;
}

function renderPageHeader({ eyebrow, title, meta, actions = "" }) {
  return `
    <article class="panel full-width page-hero">
      <div class="panel-head">
        <div>
          <p class="eyebrow">${escapeHtml(eyebrow)}</p>
          <h2>${escapeHtml(title)}</h2>
          ${meta ? `<p class="meta">${escapeHtml(meta)}</p>` : ""}
        </div>
        ${actions ? `<div class="stack-inline">${actions}</div>` : ""}
      </div>
    </article>
  `;
}

function renderSectionPanel({ id = "", eyebrow, title, meta = "", badge = "", content, open = true }) {
  const rememberedOpen = id ? state.sectionPanels[id] : undefined;
  const isOpen = typeof rememberedOpen === "boolean" ? rememberedOpen : open;
  return `
    <details class="panel full-width section-panel" data-section-panel-id="${escapeHtml(id)}" ${isOpen ? "open" : ""}>
      <summary class="section-summary">
        <div>
          <p class="eyebrow">${escapeHtml(eyebrow)}</p>
          <h3>${escapeHtml(title)}</h3>
          ${meta ? `<p class="meta">${escapeHtml(meta)}</p>` : ""}
        </div>
        <div class="section-summary-side">
          ${badge ? `<span class="badge">${badge}</span>` : ""}
          <span class="section-chevron" aria-hidden="true"></span>
        </div>
      </summary>
      <div class="section-body">${content}</div>
    </details>
  `;
}

function renderBootPage() {
  return `
    <section class="login-layout">
      <article class="panel login-panel login-main-panel">
        <p class="eyebrow">Loading</p>
        <h2>Checking your session</h2>
        <p class="meta">One moment while access is confirmed and the page is prepared.</p>
        <div class="stack">
          <div class="status info">Checking saved sign-in details...</div>
          <button type="button" class="login-submit" disabled>Please wait...</button>
        </div>
      </article>
      <article class="panel login-side">
        <p class="eyebrow">Startup</p>
        <h3>Preparing the app</h3>
        <div class="stack">
          <p class="meta">If you already have an active session, you will be taken straight through automatically.</p>
          <p class="meta">If not, the sign-in form will appear here as soon as the check finishes.</p>
        </div>
      </article>
    </section>
  `;
}

function renderPublicBookingLoadingPage() {
  return `
    <section class="layout widget-layout widget-theme-root public-loading-layout">
      <article class="panel full-width widget-calendar-panel public-loading-panel">
        <div class="prominent-process-banner prominent-process-banner-inline" aria-live="polite">
          <div class="prominent-process-spinner" aria-hidden="true"></div>
          <div>
            <strong>Loading booking calendar</strong>
            <p class="meta">One moment while the available dates and times are prepared.</p>
          </div>
        </div>
      </article>
    </section>
  `;
}

function renderLoginPage() {
  if (hasPasswordResetToken()) {
    return renderResetPasswordPage();
  }

  if (isForgotPasswordView()) {
    return renderForgotPasswordPage();
  }

  return `
    <section class="login-layout">
      <article class="panel login-panel login-main-panel">
        <p class="eyebrow">Account Access</p>
        <h2>Sign in to continue</h2>
        <p class="meta">Use an email and password from an existing user account.</p>
        <form class="stack" data-login-form autocomplete="on">
          <div class="form-grid">
            <div class="field full">
              <label for="login-email">Email</label>
              <input
                id="login-email"
                name="email"
                type="email"
                autocomplete="username"
                value="${escapeHtml(state.authForms.loginEmail)}"
                data-login-email-draft
                autofocus
                required
              />
            </div>
            <div class="field full">
              <label for="login-password">Password</label>
              <input
                id="login-password"
                name="password"
                type="password"
                autocomplete="current-password"
                value="${escapeHtml(state.authForms.loginPassword)}"
                data-login-password-draft
                enterkeyhint="go"
                required
              />
            </div>
          </div>
          ${renderStatus("auth")}
          <div class="stack-inline">
            <button type="submit" class="login-submit">Sign in</button>
            <button type="button" class="ghost-button" data-action="openForgotPassword">Forgot password</button>
          </div>
        </form>
      </article>
    </section>
  `;
}

function renderForgotPasswordPage() {
  return `
    <section class="login-layout">
      <article class="panel login-panel login-main-panel">
        <p class="eyebrow">Account Access</p>
        <h2>Forgot password</h2>
        <p class="meta">Enter your email address and, if it exists in the system, a reset link will be sent.</p>
        <form class="stack" data-forgot-password-form autocomplete="on">
          <div class="field full">
            <label for="forgot-email">Email</label>
            <input
              id="forgot-email"
              name="email"
              type="email"
              autocomplete="email"
              value="${escapeHtml(state.authForms.forgotEmail)}"
              data-forgot-email-draft
              autofocus
              required
            />
          </div>
          ${renderStatus("passwordReset")}
          <div class="stack-inline">
            <button type="submit" class="login-submit">Send reset link</button>
            <button type="button" class="ghost-button" data-action="returnToLogin">Back to sign in</button>
          </div>
        </form>
      </article>
      <article class="panel login-side">
        <p class="eyebrow">Recovery</p>
        <h3>How it works</h3>
        <div class="stack">
          <p class="meta">1. Submit the email tied to your user account.</p>
          <p class="meta">2. Open the reset link from your inbox.</p>
          <p class="meta">3. Choose a new password and sign back in.</p>
        </div>
      </article>
    </section>
  `;
}

function renderResetPasswordPage() {
  const tokenStatus = state.authForms.resetTokenStatus;
  const tokenInvalid = tokenStatus === "invalid";
  const tokenChecking = tokenStatus === "idle" || tokenStatus === "loading";

  return `
    <section class="login-layout">
      <article class="panel login-panel login-main-panel">
        <p class="eyebrow">Account Access</p>
        <h2>Reset password</h2>
        <p class="meta">Choose a new password for your account.</p>
        ${tokenChecking ? '<div class="status info">Checking reset link...</div>' : ""}
        ${
          tokenInvalid
            ? `<div class="status error">${escapeHtml(state.authForms.resetTokenError || "This password reset link is invalid or has expired.")}</div>`
            : ""
        }
        <form class="stack" data-reset-password-form autocomplete="on">
          <div class="field full">
            <label for="reset-password">New password</label>
            <input
              id="reset-password"
              name="password"
              type="password"
              minlength="8"
              autocomplete="new-password"
              value="${escapeHtml(state.authForms.resetPassword)}"
              data-reset-password-draft
              autofocus
              required
              ${tokenInvalid || tokenChecking ? "disabled" : ""}
            />
          </div>
          <div class="field full">
            <label for="reset-confirm-password">Confirm new password</label>
            <input
              id="reset-confirm-password"
              name="confirmPassword"
              type="password"
              minlength="8"
              autocomplete="new-password"
              value="${escapeHtml(state.authForms.resetConfirmPassword)}"
              data-reset-confirm-password-draft
              required
              ${tokenInvalid || tokenChecking ? "disabled" : ""}
            />
          </div>
          ${renderStatus("passwordReset")}
          <div class="stack-inline">
            <button type="submit" class="login-submit" ${tokenInvalid || tokenChecking ? "disabled" : ""}>Save new password</button>
            <button type="button" class="ghost-button" data-action="returnToLogin">Back to sign in</button>
          </div>
        </form>
      </article>
      <article class="panel login-side">
        <p class="eyebrow">Security</p>
        <h3>${tokenInvalid ? "Need a new link?" : "Reset link active"}</h3>
        <div class="stack">
          <p class="meta">${
            tokenInvalid
              ? "Request another password reset link from the sign-in page."
              : "Use a password with at least 8 characters. Once saved, this reset link cannot be reused."
          }</p>
          <button type="button" class="ghost-button" data-action="openForgotPassword">Request another reset link</button>
        </div>
      </article>
    </section>
  `;
}

function renderSettingsPage() {
  const hasUsers = state.userCount > 0;
  const isAdmin = isAdminSession();

  if (!hasUsers) {
    return `
      <section class="layout">
        ${renderPageHeader({
          eyebrow: "Setup",
          title: "Create the first admin account",
          meta: "This is the one-time bootstrap step before the full admin area becomes available.",
        })}
        <article class="panel wide">
          <h2>Create the first admin</h2>
          <p class="meta">After this step, only admins can access the management screens.</p>
          ${renderUserForm(true)}
          ${renderStatus("users")}
        </article>
        <aside class="panel side">
          <p class="eyebrow">Security</p>
          <h3>Encrypted storage</h3>
          <p class="meta">Names, emails, and booking customer details are encrypted before being written to Cockroach. Passwords are stored as password hashes, not as reversible text.</p>
        </aside>
      </section>
    `;
  }

  if (!hasSettingsAccess()) {
    return `
      <section class="layout">
        ${renderPageHeader({
          eyebrow: "Access",
          title: "Admin access required",
          meta: "This section is restricted to admin accounts.",
        })}
        <article class="panel wide">
          <h2>Admin only</h2>
          <p class="meta">Settings is restricted to admins.</p>
          <a class="button-primary" href="/login" data-link>Go to login</a>
        </article>
      </section>
    `;
  }

  if (!isAdmin) {
    return renderScopedSettingsPage();
  }

  return `
    <section class="layout">
      ${renderSectionPanel({
        id: "settings-email",
        eyebrow: "Email",
        title: "Booking confirmation email",
        meta: "Test the live SMTP connection and preview the exact confirmation layout sent to guests after a booking is created.",
        open: true,
        content: `
          <div class="section-content-grid">
            <div class="inner-panel">
              ${renderEmailSettingsPanel()}
              ${renderStatus("emailSettings")}
            </div>
            <div class="inner-panel">
              <p class="eyebrow">Delivery setup</p>
              <h3>SMTP environment</h3>
              ${renderEmailConfigSummary()}
            </div>
          </div>
        `,
      })}
      ${renderSectionPanel({
        id: "settings-system",
        eyebrow: "System",
        title: "Widget editor OpenAI settings",
        meta: "Set the default model, upload limit, and reasoning effort used when generating establishment-specific CSS.",
        open: true,
        content: `
          <div class="section-content-grid section-content-grid-compact">
            <div class="inner-panel">
              ${renderOpenAiSettingsForm()}
              ${renderStatus("openaiSettings")}
            </div>
          </div>
        `,
      })}
      ${renderSectionPanel({
        id: "settings-users",
        eyebrow: "Users",
        title: "Users and access",
        meta: "Create and manage user accounts, roles, and assignments.",
        badge: `${state.users.length} users`,
        open: true,
        content: `
          <div class="section-content-grid">
            <div class="inner-panel">
              <p class="eyebrow">Form</p>
              <h3>${state.userForm.mode === "edit" ? "Edit user" : "Create user"}</h3>
              ${renderUserForm(false)}
              ${renderStatus("users")}
            </div>
            <div class="inner-panel">
              <div class="list-toolbar">
                <input
                  type="search"
                  placeholder="Search users, emails, auth, company, establishment"
                  value="${escapeHtml(state.filters.users)}"
                  data-user-search
                />
                <button type="button" class="ghost-button" data-action="bulkDeleteUsers">
                  Delete selected (${state.selectedUserIds.size})
                </button>
              </div>
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
            </div>
          </div>
        `,
      })}
      ${renderSectionPanel({
        id: "settings-locations",
        eyebrow: "Locations",
        title: "Companies, establishments, and seat counts",
        meta: "Keep the business structure and booking capacity organised in one place.",
        badge: `${state.companies.length} companies`,
        open: true,
        content: `
          <div class="section-content-grid">
            <div class="inner-panel">
              <p class="eyebrow">Form</p>
              <h3>${state.companyForm.mode === "edit" ? "Edit company" : "Create company"}</h3>
              ${renderCompanyForm()}
              ${renderStatus("companies")}
            </div>
            <div class="inner-panel">
              <div class="list-toolbar">
                <input
                  type="search"
                  placeholder="Search companies, establishments, seat counts"
                  value="${escapeHtml(state.filters.companies)}"
                  data-company-search
                />
                <button type="button" class="ghost-button" data-action="bulkDeleteCompanies">
                  Delete companies (${state.selectedCompanyIds.size})
                </button>
                <button type="button" class="ghost-button" data-action="bulkDeleteEstablishments">
                  Delete establishments (${state.selectedEstablishmentIds.size})
                </button>
                <button type="button" class="ghost-button" data-action="bulkDeleteSeatCounts">
                  Delete seat counts (${state.selectedSeatCountIds.size})
                </button>
              </div>
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
            </div>
          </div>
        `,
      })}
      ${renderSectionPanel({
        id: "settings-bookings",
        eyebrow: "Bookings",
        title: "Booking calendar",
        meta: "Set opening hours, inspect seat availability, and manage bookings by day.",
        open: true,
        content: `<div class="inner-panel booking-workspace">${renderBookingsPanel()}</div>`,
      })}
    </section>
  `;
}

function renderScopedSettingsPage() {
  if (isManagerSession()) {
    state.userForm.authLevel = "staff";
    state.userForm.companyId = state.session?.companyId ?? "";
    state.userForm.establishmentId = state.session?.establishmentId ?? "";
  }

  const rolePrefix = `scoped-${state.session?.authLevel ?? "user"}`;

  return `
    <section class="layout">
      ${renderProminentProcessStatus("workspace")}
      ${renderProminentProcessStatus("bookings")}
      ${renderSectionPanel({
        id: `${rolePrefix}-overview`,
        eyebrow: "Access",
        title: isManagerSession() ? "Manager booking workspace" : "Staff booking workspace",
        meta: "This view is limited to your assigned establishment.",
        open: false,
        content: `
          <div class="two-column-layout">
            <div class="inner-panel">
              <p class="eyebrow">Session</p>
              <h3>Signed-in account</h3>
              ${renderSessionSummary(true)}
            </div>
            <div class="inner-panel">
              <p class="eyebrow">Scope</p>
              <h3>${escapeHtml(getEstablishmentLabel(state.session?.establishmentId) || "No establishment assigned")}</h3>
              <p class="meta">${
                isManagerSession()
                  ? "Managers can run reports for this establishment and add staff accounts assigned here."
                  : "Staff can manage bookings for this establishment."
              }</p>
            </div>
          </div>
        `,
      })}
      ${
        isManagerSession()
          ? renderSectionPanel({
              id: `${rolePrefix}-staff`,
              eyebrow: "Staff access",
              title: "Create and view staff",
              meta: "New staff accounts created here are always assigned to this establishment.",
              open: false,
              content: `
                <div class="two-column-layout">
                  <div class="inner-panel">
                    <p class="eyebrow">Create</p>
                    <h3>${state.userForm.mode === "edit" ? "Edit staff member" : "Create staff member"}</h3>
                    <p class="meta">${
                      state.userForm.mode === "edit"
                        ? "Managers can update staff details and set a new password when needed."
                        : "New accounts created here are always assigned to this establishment."
                    }</p>
                    ${renderUserForm(false, {
                      restrictToStaff: true,
                      hideAssignmentFields: true,
                      hideRoleField: true,
                    })}
                    ${renderStatus("users")}
                  </div>
                  <div class="inner-panel">
                    <p class="eyebrow">Current staff</p>
                    <h3>Assigned to this establishment</h3>
                    <p class="meta">Managers can create, edit, delete, and reset passwords for staff linked to this location.</p>
                    <div class="list-toolbar">
                      <input
                        type="search"
                        placeholder="Search staff by name or email"
                        value="${escapeHtml(state.filters.users)}"
                        data-user-search
                      />
                      <button type="button" class="ghost-button" data-action="bulkDeleteUsers">
                        Delete selected (${state.selectedUserIds.size})
                      </button>
                    </div>
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
                  </div>
                </div>
              `,
            })
          : ""
      }
      ${renderSectionPanel({
        id: `${rolePrefix}-bookings`,
        eyebrow: "Bookings",
        title: "Booking calendar",
        meta: `Inspect seat availability, manage bookings by day, and ${
          canAccessBookingReports() ? "run reports for this establishment." : "search customer bookings."
        }`,
        open: false,
        content: `<div class="inner-panel booking-workspace">${renderBookingsPanel()}</div>`,
      })}
    </section>
  `;
}

function renderWidgetSetupPage() {
  const companies = getWidgetSetupCompanies();
  const establishments = getWidgetSetupEstablishments();
  const seatCounts = getWidgetSetupSeatCounts();
  const widgetUrl = getWidgetUrl();
  const pageViewUrl = getPageViewUrl();
  const widgetOrigin = widgetUrl ? new URL(widgetUrl).origin : "";
  const iframeResizeScript = `<script>
  (function () {
    var widgetOrigin = ${JSON.stringify(widgetOrigin)};

    function resizeBookingEmbed(event) {
      if (widgetOrigin && event.origin !== widgetOrigin) {
        return;
      }

      if (!event.data || event.data.type !== "booking-widget:height") {
        return;
      }

      var frames = document.querySelectorAll("iframe[data-booking-widget], iframe[data-booking-page-view]");
      for (var i = 0; i < frames.length; i += 1) {
        var frame = frames[i];
        if (frame.contentWindow === event.source) {
          frame.style.height = Math.max(320, Number(event.data.height) || 0) + "px";
        }
      }
    }

    window.addEventListener("message", resizeBookingEmbed);
  })();
</script>`;
  const iframeSnippet = `<iframe
  src="${widgetUrl}"
  data-booking-widget
  style="width:100%;height:640px;border:0;display:block;overflow:hidden"
  loading="eager"
  scrolling="no"
></iframe>
${iframeResizeScript}`;
  const pageViewIframeSnippet = `<iframe
  src="${pageViewUrl}"
  data-booking-page-view
  style="width:100%;height:960px;border:0;display:block;overflow:hidden"
  loading="eager"
  scrolling="no"
></iframe>
${iframeResizeScript}`;

  return `
    <section class="layout">
      ${renderPageHeader({
        eyebrow: "Embed Setup",
        title: "Choose the live widget source",
        meta: "Select the company, establishment, and seat-count calendar that the public website should embed.",
      })}
      <article class="panel full-width">
        <div class="two-column-layout">
          <div class="inner-panel">
            <p class="eyebrow">Selection</p>
            <h3>Widget source</h3>
            <div class="form-grid form-grid-three">
              <div class="field">
                <label for="setup-company">Company</label>
                <select id="setup-company" data-setup-company>
                  ${!companies.length ? '<option value="">No companies yet</option>' : ""}
                  ${companies
                    .map(
                      (company) => `
                        <option value="${company.id}" ${state.widgetSetup.companyId === company.id ? "selected" : ""}>
                          ${escapeHtml(company.name)}
                        </option>
                      `,
                    )
                    .join("")}
                </select>
              </div>
              <div class="field">
                <label for="setup-establishment">Establishment</label>
                <select id="setup-establishment" data-setup-establishment>
                  ${!establishments.length ? '<option value="">No establishments yet</option>' : ""}
                  ${establishments
                    .map(
                      (establishment) => `
                        <option value="${establishment.id}" ${state.widgetSetup.establishmentId === establishment.id ? "selected" : ""}>
                          ${escapeHtml(establishment.name)}
                        </option>
                      `,
                    )
                    .join("")}
                </select>
              </div>
              <div class="field">
                <label for="setup-seat-count">Seat-count calendar</label>
                <select id="setup-seat-count" data-setup-seat-count>
                  ${!seatCounts.length ? '<option value="">No seat-count calendars yet</option>' : ""}
                  ${seatCounts
                    .map(
                      (seatCount) => `
                        <option value="${seatCount.id}" ${state.widgetSetup.seatCountId === seatCount.id ? "selected" : ""}>
                          ${escapeHtml(seatCount.label)}
                        </option>
                      `,
                    )
                    .join("")}
                </select>
              </div>
            </div>
            ${renderStatus("widgetSetup")}
            ${
              !companies.length
                ? '<div class="empty">Create a company first in Admin.</div>'
                : !establishments.length
                  ? '<div class="empty">Create an establishment for this company in Admin.</div>'
                  : !seatCounts.length
                    ? '<div class="empty">Create at least one seat count for this establishment in Admin.</div>'
                    : ""
            }
          </div>
          <aside class="inner-panel">
            <p class="eyebrow">Current target</p>
            <h3>${escapeHtml(getSelectedSeatCountLabel() || "No seat count selected")}</h3>
            <p class="meta">${escapeHtml(getSelectedEstablishmentLabel() || "")}</p>
            <p class="meta">The public widget no longer shows company, establishment, or seat-count selectors. Those are configured here and passed in the URL.</p>
          </aside>
        </div>
      </article>
      ${renderSectionPanel({
        id: "widget-setup-share",
        eyebrow: "Share",
        title: "Widget URL and embed code",
        meta: "Copy the direct URLs for testing or the iframe snippets for the external website.",
        open: true,
        content: `
          <div class="section-content-grid">
            <div class="inner-panel">
              <label>Widget URL</label>
              <div class="copy-row">
                <input readonly value="${escapeHtml(widgetUrl)}" />
                <button type="button" class="ghost-button" data-action="copyWidgetUrl" data-url="${escapeHtml(widgetUrl)}">Copy URL</button>
                <button type="button" class="ghost-button" data-action="openWidgetPreview" data-url="${escapeHtml(widgetUrl)}">Open preview</button>
              </div>
            </div>
            <div class="inner-panel">
              <label>Embed code</label>
              <div class="copy-row">
                <textarea readonly rows="6">${escapeHtml(iframeSnippet)}</textarea>
                <button type="button" class="ghost-button" data-action="copyWidgetEmbed" data-url="${escapeHtml(iframeSnippet)}">Copy embed</button>
              </div>
            </div>
            <div class="inner-panel">
              <label>Page view URL</label>
              <div class="copy-row">
                <input readonly value="${escapeHtml(pageViewUrl)}" />
                <button type="button" class="ghost-button" data-action="copyPageViewUrl" data-url="${escapeHtml(pageViewUrl)}">Copy URL</button>
                <button type="button" class="ghost-button" data-action="openPageViewPreview" data-url="${escapeHtml(pageViewUrl)}">Open preview</button>
              </div>
            </div>
            <div class="inner-panel">
              <label>Page view embed code</label>
              <div class="copy-row">
                <textarea readonly rows="6">${escapeHtml(pageViewIframeSnippet)}</textarea>
                <button type="button" class="ghost-button" data-action="copyPageViewEmbed" data-url="${escapeHtml(pageViewIframeSnippet)}">Copy embed</button>
              </div>
            </div>
          </div>
        `,
      })}
    </section>
  `;
}

function renderWidgetEditorPage() {
  return renderThemeEditorPage(getThemeEditorConfig("booking_calendar"));
}

function renderPageViewEditorPage() {
  return renderThemeEditorPage(getThemeEditorConfig("booking_page_view"));
}

function renderThemeEditorPage(editor) {
  const companies = getWidgetEditorCompanies();
  const establishments = getWidgetEditorEstablishments();
  const selectedEstablishment = getSelectedWidgetEditorEstablishment();
  const previewUrl = getThemeEditorPreviewUrl(editor.key);
  const uploadLimitLabel = formatMegabytes(state.appSettings.widgetEditorUploadLimitBytes);
  const savedPrompts = getActiveThemeEditorPrompts();
  const hasSavedThemeEditorCss = hasThemeEditorSavedCss(selectedEstablishment, editor.key);
  const savedBaselineLabel =
    editor.key === "booking_page_view"
      ? "Start from the most recent saved page and CSS"
      : "Work from the most recent saved CSS only";
  const savedBaselineMeta =
    editor.key === "booking_page_view"
      ? hasSavedThemeEditorCss
        ? "Follow-up generations will use the latest saved page and CSS as the starting point, but your new prompt can fully restructure, rewrite, add, remove, or redesign the page."
        : "This option becomes available after you save the generated page and CSS once."
      : hasSavedThemeEditorCss
        ? "Follow-up generations will preserve the latest saved CSS as the baseline and only apply the requested change."
        : "This option becomes available after you save CSS once.";

  return `
    <section class="layout">
      ${renderPageHeader({
        eyebrow: editor.eyebrow,
        title: editor.title,
        meta: editor.meta,
      })}
      ${renderProminentProcessStatus("widgetEditor")}
      <article class="panel panel-span-5">
        <p class="eyebrow">Generator</p>
        <h2>Prompt and references</h2>
        <p class="meta">${escapeHtml(editor.generatorMeta)}</p>
        ${
          !companies.length
            ? `<div class="empty">${escapeHtml(editor.emptyState)}</div>`
            : ""
        }
        <form class="stack" data-widget-editor-generate-form>
          <input type="hidden" name="widgetKey" value="${escapeHtml(editor.key)}" />
          <div class="form-grid">
            <div class="field">
              <label for="widget-editor-company">Company</label>
              <select id="widget-editor-company" data-widget-editor-company name="companyId">
                ${!companies.length ? '<option value="">No companies yet</option>' : ""}
                ${companies
                  .map(
                    (company) => `
                      <option value="${company.id}" ${state.widgetEditor.companyId === company.id ? "selected" : ""}>
                        ${escapeHtml(company.name)}
                      </option>
                    `,
                  )
                  .join("")}
              </select>
            </div>
            <div class="field">
              <label for="widget-editor-establishment">Establishment</label>
              <select id="widget-editor-establishment" data-widget-editor-establishment name="establishmentId">
                ${!establishments.length ? '<option value="">No establishments yet</option>' : ""}
                ${establishments
                  .map(
                    (establishment) => `
                      <option value="${establishment.id}" ${state.widgetEditor.establishmentId === establishment.id ? "selected" : ""}>
                        ${escapeHtml(establishment.name)}
                      </option>
                    `,
                  )
                  .join("")}
              </select>
            </div>
            <div class="field">
              <label for="widget-editor-model">Model</label>
              <select id="widget-editor-model" name="model" data-widget-editor-model>
                ${renderOpenAiModelOptions(state.widgetEditor.model)}
              </select>
            </div>
            <div class="field">
              <label for="widget-editor-reasoning">Reasoning</label>
              <select id="widget-editor-reasoning" name="reasoningEffort" data-widget-editor-reasoning>
                ${renderOpenAiReasoningEffortOptions(state.widgetEditor.reasoningEffort)}
              </select>
            </div>
            <div class="field">
              <label for="widget-editor-files">Reference files</label>
              <input
                id="widget-editor-files"
                type="file"
                accept=".pdf,.txt,.md,.json,.html,.css,.doc,.docx,.ppt,.pptx,.csv,.png,.jpg,.jpeg,.webp,.gif"
                multiple
                data-widget-editor-files
              />
              <p class="meta">Current total upload limit: ${escapeHtml(uploadLimitLabel)} MB.</p>
            </div>
            <div class="field">
              <label for="widget-editor-prompt-name">Prompt name</label>
              <input
                id="widget-editor-prompt-name"
                name="promptName"
                placeholder="${escapeHtml(editor.promptNamePlaceholder)}"
                value="${escapeHtml(state.widgetEditor.promptName)}"
                data-widget-editor-prompt-name
              />
            </div>
            <div class="field full">
              <label for="widget-editor-prompt">Design request</label>
              <textarea
                id="widget-editor-prompt"
                name="requestText"
                rows="8"
                placeholder="${escapeHtml(editor.promptPlaceholder)}"
                data-widget-editor-prompt
              >${escapeHtml(state.widgetEditor.prompt)}</textarea>
            </div>
            <div class="field full">
              <label class="checkbox">
                <input
                  id="widget-editor-use-saved-baseline"
                  type="checkbox"
                  ${state.widgetEditor.useSavedBaseline ? "checked" : ""}
                  ${hasSavedThemeEditorCss ? "" : "disabled"}
                  data-widget-editor-use-saved-baseline
                />
                ${escapeHtml(savedBaselineLabel)}
              </label>
              <p class="meta">${escapeHtml(savedBaselineMeta)}</p>
            </div>
          </div>
          <div class="subsection">
            <div class="panel-head">
              <div>
                <p class="eyebrow">Saved prompts</p>
                <p class="meta">Load a saved prompt, edit the name or text, then save to update it. Use New prompt to keep the current text but save it as a separate item.</p>
              </div>
              <div class="stack-inline">
                <button type="button" class="ghost-button" data-action="saveWidgetEditorPrompt">
                  ${state.widgetEditor.selectedPromptId ? "Update prompt" : "Save prompt"}
                </button>
                <button type="button" class="ghost-button" data-action="clearWidgetEditorPromptSelection">New prompt</button>
              </div>
            </div>
            ${
              savedPrompts.length
                ? `
                  <div class="saved-prompt-list">
                    ${savedPrompts
                      .map(
                        (prompt) => `
                          <div class="saved-prompt-card ${state.widgetEditor.selectedPromptId === prompt.id ? "is-selected" : ""}">
                            <div class="entity-row">
                              <div>
                                <strong>${escapeHtml(prompt.name)}</strong>
                                <p class="meta">${escapeHtml(formatSavedPromptUpdatedAt(prompt.updatedAt))}</p>
                              </div>
                              <div class="stack-inline">
                                <button type="button" class="ghost-button" data-action="loadWidgetEditorPrompt" data-prompt-id="${prompt.id}">Load</button>
                                <button type="button" class="ghost-button" data-action="deleteWidgetEditorPrompt" data-prompt-id="${prompt.id}">Delete</button>
                              </div>
                            </div>
                            <p class="saved-prompt-preview">${escapeHtml(previewWidgetEditorPrompt(prompt.promptText))}</p>
                          </div>
                        `,
                      )
                      .join("")}
                  </div>
                `
                : '<div class="empty">No saved prompts yet.</div>'
            }
          </div>
          ${state.widgetEditor.attachments.length ? `
            <div class="subsection">
              <p class="eyebrow">Attachments</p>
              <div class="chip-row">
                ${state.widgetEditor.attachments
                  .map(
                    (attachment, index) => `
                      <span class="chip">
                        ${escapeHtml(attachment.name)}
                        <button
                          type="button"
                          class="mini-button"
                          data-action="removeWidgetEditorAttachment"
                          data-index="${index}"
                        >
                          Remove
                        </button>
                      </span>
                    `,
                  )
                  .join("")}
              </div>
            </div>
          ` : ""}
          <div class="stack-inline">
            <button type="submit">Generate CSS</button>
            ${previewUrl ? `<button type="button" class="ghost-button" data-action="openWidgetEditorPreview" data-url="${escapeHtml(previewUrl)}">${escapeHtml(editor.previewLabel)}</button>` : ""}
          </div>
        </form>
        ${renderStatus("widgetEditor")}
      </article>
      <article class="panel panel-span-7">
        <p class="eyebrow">CSS Workspace</p>
        <h3>${escapeHtml(editor.workspaceTitle)}</h3>
        <p class="meta">${escapeHtml(editor.workspaceMeta)}</p>
        <form class="stack" data-widget-editor-save-form>
          <input type="hidden" name="widgetKey" value="${escapeHtml(editor.key)}" />
          <input type="hidden" name="establishmentId" value="${escapeHtml(state.widgetEditor.establishmentId)}" />
          ${
            editor.key === "booking_page_view"
              ? `
                <div class="field">
                  <label for="widget-editor-content">Page content JSON</label>
                  <textarea
                    id="widget-editor-content"
                    name="contentText"
                    class="code-input"
                    rows="16"
                    placeholder="${escapeHtml(editor.contentPlaceholder)}"
                    data-widget-editor-content
                  >${escapeHtml(state.widgetEditor.draftContentText)}</textarea>
                </div>
              `
              : ""
          }
          <div class="field">
            <label for="widget-editor-css">CSS</label>
            <textarea
              id="widget-editor-css"
              name="cssText"
              class="code-input"
              rows="22"
              placeholder="${escapeHtml(editor.cssPlaceholder)}"
              data-widget-editor-css
            >${escapeHtml(state.widgetEditor.draftCss)}</textarea>
          </div>
          <div class="stack-inline">
            <button type="submit">Save CSS</button>
            <button type="button" class="ghost-button" data-action="resetWidgetCssDraft">Reset to saved</button>
          </div>
        </form>
      </article>
    </section>
  `;
}

function renderProminentProcessStatus(scope) {
  const status = state.statuses[scope];
  if (!status?.message || status.processing !== true) {
    return "";
  }

  return `
    <article class="panel full-width prominent-process-panel" aria-live="polite">
      <div class="prominent-process-banner">
        <div class="prominent-process-spinner" aria-hidden="true"></div>
        <div>
          <strong>Processing</strong>
          <p class="meta">${escapeHtml(status.message)}</p>
        </div>
      </div>
    </article>
  `;
}

function beginScopedWorkspaceLoad() {
  if (location.pathname !== "/settings" || !hasSettingsAccess() || !isScopedSettingsSession()) {
    return;
  }

  setStatus("workspace", "info", "Loading your establishment workspace...", { processing: true });
}

function getThemeEditorConfig(key = getActiveThemeEditorKey()) {
  if (key === "booking_page_view") {
    return {
      key,
      eyebrow: "Page View Editor",
      title: "Generate and manage booking page CSS",
      meta: "Choose the target establishment, attach reference files, describe the actual page you want, and generate both page structure and CSS for the standalone booking page.",
      generatorMeta: "Pick a company and establishment, describe the page layout, copy, emphasis, and visual direction, attach reference files, and generate a full booking page around the calendar.",
      emptyState: "Create a company and establishment in settings before using the page view editor.",
      promptNamePlaceholder: "Example: Warm coastal booking page",
      promptPlaceholder: "Example: Build a centered booking page that matches the uploaded site, uses the provided copy tone, keeps the calendar as the hero focus, and adds a restrained supporting section below it.",
      workspaceTitle: "Booking page CSS",
      workspaceMeta: "The generator builds the actual booking page structure plus scoped CSS for the selected establishment. Use the prompt to control layout, copy, and how prominent the calendar should be.",
      contentPlaceholder: '{\n  "kicker": "Reservations",\n  "title": "Book a table",\n  "intro": "Describe the page here.",\n  "sections": []\n}',
      cssPlaceholder: ".page-view-theme-root { ... }",
      previewPath: "/page-view",
      previewLabel: "Open page preview",
      generatedLabel: "Booking page CSS",
      savedLabel: "Booking page CSS",
    };
  }

  return {
    key: "booking_calendar",
    eyebrow: "Theme Editor",
    title: "Generate and manage widget CSS",
    meta: "Choose the target establishment, attach reference files, save prompt templates, and edit the final CSS.",
    generatorMeta: "Pick a company and establishment, describe the visual direction, attach reference files, and generate CSS for the booking widget.",
    emptyState: "Create a company and establishment in settings before using the widget editor.",
    promptNamePlaceholder: "Example: Warm coastal booking widget",
    promptPlaceholder: "Example: Match the restaurant site. Use the uploaded hero image colors, a warmer cream background, sharper card corners, and bolder selected-day states.",
    workspaceTitle: "Booking calendar CSS",
    workspaceMeta: "This CSS is scoped to the selected establishment's booking widget and applies across its seat-count calendars.",
    contentPlaceholder: "",
    cssPlaceholder: ".widget-theme-root { ... }",
    previewPath: "/widget",
    previewLabel: "Open widget preview",
    generatedLabel: "Widget CSS",
    savedLabel: "Widget CSS",
  };
}

function renderWidgetPage() {
  const previewPayload = getThemeEditorPreviewPayload();
  return renderBookingExperiencePage({
    themeRootClass: "widget-theme-root",
    layoutClass: "widget-layout",
    panelClass: "widget-calendar-panel",
    themeCss: previewPayload.cssText || getSelectedWidgetSeatCount()?.widgetThemeCss || "",
    title: "",
    copy: "",
    pageContent: null,
  });
}

function renderPageViewPage() {
  const previewPayload = getThemeEditorPreviewPayload();
  return renderBookingExperiencePage({
    themeRootClass: "page-view-theme-root",
    layoutClass: "page-view-layout",
    panelClass: "page-view-panel",
    themeCss: previewPayload.cssText || getSelectedWidgetSeatCount()?.pageViewThemeCss || "",
    title: "",
    copy: "",
    pageContent:
      parsePageViewContentText(previewPayload.contentText) ||
      parsePageViewContentText(getSelectedWidgetSeatCount()?.pageViewThemeContentText),
  });
}

function renderBookingExperiencePage({ themeRootClass, layoutClass, panelClass, themeCss, title, copy, pageContent }) {
  if (!state.widget.seatCountId || !getSelectedWidgetSeatCount()) {
    const isPageView = themeRootClass === "page-view-theme-root";
    return `
      <section class="layout">
        <article class="panel full-width">
          <p class="eyebrow">${isPageView ? "Booking page view" : "Widget view"}</p>
          <h2>${isPageView ? "Booking page not configured" : "Widget not configured"}</h2>
          <p class="meta">
            ${isPageView
              ? "This booking page needs a configured seatCountId in the URL."
              : "This booking widget needs a configured seatCountId in the URL."}
          </p>
          <p class="meta">Example: <code>${isPageView ? "/page-view" : "/widget"}?seatCountId=...</code></p>
        </article>
      </section>
    `;
  }

  const activeDate = state.widgetAvailability.find((item) => item.date === state.widget.selectedDate) ?? null;
  const isPageView = themeRootClass === "page-view-theme-root";
  const resolvedPageContent = isPageView ? pageContent || getDefaultPageViewContent() : null;

  return `
    ${themeCss ? `<style>${escapeStyleTagContent(themeCss)}</style>` : ""}
    <section class="layout ${escapeHtml(layoutClass)} ${escapeHtml(themeRootClass)}">
      <article class="panel full-width ${escapeHtml(panelClass)}">
        ${
          isPageView
            ? renderPageViewLayout(resolvedPageContent)
            : `
              ${renderStatus("widget")}
              ${renderCalendarNavigator()}
              ${renderWidgetCalendar()}
            `
        }
      </article>
      ${renderWidgetModal(activeDate)}
    </section>
  `;
}

function renderPageViewLayout(pageContent) {
  const content = pageContent || getDefaultPageViewContent();
  const hasHeroSection = content.sections.some((section) => section.type === "hero");

  return `
    ${
      !hasHeroSection && (content.kicker || content.title || content.intro)
        ? `
          <div class="page-view-header">
            ${content.kicker ? `<p class="eyebrow page-view-kicker">${escapeHtml(content.kicker)}</p>` : ""}
            ${content.title ? `<h1 class="page-view-title">${escapeHtml(content.title)}</h1>` : ""}
            ${content.intro ? `<p class="meta page-view-copy">${escapeHtml(content.intro)}</p>` : ""}
          </div>
        `
        : ""
    }
    <div class="page-view-sections">
      ${content.sections.map((section) => renderPageViewSection(section)).join("")}
    </div>
  `;
}

function renderPageViewImage(section, options = {}) {
  const imageUrl = String(section?.imageUrl ?? "").trim();
  if (!imageUrl) {
    return "";
  }

  const loading = options.loading === "eager" ? "eager" : "lazy";
  const fetchpriority = options.fetchpriority === "high" ? "high" : "low";
  const altText = section.imageAlt || section.title || "Booking page image";
  return `<img class="page-view-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(altText)}" loading="${loading}" decoding="async" fetchpriority="${fetchpriority}" />`;
}

function renderPageViewSection(section) {
  if (!section || typeof section !== "object") {
    return "";
  }

  if (section.type === "hero") {
    return `
      <section class="page-view-section page-view-section-hero ${section.align === "center" ? "is-centered" : ""}">
        <div class="page-view-section-copy">
          ${section.eyebrow ? `<p class="eyebrow page-view-kicker">${escapeHtml(section.eyebrow)}</p>` : ""}
          ${section.title ? `<h1 class="page-view-title">${escapeHtml(section.title)}</h1>` : ""}
          ${section.copy ? `<p class="meta page-view-copy">${escapeHtml(section.copy)}</p>` : ""}
        </div>
        ${
          section.imageUrl
            ? `
              <div class="page-view-section-media">
                ${renderPageViewImage(section, { loading: "eager", fetchpriority: "high" })}
              </div>
            `
            : ""
        }
      </section>
    `;
  }

  if (section.type === "text") {
    return `
      <section class="page-view-section page-view-section-text ${section.align === "center" ? "is-centered" : ""}">
        ${section.eyebrow ? `<p class="eyebrow page-view-kicker">${escapeHtml(section.eyebrow)}</p>` : ""}
        ${section.title ? `<h2>${escapeHtml(section.title)}</h2>` : ""}
        ${section.copy ? `<p class="meta page-view-copy">${escapeHtml(section.copy)}</p>` : ""}
      </section>
    `;
  }

  if (section.type === "split") {
    return `
      <section class="page-view-section page-view-section-split ${section.imagePosition === "left" ? "media-left" : "media-right"}">
        ${
          section.imageUrl
            ? `
              <div class="page-view-section-media">
                ${renderPageViewImage(section)}
              </div>
            `
            : ""
        }
        <div class="page-view-section-copy">
          ${section.eyebrow ? `<p class="eyebrow page-view-kicker">${escapeHtml(section.eyebrow)}</p>` : ""}
          ${section.title ? `<h2>${escapeHtml(section.title)}</h2>` : ""}
          ${section.copy ? `<p class="meta page-view-copy">${escapeHtml(section.copy)}</p>` : ""}
        </div>
      </section>
    `;
  }

  if (section.type === "highlights") {
    return `
      <section class="page-view-section page-view-section-highlights">
        ${section.eyebrow ? `<p class="eyebrow page-view-kicker">${escapeHtml(section.eyebrow)}</p>` : ""}
        ${section.title ? `<h2>${escapeHtml(section.title)}</h2>` : ""}
        <div class="page-view-highlight-grid">
          ${(section.items ?? [])
            .map(
              (item) => `
                <article class="page-view-highlight-card">
                  ${item.title ? `<h3>${escapeHtml(item.title)}</h3>` : ""}
                  ${item.copy ? `<p class="meta">${escapeHtml(item.copy)}</p>` : ""}
                </article>
              `,
            )
            .join("")}
        </div>
      </section>
    `;
  }

  if (section.type === "image") {
    return `
      <section class="page-view-section page-view-section-image">
        ${
          section.imageUrl
            ? renderPageViewImage(section)
            : ""
        }
        ${section.caption ? `<p class="meta page-view-copy">${escapeHtml(section.caption)}</p>` : ""}
      </section>
    `;
  }

  if (section.type === "quote") {
    return `
      <section class="page-view-section page-view-section-quote">
        ${section.quote ? `<blockquote class="page-view-quote">${escapeHtml(section.quote)}</blockquote>` : ""}
        ${section.attribution ? `<p class="meta">${escapeHtml(section.attribution)}</p>` : ""}
      </section>
    `;
  }

  if (section.type === "calendar") {
    return `
      <section class="page-view-section page-view-section-calendar">
        ${section.eyebrow ? `<p class="eyebrow page-view-kicker">${escapeHtml(section.eyebrow)}</p>` : ""}
        ${section.title ? `<h2>${escapeHtml(section.title)}</h2>` : ""}
        ${section.copy ? `<p class="meta page-view-copy">${escapeHtml(section.copy)}</p>` : ""}
        ${renderStatus("widget")}
        ${renderCalendarNavigator()}
        ${renderWidgetCalendar()}
      </section>
    `;
  }

  return "";
}

function parsePageViewContentText(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    return normalizePageViewContent(parsed);
  } catch {
    return null;
  }
}

function getDefaultPageViewContent() {
  return {
    kicker: "Reservations",
    title: "Book a table",
    intro: "Choose a day, pick a time, and confirm your booking details.",
    sections: [
      {
        type: "calendar",
        eyebrow: "Book now",
        title: "Select your booking time",
        copy: "Choose a date and time to continue.",
      },
    ],
  };
}

function normalizePageViewContent(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const sections = Array.isArray(input.sections)
    ? input.sections.map(normalizePageViewSection).filter(Boolean)
    : [];

  if (!sections.some((section) => section.type === "calendar")) {
    sections.push(getDefaultPageViewContent().sections[0]);
  }

  return {
    kicker: String(input.kicker ?? "").trim(),
    title: String(input.title ?? "").trim() || "Book a table",
    intro: String(input.intro ?? "").trim(),
    sections,
  };
}

function normalizePageViewSection(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const type = String(input.type ?? "").trim().toLowerCase();
  if (!["hero", "text", "split", "highlights", "image", "quote", "calendar"].includes(type)) {
    return null;
  }

  if (type === "highlights") {
    return {
      type,
      eyebrow: String(input.eyebrow ?? "").trim(),
      title: String(input.title ?? "").trim(),
      items: Array.isArray(input.items)
        ? input.items
            .map((item) => ({
              title: String(item?.title ?? "").trim(),
              copy: String(item?.copy ?? "").trim(),
            }))
            .filter((item) => item.title || item.copy)
        : [],
    };
  }

  if (type === "quote") {
    return {
      type,
      quote: String(input.quote ?? "").trim(),
      attribution: String(input.attribution ?? "").trim(),
    };
  }

  return {
    type,
    eyebrow: String(input.eyebrow ?? "").trim(),
    title: String(input.title ?? "").trim(),
    copy: String(input.copy ?? "").trim(),
    align: String(input.align ?? "").trim().toLowerCase() === "center" ? "center" : "left",
    imageUrl: String(input.imageUrl ?? "").trim(),
    imageAlt: String(input.imageAlt ?? "").trim(),
    imagePosition: String(input.imagePosition ?? "").trim().toLowerCase() === "left" ? "left" : "right",
    caption: String(input.caption ?? "").trim(),
  };
}

function renderSessionSummary(compact = false) {
  if (!state.session) {
    return `<p class="meta">No active session.</p>`;
  }

  const establishment = getEstablishmentLabel(state.session.establishmentId);

  if (compact) {
    return `
      <div class="identity-card">
        <div class="identity">
          ${escapeHtml(state.session.firstName)} ${escapeHtml(state.session.lastName)}
        </div>
        <p class="meta">${escapeHtml(state.session.email)} | ${escapeHtml(state.session.authLevel)}</p>
        ${establishment ? `<p class="meta">${escapeHtml(establishment)}</p>` : ""}
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
      ${establishment ? `<p class="meta">${escapeHtml(establishment)}</p>` : ""}
      <button type="button" class="ghost-button" data-action="logout">Sign out</button>
    </div>
  `;
}

function renderEmailSettingsPanel() {
  return `
    <div class="stack">
      <div>
        <p class="eyebrow">Test send</p>
        <h3>Send a real confirmation email</h3>
        <p class="meta">This uses the live SMTP environment variables and the same HTML template sent after a booking is created.</p>
      </div>
      <form class="stack" data-email-test-form>
        <div class="form-grid">
          <div class="field full">
            <label for="email-test-recipient">Send preview to</label>
            <input
              id="email-test-recipient"
              name="recipientEmail"
              type="email"
              value="${escapeHtml(state.emailTestDraft.recipientEmail)}"
              data-email-test-draft
              required
            />
          </div>
          <div class="field">
            <label for="email-test-first-name">Guest first name</label>
            <input
              id="email-test-first-name"
              name="firstName"
              value="${escapeHtml(state.emailTestDraft.firstName)}"
              data-email-test-draft
              required
            />
          </div>
          <div class="field">
            <label for="email-test-last-name">Guest last name</label>
            <input
              id="email-test-last-name"
              name="lastName"
              value="${escapeHtml(state.emailTestDraft.lastName)}"
              data-email-test-draft
              required
            />
          </div>
          <div class="field">
            <label for="email-test-guest-email">Guest email shown in confirmation</label>
            <input
              id="email-test-guest-email"
              name="guestEmail"
              type="email"
              value="${escapeHtml(state.emailTestDraft.guestEmail)}"
              data-email-test-draft
              required
            />
          </div>
          <div class="field">
            <label for="email-test-phone">Guest phone</label>
            <input
              id="email-test-phone"
              name="phone"
              value="${escapeHtml(state.emailTestDraft.phone)}"
              data-email-test-draft
              required
            />
          </div>
          <div class="field">
            <label for="email-test-establishment">Establishment</label>
            <input
              id="email-test-establishment"
              name="establishmentName"
              value="${escapeHtml(state.emailTestDraft.establishmentName)}"
              data-email-test-draft
              required
            />
          </div>
          <div class="field">
            <label for="email-test-date">Booking date</label>
            <input
              id="email-test-date"
              name="bookingDate"
              type="date"
              value="${escapeHtml(state.emailTestDraft.bookingDate)}"
              data-email-test-draft
              required
            />
          </div>
          <div class="field">
            <label for="email-test-time">Booking time</label>
            <input
              id="email-test-time"
              name="bookingTime"
              type="time"
              value="${escapeHtml(state.emailTestDraft.bookingTime)}"
              data-email-test-draft
              required
            />
          </div>
          <div class="field">
            <label for="email-test-party-size">Party size</label>
            <input
              id="email-test-party-size"
              name="partySize"
              type="number"
              min="1"
              step="1"
              value="${escapeHtml(state.emailTestDraft.partySize)}"
              data-email-test-draft
              required
            />
          </div>
          <div class="field full">
            <label for="email-test-notes">Special requests</label>
            <textarea
              id="email-test-notes"
              name="notes"
              rows="4"
              data-email-test-draft
            >${escapeHtml(state.emailTestDraft.notes)}</textarea>
          </div>
        </div>
        <div class="email-test-summary">
          <strong>Template contents</strong>
          <span>The email includes the booking reference, venue, guest details, date, time, party size, phone, and notes in a production-style layout.</span>
        </div>
        <div class="stack-inline">
          <button type="submit">Send test email</button>
        </div>
      </form>
    </div>
  `;
}

function renderEmailConfigSummary() {
  const emailSettings = state.appSettings.emailSettings ?? createDefaultEmailSettingsSummary();
  const statusLabel = emailSettings.configured ? "Ready to send" : "Configuration incomplete";
  const secureLabel = emailSettings.secure ? "TLS / SSL" : "STARTTLS or plain";

  return `
    <div class="stack">
      <div class="config-pill-row">
        <span class="config-pill ${emailSettings.configured ? "is-good" : "is-warn"}">${escapeHtml(statusLabel)}</span>
        <span class="config-pill">${escapeHtml(emailSettings.host || "No host")}</span>
        <span class="config-pill">Port ${escapeHtml(emailSettings.port || "unset")}</span>
        <span class="config-pill">${escapeHtml(secureLabel)}</span>
      </div>
      <div class="email-config-list">
        <div class="email-config-row">
          <strong>From address</strong>
          <span>${escapeHtml(emailSettings.fromAddress || "Not set")}</span>
        </div>
        <div class="email-config-row">
          <strong>SMTP user</strong>
          <span>${escapeHtml(emailSettings.user || "Not set")}</span>
        </div>
      </div>
      ${
        emailSettings.missingEnvVars?.length
          ? `<p class="meta">Missing environment variables: ${escapeHtml(emailSettings.missingEnvVars.join(", "))}</p>`
          : `<p class="meta">All required SMTP variables are present. Test sends will use these live values immediately.</p>`
      }
    </div>
  `;
}

function renderOpenAiSettingsForm() {
  return `
    <form class="stack" data-openai-settings-form>
      <div class="field">
        <label for="openai-model">Default OpenAI model</label>
        <select id="openai-model" name="openAiModel" data-openai-model-draft>
          ${renderOpenAiModelOptions(state.openAiModelDraft)}
        </select>
      </div>
      <div class="field">
        <label for="openai-reasoning-effort">Reasoning effort for widget CSS generation</label>
        <select
          id="openai-reasoning-effort"
          name="openAiReasoningEffort"
          data-openai-reasoning-effort-draft
        >
          ${renderOpenAiReasoningEffortOptions(state.openAiReasoningEffortDraft)}
        </select>
        <p class="meta">Uses the Responses API <code>reasoning.effort</code> setting. Some models support only a subset of values.</p>
      </div>
      <div class="field">
        <label for="widget-editor-upload-limit">Widget reference upload limit (MB)</label>
        <input
          id="widget-editor-upload-limit"
          name="widgetEditorUploadLimitMb"
          type="number"
          min="0.5"
          max="3"
          step="0.1"
          value="${escapeHtml(state.widgetEditorUploadLimitDraftMb)}"
          data-widget-editor-upload-limit-draft
        />
        <p class="meta">Practical max is 3.0 MB total. The hosted function request body is capped at 4.5 MB and attachments expand when base64-encoded.</p>
      </div>
      <div class="field">
        <label for="widget-editor-max-output-tokens">Widget CSS max output tokens</label>
        <input
          id="widget-editor-max-output-tokens"
          name="widgetEditorMaxOutputTokens"
          type="number"
          min="1000"
          max="50000"
          step="1000"
          value="${escapeHtml(state.widgetEditorMaxOutputTokensDraft)}"
          data-widget-editor-max-output-tokens-draft
        />
        <p class="meta">High reasoning models may need far more token budget. OpenAI recommends starting with about 25,000 when experimenting with reasoning runs.</p>
      </div>
      <div class="stack-inline">
        <button type="submit">Save settings</button>
      </div>
    </form>
  `;
}

function renderOpenAiModelOptions(selectedModel) {
  const models = [
    "gpt-5.4-nano",
    "gpt-5.4-mini",
    "gpt-5.4",
    "gpt-5.5",
  ];
  if (selectedModel && !models.includes(selectedModel)) {
    models.unshift(selectedModel);
  }

  return models
    .map(
      (model) => `
        <option value="${model}" ${selectedModel === model ? "selected" : ""}>
          ${escapeHtml(model)}
        </option>
      `,
    )
    .join("");
}

function renderOpenAiReasoningEffortOptions(selectedValue) {
  const options = [
    { value: "", label: "Model default" },
    { value: "none", label: "None" },
    { value: "minimal", label: "Minimal" },
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
    { value: "xhigh", label: "XHigh" },
  ];

  return options
    .map(
      (option) => `
        <option value="${option.value}" ${selectedValue === option.value ? "selected" : ""}>
          ${escapeHtml(option.label)}
        </option>
      `,
    )
    .join("");
}

function renderUserForm(lockAdminLevel, options = {}) {
  const restrictToStaff = options.restrictToStaff === true;
  const hideAssignmentFields = options.hideAssignmentFields === true;
  const hideRoleField = options.hideRoleField === true;
  const fixedCompanyId = restrictToStaff ? state.session?.companyId ?? "" : "";
  const fixedEstablishmentId = restrictToStaff ? state.session?.establishmentId ?? "" : "";
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

  const establishmentOptions = [
    '<option value="">No establishment</option>',
    ...getAllEstablishments().map(
      (establishment) => `
        <option value="${establishment.id}" ${state.userForm.establishmentId === establishment.id ? "selected" : ""}>
          ${escapeHtml(establishment.companyName)} | ${escapeHtml(establishment.name)}
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
          <input id="password" name="password" type="password" value="${escapeHtml(state.userForm.password)}" autocomplete="new-password" ${state.userForm.mode === "create" ? 'minlength="8" required' : 'minlength="8"'} />
        </div>
        <div class="field">
          <label for="confirmPassword">${state.userForm.mode === "edit" ? "Confirm new password" : "Confirm password"}</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value="${escapeHtml(state.userForm.confirmPassword)}"
            autocomplete="new-password"
            ${state.userForm.mode === "create" ? 'minlength="8" required' : ""}
          />
        </div>
        ${
          hideRoleField
            ? `
              <div class="field">
                <label>Auth level</label>
                <input value="Staff" readonly />
                <input type="hidden" name="authLevel" value="staff" />
              </div>
            `
            : `
              <div class="field">
                <label for="authLevel">Auth level</label>
                <select id="authLevel" name="authLevel" ${lockAdminLevel ? "disabled" : ""}>
                  <option value="admin" ${state.userForm.authLevel === "admin" ? "selected" : ""}>Admin</option>
                  <option value="user" ${state.userForm.authLevel === "user" ? "selected" : ""}>User</option>
                  <option value="manager" ${state.userForm.authLevel === "manager" ? "selected" : ""}>Manager</option>
                  <option value="staff" ${state.userForm.authLevel === "staff" ? "selected" : ""}>Staff</option>
                </select>
                ${lockAdminLevel ? '<input type="hidden" name="authLevel" value="admin" />' : ""}
              </div>
            `
        }
        ${
          hideAssignmentFields
            ? `
              <div class="field">
                <label>Company</label>
                <input value="${escapeHtml(getCompanyNameById(fixedCompanyId) || "No company")}" readonly />
                <input type="hidden" name="companyId" value="${escapeHtml(fixedCompanyId)}" />
              </div>
              <div class="field">
                <label>Establishment</label>
                <input value="${escapeHtml(getEstablishmentLabel(fixedEstablishmentId) || "No establishment assigned")}" readonly />
                <input type="hidden" name="establishmentId" value="${escapeHtml(fixedEstablishmentId)}" />
              </div>
            `
            : `
              <div class="field">
                <label for="companyId">Company</label>
                <select id="companyId" name="companyId">${companyOptions}</select>
              </div>
              <div class="field">
                <label for="establishmentId">Establishment</label>
                <select id="establishmentId" name="establishmentId">${establishmentOptions}</select>
              </div>
            `
        }
      </div>
      <div class="stack-inline">
        <button type="submit">${
          state.userForm.mode === "edit"
            ? restrictToStaff
              ? "Save staff member"
              : "Save user"
            : lockAdminLevel
              ? "Create admin"
              : restrictToStaff
                ? "Create staff member"
                : "Create user"
        }</button>
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
      <div class="field">
        <label for="company-enquiry-email">Enquiry email</label>
        <input
          id="company-enquiry-email"
          name="enquiryEmail"
          type="email"
          value="${escapeHtml(state.companyForm.enquiryEmail)}"
          required
        />
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
  const derivedData = getDerivedAdminData();
  const users = getFilteredUsers();
  const canManageUsers = isAdminSession() || isManagerSession();

  if (isManagerSession() && isStatusProcessing("workspace") && !state.users.length) {
    return '<div class="empty loading-empty">Loading staff accounts for this establishment...</div>';
  }

  if (!users.length) {
    return `<div class="empty">${
      isManagerSession() ? "No staff accounts are assigned to this establishment yet." : "No users match the current search."
    }</div>`;
  }

  return users
    .map((user) => {
      const companyName = user.companyId ? derivedData.companyNamesById.get(user.companyId) ?? "Unknown company" : "No company";
      const establishment = user.establishmentId
        ? derivedData.establishmentsById.get(user.establishmentId)?.name ?? "Unknown establishment"
        : "No establishment";
      return `
        <article class="entity-card">
          ${
            canManageUsers
              ? `
                <label class="checkbox entity-select">
                  <input
                    type="checkbox"
                    value="${user.id}"
                    data-user-select
                    ${state.selectedUserIds.has(user.id) ? "checked" : ""}
                  />
                  <span></span>
                </label>
              `
              : ""
          }
          <div class="entity-body">
            <div class="entity-row">
              <div>
                <strong>${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</strong>
                <p class="meta">${escapeHtml(user.email)}</p>
                <p class="meta">${escapeHtml(user.authLevel)} | ${escapeHtml(companyName)}</p>
                <p class="meta">${escapeHtml(establishment)}</p>
              </div>
              ${
                canManageUsers
                  ? `
                    <div class="stack-inline">
                      <button type="button" class="ghost-button" data-action="editUser" data-user-id="${user.id}">Edit</button>
                      <button type="button" class="ghost-button" data-action="deleteUser" data-user-id="${user.id}">Delete</button>
                    </div>
                  `
                  : ""
              }
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderCompanies() {
  const derivedData = getDerivedAdminData();
  const companies = getFilteredCompanies();

  if (!companies.length) {
    return '<div class="empty">No companies match the current search.</div>';
  }

  return companies
    .map((company) => {
      const linkedUsers = derivedData.usersByCompanyId.get(company.id) ?? [];
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
              <p class="meta">${escapeHtml(company.enquiryEmail || "No enquiry email set")}</p>
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
                    .map((user) => `<span class="chip">${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)} · ${escapeHtml(user.authLevel)}</span>`)
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
          <button type="button" class="ghost-button" data-action="editEstablishment" data-company-id="${company.id}" data-establishment-id="${establishment.id}">Edit</button>
          <button type="button" class="ghost-button" data-action="deleteEstablishment" data-establishment-id="${establishment.id}">Delete</button>
          <button type="button" class="ghost-button" data-action="addSeatCount" data-establishment-id="${establishment.id}">Add seat count</button>
        </div>
      </div>
      <div class="subsection hours-editor">
        <div class="entity-row">
          <div>
            <p class="eyebrow">Weekly opening hours</p>
            <p class="meta">These hours repeat every week for all calendars under this establishment.</p>
          </div>
          <button
            type="button"
            class="ghost-button"
            data-action="saveOpeningHours"
            data-establishment-id="${establishment.id}"
          >
            Save hours
          </button>
        </div>
        <div class="hours-grid">
          ${renderOpeningHoursEditor(establishment)}
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
                      ${escapeHtml(formatSeatCountLabel(seatCount))}
                      <button type="button" class="mini-button" data-action="editSeatCount" data-establishment-id="${establishment.id}" data-seat-count-id="${seatCount.id}" data-seat-count="${seatCount.seatCount}" data-max-party-size="${seatCount.maxPartySize}" data-guest-visit-minutes="${seatCount.guestVisitMinutes}">Edit</button>
                      <button type="button" class="mini-button" data-action="deleteSeatCount" data-seat-count-id="${seatCount.id}">Delete</button>
                    </span>
                  `,
                )
                .join("")
            : '<span class="meta">No seat-count calendars yet.</span>'
        }
      </div>
    </div>
  `;
}

function renderOpeningHoursEditor(establishment) {
  return establishment.openingHours
    .map(
      (day) => `
        <div class="hours-row">
          <div class="hours-label">${escapeHtml(day.label)}</div>
          <label class="checkbox compact-checkbox">
            <input
              type="checkbox"
              data-hours-open
              data-establishment-id="${establishment.id}"
              data-weekday="${day.weekdayIndex}"
              ${day.isOpen ? "checked" : ""}
            />
            <span>Open</span>
          </label>
          <input
            type="time"
            step="900"
            data-hours-start
            data-establishment-id="${establishment.id}"
            data-weekday="${day.weekdayIndex}"
            value="${escapeHtml(day.openTime || "09:00")}"
          />
          <input
            type="time"
            step="900"
            data-hours-end
            data-establishment-id="${establishment.id}"
            data-weekday="${day.weekdayIndex}"
            value="${escapeHtml(day.closeTime || "17:00")}"
          />
        </div>
      `,
    )
    .join("");
}

function renderBookingsPanel() {
  if (!canAccessBookingReports() && state.bookingWorkspace.activeTab !== "calendar") {
    state.bookingWorkspace.activeTab = "calendar";
  }

  const companies = getAdminCalendarCompanies();
  const establishments = getAdminCalendarEstablishments();
  const seatCounts = getAdminCalendarSeatCounts();
  const activeTab = canAccessBookingReports() ? state.bookingWorkspace.activeTab : "calendar";
  const seatCountReady = Boolean(companies.length && establishments.length && seatCounts.length);
  const restrictedScope = isManagerSession() || isStaffSession();
  const selectedCompany = companies.find((company) => company.id === state.adminCalendar.companyId) ?? null;
  const selectedEstablishment =
    establishments.find((establishment) => establishment.id === state.adminCalendar.establishmentId) ?? null;
  const selectedSeatCount =
    seatCounts.find((seatCount) => seatCount.id === state.adminCalendar.seatCountId) ?? null;

  return `
    <div class="stack">
      ${
        restrictedScope
          ? `
            <div class="form-grid">
              <div class="field">
                <label>Company</label>
                <input value="${escapeHtml(selectedCompany?.name ?? "No company assigned")}" readonly />
              </div>
              <div class="field">
                <label>Establishment</label>
                <input value="${escapeHtml(selectedEstablishment?.name ?? "No establishment assigned")}" readonly />
              </div>
              <div class="field full">
                <label for="booking-seat-count">Seat-count calendar</label>
                <select id="booking-seat-count" data-booking-seat-count>
                  ${seatCounts.length ? "" : '<option value="">No seat counts</option>'}
                  ${seatCounts
                    .map(
                      (seatCount) => `
                        <option value="${seatCount.id}" ${state.adminCalendar.seatCountId === seatCount.id ? "selected" : ""}>
                          ${escapeHtml(formatSeatCountLabel(seatCount))}
                        </option>
                      `,
                    )
                    .join("")}
                </select>
                ${
                  selectedSeatCount
                    ? `<p class="meta">Viewing the ${escapeHtml(formatSeatCountLabel(selectedSeatCount))} calendar for your establishment.</p>`
                    : ""
                }
                ${
                  isAdminSession() && selectedEstablishment
                    ? `<div class="stack-inline">
                        <button
                          type="button"
                          class="ghost-button"
                          data-action="deleteEstablishmentBookings"
                          data-establishment-id="${selectedEstablishment.id}"
                          data-establishment-name="${escapeHtml(selectedEstablishment.name)}"
                        >
                          Delete all bookings for this establishment
                        </button>
                      </div>`
                    : ""
                }
              </div>
            </div>
          `
          : `
            <div class="form-grid">
              <div class="field">
                <label for="booking-company">Company</label>
                <select id="booking-company" data-booking-company>
                  ${companies
                    .map(
                      (company) => `
                        <option value="${company.id}" ${state.adminCalendar.companyId === company.id ? "selected" : ""}>
                          ${escapeHtml(company.name)}
                        </option>
                      `,
                    )
                    .join("")}
                </select>
              </div>
              <div class="field">
                <label for="booking-establishment">Establishment</label>
                <select id="booking-establishment" data-booking-establishment>
                  ${establishments.length ? "" : '<option value="">No establishments</option>'}
                  ${establishments
                    .map(
                      (establishment) => `
                        <option value="${establishment.id}" ${state.adminCalendar.establishmentId === establishment.id ? "selected" : ""}>
                          ${escapeHtml(establishment.name)}
                        </option>
                      `,
                    )
                    .join("")}
                </select>
              </div>
              <div class="field full">
                <label for="booking-seat-count">Seat-count calendar</label>
                <select id="booking-seat-count" data-booking-seat-count>
                  ${seatCounts.length ? "" : '<option value="">No seat counts</option>'}
                  ${seatCounts
                    .map(
                      (seatCount) => `
                        <option value="${seatCount.id}" ${state.adminCalendar.seatCountId === seatCount.id ? "selected" : ""}>
                          ${escapeHtml(formatSeatCountLabel(seatCount))}
                        </option>
                      `,
                    )
                    .join("")}
                </select>
                ${
                  isAdminSession() && selectedEstablishment
                    ? `<div class="stack-inline">
                        <button
                          type="button"
                          class="ghost-button"
                          data-action="deleteEstablishmentBookings"
                          data-establishment-id="${selectedEstablishment.id}"
                          data-establishment-name="${escapeHtml(selectedEstablishment.name)}"
                        >
                          Delete all bookings for this establishment
                        </button>
                      </div>`
                    : ""
                }
              </div>
            </div>
          `
      }
      <div class="tab-row">
        <button
          type="button"
          class="${activeTab === "calendar" ? "tab-button is-active" : "tab-button"}"
          aria-pressed="${activeTab === "calendar" ? "true" : "false"}"
          data-action="showBookingCalendarTab"
        >
          Booking calendar
        </button>
        ${
          canAccessBookingReports()
            ? `
              <button
                type="button"
                class="${activeTab === "reports" ? "tab-button is-active" : "tab-button"}"
                aria-pressed="${activeTab === "reports" ? "true" : "false"}"
                data-action="showBookingReportsTab"
              >
                Reports
              </button>
            `
            : ""
        }
      </div>
      ${renderStatus("bookings")}
      ${
        restrictedScope && isStatusProcessing("workspace") && !companies.length
          ? '<div class="empty loading-empty">Loading calendars and booking access for your establishment...</div>'
          : !companies.length
          ? '<div class="empty">Create a company before managing bookings.</div>'
          : !establishments.length
            ? '<div class="empty">Create an establishment and opening hours first.</div>'
            : !seatCounts.length
              ? '<div class="empty">Create at least one seat-count calendar for this establishment.</div>'
              : activeTab === "reports"
                ? renderBookingsReportPanel()
                : `
                  <div class="stack">
                    <div class="inner-panel booking-search-panel">
                      <div class="list-toolbar">
                        <input
                          type="search"
                          placeholder="Search by first name, last name, email, or phone"
                          value="${escapeHtml(state.bookingWorkspace.searchQuery)}"
                          data-booking-search-query
                        />
                        <button type="button" data-action="searchAdminBookings" ${seatCountReady ? "" : "disabled"}>Search</button>
                        <button type="button" class="ghost-button" data-action="clearAdminBookingSearch">Clear</button>
                      </div>
                      ${renderBookingSearchResults()}
                    </div>
                    ${renderBookingDayQuickActions()}
                    <div class="booking-calendar-shell">
                      ${renderAdminCalendarNavigator()}
                      ${renderAdminCalendar()}
                    </div>
                    ${renderAdminCalendarModal()}
                  </div>
                `
      }
    </div>
  `;
}

function renderBookingDayQuickActions() {
  const activeDate =
    state.adminAvailability.find((item) => item.date === state.adminCalendar.selectedDate) ?? null;

  if (!activeDate) {
    return `
      <div class="inner-panel">
        <p class="eyebrow">Selected day</p>
        <h3>Choose a date on the calendar</h3>
        <p class="meta">${
          canManageBookingClosures()
            ? "After selecting a day, you can stop any more bookings for that date from here."
            : "After selecting a day, you can inspect bookings and availability from here."
        }</p>
      </div>
    `;
  }

  return `
    <div class="inner-panel">
      <div class="panel-head">
        <div>
          <p class="eyebrow">Selected day</p>
          <h3>${escapeHtml(activeDate.date)}</h3>
          <p class="meta">${
            activeDate.isBlocked
              ? "No more bookings are currently being accepted for this day."
              : activeDate.isOpen
              ? `${escapeHtml(formatDisplayTime(activeDate.openTime))} to ${escapeHtml(formatDisplayTime(activeDate.closeTime))}`
              : "This day is closed based on opening hours."
          }</p>
        </div>
        ${
          canManageBookingClosures() && (activeDate.isOpen || activeDate.isBlocked)
            ? `<div class="stack-inline">
                <button
                  type="button"
                  class="${activeDate.isBlocked ? "ghost-button" : ""}"
                  data-action="${activeDate.isBlocked ? "reopenAdminDate" : "closeAdminDate"}"
                  data-seat-count-id="${escapeHtml(state.adminCalendar.seatCountId)}"
                  data-date="${escapeHtml(activeDate.date)}"
                >
                  ${activeDate.isBlocked ? "Reopen bookings" : "Stop bookings for this day"}
                </button>
              </div>`
            : ""
        }
      </div>
    </div>
  `;
}

function renderBookingsReportPanel() {
  const report = state.bookingWorkspace.report;
  return `
    <div class="stack">
      <div class="inner-panel">
        <div class="stack-inline">
          <button type="button" class="ghost-button" data-action="setBookingReportPreset" data-preset="today">Today</button>
          <button type="button" class="ghost-button" data-action="setBookingReportPreset" data-preset="thisWeek">This week</button>
          <button type="button" class="ghost-button" data-action="setBookingReportPreset" data-preset="thisMonth">This month</button>
        </div>
        <div class="form-grid form-grid-three">
          <div class="field">
            <label for="booking-report-from-date">From date</label>
            <input
              id="booking-report-from-date"
              type="date"
              value="${escapeHtml(report.fromDate)}"
              data-booking-report-from-date
            />
          </div>
          <div class="field">
            <label for="booking-report-to-date">To date</label>
            <input
              id="booking-report-to-date"
              type="date"
              value="${escapeHtml(report.toDate)}"
              data-booking-report-to-date
            />
          </div>
          <div class="field">
            <label for="booking-report-from-time">From time</label>
            <input
              id="booking-report-from-time"
              type="time"
              step="900"
              value="${escapeHtml(report.fromTime)}"
              data-booking-report-from-time
            />
          </div>
          <div class="field">
            <label for="booking-report-to-time">To time</label>
            <input
              id="booking-report-to-time"
              type="time"
              step="900"
              value="${escapeHtml(report.toTime)}"
              data-booking-report-to-time
            />
          </div>
        </div>
        <div class="stack-inline">
          <button type="button" data-action="runBookingReport">Run report</button>
          <button
            type="button"
            class="ghost-button"
            data-action="downloadBookingReportCsv"
            ${report.results.length ? "" : "disabled"}
          >
            Download CSV
          </button>
        </div>
      </div>
      ${renderBookingReportResults()}
    </div>
  `;
}

function renderBookingSearchResults() {
  if (!state.bookingWorkspace.searchHasRun) {
    return '<p class="meta">Search this seat-count calendar and jump the booking calendar straight to the matching day.</p>';
  }

  if (!state.bookingWorkspace.searchResults.length) {
    return '<div class="empty">No matching bookings were found.</div>';
  }

  return `
    <div class="search-result-list">
      ${state.bookingWorkspace.searchResults
        .map(
          (booking) => `
            <button
              type="button"
              class="search-result-card"
              data-action="focusAdminBookingSearchResult"
              data-booking-id="${booking.id}"
              data-date="${booking.bookingDate}"
              data-time="${booking.bookingTime}"
            >
              <strong>${escapeHtml(booking.firstName)} ${escapeHtml(booking.lastName)}</strong>
              <span>${escapeHtml(booking.bookingDate)} at ${escapeHtml(formatDisplayTime(booking.bookingTime))}</span>
              <span>${escapeHtml(booking.email)} | ${escapeHtml(booking.phone)}</span>
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderBookingReportResults() {
  const report = state.bookingWorkspace.report;
  const dailySummary = buildBookingDaySummary(report.results);

  if (!report.hasRun) {
    return '<p class="meta">Run a report for the selected seat-count calendar and date/time range.</p>';
  }

  return `
    <div class="inner-panel">
      <div class="panel-head">
        <div>
          <p class="eyebrow">Summary</p>
          <h3>${escapeHtml(String(report.results.length))} booking${report.results.length === 1 ? "" : "s"}</h3>
          <p class="meta">${escapeHtml(String(report.totalGuests))} total guests in the selected range.</p>
        </div>
      </div>
      ${
        report.results.length
          ? `
            <div class="report-table-wrap">
              <table class="report-table report-summary-table">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Date</th>
                    <th>Bookings</th>
                    <th>Guests</th>
                  </tr>
                </thead>
                <tbody>
                  ${dailySummary
                    .map(
                      (day) => `
                        <tr>
                          <td>${escapeHtml(day.label)}</td>
                          <td>${escapeHtml(day.date)}</td>
                          <td>${escapeHtml(String(day.bookings))}</td>
                          <td>${escapeHtml(String(day.guests))}</td>
                        </tr>
                      `,
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
            <div class="report-table-wrap">
              <table class="report-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Party</th>
                    <th>First name</th>
                    <th>Last name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  ${report.results
                    .map(
                      (booking) => `
                        <tr>
                          <td>${escapeHtml(booking.bookingDate)}</td>
                          <td>${escapeHtml(formatDisplayTime(booking.bookingTime))}</td>
                          <td>${escapeHtml(String(booking.partySize))}</td>
                          <td>${escapeHtml(booking.firstName)}</td>
                          <td>${escapeHtml(booking.lastName)}</td>
                          <td>${escapeHtml(booking.email)}</td>
                          <td>${escapeHtml(booking.phone)}</td>
                          <td>${escapeHtml(booking.notes || "")}</td>
                        </tr>
                      `,
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          `
          : '<div class="empty">No bookings were found for the selected range.</div>'
      }
    </div>
  `;
}

function renderCalendarNavigator() {
  const label = formatMonthLabel(state.widget.currentMonth);
  return `
    <div class="calendar-nav widget-calendar-nav">
      <button type="button" class="ghost-button" data-action="previousWidgetMonth">Previous</button>
      <div class="calendar-month">${escapeHtml(label)}</div>
      <button type="button" class="ghost-button" data-action="nextWidgetMonth">Next</button>
    </div>
  `;
}

function renderAdminCalendarNavigator() {
  const label = formatMonthLabel(state.adminCalendar.currentMonth);
  return `
    <div class="calendar-nav">
      <button type="button" class="ghost-button" data-action="previousAdminMonth">Previous</button>
      <div class="calendar-month">${escapeHtml(label)}</div>
      <button type="button" class="ghost-button" data-action="nextAdminMonth">Next</button>
    </div>
  `;
}

function renderWidgetCalendar() {
  const { year, monthIndex } = parseMonthKey(state.widget.currentMonth);
  const monthStart = new Date(Date.UTC(year, monthIndex, 1));
  const monthEndDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const firstWeekday = (monthStart.getUTCDay() + 6) % 7;
  const availabilityByDate = new Map(state.widgetAvailability.map((item) => [item.date, item]));
  const weekdayHeaders = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    .map((day) => `<div class="weekday">${day}</div>`)
    .join("");

  const cells = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push('<div class="calendar-cell calendar-pad"></div>');
  }

  for (let day = 1; day <= monthEndDay; day += 1) {
    const date = toDateString(year, monthIndex, day);
    const availability = availabilityByDate.get(date);
    const isSelected = state.widget.selectedDate === date;
    const presentation = getCalendarDayPresentation(availability);
    cells.push(`
      <button
        type="button"
        class="calendar-cell calendar-date ${isSelected ? "selected" : ""} ${presentation.className}"
        data-action="selectWidgetDate"
        data-date="${date}"
        data-fullness="${presentation.status}"
        aria-pressed="${isSelected ? "true" : "false"}"
        aria-label="${escapeHtml(`${date}. ${presentation.caption}`)}"
        style="--seat-load:${presentation.seatLoad.toFixed(3)};--seat-load-raw:${presentation.rawSeatLoad.toFixed(3)}"
        ${availability?.canBook ? "" : "disabled"}
      >
        <span class="calendar-number">${day}</span>
        <span class="calendar-caption">${presentation.caption}</span>
      </button>
    `);
  }

  return `
    <div class="calendar-shell">
      <div class="calendar-weekdays">${weekdayHeaders}</div>
      <div class="calendar-month-grid">${cells.join("")}</div>
    </div>
  `;
}

function renderAdminCalendar() {
  const { year, monthIndex } = parseMonthKey(state.adminCalendar.currentMonth);
  const monthStart = new Date(Date.UTC(year, monthIndex, 1));
  const monthEndDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const firstWeekday = (monthStart.getUTCDay() + 6) % 7;
  const availabilityByDate = new Map(state.adminAvailability.map((item) => [item.date, item]));
  const weekdayHeaders = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    .map((day) => `<div class="weekday">${day}</div>`)
    .join("");

  const cells = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push('<div class="calendar-cell calendar-pad"></div>');
  }

  for (let day = 1; day <= monthEndDay; day += 1) {
    const date = toDateString(year, monthIndex, day);
    const availability = availabilityByDate.get(date);
    const isSelected = state.adminCalendar.selectedDate === date;
    const presentation = getCalendarDayPresentation(availability);

    cells.push(`
      <button
        type="button"
        class="calendar-cell calendar-date ${isSelected ? "selected" : ""} ${presentation.className}"
        data-action="selectAdminDate"
        data-date="${date}"
        data-fullness="${presentation.status}"
        aria-pressed="${isSelected ? "true" : "false"}"
        aria-label="${escapeHtml(`${date}. ${presentation.caption}`)}"
        style="--seat-load:${presentation.seatLoad.toFixed(3)};--seat-load-raw:${presentation.rawSeatLoad.toFixed(3)}"
      >
        <span class="calendar-number">${day}</span>
        <span class="calendar-caption">${presentation.caption}</span>
      </button>
    `);
  }

  return `
    <div class="calendar-shell">
      <div class="calendar-weekdays">${weekdayHeaders}</div>
      <div class="calendar-month-grid">${cells.join("")}</div>
    </div>
  `;
}

function renderWidgetModal(activeDate) {
  if (state.widget.modal === "confirmed") {
    return `
      <div class="widget-modal-backdrop" data-action="closeWidgetModal">
        <div class="widget-modal" data-modal-panel>
          <p class="eyebrow">Booking confirmed</p>
          <h3>Check your email</h3>
          <p class="meta">${escapeHtml(state.widget.confirmationMessage || "Your booking has been confirmed. Please check your email for the confirmation message.")}</p>
          <div class="stack-inline">
            <button type="button" data-action="closeWidgetModal">Done</button>
          </div>
        </div>
      </div>
    `;
  }

  if (state.widget.modal === "enquiry") {
    const selectedSeatCount = getSelectedWidgetSeatCount();
    const enquiryLimit = Number(state.widget.enquiryPartySize || 0);
    return `
      <div class="widget-modal-backdrop" data-action="closeWidgetModal">
        <div class="widget-modal" data-modal-panel>
          <p class="eyebrow">Booking enquiry</p>
          <h3>Send an enquiry</h3>
            <p class="meta">${
            enquiryLimit > 0
              ? `For bookings of more than ${enquiryLimit - 1}, send an enquiry and the team will get back to you.`
              : "Send an enquiry and the team will get back to you."
          }</p>
          <form class="stack widget-form" data-widget-enquiry-form>
            <input type="hidden" name="action" value="enquiry" />
            <input type="hidden" name="seatCountId" value="${escapeHtml(state.widget.seatCountId)}" />
            <div class="form-grid">
              <div class="field">
                <label for="enquiry-party-size">Party size</label>
                <input
                  id="enquiry-party-size"
                  name="partySize"
                  type="number"
                  min="${enquiryLimit > 0 ? String(enquiryLimit) : "1"}"
                  value="${escapeHtml(state.widget.enquiryPartySize || "1")}"
                  required
                />
              </div>
              <div class="field">
                <label for="enquiry-date">Preferred date</label>
                <input id="enquiry-date" name="bookingDate" type="date" value="${escapeHtml(state.widget.selectedDate)}" />
              </div>
              <div class="field">
                <label for="enquiry-time">Preferred time</label>
                <input id="enquiry-time" name="bookingTime" type="time" step="900" value="${escapeHtml(state.widget.selectedTime)}" />
              </div>
              <div class="field">
                <label for="enquiry-first-name">First name</label>
                <input id="enquiry-first-name" name="firstName" required />
              </div>
              <div class="field">
                <label for="enquiry-last-name">Last name</label>
                <input id="enquiry-last-name" name="lastName" required />
              </div>
              <div class="field full">
                <label for="enquiry-email">Email</label>
                <input id="enquiry-email" name="email" type="email" required />
              </div>
              <div class="field full">
                <label for="enquiry-phone">Phone</label>
                <input id="enquiry-phone" name="phone" required />
              </div>
              <div class="field full">
                <label for="enquiry-notes">Details</label>
                <textarea id="enquiry-notes" name="notes" rows="4" placeholder="Tell us anything useful about your enquiry."></textarea>
              </div>
            </div>
            ${
              selectedSeatCount?.companyEnquiryEmail
                ? `<p class="meta">This enquiry will be sent to ${escapeHtml(selectedSeatCount.companyEnquiryEmail)}.</p>`
                : ""
            }
            <div class="status" aria-live="polite"></div>
            <div class="stack-inline">
              <button type="submit">Send enquiry</button>
              <button type="button" class="ghost-button" data-action="closeWidgetModal">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  if (state.widget.modal === "enquirySent") {
    return `
      <div class="widget-modal-backdrop" data-action="closeWidgetModal">
        <div class="widget-modal" data-modal-panel>
          <p class="eyebrow">Enquiry sent</p>
          <h3>We’ve passed it on</h3>
          <p class="meta">Your enquiry has been sent. The team will get back to you by email.</p>
          <div class="stack-inline">
            <button type="button" data-action="closeWidgetModal">Done</button>
          </div>
        </div>
      </div>
    `;
  }

  if (state.widget.modal === "time" && activeDate) {
    const maxPartySize = Math.max(Number(activeDate.maxPartySize ?? 0), 0);
    const selectedSeatCount = getSelectedWidgetSeatCount();
    return `
      <div class="widget-modal-backdrop" data-action="closeWidgetModal">
        <div class="widget-modal" data-modal-panel>
          <p class="eyebrow">Choose a time</p>
          <h3>${escapeHtml(state.widget.selectedDate)}</h3>
          ${
            maxPartySize > 0
              ? `<p class="meta">For bookings of more than ${escapeHtml(String(maxPartySize))}, <a href="#" class="inline-link" data-action="openLargePartyEnquiry" data-limit="${escapeHtml(String(maxPartySize))}">enquire here</a>.</p>`
              : ""
          }
          <div class="times-grid">
            ${renderWidgetTimes(activeDate)}
          </div>
          <div class="stack-inline">
            <button type="button" class="ghost-button" data-action="closeWidgetModal">Cancel</button>
          </div>
        </div>
      </div>
    `;
  }

  if (state.widget.modal === "details") {
    const selectedSlot = activeDate?.slots.find((slot) => slot.time === state.widget.selectedTime) ?? null;
    const remainingSeats = Math.max(Number(selectedSlot?.remaining ?? 0), 0);
    const slotCapacity = Math.max(Number(selectedSlot?.capacity ?? activeDate?.slotCapacity ?? 0), 0);
    const maxPartySize = Math.max(Number(activeDate?.maxPartySize ?? slotCapacity), 0);
    const maxBookablePartySize = Math.max(Math.min(remainingSeats || 0, maxPartySize || slotCapacity || 0), 1);
    const selectedSeatCount = getSelectedWidgetSeatCount();
    return `
      <div class="widget-modal-backdrop" data-action="closeWidgetModal">
        <div class="widget-modal" data-modal-panel>
          <p class="eyebrow">Booking details</p>
          <h3>${escapeHtml(state.widget.selectedDate)} at ${escapeHtml(formatDisplayTime(state.widget.selectedTime))}</h3>
          <p class="meta">${
            remainingSeats > 0
              ? `${remainingSeats} seat${remainingSeats === 1 ? "" : "s"} available`
              : "No seats available"
          }</p>
                ${
                  maxPartySize > 0
                    ? `<p class="meta">For bookings of more than ${escapeHtml(String(maxPartySize))}, <a href="#" class="inline-link" data-action="openLargePartyEnquiry" data-limit="${escapeHtml(String(maxPartySize))}">enquire here</a>.</p>`
                    : ""
                }
          <form class="stack widget-form" data-widget-form>
            <input type="hidden" name="seatCountId" value="${escapeHtml(state.widget.seatCountId)}" />
            <input type="hidden" name="bookingDate" value="${escapeHtml(state.widget.selectedDate)}" />
            <input type="hidden" name="bookingTime" value="${escapeHtml(state.widget.selectedTime)}" />
            <div class="form-grid">
              <div class="field">
                <label for="booking-party-size">Number of people</label>
                <input
                  id="booking-party-size"
                  name="partySize"
                  type="number"
                  min="1"
                  max="${maxBookablePartySize}"
                  data-widget-party-size
                  data-max-bookable-party-size="${maxBookablePartySize}"
                  value="1"
                  required
                />
              </div>
              <div class="field">
                <label for="booking-first-name">First name</label>
                <input id="booking-first-name" name="firstName" required />
              </div>
              <div class="field">
                <label for="booking-last-name">Last name</label>
                <input id="booking-last-name" name="lastName" required />
              </div>
              <div class="field full">
                <label for="booking-email">Email</label>
                <input id="booking-email" name="email" type="email" required />
              </div>
              <div class="field full">
                <label for="booking-phone">Phone</label>
                <input id="booking-phone" name="phone" required />
              </div>
              <div class="field full">
                <label for="booking-notes">Notes</label>
                <input id="booking-notes" name="notes" />
              </div>
            </div>
            <div class="status" aria-live="polite"></div>
            <div class="stack-inline">
              <button type="submit" ${remainingSeats > 0 ? "" : "disabled"}>Book selected slot</button>
              <button type="button" class="ghost-button" data-action="backToTimeModal">Back</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  return "";
}

function renderWidgetTimes(activeDate) {
  if (!activeDate) {
    return '<div class="empty">Choose a day to see times.</div>';
  }

  return activeDate.slots
    .map((slot) => {
      const presentation = getTimeSlotPresentation(slot);
      return `
        <button
          type="button"
          class="time-pill ${state.widget.selectedTime === slot.time ? "selected" : ""} ${presentation.className}"
          data-action="selectWidgetTime"
          data-time="${slot.time}"
          data-fullness="${presentation.status}"
          aria-pressed="${state.widget.selectedTime === slot.time ? "true" : "false"}"
          aria-label="${escapeHtml(`${formatDisplayTime(slot.time)}. ${presentation.status.replaceAll("-", " ")}`)}"
          style="--seat-load:${presentation.seatLoad.toFixed(3)};--seat-load-raw:${presentation.rawSeatLoad.toFixed(3)}"
          ${slot.available ? "" : "disabled"}
        >
          ${escapeHtml(formatDisplayTime(slot.time))}
        </button>
      `;
    })
    .join("");
}

function renderAdminCalendarModal() {
  const activeDate =
    state.adminAvailability.find((item) => item.date === state.adminCalendar.selectedDate) ?? null;
  const canManageClosures = canManageBookingClosures();

  if (state.adminCalendar.modal === "day" && activeDate) {
    return `
      <div class="widget-modal-backdrop" data-action="closeAdminCalendarModal">
        <div class="widget-modal admin-booking-modal" data-modal-panel>
          <p class="eyebrow">Bookings</p>
          <h3>${escapeHtml(state.adminCalendar.selectedDate)}</h3>
          <p class="meta">
            ${
              activeDate.isBlocked
                ? "No more bookings are being accepted for this day."
                : activeDate.isOpen
                ? `${escapeHtml(formatDisplayTime(activeDate.openTime))} to ${escapeHtml(formatDisplayTime(activeDate.closeTime))}`
                : "Closed"
            }
          </p>
          ${
            canManageClosures && (activeDate.isOpen || activeDate.isBlocked)
              ? `<div class="stack-inline">
                  <button
                    type="button"
                    class="ghost-button"
                    data-action="${activeDate.isBlocked ? "reopenAdminDate" : "closeAdminDate"}"
                    data-seat-count-id="${escapeHtml(state.adminCalendar.seatCountId)}"
                    data-date="${escapeHtml(activeDate.date)}"
                  >
                    ${activeDate.isBlocked ? "Reopen bookings for this day" : "Stop bookings for this day"}
                  </button>
                </div>`
              : ""
          }
          <div class="admin-slot-list">
            ${
              activeDate.isOpen
                ? activeDate.slots
                    .map((slot) =>
                      renderAdminSlot(slot, {
                        isBlocked: activeDate.isBlocked,
                        guestVisitMinutes: activeDate.guestVisitMinutes,
                      }),
                    )
                    .join("")
                : '<div class="empty">This day is closed.</div>'
            }
          </div>
          <div class="stack-inline">
            <button type="button" class="ghost-button" data-action="closeAdminCalendarModal">Close</button>
          </div>
        </div>
      </div>
    `;
  }

  if (state.adminCalendar.modal === "form") {
    return `
      <div class="widget-modal-backdrop" data-action="closeAdminCalendarModal">
        <div class="widget-modal admin-booking-modal" data-modal-panel>
          <p class="eyebrow">${state.adminCalendar.editingBookingId ? "Edit booking" : "Add booking"}</p>
          <h3>${escapeHtml(state.adminCalendar.selectedDate)} at ${escapeHtml(formatDisplayTime(state.adminCalendar.selectedTime))}</h3>
          <form class="stack" data-admin-booking-form>
            <input type="hidden" name="bookingId" value="${escapeHtml(state.adminCalendar.editingBookingId)}" />
            <input type="hidden" name="seatCountId" value="${escapeHtml(state.adminCalendar.seatCountId)}" />
            <input type="hidden" name="bookingDate" value="${escapeHtml(state.adminCalendar.selectedDate)}" />
            <input type="hidden" name="bookingTime" value="${escapeHtml(state.adminCalendar.selectedTime)}" />
            <div class="form-grid">
              <div class="field">
                <label for="admin-party-size">Number of people</label>
                <input id="admin-party-size" name="partySize" type="number" min="1" value="${escapeHtml(getEditingBookingValue("partySize") || "1")}" required />
              </div>
              <div class="field">
                <label for="admin-booking-first-name">First name</label>
                <input id="admin-booking-first-name" name="firstName" value="${escapeHtml(getEditingBookingValue("firstName"))}" required />
              </div>
              <div class="field">
                <label for="admin-booking-last-name">Last name</label>
                <input id="admin-booking-last-name" name="lastName" value="${escapeHtml(getEditingBookingValue("lastName"))}" required />
              </div>
              <div class="field full">
                <label for="admin-booking-email">Email</label>
                <input id="admin-booking-email" name="email" type="email" value="${escapeHtml(getEditingBookingValue("email"))}" required />
              </div>
              <div class="field full">
                <label for="admin-booking-phone">Phone</label>
                <input id="admin-booking-phone" name="phone" value="${escapeHtml(getEditingBookingValue("phone"))}" required />
              </div>
              <div class="field full">
                <label for="admin-booking-notes">Notes</label>
                <input id="admin-booking-notes" name="notes" value="${escapeHtml(getEditingBookingValue("notes"))}" />
              </div>
            </div>
            <div class="status" aria-live="polite"></div>
            <div class="stack-inline">
              <button type="submit">${state.adminCalendar.editingBookingId ? "Save booking" : "Create booking"}</button>
              <button type="button" class="ghost-button" data-action="backToAdminDayModal">Back</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  return "";
}

function renderAdminSlot(slot, options = {}) {
  const isBlocked = options.isBlocked === true;
  const visitDurationLabel = formatVisitDuration(options.guestVisitMinutes);
  return `
    <div class="nested-card">
      <div class="entity-row">
        <div>
          <strong>${escapeHtml(formatDisplayTime(slot.time))}</strong>
          <p class="meta">${slot.remaining}/${slot.capacity} seats left in this ${escapeHtml(visitDurationLabel)} booking window</p>
        </div>
        <button
          type="button"
          class="ghost-button"
          data-action="createAdminBooking"
          data-time="${slot.time}"
          ${isBlocked ? "disabled" : ""}
        >
          Add booking
        </button>
      </div>
      ${
        slot.bookings?.length
          ? slot.bookings
              .map(
                (booking) => `
                  <div class="entity-row booking-row">
                    <div>
                      <strong>${escapeHtml(booking.firstName)} ${escapeHtml(booking.lastName)}</strong>
                      <p class="meta">${escapeHtml(booking.partySize)} people | ${escapeHtml(booking.email)}</p>
                    </div>
                    <div class="stack-inline">
                      <button type="button" class="ghost-button" data-action="editAdminBooking" data-booking-id="${booking.id}" data-time="${slot.time}">Edit</button>
                      <button type="button" class="ghost-button" data-action="deleteAdminBooking" data-booking-id="${booking.id}">Delete</button>
                    </div>
                  </div>
                `,
              )
              .join("")
          : '<p class="meta">No bookings for this time.</p>'
      }
    </div>
  `;
}

async function handleAction(action, dataset) {
  if (action === "openForgotPassword") {
    clearStatus("passwordReset");
    navigate("/login?forgot=1");
    return;
  }

  if (action === "returnToLogin") {
    clearStatus("passwordReset");
    navigate("/login");
    return;
  }

  if (action === "logout") {
    setStatus("auth", "info", "Signing out...");
    await logout();
    return;
  }

  if (action === "previousWidgetMonth") {
    setStatus("widget", "info", "Loading availability...");
    state.widget.currentMonth = shiftMonth(state.widget.currentMonth, -1);
    await refreshWidgetAvailability();
    render();
    return;
  }

  if (action === "nextWidgetMonth") {
    setStatus("widget", "info", "Loading availability...");
    state.widget.currentMonth = shiftMonth(state.widget.currentMonth, 1);
    await refreshWidgetAvailability();
    render();
    return;
  }

  if (action === "selectWidgetDate") {
    state.widget.selectedDate = dataset.date;
    state.widget.selectedTime = "";
    state.widget.confirmationMessage = "";
    state.widget.enquiryPartySize = "";
    state.widget.modal = "time";
    render();
    return;
  }

  if (action === "selectWidgetTime") {
    state.widget.selectedTime = dataset.time;
    state.widget.modal = "details";
    render();
    return;
  }

  if (action === "closeWidgetModal") {
    state.widget.confirmationMessage = "";
    state.widget.enquiryPartySize = "";
    state.widget.modal = null;
    render();
    return;
  }

  if (action === "backToTimeModal") {
    state.widget.modal = "time";
    render();
    return;
  }

  if (action === "openLargePartyEnquiry") {
    const selectedSeatCount = getSelectedWidgetSeatCount();
    if (!selectedSeatCount?.companyEnquiryEmail) {
      setStatus("widget", "error", "This company does not have an enquiry email configured yet.");
      return;
    }

    const limit = Number(dataset.limit ?? 0);
    state.widget.enquiryPartySize = limit > 0 ? String(limit + 1) : "";
    state.widget.modal = "enquiry";
    clearStatus("widget");
    render();
    return;
  }

  if (action === "previousAdminMonth") {
    setStatus("bookings", "info", "Loading booking calendar...");
    state.adminCalendar.currentMonth = shiftMonth(state.adminCalendar.currentMonth, -1);
    await refreshAdminAvailability();
    render();
    return;
  }

  if (action === "nextAdminMonth") {
    setStatus("bookings", "info", "Loading booking calendar...");
    state.adminCalendar.currentMonth = shiftMonth(state.adminCalendar.currentMonth, 1);
    await refreshAdminAvailability();
    render();
    return;
  }

  if (action === "selectAdminDate") {
    state.adminCalendar.selectedDate = dataset.date;
    state.adminCalendar.selectedTime = "";
    state.adminCalendar.editingBookingId = "";
    state.adminCalendar.modal = "day";
    clearStatus("bookings");
    render();
    return;
  }

  if (action === "closeAdminCalendarModal") {
    state.adminCalendar.modal = null;
    state.adminCalendar.selectedTime = "";
    state.adminCalendar.editingBookingId = "";
    render();
    return;
  }

  if (action === "createAdminBooking") {
    const activeDate =
      state.adminAvailability.find((item) => item.date === state.adminCalendar.selectedDate) ?? null;
    if (activeDate?.isBlocked) {
      setStatus("bookings", "error", "No more bookings are being accepted for that day.");
      return;
    }

    state.adminCalendar.selectedTime = dataset.time;
    state.adminCalendar.editingBookingId = "";
    state.adminCalendar.modal = "form";
    clearStatus("bookings");
    render();
    return;
  }

  if (action === "editAdminBooking") {
    state.adminCalendar.selectedTime = dataset.time;
    state.adminCalendar.editingBookingId = dataset.bookingId;
    state.adminCalendar.modal = "form";
    clearStatus("bookings");
    render();
    return;
  }

  if (action === "deleteAdminBooking") {
    if (!confirm("Delete this booking?")) {
      return;
    }

    setStatus("bookings", "info", "Deleting booking...");
    await postJson("/api/bookings", { action: "delete", bookingId: dataset.bookingId }, "bookings");
    state.adminCalendar.editingBookingId = "";
    await refreshAdminAvailability();
    if (state.widget.seatCountId === state.adminCalendar.seatCountId) {
      await refreshWidgetAvailability();
    }
    state.adminCalendar.modal = "day";
    setStatus("bookings", "success", "Booking deleted.");
    return;
  }

  if (action === "deleteEstablishmentBookings") {
    if (!isAdminSession()) {
      setStatus("bookings", "error", "Only admins can delete all bookings for an establishment.");
      return;
    }

    const establishmentName = String(dataset.establishmentName ?? "this establishment").trim();
    if (
      !confirm(
        `Delete all bookings for ${establishmentName}? This cannot be undone.`,
      )
    ) {
      return;
    }

    clearBookingWorkspaceResults();
    setStatus("bookings", "info", "Deleting all bookings for this establishment...");
    const data = await postJson(
      "/api/bookings",
      {
        action: "deleteEstablishmentBookings",
        establishmentId: dataset.establishmentId,
      },
      "bookings",
    );
    await refreshAdminAvailability();
    if (getSelectedWidgetSeatCount()?.establishmentId === state.adminCalendar.establishmentId) {
      await refreshWidgetAvailability();
    }
    state.adminCalendar.modal = null;
    state.adminCalendar.editingBookingId = "";
    state.adminCalendar.selectedTime = "";
    setStatus("bookings", "success", data.message ?? "All bookings deleted for that establishment.");
    render();
    return;
  }

  if (action === "backToAdminDayModal") {
    state.adminCalendar.modal = "day";
    state.adminCalendar.editingBookingId = "";
    render();
    return;
  }

  if (action === "closeAdminDate" || action === "reopenAdminDate") {
    if (!canManageBookingClosures()) {
      setStatus("bookings", "error", "Only admins and managers can change booking-day availability.");
      return;
    }

    const closing = action === "closeAdminDate";
    setStatus("bookings", "info", closing ? "Stopping bookings for this day..." : "Reopening bookings for this day...");
    const data = await postJson(
      "/api/bookings",
      {
        action: closing ? "closeDate" : "reopenDate",
        seatCountId: dataset.seatCountId,
        bookingDate: dataset.date,
      },
      "bookings",
    );
    await refreshAdminAvailability();
    if (state.widget.seatCountId === state.adminCalendar.seatCountId) {
      await refreshWidgetAvailability();
    }
    state.adminCalendar.modal = "day";
    setStatus("bookings", "success", data.message ?? (closing ? "Bookings stopped for that day." : "Bookings reopened for that day."));
    return;
  }

  if (action === "showBookingCalendarTab") {
    state.bookingWorkspace.activeTab = "calendar";
    render();
    return;
  }

  if (action === "showBookingReportsTab") {
    if (!canAccessBookingReports()) {
      state.bookingWorkspace.activeTab = "calendar";
      render();
      return;
    }

    state.bookingWorkspace.activeTab = "reports";
    render();
    return;
  }

  if (action === "searchAdminBookings") {
    await searchAdminBookings();
    return;
  }

  if (action === "clearAdminBookingSearch") {
    state.bookingWorkspace.searchQuery = "";
    state.bookingWorkspace.searchResults = [];
    state.bookingWorkspace.searchHasRun = false;
    clearStatus("bookings");
    render();
    return;
  }

  if (action === "focusAdminBookingSearchResult") {
    await focusAdminBookingSearchResult(dataset.date);
    return;
  }

  if (action === "runBookingReport") {
    await runBookingReport();
    return;
  }

  if (action === "setBookingReportPreset") {
    applyBookingReportPreset(dataset.preset);
    render();
    return;
  }

  if (action === "downloadBookingReportCsv") {
    downloadBookingReportCsv();
    return;
  }

  if (
    action === "copyWidgetUrl" ||
    action === "copyWidgetEmbed" ||
    action === "copyPageViewUrl" ||
    action === "copyPageViewEmbed"
  ) {
    await navigator.clipboard.writeText(dataset.url);
    setStatus("widgetSetup", "success", "Copied.");
    return;
  }

  if (action === "openWidgetPreview" || action === "openPageViewPreview") {
    navigate(dataset.url);
    return;
  }

  if (action === "openWidgetEditorPreview") {
    const previewUrl = buildThemeEditorPreviewUrl(dataset.url);
    if (!previewUrl) {
      setStatus("widgetEditor", "error", "Select an establishment with at least one seat-count calendar first.");
      return;
    }

    openThemeEditorPreview(previewUrl);
    return;
  }

  if (action === "removeWidgetEditorAttachment") {
    state.widgetEditor.attachments.splice(Number(dataset.index), 1);
    render();
    return;
  }

  if (action === "saveWidgetEditorPrompt") {
    await handleWidgetEditorPromptSave();
    return;
  }

  if (action === "loadWidgetEditorPrompt") {
    loadWidgetEditorPrompt(dataset.promptId);
    return;
  }

  if (action === "clearWidgetEditorPromptSelection") {
    clearWidgetEditorPromptSelection();
    render();
    return;
  }

  if (action === "deleteWidgetEditorPrompt") {
    await handleWidgetEditorPromptDelete(dataset.promptId);
    return;
  }

  if (action === "resetWidgetCssDraft") {
    const establishment = getSelectedWidgetEditorEstablishment();
    state.widgetEditor.draftCss = getSelectedThemeEditorCss(establishment) ?? "";
    state.widgetEditor.draftContentText = getSelectedThemeEditorContentText(establishment) ?? "";
    setStatus(
      "widgetEditor",
      "info",
      getActiveThemeEditorKey() === "booking_page_view"
        ? "Draft reset to the last saved booking page content and CSS."
        : "Draft reset to the last saved CSS.",
    );
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
      confirmPassword: "",
      authLevel: user.authLevel,
      companyId: user.companyId ?? "",
      establishmentId: user.establishmentId ?? "",
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

    setStatus("users", "info", "Deleting selected users...");
    await postJson("/api/users", { action: "bulkDelete", userIds: Array.from(state.selectedUserIds) }, "users");
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
      enquiryEmail: company.enquiryEmail || "",
    };
    clearStatus("companies");
    render();
    return;
  }

  if (action === "deleteCompany") {
    if (!confirm("Delete this company and its establishments/seat counts?")) {
      return;
    }

    setStatus("companies", "info", "Deleting company...");
    await postJson("/api/companies", { action: "deleteCompany", companyId: dataset.companyId }, "companies");
    state.selectedCompanyIds.delete(dataset.companyId);
    await refreshAdminState();
    setStatus("companies", "success", "Company deleted.");
    return;
  }

  if (action === "bulkDeleteCompanies") {
    if (!state.selectedCompanyIds.size || !confirm("Delete the selected companies?")) {
      return;
    }

    setStatus("companies", "info", "Deleting selected companies...");
    await postJson("/api/companies", { action: "bulkDeleteCompanies", companyIds: Array.from(state.selectedCompanyIds) }, "companies");
    state.selectedCompanyIds.clear();
    await refreshAdminState();
    setStatus("companies", "success", "Selected companies deleted.");
    return;
  }

  if (action === "bulkDeleteEstablishments") {
    if (!state.selectedEstablishmentIds.size || !confirm("Delete the selected establishments?")) {
      return;
    }

    setStatus("companies", "info", "Deleting selected establishments...");
    await postJson("/api/companies", { action: "bulkDeleteEstablishments", establishmentIds: Array.from(state.selectedEstablishmentIds) }, "companies");
    state.selectedEstablishmentIds.clear();
    await refreshAdminState();
    setStatus("companies", "success", "Selected establishments deleted.");
    return;
  }

  if (action === "bulkDeleteSeatCounts") {
    if (!state.selectedSeatCountIds.size || !confirm("Delete the selected seat counts?")) {
      return;
    }

    setStatus("companies", "info", "Deleting selected seat counts...");
    await postJson("/api/companies", { action: "bulkDeleteSeatCounts", seatCountIds: Array.from(state.selectedSeatCountIds) }, "companies");
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

    setStatus("companies", "info", "Creating establishment...");
    await postJson("/api/companies", { action: "createEstablishment", companyId: dataset.companyId, name }, "companies");
    await refreshAdminState();
    setStatus("companies", "success", "Establishment created.");
    return;
  }

  if (action === "saveOpeningHours") {
    const openingHours = collectOpeningHours(dataset.establishmentId);
    setStatus("companies", "info", "Saving opening hours...");
    await postJson(
      "/api/companies",
      { action: "updateOpeningHours", establishmentId: dataset.establishmentId, openingHours },
      "companies",
    );
    state.dirtyOpeningHoursEstablishmentIds.delete(dataset.establishmentId);
    await refreshAdminState();
    setStatus("companies", "success", "Opening hours updated.");
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

    setStatus("companies", "info", "Saving establishment...");
    await postJson("/api/companies", { action: "updateEstablishment", establishmentId: dataset.establishmentId, companyId: dataset.companyId, name }, "companies");
    await refreshAdminState();
    setStatus("companies", "success", "Establishment updated.");
    return;
  }

  if (action === "deleteEstablishment") {
    if (!confirm("Delete this establishment and its seat counts?")) {
      return;
    }

    setStatus("companies", "info", "Deleting establishment...");
    await postJson("/api/companies", { action: "deleteEstablishment", establishmentId: dataset.establishmentId }, "companies");
    state.selectedEstablishmentIds.delete(dataset.establishmentId);
    await refreshAdminState();
    setStatus("companies", "success", "Establishment deleted.");
    return;
  }

  if (action === "addSeatCount") {
    const config = promptForSeatCountConfig();
    if (!config) {
      return;
    }

    setStatus("companies", "info", "Creating seat-count calendar...");
    await postJson(
      "/api/companies",
      {
        action: "createSeatCount",
        establishmentId: dataset.establishmentId,
        seatCount: config.seatCount,
        maxPartySize: config.maxPartySize,
        guestVisitMinutes: config.guestVisitMinutes,
      },
      "companies",
    );
    await refreshAdminState();
    setStatus("companies", "success", "Seat-count calendar created.");
    return;
  }

  if (action === "editSeatCount") {
    const config = promptForSeatCountConfig({
      seatCount: dataset.seatCount,
      maxPartySize: dataset.maxPartySize,
      guestVisitMinutes: dataset.guestVisitMinutes,
    });
    if (!config) {
      return;
    }

    setStatus("companies", "info", "Saving seat count...");
    await postJson(
      "/api/companies",
      {
        action: "updateSeatCount",
        seatCountId: dataset.seatCountId,
        establishmentId: dataset.establishmentId,
        seatCount: config.seatCount,
        maxPartySize: config.maxPartySize,
        guestVisitMinutes: config.guestVisitMinutes,
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

    setStatus("companies", "info", "Deleting seat count...");
    await postJson("/api/companies", { action: "deleteSeatCount", seatCountId: dataset.seatCountId }, "companies");
    state.selectedSeatCountIds.delete(dataset.seatCountId);
    await refreshAdminState();
    setStatus("companies", "success", "Seat count deleted.");
  }
}

async function handleLogin(form) {
  if (form.dataset.pending === "true") {
    return;
  }

  form.dataset.pending = "true";
  setInlineFormStatus(form, "success", "Signing in...");
  setSubmitPending(form, true, "Signing in...");
  const payload = Object.fromEntries(new FormData(form).entries());

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await readApiResponse(response);

    if (!response.ok) {
      setInlineFormStatus(form, "error", data.error ?? "Unable to sign in.");
      setSubmitPending(form, false, "Sign in");
      form.dataset.pending = "false";
      return;
    }

    state.session = data.session;
    state.userCount = Math.max(Number(state.userCount ?? 0), 1);
    state.authForms.loginPassword = "";
    clearStatus("auth");
    navigate(getSignedInLandingPath(), { replace: true });
  } catch (error) {
    setInlineFormStatus(form, "error", error.message ?? "Unable to sign in.");
    setSubmitPending(form, false, "Sign in");
    form.dataset.pending = "false";
  }
}

async function handleForgotPasswordSubmit(form) {
  if (form.dataset.pending === "true") {
    return;
  }

  form.dataset.pending = "true";
  setInlineFormStatus(form, "success", "Sending reset link...");
  setSubmitPending(form, true, "Sending...");

  try {
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.action = "request";
    payload.origin = window.location.origin;

    const response = await fetch("/api/password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await readApiResponse(response);

    if (!response.ok) {
      setInlineFormStatus(form, "error", data.error ?? "Reset link could not be sent.");
      setSubmitPending(form, false, "Send reset link");
      form.dataset.pending = "false";
      return;
    }

    state.authForms.forgotEmail = payload.email ?? "";
    setInlineFormStatus(form, "success", data.message ?? "If that email address exists, a reset link has been sent.");
    setSubmitPending(form, false, "Send reset link");
    form.dataset.pending = "false";
  } catch (error) {
    setInlineFormStatus(form, "error", error.message ?? "Reset link could not be sent.");
    setSubmitPending(form, false, "Send reset link");
    form.dataset.pending = "false";
  }
}

async function handleResetPasswordSubmit(form) {
  if (form.dataset.pending === "true") {
    return;
  }

  const password = state.authForms.resetPassword;
  const confirmPassword = state.authForms.resetConfirmPassword;
  if (password !== confirmPassword) {
    setInlineFormStatus(form, "error", "New password and confirm password must match.");
    return;
  }

  const token = getPasswordResetTokenFromLocation();
  if (!token) {
    setInlineFormStatus(form, "error", "This password reset link is invalid or has expired.");
    return;
  }

  form.dataset.pending = "true";
  setInlineFormStatus(form, "success", "Updating password...");
  setSubmitPending(form, true, "Saving...");

  try {
    const response = await fetch("/api/password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reset",
        token,
        password,
      }),
    });
    const data = await readApiResponse(response);

    if (!response.ok) {
      setInlineFormStatus(form, "error", data.error ?? "Password could not be updated.");
      setSubmitPending(form, false, "Save new password");
      form.dataset.pending = "false";
      return;
    }

    state.authForms.resetPassword = "";
    state.authForms.resetConfirmPassword = "";
    clearPasswordResetTokenState();
    clearStatus("passwordReset");
    navigate("/login");
    setStatus("auth", "success", data.message ?? "Password updated. You can sign in now.");
  } catch (error) {
    setInlineFormStatus(form, "error", error.message ?? "Password could not be updated.");
    setSubmitPending(form, false, "Save new password");
    form.dataset.pending = "false";
  }
}

async function handleUserSubmit(form) {
  const payload = Object.fromEntries(new FormData(form).entries());
  const password = String(payload.password ?? "");
  const confirmPassword = String(payload.confirmPassword ?? "");

  if (state.userForm.mode === "create" && password !== confirmPassword) {
    setStatus("users", "error", "Password and confirm password must match.");
    return;
  }

  if (state.userForm.mode === "edit" && (password || confirmPassword) && password !== confirmPassword) {
    setStatus("users", "error", "New password and confirm new password must match.");
    return;
  }

  delete payload.confirmPassword;
  payload.action = state.userForm.mode === "edit" ? "update" : "create";

  if (state.userForm.mode === "edit") {
    payload.userId = state.userForm.userId;
  }

  setStatus("users", "info", state.userForm.mode === "edit" ? "Saving user..." : "Creating user...");
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

  setStatus("companies", "info", state.companyForm.mode === "edit" ? "Saving company..." : "Creating company...");
  const data = await postJson("/api/companies", payload, "companies");
  state.companyForm = createEmptyCompanyForm();
  state.selectedCompanyIds.clear();
  state.selectedEstablishmentIds.clear();
  state.selectedSeatCountIds.clear();
  await refreshAdminState();
  setStatus("companies", "success", data.message ?? "Company saved.");
}

async function handleWidgetBooking(form) {
  if (form.dataset.pending === "true") {
    return;
  }

  const payload = Object.fromEntries(new FormData(form).entries());
  const activeDate = state.widgetAvailability.find((item) => item.date === payload.bookingDate);
  const selectedSlot = activeDate?.slots.find((slot) => slot.time === payload.bookingTime) ?? null;
  const remainingSeats = Number(selectedSlot?.remaining ?? 0);
  const requestedSeats = Number(payload.partySize ?? 0);
  const maxPartySize = Number(activeDate?.maxPartySize ?? 0);
  const selectedSeatCount = getSelectedWidgetSeatCount();

  if (!payload.bookingDate || !payload.bookingTime) {
    setStatus("widget", "error", "Choose a day and time before booking.");
    return;
  }

  if (!Number.isInteger(requestedSeats) || requestedSeats <= 0) {
    setStatus("widget", "error", "Enter a valid number of people.");
    return;
  }

  if (!selectedSlot || remainingSeats <= 0) {
    setStatus("widget", "error", "That time is no longer available.");
    return;
  }

  if (requestedSeats > remainingSeats) {
    setStatus(
      "widget",
      "error",
      `Only ${remainingSeats} seat${remainingSeats === 1 ? "" : "s"} remain for that time.`,
    );
    return;
  }

  if (maxPartySize > 0 && requestedSeats > maxPartySize) {
    if (selectedSeatCount?.companyEnquiryEmail) {
      state.widget.enquiryPartySize = String(requestedSeats);
      state.widget.modal = "enquiry";
      setStatus("widget", "info", `For bookings of more than ${maxPartySize}, send an enquiry instead.`);
      render();
      return;
    }

    setStatus("widget", "error", `For bookings of more than ${maxPartySize}, enquire here instead.`);
    return;
  }

  form.dataset.pending = "true";
  setInlineFormStatus(form, "info", "Saving booking...");
  setSubmitPending(form, true, "Saving booking...");

  try {
    const data = await postJson("/api/widget", payload, "widget");
    form.reset();
    state.widget.selectedTime = "";
    state.widget.confirmationMessage =
      data.message ?? "Your booking has been confirmed. Please check your email for the confirmation message.";
    state.widget.modal = "confirmed";
    await refreshWidgetAvailability();
    setStatus("widget", "success", data.message ?? "Booking confirmed.");
  } catch (error) {
    setInlineFormStatus(form, "error", error.message ?? "Booking could not be saved.");
    setSubmitPending(form, false, "Book selected slot");
    form.dataset.pending = "false";
  }
}

async function handleWidgetEnquiry(form) {
  if (form.dataset.pending === "true") {
    return;
  }

  const payload = Object.fromEntries(new FormData(form).entries());
  form.dataset.pending = "true";
  setInlineFormStatus(form, "info", "Sending enquiry...");
  setSubmitPending(form, true, "Sending enquiry...");

  try {
    const data = await postJson("/api/widget", payload, "widget");
    form.reset();
    state.widget.enquiryPartySize = "";
    state.widget.modal = "enquirySent";
    setStatus("widget", "success", data.message ?? "Your enquiry has been sent.");
  } catch (error) {
    setInlineFormStatus(form, "error", error.message ?? "Enquiry could not be sent.");
    setSubmitPending(form, false, "Send enquiry");
    form.dataset.pending = "false";
  }
}

async function handleAdminBookingSubmit(form) {
  if (form.dataset.pending === "true") {
    return;
  }

  const payload = Object.fromEntries(new FormData(form).entries());
  payload.action = payload.bookingId ? "update" : "create";
  const submitLabel = payload.bookingId ? "Save booking" : "Create booking";
  const pendingLabel = payload.bookingId ? "Saving booking..." : "Creating booking...";

  form.dataset.pending = "true";
  setInlineFormStatus(form, "info", pendingLabel);
  setSubmitPending(form, true, pendingLabel);

  try {
    const data = await postJson("/api/bookings", payload, "bookings");
    state.adminCalendar.editingBookingId = "";
    await refreshAdminAvailability();
    if (state.widget.seatCountId === state.adminCalendar.seatCountId) {
      await refreshWidgetAvailability();
    }
    state.adminCalendar.modal = "day";
    setStatus("bookings", "success", data.message ?? "Booking saved.");
  } catch (error) {
    setInlineFormStatus(form, "error", error.message ?? "Booking could not be saved.");
    setSubmitPending(form, false, submitLabel);
    form.dataset.pending = "false";
  }
}

async function handleOpenAiSettingsSubmit(form) {
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.action = "updateOpenAiSettings";

  setStatus("openaiSettings", "info", "Saving OpenAI settings...");
  const data = await postJson("/api/app-settings", payload, "openaiSettings");
  state.appSettings = data.appSettings ?? createDefaultAppSettings();
  state.openAiModelDraft = state.appSettings.openAiModel;
  state.openAiReasoningEffortDraft = state.appSettings.openAiReasoningEffort;
  state.widgetEditorMaxOutputTokensDraft = String(state.appSettings.widgetEditorMaxOutputTokens);
  state.widgetEditorUploadLimitDraftMb = formatMegabytes(state.appSettings.widgetEditorUploadLimitBytes);
  state.widgetEditor.model =
    loadThemeEditorModelChoice(getActiveThemeEditorKey()) || state.appSettings.openAiModel;
  state.widgetEditor.reasoningEffort =
    loadThemeEditorReasoningChoice(getActiveThemeEditorKey()) || state.appSettings.openAiReasoningEffort;
  setStatus("openaiSettings", "success", data.message ?? "OpenAI settings updated.");
}

async function handleEmailTestSubmit(form) {
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.action = "sendTestBookingConfirmationEmail";

  setStatus("emailSettings", "info", "Sending test booking confirmation email...");
  const data = await postJson("/api/app-settings", payload, "emailSettings");
  setStatus("emailSettings", "success", data.message ?? "Test booking confirmation email sent.");
}

async function searchAdminBookings() {
  if (!state.adminCalendar.seatCountId) {
    setStatus("bookings", "error", "Choose a seat-count calendar first.");
    return;
  }

  const query = state.bookingWorkspace.searchQuery.trim();
  if (!query) {
    setStatus("bookings", "error", "Enter a first name, last name, email, or phone to search.");
    return;
  }

  setStatus("bookings", "info", "Searching bookings...", { processing: true });
  const response = await fetch(
    `/api/bookings?action=search&seatCountId=${encodeURIComponent(state.adminCalendar.seatCountId)}&query=${encodeURIComponent(query)}&limit=25`,
  );
  const data = await readApiResponse(response);

  if (!response.ok) {
    setStatus("bookings", "error", data.error ?? "Booking search failed.");
    return;
  }

  state.bookingWorkspace.searchResults = data.results ?? [];
  state.bookingWorkspace.searchHasRun = true;
  clearStatus("bookings");
  render();
}

async function focusAdminBookingSearchResult(date) {
  if (!date) {
    return;
  }

  setStatus("bookings", "info", "Loading booking day...");
  state.bookingWorkspace.activeTab = "calendar";
  state.adminCalendar.currentMonth = monthKey(date);
  state.adminCalendar.selectedDate = date;
  state.adminCalendar.selectedTime = "";
  state.adminCalendar.editingBookingId = "";
  state.adminCalendar.modal = "day";
  await refreshAdminAvailability();
  clearStatus("bookings");
  render();
}

async function runBookingReport() {
  if (!canAccessBookingReports()) {
    setStatus("bookings", "error", "Your account cannot run booking reports.");
    return;
  }

  if (!state.adminCalendar.seatCountId) {
    setStatus("bookings", "error", "Choose a seat-count calendar first.");
    return;
  }

  const report = state.bookingWorkspace.report;
  const params = new URLSearchParams({
    action: "report",
    seatCountId: state.adminCalendar.seatCountId,
    fromDate: report.fromDate,
    toDate: report.toDate,
  });

  if (report.fromTime) {
    params.set("fromTime", report.fromTime);
  }

  if (report.toTime) {
    params.set("toTime", report.toTime);
  }

  setStatus("bookings", "info", "Running booking report...", { processing: true });
  const response = await fetch(`/api/bookings?${params.toString()}`);
  const data = await readApiResponse(response);

  if (!response.ok) {
    setStatus("bookings", "error", data.error ?? "Booking report failed.");
    return;
  }

  state.bookingWorkspace.report.results = data.bookings ?? [];
  state.bookingWorkspace.report.totalGuests = Number(data.totalGuests ?? 0);
  state.bookingWorkspace.report.hasRun = true;
  clearStatus("bookings");
  render();
}

function applyBookingReportPreset(preset) {
  const today = todayString();

  if (preset === "today") {
    state.bookingWorkspace.report.fromDate = today;
    state.bookingWorkspace.report.toDate = today;
    return;
  }

  if (preset === "thisWeek") {
    const { start, end } = getWeekRange(today);
    state.bookingWorkspace.report.fromDate = start;
    state.bookingWorkspace.report.toDate = end;
    return;
  }

  if (preset === "thisMonth") {
    const currentMonth = monthKey(today);
    state.bookingWorkspace.report.fromDate = monthStartDate(currentMonth);
    state.bookingWorkspace.report.toDate = monthEndDate(currentMonth);
  }
}

function downloadBookingReportCsv() {
  if (!canAccessBookingReports()) {
    setStatus("bookings", "error", "Your account cannot download booking reports.");
    return;
  }

  const report = state.bookingWorkspace.report;
  if (!report.results.length) {
    setStatus("bookings", "error", "Run a report first.");
    return;
  }

  const header = [
    "Booking Date",
    "Booking Time",
    "Party Size",
    "First Name",
    "Last Name",
    "Email",
    "Phone",
    "Notes",
  ];

  const rows = report.results.map((booking) => [
    booking.bookingDate,
    formatDisplayTime(booking.bookingTime),
    booking.partySize,
    booking.firstName,
    booking.lastName,
    booking.email,
    booking.phone,
    booking.notes ?? "",
  ]);

  const csv = [header, ...rows].map((row) => row.map(escapeCsvValue).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = buildBookingReportFileName();
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  setStatus("bookings", "success", "CSV downloaded.");
}

async function handleWidgetEditorGenerate(form) {
  const establishment = getSelectedWidgetEditorEstablishment();
  const editor = getThemeEditorConfig();
  if (!establishment) {
    setStatus("widgetEditor", "error", "Choose an establishment first.");
    return;
  }

  if (
    !state.widgetEditor.attachments.length &&
    !confirm("No reference files are attached. Continue and generate CSS from the prompt only?")
  ) {
    setStatus("widgetEditor", "info", "Generation cancelled. Add files if you want visual references.");
    return;
  }

  const payload = Object.fromEntries(new FormData(form).entries());
  payload.action = "generateWidgetCss";
  payload.establishmentId = state.widgetEditor.establishmentId;
  payload.currentCss = state.widgetEditor.draftCss;
  payload.currentContentText = state.widgetEditor.draftContentText;
  payload.reasoningEffort = state.widgetEditor.reasoningEffort;
  payload.requestText = state.widgetEditor.prompt;
  payload.attachments = state.widgetEditor.attachments;
  payload.useSavedCssBaseline = state.widgetEditor.useSavedBaseline;

  try {
    setStatus(
      "widgetEditor",
      "info",
      state.widgetEditor.useSavedBaseline
        ? "Generating CSS from the latest saved baseline..."
        : "Generating CSS from the current draft...",
      { processing: true },
    );
    const data = await postJson("/api/widget-editor", payload, "widgetEditor");
    state.widgetEditor.draftCss = data.cssText ?? "";
    if (typeof data.contentText === "string") {
      state.widgetEditor.draftContentText = data.contentText;
    }
    state.widgetEditor.lastGeneratedModel = data.model ?? payload.model ?? "";
    state.widgetEditor.model = payload.model ?? state.widgetEditor.model;
    if (state.widgetEditor.useSavedBaseline) {
      state.widgetEditor.prompt = "";
    }
    setStatus(
      "widgetEditor",
      "success",
      data.message ?? `${editor.generatedLabel} generated${state.widgetEditor.lastGeneratedModel ? ` with ${state.widgetEditor.lastGeneratedModel}` : ""}.`,
    );
  } finally {
    clearWidgetEditorAttachments();
  }
}

async function handleWidgetEditorSave(form) {
  const establishment = getSelectedWidgetEditorEstablishment();
  const editor = getThemeEditorConfig();
  if (!establishment) {
    setStatus("widgetEditor", "error", "Choose an establishment first.");
    return;
  }

  const payload = Object.fromEntries(new FormData(form).entries());
  payload.action = "saveWidgetCss";
  payload.establishmentId = state.widgetEditor.establishmentId;
  payload.cssText = state.widgetEditor.draftCss;
  payload.contentText = state.widgetEditor.draftContentText;

  setStatus("widgetEditor", "info", `Saving ${editor.savedLabel}...`, { processing: true });
  const data = await postJson("/api/widget-editor", payload, "widgetEditor");
  await refreshAdminState();
  state.widgetEditor.draftCss = data.theme?.cssText ?? state.widgetEditor.draftCss;
  if (typeof data.theme?.contentText === "string") {
    state.widgetEditor.draftContentText = data.theme.contentText;
  }
  setStatus("widgetEditor", "success", data.message ?? `${editor.savedLabel} saved.`);
}

async function handleWidgetEditorPromptSave() {
  const name = state.widgetEditor.promptName.trim();
  const promptText = state.widgetEditor.prompt.trim();
  if (!name) {
    setStatus("widgetEditor", "error", "Enter a prompt name first.");
    return;
  }

  if (!promptText) {
    setStatus("widgetEditor", "error", "Enter prompt text first.");
    return;
  }

  const payload = {
    action: "savePrompt",
    widgetKey: getActiveThemeEditorKey(),
    promptId: state.widgetEditor.selectedPromptId,
    name,
    promptText,
  };

  setStatus(
    "widgetEditor",
    "info",
    state.widgetEditor.selectedPromptId ? "Updating saved prompt..." : "Saving prompt...",
    { processing: true },
  );
  const data = await postJson("/api/widget-editor", payload, "widgetEditor");
  state.widgetEditor.savedPrompts = mergeWidgetEditorPromptSet(
    state.widgetEditor.savedPrompts,
    data.prompts,
    getActiveThemeEditorKey(),
  );
  if (data.prompt?.id) {
    state.widgetEditor.selectedPromptId = data.prompt.id;
    state.widgetEditor.promptName = data.prompt.name ?? name;
    state.widgetEditor.prompt = data.prompt.promptText ?? promptText;
  }
  setStatus("widgetEditor", "success", data.message ?? "Prompt saved.");
}

async function handleWidgetEditorPromptDelete(promptId) {
  const prompt = getActiveThemeEditorPrompts().find((item) => item.id === promptId);
  if (!prompt) {
    return;
  }

  if (!confirm(`Delete saved prompt "${prompt.name}"?`)) {
    return;
  }

  setStatus("widgetEditor", "info", "Deleting saved prompt...", { processing: true });
  const data = await postJson(
    "/api/widget-editor",
    { action: "deletePrompt", widgetKey: getActiveThemeEditorKey(), promptId },
    "widgetEditor",
  );
  state.widgetEditor.savedPrompts = mergeWidgetEditorPromptSet(
    state.widgetEditor.savedPrompts,
    data.prompts,
    getActiveThemeEditorKey(),
  );
  if (state.widgetEditor.selectedPromptId === promptId) {
    clearWidgetEditorPromptSelection({ preservePrompt: false });
  }
  setStatus("widgetEditor", "success", data.message ?? "Prompt deleted.");
}

async function handleWidgetEditorFiles(fileList, options = {}) {
  const append = options.append === true;
  const sourceLabel = options.sourceLabel ?? "uploaded";
  const uploadLimitBytes = state.appSettings.widgetEditorUploadLimitBytes;
  const uploadLimitLabel = formatMegabytes(uploadLimitBytes);

  if (!fileList?.length) {
    if (!append) {
      clearWidgetEditorAttachments();
    }
    return;
  }

  const files = Array.from(fileList);
  const existingApproxBytes = state.widgetEditor.attachments.reduce(
    (sum, attachment) => sum + approximateDataUrlBytes(attachment.dataUrl),
    0,
  );
  const newBytes = files.reduce((sum, file) => sum + Number(file.size || 0), 0);
  const totalBytes = existingApproxBytes + newBytes;
  if (totalBytes > uploadLimitBytes) {
    setStatus(
      "widgetEditor",
      "error",
      `Keep uploaded reference files under roughly ${uploadLimitLabel} MB total.`,
    );
    return;
  }

  setStatus("widgetEditor", "info", `Loading ${sourceLabel} reference files...`, { processing: true });
  const loadedAttachments = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      kind: file.type.startsWith("image/") ? "image" : "file",
      dataUrl: await readFileAsDataUrl(file),
    })),
  );
  state.widgetEditor.attachments = append
    ? [...state.widgetEditor.attachments, ...loadedAttachments]
    : loadedAttachments;
  setStatus(
    "widgetEditor",
    "success",
    `${state.widgetEditor.attachments.length} reference file${state.widgetEditor.attachments.length === 1 ? "" : "s"} ready.`,
  );
}

function clearWidgetEditorAttachments() {
  state.widgetEditor.attachments = [];
  const input = document.querySelector("[data-widget-editor-files]");
  if (input) {
    input.value = "";
  }
}

function getClipboardFiles(clipboardData) {
  if (!clipboardData?.items?.length) {
    return [];
  }

  const files = [];
  for (const item of Array.from(clipboardData.items)) {
    if (item.kind !== "file") {
      continue;
    }

    const file = item.getAsFile();
    if (file) {
      const name = file.name || inferClipboardFileName(file.type);
      files.push(new File([file], name, { type: file.type || "application/octet-stream" }));
    }
  }

  return files;
}

function inferClipboardFileName(mimeType) {
  if (mimeType === "image/png") {
    return `pasted-screenshot-${Date.now()}.png`;
  }

  if (mimeType === "image/jpeg") {
    return `pasted-image-${Date.now()}.jpg`;
  }

  return `pasted-file-${Date.now()}`;
}

function approximateDataUrlBytes(dataUrl) {
  const [, base64 = ""] = String(dataUrl ?? "").split(",", 2);
  return Math.floor((base64.length * 3) / 4);
}

function formatMegabytes(bytes) {
  return (Number(bytes ?? 0) / 1_000_000).toFixed(1).replace(/\.0$/, "");
}

function buildBookingReportFileName() {
  const report = state.bookingWorkspace.report;
  const start = report.fromDate || "report";
  const end = report.toDate || start;
  return `bookings-${start}-to-${end}.csv`;
}

function buildBookingDaySummary(bookings) {
  const grouped = new Map();

  for (const booking of bookings) {
    const key = String(booking.bookingDate ?? "");
    const current = grouped.get(key) ?? {
      date: key,
      label: formatWeekdayLabel(key),
      bookings: 0,
      guests: 0,
    };
    current.bookings += 1;
    current.guests += Number(booking.partySize ?? 0);
    grouped.set(key, current);
  }

  return Array.from(grouped.values()).sort((left, right) => left.date.localeCompare(right.date));
}

function formatWeekdayLabel(date) {
  const parsed = Date.parse(`${date}T00:00:00Z`);
  if (!parsed) {
    return "";
  }

  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(parsed));
}

function escapeCsvValue(value) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

async function logout() {
  await fetch("/api/logout", { method: "POST" });
  state.session = null;
  state.users = [];
  state.companies = [];
  state.appSettings = createDefaultAppSettings();
  state.emailTestDraft = createDefaultEmailTestDraft();
  state.authForms = createDefaultAuthForms();
  state.openAiModelDraft = state.appSettings.openAiModel;
  state.openAiReasoningEffortDraft = state.appSettings.openAiReasoningEffort;
  state.widgetEditorMaxOutputTokensDraft = String(state.appSettings.widgetEditorMaxOutputTokens);
  state.widgetEditorUploadLimitDraftMb = formatMegabytes(state.appSettings.widgetEditorUploadLimitBytes);
  state.adminAvailability = [];
  state.selectedUserIds.clear();
  state.selectedCompanyIds.clear();
  state.selectedEstablishmentIds.clear();
  state.selectedSeatCountIds.clear();
  state.userForm = createEmptyUserForm();
  state.companyForm = createEmptyCompanyForm();
  state.bookingWorkspace = createBookingWorkspaceState();
  state.widgetEditor = createEmptyWidgetEditorState();
  state.adminCalendar.selectedDate = "";
  state.adminCalendar.selectedTime = "";
  state.adminCalendar.modal = null;
  state.adminCalendar.editingBookingId = "";
  await loadSession();
  setStatus("auth", "success", "Signed out.");
  navigate("/login");
}

async function refreshAdminState() {
  await loadSession();
  if (hasSettingsAccess()) {
    await loadAdminData();
    await refreshAdminAvailability();
  } else {
    state.users = [];
    state.companies = [];
    state.adminAvailability = [];
  }
  syncWidgetEditorSelections();
  syncWidgetFromLocation();
  render();
}

async function refreshWidgetAvailability(options = {}) {
  return refreshWidgetAvailabilityImpl(options);
}

async function refreshWidgetAvailabilityImpl(options = {}) {
  const silent = options.silent === true;
  if (!state.widget.seatCountId) {
    state.widgetAvailability = [];
    state.widget.selectedDate = "";
    state.widget.selectedTime = "";
    state.widget.modal = null;
    return;
  }

  if (!silent) {
    setStatus("widget", "info", "Loading availability...");
  }
  const monthStart = monthStartDate(state.widget.currentMonth);
  const days = daysInMonth(state.widget.currentMonth);
  const response = await fetch(
    `/api/widget?action=availability&seatCountId=${encodeURIComponent(state.widget.seatCountId)}&fromDate=${encodeURIComponent(monthStart)}&days=${days}`,
  );
  const data = await readApiResponse(response);

  if (!response.ok) {
    state.widgetAvailability = [];
    state.widget.modal = null;
    setStatus("widget", "error", data.error ?? "Availability could not be loaded.");
    return;
  }

  state.widgetAvailability = data.dates ?? [];
  if (!silent) {
    clearStatus("widget");
  }
  if (!state.widgetAvailability.find((item) => item.date === state.widget.selectedDate)) {
    state.widget.selectedDate = state.widgetAvailability[0]?.date ?? "";
    state.widget.selectedTime = "";
    state.widget.modal = null;
  }

  const selectedDate = state.widgetAvailability.find((item) => item.date === state.widget.selectedDate);
  if (selectedDate && !selectedDate.canBook) {
    state.widget.selectedTime = "";
    state.widget.modal = null;
  }
  if (selectedDate && !selectedDate.slots.some((slot) => slot.time === state.widget.selectedTime && slot.available)) {
    state.widget.selectedTime = "";
    if (state.widget.modal === "details") {
      state.widget.modal = "time";
    }
  }
}

async function refreshAdminAvailability(options = {}) {
  const silent = options.silent === true;
  if (!state.adminCalendar.seatCountId || !hasSettingsAccess()) {
    state.adminAvailability = [];
    state.adminCalendar.selectedDate = "";
    state.adminCalendar.selectedTime = "";
    state.adminCalendar.modal = null;
    state.adminCalendar.editingBookingId = "";
    return;
  }

  if (!silent) {
    setStatus("bookings", "info", "Loading booking calendar...", { processing: true });
  }
  const monthStart = monthStartDate(state.adminCalendar.currentMonth);
  const days = daysInMonth(state.adminCalendar.currentMonth);
  const response = await fetch(
    `/api/bookings?action=calendar&seatCountId=${encodeURIComponent(state.adminCalendar.seatCountId)}&fromDate=${encodeURIComponent(monthStart)}&days=${days}`,
  );
  const data = await readApiResponse(response);

  if (!response.ok) {
    state.adminAvailability = [];
    setStatus("bookings", "error", data.error ?? "Booking calendar could not be loaded.");
    return;
  }

  state.adminAvailability = data.dates ?? [];
  if (!silent) {
    clearStatus("bookings");
  }
  if (!state.adminAvailability.find((item) => item.date === state.adminCalendar.selectedDate)) {
    state.adminCalendar.selectedDate = "";
    state.adminCalendar.selectedTime = "";
    state.adminCalendar.editingBookingId = "";
    state.adminCalendar.modal = null;
  }
}

function syncLiveRefresh() {
  const widgetShouldPoll =
    document.visibilityState === "visible" &&
    location.pathname === "/widget" &&
    Boolean(state.widget.seatCountId) &&
    !state.widget.modal &&
    !isWidgetInputActive();
  const settingsInputActive = isSettingsInputActive();
  const adminShouldPoll =
    document.visibilityState === "visible" &&
    location.pathname === "/settings" &&
    hasSettingsAccess() &&
    Boolean(state.adminCalendar.seatCountId) &&
    !settingsInputActive &&
    state.dirtyOpeningHoursEstablishmentIds.size === 0;

  if (widgetShouldPoll && !widgetLiveRefreshHandle) {
    widgetLiveRefreshHandle = setInterval(() => {
      if (widgetRefreshInFlight) {
        return;
      }

      widgetRefreshInFlight = true;
      refreshWidgetAvailability({ silent: true })
        .then(() => render())
        .catch(() => {})
        .finally(() => {
          widgetRefreshInFlight = false;
        });
    }, 4000);
  }

  if (!widgetShouldPoll && widgetLiveRefreshHandle) {
    clearInterval(widgetLiveRefreshHandle);
    widgetLiveRefreshHandle = null;
  }

  if (adminShouldPoll && !adminLiveRefreshHandle) {
    adminLiveRefreshHandle = setInterval(() => {
      if (adminRefreshInFlight) {
        return;
      }

      adminRefreshInFlight = true;
      refreshAdminAvailability({ silent: true })
        .then(() => render())
        .catch(() => {})
        .finally(() => {
          adminRefreshInFlight = false;
        });
    }, 4000);
  }

  if (!adminShouldPoll && adminLiveRefreshHandle) {
    clearInterval(adminLiveRefreshHandle);
    adminLiveRefreshHandle = null;
  }
}

function scheduleWidgetHeightSync() {
  if (!isPublicBookingRoute()) {
    return;
  }

  if (widgetHeightSyncHandle) {
    cancelAnimationFrame(widgetHeightSyncHandle);
  }

  widgetHeightSyncHandle = requestAnimationFrame(() => {
    widgetHeightSyncHandle = null;
    postWidgetHeightToParent();
  });
}

function postWidgetHeightToParent() {
  if (!isPublicBookingRoute() || window.parent === window) {
    return;
  }

  const root =
    document.querySelector(".widget-theme-root") ??
    document.querySelector(".page-view-theme-root") ??
    document.querySelector("#app");
  const modalBackdrop = document.querySelector(".widget-modal-backdrop");
  const rootStyles = root ? window.getComputedStyle(root) : null;
  const rootMargins = rootStyles
    ? (Number.parseFloat(rootStyles.marginTop) || 0) + (Number.parseFloat(rootStyles.marginBottom) || 0)
    : 0;
  const measuredHeight = root
    ? Math.ceil(root.getBoundingClientRect().height + rootMargins)
    : 0;
  const modalViewportHeight = modalBackdrop ? Math.ceil(window.innerHeight) : 0;
  const fallbackHeight = Math.ceil(
    Math.max(
      document.documentElement.offsetHeight,
      document.body.offsetHeight,
      document.documentElement.clientHeight,
      document.body.clientHeight,
    ),
  );
  const height = Math.max(root ? measuredHeight : fallbackHeight, fallbackHeight, modalViewportHeight);

  window.parent.postMessage(
    {
      type: "booking-widget:height",
      height,
    },
    "*",
  );
}

function isSettingsInputActive() {
  if (location.pathname !== "/settings") {
    return false;
  }

  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLElement)) {
    return false;
  }

  return Boolean(activeElement.closest("input, select, textarea"));
}

function isWidgetInputActive() {
  if (location.pathname !== "/widget") {
    return false;
  }

  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLElement)) {
    return false;
  }

  return Boolean(activeElement.closest(".widget-form input, .widget-form select, .widget-form textarea"));
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

function syncAuthRouteState() {
  if (!isAuthRoute()) {
    return;
  }

  const resetToken = getPasswordResetTokenFromLocation();
  if (!resetToken) {
    clearPasswordResetTokenState();
    if (!isForgotPasswordView()) {
      clearStatus("passwordReset");
    }
    return;
  }

  if (
    state.authForms.resetTokenChecked === resetToken &&
    (state.authForms.resetTokenStatus === "loading" ||
      state.authForms.resetTokenStatus === "valid" ||
      state.authForms.resetTokenStatus === "invalid")
  ) {
    return;
  }

  state.authForms.resetTokenChecked = resetToken;
  state.authForms.resetTokenStatus = "loading";
  state.authForms.resetTokenError = "";
  fetch(`/api/password-reset?action=validate&token=${encodeURIComponent(resetToken)}`)
    .then((response) => readApiResponse(response).then((data) => ({ response, data })))
    .then(({ response, data }) => {
      state.authForms.resetTokenStatus = response.ok ? "valid" : "invalid";
      state.authForms.resetTokenError = response.ok ? "" : data.error ?? "This password reset link is invalid or has expired.";
      render();
    })
    .catch(() => {
      state.authForms.resetTokenStatus = "invalid";
      state.authForms.resetTokenError = "This password reset link could not be verified.";
      render();
    });
}

function clearPasswordResetTokenState() {
  state.authForms.resetTokenChecked = "";
  state.authForms.resetTokenStatus = "idle";
  state.authForms.resetTokenError = "";
}

function isAuthRoute(pathname = location.pathname) {
  return pathname === "/login" || pathname === "/";
}

function isForgotPasswordView() {
  return !hasPasswordResetToken() && new URLSearchParams(location.search).get("forgot") === "1";
}

function hasPasswordResetToken() {
  return Boolean(getPasswordResetTokenFromLocation());
}

function getPasswordResetTokenFromLocation() {
  const token = new URLSearchParams(location.search).get("resetToken") ?? "";
  return /^[A-Za-z0-9_-]{20,200}$/.test(token) ? token : "";
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function redirectSignedInUserFromLogin() {
  if (!state.session || (location.pathname !== "/login" && location.pathname !== "/")) {
    return false;
  }

  history.replaceState({}, "", getSignedInLandingPath());
  return true;
}

function getSignedInLandingPath() {
  return hasSettingsAccess() ? "/settings" : "/widget";
}

function isPublicBookingRoute(pathname = location.pathname) {
  return pathname === "/widget" || pathname === "/page-view";
}

function getActiveThemeEditorKey(pathname = location.pathname) {
  return pathname === "/page-view-editor" ? "booking_page_view" : "booking_calendar";
}

function isAdminSession() {
  return state.session?.authLevel === "admin";
}

function isManagerSession() {
  return state.session?.authLevel === "manager";
}

function isStaffSession() {
  return state.session?.authLevel === "staff";
}

function hasSettingsAccess() {
  return isAdminSession() || isManagerSession() || isStaffSession();
}

function canAccessBookingReports() {
  return isAdminSession() || isManagerSession();
}

function canManageBookingClosures() {
  return isAdminSession() || isManagerSession();
}

function isScopedSettingsSession() {
  return location.pathname === "/settings" && (isManagerSession() || isStaffSession());
}

function needsSettingsRedirect() {
  return location.pathname === "/settings" && state.userCount > 0 && !hasSettingsAccess();
}

function needsAdminOnlyRedirect() {
  return (
    (location.pathname === "/widget-setup" || location.pathname === "/widget-editor") &&
    state.userCount > 0 &&
    !isAdminSession()
  );
}

function syncAdminFormDraft(target) {
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) {
    return false;
  }

  const userForm = target.closest("[data-user-form]");
  if (userForm) {
    updateUserFormDraft(target.name, target.value);
    return true;
  }

  const companyForm = target.closest("[data-company-form]");
  if (companyForm) {
    if (target.name === "name" || target.name === "enquiryEmail") {
      state.companyForm[target.name] = target.value;
      return true;
    }
  }

  return false;
}

function updateUserFormDraft(name, value) {
  if (!name || !(name in state.userForm)) {
    return;
  }

  state.userForm[name] = value;
}

function loadSectionPanelState() {
  try {
    const raw = localStorage.getItem(SECTION_PANEL_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function setSectionPanelState(id, open) {
  if (!id) {
    return;
  }

  state.sectionPanels[id] = open;

  try {
    localStorage.setItem(SECTION_PANEL_STORAGE_KEY, JSON.stringify(state.sectionPanels));
  } catch {}
}

function loadThemeEditorModelChoice(themeKey) {
  if (!themeKey) {
    return "";
  }

  try {
    return String(localStorage.getItem(`${THEME_EDITOR_MODEL_STORAGE_PREFIX}${themeKey}`) ?? "").trim();
  } catch {
    return "";
  }
}

function loadThemeEditorSavedBaselineChoice(themeKey) {
  if (!themeKey) {
    return false;
  }

  try {
    const stored = localStorage.getItem(`${THEME_EDITOR_SAVED_BASELINE_STORAGE_PREFIX}${themeKey}`);
    if (stored === null) {
      return false;
    }
    return stored === "true";
  } catch {
    return false;
  }
}

function loadThemeEditorReasoningChoice(themeKey) {
  if (!themeKey) {
    return "";
  }

  try {
    return String(localStorage.getItem(`${THEME_EDITOR_REASONING_STORAGE_PREFIX}${themeKey}`) ?? "").trim();
  } catch {
    return "";
  }
}

function persistThemeEditorModelChoice(themeKey, model) {
  if (!themeKey) {
    return;
  }

  try {
    localStorage.setItem(`${THEME_EDITOR_MODEL_STORAGE_PREFIX}${themeKey}`, String(model ?? "").trim());
  } catch {}
}

function persistThemeEditorReasoningChoice(themeKey, reasoningEffort) {
  if (!themeKey) {
    return;
  }

  try {
    localStorage.setItem(
      `${THEME_EDITOR_REASONING_STORAGE_PREFIX}${themeKey}`,
      String(reasoningEffort ?? "").trim(),
    );
  } catch {}
}

function persistThemeEditorSavedBaselineChoice(themeKey, enabled) {
  if (!themeKey) {
    return;
  }

  try {
    localStorage.setItem(
      `${THEME_EDITOR_SAVED_BASELINE_STORAGE_PREFIX}${themeKey}`,
      enabled ? "true" : "false",
    );
  } catch {}
}

function createEmptyUserForm() {
  return {
    mode: "create",
    userId: null,
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    authLevel: "user",
    companyId: "",
    establishmentId: "",
  };
}

function createEmptyCompanyForm() {
  return {
    mode: "create",
    companyId: null,
    name: "",
    enquiryEmail: "",
  };
}

function createBookingWorkspaceState() {
  return {
    activeTab: "calendar",
    searchQuery: "",
    searchResults: [],
    searchHasRun: false,
    report: {
      ...createBookingReportFilterState(),
      results: [],
      totalGuests: 0,
      hasRun: false,
    },
  };
}

function createBookingReportFilterState() {
  const today = todayString();
  const currentMonth = monthKey(today);
  return {
    fromDate: monthStartDate(currentMonth),
    toDate: monthEndDate(currentMonth),
    fromTime: "",
    toTime: "",
  };
}

function createDefaultAppSettings() {
  return {
    openAiModel: "gpt-5.4-nano",
    openAiReasoningEffort: "",
    widgetEditorMaxOutputTokens: 25_000,
    widgetEditorUploadLimitBytes: 2_500_000,
    emailSettings: createDefaultEmailSettingsSummary(),
  };
}

function createDefaultEmailSettingsSummary() {
  return {
    configured: false,
    host: "",
    port: "",
    secure: true,
    user: "",
    fromAddress: "",
    missingEnvVars: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"],
  };
}

function createDefaultAuthForms() {
  return {
    loginEmail: "",
    loginPassword: "",
    forgotEmail: "",
    resetPassword: "",
    resetConfirmPassword: "",
    resetTokenChecked: "",
    resetTokenStatus: "idle",
    resetTokenError: "",
  };
}

function createDefaultEmailTestDraft() {
  return {
    recipientEmail: "",
    firstName: "Jordan",
    lastName: "Taylor",
    guestEmail: "jordan.taylor@example.com",
    phone: "+61 400 123 456",
    establishmentName: "Main Dining Room",
    bookingDate: todayString(),
    bookingTime: "19:00",
    partySize: "4",
    notes: "Window table if available. Celebrating a birthday.",
  };
}

function createEmptyWidgetEditorState() {
  return {
    companyId: "",
    establishmentId: "",
    model: "gpt-5.4-nano",
    reasoningEffort: "",
    activeKey: "",
    useSavedBaseline: false,
    themeDrafts: createEmptyWidgetEditorThemeDrafts(),
    promptName: "",
    prompt: "",
    selectedPromptId: "",
    savedPrompts: [],
    draftContentText: "",
    draftCss: "",
    attachments: [],
    lastGeneratedModel: "",
  };
}

function createEmptyWidgetEditorThemeDrafts() {
  return {
    booking_calendar: createEmptyWidgetEditorThemeDraft(),
    booking_page_view: createEmptyWidgetEditorThemeDraft(),
  };
}

function createEmptyWidgetEditorThemeDraft() {
  return {
    promptName: "",
    prompt: "",
    selectedPromptId: "",
    draftContentText: "",
    attachments: [],
    lastGeneratedModel: "",
  };
}

function setStatus(scope, kind, message, options = {}) {
  state.statuses[scope] = message
    ? {
        kind,
        message,
        processing: options.processing === true,
      }
    : null;
  render();
}

function clearStatus(scope) {
  state.statuses[scope] = null;
}

function renderStatus(scope) {
  const status = state.statuses[scope];
  const liveMode = status?.kind === "error" ? "assertive" : "polite";
  return `<div class="status ${status?.kind ?? ""}" role="status" aria-live="${liveMode}" aria-atomic="true">${escapeHtml(status?.message ?? "")}</div>`;
}

function isStatusProcessing(scope) {
  return state.statuses[scope]?.processing === true;
}

function setInlineFormStatus(form, kind, message) {
  const status = form.querySelector(".status");
  if (!status) {
    return;
  }

  status.className = `status ${kind ?? ""}`.trim();
  status.textContent = message ?? "";
}

function setSubmitPending(form, pending, label) {
  const button = form.querySelector('button[type="submit"]');
  if (!button) {
    return;
  }

  button.disabled = pending;
  button.setAttribute("aria-disabled", pending ? "true" : "false");
  button.textContent = label;
  form.setAttribute("aria-busy", pending ? "true" : "false");
}

function getFilteredUsers() {
  const derivedData = getDerivedAdminData();
  const term = state.filters.users.trim().toLowerCase();

  if (!term) {
    return state.users;
  }

  if (derivedData.filteredUsersTerm === term) {
    return derivedData.filteredUsersResult;
  }

  const filteredUsers = state.users.filter((user) => {
    const haystack = [
      user.firstName,
      user.lastName,
      user.email,
      user.authLevel,
      derivedData.companyNamesById.get(user.companyId)?.toLowerCase() ?? "",
      derivedData.establishmentsById.get(user.establishmentId)?.name?.toLowerCase() ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(term);
  });

  derivedData.filteredUsersTerm = term;
  derivedData.filteredUsersResult = filteredUsers;
  return filteredUsers;
}

function getFilteredCompanies() {
  const derivedData = getDerivedAdminData();
  const term = state.filters.companies.trim().toLowerCase();
  if (!term) {
    return state.companies;
  }

  if (derivedData.filteredCompaniesTerm === term) {
    return derivedData.filteredCompaniesResult;
  }

  const filteredCompanies = state.companies.filter((company) => {
    const seatText = company.establishments
      .flatMap((establishment) => establishment.seatCounts.map((seatCount) => String(seatCount.seatCount)))
      .join(" ");
    const establishmentNames = company.establishments.map((establishment) => establishment.name).join(" ");
    return `${company.name} ${establishmentNames} ${seatText}`.toLowerCase().includes(term);
  });

  derivedData.filteredCompaniesTerm = term;
  derivedData.filteredCompaniesResult = filteredCompanies;
  return filteredCompanies;
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
  const establishmentIds = new Set(state.companies.flatMap((company) => company.establishments.map((item) => item.id)));
  const seatCountIds = new Set(
    state.companies.flatMap((company) =>
      company.establishments.flatMap((establishment) =>
        establishment.seatCounts.map((item) => item.id),
      ),
    ),
  );

  state.selectedUserIds = new Set(Array.from(state.selectedUserIds).filter((id) => userIds.has(id)));
  state.selectedCompanyIds = new Set(Array.from(state.selectedCompanyIds).filter((id) => companyIds.has(id)));
  state.selectedEstablishmentIds = new Set(Array.from(state.selectedEstablishmentIds).filter((id) => establishmentIds.has(id)));
  state.selectedSeatCountIds = new Set(Array.from(state.selectedSeatCountIds).filter((id) => seatCountIds.has(id)));
}

function getAllEstablishments() {
  return getDerivedAdminData().allEstablishments;
}

function getCompanyNameById(companyId) {
  return getDerivedAdminData().companyNamesById.get(companyId) ?? "";
}

function getEstablishmentLabel(establishmentId) {
  if (!establishmentId) {
    return "";
  }

  const establishment = getDerivedAdminData().establishmentsById.get(establishmentId);
  return establishment ? `${establishment.companyName} | ${establishment.name}` : "";
}

function getDerivedAdminData() {
  if (
    derivedAdminDataCache.companiesRef === state.companies &&
    derivedAdminDataCache.usersRef === state.users
  ) {
    return derivedAdminDataCache;
  }

  const allEstablishments = state.companies.flatMap((company) =>
    company.establishments.map((establishment) => ({
      ...establishment,
      companyName: company.name,
    })),
  );
  const companyNamesById = new Map(state.companies.map((company) => [company.id, company.name]));
  const establishmentsById = new Map(allEstablishments.map((establishment) => [establishment.id, establishment]));
  const usersByCompanyId = new Map();

  state.users.forEach((user) => {
    const companyUsers = usersByCompanyId.get(user.companyId) ?? [];
    companyUsers.push(user);
    usersByCompanyId.set(user.companyId, companyUsers);
  });

  derivedAdminDataCache.companiesRef = state.companies;
  derivedAdminDataCache.usersRef = state.users;
  derivedAdminDataCache.allEstablishments = allEstablishments;
  derivedAdminDataCache.companyNamesById = companyNamesById;
  derivedAdminDataCache.establishmentsById = establishmentsById;
  derivedAdminDataCache.usersByCompanyId = usersByCompanyId;
  derivedAdminDataCache.filteredUsersTerm = null;
  derivedAdminDataCache.filteredUsersResult = [];
  derivedAdminDataCache.filteredCompaniesTerm = null;
  derivedAdminDataCache.filteredCompaniesResult = [];
  return derivedAdminDataCache;
}

function syncWidgetSetupSelections() {
  const companies = getWidgetSetupCompanies();
  if (!companies.length) {
    state.widgetSetup = { companyId: "", establishmentId: "", seatCountId: "" };
    return;
  }

  if (!companies.some((company) => company.id === state.widgetSetup.companyId)) {
    state.widgetSetup.companyId = companies[0].id;
  }

  const establishments = getWidgetSetupEstablishments();
  if (!establishments.some((establishment) => establishment.id === state.widgetSetup.establishmentId)) {
    state.widgetSetup.establishmentId = establishments[0]?.id ?? "";
  }

  const seatCounts = getWidgetSetupSeatCounts();
  if (!seatCounts.some((seatCount) => seatCount.id === state.widgetSetup.seatCountId)) {
    state.widgetSetup.seatCountId = seatCounts[0]?.id ?? "";
  }
}

function syncWidgetEditorSelections() {
  const activeThemeKey = getActiveThemeEditorKey();
  const previousThemeKey = state.widgetEditor.activeKey;
  const previousEstablishmentId = state.widgetEditor.establishmentId;
  if (previousThemeKey && previousThemeKey !== activeThemeKey) {
    saveWidgetEditorThemeDraft(previousThemeKey);
  }
  if (previousThemeKey !== activeThemeKey) {
    restoreWidgetEditorThemeDraft(activeThemeKey);
  }
  const companies = getWidgetEditorCompanies();
  if (!companies.length) {
    state.widgetEditor.companyId = "";
    state.widgetEditor.establishmentId = "";
    state.widgetEditor.activeKey = activeThemeKey;
    state.widgetEditor.draftContentText = "";
    state.widgetEditor.draftCss = "";
    state.widgetEditor.attachments = [];
    state.widgetEditor.model = loadThemeEditorModelChoice(activeThemeKey) || state.appSettings.openAiModel;
    state.widgetEditor.reasoningEffort =
      loadThemeEditorReasoningChoice(activeThemeKey) || state.appSettings.openAiReasoningEffort;
    state.widgetEditor.useSavedBaseline = loadThemeEditorSavedBaselineChoice(activeThemeKey);
    return;
  }

  if (!companies.some((company) => company.id === state.widgetEditor.companyId)) {
    state.widgetEditor.companyId = companies[0].id;
  }

  const establishments = getWidgetEditorEstablishments();
  if (!establishments.some((establishment) => establishment.id === state.widgetEditor.establishmentId)) {
    state.widgetEditor.establishmentId = establishments[0]?.id ?? "";
  }

  const selectedEstablishment = getSelectedWidgetEditorEstablishment();
  const savedContentText = getSelectedThemeEditorContentText(selectedEstablishment, activeThemeKey);
  const savedCss = getSelectedThemeEditorCss(selectedEstablishment, activeThemeKey);
  const hasSavedCss = hasThemeEditorSavedCss(selectedEstablishment, activeThemeKey);
  if (
    (!state.widgetEditor.draftCss && !state.widgetEditor.draftContentText) ||
    previousEstablishmentId !== selectedEstablishment?.id ||
    previousThemeKey !== activeThemeKey
  ) {
    state.widgetEditor.draftContentText = savedContentText;
    state.widgetEditor.draftCss = savedCss;
  }
  const persistedModel = loadThemeEditorModelChoice(activeThemeKey);
  const persistedReasoningEffort = loadThemeEditorReasoningChoice(activeThemeKey);
  const persistedSavedBaseline = loadThemeEditorSavedBaselineChoice(activeThemeKey);
  if (!state.widgetEditor.model || previousThemeKey !== activeThemeKey) {
    state.widgetEditor.model = persistedModel || state.appSettings.openAiModel;
  }
  if (previousThemeKey !== activeThemeKey) {
    state.widgetEditor.reasoningEffort = persistedReasoningEffort || state.appSettings.openAiReasoningEffort;
  }
  if (previousThemeKey !== activeThemeKey || previousEstablishmentId !== selectedEstablishment?.id) {
    state.widgetEditor.useSavedBaseline = hasSavedCss ? persistedSavedBaseline : false;
  } else if (!hasSavedCss && state.widgetEditor.useSavedBaseline) {
    state.widgetEditor.useSavedBaseline = false;
  }
  state.widgetEditor.activeKey = activeThemeKey;

  if (
    state.widgetEditor.selectedPromptId &&
    !getActiveThemeEditorPrompts().some((prompt) => prompt.id === state.widgetEditor.selectedPromptId)
  ) {
    state.widgetEditor.selectedPromptId = "";
    state.widgetEditor.promptName = "";
  }
}

function saveWidgetEditorThemeDraft(themeKey) {
  const draft = ensureWidgetEditorThemeDraft(themeKey);
  draft.promptName = state.widgetEditor.promptName;
  draft.prompt = state.widgetEditor.prompt;
  draft.selectedPromptId = state.widgetEditor.selectedPromptId;
  draft.draftContentText = state.widgetEditor.draftContentText;
  draft.attachments = state.widgetEditor.attachments.map((attachment) => ({ ...attachment }));
  draft.lastGeneratedModel = state.widgetEditor.lastGeneratedModel;
}

function restoreWidgetEditorThemeDraft(themeKey) {
  const draft = ensureWidgetEditorThemeDraft(themeKey);
  state.widgetEditor.promptName = draft.promptName;
  state.widgetEditor.prompt = draft.prompt;
  state.widgetEditor.selectedPromptId = draft.selectedPromptId;
  state.widgetEditor.draftContentText = draft.draftContentText;
  state.widgetEditor.attachments = draft.attachments.map((attachment) => ({ ...attachment }));
  state.widgetEditor.lastGeneratedModel = draft.lastGeneratedModel;
}

function ensureWidgetEditorThemeDraft(themeKey) {
  if (!state.widgetEditor.themeDrafts[themeKey]) {
    state.widgetEditor.themeDrafts[themeKey] = createEmptyWidgetEditorThemeDraft();
  }
  return state.widgetEditor.themeDrafts[themeKey];
}

function syncAdminCalendarSelections() {
  const companies = getAdminCalendarCompanies();
  if (!companies.length) {
    state.adminCalendar.companyId = "";
    state.adminCalendar.establishmentId = "";
    state.adminCalendar.seatCountId = "";
    state.adminAvailability = [];
    clearBookingWorkspaceResults({ resetFilters: true });
    return;
  }

  if (!companies.some((company) => company.id === state.adminCalendar.companyId)) {
    state.adminCalendar.companyId = companies[0].id;
  }

  const establishments = getAdminCalendarEstablishments();
  if (!establishments.some((establishment) => establishment.id === state.adminCalendar.establishmentId)) {
    state.adminCalendar.establishmentId = establishments[0]?.id ?? "";
  }

  const seatCounts = getAdminCalendarSeatCounts();
  if (!seatCounts.some((seatCount) => seatCount.id === state.adminCalendar.seatCountId)) {
    state.adminCalendar.seatCountId = seatCounts[0]?.id ?? "";
    clearBookingWorkspaceResults();
  }
}

function clearBookingWorkspaceResults(options = {}) {
  state.bookingWorkspace.searchResults = [];
  state.bookingWorkspace.searchHasRun = false;
  state.bookingWorkspace.report.results = [];
  state.bookingWorkspace.report.totalGuests = 0;
  state.bookingWorkspace.report.hasRun = false;

  if (options.resetFilters === true) {
    state.bookingWorkspace.searchQuery = "";
    state.bookingWorkspace.report = {
      ...createBookingReportFilterState(),
      results: [],
      totalGuests: 0,
      hasRun: false,
    };
  }
}

function loadWidgetEditorPrompt(promptId) {
  const prompt = getActiveThemeEditorPrompts().find((item) => item.id === promptId);
  if (!prompt) {
    return;
  }

  state.widgetEditor.selectedPromptId = prompt.id;
  state.widgetEditor.promptName = prompt.name;
  state.widgetEditor.prompt = prompt.promptText;
  setStatus("widgetEditor", "info", `Loaded prompt "${prompt.name}".`);
}

function clearWidgetEditorPromptSelection(options = {}) {
  const preservePrompt = options.preservePrompt !== false;
  state.widgetEditor.selectedPromptId = "";
  state.widgetEditor.promptName = "";
  if (!preservePrompt) {
    state.widgetEditor.prompt = "";
  }
  clearStatus("widgetEditor");
}

function normalizeWidgetEditorPrompts(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => ({
      id: String(item?.id ?? ""),
      widgetKey: String(item?.widgetKey ?? ""),
      name: String(item?.name ?? "").trim(),
      promptText: String(item?.promptText ?? ""),
      updatedAt: item?.updatedAt ?? null,
    }))
    .filter((item) => item.id && item.name)
    .sort((left, right) => {
      const leftTime = Date.parse(left.updatedAt ?? "") || 0;
      const rightTime = Date.parse(right.updatedAt ?? "") || 0;
      return rightTime - leftTime || left.name.localeCompare(right.name);
    });
}

function mergeWidgetEditorPromptSet(existingPrompts, nextPrompts, widgetKey) {
  const normalizedExisting = normalizeWidgetEditorPrompts(existingPrompts);
  const normalizedNext = normalizeWidgetEditorPrompts(nextPrompts);
  return normalizeWidgetEditorPrompts([
    ...normalizedExisting.filter((prompt) => prompt.widgetKey !== widgetKey),
    ...normalizedNext,
  ]);
}

function previewWidgetEditorPrompt(value) {
  const collapsed = String(value ?? "").replace(/\s+/g, " ").trim();
  if (collapsed.length <= 180) {
    return collapsed;
  }

  return `${collapsed.slice(0, 177)}...`;
}

function formatSavedPromptUpdatedAt(value) {
  const parsed = Date.parse(String(value ?? ""));
  if (!parsed) {
    return "Saved prompt";
  }

  return `Updated ${new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(parsed))}`;
}

function syncWidgetFromLocation() {
  const seatCountId = getSeatCountIdFromLocation();

  if (!isPublicBookingRoute()) {
    return;
  }

  state.widget.seatCountId = seatCountId;
  const seatCount = getSeatCountById(seatCountId);

  if (seatCount) {
    if (!state.widget.currentMonth) {
      state.widget.currentMonth = monthKey(todayString());
    }
    refreshWidgetAvailability().then(render);
    return;
  }

  state.widgetAvailability = [];
  state.widget.selectedDate = "";
  state.widget.selectedTime = "";
  state.widget.modal = null;
}

function getSeatCountIdFromLocation() {
  return new URLSearchParams(location.search).get("seatCountId") ?? "";
}

function getWidgetPreviewCssOverride() {
  return getThemeEditorPreviewPayload().cssText;
}

function getWidgetSetupEstablishments() {
  const company = getWidgetSetupCompanies().find((item) => item.id === state.widgetSetup.companyId);
  return company?.establishments ?? [];
}

function getWidgetSetupSeatCounts() {
  const establishment = getWidgetSetupEstablishments().find(
    (item) => item.id === state.widgetSetup.establishmentId,
  );
  return (establishment?.seatCounts ?? []).map((seatCount) => ({
    ...seatCount,
    label: formatSeatCountLabel(seatCount),
  }));
}

function getWidgetUrl() {
  const origin = location.origin;
  return `${origin}/widget?seatCountId=${encodeURIComponent(state.widgetSetup.seatCountId)}`;
}

function getPageViewUrl() {
  const origin = location.origin;
  return `${origin}/page-view?seatCountId=${encodeURIComponent(state.widgetSetup.seatCountId)}`;
}

function getSelectedSeatCountLabel() {
  return getWidgetSetupSeatCounts().find((seatCount) => seatCount.id === state.widgetSetup.seatCountId)?.label ?? "";
}

function getSelectedEstablishmentLabel() {
  return getWidgetSetupEstablishments().find(
    (establishment) => establishment.id === state.widgetSetup.establishmentId,
  )?.name;
}

function getSeatCountById(seatCountId) {
  for (const company of getWidgetCatalogSource()) {
    for (const establishment of company.establishments) {
      for (const seatCount of establishment.seatCounts) {
        if (seatCount.id === seatCountId) {
          return {
            ...seatCount,
            label: formatSeatCountLabel(seatCount),
            companyName: company.name,
            companyEnquiryEmail: company.enquiryEmail || "",
            establishmentName: establishment.name,
            establishmentLabel: `${company.name} | ${establishment.name}`,
            widgetThemeCss: establishment.widgetTheme?.cssText ?? "",
            pageViewThemeCss: establishment.pageViewTheme?.cssText ?? "",
            pageViewThemeContentText: establishment.pageViewTheme?.contentText ?? "",
          };
        }
      }
    }
  }

  return null;
}

function getWidgetSetupCompanies() {
  return state.companies.length ? state.companies : state.widgetCatalog;
}

function getWidgetEditorCompanies() {
  return state.companies;
}

function getWidgetEditorEstablishments() {
  const company = getWidgetEditorCompanies().find((item) => item.id === state.widgetEditor.companyId);
  return company?.establishments ?? [];
}

function getSelectedWidgetEditorEstablishment() {
  return getWidgetEditorEstablishments().find(
    (establishment) => establishment.id === state.widgetEditor.establishmentId,
  ) ?? null;
}

function getAdminCalendarCompanies() {
  return state.companies;
}

function getAdminCalendarEstablishments() {
  const company = getAdminCalendarCompanies().find((item) => item.id === state.adminCalendar.companyId);
  return company?.establishments ?? [];
}

function getAdminCalendarSeatCounts() {
  const establishment = getAdminCalendarEstablishments().find(
    (item) => item.id === state.adminCalendar.establishmentId,
  );
  return establishment?.seatCounts ?? [];
}

function getWidgetCatalogSource() {
  return state.widgetCatalog.length ? state.widgetCatalog : state.companies;
}

function getSelectedWidgetSeatCount() {
  return getSeatCountById(state.widget.seatCountId);
}

function getActiveThemeEditorPrompts() {
  const activeKey = getActiveThemeEditorKey();
  return state.widgetEditor.savedPrompts.filter((prompt) => prompt.widgetKey === activeKey);
}

function getSelectedThemeEditorCss(establishment, themeKey = getActiveThemeEditorKey()) {
  if (!establishment) {
    return "";
  }

  return themeKey === "booking_page_view"
    ? establishment.pageViewTheme?.cssText ?? ""
    : establishment.widgetTheme?.cssText ?? "";
}

function getSelectedThemeEditorContentText(establishment, themeKey = getActiveThemeEditorKey()) {
  if (!establishment) {
    return "";
  }

  return themeKey === "booking_page_view"
    ? establishment.pageViewTheme?.contentText ?? ""
    : establishment.widgetTheme?.contentText ?? "";
}

function hasThemeEditorSavedCss(establishment, themeKey = getActiveThemeEditorKey()) {
  return Boolean(getSelectedThemeEditorCss(establishment, themeKey).trim());
}

function getThemeEditorPreviewUrl(themeKey = getActiveThemeEditorKey()) {
  const editor = getThemeEditorConfig(themeKey);
  const establishment = getSelectedWidgetEditorEstablishment();
  const seatCountId = establishment?.seatCounts?.[0]?.id ?? "";
  return seatCountId
    ? `${location.origin}${editor.previewPath}?seatCountId=${encodeURIComponent(seatCountId)}`
    : "";
}

function buildThemeEditorPreviewUrl(baseUrl = getThemeEditorPreviewUrl()) {
  if (!baseUrl) {
    return "";
  }

  const token = `widget-preview-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  try {
    localStorage.setItem(
      token,
      JSON.stringify({
        cssText: state.widgetEditor.draftCss ?? "",
        contentText: state.widgetEditor.draftContentText ?? "",
        createdAt: Date.now(),
      }),
    );
  } catch {
    return baseUrl;
  }

  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}previewToken=${encodeURIComponent(token)}`;
}

function openThemeEditorPreview(previewUrl) {
  const anchor = document.createElement("a");
  anchor.href = previewUrl;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

function getThemeEditorPreviewPayload() {
  if (!isPublicBookingRoute()) {
    return { cssText: "", contentText: "" };
  }

  const params = new URLSearchParams(location.search);
  const token = String(params.get("previewToken") ?? "").trim();
  if (!token) {
    return { cssText: "", contentText: "" };
  }

  try {
    const raw = localStorage.getItem(token);
    if (!raw) {
      return { cssText: "", contentText: "" };
    }

    const payload = JSON.parse(raw);
    if (Date.now() - Number(payload.createdAt ?? 0) > 1000 * 60 * 60 * 4) {
      localStorage.removeItem(token);
      return { cssText: "", contentText: "" };
    }

    return {
      cssText: String(payload.cssText ?? ""),
      contentText: String(payload.contentText ?? ""),
    };
  } catch {
    return { cssText: "", contentText: "" };
  }
}

function formatSeatCountLabel(seatCount) {
  const capacity = Math.max(Number(seatCount?.seatCount ?? 0), 0);
  const visitDurationLabel = formatVisitDuration(seatCount?.guestVisitMinutes);
  const maxPartySize = Math.max(Number(seatCount?.maxPartySize ?? capacity), 0);
  return `${capacity} max guests | ${visitDurationLabel} visits | ${maxPartySize} online`;
}

function clampWidgetPartySizeInput(target) {
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  const maxBookablePartySize = Math.max(Number(target.dataset.maxBookablePartySize ?? target.max ?? 1) || 1, 1);
  const rawValue = Number(target.value);
  if (!Number.isFinite(rawValue)) {
    return;
  }

  target.value = String(Math.min(Math.max(Math.trunc(rawValue), 1), maxBookablePartySize));
}

function markOpeningHoursDirty(target) {
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const establishmentId = String(target.dataset.establishmentId ?? "").trim();
  if (!establishmentId) {
    return;
  }

  state.dirtyOpeningHoursEstablishmentIds.add(establishmentId);
  syncLiveRefresh();
}

function formatVisitDuration(minutes) {
  const totalMinutes = Math.max(Number(minutes) || 0, 0);
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  if (!hours) {
    return `${totalMinutes} min`;
  }

  if (!remainingMinutes) {
    return `${hours} hr${hours === 1 ? "" : "s"}`;
  }

  return `${hours} hr ${remainingMinutes} min`;
}

function promptForSeatCountConfig(current = {}) {
  const seatCount = prompt("Max capacity", String(current.seatCount ?? "40"));
  if (seatCount === null) {
    return null;
  }

  const maxPartySize = prompt(
    "Max online booking party size",
    String(current.maxPartySize ?? current.seatCount ?? "40"),
  );
  if (maxPartySize === null) {
    return null;
  }

  const guestVisitMinutes = prompt(
    "Guest visit time in minutes",
    String(current.guestVisitMinutes ?? "90"),
  );
  if (guestVisitMinutes === null) {
    return null;
  }

  return {
    seatCount: String(seatCount).trim(),
    maxPartySize: String(maxPartySize).trim(),
    guestVisitMinutes: String(guestVisitMinutes).trim(),
  };
}

function getAdminSelectedBooking() {
  for (const date of state.adminAvailability) {
    for (const slot of date.slots) {
      for (const booking of slot.bookings ?? []) {
        if (booking.id === state.adminCalendar.editingBookingId) {
          return booking;
        }
      }
    }
  }

  return null;
}

function getEditingBookingValue(field) {
  const booking = getAdminSelectedBooking();
  if (!booking) {
    return "";
  }

  return booking[field] ?? "";
}

function collectOpeningHours(establishmentId) {
  return Array.from({ length: 7 }, (_, weekdayIndex) => {
    const openInput = document.querySelector(
      `[data-hours-open][data-establishment-id="${establishmentId}"][data-weekday="${weekdayIndex}"]`,
    );
    const startInput = document.querySelector(
      `[data-hours-start][data-establishment-id="${establishmentId}"][data-weekday="${weekdayIndex}"]`,
    );
    const endInput = document.querySelector(
      `[data-hours-end][data-establishment-id="${establishmentId}"][data-weekday="${weekdayIndex}"]`,
    );

    return {
      weekdayIndex,
      isOpen: Boolean(openInput?.checked),
      openTime: startInput?.value ?? "",
      closeTime: endInput?.value ?? "",
    };
  });
}

function monthKey(dateString) {
  return dateString.slice(0, 7);
}

function parseMonthKey(key) {
  const [year, month] = key.split("-").map(Number);
  return { year, monthIndex: month - 1 };
}

function monthStartDate(key) {
  return `${key}-01`;
}

function monthEndDate(key) {
  const { year, monthIndex } = parseMonthKey(key);
  return toDateString(year, monthIndex, daysInMonth(key));
}

function getWeekRange(date) {
  const cursor = new Date(`${date}T00:00:00Z`);
  const weekday = (cursor.getUTCDay() + 6) % 7;
  cursor.setUTCDate(cursor.getUTCDate() - weekday);
  const start = cursor.toISOString().slice(0, 10);
  cursor.setUTCDate(cursor.getUTCDate() + 6);
  const end = cursor.toISOString().slice(0, 10);
  return { start, end };
}

function daysInMonth(key) {
  const { year, monthIndex } = parseMonthKey(key);
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function shiftMonth(key, delta) {
  const { year, monthIndex } = parseMonthKey(key);
  const shifted = new Date(Date.UTC(year, monthIndex + delta, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(key) {
  const { year, monthIndex } = parseMonthKey(key);
  return new Intl.DateTimeFormat("en-AU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthIndex, 1)));
}

function toDateString(year, monthIndex, day) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function todayString() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function curveSeatLoad(value) {
  const clamped = Math.max(0, Math.min(1, Number(value) || 0));
  return Math.sqrt(clamped);
}

function getCalendarDayPresentation(availability) {
  if (!availability) {
    return {
      caption: "Check",
      className: "is-closed status-unavailable",
      rawSeatLoad: 0,
      seatLoad: 0,
      status: "unavailable",
    };
  }

  if (availability.isBlocked) {
    return {
      caption: "Bookings closed",
      className: "is-closed status-closed",
      rawSeatLoad: 1,
      seatLoad: 1,
      status: "bookings-closed",
    };
  }

  if (!availability.isOpen) {
    return {
      caption: "Closed",
      className: "is-closed status-closed",
      rawSeatLoad: 0,
      seatLoad: 0,
      status: "closed",
    };
  }

  const hoursLabel = getCalendarDayHoursLabel(availability);
  const totalCapacity = Math.max(Number(availability.capacity ?? 0), 0);
  const totalRemaining = Math.max(Number(availability.remaining ?? 0), 0);
  const availableSlotCount = Math.max(Number(availability.availableSlotCount ?? 0), 0);
  const rawSeatLoad = totalCapacity > 0 ? 1 - totalRemaining / totalCapacity : 0;
  const seatLoad = curveSeatLoad(rawSeatLoad);

  if (availableSlotCount <= 0 || totalRemaining <= 0 || rawSeatLoad >= 1) {
    return {
      caption: hoursLabel,
      className: "is-full status-full",
      rawSeatLoad,
      seatLoad,
      status: "full",
    };
  }

  if (rawSeatLoad === 0) {
    return {
      caption: hoursLabel,
      className: "has-availability status-open",
      rawSeatLoad,
      seatLoad,
      status: "open",
    };
  }

  if (rawSeatLoad < 0.35) {
    return {
      caption: hoursLabel,
      className: "has-availability status-filling",
      rawSeatLoad,
      seatLoad,
      status: "filling",
    };
  }

  if (rawSeatLoad < 0.75) {
    return {
      caption: hoursLabel,
      className: "has-availability status-busy",
      rawSeatLoad,
      seatLoad,
      status: "busy",
    };
  }

  return {
    caption: hoursLabel,
    className: "has-availability status-nearly-full",
    rawSeatLoad,
    seatLoad,
    status: "nearly-full",
  };
}

function getCalendarDayHoursLabel(availability) {
  const openTime = String(availability?.openTime ?? "").trim();
  const closeTime = String(availability?.closeTime ?? "").trim();
  return openTime && closeTime ? formatDisplayTimeRange(openTime, closeTime) : "Open";
}

function getTimeSlotPresentation(slot) {
  if (!slot?.available) {
    return {
      className: "status-full",
      rawSeatLoad: 1,
      seatLoad: 1,
      status: "full",
    };
  }

  const rawSeatLoad =
    slot.capacity > 0 ? 1 - (slot.remaining ?? slot.capacity) / slot.capacity : 0;
  const seatLoad = curveSeatLoad(rawSeatLoad);

  if (rawSeatLoad === 0) {
    return {
      className: "status-open",
      rawSeatLoad,
      seatLoad,
      status: "open",
    };
  }

  if (rawSeatLoad < 0.35) {
    return {
      className: "status-filling",
      rawSeatLoad,
      seatLoad,
      status: "filling",
    };
  }

  if (rawSeatLoad < 0.75) {
    return {
      className: "status-busy",
      rawSeatLoad,
      seatLoad,
      status: "busy",
    };
  }

  return {
    className: "status-nearly-full",
    rawSeatLoad,
    seatLoad,
    status: "nearly-full",
  };
}

function formatDisplayTime(value) {
  const trimmed = String(value ?? "").trim();
  const match = trimmed.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return trimmed;
  }

  const hours = Number(match[1]);
  const minutes = match[2];
  if (hours > 23) {
    return trimmed;
  }

  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${minutes} ${suffix}`;
}

function formatDisplayTimeRange(startTime, endTime) {
  const start = formatDisplayTime(startTime);
  const end = formatDisplayTime(endTime);
  return start && end ? `${start} - ${end}` : start || end;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeStyleTagContent(value) {
  return String(value ?? "").replaceAll("</style", "<\\/style");
}

boot().catch(() => {
  setStatus("auth", "error", "Unable to load the app.");
});
