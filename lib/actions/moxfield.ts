"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/guards";
import { setMoxfieldRefreshToken } from "@/lib/moxfieldAuth";
import { setMoxfieldUserAgent } from "@/lib/moxfieldUserAgent";

export async function saveMoxfieldTokenAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();

  const result = await setMoxfieldRefreshToken(String(formData.get("refreshToken") ?? ""), user.email);
  if (!result.ok) {
    redirect(`/admin/moxfield?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/admin/moxfield?saved=1");
}

export async function saveMoxfieldUserAgentAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();

  const result = await setMoxfieldUserAgent(String(formData.get("userAgent") ?? ""), user.email);
  if (!result.ok) {
    redirect(`/admin/moxfield?error=${encodeURIComponent(result.error)}`);
  }
  redirect("/admin/moxfield?saved=ua");
}
