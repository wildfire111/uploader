import { requireUser } from "@/lib/guards";
import { ImportForm } from "./ImportForm";

export default async function ImportEventPage() {
  await requireUser();

  return (
    <main>
      <h1>Import event from Melee PDF</h1>
      <ImportForm />
    </main>
  );
}
