(function(){const a=document.createElement("link").relList;if(a&&a.supports&&a.supports("modulepreload"))return;for(const o of document.querySelectorAll('link[rel="modulepreload"]'))n(o);new MutationObserver(o=>{for(const d of o)if(d.type==="childList")for(const l of d.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&n(l)}).observe(document,{childList:!0,subtree:!0});function i(o){const d={};return o.integrity&&(d.integrity=o.integrity),o.referrerPolicy&&(d.referrerPolicy=o.referrerPolicy),o.crossOrigin==="use-credentials"?d.credentials="include":o.crossOrigin==="anonymous"?d.credentials="omit":d.credentials="same-origin",d}function n(o){if(o.ep)return;o.ep=!0;const d=i(o);fetch(o.href,d)}})();const Ze="booking-admin:section-panels",Xe="booking-theme-editor:model:",et="booking-theme-editor:reasoning:",tt="booking-theme-editor:saved-baseline:",t={booting:!0,session:null,users:[],companies:[],userCount:0,sectionPanels:oi(),appSettings:L(),openAiModelDraft:L().openAiModel,openAiReasoningEffortDraft:L().openAiReasoningEffort,widgetEditorMaxOutputTokensDraft:String(L().widgetEditorMaxOutputTokens),widgetEditorUploadLimitDraftMb:U(L().widgetEditorUploadLimitBytes),emailTestDraft:vt(),authForms:yt(),widgetCatalog:[],widgetAvailability:[],statuses:{auth:null,workspace:null,users:null,companies:null,bookings:null,widget:null,widgetSetup:null,openaiSettings:null,emailSettings:null,widgetEditor:null,passwordReset:null},filters:{users:"",companies:""},selectedUserIds:new Set,selectedCompanyIds:new Set,selectedEstablishmentIds:new Set,selectedSeatCountIds:new Set,dirtyOpeningHoursEstablishmentIds:new Set,userForm:ue(),companyForm:me(),widgetSetup:{companyId:"",establishmentId:"",seatCountId:""},bookingWorkspace:ht(),widgetEditor:kt(),widget:{seatCountId:"",currentMonth:G(K()),selectedDate:"",selectedTime:"",modal:null,confirmationMessage:"",enquiryPartySize:""},adminCalendar:{companyId:"",establishmentId:"",seatCountId:"",currentMonth:G(K()),selectedDate:"",selectedTime:"",modal:null,editingBookingId:""},adminAvailability:[]},qt=new Map([["/",re],["/login",re],["/settings",Gt],["/widget",Zt],["/page-view",Xt],["/widget-setup",Jt],["/widget-editor",Yt],["/page-view-editor",Qt]]);let Q=null,Z=null,we=!1,ye=!1,ae=null;const k={companiesRef:null,usersRef:null,allEstablishments:[],companyNamesById:new Map,establishmentsById:new Map,usersByCompanyId:new Map,filteredUsersTerm:null,filteredUsersResult:[],filteredCompaniesTerm:null,filteredCompaniesResult:[],topnavMarkup:null};document.addEventListener("click",e=>{const a=e.target.closest("[data-modal-panel]"),i=e.target.closest("[data-action]");if(a&&(!i||i.classList.contains("widget-modal-backdrop")))return;const n=e.target.closest("[data-link]");if(n){e.preventDefault(),F(n.getAttribute("href"));return}const o=e.target.closest("[data-action]");o&&(e.preventDefault(),$a(o.dataset.action,o.dataset).catch(()=>{}))});window.addEventListener("popstate",()=>{ce(),Ne(),x()&&(!fe(pe())||!t.widgetCatalog.length)&&Pe().catch(()=>{r("widget","error","Widget data could not be loaded.")}),location.pathname==="/settings"&&P()&&!t.companies.length&&(Ae(),q().then(()=>y()).then(()=>h("workspace")).catch(()=>{r("workspace","error","Your establishment workspace could not be loaded."),r("auth","error","Admin data could not be loaded.")})),(location.pathname==="/widget-setup"||location.pathname==="/widget-editor"||location.pathname==="/page-view-editor")&&E()&&!t.companies.length&&q().then(()=>y()).catch(()=>{r("auth","error","Admin data could not be loaded.")}),_(),(location.pathname==="/widget-editor"||location.pathname==="/page-view-editor")&&R(),c()});window.addEventListener("resize",()=>{Se()});document.addEventListener("visibilitychange",()=>{Me(),document.visibilityState==="visible"&&(x()&&t.widget.seatCountId&&M({silent:!0}).then(c).catch(()=>{}),location.pathname==="/settings"&&P()&&t.adminCalendar.seatCountId&&y({silent:!0}).then(c).catch(()=>{}))});document.addEventListener("submit",async e=>{if(e.target.matches("[data-login-form]")){e.preventDefault(),await Sa(e.target);return}if(e.target.matches("[data-forgot-password-form]")){e.preventDefault(),await Ca(e.target);return}if(e.target.matches("[data-reset-password-form]")){e.preventDefault(),await Ea(e.target);return}if(e.target.matches("[data-user-form]")){e.preventDefault(),await Ia(e.target);return}if(e.target.matches("[data-company-form]")){e.preventDefault(),await Ta(e.target);return}if(e.target.matches("[data-widget-form]")){e.preventDefault(),await Da(e.target);return}if(e.target.matches("[data-widget-enquiry-form]")){e.preventDefault(),await Pa(e.target);return}if(e.target.matches("[data-admin-booking-form]")){e.preventDefault(),await Aa(e.target);return}if(e.target.matches("[data-openai-settings-form]")){e.preventDefault(),await xa(e.target);return}if(e.target.matches("[data-email-test-form]")){e.preventDefault(),await Ma(e.target);return}if(e.target.matches("[data-widget-editor-generate-form]")){e.preventDefault(),await Wa(e.target);return}e.target.matches("[data-widget-editor-save-form]")&&(e.preventDefault(),await qa(e.target))});document.addEventListener("input",e=>{if(!ft(e.target)){if(e.target.matches("[data-user-search]")){t.filters.users=e.target.value,c();return}if(e.target.matches("[data-company-search]")){t.filters.companies=e.target.value,c();return}if(e.target.matches("[data-login-email-draft]")){t.authForms.loginEmail=e.target.value;return}if(e.target.matches("[data-login-password-draft]")){t.authForms.loginPassword=e.target.value;return}if(e.target.matches("[data-forgot-email-draft]")){t.authForms.forgotEmail=e.target.value;return}if(e.target.matches("[data-reset-password-draft]")){t.authForms.resetPassword=e.target.value;return}if(e.target.matches("[data-reset-confirm-password-draft]")){t.authForms.resetConfirmPassword=e.target.value;return}if(e.target.matches("[data-openai-model-draft]")){t.openAiModelDraft=e.target.value;return}if(e.target.matches("[data-openai-reasoning-effort-draft]")){t.openAiReasoningEffortDraft=e.target.value;return}if(e.target.matches("[data-widget-editor-max-output-tokens-draft]")){t.widgetEditorMaxOutputTokensDraft=e.target.value;return}if(e.target.matches("[data-email-test-draft]")){t.emailTestDraft[e.target.name]=e.target.value;return}if(e.target.matches("[data-widget-editor-upload-limit-draft]")){t.widgetEditorUploadLimitDraftMb=e.target.value;return}if(e.target.matches("[data-widget-editor-prompt]")){t.widgetEditor.prompt=e.target.value;return}if(e.target.matches("[data-widget-editor-prompt-name]")){t.widgetEditor.promptName=e.target.value;return}if(e.target.matches("[data-widget-editor-content]")){t.widgetEditor.draftContentText=e.target.value;return}if(e.target.matches("[data-widget-editor-css]")){t.widgetEditor.draftCss=e.target.value;return}if(e.target.matches("[data-widget-editor-model]")){t.widgetEditor.model=e.target.value,di($(),e.target.value);return}if(e.target.matches("[data-widget-editor-reasoning]")){t.widgetEditor.reasoningEffort=e.target.value,li($(),e.target.value);return}if(e.target.matches("[data-widget-editor-use-saved-baseline]")){t.widgetEditor.useSavedBaseline=e.target.checked,ci($(),e.target.checked);return}if(e.target.matches("[data-widget-party-size]")){Nt(e.target);return}(e.target.matches("[data-hours-open]")||e.target.matches("[data-hours-start]")||e.target.matches("[data-hours-end]"))&&Ei(e.target)}});document.addEventListener("change",async e=>{if(!ft(e.target)){if(e.target.matches("[data-widget-party-size]")){Nt(e.target);return}if(e.target.matches("[data-user-select]")){ie(t.selectedUserIds,e.target.value,e.target.checked),c();return}if(e.target.matches("[data-company-select]")){ie(t.selectedCompanyIds,e.target.value,e.target.checked),c();return}if(e.target.matches("[data-establishment-select]")){ie(t.selectedEstablishmentIds,e.target.value,e.target.checked),c();return}if(e.target.matches("[data-seat-count-select]")){ie(t.selectedSeatCountIds,e.target.value,e.target.checked),c();return}if(e.target.matches("[data-user-select-all]")){Ye("users",e.target.checked),c();return}if(e.target.matches("[data-company-select-all]")){Ye("companies",e.target.checked),c();return}if(e.target.matches("[data-setup-company]")){t.widgetSetup.companyId=e.target.value,le(),c();return}if(e.target.matches("[data-setup-establishment]")){t.widgetSetup.establishmentId=e.target.value,le(),c();return}if(e.target.matches("[data-setup-seat-count]")){t.widgetSetup.seatCountId=e.target.value,c();return}if(e.target.matches("[data-widget-editor-company]")){t.widgetEditor.companyId=e.target.value,t.widgetEditor.draftCss="",R(),c();return}if(e.target.matches("[data-widget-editor-establishment]")){t.widgetEditor.establishmentId=e.target.value,t.widgetEditor.draftCss="",R(),c();return}if(e.target.matches("[data-widget-editor-files]")){await ct(e.target.files);return}if(e.target.matches("[data-booking-company]")){t.adminCalendar.companyId=e.target.value,H(),X(),y().then(c);return}if(e.target.matches("[data-booking-establishment]")){t.adminCalendar.establishmentId=e.target.value,H(),X(),y().then(c);return}if(e.target.matches("[data-booking-seat-count]")){t.adminCalendar.seatCountId=e.target.value,H(),X(),y().then(c);return}if(e.target.matches("[data-booking-search-query]")){t.bookingWorkspace.searchQuery=e.target.value;return}if(e.target.matches("[data-booking-report-from-date]")){t.bookingWorkspace.report.fromDate=e.target.value;return}if(e.target.matches("[data-booking-report-to-date]")){t.bookingWorkspace.report.toDate=e.target.value;return}if(e.target.matches("[data-booking-report-from-time]")){t.bookingWorkspace.report.fromTime=e.target.value;return}e.target.matches("[data-booking-report-to-time]")&&(t.bookingWorkspace.report.toTime=e.target.value)}});document.addEventListener("paste",async e=>{if(location.pathname!=="/widget-editor"&&location.pathname!=="/page-view-editor")return;const a=za(e.clipboardData);a.length&&(e.preventDefault(),await ct(a,{append:!0,sourceLabel:"pasted"}))});document.addEventListener("toggle",e=>{!(e.target instanceof HTMLElement)||!e.target.matches("[data-section-panel-id]")||ri(e.target.dataset.sectionPanelId,e.target.open)},!0);async function Ut(){location.pathname==="/"&&history.replaceState({},"","/login"),c();try{x()?((await Promise.allSettled([Pe()]))[0]?.status==="rejected"&&r("widget","error","Widget data could not be loaded."),_()):((await Promise.allSettled([De()]))[0]?.status==="rejected"&&r("auth","error","Session could not be loaded."),ce(),Ne(),location.pathname==="/settings"&&P()&&(Ae(),(await Promise.allSettled([q()]))[0]?.status==="rejected"?(r("workspace","error","Your establishment workspace could not be loaded."),r("auth","error","Admin data could not be loaded.")):h("workspace")),(location.pathname==="/widget-setup"||location.pathname==="/widget-editor"||location.pathname==="/page-view-editor")&&E()&&(await Promise.allSettled([q()]))[0]?.status==="rejected"&&r("auth","error","Admin data could not be loaded."),_(),P()&&await y())}finally{t.booting=!1,c()}}async function De(){const e=await fetch("/api/session"),a=await A(e);t.session=a.session,t.userCount=Number(a.userCount??0),!t.emailTestDraft.recipientEmail&&t.session?.email&&(t.emailTestDraft.recipientEmail=t.session.email),P()||(t.users=[],t.companies=[],t.appSettings=L(),t.openAiModelDraft=t.appSettings.openAiModel,t.openAiReasoningEffortDraft=t.appSettings.openAiReasoningEffort,t.widgetEditorMaxOutputTokensDraft=String(t.appSettings.widgetEditorMaxOutputTokens),t.widgetEditorUploadLimitDraftMb=U(t.appSettings.widgetEditorUploadLimitBytes)),St(),le(),R(),X()}async function q(){const e=await fetch("/api/admin-data"),a=await A(e);if(!e.ok)throw new Error(a.error??"Admin data could not be loaded.");t.users=a.users??[],t.companies=a.companies??[],t.appSettings=a.appSettings??L(),t.widgetEditor.savedPrompts=se(a.widgetEditorPrompts),t.openAiModelDraft=t.appSettings.openAiModel,t.openAiReasoningEffortDraft=t.appSettings.openAiReasoningEffort,t.widgetEditorMaxOutputTokensDraft=String(t.appSettings.widgetEditorMaxOutputTokens),t.widgetEditorUploadLimitDraftMb=U(t.appSettings.widgetEditorUploadLimitBytes),St(),le(),R(),X()}async function Pe(){const e=pe();if(!e){t.widgetCatalog=[];return}const a=await fetch(`/api/widget?action=config&seatCountId=${encodeURIComponent(e)}`),i=await A(a);if(!a.ok)throw new Error(i.error??"Widget configuration failed.");t.widgetCatalog=i.catalog??[]}function F(e,a={}){const n=a.replace===!0?"replaceState":"pushState";history[n]({},"",e),ce(),Ne(),x()&&(!fe(pe())||!t.widgetCatalog.length)&&Pe().then(()=>{_(),c()}).catch(()=>{r("widget","error","Widget data could not be loaded.")}),location.pathname==="/settings"&&P()&&!t.companies.length&&(Ae(),q().then(async()=>{await y(),h("workspace"),c()}).catch(()=>{r("workspace","error","Your establishment workspace could not be loaded."),r("auth","error","Admin data could not be loaded.")})),(location.pathname==="/widget-setup"||location.pathname==="/widget-editor"||location.pathname==="/page-view-editor")&&E()&&!t.companies.length&&q().then(async()=>{await y(),c()}).catch(()=>{r("auth","error","Admin data could not be loaded.")}),_(),(location.pathname==="/widget-editor"||location.pathname==="/page-view-editor")&&R(),c()}function c(){ce(),Ot(),Me(),(location.pathname==="/widget-editor"||location.pathname==="/page-view-editor")&&R();const e=document.querySelector("#app"),a=document.querySelector(".topnav"),i=location.pathname==="/login"||location.pathname==="/";if(t.booting){a.innerHTML="",k.topnavMarkup="",e.innerHTML=x()?Ht():i?re():jt(),Se();return}ii()&&(history.replaceState({},"","/login"),t.statuses.auth||(t.statuses.auth={kind:"error",message:"Settings access required."})),ni()&&(history.replaceState({},"",Le()),t.statuses.auth||(t.statuses.auth={kind:"error",message:"Admin access required."}));const n=zt();k.topnavMarkup!==n&&(a.innerHTML=n,k.topnavMarkup=n),e.innerHTML=(qt.get(location.pathname)??re)(),Se()}function Ot(){const e=document.documentElement,a=document.body,i=document.querySelector(".shell"),n=document.querySelector(".masthead"),o=x(),d=location.pathname==="/login"||location.pathname==="/",l=t.booting||o||d||T()||te();e.classList.toggle("route-widget",o),e.classList.toggle("route-login",d),a.classList.toggle("widget-embed",o),a.classList.toggle("login-standalone",d),i?.classList.toggle("widget-embed-shell",o),i?.classList.toggle("login-shell",d),n?.classList.toggle("is-hidden",l)}function zt(){if(x()||location.pathname==="/login"||location.pathname==="/"||T()||te())return"";const e=t.userCount===0||P(),a=(e?Tt():"")||`/widget${t.widget.seatCountId?`?seatCountId=${encodeURIComponent(t.widget.seatCountId)}`:""}`;return`
    <div class="topnav-links">${[z(a,"Widget",location.pathname==="/widget"),e&&E()?z("/widget-setup","Embed Setup",location.pathname==="/widget-setup"):"",e&&E()?z("/widget-editor","Theme Editor",location.pathname==="/widget-editor"):"",e&&E()?z("/page-view-editor","Page View Editor",location.pathname==="/page-view-editor"):"",e?z("/settings","Admin",location.pathname==="/settings"):""].filter(Boolean).join("")}</div>
    <div class="topnav-session">
      ${t.session?`
            <div class="topnav-user">
              <strong>${s(t.session.firstName)} ${s(t.session.lastName)}</strong>
              <span>${s(t.session.authLevel)}</span>
            </div>
            <button type="button" class="ghost-button" data-action="logout">Sign out</button>
          `:z("/login","Sign in",location.pathname==="/login")}
    </div>
  `}function z(e,a,i){return`<a href="${e}" class="${i?"is-active":""}" ${i?'aria-current="page"':""} data-link>${a}</a>`}function oe({eyebrow:e,title:a,meta:i,actions:n=""}){return`
    <article class="panel full-width page-hero">
      <div class="panel-head">
        <div>
          <p class="eyebrow">${s(e)}</p>
          <h2>${s(a)}</h2>
          ${i?`<p class="meta">${s(i)}</p>`:""}
        </div>
        ${n?`<div class="stack-inline">${n}</div>`:""}
      </div>
    </article>
  `}function B({id:e="",eyebrow:a,title:i,meta:n="",badge:o="",content:d,open:l=!0}){const m=e?t.sectionPanels[e]:void 0,p=typeof m=="boolean"?m:l;return`
    <details class="panel full-width section-panel" data-section-panel-id="${s(e)}" ${p?"open":""}>
      <summary class="section-summary">
        <div>
          <p class="eyebrow">${s(a)}</p>
          <h3>${s(i)}</h3>
          ${n?`<p class="meta">${s(n)}</p>`:""}
        </div>
        <div class="section-summary-side">
          ${o?`<span class="badge">${o}</span>`:""}
          <span class="section-chevron" aria-hidden="true"></span>
        </div>
      </summary>
      <div class="section-body">${d}</div>
    </details>
  `}function jt(){return`
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
  `}function Ht(){return`
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
  `}function re(){return gt()?_t():pt()?Vt():`
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
                value="${s(t.authForms.loginEmail)}"
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
                value="${s(t.authForms.loginPassword)}"
                data-login-password-draft
                enterkeyhint="go"
                required
              />
            </div>
          </div>
          ${I("auth")}
          <div class="stack-inline">
            <button type="submit" class="login-submit">Sign in</button>
            <button type="button" class="ghost-button" data-action="openForgotPassword">Forgot password</button>
          </div>
        </form>
      </article>
    </section>
  `}function Vt(){return`
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
              value="${s(t.authForms.forgotEmail)}"
              data-forgot-email-draft
              autofocus
              required
            />
          </div>
          ${I("passwordReset")}
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
  `}function _t(){const e=t.authForms.resetTokenStatus,a=e==="invalid",i=e==="idle"||e==="loading";return`
    <section class="login-layout">
      <article class="panel login-panel login-main-panel">
        <p class="eyebrow">Account Access</p>
        <h2>Reset password</h2>
        <p class="meta">Choose a new password for your account.</p>
        ${i?'<div class="status info">Checking reset link...</div>':""}
        ${a?`<div class="status error">${s(t.authForms.resetTokenError||"This password reset link is invalid or has expired.")}</div>`:""}
        <form class="stack" data-reset-password-form autocomplete="on">
          <div class="field full">
            <label for="reset-password">New password</label>
            <input
              id="reset-password"
              name="password"
              type="password"
              minlength="8"
              autocomplete="new-password"
              value="${s(t.authForms.resetPassword)}"
              data-reset-password-draft
              autofocus
              required
              ${a||i?"disabled":""}
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
              value="${s(t.authForms.resetConfirmPassword)}"
              data-reset-confirm-password-draft
              required
              ${a||i?"disabled":""}
            />
          </div>
          ${I("passwordReset")}
          <div class="stack-inline">
            <button type="submit" class="login-submit" ${a||i?"disabled":""}>Save new password</button>
            <button type="button" class="ghost-button" data-action="returnToLogin">Back to sign in</button>
          </div>
        </form>
      </article>
      <article class="panel login-side">
        <p class="eyebrow">Security</p>
        <h3>${a?"Need a new link?":"Reset link active"}</h3>
        <div class="stack">
          <p class="meta">${a?"Request another password reset link from the sign-in page.":"Use a password with at least 8 characters. Once saved, this reset link cannot be reused."}</p>
          <button type="button" class="ghost-button" data-action="openForgotPassword">Request another reset link</button>
        </div>
      </article>
    </section>
  `}function Gt(){const e=t.userCount>0,a=E();return e?P()?a?`
    <section class="layout">
      ${B({id:"settings-email",eyebrow:"Email",title:"Booking confirmation email",meta:"Test the live SMTP connection and preview the exact confirmation layout sent to guests after a booking is created.",open:!0,content:`
          <div class="section-content-grid">
            <div class="inner-panel">
              ${sa()}
              ${I("emailSettings")}
            </div>
            <div class="inner-panel">
              <p class="eyebrow">Delivery setup</p>
              <h3>SMTP environment</h3>
              ${oa()}
            </div>
          </div>
        `})}
      ${B({id:"settings-system",eyebrow:"System",title:"Widget editor OpenAI settings",meta:"Set the default model, upload limit, and reasoning effort used when generating establishment-specific CSS.",open:!0,content:`
          <div class="section-content-grid section-content-grid-compact">
            <div class="inner-panel">
              ${ra()}
              ${I("openaiSettings")}
            </div>
          </div>
        `})}
      ${B({id:"settings-users",eyebrow:"Users",title:"Users and access",meta:"Create and manage user accounts, roles, and assignments.",badge:`${t.users.length} users`,open:!0,content:`
          <div class="section-content-grid">
            <div class="inner-panel">
              <p class="eyebrow">Form</p>
              <h3>${t.userForm.mode==="edit"?"Edit user":"Create user"}</h3>
              ${$e(!1)}
              ${I("users")}
            </div>
            <div class="inner-panel">
              <div class="list-toolbar">
                <input
                  type="search"
                  placeholder="Search users, emails, auth, company, establishment"
                  value="${s(t.filters.users)}"
                  data-user-search
                />
                <button type="button" class="ghost-button" data-action="bulkDeleteUsers">
                  Delete selected (${t.selectedUserIds.size})
                </button>
              </div>
              <div class="list-header">
                <label class="checkbox">
                  <input
                    type="checkbox"
                    data-user-select-all
                    ${Te("users")?"checked":""}
                  />
                  <span>Select visible</span>
                </label>
              </div>
              <div class="users">${ot()}</div>
            </div>
          </div>
        `})}
      ${B({id:"settings-locations",eyebrow:"Locations",title:"Companies, establishments, and seat counts",meta:"Keep the business structure and booking capacity organised in one place.",badge:`${t.companies.length} companies`,open:!0,content:`
          <div class="section-content-grid">
            <div class="inner-panel">
              <p class="eyebrow">Form</p>
              <h3>${t.companyForm.mode==="edit"?"Edit company":"Create company"}</h3>
              ${da()}
              ${I("companies")}
            </div>
            <div class="inner-panel">
              <div class="list-toolbar">
                <input
                  type="search"
                  placeholder="Search companies, establishments, seat counts"
                  value="${s(t.filters.companies)}"
                  data-company-search
                />
                <button type="button" class="ghost-button" data-action="bulkDeleteCompanies">
                  Delete companies (${t.selectedCompanyIds.size})
                </button>
                <button type="button" class="ghost-button" data-action="bulkDeleteEstablishments">
                  Delete establishments (${t.selectedEstablishmentIds.size})
                </button>
                <button type="button" class="ghost-button" data-action="bulkDeleteSeatCounts">
                  Delete seat counts (${t.selectedSeatCountIds.size})
                </button>
              </div>
              <div class="list-header">
                <label class="checkbox">
                  <input
                    type="checkbox"
                    data-company-select-all
                    ${Te("companies")?"checked":""}
                  />
                  <span>Select visible</span>
                </label>
              </div>
              <div class="company-list">${la()}</div>
            </div>
          </div>
        `})}
      ${B({id:"settings-bookings",eyebrow:"Bookings",title:"Booking calendar",meta:"Set opening hours, inspect seat availability, and manage bookings by day.",open:!0,content:`<div class="inner-panel booking-workspace">${rt()}</div>`})}
    </section>
  `:Kt():`
      <section class="layout">
        ${oe({eyebrow:"Access",title:"Admin access required",meta:"This section is restricted to admin accounts."})}
        <article class="panel wide">
          <h2>Admin only</h2>
          <p class="meta">Settings is restricted to admins.</p>
          <a class="button-primary" href="/login" data-link>Go to login</a>
        </article>
      </section>
    `:`
      <section class="layout">
        ${oe({eyebrow:"Setup",title:"Create the first admin account",meta:"This is the one-time bootstrap step before the full admin area becomes available."})}
        <article class="panel wide">
          <h2>Create the first admin</h2>
          <p class="meta">After this step, only admins can access the management screens.</p>
          ${$e(!0)}
          ${I("users")}
        </article>
        <aside class="panel side">
          <p class="eyebrow">Security</p>
          <h3>Encrypted storage</h3>
          <p class="meta">Names, emails, and booking customer details are encrypted before being written to Cockroach. Passwords are stored as password hashes, not as reversible text.</p>
        </aside>
      </section>
    `}function Kt(){T()&&(t.userForm.authLevel="staff",t.userForm.companyId=t.session?.companyId??"",t.userForm.establishmentId=t.session?.establishmentId??"");const e=`scoped-${t.session?.authLevel??"user"}`;return`
    <section class="layout">
      ${ke("workspace")}
      ${ke("bookings")}
      ${B({id:`${e}-overview`,eyebrow:"Access",title:T()?"Manager booking workspace":"Staff booking workspace",meta:"This view is limited to your assigned establishment.",open:!1,content:`
          <div class="two-column-layout">
            <div class="inner-panel">
              <p class="eyebrow">Session</p>
              <h3>Signed-in account</h3>
              ${na(!0)}
            </div>
            <div class="inner-panel">
              <p class="eyebrow">Scope</p>
              <h3>${s(We(t.session?.establishmentId)||"No establishment assigned")}</h3>
              <p class="meta">${T()?"Managers can run reports for this establishment and add staff accounts assigned here.":"Staff can manage bookings for this establishment."}</p>
            </div>
          </div>
        `})}
      ${T()?B({id:`${e}-staff`,eyebrow:"Staff access",title:"Create and view staff",meta:"New staff accounts created here are always assigned to this establishment.",open:!1,content:`
                <div class="two-column-layout">
                  <div class="inner-panel">
                    <p class="eyebrow">Create</p>
                    <h3>${t.userForm.mode==="edit"?"Edit staff member":"Create staff member"}</h3>
                    <p class="meta">${t.userForm.mode==="edit"?"Managers can update staff details and set a new password when needed.":"New accounts created here are always assigned to this establishment."}</p>
                    ${$e(!1,{restrictToStaff:!0,hideAssignmentFields:!0,hideRoleField:!0})}
                    ${I("users")}
                  </div>
                  <div class="inner-panel">
                    <p class="eyebrow">Current staff</p>
                    <h3>Assigned to this establishment</h3>
                    <p class="meta">Managers can create, edit, delete, and reset passwords for staff linked to this location.</p>
                    <div class="list-toolbar">
                      <input
                        type="search"
                        placeholder="Search staff by name or email"
                        value="${s(t.filters.users)}"
                        data-user-search
                      />
                      <button type="button" class="ghost-button" data-action="bulkDeleteUsers">
                        Delete selected (${t.selectedUserIds.size})
                      </button>
                    </div>
                    <div class="list-header">
                      <label class="checkbox">
                        <input
                          type="checkbox"
                          data-user-select-all
                          ${Te("users")?"checked":""}
                        />
                        <span>Select visible</span>
                      </label>
                    </div>
                    <div class="users">${ot()}</div>
                  </div>
                </div>
              `}):""}
      ${B({id:`${e}-bookings`,eyebrow:"Bookings",title:"Booking calendar",meta:`Inspect seat availability, manage bookings by day, and ${W()?"run reports for this establishment.":"search customer bookings."}`,open:!1,content:`<div class="inner-panel booking-workspace">${rt()}</div>`})}
    </section>
  `}function Jt(){const e=Ue(),a=ge(),i=qe(),n=Tt(),o=yi(),d=n?new URL(n).origin:"",l=`<script>
  (function () {
    var widgetOrigin = ${JSON.stringify(d)};

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
<\/script>`,m=`<iframe
  src="${n}"
  data-booking-widget
  style="width:100%;height:640px;border:0;display:block;overflow:hidden"
  loading="eager"
  scrolling="no"
></iframe>
${l}`,p=`<iframe
  src="${o}"
  data-booking-page-view
  style="width:100%;height:960px;border:0;display:block;overflow:hidden"
  loading="eager"
  scrolling="no"
></iframe>
${l}`;return`
    <section class="layout">
      ${oe({eyebrow:"Embed Setup",title:"Choose the live widget source",meta:"Select the company, establishment, and seat-count calendar that the public website should embed."})}
      <article class="panel full-width">
        <div class="two-column-layout">
          <div class="inner-panel">
            <p class="eyebrow">Selection</p>
            <h3>Widget source</h3>
            <div class="form-grid form-grid-three">
              <div class="field">
                <label for="setup-company">Company</label>
                <select id="setup-company" data-setup-company>
                  ${e.length?"":'<option value="">No companies yet</option>'}
                  ${e.map(u=>`
                        <option value="${u.id}" ${t.widgetSetup.companyId===u.id?"selected":""}>
                          ${s(u.name)}
                        </option>
                      `).join("")}
                </select>
              </div>
              <div class="field">
                <label for="setup-establishment">Establishment</label>
                <select id="setup-establishment" data-setup-establishment>
                  ${a.length?"":'<option value="">No establishments yet</option>'}
                  ${a.map(u=>`
                        <option value="${u.id}" ${t.widgetSetup.establishmentId===u.id?"selected":""}>
                          ${s(u.name)}
                        </option>
                      `).join("")}
                </select>
              </div>
              <div class="field">
                <label for="setup-seat-count">Seat-count calendar</label>
                <select id="setup-seat-count" data-setup-seat-count>
                  ${i.length?"":'<option value="">No seat-count calendars yet</option>'}
                  ${i.map(u=>`
                        <option value="${u.id}" ${t.widgetSetup.seatCountId===u.id?"selected":""}>
                          ${s(u.label)}
                        </option>
                      `).join("")}
                </select>
              </div>
            </div>
            ${I("widgetSetup")}
            ${e.length?a.length?i.length?"":'<div class="empty">Create at least one seat count for this establishment in Admin.</div>':'<div class="empty">Create an establishment for this company in Admin.</div>':'<div class="empty">Create a company first in Admin.</div>'}
          </div>
          <aside class="inner-panel">
            <p class="eyebrow">Current target</p>
            <h3>${s(vi()||"No seat count selected")}</h3>
            <p class="meta">${s(ki()||"")}</p>
            <p class="meta">The public widget no longer shows company, establishment, or seat-count selectors. Those are configured here and passed in the URL.</p>
          </aside>
        </div>
      </article>
      ${B({id:"widget-setup-share",eyebrow:"Share",title:"Widget URL and embed code",meta:"Copy the direct URLs for testing or the iframe snippets for the external website.",open:!0,content:`
          <div class="section-content-grid">
            <div class="inner-panel">
              <label>Widget URL</label>
              <div class="copy-row">
                <input readonly value="${s(n)}" />
                <button type="button" class="ghost-button" data-action="copyWidgetUrl" data-url="${s(n)}">Copy URL</button>
                <button type="button" class="ghost-button" data-action="openWidgetPreview" data-url="${s(n)}">Open preview</button>
              </div>
            </div>
            <div class="inner-panel">
              <label>Embed code</label>
              <div class="copy-row">
                <textarea readonly rows="6">${s(m)}</textarea>
                <button type="button" class="ghost-button" data-action="copyWidgetEmbed" data-url="${s(m)}">Copy embed</button>
              </div>
            </div>
            <div class="inner-panel">
              <label>Page view URL</label>
              <div class="copy-row">
                <input readonly value="${s(o)}" />
                <button type="button" class="ghost-button" data-action="copyPageViewUrl" data-url="${s(o)}">Copy URL</button>
                <button type="button" class="ghost-button" data-action="openPageViewPreview" data-url="${s(o)}">Open preview</button>
              </div>
            </div>
            <div class="inner-panel">
              <label>Page view embed code</label>
              <div class="copy-row">
                <textarea readonly rows="6">${s(p)}</textarea>
                <button type="button" class="ghost-button" data-action="copyPageViewEmbed" data-url="${s(p)}">Copy embed</button>
              </div>
            </div>
          </div>
        `})}
    </section>
  `}function Yt(){return at(ee("booking_calendar"))}function Qt(){return at(ee("booking_page_view"))}function at(e){const a=Oe(),i=ze(),n=J(),o=xt(e.key),d=U(t.appSettings.widgetEditorUploadLimitBytes),l=he(),m=At(n,e.key),p=e.key==="booking_page_view"?"Start from the most recent saved page and CSS":"Work from the most recent saved CSS only",u=e.key==="booking_page_view"?m?"Follow-up generations will use the latest saved page and CSS as the starting point, but your new prompt can fully restructure, rewrite, add, remove, or redesign the page.":"This option becomes available after you save the generated page and CSS once.":m?"Follow-up generations will preserve the latest saved CSS as the baseline and only apply the requested change.":"This option becomes available after you save CSS once.";return`
    <section class="layout">
      ${oe({eyebrow:e.eyebrow,title:e.title,meta:e.meta})}
      ${ke("widgetEditor")}
      <article class="panel panel-span-5">
        <p class="eyebrow">Generator</p>
        <h2>Prompt and references</h2>
        <p class="meta">${s(e.generatorMeta)}</p>
        ${a.length?"":`<div class="empty">${s(e.emptyState)}</div>`}
        <form class="stack" data-widget-editor-generate-form>
          <input type="hidden" name="widgetKey" value="${s(e.key)}" />
          <div class="form-grid">
            <div class="field">
              <label for="widget-editor-company">Company</label>
              <select id="widget-editor-company" data-widget-editor-company name="companyId">
                ${a.length?"":'<option value="">No companies yet</option>'}
                ${a.map(g=>`
                      <option value="${g.id}" ${t.widgetEditor.companyId===g.id?"selected":""}>
                        ${s(g.name)}
                      </option>
                    `).join("")}
              </select>
            </div>
            <div class="field">
              <label for="widget-editor-establishment">Establishment</label>
              <select id="widget-editor-establishment" data-widget-editor-establishment name="establishmentId">
                ${i.length?"":'<option value="">No establishments yet</option>'}
                ${i.map(g=>`
                      <option value="${g.id}" ${t.widgetEditor.establishmentId===g.id?"selected":""}>
                        ${s(g.name)}
                      </option>
                    `).join("")}
              </select>
            </div>
            <div class="field">
              <label for="widget-editor-model">Model</label>
              <select id="widget-editor-model" name="model" data-widget-editor-model>
                ${nt(t.widgetEditor.model)}
              </select>
            </div>
            <div class="field">
              <label for="widget-editor-reasoning">Reasoning</label>
              <select id="widget-editor-reasoning" name="reasoningEffort" data-widget-editor-reasoning>
                ${st(t.widgetEditor.reasoningEffort)}
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
              <p class="meta">Current total upload limit: ${s(d)} MB.</p>
            </div>
            <div class="field">
              <label for="widget-editor-prompt-name">Prompt name</label>
              <input
                id="widget-editor-prompt-name"
                name="promptName"
                placeholder="${s(e.promptNamePlaceholder)}"
                value="${s(t.widgetEditor.promptName)}"
                data-widget-editor-prompt-name
              />
            </div>
            <div class="field full">
              <label for="widget-editor-prompt">Design request</label>
              <textarea
                id="widget-editor-prompt"
                name="requestText"
                rows="8"
                placeholder="${s(e.promptPlaceholder)}"
                data-widget-editor-prompt
              >${s(t.widgetEditor.prompt)}</textarea>
            </div>
            <div class="field full">
              <label class="checkbox">
                <input
                  id="widget-editor-use-saved-baseline"
                  type="checkbox"
                  ${t.widgetEditor.useSavedBaseline?"checked":""}
                  ${m?"":"disabled"}
                  data-widget-editor-use-saved-baseline
                />
                ${s(p)}
              </label>
              <p class="meta">${s(u)}</p>
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
                  ${t.widgetEditor.selectedPromptId?"Update prompt":"Save prompt"}
                </button>
                <button type="button" class="ghost-button" data-action="clearWidgetEditorPromptSelection">New prompt</button>
              </div>
            </div>
            ${l.length?`
                  <div class="saved-prompt-list">
                    ${l.map(g=>`
                          <div class="saved-prompt-card ${t.widgetEditor.selectedPromptId===g.id?"is-selected":""}">
                            <div class="entity-row">
                              <div>
                                <strong>${s(g.name)}</strong>
                                <p class="meta">${s(wi(g.updatedAt))}</p>
                              </div>
                              <div class="stack-inline">
                                <button type="button" class="ghost-button" data-action="loadWidgetEditorPrompt" data-prompt-id="${g.id}">Load</button>
                                <button type="button" class="ghost-button" data-action="deleteWidgetEditorPrompt" data-prompt-id="${g.id}">Delete</button>
                              </div>
                            </div>
                            <p class="saved-prompt-preview">${s(bi(g.promptText))}</p>
                          </div>
                        `).join("")}
                  </div>
                `:'<div class="empty">No saved prompts yet.</div>'}
          </div>
          ${t.widgetEditor.attachments.length?`
            <div class="subsection">
              <p class="eyebrow">Attachments</p>
              <div class="chip-row">
                ${t.widgetEditor.attachments.map((g,w)=>`
                      <span class="chip">
                        ${s(g.name)}
                        <button
                          type="button"
                          class="mini-button"
                          data-action="removeWidgetEditorAttachment"
                          data-index="${w}"
                        >
                          Remove
                        </button>
                      </span>
                    `).join("")}
              </div>
            </div>
          `:""}
          <div class="stack-inline">
            <button type="submit">Generate CSS</button>
            ${o?`<button type="button" class="ghost-button" data-action="openWidgetEditorPreview" data-url="${s(o)}">${s(e.previewLabel)}</button>`:""}
          </div>
        </form>
        ${I("widgetEditor")}
      </article>
      <article class="panel panel-span-7">
        <p class="eyebrow">CSS Workspace</p>
        <h3>${s(e.workspaceTitle)}</h3>
        <p class="meta">${s(e.workspaceMeta)}</p>
        <form class="stack" data-widget-editor-save-form>
          <input type="hidden" name="widgetKey" value="${s(e.key)}" />
          <input type="hidden" name="establishmentId" value="${s(t.widgetEditor.establishmentId)}" />
          ${e.key==="booking_page_view"?`
                <div class="field">
                  <label for="widget-editor-content">Page content JSON</label>
                  <textarea
                    id="widget-editor-content"
                    name="contentText"
                    class="code-input"
                    rows="16"
                    placeholder="${s(e.contentPlaceholder)}"
                    data-widget-editor-content
                  >${s(t.widgetEditor.draftContentText)}</textarea>
                </div>
              `:""}
          <div class="field">
            <label for="widget-editor-css">CSS</label>
            <textarea
              id="widget-editor-css"
              name="cssText"
              class="code-input"
              rows="22"
              placeholder="${s(e.cssPlaceholder)}"
              data-widget-editor-css
            >${s(t.widgetEditor.draftCss)}</textarea>
          </div>
          <div class="stack-inline">
            <button type="submit">Save CSS</button>
            <button type="button" class="ghost-button" data-action="resetWidgetCssDraft">Reset to saved</button>
          </div>
        </form>
      </article>
    </section>
  `}function ke(e){const a=t.statuses[e];return!a?.message||a.processing!==!0?"":`
    <article class="panel full-width prominent-process-panel" aria-live="polite">
      <div class="prominent-process-banner">
        <div class="prominent-process-spinner" aria-hidden="true"></div>
        <div>
          <strong>Processing</strong>
          <p class="meta">${s(a.message)}</p>
        </div>
      </div>
    </article>
  `}function Ae(){location.pathname!=="/settings"||!P()||!ai()||r("workspace","info","Loading your establishment workspace...",{processing:!0})}function ee(e=$()){return e==="booking_page_view"?{key:e,eyebrow:"Page View Editor",title:"Generate and manage booking page CSS",meta:"Choose the target establishment, attach reference files, describe the actual page you want, and generate both page structure and CSS for the standalone booking page.",generatorMeta:"Pick a company and establishment, describe the page layout, copy, emphasis, and visual direction, attach reference files, and generate a full booking page around the calendar.",emptyState:"Create a company and establishment in settings before using the page view editor.",promptNamePlaceholder:"Example: Warm coastal booking page",promptPlaceholder:"Example: Build a centered booking page that matches the uploaded site, uses the provided copy tone, keeps the calendar as the hero focus, and adds a restrained supporting section below it.",workspaceTitle:"Booking page CSS",workspaceMeta:"The generator builds the actual booking page structure plus scoped CSS for the selected establishment. Use the prompt to control layout, copy, and how prominent the calendar should be.",contentPlaceholder:`{
  "kicker": "Reservations",
  "title": "Book a table",
  "intro": "Describe the page here.",
  "sections": []
}`,cssPlaceholder:".page-view-theme-root { ... }",previewPath:"/page-view",previewLabel:"Open page preview",generatedLabel:"Booking page CSS",savedLabel:"Booking page CSS"}:{key:"booking_calendar",eyebrow:"Theme Editor",title:"Generate and manage widget CSS",meta:"Choose the target establishment, attach reference files, save prompt templates, and edit the final CSS.",generatorMeta:"Pick a company and establishment, describe the visual direction, attach reference files, and generate CSS for the booking widget.",emptyState:"Create a company and establishment in settings before using the widget editor.",promptNamePlaceholder:"Example: Warm coastal booking widget",promptPlaceholder:"Example: Match the restaurant site. Use the uploaded hero image colors, a warmer cream background, sharper card corners, and bolder selected-day states.",workspaceTitle:"Booking calendar CSS",workspaceMeta:"This CSS is scoped to the selected establishment's booking widget and applies across its seat-count calendars.",contentPlaceholder:"",cssPlaceholder:".widget-theme-root { ... }",previewPath:"/widget",previewLabel:"Open widget preview",generatedLabel:"Widget CSS",savedLabel:"Widget CSS"}}function Zt(){const e=Mt();return it({themeRootClass:"widget-theme-root",layoutClass:"widget-layout",panelClass:"widget-calendar-panel",themeCss:e.cssText||N()?.widgetThemeCss||"",title:"",copy:"",pageContent:null})}function Xt(){const e=Mt();return it({themeRootClass:"page-view-theme-root",layoutClass:"page-view-layout",panelClass:"page-view-panel",themeCss:e.cssText||N()?.pageViewThemeCss||"",title:"",copy:"",pageContent:Ke(e.contentText)||Ke(N()?.pageViewThemeContentText)})}function it({themeRootClass:e,layoutClass:a,panelClass:i,themeCss:n,title:o,copy:d,pageContent:l}){if(!t.widget.seatCountId||!N()){const g=e==="page-view-theme-root";return`
      <section class="layout">
        <article class="panel full-width">
          <p class="eyebrow">${g?"Booking page view":"Widget view"}</p>
          <h2>${g?"Booking page not configured":"Widget not configured"}</h2>
          <p class="meta">
            ${g?"This booking page needs a configured seatCountId in the URL.":"This booking widget needs a configured seatCountId in the URL."}
          </p>
          <p class="meta">Example: <code>${g?"/page-view":"/widget"}?seatCountId=...</code></p>
        </article>
      </section>
    `}const m=t.widgetAvailability.find(g=>g.date===t.widget.selectedDate)??null,p=e==="page-view-theme-root",u=p?l||xe():null;return`
    ${n?`<style>${Mi(n)}</style>`:""}
    <section class="layout ${s(a)} ${s(e)}">
      <article class="panel full-width ${s(i)}">
        ${p?ea(u):`
              ${I("widget")}
              ${dt()}
              ${lt()}
            `}
      </article>
      ${wa(m)}
    </section>
  `}function ea(e){const a=e||xe();return`
    ${!a.sections.some(n=>n.type==="hero")&&(a.kicker||a.title||a.intro)?`
          <div class="page-view-header">
            ${a.kicker?`<p class="eyebrow page-view-kicker">${s(a.kicker)}</p>`:""}
            ${a.title?`<h1 class="page-view-title">${s(a.title)}</h1>`:""}
            ${a.intro?`<p class="meta page-view-copy">${s(a.intro)}</p>`:""}
          </div>
        `:""}
    <div class="page-view-sections">
      ${a.sections.map(n=>ta(n)).join("")}
    </div>
  `}function ve(e,a={}){const i=String(e?.imageUrl??"").trim();if(!i)return"";const n=a.loading==="eager"?"eager":"lazy",o=a.fetchpriority==="high"?"high":"low",d=e.imageAlt||e.title||"Booking page image";return`<img class="page-view-image" src="${s(i)}" alt="${s(d)}" loading="${n}" decoding="async" fetchpriority="${o}" />`}function ta(e){return!e||typeof e!="object"?"":e.type==="hero"?`
      <section class="page-view-section page-view-section-hero ${e.align==="center"?"is-centered":""}">
        <div class="page-view-section-copy">
          ${e.eyebrow?`<p class="eyebrow page-view-kicker">${s(e.eyebrow)}</p>`:""}
          ${e.title?`<h1 class="page-view-title">${s(e.title)}</h1>`:""}
          ${e.copy?`<p class="meta page-view-copy">${s(e.copy)}</p>`:""}
        </div>
        ${e.imageUrl?`
              <div class="page-view-section-media">
                ${ve(e,{loading:"eager",fetchpriority:"high"})}
              </div>
            `:""}
      </section>
    `:e.type==="text"?`
      <section class="page-view-section page-view-section-text ${e.align==="center"?"is-centered":""}">
        ${e.eyebrow?`<p class="eyebrow page-view-kicker">${s(e.eyebrow)}</p>`:""}
        ${e.title?`<h2>${s(e.title)}</h2>`:""}
        ${e.copy?`<p class="meta page-view-copy">${s(e.copy)}</p>`:""}
      </section>
    `:e.type==="split"?`
      <section class="page-view-section page-view-section-split ${e.imagePosition==="left"?"media-left":"media-right"}">
        ${e.imageUrl?`
              <div class="page-view-section-media">
                ${ve(e)}
              </div>
            `:""}
        <div class="page-view-section-copy">
          ${e.eyebrow?`<p class="eyebrow page-view-kicker">${s(e.eyebrow)}</p>`:""}
          ${e.title?`<h2>${s(e.title)}</h2>`:""}
          ${e.copy?`<p class="meta page-view-copy">${s(e.copy)}</p>`:""}
        </div>
      </section>
    `:e.type==="highlights"?`
      <section class="page-view-section page-view-section-highlights">
        ${e.eyebrow?`<p class="eyebrow page-view-kicker">${s(e.eyebrow)}</p>`:""}
        ${e.title?`<h2>${s(e.title)}</h2>`:""}
        <div class="page-view-highlight-grid">
          ${(e.items??[]).map(a=>`
                <article class="page-view-highlight-card">
                  ${a.title?`<h3>${s(a.title)}</h3>`:""}
                  ${a.copy?`<p class="meta">${s(a.copy)}</p>`:""}
                </article>
              `).join("")}
        </div>
      </section>
    `:e.type==="image"?`
      <section class="page-view-section page-view-section-image">
        ${e.imageUrl?ve(e):""}
        ${e.caption?`<p class="meta page-view-copy">${s(e.caption)}</p>`:""}
      </section>
    `:e.type==="quote"?`
      <section class="page-view-section page-view-section-quote">
        ${e.quote?`<blockquote class="page-view-quote">${s(e.quote)}</blockquote>`:""}
        ${e.attribution?`<p class="meta">${s(e.attribution)}</p>`:""}
      </section>
    `:e.type==="calendar"?`
      <section class="page-view-section page-view-section-calendar">
        ${e.eyebrow?`<p class="eyebrow page-view-kicker">${s(e.eyebrow)}</p>`:""}
        ${e.title?`<h2>${s(e.title)}</h2>`:""}
        ${e.copy?`<p class="meta page-view-copy">${s(e.copy)}</p>`:""}
        ${I("widget")}
        ${dt()}
        ${lt()}
      </section>
    `:""}function Ke(e){const a=String(e??"").trim();if(!a)return null;try{const i=JSON.parse(a);return aa(i)}catch{return null}}function xe(){return{kicker:"Reservations",title:"Book a table",intro:"Choose a day, pick a time, and confirm your booking details.",sections:[{type:"calendar",eyebrow:"Book now",title:"Select your booking time",copy:"Choose a date and time to continue."}]}}function aa(e){const a=e&&typeof e=="object"&&!Array.isArray(e)?e:{},i=Array.isArray(a.sections)?a.sections.map(ia).filter(Boolean):[];return i.some(n=>n.type==="calendar")||i.push(xe().sections[0]),{kicker:String(a.kicker??"").trim(),title:String(a.title??"").trim()||"Book a table",intro:String(a.intro??"").trim(),sections:i}}function ia(e){const a=e&&typeof e=="object"&&!Array.isArray(e)?e:{},i=String(a.type??"").trim().toLowerCase();return["hero","text","split","highlights","image","quote","calendar"].includes(i)?i==="highlights"?{type:i,eyebrow:String(a.eyebrow??"").trim(),title:String(a.title??"").trim(),items:Array.isArray(a.items)?a.items.map(n=>({title:String(n?.title??"").trim(),copy:String(n?.copy??"").trim()})).filter(n=>n.title||n.copy):[]}:i==="quote"?{type:i,quote:String(a.quote??"").trim(),attribution:String(a.attribution??"").trim()}:{type:i,eyebrow:String(a.eyebrow??"").trim(),title:String(a.title??"").trim(),copy:String(a.copy??"").trim(),align:String(a.align??"").trim().toLowerCase()==="center"?"center":"left",imageUrl:String(a.imageUrl??"").trim(),imageAlt:String(a.imageAlt??"").trim(),imagePosition:String(a.imagePosition??"").trim().toLowerCase()==="left"?"left":"right",caption:String(a.caption??"").trim()}:null}function na(e=!1){if(!t.session)return'<p class="meta">No active session.</p>';const a=We(t.session.establishmentId);return e?`
      <div class="identity-card">
        <div class="identity">
          ${s(t.session.firstName)} ${s(t.session.lastName)}
        </div>
        <p class="meta">${s(t.session.email)} | ${s(t.session.authLevel)}</p>
        ${a?`<p class="meta">${s(a)}</p>`:""}
        <button type="button" class="ghost-button" data-action="logout">Sign out</button>
      </div>
    `:`
    <div class="stack">
      <div class="identity">
        Signed in as <strong>${s(t.session.firstName)} ${s(t.session.lastName)}</strong>
      </div>
      <p class="meta">${s(t.session.email)} | ${s(t.session.authLevel)}</p>
      ${a?`<p class="meta">${s(a)}</p>`:""}
      <button type="button" class="ghost-button" data-action="logout">Sign out</button>
    </div>
  `}function sa(){return`
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
              value="${s(t.emailTestDraft.recipientEmail)}"
              data-email-test-draft
              required
            />
          </div>
          <div class="field">
            <label for="email-test-first-name">Guest first name</label>
            <input
              id="email-test-first-name"
              name="firstName"
              value="${s(t.emailTestDraft.firstName)}"
              data-email-test-draft
              required
            />
          </div>
          <div class="field">
            <label for="email-test-last-name">Guest last name</label>
            <input
              id="email-test-last-name"
              name="lastName"
              value="${s(t.emailTestDraft.lastName)}"
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
              value="${s(t.emailTestDraft.guestEmail)}"
              data-email-test-draft
              required
            />
          </div>
          <div class="field">
            <label for="email-test-phone">Guest phone</label>
            <input
              id="email-test-phone"
              name="phone"
              value="${s(t.emailTestDraft.phone)}"
              data-email-test-draft
              required
            />
          </div>
          <div class="field">
            <label for="email-test-establishment">Establishment</label>
            <input
              id="email-test-establishment"
              name="establishmentName"
              value="${s(t.emailTestDraft.establishmentName)}"
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
              value="${s(t.emailTestDraft.bookingDate)}"
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
              value="${s(t.emailTestDraft.bookingTime)}"
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
              value="${s(t.emailTestDraft.partySize)}"
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
            >${s(t.emailTestDraft.notes)}</textarea>
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
  `}function oa(){const e=t.appSettings.emailSettings??wt(),a=e.configured?"Ready to send":"Configuration incomplete",i=e.secure?"TLS / SSL":"STARTTLS or plain";return`
    <div class="stack">
      <div class="config-pill-row">
        <span class="config-pill ${e.configured?"is-good":"is-warn"}">${s(a)}</span>
        <span class="config-pill">${s(e.host||"No host")}</span>
        <span class="config-pill">Port ${s(e.port||"unset")}</span>
        <span class="config-pill">${s(i)}</span>
      </div>
      <div class="email-config-list">
        <div class="email-config-row">
          <strong>From address</strong>
          <span>${s(e.fromAddress||"Not set")}</span>
        </div>
        <div class="email-config-row">
          <strong>SMTP user</strong>
          <span>${s(e.user||"Not set")}</span>
        </div>
      </div>
      ${e.missingEnvVars?.length?`<p class="meta">Missing environment variables: ${s(e.missingEnvVars.join(", "))}</p>`:'<p class="meta">All required SMTP variables are present. Test sends will use these live values immediately.</p>'}
    </div>
  `}function ra(){return`
    <form class="stack" data-openai-settings-form>
      <div class="field">
        <label for="openai-model">Default OpenAI model</label>
        <select id="openai-model" name="openAiModel" data-openai-model-draft>
          ${nt(t.openAiModelDraft)}
        </select>
      </div>
      <div class="field">
        <label for="openai-reasoning-effort">Reasoning effort for widget CSS generation</label>
        <select
          id="openai-reasoning-effort"
          name="openAiReasoningEffort"
          data-openai-reasoning-effort-draft
        >
          ${st(t.openAiReasoningEffortDraft)}
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
          value="${s(t.widgetEditorUploadLimitDraftMb)}"
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
          value="${s(t.widgetEditorMaxOutputTokensDraft)}"
          data-widget-editor-max-output-tokens-draft
        />
        <p class="meta">High reasoning models may need far more token budget. OpenAI recommends starting with about 25,000 when experimenting with reasoning runs.</p>
      </div>
      <div class="stack-inline">
        <button type="submit">Save settings</button>
      </div>
    </form>
  `}function nt(e){const a=["gpt-5.4-nano","gpt-5.4-mini","gpt-5.4","gpt-5.5"];return e&&!a.includes(e)&&a.unshift(e),a.map(i=>`
        <option value="${i}" ${e===i?"selected":""}>
          ${s(i)}
        </option>
      `).join("")}function st(e){return[{value:"",label:"Model default"},{value:"none",label:"None"},{value:"minimal",label:"Minimal"},{value:"low",label:"Low"},{value:"medium",label:"Medium"},{value:"high",label:"High"},{value:"xhigh",label:"XHigh"}].map(i=>`
        <option value="${i.value}" ${e===i.value?"selected":""}>
          ${s(i.label)}
        </option>
      `).join("")}function $e(e,a={}){const i=a.restrictToStaff===!0,n=a.hideAssignmentFields===!0,o=a.hideRoleField===!0,d=i?t.session?.companyId??"":"",l=i?t.session?.establishmentId??"":"",m=['<option value="">No company</option>',...t.companies.map(u=>`
        <option value="${u.id}" ${t.userForm.companyId===u.id?"selected":""}>
          ${s(u.name)}
        </option>
      `)].join(""),p=['<option value="">No establishment</option>',...mi().map(u=>`
        <option value="${u.id}" ${t.userForm.establishmentId===u.id?"selected":""}>
          ${s(u.companyName)} | ${s(u.name)}
        </option>
      `)].join("");return`
    <form class="stack" data-user-form>
      <div class="form-grid">
        <div class="field">
          <label for="firstName">First name</label>
          <input id="firstName" name="firstName" value="${s(t.userForm.firstName)}" autocomplete="given-name" required />
        </div>
        <div class="field">
          <label for="lastName">Last name</label>
          <input id="lastName" name="lastName" value="${s(t.userForm.lastName)}" autocomplete="family-name" required />
        </div>
        <div class="field full">
          <label for="email">Email</label>
          <input id="email" name="email" value="${s(t.userForm.email)}" type="email" autocomplete="email" required />
        </div>
        <div class="field">
          <label for="password">${t.userForm.mode==="edit"?"New password (optional)":"Password"}</label>
          <input id="password" name="password" type="password" value="${s(t.userForm.password)}" autocomplete="new-password" ${t.userForm.mode==="create"?'minlength="8" required':'minlength="8"'} />
        </div>
        <div class="field">
          <label for="confirmPassword">${t.userForm.mode==="edit"?"Confirm new password":"Confirm password"}</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value="${s(t.userForm.confirmPassword)}"
            autocomplete="new-password"
            ${t.userForm.mode==="create"?'minlength="8" required':""}
          />
        </div>
        ${o?`
              <div class="field">
                <label>Auth level</label>
                <input value="Staff" readonly />
                <input type="hidden" name="authLevel" value="staff" />
              </div>
            `:`
              <div class="field">
                <label for="authLevel">Auth level</label>
                <select id="authLevel" name="authLevel" ${e?"disabled":""}>
                  <option value="admin" ${t.userForm.authLevel==="admin"?"selected":""}>Admin</option>
                  <option value="user" ${t.userForm.authLevel==="user"?"selected":""}>User</option>
                  <option value="manager" ${t.userForm.authLevel==="manager"?"selected":""}>Manager</option>
                  <option value="staff" ${t.userForm.authLevel==="staff"?"selected":""}>Staff</option>
                </select>
                ${e?'<input type="hidden" name="authLevel" value="admin" />':""}
              </div>
            `}
        ${n?`
              <div class="field">
                <label>Company</label>
                <input value="${s(pi(d)||"No company")}" readonly />
                <input type="hidden" name="companyId" value="${s(d)}" />
              </div>
              <div class="field">
                <label>Establishment</label>
                <input value="${s(We(l)||"No establishment assigned")}" readonly />
                <input type="hidden" name="establishmentId" value="${s(l)}" />
              </div>
            `:`
              <div class="field">
                <label for="companyId">Company</label>
                <select id="companyId" name="companyId">${m}</select>
              </div>
              <div class="field">
                <label for="establishmentId">Establishment</label>
                <select id="establishmentId" name="establishmentId">${p}</select>
              </div>
            `}
      </div>
      <div class="stack-inline">
        <button type="submit">${t.userForm.mode==="edit"?i?"Save staff member":"Save user":e?"Create admin":i?"Create staff member":"Create user"}</button>
        ${t.userForm.mode==="edit"?'<button type="button" class="ghost-button" data-action="cancelUserEdit">Cancel</button>':""}
      </div>
    </form>
  `}function da(){return`
    <form class="stack" data-company-form>
      <div class="field">
        <label for="company-name">Company name</label>
        <input id="company-name" name="name" value="${s(t.companyForm.name)}" required />
      </div>
      <div class="field">
        <label for="company-enquiry-email">Enquiry email</label>
        <input
          id="company-enquiry-email"
          name="enquiryEmail"
          type="email"
          value="${s(t.companyForm.enquiryEmail)}"
          required
        />
      </div>
      <div class="stack-inline">
        <button type="submit">${t.companyForm.mode==="edit"?"Save company":"Create company"}</button>
        ${t.companyForm.mode==="edit"?'<button type="button" class="ghost-button" data-action="cancelCompanyEdit">Cancel</button>':""}
      </div>
    </form>
  `}function ot(){const e=O(),a=Re(),i=E()||T();return T()&&$t("workspace")&&!t.users.length?'<div class="empty loading-empty">Loading staff accounts for this establishment...</div>':a.length?a.map(n=>{const o=n.companyId?e.companyNamesById.get(n.companyId)??"Unknown company":"No company",d=n.establishmentId?e.establishmentsById.get(n.establishmentId)?.name??"Unknown establishment":"No establishment";return`
        <article class="entity-card">
          ${i?`
                <label class="checkbox entity-select">
                  <input
                    type="checkbox"
                    value="${n.id}"
                    data-user-select
                    ${t.selectedUserIds.has(n.id)?"checked":""}
                  />
                  <span></span>
                </label>
              `:""}
          <div class="entity-body">
            <div class="entity-row">
              <div>
                <strong>${s(n.firstName)} ${s(n.lastName)}</strong>
                <p class="meta">${s(n.email)}</p>
                <p class="meta">${s(n.authLevel)} | ${s(o)}</p>
                <p class="meta">${s(d)}</p>
              </div>
              ${i?`
                    <div class="stack-inline">
                      <button type="button" class="ghost-button" data-action="editUser" data-user-id="${n.id}">Edit</button>
                      <button type="button" class="ghost-button" data-action="deleteUser" data-user-id="${n.id}">Delete</button>
                    </div>
                  `:""}
            </div>
          </div>
        </article>
      `}).join(""):`<div class="empty">${T()?"No staff accounts are assigned to this establishment yet.":"No users match the current search."}</div>`}function la(){const e=O(),a=Fe();return a.length?a.map(i=>{const n=e.usersByCompanyId.get(i.id)??[];return`
        <article class="company-card">
          <div class="entity-row">
            <label class="checkbox entity-select">
              <input
                type="checkbox"
                value="${i.id}"
                data-company-select
                ${t.selectedCompanyIds.has(i.id)?"checked":""}
              />
              <span></span>
            </label>
            <div class="entity-body">
              <strong>${s(i.name)}</strong>
              <p class="meta">${n.length} users | ${i.establishments.length} establishments</p>
              <p class="meta">${s(i.enquiryEmail||"No enquiry email set")}</p>
            </div>
            <div class="stack-inline">
              <button type="button" class="ghost-button" data-action="editCompany" data-company-id="${i.id}">Edit</button>
              <button type="button" class="ghost-button" data-action="deleteCompany" data-company-id="${i.id}">Delete</button>
              <button type="button" class="ghost-button" data-action="addEstablishment" data-company-id="${i.id}">Add establishment</button>
            </div>
          </div>
          ${n.length?`<div class="subsection">
                  <p class="eyebrow">Users</p>
                  <div class="chip-row">${n.map(o=>`<span class="chip">${s(o.firstName)} ${s(o.lastName)} · ${s(o.authLevel)}</span>`).join("")}</div>
                </div>`:""}
          <div class="subsection">
            <p class="eyebrow">Establishments</p>
            ${i.establishments.length?i.establishments.map(o=>ca(i,o)).join(""):'<div class="empty">No establishments yet.</div>'}
          </div>
        </article>
      `}).join(""):'<div class="empty">No companies match the current search.</div>'}function ca(e,a){return`
    <div class="nested-card">
      <div class="entity-row">
        <label class="checkbox entity-select">
          <input
            type="checkbox"
            value="${a.id}"
            data-establishment-select
            ${t.selectedEstablishmentIds.has(a.id)?"checked":""}
          />
          <span></span>
        </label>
        <div class="entity-body">
          <strong>${s(a.name)}</strong>
          <p class="meta">${s(e.name)}</p>
        </div>
        <div class="stack-inline">
          <button type="button" class="ghost-button" data-action="editEstablishment" data-company-id="${e.id}" data-establishment-id="${a.id}">Edit</button>
          <button type="button" class="ghost-button" data-action="deleteEstablishment" data-establishment-id="${a.id}">Delete</button>
          <button type="button" class="ghost-button" data-action="addSeatCount" data-establishment-id="${a.id}">Add seat count</button>
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
            data-establishment-id="${a.id}"
          >
            Save hours
          </button>
        </div>
        <div class="hours-grid">
          ${ua(a)}
        </div>
      </div>
      <div class="chip-row">
        ${a.seatCounts.length?a.seatCounts.map(i=>`
                    <span class="chip chip-action">
                      <label class="checkbox compact-checkbox">
                        <input
                          type="checkbox"
                          value="${i.id}"
                          data-seat-count-select
                          ${t.selectedSeatCountIds.has(i.id)?"checked":""}
                        />
                        <span></span>
                      </label>
                      ${s(V(i))}
                      <button type="button" class="mini-button" data-action="editSeatCount" data-establishment-id="${a.id}" data-seat-count-id="${i.id}" data-seat-count="${i.seatCount}" data-max-party-size="${i.maxPartySize}" data-guest-visit-minutes="${i.guestVisitMinutes}">Edit</button>
                      <button type="button" class="mini-button" data-action="deleteSeatCount" data-seat-count-id="${i.id}">Delete</button>
                    </span>
                  `).join(""):'<span class="meta">No seat-count calendars yet.</span>'}
      </div>
    </div>
  `}function ua(e){return e.openingHours.map(a=>`
        <div class="hours-row">
          <div class="hours-label">${s(a.label)}</div>
          <label class="checkbox compact-checkbox">
            <input
              type="checkbox"
              data-hours-open
              data-establishment-id="${e.id}"
              data-weekday="${a.weekdayIndex}"
              ${a.isOpen?"checked":""}
            />
            <span>Open</span>
          </label>
          <input
            type="time"
            step="900"
            data-hours-start
            data-establishment-id="${e.id}"
            data-weekday="${a.weekdayIndex}"
            value="${s(a.openTime||"09:00")}"
          />
          <input
            type="time"
            step="900"
            data-hours-end
            data-establishment-id="${e.id}"
            data-weekday="${a.weekdayIndex}"
            value="${s(a.closeTime||"17:00")}"
          />
        </div>
      `).join("")}function rt(){!W()&&t.bookingWorkspace.activeTab!=="calendar"&&(t.bookingWorkspace.activeTab="calendar");const e=je(),a=He(),i=Dt(),n=W()?t.bookingWorkspace.activeTab:"calendar",o=!!(e.length&&a.length&&i.length),d=T()||te(),l=e.find(u=>u.id===t.adminCalendar.companyId)??null,m=a.find(u=>u.id===t.adminCalendar.establishmentId)??null,p=i.find(u=>u.id===t.adminCalendar.seatCountId)??null;return`
    <div class="stack">
      ${d?`
            <div class="form-grid">
              <div class="field">
                <label>Company</label>
                <input value="${s(l?.name??"No company assigned")}" readonly />
              </div>
              <div class="field">
                <label>Establishment</label>
                <input value="${s(m?.name??"No establishment assigned")}" readonly />
              </div>
              <div class="field full">
                <label for="booking-seat-count">Seat-count calendar</label>
                <select id="booking-seat-count" data-booking-seat-count>
                  ${i.length?"":'<option value="">No seat counts</option>'}
                  ${i.map(u=>`
                        <option value="${u.id}" ${t.adminCalendar.seatCountId===u.id?"selected":""}>
                          ${s(V(u))}
                        </option>
                      `).join("")}
                </select>
                ${p?`<p class="meta">Viewing the ${s(V(p))} calendar for your establishment.</p>`:""}
                ${E()&&m?`<div class="stack-inline">
                        <button
                          type="button"
                          class="ghost-button"
                          data-action="deleteEstablishmentBookings"
                          data-establishment-id="${m.id}"
                          data-establishment-name="${s(m.name)}"
                        >
                          Delete all bookings for this establishment
                        </button>
                      </div>`:""}
              </div>
            </div>
          `:`
            <div class="form-grid">
              <div class="field">
                <label for="booking-company">Company</label>
                <select id="booking-company" data-booking-company>
                  ${e.map(u=>`
                        <option value="${u.id}" ${t.adminCalendar.companyId===u.id?"selected":""}>
                          ${s(u.name)}
                        </option>
                      `).join("")}
                </select>
              </div>
              <div class="field">
                <label for="booking-establishment">Establishment</label>
                <select id="booking-establishment" data-booking-establishment>
                  ${a.length?"":'<option value="">No establishments</option>'}
                  ${a.map(u=>`
                        <option value="${u.id}" ${t.adminCalendar.establishmentId===u.id?"selected":""}>
                          ${s(u.name)}
                        </option>
                      `).join("")}
                </select>
              </div>
              <div class="field full">
                <label for="booking-seat-count">Seat-count calendar</label>
                <select id="booking-seat-count" data-booking-seat-count>
                  ${i.length?"":'<option value="">No seat counts</option>'}
                  ${i.map(u=>`
                        <option value="${u.id}" ${t.adminCalendar.seatCountId===u.id?"selected":""}>
                          ${s(V(u))}
                        </option>
                      `).join("")}
                </select>
                ${E()&&m?`<div class="stack-inline">
                        <button
                          type="button"
                          class="ghost-button"
                          data-action="deleteEstablishmentBookings"
                          data-establishment-id="${m.id}"
                          data-establishment-name="${s(m.name)}"
                        >
                          Delete all bookings for this establishment
                        </button>
                      </div>`:""}
              </div>
            </div>
          `}
      <div class="tab-row">
        <button
          type="button"
          class="${n==="calendar"?"tab-button is-active":"tab-button"}"
          aria-pressed="${n==="calendar"?"true":"false"}"
          data-action="showBookingCalendarTab"
        >
          Booking calendar
        </button>
        ${W()?`
              <button
                type="button"
                class="${n==="reports"?"tab-button is-active":"tab-button"}"
                aria-pressed="${n==="reports"?"true":"false"}"
                data-action="showBookingReportsTab"
              >
                Reports
              </button>
            `:""}
      </div>
      ${I("bookings")}
      ${d&&$t("workspace")&&!e.length?'<div class="empty loading-empty">Loading calendars and booking access for your establishment...</div>':e.length?a.length?i.length?n==="reports"?pa():`
                  <div class="stack">
                    <div class="inner-panel booking-search-panel">
                      <div class="list-toolbar">
                        <input
                          type="search"
                          placeholder="Search by first name, last name, email, or phone"
                          value="${s(t.bookingWorkspace.searchQuery)}"
                          data-booking-search-query
                        />
                        <button type="button" data-action="searchAdminBookings" ${o?"":"disabled"}>Search</button>
                        <button type="button" class="ghost-button" data-action="clearAdminBookingSearch">Clear</button>
                      </div>
                      ${ga()}
                    </div>
                    ${ma()}
                    <div class="booking-calendar-shell">
                      ${ha()}
                      ${ba()}
                    </div>
                    ${va()}
                  </div>
                `:'<div class="empty">Create at least one seat-count calendar for this establishment.</div>':'<div class="empty">Create an establishment and opening hours first.</div>':'<div class="empty">Create a company before managing bookings.</div>'}
    </div>
  `}function ma(){const e=t.adminAvailability.find(a=>a.date===t.adminCalendar.selectedDate)??null;return e?`
    <div class="inner-panel">
      <div class="panel-head">
        <div>
          <p class="eyebrow">Selected day</p>
          <h3>${s(e.date)}</h3>
          <p class="meta">${e.isBlocked?"No more bookings are currently being accepted for this day.":e.isOpen?`${s(D(e.openTime))} to ${s(D(e.closeTime))}`:"This day is closed based on opening hours."}</p>
        </div>
        ${de()&&(e.isOpen||e.isBlocked)?`<div class="stack-inline">
                <button
                  type="button"
                  class="${e.isBlocked?"ghost-button":""}"
                  data-action="${e.isBlocked?"reopenAdminDate":"closeAdminDate"}"
                  data-seat-count-id="${s(t.adminCalendar.seatCountId)}"
                  data-date="${s(e.date)}"
                >
                  ${e.isBlocked?"Reopen bookings":"Stop bookings for this day"}
                </button>
              </div>`:""}
      </div>
    </div>
  `:`
      <div class="inner-panel">
        <p class="eyebrow">Selected day</p>
        <h3>Choose a date on the calendar</h3>
        <p class="meta">${de()?"After selecting a day, you can stop any more bookings for that date from here.":"After selecting a day, you can inspect bookings and availability from here."}</p>
      </div>
    `}function pa(){const e=t.bookingWorkspace.report;return`
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
              value="${s(e.fromDate)}"
              data-booking-report-from-date
            />
          </div>
          <div class="field">
            <label for="booking-report-to-date">To date</label>
            <input
              id="booking-report-to-date"
              type="date"
              value="${s(e.toDate)}"
              data-booking-report-to-date
            />
          </div>
          <div class="field">
            <label for="booking-report-from-time">From time</label>
            <input
              id="booking-report-from-time"
              type="time"
              step="900"
              value="${s(e.fromTime)}"
              data-booking-report-from-time
            />
          </div>
          <div class="field">
            <label for="booking-report-to-time">To time</label>
            <input
              id="booking-report-to-time"
              type="time"
              step="900"
              value="${s(e.toTime)}"
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
            ${e.results.length?"":"disabled"}
          >
            Download CSV
          </button>
        </div>
      </div>
      ${fa()}
    </div>
  `}function ga(){return t.bookingWorkspace.searchHasRun?t.bookingWorkspace.searchResults.length?`
    <div class="search-result-list">
      ${t.bookingWorkspace.searchResults.map(e=>`
            <button
              type="button"
              class="search-result-card"
              data-action="focusAdminBookingSearchResult"
              data-booking-id="${e.id}"
              data-date="${e.bookingDate}"
              data-time="${e.bookingTime}"
            >
              <strong>${s(e.firstName)} ${s(e.lastName)}</strong>
              <span>${s(e.bookingDate)} at ${s(D(e.bookingTime))}</span>
              <span>${s(e.email)} | ${s(e.phone)}</span>
            </button>
          `).join("")}
    </div>
  `:'<div class="empty">No matching bookings were found.</div>':'<p class="meta">Search this seat-count calendar and jump the booking calendar straight to the matching day.</p>'}function fa(){const e=t.bookingWorkspace.report,a=_a(e.results);return e.hasRun?`
    <div class="inner-panel">
      <div class="panel-head">
        <div>
          <p class="eyebrow">Summary</p>
          <h3>${s(String(e.results.length))} booking${e.results.length===1?"":"s"}</h3>
          <p class="meta">${s(String(e.totalGuests))} total guests in the selected range.</p>
        </div>
      </div>
      ${e.results.length?`
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
                  ${a.map(i=>`
                        <tr>
                          <td>${s(i.label)}</td>
                          <td>${s(i.date)}</td>
                          <td>${s(String(i.bookings))}</td>
                          <td>${s(String(i.guests))}</td>
                        </tr>
                      `).join("")}
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
                  ${e.results.map(i=>`
                        <tr>
                          <td>${s(i.bookingDate)}</td>
                          <td>${s(D(i.bookingTime))}</td>
                          <td>${s(String(i.partySize))}</td>
                          <td>${s(i.firstName)}</td>
                          <td>${s(i.lastName)}</td>
                          <td>${s(i.email)}</td>
                          <td>${s(i.phone)}</td>
                          <td>${s(i.notes||"")}</td>
                        </tr>
                      `).join("")}
                </tbody>
              </table>
            </div>
          `:'<div class="empty">No bookings were found for the selected range.</div>'}
    </div>
  `:'<p class="meta">Run a report for the selected seat-count calendar and date/time range.</p>'}function dt(){const e=Rt(t.widget.currentMonth);return`
    <div class="calendar-nav widget-calendar-nav">
      <button type="button" class="ghost-button" data-action="previousWidgetMonth">Previous</button>
      <div class="calendar-month">${s(e)}</div>
      <button type="button" class="ghost-button" data-action="nextWidgetMonth">Next</button>
    </div>
  `}function ha(){const e=Rt(t.adminCalendar.currentMonth);return`
    <div class="calendar-nav">
      <button type="button" class="ghost-button" data-action="previousAdminMonth">Previous</button>
      <div class="calendar-month">${s(e)}</div>
      <button type="button" class="ghost-button" data-action="nextAdminMonth">Next</button>
    </div>
  `}function lt(){const{year:e,monthIndex:a}=Y(t.widget.currentMonth),i=new Date(Date.UTC(e,a,1)),n=new Date(Date.UTC(e,a+1,0)).getUTCDate(),o=(i.getUTCDay()+6)%7,d=new Map(t.widgetAvailability.map(p=>[p.date,p])),l=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(p=>`<div class="weekday">${p}</div>`).join(""),m=[];for(let p=0;p<o;p+=1)m.push('<div class="calendar-cell calendar-pad"></div>');for(let p=1;p<=n;p+=1){const u=Ge(e,a,p),g=d.get(u),w=t.widget.selectedDate===u,b=Wt(g);m.push(`
      <button
        type="button"
        class="calendar-cell calendar-date ${w?"selected":""} ${b.className}"
        data-action="selectWidgetDate"
        data-date="${u}"
        data-fullness="${b.status}"
        aria-pressed="${w?"true":"false"}"
        aria-label="${s(`${u}. ${b.caption}`)}"
        style="--seat-load:${b.seatLoad.toFixed(3)};--seat-load-raw:${b.rawSeatLoad.toFixed(3)}"
        ${g?.canBook?"":"disabled"}
      >
        <span class="calendar-number">${p}</span>
        <span class="calendar-caption">${b.caption}</span>
      </button>
    `)}return`
    <div class="calendar-shell">
      <div class="calendar-weekdays">${l}</div>
      <div class="calendar-month-grid">${m.join("")}</div>
    </div>
  `}function ba(){const{year:e,monthIndex:a}=Y(t.adminCalendar.currentMonth),i=new Date(Date.UTC(e,a,1)),n=new Date(Date.UTC(e,a+1,0)).getUTCDate(),o=(i.getUTCDay()+6)%7,d=new Map(t.adminAvailability.map(p=>[p.date,p])),l=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(p=>`<div class="weekday">${p}</div>`).join(""),m=[];for(let p=0;p<o;p+=1)m.push('<div class="calendar-cell calendar-pad"></div>');for(let p=1;p<=n;p+=1){const u=Ge(e,a,p),g=d.get(u),w=t.adminCalendar.selectedDate===u,b=Wt(g);m.push(`
      <button
        type="button"
        class="calendar-cell calendar-date ${w?"selected":""} ${b.className}"
        data-action="selectAdminDate"
        data-date="${u}"
        data-fullness="${b.status}"
        aria-pressed="${w?"true":"false"}"
        aria-label="${s(`${u}. ${b.caption}`)}"
        style="--seat-load:${b.seatLoad.toFixed(3)};--seat-load-raw:${b.rawSeatLoad.toFixed(3)}"
      >
        <span class="calendar-number">${p}</span>
        <span class="calendar-caption">${b.caption}</span>
      </button>
    `)}return`
    <div class="calendar-shell">
      <div class="calendar-weekdays">${l}</div>
      <div class="calendar-month-grid">${m.join("")}</div>
    </div>
  `}function wa(e){if(t.widget.modal==="confirmed")return`
      <div class="widget-modal-backdrop" data-action="closeWidgetModal">
        <div class="widget-modal" data-modal-panel>
          <p class="eyebrow">Booking confirmed</p>
          <h3>Check your email</h3>
          <p class="meta">${s(t.widget.confirmationMessage||"Your booking has been confirmed. Please check your email for the confirmation message.")}</p>
          <div class="stack-inline">
            <button type="button" data-action="closeWidgetModal">Done</button>
          </div>
        </div>
      </div>
    `;if(t.widget.modal==="enquiry"){const a=N(),i=Number(t.widget.enquiryPartySize||0);return`
      <div class="widget-modal-backdrop" data-action="closeWidgetModal">
        <div class="widget-modal" data-modal-panel>
          <p class="eyebrow">Booking enquiry</p>
          <h3>Send an enquiry</h3>
          <p class="meta">${i>0?`For parties over ${i-1}, send an enquiry and the team will get back to you.`:"Send an enquiry and the team will get back to you."}</p>
          <form class="stack widget-form" data-widget-enquiry-form>
            <input type="hidden" name="action" value="enquiry" />
            <input type="hidden" name="seatCountId" value="${s(t.widget.seatCountId)}" />
            <div class="form-grid">
              <div class="field">
                <label for="enquiry-party-size">Party size</label>
                <input
                  id="enquiry-party-size"
                  name="partySize"
                  type="number"
                  min="${i>0?String(i):"1"}"
                  value="${s(t.widget.enquiryPartySize||"1")}"
                  required
                />
              </div>
              <div class="field">
                <label for="enquiry-date">Preferred date</label>
                <input id="enquiry-date" name="bookingDate" type="date" value="${s(t.widget.selectedDate)}" />
              </div>
              <div class="field">
                <label for="enquiry-time">Preferred time</label>
                <input id="enquiry-time" name="bookingTime" type="time" step="900" value="${s(t.widget.selectedTime)}" />
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
            ${a?.companyEnquiryEmail?`<p class="meta">This enquiry will be sent to ${s(a.companyEnquiryEmail)}.</p>`:""}
            <div class="status" aria-live="polite"></div>
            <div class="stack-inline">
              <button type="submit">Send enquiry</button>
              <button type="button" class="ghost-button" data-action="closeWidgetModal">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    `}if(t.widget.modal==="enquirySent")return`
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
    `;if(t.widget.modal==="time"&&e){const a=Math.max(Number(e.maxPartySize??0),0);return N(),`
      <div class="widget-modal-backdrop" data-action="closeWidgetModal">
        <div class="widget-modal" data-modal-panel>
          <p class="eyebrow">Choose a time</p>
          <h3>${s(t.widget.selectedDate)}</h3>
          ${a>0?`<p class="meta">For parties over ${s(String(a))}, <a href="#" class="inline-link" data-action="openLargePartyEnquiry" data-limit="${s(String(a))}">enquire here</a>.</p>`:""}
          <div class="times-grid">
            ${ya(e)}
          </div>
          <div class="stack-inline">
            <button type="button" class="ghost-button" data-action="closeWidgetModal">Cancel</button>
          </div>
        </div>
      </div>
    `}if(t.widget.modal==="details"){const a=e?.slots.find(l=>l.time===t.widget.selectedTime)??null,i=Math.max(Number(a?.remaining??0),0),n=Math.max(Number(a?.capacity??e?.slotCapacity??0),0),o=Math.max(Number(e?.maxPartySize??n),0),d=Math.max(Math.min(i||0,o||n||0),1);return N(),`
      <div class="widget-modal-backdrop" data-action="closeWidgetModal">
        <div class="widget-modal" data-modal-panel>
          <p class="eyebrow">Booking details</p>
          <h3>${s(t.widget.selectedDate)} at ${s(D(t.widget.selectedTime))}</h3>
          <p class="meta">${i>0?`${i} seat${i===1?"":"s"} available`:"No seats available"}</p>
          ${o>0?`<p class="meta">For parties over ${s(String(o))}, <a href="#" class="inline-link" data-action="openLargePartyEnquiry" data-limit="${s(String(o))}">enquire here</a>.</p>`:""}
          <form class="stack widget-form" data-widget-form>
            <input type="hidden" name="seatCountId" value="${s(t.widget.seatCountId)}" />
            <input type="hidden" name="bookingDate" value="${s(t.widget.selectedDate)}" />
            <input type="hidden" name="bookingTime" value="${s(t.widget.selectedTime)}" />
            <div class="form-grid">
              <div class="field">
                <label for="booking-party-size">Number of people</label>
                <input
                  id="booking-party-size"
                  name="partySize"
                  type="number"
                  min="1"
                  max="${d}"
                  data-widget-party-size
                  data-max-bookable-party-size="${d}"
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
              <button type="submit" ${i>0?"":"disabled"}>Book selected slot</button>
              <button type="button" class="ghost-button" data-action="backToTimeModal">Back</button>
            </div>
          </form>
        </div>
      </div>
    `}return""}function ya(e){return e?e.slots.map(a=>{const i=Ai(a);return`
        <button
          type="button"
          class="time-pill ${t.widget.selectedTime===a.time?"selected":""} ${i.className}"
          data-action="selectWidgetTime"
          data-time="${a.time}"
          data-fullness="${i.status}"
          aria-pressed="${t.widget.selectedTime===a.time?"true":"false"}"
          aria-label="${s(`${D(a.time)}. ${i.status.replaceAll("-"," ")}`)}"
          style="--seat-load:${i.seatLoad.toFixed(3)};--seat-load-raw:${i.rawSeatLoad.toFixed(3)}"
          ${a.available?"":"disabled"}
        >
          ${s(D(a.time))}
        </button>
      `}).join(""):'<div class="empty">Choose a day to see times.</div>'}function va(){const e=t.adminAvailability.find(i=>i.date===t.adminCalendar.selectedDate)??null,a=de();return t.adminCalendar.modal==="day"&&e?`
      <div class="widget-modal-backdrop" data-action="closeAdminCalendarModal">
        <div class="widget-modal admin-booking-modal" data-modal-panel>
          <p class="eyebrow">Bookings</p>
          <h3>${s(t.adminCalendar.selectedDate)}</h3>
          <p class="meta">
            ${e.isBlocked?"No more bookings are being accepted for this day.":e.isOpen?`${s(D(e.openTime))} to ${s(D(e.closeTime))}`:"Closed"}
          </p>
          ${a&&(e.isOpen||e.isBlocked)?`<div class="stack-inline">
                  <button
                    type="button"
                    class="ghost-button"
                    data-action="${e.isBlocked?"reopenAdminDate":"closeAdminDate"}"
                    data-seat-count-id="${s(t.adminCalendar.seatCountId)}"
                    data-date="${s(e.date)}"
                  >
                    ${e.isBlocked?"Reopen bookings for this day":"Stop bookings for this day"}
                  </button>
                </div>`:""}
          <div class="admin-slot-list">
            ${e.isOpen?e.slots.map(i=>ka(i,{isBlocked:e.isBlocked,guestVisitMinutes:e.guestVisitMinutes})).join(""):'<div class="empty">This day is closed.</div>'}
          </div>
          <div class="stack-inline">
            <button type="button" class="ghost-button" data-action="closeAdminCalendarModal">Close</button>
          </div>
        </div>
      </div>
    `:t.adminCalendar.modal==="form"?`
      <div class="widget-modal-backdrop" data-action="closeAdminCalendarModal">
        <div class="widget-modal admin-booking-modal" data-modal-panel>
          <p class="eyebrow">${t.adminCalendar.editingBookingId?"Edit booking":"Add booking"}</p>
          <h3>${s(t.adminCalendar.selectedDate)} at ${s(D(t.adminCalendar.selectedTime))}</h3>
          <form class="stack" data-admin-booking-form>
            <input type="hidden" name="bookingId" value="${s(t.adminCalendar.editingBookingId)}" />
            <input type="hidden" name="seatCountId" value="${s(t.adminCalendar.seatCountId)}" />
            <input type="hidden" name="bookingDate" value="${s(t.adminCalendar.selectedDate)}" />
            <input type="hidden" name="bookingTime" value="${s(t.adminCalendar.selectedTime)}" />
            <div class="form-grid">
              <div class="field">
                <label for="admin-party-size">Number of people</label>
                <input id="admin-party-size" name="partySize" type="number" min="1" value="${s(j("partySize")||"1")}" required />
              </div>
              <div class="field">
                <label for="admin-booking-first-name">First name</label>
                <input id="admin-booking-first-name" name="firstName" value="${s(j("firstName"))}" required />
              </div>
              <div class="field">
                <label for="admin-booking-last-name">Last name</label>
                <input id="admin-booking-last-name" name="lastName" value="${s(j("lastName"))}" required />
              </div>
              <div class="field full">
                <label for="admin-booking-email">Email</label>
                <input id="admin-booking-email" name="email" type="email" value="${s(j("email"))}" required />
              </div>
              <div class="field full">
                <label for="admin-booking-phone">Phone</label>
                <input id="admin-booking-phone" name="phone" value="${s(j("phone"))}" required />
              </div>
              <div class="field full">
                <label for="admin-booking-notes">Notes</label>
                <input id="admin-booking-notes" name="notes" value="${s(j("notes"))}" />
              </div>
            </div>
            <div class="status" aria-live="polite"></div>
            <div class="stack-inline">
              <button type="submit">${t.adminCalendar.editingBookingId?"Save booking":"Create booking"}</button>
              <button type="button" class="ghost-button" data-action="backToAdminDayModal">Back</button>
            </div>
          </form>
        </div>
      </div>
    `:""}function ka(e,a={}){const i=a.isBlocked===!0,n=Bt(a.guestVisitMinutes);return`
    <div class="nested-card">
      <div class="entity-row">
        <div>
          <strong>${s(D(e.time))}</strong>
          <p class="meta">${e.remaining}/${e.capacity} seats left in this ${s(n)} booking window</p>
        </div>
        <button
          type="button"
          class="ghost-button"
          data-action="createAdminBooking"
          data-time="${e.time}"
          ${i?"disabled":""}
        >
          Add booking
        </button>
      </div>
      ${e.bookings?.length?e.bookings.map(o=>`
                  <div class="entity-row booking-row">
                    <div>
                      <strong>${s(o.firstName)} ${s(o.lastName)}</strong>
                      <p class="meta">${s(o.partySize)} people | ${s(o.email)}</p>
                    </div>
                    <div class="stack-inline">
                      <button type="button" class="ghost-button" data-action="editAdminBooking" data-booking-id="${o.id}" data-time="${e.time}">Edit</button>
                      <button type="button" class="ghost-button" data-action="deleteAdminBooking" data-booking-id="${o.id}">Delete</button>
                    </div>
                  </div>
                `).join(""):'<p class="meta">No bookings for this time.</p>'}
    </div>
  `}async function $a(e,a){if(e==="openForgotPassword"){h("passwordReset"),F("/login?forgot=1");return}if(e==="returnToLogin"){h("passwordReset"),F("/login");return}if(e==="logout"){r("auth","info","Signing out..."),await Ja();return}if(e==="previousWidgetMonth"){r("widget","info","Loading availability..."),t.widget.currentMonth=ne(t.widget.currentMonth,-1),await M(),c();return}if(e==="nextWidgetMonth"){r("widget","info","Loading availability..."),t.widget.currentMonth=ne(t.widget.currentMonth,1),await M(),c();return}if(e==="selectWidgetDate"){t.widget.selectedDate=a.date,t.widget.selectedTime="",t.widget.confirmationMessage="",t.widget.enquiryPartySize="",t.widget.modal="time",c();return}if(e==="selectWidgetTime"){t.widget.selectedTime=a.time,t.widget.modal="details",c();return}if(e==="closeWidgetModal"){t.widget.confirmationMessage="",t.widget.enquiryPartySize="",t.widget.modal=null,c();return}if(e==="backToTimeModal"){t.widget.modal="time",c();return}if(e==="openLargePartyEnquiry"){if(!N()?.companyEnquiryEmail){r("widget","error","This company does not have an enquiry email configured yet.");return}const n=Number(a.limit??0);t.widget.enquiryPartySize=n>0?String(n+1):"",t.widget.modal="enquiry",h("widget"),c();return}if(e==="previousAdminMonth"){r("bookings","info","Loading booking calendar..."),t.adminCalendar.currentMonth=ne(t.adminCalendar.currentMonth,-1),await y(),c();return}if(e==="nextAdminMonth"){r("bookings","info","Loading booking calendar..."),t.adminCalendar.currentMonth=ne(t.adminCalendar.currentMonth,1),await y(),c();return}if(e==="selectAdminDate"){t.adminCalendar.selectedDate=a.date,t.adminCalendar.selectedTime="",t.adminCalendar.editingBookingId="",t.adminCalendar.modal="day",h("bookings"),c();return}if(e==="closeAdminCalendarModal"){t.adminCalendar.modal=null,t.adminCalendar.selectedTime="",t.adminCalendar.editingBookingId="",c();return}if(e==="createAdminBooking"){if((t.adminAvailability.find(n=>n.date===t.adminCalendar.selectedDate)??null)?.isBlocked){r("bookings","error","No more bookings are being accepted for that day.");return}t.adminCalendar.selectedTime=a.time,t.adminCalendar.editingBookingId="",t.adminCalendar.modal="form",h("bookings"),c();return}if(e==="editAdminBooking"){t.adminCalendar.selectedTime=a.time,t.adminCalendar.editingBookingId=a.bookingId,t.adminCalendar.modal="form",h("bookings"),c();return}if(e==="deleteAdminBooking"){if(!confirm("Delete this booking?"))return;r("bookings","info","Deleting booking..."),await f("/api/bookings",{action:"delete",bookingId:a.bookingId},"bookings"),t.adminCalendar.editingBookingId="",await y(),t.widget.seatCountId===t.adminCalendar.seatCountId&&await M(),t.adminCalendar.modal="day",r("bookings","success","Booking deleted.");return}if(e==="deleteEstablishmentBookings"){if(!E()){r("bookings","error","Only admins can delete all bookings for an establishment.");return}const i=String(a.establishmentName??"this establishment").trim();if(!confirm(`Delete all bookings for ${i}? This cannot be undone.`))return;H(),r("bookings","info","Deleting all bookings for this establishment...");const n=await f("/api/bookings",{action:"deleteEstablishmentBookings",establishmentId:a.establishmentId},"bookings");await y(),N()?.establishmentId===t.adminCalendar.establishmentId&&await M(),t.adminCalendar.modal=null,t.adminCalendar.editingBookingId="",t.adminCalendar.selectedTime="",r("bookings","success",n.message??"All bookings deleted for that establishment."),c();return}if(e==="backToAdminDayModal"){t.adminCalendar.modal="day",t.adminCalendar.editingBookingId="",c();return}if(e==="closeAdminDate"||e==="reopenAdminDate"){if(!de()){r("bookings","error","Only admins and managers can change booking-day availability.");return}const i=e==="closeAdminDate";r("bookings","info",i?"Stopping bookings for this day...":"Reopening bookings for this day...");const n=await f("/api/bookings",{action:i?"closeDate":"reopenDate",seatCountId:a.seatCountId,bookingDate:a.date},"bookings");await y(),t.widget.seatCountId===t.adminCalendar.seatCountId&&await M(),t.adminCalendar.modal="day",r("bookings","success",n.message??(i?"Bookings stopped for that day.":"Bookings reopened for that day."));return}if(e==="showBookingCalendarTab"){t.bookingWorkspace.activeTab="calendar",c();return}if(e==="showBookingReportsTab"){if(!W()){t.bookingWorkspace.activeTab="calendar",c();return}t.bookingWorkspace.activeTab="reports",c();return}if(e==="searchAdminBookings"){await Na();return}if(e==="clearAdminBookingSearch"){t.bookingWorkspace.searchQuery="",t.bookingWorkspace.searchResults=[],t.bookingWorkspace.searchHasRun=!1,h("bookings"),c();return}if(e==="focusAdminBookingSearchResult"){await Ba(a.date);return}if(e==="runBookingReport"){await La();return}if(e==="setBookingReportPreset"){Ra(a.preset),c();return}if(e==="downloadBookingReportCsv"){Fa();return}if(e==="copyWidgetUrl"||e==="copyWidgetEmbed"||e==="copyPageViewUrl"||e==="copyPageViewEmbed"){await navigator.clipboard.writeText(a.url),r("widgetSetup","success","Copied.");return}if(e==="openWidgetPreview"||e==="openPageViewPreview"){F(a.url);return}if(e==="openWidgetEditorPreview"){const i=Si(a.url);if(!i){r("widgetEditor","error","Select an establishment with at least one seat-count calendar first.");return}Ci(i);return}if(e==="removeWidgetEditorAttachment"){t.widgetEditor.attachments.splice(Number(a.index),1),c();return}if(e==="saveWidgetEditorPrompt"){await Ua();return}if(e==="loadWidgetEditorPrompt"){hi(a.promptId);return}if(e==="clearWidgetEditorPromptSelection"){Et(),c();return}if(e==="deleteWidgetEditorPrompt"){await Oa(a.promptId);return}if(e==="resetWidgetCssDraft"){const i=J();t.widgetEditor.draftCss=Ve(i)??"",t.widgetEditor.draftContentText=Pt(i)??"",r("widgetEditor","info",$()==="booking_page_view"?"Draft reset to the last saved booking page content and CSS.":"Draft reset to the last saved CSS.");return}if(e==="cancelUserEdit"){t.userForm=ue(),h("users"),c();return}if(e==="cancelCompanyEdit"){t.companyForm=me(),h("companies"),c();return}if(e==="editUser"){const i=t.users.find(n=>n.id===a.userId);if(!i)return;t.userForm={mode:"edit",userId:i.id,firstName:i.firstName,lastName:i.lastName,email:i.email,password:"",confirmPassword:"",authLevel:i.authLevel,companyId:i.companyId??"",establishmentId:i.establishmentId??""},h("users"),c();return}if(e==="deleteUser"){if(!confirm("Delete this user?"))return;await f("/api/users",{action:"delete",userId:a.userId},"users"),t.selectedUserIds.delete(a.userId),await S(),r("users","success","User deleted.");return}if(e==="bulkDeleteUsers"){if(!t.selectedUserIds.size||!confirm("Delete the selected users?"))return;r("users","info","Deleting selected users..."),await f("/api/users",{action:"bulkDelete",userIds:Array.from(t.selectedUserIds)},"users"),t.selectedUserIds.clear(),await S(),r("users","success","Selected users deleted.");return}if(e==="editCompany"){const i=t.companies.find(n=>n.id===a.companyId);if(!i)return;t.companyForm={mode:"edit",companyId:i.id,name:i.name,enquiryEmail:i.enquiryEmail||""},h("companies"),c();return}if(e==="deleteCompany"){if(!confirm("Delete this company and its establishments/seat counts?"))return;r("companies","info","Deleting company..."),await f("/api/companies",{action:"deleteCompany",companyId:a.companyId},"companies"),t.selectedCompanyIds.delete(a.companyId),await S(),r("companies","success","Company deleted.");return}if(e==="bulkDeleteCompanies"){if(!t.selectedCompanyIds.size||!confirm("Delete the selected companies?"))return;r("companies","info","Deleting selected companies..."),await f("/api/companies",{action:"bulkDeleteCompanies",companyIds:Array.from(t.selectedCompanyIds)},"companies"),t.selectedCompanyIds.clear(),await S(),r("companies","success","Selected companies deleted.");return}if(e==="bulkDeleteEstablishments"){if(!t.selectedEstablishmentIds.size||!confirm("Delete the selected establishments?"))return;r("companies","info","Deleting selected establishments..."),await f("/api/companies",{action:"bulkDeleteEstablishments",establishmentIds:Array.from(t.selectedEstablishmentIds)},"companies"),t.selectedEstablishmentIds.clear(),await S(),r("companies","success","Selected establishments deleted.");return}if(e==="bulkDeleteSeatCounts"){if(!t.selectedSeatCountIds.size||!confirm("Delete the selected seat counts?"))return;r("companies","info","Deleting selected seat counts..."),await f("/api/companies",{action:"bulkDeleteSeatCounts",seatCountIds:Array.from(t.selectedSeatCountIds)},"companies"),t.selectedSeatCountIds.clear(),await S(),r("companies","success","Selected seat counts deleted.");return}if(e==="addEstablishment"){const i=prompt("Establishment name");if(!i)return;r("companies","info","Creating establishment..."),await f("/api/companies",{action:"createEstablishment",companyId:a.companyId,name:i},"companies"),await S(),r("companies","success","Establishment created.");return}if(e==="saveOpeningHours"){const i=Ti(a.establishmentId);r("companies","info","Saving opening hours..."),await f("/api/companies",{action:"updateOpeningHours",establishmentId:a.establishmentId,openingHours:i},"companies"),t.dirtyOpeningHoursEstablishmentIds.delete(a.establishmentId),await S(),r("companies","success","Opening hours updated.");return}if(e==="editEstablishment"){const n=t.companies.find(d=>d.id===a.companyId)?.establishments.find(d=>d.id===a.establishmentId);if(!n)return;const o=prompt("Establishment name",n.name);if(!o)return;r("companies","info","Saving establishment..."),await f("/api/companies",{action:"updateEstablishment",establishmentId:a.establishmentId,companyId:a.companyId,name:o},"companies"),await S(),r("companies","success","Establishment updated.");return}if(e==="deleteEstablishment"){if(!confirm("Delete this establishment and its seat counts?"))return;r("companies","info","Deleting establishment..."),await f("/api/companies",{action:"deleteEstablishment",establishmentId:a.establishmentId},"companies"),t.selectedEstablishmentIds.delete(a.establishmentId),await S(),r("companies","success","Establishment deleted.");return}if(e==="addSeatCount"){const i=Qe();if(!i)return;r("companies","info","Creating seat-count calendar..."),await f("/api/companies",{action:"createSeatCount",establishmentId:a.establishmentId,seatCount:i.seatCount,maxPartySize:i.maxPartySize,guestVisitMinutes:i.guestVisitMinutes},"companies"),await S(),r("companies","success","Seat-count calendar created.");return}if(e==="editSeatCount"){const i=Qe({seatCount:a.seatCount,maxPartySize:a.maxPartySize,guestVisitMinutes:a.guestVisitMinutes});if(!i)return;r("companies","info","Saving seat count..."),await f("/api/companies",{action:"updateSeatCount",seatCountId:a.seatCountId,establishmentId:a.establishmentId,seatCount:i.seatCount,maxPartySize:i.maxPartySize,guestVisitMinutes:i.guestVisitMinutes},"companies"),await S(),r("companies","success","Seat count updated.");return}if(e==="deleteSeatCount"){if(!confirm("Delete this seat count?"))return;r("companies","info","Deleting seat count..."),await f("/api/companies",{action:"deleteSeatCount",seatCountId:a.seatCountId},"companies"),t.selectedSeatCountIds.delete(a.seatCountId),await S(),r("companies","success","Seat count deleted.")}}async function Sa(e){if(e.dataset.pending==="true")return;e.dataset.pending="true",v(e,"success","Signing in..."),C(e,!0,"Signing in...");const a=Object.fromEntries(new FormData(e).entries());try{const i=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(a)}),n=await A(i);if(!i.ok){v(e,"error",n.error??"Unable to sign in."),C(e,!1,"Sign in"),e.dataset.pending="false";return}t.session=n.session,t.userCount=Math.max(Number(t.userCount??0),1),t.authForms.loginPassword="",h("auth"),F(Le(),{replace:!0})}catch(i){v(e,"error",i.message??"Unable to sign in."),C(e,!1,"Sign in"),e.dataset.pending="false"}}async function Ca(e){if(e.dataset.pending!=="true"){e.dataset.pending="true",v(e,"success","Sending reset link..."),C(e,!0,"Sending...");try{const a=Object.fromEntries(new FormData(e).entries());a.action="request",a.origin=window.location.origin;const i=await fetch("/api/password-reset",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(a)}),n=await A(i);if(!i.ok){v(e,"error",n.error??"Reset link could not be sent."),C(e,!1,"Send reset link"),e.dataset.pending="false";return}t.authForms.forgotEmail=a.email??"",v(e,"success",n.message??"If that email address exists, a reset link has been sent."),C(e,!1,"Send reset link"),e.dataset.pending="false"}catch(a){v(e,"error",a.message??"Reset link could not be sent."),C(e,!1,"Send reset link"),e.dataset.pending="false"}}}async function Ea(e){if(e.dataset.pending==="true")return;const a=t.authForms.resetPassword,i=t.authForms.resetConfirmPassword;if(a!==i){v(e,"error","New password and confirm password must match.");return}const n=Be();if(!n){v(e,"error","This password reset link is invalid or has expired.");return}e.dataset.pending="true",v(e,"success","Updating password..."),C(e,!0,"Saving...");try{const o=await fetch("/api/password-reset",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"reset",token:n,password:a})}),d=await A(o);if(!o.ok){v(e,"error",d.error??"Password could not be updated."),C(e,!1,"Save new password"),e.dataset.pending="false";return}t.authForms.resetPassword="",t.authForms.resetConfirmPassword="",mt(),h("passwordReset"),F("/login"),r("auth","success",d.message??"Password updated. You can sign in now.")}catch(o){v(e,"error",o.message??"Password could not be updated."),C(e,!1,"Save new password"),e.dataset.pending="false"}}async function Ia(e){const a=Object.fromEntries(new FormData(e).entries()),i=String(a.password??""),n=String(a.confirmPassword??"");if(t.userForm.mode==="create"&&i!==n){r("users","error","Password and confirm password must match.");return}if(t.userForm.mode==="edit"&&(i||n)&&i!==n){r("users","error","New password and confirm new password must match.");return}delete a.confirmPassword,a.action=t.userForm.mode==="edit"?"update":"create",t.userForm.mode==="edit"&&(a.userId=t.userForm.userId),r("users","info",t.userForm.mode==="edit"?"Saving user...":"Creating user...");const o=await f("/api/users",a,"users");t.userForm=ue(),t.selectedUserIds.clear(),t.selectedEstablishmentIds.clear(),t.selectedSeatCountIds.clear(),await S(),r("users","success",o.message??"User saved.")}async function Ta(e){const a=Object.fromEntries(new FormData(e).entries());a.action=t.companyForm.mode==="edit"?"updateCompany":"createCompany",t.companyForm.mode==="edit"&&(a.companyId=t.companyForm.companyId),r("companies","info",t.companyForm.mode==="edit"?"Saving company...":"Creating company...");const i=await f("/api/companies",a,"companies");t.companyForm=me(),t.selectedCompanyIds.clear(),t.selectedEstablishmentIds.clear(),t.selectedSeatCountIds.clear(),await S(),r("companies","success",i.message??"Company saved.")}async function Da(e){if(e.dataset.pending==="true")return;const a=Object.fromEntries(new FormData(e).entries()),i=t.widgetAvailability.find(p=>p.date===a.bookingDate),n=i?.slots.find(p=>p.time===a.bookingTime)??null,o=Number(n?.remaining??0),d=Number(a.partySize??0),l=Number(i?.maxPartySize??0),m=N();if(!a.bookingDate||!a.bookingTime){r("widget","error","Choose a day and time before booking.");return}if(!Number.isInteger(d)||d<=0){r("widget","error","Enter a valid number of people.");return}if(!n||o<=0){r("widget","error","That time is no longer available.");return}if(d>o){r("widget","error",`Only ${o} seat${o===1?"":"s"} remain for that time.`);return}if(l>0&&d>l){if(m?.companyEnquiryEmail){t.widget.enquiryPartySize=String(d),t.widget.modal="enquiry",r("widget","info",`For parties over ${l}, send an enquiry instead.`),c();return}r("widget","error",`For parties over ${l}, enquire here instead.`);return}e.dataset.pending="true",v(e,"info","Saving booking..."),C(e,!0,"Saving booking...");try{const p=await f("/api/widget",a,"widget");e.reset(),t.widget.selectedTime="",t.widget.confirmationMessage=p.message??"Your booking has been confirmed. Please check your email for the confirmation message.",t.widget.modal="confirmed",await M(),r("widget","success",p.message??"Booking confirmed.")}catch(p){v(e,"error",p.message??"Booking could not be saved."),C(e,!1,"Book selected slot"),e.dataset.pending="false"}}async function Pa(e){if(e.dataset.pending==="true")return;const a=Object.fromEntries(new FormData(e).entries());e.dataset.pending="true",v(e,"info","Sending enquiry..."),C(e,!0,"Sending enquiry...");try{const i=await f("/api/widget",a,"widget");e.reset(),t.widget.enquiryPartySize="",t.widget.modal="enquirySent",r("widget","success",i.message??"Your enquiry has been sent.")}catch(i){v(e,"error",i.message??"Enquiry could not be sent."),C(e,!1,"Send enquiry"),e.dataset.pending="false"}}async function Aa(e){if(e.dataset.pending==="true")return;const a=Object.fromEntries(new FormData(e).entries());a.action=a.bookingId?"update":"create";const i=a.bookingId?"Save booking":"Create booking",n=a.bookingId?"Saving booking...":"Creating booking...";e.dataset.pending="true",v(e,"info",n),C(e,!0,n);try{const o=await f("/api/bookings",a,"bookings");t.adminCalendar.editingBookingId="",await y(),t.widget.seatCountId===t.adminCalendar.seatCountId&&await M(),t.adminCalendar.modal="day",r("bookings","success",o.message??"Booking saved.")}catch(o){v(e,"error",o.message??"Booking could not be saved."),C(e,!1,i),e.dataset.pending="false"}}async function xa(e){const a=Object.fromEntries(new FormData(e).entries());a.action="updateOpenAiSettings",r("openaiSettings","info","Saving OpenAI settings...");const i=await f("/api/app-settings",a,"openaiSettings");t.appSettings=i.appSettings??L(),t.openAiModelDraft=t.appSettings.openAiModel,t.openAiReasoningEffortDraft=t.appSettings.openAiReasoningEffort,t.widgetEditorMaxOutputTokensDraft=String(t.appSettings.widgetEditorMaxOutputTokens),t.widgetEditorUploadLimitDraftMb=U(t.appSettings.widgetEditorUploadLimitBytes),t.widgetEditor.model=Ce($())||t.appSettings.openAiModel,t.widgetEditor.reasoningEffort=Ee($())||t.appSettings.openAiReasoningEffort,r("openaiSettings","success",i.message??"OpenAI settings updated.")}async function Ma(e){const a=Object.fromEntries(new FormData(e).entries());a.action="sendTestBookingConfirmationEmail",r("emailSettings","info","Sending test booking confirmation email...");const i=await f("/api/app-settings",a,"emailSettings");r("emailSettings","success",i.message??"Test booking confirmation email sent.")}async function Na(){if(!t.adminCalendar.seatCountId){r("bookings","error","Choose a seat-count calendar first.");return}const e=t.bookingWorkspace.searchQuery.trim();if(!e){r("bookings","error","Enter a first name, last name, email, or phone to search.");return}r("bookings","info","Searching bookings...",{processing:!0});const a=await fetch(`/api/bookings?action=search&seatCountId=${encodeURIComponent(t.adminCalendar.seatCountId)}&query=${encodeURIComponent(e)}&limit=25`),i=await A(a);if(!a.ok){r("bookings","error",i.error??"Booking search failed.");return}t.bookingWorkspace.searchResults=i.results??[],t.bookingWorkspace.searchHasRun=!0,h("bookings"),c()}async function Ba(e){e&&(r("bookings","info","Loading booking day..."),t.bookingWorkspace.activeTab="calendar",t.adminCalendar.currentMonth=G(e),t.adminCalendar.selectedDate=e,t.adminCalendar.selectedTime="",t.adminCalendar.editingBookingId="",t.adminCalendar.modal="day",await y(),h("bookings"),c())}async function La(){if(!W()){r("bookings","error","Your account cannot run booking reports.");return}if(!t.adminCalendar.seatCountId){r("bookings","error","Choose a seat-count calendar first.");return}const e=t.bookingWorkspace.report,a=new URLSearchParams({action:"report",seatCountId:t.adminCalendar.seatCountId,fromDate:e.fromDate,toDate:e.toDate});e.fromTime&&a.set("fromTime",e.fromTime),e.toTime&&a.set("toTime",e.toTime),r("bookings","info","Running booking report...",{processing:!0});const i=await fetch(`/api/bookings?${a.toString()}`),n=await A(i);if(!i.ok){r("bookings","error",n.error??"Booking report failed.");return}t.bookingWorkspace.report.results=n.bookings??[],t.bookingWorkspace.report.totalGuests=Number(n.totalGuests??0),t.bookingWorkspace.report.hasRun=!0,h("bookings"),c()}function Ra(e){const a=K();if(e==="today"){t.bookingWorkspace.report.fromDate=a,t.bookingWorkspace.report.toDate=a;return}if(e==="thisWeek"){const{start:i,end:n}=Di(a);t.bookingWorkspace.report.fromDate=i,t.bookingWorkspace.report.toDate=n;return}if(e==="thisMonth"){const i=G(a);t.bookingWorkspace.report.fromDate=be(i),t.bookingWorkspace.report.toDate=Lt(i)}}function Fa(){if(!W()){r("bookings","error","Your account cannot download booking reports.");return}const e=t.bookingWorkspace.report;if(!e.results.length){r("bookings","error","Run a report first.");return}const a=["Booking Date","Booking Time","Party Size","First Name","Last Name","Email","Phone","Notes"],i=e.results.map(m=>[m.bookingDate,D(m.bookingTime),m.partySize,m.firstName,m.lastName,m.email,m.phone,m.notes??""]),n=[a,...i].map(m=>m.map(Ka).join(",")).join(`\r
`),o=new Blob([n],{type:"text/csv;charset=utf-8"}),d=URL.createObjectURL(o),l=document.createElement("a");l.href=d,l.download=Va(),document.body.append(l),l.click(),l.remove(),URL.revokeObjectURL(d),r("bookings","success","CSV downloaded.")}async function Wa(e){const a=J(),i=ee();if(!a){r("widgetEditor","error","Choose an establishment first.");return}if(!t.widgetEditor.attachments.length&&!confirm("No reference files are attached. Continue and generate CSS from the prompt only?")){r("widgetEditor","info","Generation cancelled. Add files if you want visual references.");return}const n=Object.fromEntries(new FormData(e).entries());n.action="generateWidgetCss",n.establishmentId=t.widgetEditor.establishmentId,n.currentCss=t.widgetEditor.draftCss,n.currentContentText=t.widgetEditor.draftContentText,n.reasoningEffort=t.widgetEditor.reasoningEffort,n.requestText=t.widgetEditor.prompt,n.attachments=t.widgetEditor.attachments,n.useSavedCssBaseline=t.widgetEditor.useSavedBaseline;try{r("widgetEditor","info",t.widgetEditor.useSavedBaseline?"Generating CSS from the latest saved baseline...":"Generating CSS from the current draft...",{processing:!0});const o=await f("/api/widget-editor",n,"widgetEditor");t.widgetEditor.draftCss=o.cssText??"",typeof o.contentText=="string"&&(t.widgetEditor.draftContentText=o.contentText),t.widgetEditor.lastGeneratedModel=o.model??n.model??"",t.widgetEditor.model=n.model??t.widgetEditor.model,t.widgetEditor.useSavedBaseline&&(t.widgetEditor.prompt=""),r("widgetEditor","success",o.message??`${i.generatedLabel} generated${t.widgetEditor.lastGeneratedModel?` with ${t.widgetEditor.lastGeneratedModel}`:""}.`)}finally{ut()}}async function qa(e){const a=J(),i=ee();if(!a){r("widgetEditor","error","Choose an establishment first.");return}const n=Object.fromEntries(new FormData(e).entries());n.action="saveWidgetCss",n.establishmentId=t.widgetEditor.establishmentId,n.cssText=t.widgetEditor.draftCss,n.contentText=t.widgetEditor.draftContentText,r("widgetEditor","info",`Saving ${i.savedLabel}...`,{processing:!0});const o=await f("/api/widget-editor",n,"widgetEditor");await S(),t.widgetEditor.draftCss=o.theme?.cssText??t.widgetEditor.draftCss,typeof o.theme?.contentText=="string"&&(t.widgetEditor.draftContentText=o.theme.contentText),r("widgetEditor","success",o.message??`${i.savedLabel} saved.`)}async function Ua(){const e=t.widgetEditor.promptName.trim(),a=t.widgetEditor.prompt.trim();if(!e){r("widgetEditor","error","Enter a prompt name first.");return}if(!a){r("widgetEditor","error","Enter prompt text first.");return}const i={action:"savePrompt",widgetKey:$(),promptId:t.widgetEditor.selectedPromptId,name:e,promptText:a};r("widgetEditor","info",t.widgetEditor.selectedPromptId?"Updating saved prompt...":"Saving prompt...",{processing:!0});const n=await f("/api/widget-editor",i,"widgetEditor");t.widgetEditor.savedPrompts=It(t.widgetEditor.savedPrompts,n.prompts,$()),n.prompt?.id&&(t.widgetEditor.selectedPromptId=n.prompt.id,t.widgetEditor.promptName=n.prompt.name??e,t.widgetEditor.prompt=n.prompt.promptText??a),r("widgetEditor","success",n.message??"Prompt saved.")}async function Oa(e){const a=he().find(n=>n.id===e);if(!a||!confirm(`Delete saved prompt "${a.name}"?`))return;r("widgetEditor","info","Deleting saved prompt...",{processing:!0});const i=await f("/api/widget-editor",{action:"deletePrompt",widgetKey:$(),promptId:e},"widgetEditor");t.widgetEditor.savedPrompts=It(t.widgetEditor.savedPrompts,i.prompts,$()),t.widgetEditor.selectedPromptId===e&&Et({preservePrompt:!1}),r("widgetEditor","success",i.message??"Prompt deleted.")}async function ct(e,a={}){const i=a.append===!0,n=a.sourceLabel??"uploaded",o=t.appSettings.widgetEditorUploadLimitBytes,d=U(o);if(!e?.length){i||ut();return}const l=Array.from(e),m=t.widgetEditor.attachments.reduce((w,b)=>w+Ha(b.dataUrl),0),p=l.reduce((w,b)=>w+Number(b.size||0),0);if(m+p>o){r("widgetEditor","error",`Keep uploaded reference files under roughly ${d} MB total.`);return}r("widgetEditor","info",`Loading ${n} reference files...`,{processing:!0});const g=await Promise.all(l.map(async w=>({name:w.name,mimeType:w.type||"application/octet-stream",kind:w.type.startsWith("image/")?"image":"file",dataUrl:await ti(w)})));t.widgetEditor.attachments=i?[...t.widgetEditor.attachments,...g]:g,r("widgetEditor","success",`${t.widgetEditor.attachments.length} reference file${t.widgetEditor.attachments.length===1?"":"s"} ready.`)}function ut(){t.widgetEditor.attachments=[];const e=document.querySelector("[data-widget-editor-files]");e&&(e.value="")}function za(e){if(!e?.items?.length)return[];const a=[];for(const i of Array.from(e.items)){if(i.kind!=="file")continue;const n=i.getAsFile();if(n){const o=n.name||ja(n.type);a.push(new File([n],o,{type:n.type||"application/octet-stream"}))}}return a}function ja(e){return e==="image/png"?`pasted-screenshot-${Date.now()}.png`:e==="image/jpeg"?`pasted-image-${Date.now()}.jpg`:`pasted-file-${Date.now()}`}function Ha(e){const[,a=""]=String(e??"").split(",",2);return Math.floor(a.length*3/4)}function U(e){return(Number(e??0)/1e6).toFixed(1).replace(/\.0$/,"")}function Va(){const e=t.bookingWorkspace.report,a=e.fromDate||"report",i=e.toDate||a;return`bookings-${a}-to-${i}.csv`}function _a(e){const a=new Map;for(const i of e){const n=String(i.bookingDate??""),o=a.get(n)??{date:n,label:Ga(n),bookings:0,guests:0};o.bookings+=1,o.guests+=Number(i.partySize??0),a.set(n,o)}return Array.from(a.values()).sort((i,n)=>i.date.localeCompare(n.date))}function Ga(e){const a=Date.parse(`${e}T00:00:00Z`);return a?new Intl.DateTimeFormat("en-AU",{weekday:"short",timeZone:"UTC"}).format(new Date(a)):""}function Ka(e){const a=String(e??"");return/[",\r\n]/.test(a)?`"${a.replace(/"/g,'""')}"`:a}async function Ja(){await fetch("/api/logout",{method:"POST"}),t.session=null,t.users=[],t.companies=[],t.appSettings=L(),t.emailTestDraft=vt(),t.authForms=yt(),t.openAiModelDraft=t.appSettings.openAiModel,t.openAiReasoningEffortDraft=t.appSettings.openAiReasoningEffort,t.widgetEditorMaxOutputTokensDraft=String(t.appSettings.widgetEditorMaxOutputTokens),t.widgetEditorUploadLimitDraftMb=U(t.appSettings.widgetEditorUploadLimitBytes),t.adminAvailability=[],t.selectedUserIds.clear(),t.selectedCompanyIds.clear(),t.selectedEstablishmentIds.clear(),t.selectedSeatCountIds.clear(),t.userForm=ue(),t.companyForm=me(),t.bookingWorkspace=ht(),t.widgetEditor=kt(),t.adminCalendar.selectedDate="",t.adminCalendar.selectedTime="",t.adminCalendar.modal=null,t.adminCalendar.editingBookingId="",await De(),r("auth","success","Signed out."),F("/login")}async function S(){await De(),P()?(await q(),await y()):(t.users=[],t.companies=[],t.adminAvailability=[]),R(),_(),c()}async function M(e={}){return Ya(e)}async function Ya(e={}){const a=e.silent===!0;if(!t.widget.seatCountId){t.widgetAvailability=[],t.widget.selectedDate="",t.widget.selectedTime="",t.widget.modal=null;return}a||r("widget","info","Loading availability...");const i=be(t.widget.currentMonth),n=_e(t.widget.currentMonth),o=await fetch(`/api/widget?action=availability&seatCountId=${encodeURIComponent(t.widget.seatCountId)}&fromDate=${encodeURIComponent(i)}&days=${n}`),d=await A(o);if(!o.ok){t.widgetAvailability=[],t.widget.modal=null,r("widget","error",d.error??"Availability could not be loaded.");return}t.widgetAvailability=d.dates??[],a||h("widget"),t.widgetAvailability.find(m=>m.date===t.widget.selectedDate)||(t.widget.selectedDate=t.widgetAvailability[0]?.date??"",t.widget.selectedTime="",t.widget.modal=null);const l=t.widgetAvailability.find(m=>m.date===t.widget.selectedDate);l&&!l.canBook&&(t.widget.selectedTime="",t.widget.modal=null),l&&!l.slots.some(m=>m.time===t.widget.selectedTime&&m.available)&&(t.widget.selectedTime="",t.widget.modal==="details"&&(t.widget.modal="time"))}async function y(e={}){const a=e.silent===!0;if(!t.adminCalendar.seatCountId||!P()){t.adminAvailability=[],t.adminCalendar.selectedDate="",t.adminCalendar.selectedTime="",t.adminCalendar.modal=null,t.adminCalendar.editingBookingId="";return}a||r("bookings","info","Loading booking calendar...",{processing:!0});const i=be(t.adminCalendar.currentMonth),n=_e(t.adminCalendar.currentMonth),o=await fetch(`/api/bookings?action=calendar&seatCountId=${encodeURIComponent(t.adminCalendar.seatCountId)}&fromDate=${encodeURIComponent(i)}&days=${n}`),d=await A(o);if(!o.ok){t.adminAvailability=[],r("bookings","error",d.error??"Booking calendar could not be loaded.");return}t.adminAvailability=d.dates??[],a||h("bookings"),t.adminAvailability.find(l=>l.date===t.adminCalendar.selectedDate)||(t.adminCalendar.selectedDate="",t.adminCalendar.selectedTime="",t.adminCalendar.editingBookingId="",t.adminCalendar.modal=null)}function Me(){const e=document.visibilityState==="visible"&&location.pathname==="/widget"&&!!t.widget.seatCountId&&!t.widget.modal&&!Xa(),a=Za(),i=document.visibilityState==="visible"&&location.pathname==="/settings"&&P()&&!!t.adminCalendar.seatCountId&&!a&&t.dirtyOpeningHoursEstablishmentIds.size===0;e&&!Q&&(Q=setInterval(()=>{we||(we=!0,M({silent:!0}).then(()=>c()).catch(()=>{}).finally(()=>{we=!1}))},4e3)),!e&&Q&&(clearInterval(Q),Q=null),i&&!Z&&(Z=setInterval(()=>{ye||(ye=!0,y({silent:!0}).then(()=>c()).catch(()=>{}).finally(()=>{ye=!1}))},4e3)),!i&&Z&&(clearInterval(Z),Z=null)}function Se(){x()&&(ae&&cancelAnimationFrame(ae),ae=requestAnimationFrame(()=>{ae=null,Qa()}))}function Qa(){if(!x()||window.parent===window)return;const e=document.querySelector(".widget-theme-root")??document.querySelector(".page-view-theme-root")??document.querySelector("#app"),a=document.querySelector(".widget-modal-backdrop"),i=e?window.getComputedStyle(e):null,n=i?(Number.parseFloat(i.marginTop)||0)+(Number.parseFloat(i.marginBottom)||0):0,o=e?Math.ceil(e.getBoundingClientRect().height+n):0,d=a?Math.ceil(window.innerHeight):0,l=Math.ceil(Math.max(document.documentElement.offsetHeight,document.body.offsetHeight,document.documentElement.clientHeight,document.body.clientHeight)),m=Math.max(e?o:l,l,d);window.parent.postMessage({type:"booking-widget:height",height:m},"*")}function Za(){if(location.pathname!=="/settings")return!1;const e=document.activeElement;return e instanceof HTMLElement?!!e.closest("input, select, textarea"):!1}function Xa(){if(location.pathname!=="/widget")return!1;const e=document.activeElement;return e instanceof HTMLElement?!!e.closest(".widget-form input, .widget-form select, .widget-form textarea"):!1}async function f(e,a,i){h(i);const n=await fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(a)}),o=await A(n);if(!n.ok)throw r(i,"error",o.error??"Request failed."),new Error(o.error??"Request failed.");return o}async function A(e){return(e.headers.get("content-type")??"").includes("application/json")?e.json():{error:await e.text()||`Request failed with status ${e.status}.`}}function Ne(){if(!ei())return;const e=Be();if(!e){mt(),pt()||h("passwordReset");return}t.authForms.resetTokenChecked===e&&(t.authForms.resetTokenStatus==="loading"||t.authForms.resetTokenStatus==="valid"||t.authForms.resetTokenStatus==="invalid")||(t.authForms.resetTokenChecked=e,t.authForms.resetTokenStatus="loading",t.authForms.resetTokenError="",fetch(`/api/password-reset?action=validate&token=${encodeURIComponent(e)}`).then(a=>A(a).then(i=>({response:a,data:i}))).then(({response:a,data:i})=>{t.authForms.resetTokenStatus=a.ok?"valid":"invalid",t.authForms.resetTokenError=a.ok?"":i.error??"This password reset link is invalid or has expired.",c()}).catch(()=>{t.authForms.resetTokenStatus="invalid",t.authForms.resetTokenError="This password reset link could not be verified.",c()}))}function mt(){t.authForms.resetTokenChecked="",t.authForms.resetTokenStatus="idle",t.authForms.resetTokenError=""}function ei(e=location.pathname){return e==="/login"||e==="/"}function pt(){return!gt()&&new URLSearchParams(location.search).get("forgot")==="1"}function gt(){return!!Be()}function Be(){const e=new URLSearchParams(location.search).get("resetToken")??"";return/^[A-Za-z0-9_-]{20,200}$/.test(e)?e:""}function ti(e){return new Promise((a,i)=>{const n=new FileReader;n.onload=()=>a(String(n.result??"")),n.onerror=()=>i(new Error(`Could not read ${e.name}.`)),n.readAsDataURL(e)})}function ce(){return!t.session||location.pathname!=="/login"&&location.pathname!=="/"?!1:(history.replaceState({},"",Le()),!0)}function Le(){return P()?"/settings":"/widget"}function x(e=location.pathname){return e==="/widget"||e==="/page-view"}function $(e=location.pathname){return e==="/page-view-editor"?"booking_page_view":"booking_calendar"}function E(){return t.session?.authLevel==="admin"}function T(){return t.session?.authLevel==="manager"}function te(){return t.session?.authLevel==="staff"}function P(){return E()||T()||te()}function W(){return E()||T()}function de(){return E()||T()}function ai(){return location.pathname==="/settings"&&(T()||te())}function ii(){return location.pathname==="/settings"&&t.userCount>0&&!P()}function ni(){return(location.pathname==="/widget-setup"||location.pathname==="/widget-editor")&&t.userCount>0&&!E()}function ft(e){return e instanceof HTMLInputElement||e instanceof HTMLSelectElement||e instanceof HTMLTextAreaElement?e.closest("[data-user-form]")?(si(e.name,e.value),!0):e.closest("[data-company-form]")&&(e.name==="name"||e.name==="enquiryEmail")?(t.companyForm[e.name]=e.value,!0):!1:!1}function si(e,a){!e||!(e in t.userForm)||(t.userForm[e]=a)}function oi(){try{const e=localStorage.getItem(Ze),a=e?JSON.parse(e):{};return a&&typeof a=="object"?a:{}}catch{return{}}}function ri(e,a){if(e){t.sectionPanels[e]=a;try{localStorage.setItem(Ze,JSON.stringify(t.sectionPanels))}catch{}}}function Ce(e){if(!e)return"";try{return String(localStorage.getItem(`${Xe}${e}`)??"").trim()}catch{return""}}function Je(e){try{const a=localStorage.getItem(`${tt}${e}`);return a===null?!1:a==="true"}catch{return!1}}function Ee(e){if(!e)return"";try{return String(localStorage.getItem(`${et}${e}`)??"").trim()}catch{return""}}function di(e,a){try{localStorage.setItem(`${Xe}${e}`,String(a??"").trim())}catch{}}function li(e,a){try{localStorage.setItem(`${et}${e}`,String(a??"").trim())}catch{}}function ci(e,a){try{localStorage.setItem(`${tt}${e}`,a?"true":"false")}catch{}}function ue(){return{mode:"create",userId:null,firstName:"",lastName:"",email:"",password:"",confirmPassword:"",authLevel:"user",companyId:"",establishmentId:""}}function me(){return{mode:"create",companyId:null,name:"",enquiryEmail:""}}function ht(){return{activeTab:"calendar",searchQuery:"",searchResults:[],searchHasRun:!1,report:{...bt(),results:[],totalGuests:0,hasRun:!1}}}function bt(){const e=K(),a=G(e);return{fromDate:be(a),toDate:Lt(a),fromTime:"",toTime:""}}function L(){return{openAiModel:"gpt-5.4-nano",openAiReasoningEffort:"",widgetEditorMaxOutputTokens:25e3,widgetEditorUploadLimitBytes:25e5,emailSettings:wt()}}function wt(){return{configured:!1,host:"",port:"",secure:!0,user:"",fromAddress:"",missingEnvVars:["SMTP_HOST","SMTP_PORT","SMTP_USER","SMTP_PASS"]}}function yt(){return{loginEmail:"",loginPassword:"",forgotEmail:"",resetPassword:"",resetConfirmPassword:"",resetTokenChecked:"",resetTokenStatus:"idle",resetTokenError:""}}function vt(){return{recipientEmail:"",firstName:"Jordan",lastName:"Taylor",guestEmail:"jordan.taylor@example.com",phone:"+61 400 123 456",establishmentName:"Main Dining Room",bookingDate:K(),bookingTime:"19:00",partySize:"4",notes:"Window table if available. Celebrating a birthday."}}function kt(){return{companyId:"",establishmentId:"",model:"gpt-5.4-nano",reasoningEffort:"",activeKey:"",useSavedBaseline:!1,themeDrafts:ui(),promptName:"",prompt:"",selectedPromptId:"",savedPrompts:[],draftContentText:"",draftCss:"",attachments:[],lastGeneratedModel:""}}function ui(){return{booking_calendar:Ie(),booking_page_view:Ie()}}function Ie(){return{promptName:"",prompt:"",selectedPromptId:"",draftContentText:"",attachments:[],lastGeneratedModel:""}}function r(e,a,i,n={}){t.statuses[e]=i?{kind:a,message:i,processing:n.processing===!0}:null,c()}function h(e){t.statuses[e]=null}function I(e){const a=t.statuses[e],i=a?.kind==="error"?"assertive":"polite";return`<div class="status ${a?.kind??""}" role="status" aria-live="${i}" aria-atomic="true">${s(a?.message??"")}</div>`}function $t(e){return t.statuses[e]?.processing===!0}function v(e,a,i){const n=e.querySelector(".status");n&&(n.className=`status ${a??""}`.trim(),n.textContent=i??"")}function C(e,a,i){const n=e.querySelector('button[type="submit"]');n&&(n.disabled=a,n.setAttribute("aria-disabled",a?"true":"false"),n.textContent=i,e.setAttribute("aria-busy",a?"true":"false"))}function Re(){const e=O(),a=t.filters.users.trim().toLowerCase();if(!a)return t.users;if(e.filteredUsersTerm===a)return e.filteredUsersResult;const i=t.users.filter(n=>[n.firstName,n.lastName,n.email,n.authLevel,e.companyNamesById.get(n.companyId)?.toLowerCase()??"",e.establishmentsById.get(n.establishmentId)?.name?.toLowerCase()??""].join(" ").toLowerCase().includes(a));return e.filteredUsersTerm=a,e.filteredUsersResult=i,i}function Fe(){const e=O(),a=t.filters.companies.trim().toLowerCase();if(!a)return t.companies;if(e.filteredCompaniesTerm===a)return e.filteredCompaniesResult;const i=t.companies.filter(n=>{const o=n.establishments.flatMap(l=>l.seatCounts.map(m=>String(m.seatCount))).join(" "),d=n.establishments.map(l=>l.name).join(" ");return`${n.name} ${d} ${o}`.toLowerCase().includes(a)});return e.filteredCompaniesTerm=a,e.filteredCompaniesResult=i,i}function Ye(e,a){const i=e==="users"?Re().map(o=>o.id):Fe().map(o=>o.id),n=e==="users"?t.selectedUserIds:t.selectedCompanyIds;a?i.forEach(o=>n.add(o)):i.forEach(o=>n.delete(o))}function Te(e){const a=e==="users"?Re().map(n=>n.id):Fe().map(n=>n.id),i=e==="users"?t.selectedUserIds:t.selectedCompanyIds;return a.length>0&&a.every(n=>i.has(n))}function ie(e,a,i){i?e.add(a):e.delete(a)}function St(){const e=new Set(t.users.map(o=>o.id)),a=new Set(t.companies.map(o=>o.id)),i=new Set(t.companies.flatMap(o=>o.establishments.map(d=>d.id))),n=new Set(t.companies.flatMap(o=>o.establishments.flatMap(d=>d.seatCounts.map(l=>l.id))));t.selectedUserIds=new Set(Array.from(t.selectedUserIds).filter(o=>e.has(o))),t.selectedCompanyIds=new Set(Array.from(t.selectedCompanyIds).filter(o=>a.has(o))),t.selectedEstablishmentIds=new Set(Array.from(t.selectedEstablishmentIds).filter(o=>i.has(o))),t.selectedSeatCountIds=new Set(Array.from(t.selectedSeatCountIds).filter(o=>n.has(o)))}function mi(){return O().allEstablishments}function pi(e){return O().companyNamesById.get(e)??""}function We(e){if(!e)return"";const a=O().establishmentsById.get(e);return a?`${a.companyName} | ${a.name}`:""}function O(){if(k.companiesRef===t.companies&&k.usersRef===t.users)return k;const e=t.companies.flatMap(o=>o.establishments.map(d=>({...d,companyName:o.name}))),a=new Map(t.companies.map(o=>[o.id,o.name])),i=new Map(e.map(o=>[o.id,o])),n=new Map;return t.users.forEach(o=>{const d=n.get(o.companyId)??[];d.push(o),n.set(o.companyId,d)}),k.companiesRef=t.companies,k.usersRef=t.users,k.allEstablishments=e,k.companyNamesById=a,k.establishmentsById=i,k.usersByCompanyId=n,k.filteredUsersTerm=null,k.filteredUsersResult=[],k.filteredCompaniesTerm=null,k.filteredCompaniesResult=[],k}function le(){const e=Ue();if(!e.length){t.widgetSetup={companyId:"",establishmentId:"",seatCountId:""};return}e.some(n=>n.id===t.widgetSetup.companyId)||(t.widgetSetup.companyId=e[0].id);const a=ge();a.some(n=>n.id===t.widgetSetup.establishmentId)||(t.widgetSetup.establishmentId=a[0]?.id??"");const i=qe();i.some(n=>n.id===t.widgetSetup.seatCountId)||(t.widgetSetup.seatCountId=i[0]?.id??"")}function R(){const e=$(),a=t.widgetEditor.activeKey,i=t.widgetEditor.establishmentId;a&&a!==e&&gi(a),a!==e&&fi(e);const n=Oe();if(!n.length){t.widgetEditor.companyId="",t.widgetEditor.establishmentId="",t.widgetEditor.activeKey=e,t.widgetEditor.draftContentText="",t.widgetEditor.draftCss="",t.widgetEditor.attachments=[],t.widgetEditor.model=Ce(e)||t.appSettings.openAiModel,t.widgetEditor.reasoningEffort=Ee(e)||t.appSettings.openAiReasoningEffort,t.widgetEditor.useSavedBaseline=Je(e);return}n.some(b=>b.id===t.widgetEditor.companyId)||(t.widgetEditor.companyId=n[0].id);const o=ze();o.some(b=>b.id===t.widgetEditor.establishmentId)||(t.widgetEditor.establishmentId=o[0]?.id??"");const d=J(),l=Pt(d,e),m=Ve(d,e),p=At(d,e);(!t.widgetEditor.draftCss&&!t.widgetEditor.draftContentText||i!==d?.id||a!==e)&&(t.widgetEditor.draftContentText=l,t.widgetEditor.draftCss=m);const u=Ce(e),g=Ee(e),w=Je(e);(!t.widgetEditor.model||a!==e)&&(t.widgetEditor.model=u||t.appSettings.openAiModel),a!==e&&(t.widgetEditor.reasoningEffort=g||t.appSettings.openAiReasoningEffort),a!==e||i!==d?.id?t.widgetEditor.useSavedBaseline=p?w:!1:!p&&t.widgetEditor.useSavedBaseline&&(t.widgetEditor.useSavedBaseline=!1),t.widgetEditor.activeKey=e,t.widgetEditor.selectedPromptId&&!he().some(b=>b.id===t.widgetEditor.selectedPromptId)&&(t.widgetEditor.selectedPromptId="",t.widgetEditor.promptName="")}function gi(e){const a=Ct(e);a.promptName=t.widgetEditor.promptName,a.prompt=t.widgetEditor.prompt,a.selectedPromptId=t.widgetEditor.selectedPromptId,a.draftContentText=t.widgetEditor.draftContentText,a.attachments=t.widgetEditor.attachments.map(i=>({...i})),a.lastGeneratedModel=t.widgetEditor.lastGeneratedModel}function fi(e){const a=Ct(e);t.widgetEditor.promptName=a.promptName,t.widgetEditor.prompt=a.prompt,t.widgetEditor.selectedPromptId=a.selectedPromptId,t.widgetEditor.draftContentText=a.draftContentText,t.widgetEditor.attachments=a.attachments.map(i=>({...i})),t.widgetEditor.lastGeneratedModel=a.lastGeneratedModel}function Ct(e){return t.widgetEditor.themeDrafts[e]||(t.widgetEditor.themeDrafts[e]=Ie()),t.widgetEditor.themeDrafts[e]}function X(){const e=je();if(!e.length){t.adminCalendar.companyId="",t.adminCalendar.establishmentId="",t.adminCalendar.seatCountId="",t.adminAvailability=[],H({resetFilters:!0});return}e.some(n=>n.id===t.adminCalendar.companyId)||(t.adminCalendar.companyId=e[0].id);const a=He();a.some(n=>n.id===t.adminCalendar.establishmentId)||(t.adminCalendar.establishmentId=a[0]?.id??"");const i=Dt();i.some(n=>n.id===t.adminCalendar.seatCountId)||(t.adminCalendar.seatCountId=i[0]?.id??"",H())}function H(e={}){t.bookingWorkspace.searchResults=[],t.bookingWorkspace.searchHasRun=!1,t.bookingWorkspace.report.results=[],t.bookingWorkspace.report.totalGuests=0,t.bookingWorkspace.report.hasRun=!1,e.resetFilters===!0&&(t.bookingWorkspace.searchQuery="",t.bookingWorkspace.report={...bt(),results:[],totalGuests:0,hasRun:!1})}function hi(e){const a=he().find(i=>i.id===e);a&&(t.widgetEditor.selectedPromptId=a.id,t.widgetEditor.promptName=a.name,t.widgetEditor.prompt=a.promptText,r("widgetEditor","info",`Loaded prompt "${a.name}".`))}function Et(e={}){const a=e.preservePrompt!==!1;t.widgetEditor.selectedPromptId="",t.widgetEditor.promptName="",a||(t.widgetEditor.prompt=""),h("widgetEditor")}function se(e){return Array.isArray(e)?e.map(a=>({id:String(a?.id??""),widgetKey:String(a?.widgetKey??""),name:String(a?.name??"").trim(),promptText:String(a?.promptText??""),updatedAt:a?.updatedAt??null})).filter(a=>a.id&&a.name).sort((a,i)=>{const n=Date.parse(a.updatedAt??"")||0;return(Date.parse(i.updatedAt??"")||0)-n||a.name.localeCompare(i.name)}):[]}function It(e,a,i){const n=se(e),o=se(a);return se([...n.filter(d=>d.widgetKey!==i),...o])}function bi(e){const a=String(e??"").replace(/\s+/g," ").trim();return a.length<=180?a:`${a.slice(0,177)}...`}function wi(e){const a=Date.parse(String(e??""));return a?`Updated ${new Intl.DateTimeFormat("en-AU",{day:"2-digit",month:"short",year:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(a))}`:"Saved prompt"}function _(){const e=pe();if(!x())return;if(t.widget.seatCountId=e,fe(e)){t.widget.currentMonth||(t.widget.currentMonth=G(K())),M().then(c);return}t.widgetAvailability=[],t.widget.selectedDate="",t.widget.selectedTime="",t.widget.modal=null}function pe(){return new URLSearchParams(location.search).get("seatCountId")??""}function ge(){return Ue().find(a=>a.id===t.widgetSetup.companyId)?.establishments??[]}function qe(){return(ge().find(a=>a.id===t.widgetSetup.establishmentId)?.seatCounts??[]).map(a=>({...a,label:V(a)}))}function Tt(){return`${location.origin}/widget?seatCountId=${encodeURIComponent(t.widgetSetup.seatCountId)}`}function yi(){return`${location.origin}/page-view?seatCountId=${encodeURIComponent(t.widgetSetup.seatCountId)}`}function vi(){return qe().find(e=>e.id===t.widgetSetup.seatCountId)?.label??""}function ki(){return ge().find(e=>e.id===t.widgetSetup.establishmentId)?.name}function fe(e){for(const a of $i())for(const i of a.establishments)for(const n of i.seatCounts)if(n.id===e)return{...n,label:V(n),companyName:a.name,companyEnquiryEmail:a.enquiryEmail||"",establishmentName:i.name,establishmentLabel:`${a.name} | ${i.name}`,widgetThemeCss:i.widgetTheme?.cssText??"",pageViewThemeCss:i.pageViewTheme?.cssText??"",pageViewThemeContentText:i.pageViewTheme?.contentText??""};return null}function Ue(){return t.companies.length?t.companies:t.widgetCatalog}function Oe(){return t.companies}function ze(){return Oe().find(a=>a.id===t.widgetEditor.companyId)?.establishments??[]}function J(){return ze().find(e=>e.id===t.widgetEditor.establishmentId)??null}function je(){return t.companies}function He(){return je().find(a=>a.id===t.adminCalendar.companyId)?.establishments??[]}function Dt(){return He().find(a=>a.id===t.adminCalendar.establishmentId)?.seatCounts??[]}function $i(){return t.widgetCatalog.length?t.widgetCatalog:t.companies}function N(){return fe(t.widget.seatCountId)}function he(){const e=$();return t.widgetEditor.savedPrompts.filter(a=>a.widgetKey===e)}function Ve(e,a=$()){return e?a==="booking_page_view"?e.pageViewTheme?.cssText??"":e.widgetTheme?.cssText??"":""}function Pt(e,a=$()){return e?a==="booking_page_view"?e.pageViewTheme?.contentText??"":e.widgetTheme?.contentText??"":""}function At(e,a=$()){return!!Ve(e,a).trim()}function xt(e=$()){const a=ee(e),n=J()?.seatCounts?.[0]?.id??"";return n?`${location.origin}${a.previewPath}?seatCountId=${encodeURIComponent(n)}`:""}function Si(e=xt()){if(!e)return"";const a=`widget-preview-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;try{localStorage.setItem(a,JSON.stringify({cssText:t.widgetEditor.draftCss??"",contentText:t.widgetEditor.draftContentText??"",createdAt:Date.now()}))}catch{return e}const i=e.includes("?")?"&":"?";return`${e}${i}previewToken=${encodeURIComponent(a)}`}function Ci(e){const a=document.createElement("a");a.href=e,a.target="_blank",a.rel="noopener noreferrer",a.style.display="none",document.body.append(a),a.click(),a.remove()}function Mt(){if(!x())return{cssText:"",contentText:""};const e=new URLSearchParams(location.search),a=String(e.get("previewToken")??"").trim();if(!a)return{cssText:"",contentText:""};try{const i=localStorage.getItem(a);if(!i)return{cssText:"",contentText:""};const n=JSON.parse(i);return Date.now()-Number(n.createdAt??0)>1e3*60*60*4?(localStorage.removeItem(a),{cssText:"",contentText:""}):{cssText:String(n.cssText??""),contentText:String(n.contentText??"")}}catch{return{cssText:"",contentText:""}}}function V(e){const a=Math.max(Number(e?.seatCount??0),0),i=Bt(e?.guestVisitMinutes),n=Math.max(Number(e?.maxPartySize??a),0);return`${a} max guests | ${i} visits | ${n} online`}function Nt(e){if(!(e instanceof HTMLInputElement))return;const a=Math.max(Number(e.dataset.maxBookablePartySize??e.max??1)||1,1),i=Number(e.value);Number.isFinite(i)&&(e.value=String(Math.min(Math.max(Math.trunc(i),1),a)))}function Ei(e){if(!(e instanceof HTMLElement))return;const a=String(e.dataset.establishmentId??"").trim();a&&(t.dirtyOpeningHoursEstablishmentIds.add(a),Me())}function Bt(e){const a=Math.max(Number(e)||0,0),i=Math.floor(a/60),n=a%60;return i?n?`${i} hr ${n} min`:`${i} hr${i===1?"":"s"}`:`${a} min`}function Qe(e={}){const a=prompt("Max capacity",String(e.seatCount??"40"));if(a===null)return null;const i=prompt("Max online booking party size",String(e.maxPartySize??e.seatCount??"40"));if(i===null)return null;const n=prompt("Guest visit time in minutes",String(e.guestVisitMinutes??"90"));return n===null?null:{seatCount:String(a).trim(),maxPartySize:String(i).trim(),guestVisitMinutes:String(n).trim()}}function Ii(){for(const e of t.adminAvailability)for(const a of e.slots)for(const i of a.bookings??[])if(i.id===t.adminCalendar.editingBookingId)return i;return null}function j(e){const a=Ii();return a?a[e]??"":""}function Ti(e){return Array.from({length:7},(a,i)=>{const n=document.querySelector(`[data-hours-open][data-establishment-id="${e}"][data-weekday="${i}"]`),o=document.querySelector(`[data-hours-start][data-establishment-id="${e}"][data-weekday="${i}"]`),d=document.querySelector(`[data-hours-end][data-establishment-id="${e}"][data-weekday="${i}"]`);return{weekdayIndex:i,isOpen:!!n?.checked,openTime:o?.value??"",closeTime:d?.value??""}})}function G(e){return e.slice(0,7)}function Y(e){const[a,i]=e.split("-").map(Number);return{year:a,monthIndex:i-1}}function be(e){return`${e}-01`}function Lt(e){const{year:a,monthIndex:i}=Y(e);return Ge(a,i,_e(e))}function Di(e){const a=new Date(`${e}T00:00:00Z`),i=(a.getUTCDay()+6)%7;a.setUTCDate(a.getUTCDate()-i);const n=a.toISOString().slice(0,10);a.setUTCDate(a.getUTCDate()+6);const o=a.toISOString().slice(0,10);return{start:n,end:o}}function _e(e){const{year:a,monthIndex:i}=Y(e);return new Date(Date.UTC(a,i+1,0)).getUTCDate()}function ne(e,a){const{year:i,monthIndex:n}=Y(e),o=new Date(Date.UTC(i,n+a,1));return`${o.getUTCFullYear()}-${String(o.getUTCMonth()+1).padStart(2,"0")}`}function Rt(e){const{year:a,monthIndex:i}=Y(e);return new Intl.DateTimeFormat("en-AU",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(a,i,1)))}function Ge(e,a,i){return`${e}-${String(a+1).padStart(2,"0")}-${String(i).padStart(2,"0")}`}function K(){const e=new Date,a=e.getTimezoneOffset();return new Date(e.getTime()-a*6e4).toISOString().slice(0,10)}function Ft(e){const a=Math.max(0,Math.min(1,Number(e)||0));return Math.sqrt(a)}function Wt(e){if(!e)return{caption:"Check",className:"is-closed status-unavailable",rawSeatLoad:0,seatLoad:0,status:"unavailable"};if(e.isBlocked)return{caption:"Bookings closed",className:"is-closed status-closed",rawSeatLoad:1,seatLoad:1,status:"bookings-closed"};if(!e.isOpen)return{caption:"Closed",className:"is-closed status-closed",rawSeatLoad:0,seatLoad:0,status:"closed"};const a=Pi(e),i=Math.max(Number(e.capacity??0),0),n=Math.max(Number(e.remaining??0),0),o=Math.max(Number(e.availableSlotCount??0),0),d=i>0?1-n/i:0,l=Ft(d);return o<=0||n<=0||d>=1?{caption:a,className:"is-full status-full",rawSeatLoad:d,seatLoad:l,status:"full"}:d===0?{caption:a,className:"has-availability status-open",rawSeatLoad:d,seatLoad:l,status:"open"}:d<.35?{caption:a,className:"has-availability status-filling",rawSeatLoad:d,seatLoad:l,status:"filling"}:d<.75?{caption:a,className:"has-availability status-busy",rawSeatLoad:d,seatLoad:l,status:"busy"}:{caption:a,className:"has-availability status-nearly-full",rawSeatLoad:d,seatLoad:l,status:"nearly-full"}}function Pi(e){const a=String(e?.openTime??"").trim(),i=String(e?.closeTime??"").trim();return a&&i?xi(a,i):"Open"}function Ai(e){if(!e?.available)return{className:"status-full",rawSeatLoad:1,seatLoad:1,status:"full"};const a=e.capacity>0?1-(e.remaining??e.capacity)/e.capacity:0,i=Ft(a);return a===0?{className:"status-open",rawSeatLoad:a,seatLoad:i,status:"open"}:a<.35?{className:"status-filling",rawSeatLoad:a,seatLoad:i,status:"filling"}:a<.75?{className:"status-busy",rawSeatLoad:a,seatLoad:i,status:"busy"}:{className:"status-nearly-full",rawSeatLoad:a,seatLoad:i,status:"nearly-full"}}function D(e){const a=String(e??"").trim(),i=a.match(/^(\d{2}):(\d{2})$/);if(!i)return a;const n=Number(i[1]),o=i[2];if(n>23)return a;const d=n>=12?"PM":"AM";return`${n%12||12}:${o} ${d}`}function xi(e,a){const i=D(e),n=D(a);return i&&n?`${i} - ${n}`:i||n}function s(e){return String(e??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}function Mi(e){return String(e??"").replaceAll("</style","<\\/style")}Ut().catch(()=>{r("auth","error","Unable to load the app.")});
