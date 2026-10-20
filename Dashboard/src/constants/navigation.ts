import type { IconName } from "@/components/common/Icon";

/** Sidebar entries. `owner` tells each team member where their component lives. */
export interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  owner: string;
  component: "shared" | "C1" | "C2" | "C3" | "C4";
  section: "Operations" | "Administration" | "Other components";
}

export const NAV_ITEMS: NavItem[] = [
  { path: "/overview", label: "Event Overview", icon: "overview", owner: "Shared", component: "shared", section: "Operations" },
  { path: "/health", label: "Live Health", icon: "heart", owner: "Rizvi M.Z.M.", component: "C1", section: "Operations" },
  { path: "/emergency", label: "Emergency Command", icon: "alert", owner: "Rizvi / Manubasha", component: "C2", section: "Operations" },
  { path: "/manage", label: "Event & Devices", icon: "qr", owner: "Shared", component: "shared", section: "Administration" },
  { path: "/analytics", label: "HRI Analytics", icon: "chart", owner: "Rizvi M.Z.M.", component: "C1", section: "Administration" },
  { path: "/access", label: "Access & Audit", icon: "shield", owner: "Shared", component: "shared", section: "Administration" },
  { path: "/crowd", label: "Crowd Monitoring", icon: "map", owner: "Pemarathna P.A.J.", component: "C3", section: "Other components" },
  { path: "/wellness", label: "Heat & Wellness", icon: "thermometer", owner: "Bandara W.M.T.N.", component: "C4", section: "Other components" },
  { path: "/reports", label: "Reports", icon: "download", owner: "Bandara W.M.T.N.", component: "C4", section: "Other components" },
];
