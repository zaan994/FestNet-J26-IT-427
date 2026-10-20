import { onValue, ref } from "firebase/database";
import { useEffect, useState } from "react";

import { db } from "@/config/firebase";

/** Browser ↔ Firebase connection (".info/connected"). Unknown until the first callback. */
export function useConnection(): "connected" | "disconnected" | "unknown" {
  const [state, setState] = useState<"connected" | "disconnected" | "unknown">("unknown");
  useEffect(() => onValue(ref(db, ".info/connected"), (s) => setState(s.val() === true ? "connected" : "disconnected")), []);
  return state;
}
