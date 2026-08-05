import type { EntitlementValueType } from "@prisma/client";
import { ENTITLEMENT_KEYS, USAGE_METER_KEYS } from "@/lib/billing/entitlements";

export type PlanSeedEntitlement = {
  entitlementKey: string;
  valueType: EntitlementValueType;
  limitValue?: number;
  booleanValue?: boolean;
};

export type PlanSeedAllowance = {
  meterKey: string;
  allowance: number;
  period: "DAILY" | "MONTHLY" | "BILLING_PERIOD" | "LIFETIME";
};

export type PlanSeedDefinition = {
  key: string;
  displayName: string;
  description: string;
  sortOrder: number;
  monthlyPriceCents: number;
  annualPriceCents: number;
  trialDays: number;
  entitlements: PlanSeedEntitlement[];
  allowances: PlanSeedAllowance[];
};

export const DEFAULT_PLAN_CATALOG: PlanSeedDefinition[] = [
  {
    key: "free",
    displayName: "Free",
    description: "Limited access for evaluation.",
    sortOrder: 0,
    monthlyPriceCents: 0,
    annualPriceCents: 0,
    trialDays: 0,
    entitlements: [
      { entitlementKey: ENTITLEMENT_KEYS.USERS_MAX, valueType: "COUNT", limitValue: 2 },
      { entitlementKey: ENTITLEMENT_KEYS.PROJECTS_MAX, valueType: "COUNT", limitValue: 1 },
      { entitlementKey: ENTITLEMENT_KEYS.BRANDS_MAX, valueType: "COUNT", limitValue: 1 },
      { entitlementKey: ENTITLEMENT_KEYS.CAMPAIGNS_MAX_ACTIVE, valueType: "COUNT", limitValue: 3 },
      { entitlementKey: ENTITLEMENT_KEYS.AI_TOKENS_MONTHLY, valueType: "COUNT", limitValue: 10_000 },
      { entitlementKey: ENTITLEMENT_KEYS.PROVIDER_CONNECTIONS_MAX, valueType: "COUNT", limitValue: 2 },
      { entitlementKey: ENTITLEMENT_KEYS.API_ACCESS, valueType: "BOOLEAN", booleanValue: false },
    ],
    allowances: [
      { meterKey: USAGE_METER_KEYS.AI_TOKENS, allowance: 10_000, period: "MONTHLY" },
      { meterKey: USAGE_METER_KEYS.PROVIDER_CONNECTIONS, allowance: 2, period: "LIFETIME" },
    ],
  },
  {
    key: "trial",
    displayName: "Trial",
    description: "Full-feature trial period.",
    sortOrder: 1,
    monthlyPriceCents: 0,
    annualPriceCents: 0,
    trialDays: 14,
    entitlements: [
      { entitlementKey: ENTITLEMENT_KEYS.USERS_MAX, valueType: "COUNT", limitValue: 5 },
      { entitlementKey: ENTITLEMENT_KEYS.PROJECTS_MAX, valueType: "COUNT", limitValue: 3 },
      { entitlementKey: ENTITLEMENT_KEYS.BRANDS_MAX, valueType: "COUNT", limitValue: 5 },
      { entitlementKey: ENTITLEMENT_KEYS.CAMPAIGNS_MAX_ACTIVE, valueType: "COUNT", limitValue: 20 },
      { entitlementKey: ENTITLEMENT_KEYS.AI_TOKENS_MONTHLY, valueType: "COUNT", limitValue: 100_000 },
      { entitlementKey: ENTITLEMENT_KEYS.API_ACCESS, valueType: "BOOLEAN", booleanValue: true },
    ],
    allowances: [
      { meterKey: USAGE_METER_KEYS.AI_TOKENS, allowance: 100_000, period: "MONTHLY" },
      { meterKey: USAGE_METER_KEYS.SYNC_JOBS, allowance: 100, period: "MONTHLY" },
    ],
  },
  {
    key: "starter",
    displayName: "Starter",
    description: "For small teams getting started.",
    sortOrder: 2,
    monthlyPriceCents: 4900,
    annualPriceCents: 49_900,
    trialDays: 0,
    entitlements: [
      { entitlementKey: ENTITLEMENT_KEYS.USERS_MAX, valueType: "COUNT", limitValue: 5 },
      { entitlementKey: ENTITLEMENT_KEYS.PROJECTS_MAX, valueType: "COUNT", limitValue: 5 },
      { entitlementKey: ENTITLEMENT_KEYS.BRANDS_MAX, valueType: "COUNT", limitValue: 10 },
      { entitlementKey: ENTITLEMENT_KEYS.CAMPAIGNS_MAX_ACTIVE, valueType: "COUNT", limitValue: 25 },
      { entitlementKey: ENTITLEMENT_KEYS.AI_TOKENS_MONTHLY, valueType: "COUNT", limitValue: 250_000 },
      { entitlementKey: ENTITLEMENT_KEYS.PROVIDER_CONNECTIONS_MAX, valueType: "COUNT", limitValue: 10 },
      { entitlementKey: ENTITLEMENT_KEYS.API_ACCESS, valueType: "BOOLEAN", booleanValue: true },
    ],
    allowances: [
      { meterKey: USAGE_METER_KEYS.AI_TOKENS, allowance: 250_000, period: "MONTHLY" },
      { meterKey: USAGE_METER_KEYS.SYNC_JOBS, allowance: 200, period: "MONTHLY" },
      { meterKey: USAGE_METER_KEYS.PUBLICATIONS, allowance: 500, period: "MONTHLY" },
    ],
  },
  {
    key: "professional",
    displayName: "Professional",
    description: "For growing marketing teams.",
    sortOrder: 3,
    monthlyPriceCents: 14900,
    annualPriceCents: 149_900,
    trialDays: 0,
    entitlements: [
      { entitlementKey: ENTITLEMENT_KEYS.USERS_MAX, valueType: "COUNT", limitValue: 25 },
      { entitlementKey: ENTITLEMENT_KEYS.PROJECTS_MAX, valueType: "COUNT", limitValue: 20 },
      { entitlementKey: ENTITLEMENT_KEYS.BRANDS_MAX, valueType: "COUNT", limitValue: 50 },
      { entitlementKey: ENTITLEMENT_KEYS.CAMPAIGNS_MAX_ACTIVE, valueType: "COUNT", limitValue: 100 },
      { entitlementKey: ENTITLEMENT_KEYS.AI_TOKENS_MONTHLY, valueType: "COUNT", limitValue: 1_000_000 },
      { entitlementKey: ENTITLEMENT_KEYS.PERMISSIONS_ADVANCED, valueType: "BOOLEAN", booleanValue: true },
      { entitlementKey: ENTITLEMENT_KEYS.API_ACCESS, valueType: "BOOLEAN", booleanValue: true },
    ],
    allowances: [
      { meterKey: USAGE_METER_KEYS.AI_TOKENS, allowance: 1_000_000, period: "MONTHLY" },
      { meterKey: USAGE_METER_KEYS.SYNC_JOBS, allowance: 1000, period: "MONTHLY" },
      { meterKey: USAGE_METER_KEYS.CRM_CONTACTS, allowance: 50_000, period: "LIFETIME" },
    ],
  },
  {
    key: "business",
    displayName: "Business",
    description: "For larger organisations with advanced needs.",
    sortOrder: 4,
    monthlyPriceCents: 39900,
    annualPriceCents: 399_900,
    trialDays: 0,
    entitlements: [
      { entitlementKey: ENTITLEMENT_KEYS.USERS_MAX, valueType: "COUNT", limitValue: 100 },
      { entitlementKey: ENTITLEMENT_KEYS.CAMPAIGNS_MAX_ACTIVE, valueType: "COUNT", limitValue: 500 },
      { entitlementKey: ENTITLEMENT_KEYS.AI_TOKENS_MONTHLY, valueType: "COUNT", limitValue: 5_000_000 },
      { entitlementKey: ENTITLEMENT_KEYS.PERMISSIONS_ADVANCED, valueType: "BOOLEAN", booleanValue: true },
      { entitlementKey: ENTITLEMENT_KEYS.AUDIT_RETENTION_DAYS, valueType: "COUNT", limitValue: 365 },
    ],
    allowances: [
      { meterKey: USAGE_METER_KEYS.AI_TOKENS, allowance: 5_000_000, period: "MONTHLY" },
      { meterKey: USAGE_METER_KEYS.SYNC_JOBS, allowance: 5000, period: "MONTHLY" },
    ],
  },
  {
    key: "enterprise",
    displayName: "Enterprise",
    description: "Custom limits and support.",
    sortOrder: 5,
    monthlyPriceCents: 0,
    annualPriceCents: 0,
    trialDays: 0,
    entitlements: [
      { entitlementKey: ENTITLEMENT_KEYS.USERS_MAX, valueType: "COUNT", limitValue: 10_000 },
      { entitlementKey: ENTITLEMENT_KEYS.API_ACCESS, valueType: "BOOLEAN", booleanValue: true },
      { entitlementKey: ENTITLEMENT_KEYS.PERMISSIONS_ADVANCED, valueType: "BOOLEAN", booleanValue: true },
      { entitlementKey: ENTITLEMENT_KEYS.SUPPORT_LEVEL, valueType: "COUNT", limitValue: 3 },
    ],
    allowances: [],
  },
];

