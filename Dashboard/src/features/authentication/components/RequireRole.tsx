import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { LoadingScreen } from "@/components/common/LoadingScreen";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/services/authService";
import type { Role } from "@/types";

interface Props {
  roles: Role[];
  children: ReactNode;
}

export function RequireRole({ roles, children }: Props) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen message="Checking access…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  if (!profile || !roles.includes(profile.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="card max-w-md text-center">
          <h1 className="text-lg font-semibold">No dashboard access</h1>
          <p className="mt-2 text-sm text-slate-600">
            {user.email} has role <b>{profile?.role ?? "none"}</b>. The dashboard is for organisers and medical
            staff. Ask an organiser to update your role (Backend/scripts: <code>npm run admin -- user …</code>).
          </p>
          <button className="btn-ghost mt-4" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
