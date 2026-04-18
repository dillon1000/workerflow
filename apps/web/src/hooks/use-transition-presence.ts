import { useEffect, useReducer } from "react";

export type TransitionState = "open" | "closing";

interface PresenceData {
  mounted: boolean;
  state: TransitionState;
}

type PresenceAction =
  | { type: "open:start" }
  | { type: "open:finish" }
  | { type: "close:start" }
  | { type: "close:finish" };

function reducePresence(
  current: PresenceData,
  action: PresenceAction,
): PresenceData {
  switch (action.type) {
    case "open:start":
      return { mounted: true, state: current.state };
    case "open:finish":
      return { mounted: true, state: "open" };
    case "close:start":
      return { mounted: current.mounted, state: "closing" };
    case "close:finish":
      return { mounted: false, state: "open" };
    default:
      return current;
  }
}

/**
 * Delays unmounting until a close animation finishes. Returns whether the
 * element should be mounted and the current data-state attribute value.
 */
export function useTransitionPresence(open: boolean, exitMs: number) {
  const [{ mounted, state }, dispatch] = useReducer(reducePresence, {
    mounted: open,
    state: "open",
  });

  useEffect(() => {
    if (open) {
      dispatch({ type: "open:start" });
      // Defer to next frame so CSS transitions re-trigger on re-open.
      const frame = requestAnimationFrame(() =>
        dispatch({ type: "open:finish" }),
      );
      return () => cancelAnimationFrame(frame);
    }
    if (!mounted) return;
    dispatch({ type: "close:start" });
    const timeout = window.setTimeout(() => {
      dispatch({ type: "close:finish" });
    }, exitMs);
    return () => window.clearTimeout(timeout);
  }, [open, mounted, exitMs]);

  return { mounted, state };
}
