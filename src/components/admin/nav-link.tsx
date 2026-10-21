"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({ href, exact, children }: { href: string; exact?: boolean; children: React.ReactNode }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn("flex min-h-12 items-center gap-3 rounded-lg px-3 font-semibold", active ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
    >
      {children}
    </Link>
  );
}
