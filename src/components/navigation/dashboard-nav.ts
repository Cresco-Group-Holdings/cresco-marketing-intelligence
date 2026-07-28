import {
  BarChart3,
  Bot,
  CalendarDays,
  LayoutDashboard,
  Link2,
  Megaphone,
  PenSquare,
  Settings,
  Share2,
} from "lucide-react";

export type NavigationItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  description: string;
};

export const dashboardNavigation: NavigationItem[] = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Workspace summary and priorities",
  },
  {
    label: "Brands",
    href: "/brands",
    icon: Megaphone,
    description: "Brand profiles and positioning",
  },
  {
    label: "Content Studio",
    href: "/content",
    icon: PenSquare,
    description: "Draft and manage marketing content",
  },
  {
    label: "Content Calendar",
    href: "/calendar",
    icon: CalendarDays,
    description: "Plan and schedule campaigns",
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
    label: "Connectors",
    href: "/connectors",
    icon: Link2,
    description: "Platform integrations",
  },
  {
    label: "AI Agents",
    href: "/ai-agents",
    icon: Bot,
    description: "AI-assisted marketing workflows",
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    description: "Organisation and account settings",
  },
];
