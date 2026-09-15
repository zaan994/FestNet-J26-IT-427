import { createBrowserRouter, Navigate } from "react-router-dom";

import { RequireRole } from "@/features/authentication/components/RequireRole";
import { LoginPage } from "@/features/authentication/pages/LoginPage";
import { CrowdMonitoringPage } from "@/features/crowd_monitoring/pages/CrowdMonitoringPage";
import { EmergencyCommandPage } from "@/features/emergency_command/pages/EmergencyCommandPage";
import { EventOverviewPage } from "@/features/event_overview/pages/EventOverviewPage";
import { HeatWellnessPage } from "@/features/heat_wellness/pages/HeatWellnessPage";
import { LiveHealthPage } from "@/features/live_health/pages/LiveHealthPage";
import { ReportsPage } from "@/features/reports_analytics/pages/ReportsPage";
import { RespondersPage } from "@/features/responder_management/pages/RespondersPage";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { DASHBOARD_ROLES } from "@/types";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: (
      <RequireRole roles={DASHBOARD_ROLES}>
        <DashboardLayout />
      </RequireRole>
    ),
    children: [
      { index: true, element: <Navigate to="/overview" replace /> },
      { path: "overview", element: <EventOverviewPage /> },
      { path: "health", element: <LiveHealthPage /> }, // C1
      { path: "emergency", element: <EmergencyCommandPage /> }, // C2
      { path: "responders", element: <RespondersPage /> }, // C2
      { path: "crowd", element: <CrowdMonitoringPage /> }, // C3
      { path: "wellness", element: <HeatWellnessPage /> }, // C4
      { path: "reports", element: <ReportsPage /> }, // C4
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
