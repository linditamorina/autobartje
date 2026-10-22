"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { removePhotoAction, type DriverState } from "@/app/driver/actions";
import { currentPosition } from "./geo";

type Photo = { id: string; angle: string };

/** Shrinks a camera photo to at most 1600 px on the long side, as JPEG. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.82));
}

export function PhotoCapture({ orderId, kind, angles, required, photos }: { orderId: string; kind: "PICKUP" | "DELIVERY"; angles: readonly string[]; required: readonly string[]; photos: Photo[] }) {
  const t = useTranslations("Driver");
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, removeAction] = useActionState<DriverState, FormData>(async (s, f) => {
    const r = await removePhotoAction(s, f);
    router.refresh();
    return r;
  }, undefined);

  async function upload(angle: string, file: File | undefined) {
    if (!file) return;
    setBusy(angle);
    setError(null);
    try {
      const [blob, pos] = await Promise.all([shrink(file), currentPosition(3000)]);
      const data = new FormData();
      data.set("orderId", orderId);
      data.set("kind", kind);
      data.set("angle", angle);
      // Without a file time the server uses its own clock.
      if (file.lastModified) data.set("takenAt", new Date(file.lastModified).toISOString());
      if (pos) {
        data.set("lat", String(pos.lat));
        data.set("lng", String(pos.lng));
      }
      data.set("file", blob, "photo.jpg");
      const res = await fetch("/api/driver/photos", { method: "POST", body: data });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(t.has(`errors.${body.error}`) ? t(`errors.${body.error}` as never) : t("errors.upload"));
      }
      router.refresh();
    } catch {
      setError(t("errors.upload"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <ul className="grid grid-cols-2 gap-3">
        {angles.map((angle) => {
          const taken = photos.filter((p) => p.angle === angle);
          const needed = required.includes(angle);
          return (
            <li key={angle} className={cn("rounded-xl border-2 bg-card p-2", needed && !taken.length ? "border-amber-500" : "border-border")}>
              <p className="flex items-center gap-1 text-base font-bold">
                {taken.length > 0 && <Check aria-hidden className="size-5 text-success" />}
                {t(`angles.${angle}` as never)}
                {needed && <span className="sr-only">({t("required")})</span>}
              </p>
              {taken.map((p) => (
                <div key={p.id} className="relative mt-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked image route */}
                  <img src={`/api/files/inspection/${p.id}`} alt={t(`angles.${angle}` as never)} className="aspect-[4/3] w-full rounded-lg object-cover" />
                  <form action={removeAction} className="absolute right-1 top-1">
                    <input type="hidden" name="photoId" value={p.id} />
                    <input type="hidden" name="orderId" value={orderId} />
                    <button type="submit" aria-label={t("removePhoto")} className="grid size-11 place-items-center rounded-full bg-background/90 shadow">
                      <Trash2 aria-hidden className="size-5" />
                    </button>
                  </form>
                </div>
              ))}
              <label className={cn("mt-2 flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-3 font-semibold text-primary-foreground", busy && "opacity-60")}>
                <Camera aria-hidden className="size-5" />
                {busy === angle ? t("uploading") : taken.length ? t("addAnother") : t("takePhoto")}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  disabled={busy != null}
                  data-angle={angle}
                  onChange={(e) => {
                    void upload(angle, e.currentTarget.files?.[0]);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </li>
          );
        })}
      </ul>
      {error && <p role="alert" className="mt-3 font-semibold text-destructive">{error}</p>}
    </div>
  );
}
