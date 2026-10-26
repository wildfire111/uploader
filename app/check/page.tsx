import type { Metadata } from "next";
import { RefreshingData } from "@/app/RefreshingData";
import {
  cardAliasesList,
  cardNamesList,
  companionsList,
  pointsList,
  reservedList,
  staleListNames,
} from "@/lib/referenceLists";
import { CheckClient } from "./CheckClient";

// reads the stored lists on each visit
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Decklist checker",
  description: "Check the decklists in a Melee decklist PDF for errors",
};

export default async function CheckPage() {
  const [points, reserved, cardNames, aliases, companions, stale] = await Promise.all([
    pointsList.get(),
    reservedList.get(),
    cardNamesList.get(),
    cardAliasesList.get(),
    companionsList.get(),
    staleListNames([pointsList, reservedList, cardNamesList, cardAliasesList, companionsList]),
  ]);

  return (
    <>
      <RefreshingData names={stale} />
      <CheckClient
        pointsList={points?.data ?? null}
        reservedNames={reserved?.data ?? null}
        aliasList={aliases?.data ?? null}
        companionNames={companions?.data ?? null}
        cardNamesVersion={cardNames?.fetchedAt.getTime() ?? null}
      />
    </>
  );
}
