import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "./auth";
import type { AllowedUser } from "./types";

// shown when an action finds the session has gone
export const NOT_LOGGED_IN = "You're not logged in. Reload the page to log in again.";

// for pages and actions that redirect: the signed-in user, or off to the login page
export async function requireUser(): Promise<AllowedUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

// for admin-only pages and actions: the admin, or back to the home page
export async function requireAdmin(): Promise<AllowedUser> {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) {
    redirect("/");
  }
  return user;
}
