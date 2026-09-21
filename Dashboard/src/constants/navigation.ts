import type { IconName } from "@/components/common/Icon";

/** Sidebar entries. `owner` tells each team member where their component lives. */
export interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  owner: string;
  component: "shared" | "C1" | "C2" | "C3" | "C4";
}

export const NAV_ITEMS: NavItem[] = [
  { path: "/overview", label: "Event Overview", icon: "overview", owner: "Shared", component: "shared" },
  { path: "/health", label: "Live Health", icon: "heart", owner: "Rizvi M.Z.M.", component: "C1" },
  { path: "/emergency", label: "Emergency Command", icon: "alert", owner: "Manubasha K.D.C.", component: "C2" },
  { path: "/responders", label: "Responders", icon: "users", owner: "Manubasha K.D.C.", component: "C2" },
  { path: "/crowd", label: "Crowd Monitoring", icon: "map", owner: "Pemarathna P.A.J.", component: "C3" },
  { path: "/wellness", label: "Heat & Wellness", icon: "thermometer", owner: "Bandara W.M.T.N.", component: "C4" },
  { path: "/reports", label: "Reports", icon: "chart", owner: "Bandara W.M.T.N.", component: "C4" },
];
