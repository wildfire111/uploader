"use server";

import { headers } from "next/headers";
import { actionError, actionOk, type ActionResult } from "@/lib/actionResult";
import { isShareLink, randomShortName } from "@/lib/shareLink";

// Public, as the sideboard guide is: swaps a share link for an is.gd one, which needs no account or
// key, named thoughtcast plus random characters. Only this site's own share links are sent on.
// is.gd reports a refusal in a 200 reply.
export async function shortenShareLinkAction(link: string): Promise<ActionResult<string>> {
  if (!isShareLink(link, (await headers()).get("host"))) {
    return actionError("That isn't a share link.");
  }

  try {
    let failure = "";
    // a name that is already taken is the one error worth trying again with a new name
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetch("https://is.gd/create.php", {
        method: "POST",
        body: new URLSearchParams({ format: "json", url: link, shorturl: randomShortName() }),
        signal: AbortSignal.timeout(10_000),
      });
      const body = (await response.json().catch(() => null)) as {
        shorturl?: unknown;
        errorcode?: unknown;
        errormessage?: unknown;
      } | null;
      if (response.ok && typeof body?.shorturl === "string") {
        return actionOk(body.shorturl);
      }
      failure = typeof body?.errormessage === "string" ? body.errormessage : `status ${response.status}`;
      if (body?.errorcode !== 2) {
        break;
      }
    }
    return actionError(`is.gd didn't shorten the link (${failure}).`);
  } catch {
    return actionError("Couldn't reach is.gd.");
  }
}
