import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { pointsList } from "@/lib/referenceLists";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }
  return NextResponse.json({ points: (await pointsList.refreshIfStale())?.data ?? null });
}
