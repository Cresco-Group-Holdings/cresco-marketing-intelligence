import {
  Activity,
  BarChart3,
  Bot,
  CalendarDays,
  Contact,
  Database,
  FlaskConical,
  FolderOpen,
  Globe,
  LayoutDashboard,
  LineChart,
  Link2,
  Megaphone,
  PenSquare,
  Plug,
  Settings,
  Share2,
  Sprout,
  Target,
  Wallet,
  Wrench,
} from "lucide-react";

export type NavigationItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  description: string;
  comingSoon?: boolean;
};

export type NavigationSection = {
  id: string;
  label: string;
  items: NavigationItem[];
  collapsible?: boolean;
};

export const dashboardNavigationSections: NavigationSection[] = [
  {
    id: "command",
    label: "Command",
    items: [
      {
        label: "Command Centre",
        href: "/dashboard",
        icon: LayoutDashboard,
        description: "Your daily operating cockpit for growth and marketing decisions",
      },
      {
        label: "Activity",
        href: "/operations",
        icon: Activity,
        description: "Operational activity, alerts, and recovery",
      },
    ],
  },
  {
    id: "execute",
    label: "Execute",
    items: [
      {
        label: "Advertising",
        href: "/advertising",
        icon: Megaphone,
        description: "Paid media performance and campaign management",
      },
      {
        label: "Organic Social",
        href: "/organic-social",
        icon: Share2,
        description: "Organic social distribution and publishing",
      },
      {
        label: "Content Studio",
        href: "/content",
        icon: PenSquare,
        description: "Draft and manage marketing content",
      },
      {
        label: "Calendar",
        href: "/calendar",
        icon: CalendarDays,
        description: "Plan and schedule content",
      },
    ],
  },
  {
    id: "strategy",
    label: "Strategy",
    items: [
      {
        label: "Brands",
        href: "/brands",
        icon: Megaphone,
        description: "Brand profiles and positioning",
      },
      {
        label: "Audiences",
        href: "/advertising/audiences",
        icon: Contact,
        description: "Audience intelligence and targeting",
      },
      {
        label: "Competitors",
        href: "/seo/competitors",
        icon: Globe,
        description: "Competitor intelligence and content gaps",
      },
      {
        label: "Market Intelligence",
        href: "/growth/insights",
        icon: LineChart,
        description: "Market and audience insights",
      },
    ],
  },
  {
    id: "measure",
    label: "Measure",
    items: [
      {
        label: "Analytics",
        href: "/analytics",
        icon: BarChart3,
        description: "Performance and intelligence",
      },
      {
        label: "Attribution",
        href: "/analytics/attribution",
        icon: Link2,
        description: "Attribution models and journeys",
      },
      {
        label: "Experiments",
        href: "/experiments",
        icon: FlaskConical,
        description: "Social and marketing experiments",
      },
      {
        label: "Reports",
        href: "/analytics/social/reports",
        icon: Database,
        description: "Social and marketing reports",
      },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    items: [
      {
        label: "Cresco Intelligence",
        href: "/growth",
        icon: Sprout,
        description: "Growth intelligence and recommendations",
      },
      {
        label: "Ask Cresco",
        href: "/copilot",
        icon: Bot,
        description: "Evidence-based marketing intelligence and daily briefs",
      },
      {
        label: "Automations",
        href: "/automations",
        icon: Bot,
        description: "Background monitoring and launch templates",
      },
      {
        label: "Agents",
        href: "/ai-agents",
        icon: Bot,
        description: "AI-assisted marketing workflows",
        comingSoon: true,
      },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      {
        label: "Integrations",
        href: "/integrations",
        icon: Plug,
        description: "Provider connections and external API governance",
      },
      {
        label: "Operations",
        href: "/operations",
        icon: Wrench,
        description: "Publishing, connectors, and rendering operations",
      },
      {
        label: "Settings",
        href: "/settings",
        icon: Settings,
        description: "Organisation and account settings",
      },
    ],
  },
];

/** Flat list preserved for route validation and legacy consumers */
export const dashboardNavigation: NavigationItem[] = dashboardNavigationSections.flatMap(
  (section) => section.items,
);

/** Additional routes not shown in primary nav but still part of the product */
export const secondaryNavigation: NavigationItem[] = [
  {
    label: "Campaigns",
    href: "/campaigns",
    icon: Target,
    description: "Plan and coordinate marketing campaigns",
  },
  {
    label: "Assets",
    href: "/assets",
    icon: FolderOpen,
    description: "Marketing asset library",
  },
  {
    label: "Publishing",
    href: "/publishing",
    icon: Megaphone,
    description: "Governed outbound provider operations",
  },
  {
    label: "Inbox",
    href: "/inbox",
    icon: Share2,
    description: "Unified social comments, mentions, and messages",
  },
  {
    label: "Data Hub",
    href: "/data",
    icon: Database,
    description: "Unified marketing data warehouse",
  },
  {
    label: "Connectors",
    href: "/connectors",
    icon: Link2,
    description: "Platform integrations",
  },
  {
    label: "Ad Budgets",
    href: "/advertising/budgets",
    icon: Wallet,
    description: "Budget pacing, alerts, and spend governance",
  },
];
