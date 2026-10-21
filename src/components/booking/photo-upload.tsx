"use client";

import { useEffect, useId, useState } from "react";
import { Camera, X } from "lucide-react";
import { useTranslations } from "next-intl";

const MAX_PHOTOS = 8;
const MAX_EDGE = 1600;

/** Shrinks a photo in the browser before upload (faster on 4G, less data stored). */
async function resize(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/heic") return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.82));
}

export function PhotoUpload({ keys, onChange }: { keys: string[]; onChange: (keys: string[]) => void }) {
  const t = useTranslations("Booking");
  const id = useId();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/uploads/presign")
      .then((r) => r.json())
      .then((d: { enabled: boolean }) => setEnabled(d.enabled))
      .catch(() => setEnabled(false));
  }, []);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const added: string[] = [];
    for (const file of Array.from(files).slice(0, MAX_PHOTOS - keys.length)) {
      try {
        const blob = await resize(file);
        const contentType = blob.type || "image/jpeg";
        const res = await fetch("/api/uploads/presign", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contentType, size: blob.size }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const { key, url } = (await res.json()) as { key: string; url: string };
        const put = await fetch(url, { method: "PUT", headers: { "content-type": contentType }, body: blob });
        if (!put.ok) throw new Error(String(put.status));
        added.push(key);
        setPreviews((p) => ({ ...p, [key]: URL.createObjectURL(blob) }));
      } catch {
        setError(t("uploadFailed"));
      }
    }
    onChange([...keys, ...added]);
    setBusy(false);
  }

  if (enabled === false) return <p className="text-sm text-muted-foreground">{t("photosUnavailable")}</p>;

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{t("photos")}</p>
      <p className="text-sm text-muted-foreground" id={`${id}-h`}>{t("photosHelp")}</p>
      <ul className="flex flex-wrap gap-2">
        {keys.map((k, i) => (
          <li key={k} className="relative size-20 overflow-hidden rounded-lg border border-border bg-muted">
            {previews[k] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previews[k]} alt="" className="size-full object-cover" />
            )}
            <button
              type="button"
              onClick={() => onChange(keys.filter((x) => x !== k))}
              className="absolute right-0 top-0 inline-flex size-8 items-center justify-center rounded-bl-lg bg-destructive text-destructive-foreground"
              aria-label={t("removePhoto", { n: i + 1 })}
            >
              <X className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      {keys.length < MAX_PHOTOS && (
        <label
          htmlFor={id}
          className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed border-input px-4 font-semibold has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ring"
        >
          <Camera aria-hidden className="size-5" /> {busy ? t("uploading") : t("addPhoto")}
          <input
            id={id}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            disabled={busy || !enabled}
            aria-describedby={`${id}-h`}
            className="sr-only"
            onChange={(e) => {
              void upload(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
    </div>
  );
}
