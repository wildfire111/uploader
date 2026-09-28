import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { logout } from "@/lib/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Event Results Tool",
  description: "Event results and decklist entry for Moxfield publishing",
};

const HEADER_TEXT =
  "font-medium text-black [text-shadow:1px_1px_2px_white,-1px_-1px_2px_white,1px_-1px_2px_white,-1px_1px_2px_white]";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser(await headers());

  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-50 flex h-[65px] items-center justify-between gap-3 border-b border-line bg-[url('/navbarbg.png')] bg-[length:auto_100%] bg-repeat-x px-6">
          <Link href="/" className="flex h-full items-center">
            <Image
              src="/thoughtcast-logo.png"
              alt="Event Results Tool home"
              width={203}
              height={65}
              priority
              className="h-full w-auto"
            />
          </Link>
          {user?.isAdmin ? (
            <nav className={`mr-auto ml-6 flex items-center gap-3 ${HEADER_TEXT}`}>
              <Link href="/admin/moxfield" className="text-black hover:text-neutral-700">
                Moxfield Settings
              </Link>
              <span aria-hidden="true">|</span>
              <Link href="/admin/users" className="text-black hover:text-neutral-700">
                Manage Users
              </Link>
            </nav>
          ) : null}
          {user ? (
            <div className="flex items-center gap-3">
              <span className={HEADER_TEXT}>{user.email}</span>
              <form action={logout} className="form-inline">
                <button type="submit">Log out</button>
              </form>
            </div>
          ) : null}
        </header>
        {children}
      </body>
    </html>
  );
}
