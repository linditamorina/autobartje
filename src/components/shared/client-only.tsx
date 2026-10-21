"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Renders children only in the browser. Used for forms that restore a saved
 * draft from localStorage, so the server and first client render never disagree.
 */
export function ClientOnly({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  return mounted ? children : fallback;
}
