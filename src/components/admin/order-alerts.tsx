"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

const POLL_MS = 10_000;

/** Two-tone siren beep with the Web Audio API (no audio file to download). */
function beep(ctx: AudioContext, urgent: boolean) {
  const tones = urgent ? [880, 660, 880, 660] : [660];
  tones.forEach((f, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = f;
    osc.connect(gain).connect(ctx.destination);
    const start = ctx.currentTime + i * 0.25;
    gain.gain.setValueAtTime(0.25, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
    osc.start(start);
    osc.stop(start + 0.23);
  });
}

/**
 * Polls for new orders while the admin panel is open. Browsers only allow sound
 * after a click, so the bell button turns alerts on (remembered per device).
 */
export function OrderAlerts() {
  const t = useTranslations("Admin.alerts");
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const since = useRef<number | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    since.current ??= Date.now();
    async function poll() {
      if (document.visibilityState === "visible" || enabled) {
        try {
          const res = await fetch(`/api/admin/alerts?since=${since.current}`, { cache: "no-store" });
          if (res.ok) {
            const data = (await res.json()) as { now: number; orders: { number: string; priority: string }[] };
            since.current = data.now;
            if (data.orders.length) {
              const urgent = data.orders.find((o) => o.priority === "URGENT");
              if (enabled && audio.current) beep(audio.current, Boolean(urgent));
              if (enabled && "Notification" in window && Notification.permission === "granted") {
                new Notification(urgent ? t("newUrgent", { number: urgent.number }) : t("newOrders", { count: data.orders.length }), { tag: "orders" });
              }
              router.refresh();
            }
          }
        } catch {}
      }
      timer = setTimeout(poll, POLL_MS);
    }
    timer = setTimeout(poll, POLL_MS);
    return () => clearTimeout(timer);
  }, [enabled, router, t]);

  async function enable() {
    audio.current ??= new AudioContext();
    await audio.current.resume();
    beep(audio.current, false);
    if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
    setEnabled(true);
  }

  return (
    <button
      type="button"
      onClick={enable}
      aria-pressed={enabled}
      title={enabled ? t("soundOn") : t("enableSound")}
      className="inline-flex size-12 items-center justify-center rounded-lg hover:bg-muted"
    >
      {enabled ? <BellRing aria-hidden className="size-5 text-success" /> : <Bell aria-hidden className="size-5" />}
      <span className="sr-only">{enabled ? t("soundOn") : t("enableSound")}</span>
    </button>
  );
}
