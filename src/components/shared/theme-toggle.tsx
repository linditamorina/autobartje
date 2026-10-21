"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";

/** Script run before paint so the page never flashes the wrong theme. */
export const themeInitScript = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export function ThemeToggle() {
  const t = useTranslations("Common");
  function toggle() {
    const dark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {}
  }
  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex size-12 items-center justify-center rounded-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
      aria-label={`${t("theme")}: ${t("light")} / ${t("dark")}`}
    >
      <Sun className="size-5 dark:hidden" aria-hidden />
      <Moon className="hidden size-5 dark:block" aria-hidden />
    </button>
  );
}
