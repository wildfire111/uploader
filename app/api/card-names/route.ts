import { NextResponse } from "next/server";
import { cardNamesList } from "@/lib/referenceLists";

const FOREVER = "private, max-age=31536000, immutable";

// ?v=<version> comes from the page. The version is in the URL, so the browser can keep a copy
// until the list changes. No login is needed: this is public card data, and the decklist checker
// is open to anyone.
export async function GET(request: Request) {
  const asked = new URL(request.url).searchParams.get("v");

  // the page refreshes a stale list behind its popup before it asks for this
  const stored = await cardNamesList.get();
  if (!stored) {
    return NextResponse.json({ version: null }, { headers: { "Cache-Control": "no-store" } });
  }

  const version = stored.fetchedAt.getTime();
  // only a copy that matches what the URL says can be kept forever
  const cacheable = asked === String(version);
  return NextResponse.json(
    { version, names: stored.data },
    { headers: { "Cache-Control": cacheable ? FOREVER : "no-store" } }
  );
}
