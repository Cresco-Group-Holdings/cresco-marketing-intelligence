import type { ProviderAuthType } from "@prisma/client";
import { STAGE_12_OAUTH_PROVIDER_KEYS } from "@/lib/integrations/oauth/constants";

export type OAuthProviderDefinition = {
  providerKey: string;
  displayName: string;
  authType: ProviderAuthType;
  usesPkce: boolean;
  authorizationUrl: string;
  tokenUrl: string;
  revokeUrl?: string;
  defaultScopes: string[];
  optionalScopes: string[];
  accountDiscoveryTypes: string[];
  enabled: boolean;
};

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const META_AUTH = "https://www.facebook.com/v19.0/dialog/oauth";
const META_TOKEN = "https://graph.facebook.com/v19.0/oauth/access_token";
const LINKEDIN_AUTH = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_TOKEN = "https://www.linkedin.com/oauth/v2/accessToken";
const TIKTOK_AUTH = "https://www.tiktok.com/v2/auth/authorize";
const TIKTOK_TOKEN = "https://open.tiktokapis.com/v2/oauth/token";
const MICROSOFT_AUTH = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const MICROSOFT_TOKEN = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const HUBSPOT_AUTH = "https://app.hubspot.com/oauth/authorize";
const HUBSPOT_TOKEN = "https://api.hubapi.com/oauth/v1/token";
const MAILCHIMP_AUTH = "https://login.mailchimp.com/oauth2/authorize";
const MAILCHIMP_TOKEN = "https://login.mailchimp.com/oauth2/token";
const X_AUTH = "https://twitter.com/i/oauth2/authorize";
const X_TOKEN = "https://api.twitter.com/2/oauth2/token";
const SLACK_AUTH = "https://slack.com/oauth/v2/authorize";
const SLACK_TOKEN = "https://slack.com/api/oauth.v2.access";

function oauthDef(
  partial: Omit<OAuthProviderDefinition, "enabled" | "usesPkce"> & { usesPkce?: boolean },
): OAuthProviderDefinition {
  return {
    enabled: true,
    usesPkce: partial.authType === "OAUTH2_PKCE",
    ...partial,
  };
}

