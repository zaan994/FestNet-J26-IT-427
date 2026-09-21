import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { LoadingScreen } from "@/components/common/LoadingScreen";
import { Logo } from "@/components/common/Logo";
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
        <div className="card max-w-md p-8 text-center">
          <div className="mb-6 flex justify-center">
            <Logo />
          </div>
          <h1 className="text-lg font-bold">No dashboard access</h1>
          <p className="mt-2 text-sm text-muted">
            {user.email} has role <b className="text-ink">{profile?.role ?? "none"}</b>. The dashboard is for organisers and
            medical staff. Ask an organiser to update your role.
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
