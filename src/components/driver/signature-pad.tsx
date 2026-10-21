"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

/** Finger signature on a canvas, submitted as a PNG data URL in a hidden input. */
export function SignaturePad({ name }: { name: string }) {
  const t = useTranslations("Driver");
  const canvas = useRef<HTMLCanvasElement>(null);
  const [value, setValue] = useState("");
  const drawing = useRef(false);

  useEffect(() => {
    const c = canvas.current!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  return (
    <div>
      <canvas
        ref={canvas}
        aria-label={t("signHere")}
        role="img"
        className="h-48 w-full touch-none rounded-lg border-2 border-dashed border-border bg-white"
        onPointerDown={(e) => {
          drawing.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          const ctx = e.currentTarget.getContext("2d")!;
          ctx.beginPath();
          ctx.moveTo(...point(e));
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = e.currentTarget.getContext("2d")!;
          ctx.lineTo(...point(e));
          ctx.stroke();
        }}
        onPointerUp={(e) => {
          drawing.current = false;
          setValue(e.currentTarget.toDataURL("image/png"));
        }}
      />
      <div className="mt-2 flex items-center justify-between gap-2 text-base">
        <span className="text-muted-foreground">{value ? t("signed") : t("signHere")}</span>
        <button
          type="button"
          className="min-h-12 rounded-lg px-3 font-semibold underline"
          onClick={() => {
            const c = canvas.current!;
            c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
            setValue("");
          }}
        >
          {t("clear")}
        </button>
      </div>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