export const OAUTH_PROVIDER_DEFINITIONS: OAuthProviderDefinition[] = [
  oauthDef({
    providerKey: "google-analytics",
    displayName: "Google Analytics 4",
    authType: "OAUTH2_AUTHORIZATION_CODE",
    authorizationUrl: GOOGLE_AUTH,
    tokenUrl: GOOGLE_TOKEN,
    defaultScopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    optionalScopes: ["openid", "email", "profile"],
    accountDiscoveryTypes: ["ga4_property"],
  }),
  oauthDef({
    providerKey: "google-search-console",
    displayName: "Google Search Console",
    authType: "OAUTH2_AUTHORIZATION_CODE",
    authorizationUrl: GOOGLE_AUTH,
    tokenUrl: GOOGLE_TOKEN,
    defaultScopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    optionalScopes: ["openid", "email"],
    accountDiscoveryTypes: ["gsc_site"],
  }),
  oauthDef({
    providerKey: "google-ads",
    displayName: "Google Ads",
    authType: "OAUTH2_AUTHORIZATION_CODE",
    authorizationUrl: GOOGLE_AUTH,
    tokenUrl: GOOGLE_TOKEN,
    defaultScopes: ["https://www.googleapis.com/auth/adwords"],
    optionalScopes: [],
    accountDiscoveryTypes: ["google_ads_customer"],
  }),
  oauthDef({
    providerKey: "meta",
    displayName: "Meta",
    authType: "OAUTH2_PKCE",
    authorizationUrl: META_AUTH,
    tokenUrl: META_TOKEN,
    defaultScopes: [
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_posts",
      "business_management",
      "instagram_basic",
      "instagram_content_publish",
    ],
    optionalScopes: ["instagram_manage_insights"],
    accountDiscoveryTypes: ["meta_business", "meta_page", "meta_ad_account"],
  }),
  oauthDef({
    providerKey: "meta-ads",
    displayName: "Meta Ads",
    authType: "OAUTH2_PKCE",
    authorizationUrl: META_AUTH,
    tokenUrl: META_TOKEN,
    defaultScopes: ["ads_read", "ads_management", "business_management"],
    optionalScopes: [],
    accountDiscoveryTypes: ["meta_ad_account"],
  }),
  oauthDef({
    providerKey: "linkedin",
    displayName: "LinkedIn",
    authType: "OAUTH2_AUTHORIZATION_CODE",
    authorizationUrl: LINKEDIN_AUTH,
    tokenUrl: LINKEDIN_TOKEN,
    defaultScopes: ["r_organization_social", "rw_organization_admin"],
    optionalScopes: ["r_ads", "r_ads_reporting"],
    accountDiscoveryTypes: ["linkedin_organization"],
  }),
  oauthDef({
    providerKey: "linkedin-ads",
    displayName: "LinkedIn Ads",
    authType: "OAUTH2_AUTHORIZATION_CODE",
    authorizationUrl: LINKEDIN_AUTH,
    tokenUrl: LINKEDIN_TOKEN,
    defaultScopes: ["r_ads", "r_ads_reporting", "rw_ads"],
    optionalScopes: [],
    accountDiscoveryTypes: ["linkedin_ad_account"],
  }),
  oauthDef({
    providerKey: "tiktok",
    displayName: "TikTok",
    authType: "OAUTH2_PKCE",
    authorizationUrl: TIKTOK_AUTH,
    tokenUrl: TIKTOK_TOKEN,
    defaultScopes: ["user.info.basic", "video.list"],
    optionalScopes: [],
    accountDiscoveryTypes: ["tiktok_account"],
  }),
  oauthDef({
    providerKey: "tiktok-ads",
    displayName: "TikTok Ads",
    authType: "OAUTH2_AUTHORIZATION_CODE",
    authorizationUrl: TIKTOK_AUTH,
    tokenUrl: TIKTOK_TOKEN,
    defaultScopes: ["ad.account.read", "ad.report.read"],
    optionalScopes: [],
    accountDiscoveryTypes: ["tiktok_advertiser"],
  }),
  oauthDef({
    providerKey: "microsoft-ads",
    displayName: "Microsoft Ads",
    authType: "OAUTH2_AUTHORIZATION_CODE",
    authorizationUrl: MICROSOFT_AUTH,
    tokenUrl: MICROSOFT_TOKEN,
    defaultScopes: ["https://ads.microsoft.com/msads.manage"],
    optionalScopes: ["offline_access"],
    accountDiscoveryTypes: ["microsoft_ads_account"],
  }),
  oauthDef({
    providerKey: "hubspot",
    displayName: "HubSpot",
    authType: "OAUTH2_AUTHORIZATION_CODE",
    authorizationUrl: HUBSPOT_AUTH,
    tokenUrl: HUBSPOT_TOKEN,
    defaultScopes: ["crm.objects.contacts.read", "crm.objects.deals.read"],
    optionalScopes: ["content"],
    accountDiscoveryTypes: ["hubspot_portal"],
  }),
  oauthDef({
    providerKey: "mailchimp",
    displayName: "Mailchimp",
    authType: "OAUTH2_AUTHORIZATION_CODE",
    authorizationUrl: MAILCHIMP_AUTH,
    tokenUrl: MAILCHIMP_TOKEN,
    defaultScopes: [],
    optionalScopes: [],
    accountDiscoveryTypes: ["mailchimp_audience"],
  }),
  oauthDef({
    providerKey: "youtube",
    displayName: "YouTube",
    authType: "OAUTH2_AUTHORIZATION_CODE",
    authorizationUrl: GOOGLE_AUTH,
    tokenUrl: GOOGLE_TOKEN,
    defaultScopes: [
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/yt-analytics.readonly",
    ],
    optionalScopes: ["https://www.googleapis.com/auth/youtube.upload"],
    accountDiscoveryTypes: ["youtube_channel"],
  }),
  oauthDef({
    providerKey: "x",
    displayName: "X",
    authType: "OAUTH2_PKCE",
    authorizationUrl: X_AUTH,
    tokenUrl: X_TOKEN,
    defaultScopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    optionalScopes: [],
    accountDiscoveryTypes: ["x_account"],
  }),
  oauthDef({
    providerKey: "slack",
    displayName: "Slack",
    authType: "OAUTH2_AUTHORIZATION_CODE",
    authorizationUrl: SLACK_AUTH,
    tokenUrl: SLACK_TOKEN,
    defaultScopes: ["channels:read", "chat:write", "team:read"],
    optionalScopes: ["groups:read"],
    accountDiscoveryTypes: ["slack_workspace", "slack_channel"],
  }),
];

export function getOAuthProviderDefinition(providerKey: string): OAuthProviderDefinition | undefined {
  return OAUTH_PROVIDER_DEFINITIONS.find((definition) => definition.providerKey === providerKey);
}

export function isStage12OAuthProvider(providerKey: string): boolean {
  return (STAGE_12_OAUTH_PROVIDER_KEYS as readonly string[]).includes(providerKey);
}
