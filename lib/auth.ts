import "server-only";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { headers } from "next/headers";
import { pool } from "./db";
import { sendEmail } from "./email";
import { isLoginLinkAllowed, WINDOW_SECONDS } from "./loginThrottle";
import { normaliseEmail } from "./normaliseEmail";
import { getAllowedUser } from "./queries/allowedUsers";
import type { AllowedUser } from "./types";

// previews get a new url each deploy, so they use VERCEL_URL
const baseURL = process.env.BETTER_AUTH_URL ?? `https://${process.env.VERCEL_URL}`;

export const auth = betterAuth({
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  rateLimit: { enabled: true },
  database: pool,
  plugins: [
    magicLink({
      expiresIn: 15 * 60,
      // the routes are public, so the whitelist check has to live here
      sendMagicLink: async ({ email, url }) => {
        const normalisedEmail = normaliseEmail(email);
        const allowedUser = await getAllowedUser(normalisedEmail);
        if (!allowedUser) {
          return;
        }

        // callers aren't told when this throttles; if counting fails, send anyway
        try {
          const { allowed, forEmail, total } = await isLoginLinkAllowed(normalisedEmail);
          if (!allowed) {
            console.warn(
              `Magic link not sent: throttled (${forEmail} for this address, ${total} total in the last ${WINDOW_SECONDS}s)`
            );
            return;
          }
        } catch (error) {
          console.error("Magic link throttle check failed; sending anyway:", error);
        }

        await sendEmail({
          to: normalisedEmail,
          subject: "Your Event Results Tool login link",
          text: `Click this link to log in:\n\n${url}\n\nThis link expires in 15 minutes. If you didn't request this, you can ignore this email.`,
        });
      },
    }),
    nextCookies(), // must be last
  ],
});

export async function getCurrentUser(): Promise<AllowedUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return null;
  }
  const normalisedEmail = normaliseEmail(session.user.email);
  return await getAllowedUser(normalisedEmail);
}
