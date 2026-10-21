"use client";

import { useEffect } from "react";

/** Installs the driver app's service worker (offline screen, installable app). */
export function RegisterWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/driver-sw.js", { scope: "/driver" }).catch(() => {});
    }
  }, []);
  return null;
}
