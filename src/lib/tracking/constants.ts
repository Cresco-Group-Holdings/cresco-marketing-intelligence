export const TRACKING_SDK_VERSION = "1.0.0";

export const STANDARD_TRACKING_EVENTS = [
  "page_view",
  "session_start",
  "cta_click",
  "outbound_click",
  "file_download",
  "form_start",
  "form_submit",
  "signup_start",
  "signup_complete",
  "email_verified",
  "login_complete",
  "trial_start",
  "demo_request",
  "subscription_start",
  "purchase",
  "report_imported",
  "company_analysed",
  "grant_viewed",
  "grant_saved",
  "grant_application_created",
  "custom_event",
] as const;

export type StandardTrackingEvent = (typeof STANDARD_TRACKING_EVENTS)[number];

export const ESSENTIAL_TRACKING_EVENTS = new Set<StandardTrackingEvent>([
  "session_start",
]);

export const ANALYTICS_TRACKING_EVENTS = new Set<StandardTrackingEvent>([
  "page_view",
  "cta_click",
  "outbound_click",
  "file_download",
  "form_start",
  "form_submit",
  "custom_event",
]);

export const TRACKING_MAX_BATCH_SIZE = 20;
export const TRACKING_MAX_EVENT_PROPERTIES = 25;
export const TRACKING_MAX_PROPERTY_KEY_LENGTH = 64;
export const TRACKING_MAX_PROPERTY_VALUE_LENGTH = 512;
export const TRACKING_MAX_EVENT_NAME_LENGTH = 64;
export const TRACKING_MAX_URL_LENGTH = 2048;
export const TRACKING_RATE_LIMIT_PER_MINUTE = 120;

export const BLOCKED_PROPERTY_KEYS = new Set([
  "email",
  "password",
  "token",
  "access_token",
  "refresh_token",
  "organisationid",
  "organisation_id",
  "projectid",
  "project_id",
  "brandid",
  "brand_id",
  "ssn",
  "credit_card",
]);

export const KNOWN_BOT_PATTERNS = [
  /googlebot/i,
  /bingbot/i,
  /slurp/i,
  /duckduckbot/i,
  /baiduspider/i,
  /yandexbot/i,
  /facebookexternalhit/i,
  /uptimerobot/i,
  /pingdom/i,
  /headlesschrome/i,
];
