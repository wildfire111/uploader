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
