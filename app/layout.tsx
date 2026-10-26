import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";
import localFont from "next/font/local";
import Image from "next/image";
import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
import { logout } from "@/lib/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import "./globals.css";

const displayFace = localFont({
  src: "../public/fonts/Beleren2016-Bold.ttf",
  weight: "700",
  variable: "--font-title",
});
const bodyFace = Source_Sans_3({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Event Results Tool",
  description: "Event results and decklist entry for Moxfield publishing",
};

const HEADER_TEXT =
  "font-display font-bold text-black [text-shadow:0_0_3px_white,0_0_3px_white,0_0_6px_white,0_0_6px_white,1px_1px_2px_white,-1px_-1px_2px_white,1px_-1px_2px_white,-1px_1px_2px_white]";

// sets the theme before the first paint: the saved choice, else the system setting
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();

  return (
    <html
      lang="en"
      className={`${displayFace.variable} ${bodyFace.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <header className="sticky top-0 z-50 flex h-[65px] items-center justify-between gap-3 border-b-[3px] border-rule bg-[url('/navbarbg.png')] bg-[length:auto_100%] bg-repeat-x px-6">
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
            <nav
              className={`mr-auto ml-6 flex items-center gap-3 ${HEADER_TEXT}`}
            >
              <Link
                href="/admin/moxfield"
                className="text-black hover:text-neutral-700"
              >
                Moxfield Settings
              </Link>
              <span aria-hidden="true">|</span>
              <Link
                href="/admin/users"
                className="text-black hover:text-neutral-700"
              >
                Manage Users
              </Link>
              <span aria-hidden="true">|</span>
              <Link
                href="/admin/reference-data"
                className="text-black hover:text-neutral-700"
              >
                Reference Data
              </Link>
            </nav>
          ) : null}
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            {user ? (
              <div className="flex items-center gap-3">
                <span className={HEADER_TEXT}>{user.email}</span>
                <form action={logout} className="form-inline">
                  <button type="submit" className="font-display font-bold">
                    Log out
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
