"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { normaliseEmail } from "@/lib/normaliseEmail";

export async function requestMagicLink(formData: FormData): Promise<void> {
  const rawEmail = formData.get("email");
  const email = typeof rawEmail === "string" ? normaliseEmail(rawEmail) : "";

  if (email !== "") {
    // same redirect whether or not the email is whitelisted, so this can't be used to probe
    await auth.api.signInMagicLink({ body: { email }, headers: await headers() });
  }

  redirect("/login?sent=1");
}

// a POST, since prefetching a link would log people out
export async function logout(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}
