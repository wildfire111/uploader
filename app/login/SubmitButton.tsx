"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ idleText, pendingText }: { idleText: string; pendingText: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" data-variant="primary" disabled={pending}>
      {pending ? pendingText : idleText}
    </button>
  );
}
