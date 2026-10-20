import { onAuthStateChanged, type User } from "firebase/auth";
import { onValue, ref } from "firebase/database";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { auth, db } from "@/config/firebase";
import type { EventRole, GlobalRole, UserProfile } from "@/types";
import { paths } from "@shared/paths";

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  globalRoles: Set<GlobalRole>;
  /** eventId → role for events this user is staff of. */
  eventRoles: Record<string, EventRole>;
  loading: boolean;
}

const EMPTY: AuthState = { user: null, profile: null, globalRoles: new Set(), eventRoles: {}, loading: true };
const AuthContext = createContext<AuthState>(EMPTY);

/**
 * Loads the signed-in user plus their roles (roles/{uid}, staffEvents/{uid}) live.
 * Roles are only HINTS for the UI — every privileged action is re-checked by the backend
 * and every read by the security rules.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [globalRoles, setGlobalRoles] = useState<Set<GlobalRole>>(new Set());
  const [eventRoles, setEventRoles] = useState<Record<string, EventRole>>({});
  const [rolesLoaded, setRolesLoaded] = useState(0);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setAuthLoading(false);
      }),
    [],
  );

  useEffect(() => {
    setProfile(null);
    setGlobalRoles(new Set());
    setEventRoles({});
    setRolesLoaded(0);
    if (!user) return;
    const done = () => setRolesLoaded((n) => n + 1);
    const unsubs = [
      onValue(ref(db, paths.user(user.uid)), (s) => setProfile(s.val() as UserProfile | null), () => setProfile(null)),
      onValue(
        ref(db, paths.roles(user.uid)),
        (s) => {
          const v = (s.val() as Record<string, boolean> | null) ?? {};
          setGlobalRoles(new Set(Object.keys(v).filter((k) => v[k] === true) as GlobalRole[]));
          done();
        },
        done,
      ),
      onValue(
        ref(db, paths.staffEvents(user.uid)),
        (s) => {
          setEventRoles((s.val() as Record<string, EventRole> | null) ?? {});
          done();
        },
        done,
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [user]);

  const value = useMemo<AuthState>(
    () => ({ user, profile, globalRoles, eventRoles, loading: authLoading || (user !== null && rolesLoaded < 2) }),
    [user, profile, globalRoles, eventRoles, authLoading, rolesLoaded],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

/** UI permission helpers (the backend enforces the same rules). */
export function usePermissions(eventId?: string | null) {
  const { globalRoles, eventRoles } = useAuth();
  const role = eventId ? eventRoles[eventId] : undefined;
  return {
    isDeviceAdmin: globalRoles.has("deviceAdmin"),
    isResearchAdmin: globalRoles.has("researchAdmin"),
    eventRole: role ?? null,
    isOperator: role === "eventOperator",
    isMedical: role === "medicalResponder",
    isEventStaff: role === "eventOperator" || role === "medicalResponder",
    isStaff: globalRoles.size > 0 || Object.keys(eventRoles).length > 0,
  };
}
