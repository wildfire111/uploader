import type { TransitionStartFunction } from "react";

const UNEXPECTED_ERROR = "Something went wrong. Please try again.";

// Runs a server action inside a transition. Expected failures are reported by the action itself
// through setError; anything thrown becomes the shared message, so no caller needs a try/catch.
export function runAction(
  startTransition: TransitionStartFunction,
  setError: (message: string | null) => void,
  action: () => Promise<void>
): void {
  setError(null);
  startTransition(async () => {
    try {
      await action();
    } catch {
      setError(UNEXPECTED_ERROR);
    }
  });
}
