"use server";

import { headers } from "next/headers";
import { actionError, actionOk, type ActionResult } from "@/lib/actionResult";
import { isShareLink } from "@/lib/shareLink";

// Public, as the sideboard guide is: swaps a share link for a TinyURL one. The token stays on the
// server, and only this site's own share links are sent on.
export async function shortenShareLinkAction(link: string): Promise<ActionResult<string>> {
  const token = process.env.TINYURL_API_TOKEN;
  if (!token) {
    return actionError("Link shortening isn't set up.");
  }
  if (!isShareLink(link, (await headers()).get("host"))) {
    return actionError("That isn't a share link.");
  }

  try {
    const response = await fetch("https://api.tinyurl.com/create", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: link }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await response.json().catch(() => null)) as { data?: { tiny_url?: unknown } } | null;
    const shortUrl = body?.data?.tiny_url;
    if (!response.ok || typeof shortUrl !== "string") {
      return actionError(`TinyURL didn't shorten the link (${response.status}).`);
    }
    return actionOk(shortUrl);
  } catch {
    return actionError("Couldn't reach TinyURL.");
  }
}
