"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signOut } from "@/server/auth/config";
import { requireDriver } from "@/server/auth/guard";
import { kickOutbox } from "@/server/notifications/kick";
import { advanceJob, DriverError, recordCash, removeInspectionPhoto, saveInspection } from "@/server/driver/jobs";
import { OrderError } from "@/server/orders/manage";
import { formReader } from "@/lib/form";

export type DriverState = { ok?: boolean; error?: string } | undefined;

async function guard(fn: () => Promise<unknown>): Promise<DriverState> {
  try {
    await fn();
    return { ok: true };
  } catch (err) {
    if (err instanceof DriverError || err instanceof OrderError) return { error: err.code };
    throw err;
  }
}

const coord = (v: string) => (v === "" || !Number.isFinite(Number(v)) ? undefined : Number(v));

export async function advanceAction(_: DriverState, form: FormData): Promise<DriverState> {
  const user = await requireDriver();
  const f = formReader(form);
  const orderId = f.str("orderId");
  const res = await guard(() => advanceJob(user.id, orderId, f.str("to"), { lat: coord(f.str("lat")), lng: coord(f.str("lng")) }));
  if (res?.ok) {
    kickOutbox();
    revalidatePath(`/driver/jobs/${orderId}`);
    revalidatePath("/driver");
  }
  return res;
}

const KINDS = ["PICKUP", "DELIVERY"] as const;

export async function saveInspectionAction(_: DriverState, form: FormData): Promise<DriverState> {
  const user = await requireDriver();
  const f = formReader(form);
  const parsed = z
    .object({
      orderId: z.string().min(1),
      kind: z.enum(KINDS),
      odometerKm: z.number().int().min(0).max(2_000_000).nullable(),
      fuelLevel: z.number().int().min(0).max(100).nullable(),
      notes: z.string().max(2000).nullable(),
      signerName: z.string().max(120).nullable(),
      signature: z.string().nullable(),
    })
    .safeParse({
      orderId: f.str("orderId"),
      kind: f.str("kind"),
      odometerKm: f.int("odometerKm"),
      fuelLevel: f.int("fuelLevel"),
      notes: f.opt("notes"),
      signerName: f.opt("signerName"),
      signature: f.opt("signature"),
    });
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;
  if (d.kind === "DELIVERY" && (!d.signature || !d.signerName)) return { error: "signature_required" };
  const png = d.signature?.startsWith("data:image/png;base64,") ? Buffer.from(d.signature.slice(22), "base64") : null;
  const res = await guard(() =>
    saveInspection(user.id, { orderId: d.orderId, kind: d.kind, odometerKm: d.odometerKm, fuelLevel: d.fuelLevel, notes: d.notes, signerName: d.signerName, signaturePng: png, lat: coord(f.str("lat")), lng: coord(f.str("lng")) }),
  );
  if (!res?.ok) return res;
  revalidatePath(`/driver/jobs/${d.orderId}`);
  redirect(`/driver/jobs/${d.orderId}`);
}

export async function removePhotoAction(_: DriverState, form: FormData): Promise<DriverState> {
  const user = await requireDriver();
  const f = formReader(form);
  const res = await guard(() => removeInspectionPhoto(user.id, f.str("photoId")));
  revalidatePath(`/driver/jobs/${f.str("orderId")}`, "layout");
  return res;
}

export async function recordCashAction(_: DriverState, form: FormData): Promise<DriverState> {
  const user = await requireDriver();
  const f = formReader(form);
  const amount = Number(f.str("amount").replace(",", "."));
  if (!Number.isFinite(amount)) return { error: "invalid_amount" };
  const orderId = f.str("orderId");
  const res = await guard(() => recordCash(user.id, orderId, Math.round(amount * 100)));
  if (res?.ok) revalidatePath(`/driver/jobs/${orderId}`);
  return res;
}

export async function driverLogoutAction() {
  await signOut({ redirectTo: "/admin/login" });
}
