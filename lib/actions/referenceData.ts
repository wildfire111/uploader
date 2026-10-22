"use server";

import { actionError, actionOk, type ActionResult } from "@/lib/actionResult";
import { requireAdmin } from "@/lib/guards";
import { referenceLists } from "@/lib/referenceLists";

export async function refreshReferenceListAction(
  name: string
): Promise<ActionResult<{ count: number }>> {
  await requireAdmin();

  const list = referenceLists.find((candidate) => candidate.name === name);
  if (!list) {
    return actionError("Unknown list.");
  }
  try {
    return actionOk({ count: await list.refreshNow() });
  } catch (error) {
    return actionError(error instanceof Error ? error.message : "Something went wrong.");
  }
}

// Called by <RefreshingData> while it holds the page behind its popup. No login is needed, as the
// sideboard guide is public: it only ever fetches a list that is stale and hasn't been tried in the
// last hour, so calling it repeatedly does nothing more.
export async function refreshStaleListsAction(names: string[]): Promise<void> {
  for (const list of referenceLists) {
    if (names.includes(list.name)) {
      await list.refreshIfStale();
    }
  }
}
