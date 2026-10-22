import type { Metadata } from "next";
import { SideboardClient } from "./SideboardClient";

export const metadata: Metadata = {
  title: "Sideboard guide",
  description: "Plan your sideboarding for each matchup and print it on one page",
};

export default function SideboardPage() {
  return <SideboardClient />;
}
