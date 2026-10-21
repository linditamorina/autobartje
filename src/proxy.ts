import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Public pages only; /admin, /driver, /portal, /developers, /api and static files are not localised in the URL.
  matcher: ["/((?!api|admin|driver|portal|developers|_next|_vercel|.*\\..*).*)"],
};
