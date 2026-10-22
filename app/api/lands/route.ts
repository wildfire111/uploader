import { NextResponse } from "next/server";
import { landsList } from "@/lib/referenceLists";

// The sideboard guide is public, so no login is needed, and this only reads the stored copy: a
// public page must never be able to set off requests to Scryfall. It is kept fresh by
// /api/card-names, which a logged-in user's event page calls, and an admin can refresh it on
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
