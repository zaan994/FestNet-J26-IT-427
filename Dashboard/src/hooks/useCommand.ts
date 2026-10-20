import { useCallback, useState } from "react";

import { sendCommand } from "@/services/commands";
import type { CommandType } from "@/types";

interface CommandState<R> {
  pending: boolean;
  error: string | null;
  result: R | null;
}

/** Runs one backend command with pending / error / result state for the UI. */
export function useCommand<R = Record<string, unknown>>(type: CommandType) {
  const [state, setState] = useState<CommandState<R>>({ pending: false, error: null, result: null });
  const run = useCallback(
    async (payload: Record<string, unknown>): Promise<R | null> => {
      setState({ pending: true, error: null, result: null });
      try {
        const result = await sendCommand<R>(type, payload);
        setState({ pending: false, error: null, result });
        return result;
      } catch (err) {
        setState({ pending: false, error: err instanceof Error ? err.message : "The action failed.", result: null });
        return null;
      }
    },
    [type],
  );
  const reset = useCallback(() => setState({ pending: false, error: null, result: null }), []);
  return { ...state, run, reset };
}
