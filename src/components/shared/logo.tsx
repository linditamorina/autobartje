import Image from "next/image";
import { cn } from "@/lib/utils";
import type { Brand } from "@/server/settings";

export function Logo({ brand, className }: { brand: Brand; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image src={brand.logoUrl} alt="" width={40} height={40} className="size-10 rounded-lg" priority unoptimized={brand.logoUrl.endsWith(".svg")} />
      <span className="text-lg font-extrabold sm:text-xl tracking-tight">{brand.name}</span>
    </span>
  );
}
