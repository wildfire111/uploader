import { requestMagicLink } from "@/lib/actions/auth";
import { SubmitButton } from "./SubmitButton";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  return (
    <main className="flex min-h-[calc(100vh-var(--site-header-height))] items-center justify-center">
      <div className="w-full max-w-sm rounded-lg border border-line bg-panel p-6">
        <h1>Log in</h1>
        {sent === "1" ? (
          <p className="mb-0">Check your email for a login link.</p>
        ) : (
          <form action={requestMagicLink}>
            <label htmlFor="email">Email</label>
            <input type="email" id="email" name="email" required autoFocus />
            <SubmitButton idleText="Send login link" pendingText="Sending…" />
          </form>
        )}
      </div>
    </main>
  );
}
