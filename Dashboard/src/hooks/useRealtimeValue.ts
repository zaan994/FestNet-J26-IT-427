import { onValue, ref } from "firebase/database";
import { useEffect, useState } from "react";

import { db } from "@/config/firebase";

interface RealtimeValue<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

/** Live value at an RTDB path. Pass null to skip subscribing. */
export function useRealtimeValue<T>(path: string | null): RealtimeValue<T> {
  const [state, setState] = useState<RealtimeValue<T>>({ data: null, loading: path !== null, error: null });

  useEffect(() => {
    if (path === null) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    return onValue(
      ref(db, path),
      (snap) => setState({ data: snap.val() as T | null, loading: false, error: null }),
      (error) => setState({ data: null, loading: false, error }),
    );
  }, [path]);

  return state;
}
