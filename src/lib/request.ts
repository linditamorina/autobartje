/** Keeps only the network part of an IP (data minimisation): 203.0.113.42 → 203.0.113.0, IPv6 → first 3 groups. */
export function truncateIp(forwardedFor: string | null): string | null {
  const ip = forwardedFor?.split(",")[0]?.trim();
  if (!ip) return null;
  if (ip.includes(".")) return ip.split(".").slice(0, 3).concat("0").join(".");
  return ip.split(":").slice(0, 3).join(":") + "::";
}