export const USAGE_METER_DEFINITIONS = [
  { key: USAGE_METER_KEYS.AI_TOKENS, displayName: "AI tokens", unit: "tokens" },
  { key: USAGE_METER_KEYS.STORAGE_BYTES, displayName: "Storage", unit: "bytes" },
  { key: USAGE_METER_KEYS.PROVIDER_CONNECTIONS, displayName: "Provider connections", unit: "connections" },
  { key: USAGE_METER_KEYS.SYNC_JOBS, displayName: "Sync jobs", unit: "jobs" },
  { key: USAGE_METER_KEYS.IMPORTED_RECORDS, displayName: "Imported records", unit: "records" },
  { key: USAGE_METER_KEYS.ACTIVE_CAMPAIGNS, displayName: "Active campaigns", unit: "campaigns" },
  { key: USAGE_METER_KEYS.PUBLICATIONS, displayName: "Publications", unit: "publications" },
  { key: USAGE_METER_KEYS.AUTOMATION_EXECUTIONS, displayName: "Automation executions", unit: "executions" },
  { key: USAGE_METER_KEYS.CRM_CONTACTS, displayName: "CRM contacts", unit: "contacts" },
  { key: USAGE_METER_KEYS.TEAM_MEMBERS, displayName: "Team members", unit: "members" },
];
