import { NextResponse } from "next/server";
import { pointsList } from "@/lib/referenceLists";

// no login needed: this is public card data, and the decklist checker is open to anyone
export async function GET() {
  return NextResponse.json({ points: (await pointsList.get())?.data ?? null });
}
