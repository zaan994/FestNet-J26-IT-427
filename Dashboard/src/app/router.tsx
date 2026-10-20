import { createBrowserRouter, Navigate } from "react-router-dom";

import { AccessAuditPage } from "@/features/access_audit/pages/AccessAuditPage";
import { RouteError } from "@/components/common/RouteError";
import { RequireStaff } from "@/features/authentication/components/RequireRole";
import { LoginPage } from "@/features/authentication/pages/LoginPage";
import { CrowdMonitoringPage } from "@/features/crowd_monitoring/pages/CrowdMonitoringPage";
import { DeviceDetailPage } from "@/features/device_detail/pages/DeviceDetailPage";
import { EmergencyCommandPage } from "@/features/emergency_command/pages/EmergencyCommandPage";
import { EventOverviewPage } from "@/features/event_overview/pages/EventOverviewPage";
import { HeatWellnessPage } from "@/features/heat_wellness/pages/HeatWellnessPage";
import { HriAnalyticsPage } from "@/features/hri_analytics/pages/HriAnalyticsPage";
import { LiveHealthPage } from "@/features/live_health/pages/LiveHealthPage";
import { ManagementPage } from "@/features/management/pages/ManagementPage";
import { ReportsPage } from "@/features/reports_analytics/pages/ReportsPage";
import { DashboardLayout } from "@/layouts/DashboardLayout";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: (
      <RequireStaff>
        <DashboardLayout />
      </RequireStaff>
    ),
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Navigate to="/overview" replace /> },
      { path: "overview", element: <EventOverviewPage /> },
      { path: "health", element: <LiveHealthPage /> }, // C1
      { path: "devices/:deviceId", element: <DeviceDetailPage /> }, // C1
      { path: "emergency", element: <EmergencyCommandPage /> }, // C1 + C2
      { path: "manage", element: <ManagementPage /> },
      { path: "analytics", element: <HriAnalyticsPage /> }, // C1
      { path: "access", element: <AccessAuditPage /> },
      { path: "crowd", element: <CrowdMonitoringPage /> }, // C3
      { path: "wellness", element: <HeatWellnessPage /> }, // C4
      { path: "reports", element: <ReportsPage /> }, // C4
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
