import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { LoadingScreen } from "@/components/common/LoadingScreen";
import { Logo } from "@/components/common/Logo";
import { useAuth, usePermissions } from "@/hooks/useAuth";
import { signOut } from "@/services/authService";

/**
 * Staff gate: any global role (deviceAdmin / researchAdmin) or any event role.
 * This only hides the UI — the security rules and backend enforce real access.
 */
export function RequireStaff({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { isStaff } = usePermissions();
  const location = useLocation();

  if (loading) return <LoadingScreen message="Checking access…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  if (!isStaff) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="card max-w-md p-8 text-center">
          <div className="mb-6 flex justify-center">
            <Logo />
          </div>
          <h1 className="text-lg font-bold">No staff access</h1>
          <p className="mt-2 text-sm text-muted">
            {user.email} has no staff role. The dashboard is for event operators, medical responders, device administrators and research
            administrators. Attendees use the FestNet mobile app. Ask a device administrator to grant you a role.
          </p>
          <button type="button" className="btn-outline mt-6" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
