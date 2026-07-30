import {
  BarChart3,
  BookOpen,
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
  Palette,
  Settings,
  Share2,
  Sprout,
  UserPlus,
  Wallet,
} from "lucide-react";

export type NavigationItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  description: string;
  comingSoon?: boolean;
};

export const dashboardNavigation: NavigationItem[] = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Workspace summary and priorities",
  },
  {
    label: "Advertising Plans",
    href: "/advertising",
    icon: Megaphone,
    description: "Provider-independent campaign planning",
  },
  {
    label: "Google Ads",
    href: "/advertising/google",
    icon: Megaphone,
    description: "Controlled Google Ads campaign management",
  },
  {
    label: "Meta Ads",
    href: "/advertising/meta",
    icon: Megaphone,
    description: "Controlled Meta Facebook and Instagram campaigns",
  },
  {
    label: "LinkedIn Ads",
    href: "/advertising/linkedin",
    icon: Megaphone,
    description: "Controlled LinkedIn campaign management",
  },
  {
    label: "TikTok Ads",
    href: "/advertising/tiktok",
    icon: Megaphone,
    description: "Controlled TikTok campaign management",
  },
  {
    label: "Ad Experiments",
    href: "/advertising/experiments",
    icon: FlaskConical,
    description: "Advertising A/B tests and experiment analysis",
  },
  {
    label: "Ad Budgets",
    href: "/advertising/budgets",
    icon: Wallet,
    description: "Budget pacing, alerts, and spend governance",
  },
  {
    label: "Ad Optimisation",
    href: "/advertising/optimisation",
    icon: Bot,
    description: "AI advertising optimisation recommendations",
  },
  {
    label: "Brands",
    href: "/brands",
    icon: Megaphone,
    description: "Brand profiles and positioning",
  },
  {
    label: "Knowledge Base",
    href: "/knowledge",
    icon: BookOpen,
    description: "Brand knowledge and messaging",
  },
  {
    label: "Assets",
    href: "/assets",
    icon: FolderOpen,
    description: "Marketing asset library",
  },
  {
    label: "Content Studio",
    href: "/content",
    icon: PenSquare,
    description: "Draft and manage marketing content",
  },
  {
    label: "Visual Studio",
    href: "/visual-studio",
    icon: Palette,
    description: "Create branded images and carousels",
  },
  {
    label: "Content Calendar",
    href: "/calendar",
    icon: CalendarDays,
    description: "Plan and schedule campaigns",
    comingSoon: true,
  },
  {
    label: "Social Media",
    href: "/social",
    icon: Share2,
    description: "Social distribution workflows",
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    description: "Performance and intelligence",
  },
  {
    label: "Data Hub",
    href: "/data",
    icon: Database,
    description: "Unified marketing data warehouse",
  },
  {
    label: "Growth",
    href: "/growth",
    icon: Sprout,
    description: "Evidence-backed content recommendations",
  },
  {
    label: "Experiments",
    href: "/experiments",
    icon: FlaskConical,
    description: "Transparent social content experiments",
  },
  {
    label: "Leads",
    href: "/leads",
    icon: UserPlus,
    description: "Social engagement to qualified leads",
  },
  {
    label: "CRM",
    href: "/crm",
    icon: Contact,
    description: "Leads, contacts, companies, and identity foundation",
  },
  {
    label: "Connectors",
    href: "/connectors",
    icon: Link2,
    description: "Platform integrations",
  },
  {
    label: "Analyst",
    href: "/analyst",
    icon: LineChart,
    description: "Evidence-grounded AI marketing analysis",
  },
  {
    label: "Technical SEO",
    href: "/seo",
    icon: Globe,
    description: "Site crawler, issues, and technical audits",
  },
  {
    label: "AI Agents",
    href: "/ai-agents",
    icon: Bot,
    description: "AI-assisted marketing workflows",
    comingSoon: true,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    description: "Organisation and account settings",
  },
];
