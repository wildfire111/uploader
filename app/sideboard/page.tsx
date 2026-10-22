import type { Metadata } from "next";
import { RefreshingData } from "@/app/RefreshingData";
import { landsList, staleListNames } from "@/lib/referenceLists";
import { SideboardClient } from "./SideboardClient";

// reads the stored land list on each visit
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sideboard guide",
  description: "Plan your sideboarding for each matchup and print it on one page",
};

export default async function SideboardPage() {
  const [lands, stale] = await Promise.all([landsList.get(), staleListNames([landsList])]);
  return (
    <>
      <RefreshingData names={stale} />
      <SideboardClient landNames={lands?.data ?? null} />
    </>
  );
}
