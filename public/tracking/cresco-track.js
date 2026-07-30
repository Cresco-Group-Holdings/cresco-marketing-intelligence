(function (window, document) {
  "use strict";

  var SDK_VERSION = "1.0.0";
  var QUEUE = [];
  var CONFIG = null;
  var FLUSH_TIMER = null;
  var SESSION_KEY = "cresco_sid";
  var ANON_KEY = "cresco_aid";

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function storageGet(key) {
    try {
      return sessionStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      sessionStorage.setItem(key, value);
    } catch (e) {
      /* failure-safe */
    }
  }

  function parseUtm() {
    var params = new URLSearchParams(window.location.search);
    return {
      utmSource: params.get("utm_source") || undefined,
      utmMedium: params.get("utm_medium") || undefined,
      utmCampaign: params.get("utm_campaign") || undefined,
      utmTerm: params.get("utm_term") || undefined,
      utmContent: params.get("utm_content") || undefined,
    };
  }

  function consentState() {
    var globalConsent = window.__CRESCO_CONSENT__;
    if (!globalConsent || typeof globalConsent !== "object") {
      return { ESSENTIAL: true, ANALYTICS: true };
    }
    return globalConsent;
  }

  function baseEvent(eventName, properties) {
    var utm = parseUtm();
    return {
      eventId: uuid(),
      eventName: eventName,
      occurredAt: new Date().toISOString(),
      sessionId: storageGet(SESSION_KEY) || undefined,
      anonymousId: storageGet(ANON_KEY) || uuid(),
      pageUrl: window.location.href,
      referrer: document.referrer || undefined,
      utmSource: utm.utmSource,
      utmMedium: utm.utmMedium,
      utmCampaign: utm.utmCampaign,
      utmTerm: utm.utmTerm,
      utmContent: utm.utmContent,
      consent: consentState(),
      properties: properties || {},
    };
  }

  function ensureIds() {
    if (!storageGet(ANON_KEY)) storageSet(ANON_KEY, uuid());
    if (!storageGet(SESSION_KEY)) storageSet(SESSION_KEY, uuid());
  }

  function enqueue(event) {
    if (!CONFIG || !CONFIG.propertyId) return;
    QUEUE.push(event);
    if (!FLUSH_TIMER) {
      FLUSH_TIMER = setTimeout(flush, 2000);
    }
    if (QUEUE.length >= 10) flush();
  }

  function flush() {
    if (FLUSH_TIMER) {
      clearTimeout(FLUSH_TIMER);
      FLUSH_TIMER = null;
    }
    if (!CONFIG || !CONFIG.propertyId || QUEUE.length === 0) return;

    var batch = QUEUE.splice(0, 20);
    var body = JSON.stringify({
      propertyId: CONFIG.propertyId,
      sdkVersion: SDK_VERSION,
      events: batch,
    });

    if (navigator.sendBeacon && CONFIG.endpoint) {
      try {
        var blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon(CONFIG.endpoint, blob)) return;
      } catch (e) {
        /* fall through */
      }
    }

    fetch(CONFIG.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body,
      keepalive: true,
      credentials: "omit",
    }).catch(function () {
      /* failure-safe */
    });
  }

  function track(eventName, properties) {
    ensureIds();
    enqueue(baseEvent(eventName, properties));
  }

  function pageView() {
    track("page_view");
  }

  function init(options) {
    CONFIG = options || {};
    CONFIG.endpoint = CONFIG.endpoint || "/api/tracking/v1/events";
    ensureIds();
    track("session_start");
    pageView();

    window.addEventListener("click", function (event) {
      var target = event.target;
      if (!target || !target.closest) return;
      var el = target.closest("[data-cresco-track]");
      if (!el) return;
      track(el.getAttribute("data-cresco-track") || "cta_click", {
        label: el.getAttribute("data-cresco-label") || el.textContent || undefined,
        href: el.getAttribute("href") || undefined,
      });
    });

    var pushState = history.pushState;
    history.pushState = function () {
      pushState.apply(history, arguments);
      pageView();
    };
    window.addEventListener("popstate", pageView);
    window.addEventListener("beforeunload", flush);
  }

  function identify(userId) {
    if (!userId) return;
    ensureIds();
    enqueue(
      Object.assign(baseEvent("login_complete"), {
        userId: String(userId),
      }),
    );
  }

  function setConsent(state) {
    window.__CRESCO_CONSENT__ = state;
    track("custom_event", { action: "consent_updated" });
  }

  window.CrescoTrack = {
    init: init,
    track: track,
    pageView: pageView,
    identify: identify,
    setConsent: setConsent,
    flush: flush,
    version: SDK_VERSION,
  };
})(window, document);
