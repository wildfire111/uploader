import { SummoningCircle } from "./SummoningCircle";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  return (
    <main className="flex min-h-[calc(100svh-var(--site-header-height))] items-center justify-center">
      <SummoningCircle sent={sent === "1"} />
    </main>
  );
}
