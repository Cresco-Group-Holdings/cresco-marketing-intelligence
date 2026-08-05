export const ENTITLEMENT_KEYS = {
  USERS_MAX: "users.max",
  PROJECTS_MAX: "projects.max",
  BRANDS_MAX: "brands.max",
  CAMPAIGNS_MAX_ACTIVE: "campaigns.max_active",
  STORAGE_KNOWLEDGE_MB: "storage.knowledge_mb",
  STORAGE_ASSETS_MB: "storage.assets_mb",
  AI_TOKENS_MONTHLY: "ai.tokens_monthly",
  AI_AGENT_RUNS_DAILY: "ai.agent_runs_daily",
  PROVIDER_CONNECTIONS_MAX: "provider.connections.max",
  SYNC_HISTORICAL_DAYS: "sync.historical_days",
  PUBLICATIONS_MONTHLY: "publications.monthly",
  AUTOMATION_EXECUTIONS_MONTHLY: "automation.executions_monthly",
  CRM_CONTACTS_MAX: "crm.contacts.max",
  API_ACCESS: "api.access",
  PERMISSIONS_ADVANCED: "permissions.advanced",
  AUDIT_RETENTION_DAYS: "audit.retention_days",
  SUPPORT_LEVEL: "support.level",
} as const;

export type EntitlementKey = (typeof ENTITLEMENT_KEYS)[keyof typeof ENTITLEMENT_KEYS];

export const USAGE_METER_KEYS = {
  AI_TOKENS: "ai.tokens",
  STORAGE_BYTES: "storage.bytes",
  PROVIDER_CONNECTIONS: "provider.connections",
  SYNC_JOBS: "sync.jobs",
  IMPORTED_RECORDS: "imported.records",
  ACTIVE_CAMPAIGNS: "active.campaigns",
  PUBLICATIONS: "publications",
  AUTOMATION_EXECUTIONS: "automation.executions",
  CRM_CONTACTS: "crm.contacts",
  TEAM_MEMBERS: "team.members",
} as const;

export type UsageMeterKey = (typeof USAGE_METER_KEYS)[keyof typeof USAGE_METER_KEYS];

export const ENTITLEMENT_TO_METER: Partial<Record<EntitlementKey, UsageMeterKey>> = {
  [ENTITLEMENT_KEYS.AI_TOKENS_MONTHLY]: USAGE_METER_KEYS.AI_TOKENS,
  [ENTITLEMENT_KEYS.AI_AGENT_RUNS_DAILY]: USAGE_METER_KEYS.AUTOMATION_EXECUTIONS,
  [ENTITLEMENT_KEYS.PROVIDER_CONNECTIONS_MAX]: USAGE_METER_KEYS.PROVIDER_CONNECTIONS,
  [ENTITLEMENT_KEYS.CAMPAIGNS_MAX_ACTIVE]: USAGE_METER_KEYS.ACTIVE_CAMPAIGNS,
  [ENTITLEMENT_KEYS.PUBLICATIONS_MONTHLY]: USAGE_METER_KEYS.PUBLICATIONS,
  [ENTITLEMENT_KEYS.AUTOMATION_EXECUTIONS_MONTHLY]: USAGE_METER_KEYS.AUTOMATION_EXECUTIONS,
  [ENTITLEMENT_KEYS.CRM_CONTACTS_MAX]: USAGE_METER_KEYS.CRM_CONTACTS,
  [ENTITLEMENT_KEYS.USERS_MAX]: USAGE_METER_KEYS.TEAM_MEMBERS,
};
