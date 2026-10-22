import { NextResponse } from "next/server";
import { landsList } from "@/lib/referenceLists";

// The sideboard guide is public, so no login is needed, and this only reads the stored copy: a
// public page must never be able to set off requests to Scryfall. An admin fills it in on
// /admin/reference-data.
export async function GET() {
  const stored = await landsList.get();
  return NextResponse.json(
    { names: stored?.data ?? null },
    {
      headers: {
        "Cache-Control": stored ? "public, max-age=3600" : "no-store",
      },
    },
  );
}
