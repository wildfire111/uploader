"use server";

import { headers } from "next/headers";
import { actionError, actionOk, type ActionResult } from "@/lib/actionResult";
import { isShareLink } from "@/lib/shareLink";

// Public, as the sideboard guide is: swaps a share link for an is.gd one, which needs no account or
// key. Only this site's own share links are sent on. is.gd reports a refusal in a 200 reply.
export async function shortenShareLinkAction(link: string): Promise<ActionResult<string>> {
  if (!isShareLink(link, (await headers()).get("host"))) {
    return actionError("That isn't a share link.");
  }

  try {
    const response = await fetch("https://is.gd/create.php", {
      method: "POST",
      body: new URLSearchParams({ format: "json", url: link }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await response.json().catch(() => null)) as { shorturl?: unknown; errormessage?: unknown } | null;
    if (!response.ok || typeof body?.shorturl !== "string") {
      const reason = typeof body?.errormessage === "string" ? body.errormessage : `status ${response.status}`;
      return actionError(`is.gd didn't shorten the link (${reason}).`);
    }
    return actionOk(body.shorturl);
  } catch {
    return actionError("Couldn't reach is.gd.");
  }
}
