import { onAuthStateChanged, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { auth } from "@/config/firebase";
import { fetchUserProfile } from "@/services/authService";
import type { UserProfile } from "@/types";

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, profile: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, profile: null, loading: true });

  useEffect(
    () =>
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          setState({ user: null, profile: null, loading: false });
          return;
        }
        setState((s) => ({ ...s, loading: true }));
        try {
          const profile = await fetchUserProfile(user.uid);
          setState({ user, profile, loading: false });
        } catch (err) {
          console.error("Failed to load user profile", err);
          setState({ user, profile: null, loading: false });
        }
      }),
    [],
  );

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
