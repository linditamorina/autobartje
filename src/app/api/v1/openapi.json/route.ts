import { NextResponse } from "next/server";
import { openApiSpec } from "@/server/partner/openapi";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(openApiSpec(siteUrl()), { headers: { "access-control-allow-origin": "*" } });
}
