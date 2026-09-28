"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { normaliseEmail } from "@/lib/normaliseEmail";
import { canRemoveOrDemoteUser } from "@/lib/permissions";
import { addAllowedUser, removeAllowedUser, setAllowedUserAdmin } from "@/lib/queries/allowedUsers";
import type { AllowedUser } from "@/lib/types";

async function requireAdmin(): Promise<AllowedUser> {
  const user = await getCurrentUser(await headers());
  if (!user || !user.isAdmin) {
    redirect("/");
  }
  return user;
}

export async function addAllowedUserAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const email = normaliseEmail(String(formData.get("email") ?? ""));
  const isAdmin = formData.get("isAdmin") === "on";

  if (email !== "") {
    await addAllowedUser(email, isAdmin);
  }

  redirect("/admin/users");
}

const CANNOT_CHANGE_SELF_MESSAGE =
  "You can't remove or demote yourself. Ask another admin to do it.";

function redirectWithError(message: string): never {
  redirect(`/admin/users?error=${encodeURIComponent(message)}`);
}

export async function removeAllowedUserAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const email = String(formData.get("email") ?? "");
  if (!canRemoveOrDemoteUser(admin, email)) {
    redirectWithError(CANNOT_CHANGE_SELF_MESSAGE);
  }
  await removeAllowedUser(email);

  redirect("/admin/users");
}

export async function toggleAdminAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const email = String(formData.get("email") ?? "");
  const currentlyAdmin = formData.get("isAdmin") === "true";
  if (currentlyAdmin && !canRemoveOrDemoteUser(admin, email)) {
    redirectWithError(CANNOT_CHANGE_SELF_MESSAGE);
  }
  await setAllowedUserAdmin(email, !currentlyAdmin);

  redirect("/admin/users");
}
