import { signInWithEmailAndPassword, signOut as firebaseSignOut } from "firebase/auth";
import { get, ref } from "firebase/database";

import { auth, db } from "@/config/firebase";
import type { UserProfile } from "@/types";
import { paths } from "@shared/paths";

export function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function signOut() {
  return firebaseSignOut(auth);
}

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await get(ref(db, paths.user(uid)));
  return snap.exists() ? (snap.val() as UserProfile) : null;
}
