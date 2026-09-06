(() => {
  "use strict";

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
  window.gtag("consent", "default", {
    ad_personalization: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    analytics_storage: "denied",
    functionality_storage: "denied",
    personalization_storage: "denied",
    security_storage: "granted",
    wait_for_update: 500,
  });
  window.gtag("set", "ads_data_redaction", true);
  window.gtag("set", "url_passthrough", false);

  const GPC = navigator.globalPrivacyControl === true;
  let veil;

  function consentMarkup() {
    return `
      <aside class="why-consent-veil" id="whyConsentVeil" aria-label="Privacy choices" hidden>
        <div class="why-consent-row">
          <p class="why-consent-copy">
            <strong class="why-consent-mark">WHY<em>.</em></strong>
            <span>Cookies show us what keeps curiosity moving.</span>
            <a href="privacy.html">Details</a>
          </p>
          <div class="why-consent-actions">
            <button class="why-consent-button" type="button" data-why-consent="decline">No thanks</button>
            <button class="why-consent-button" type="button" data-why-consent="choose" aria-expanded="false">Choose</button>
            <button class="why-consent-button" type="button" data-why-consent="allow">Allow all</button>
          </div>
        </div>
        <div class="why-consent-options" id="whyConsentOptions">
          <label class="why-consent-option"><input id="whyConsentStatistics" type="checkbox"> Analytics</label>
          <label class="why-consent-option"><input id="whyConsentMarketing" type="checkbox"${GPC ? " disabled" : ""}> Marketing</label>
          ${GPC ? '<span class="why-consent-gpc">marketing blocked by your browser</span>' : ""}
          <button class="why-consent-save" type="button" data-why-consent="save">Save choices</button>
        </div>
      </aside>`;
  }

  function hideVeil() {
    if (!veil) return;
    veil.classList.remove("is-visible", "is-choosing");
    window.setTimeout(() => { if (!veil.classList.contains("is-visible")) veil.hidden = true; }, 280);
  }

  function syncChoices() {
    const statistics = document.querySelector("#whyConsentStatistics");
    const marketing = document.querySelector("#whyConsentMarketing");
    if (statistics) statistics.checked = Boolean(window.Cookiebot?.consent?.statistics);
    if (marketing) marketing.checked = !GPC && Boolean(window.Cookiebot?.consent?.marketing);
  }

  function showVeil(choosing = false) {
    if (!veil) return;
    window.Cookiebot?.hide?.();
    syncChoices();
    veil.hidden = false;
    veil.classList.toggle("is-choosing", choosing);
    const choose = veil.querySelector('[data-why-consent="choose"]');
    choose?.setAttribute("aria-expanded", String(choosing));
    requestAnimationFrame(() => veil.classList.add("is-visible"));
  }

  function submit(preferences, statistics, marketing) {
    if (!window.Cookiebot?.submitCustomConsent) return;
    window.Cookiebot.submitCustomConsent(Boolean(preferences), Boolean(statistics), GPC ? false : Boolean(marketing));
    window.Cookiebot.runScripts?.();
    hideVeil();
  }

  function handleChoice(choice) {
    if (choice === "decline") submit(false, false, false);
    if (choice === "allow") submit(true, true, true);
    if (choice === "choose") showVeil(!veil.classList.contains("is-choosing"));
    if (choice === "save") {
      submit(
        false,
        document.querySelector("#whyConsentStatistics")?.checked,
        document.querySelector("#whyConsentMarketing")?.checked,
      );
    }
  }

  function boot() {
    if (document.querySelector("#whyConsentVeil")) return;
    document.body.insertAdjacentHTML("beforeend", consentMarkup());
    veil = document.querySelector("#whyConsentVeil");

    document.addEventListener("click", (event) => {
      const choice = event.target.closest("[data-why-consent]")?.dataset.whyConsent;
      if (choice) handleChoice(choice);
      if (event.target.closest("[data-why-consent-open]")) showVeil(true);
    });

    if (window.Cookiebot?.hasResponse === false) showVeil();
  }

  window.WHYConsent = {
    open: () => showVeil(true),
    statisticsAllowed: () => window.Cookiebot?.consent?.statistics === true,
  };

  window.addEventListener("CookiebotOnDialogDisplay", () => {
    window.Cookiebot?.hide?.();
    showVeil();
  });
  window.addEventListener("CookiebotOnConsentReady", () => {
    if (!window.Cookiebot?.hasResponse) showVeil();
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
