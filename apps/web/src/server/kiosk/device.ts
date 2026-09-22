import "server-only";
import { cookies } from "next/headers";
import { createAnonClient } from "@koryo/db/anon";

export const KIOSK_COOKIE = "kg-kiosk";

export async function kioskToken(): Promise<string | null> {
  const v = (await cookies()).get(KIOSK_COOKIE)?.value;
  return v && v.length >= 32 ? v : null;
}

export interface KioskInfo {
  deviceName: string;
  tenantName: string;
  locationName: string;
  confirmMode: "pin" | "photo";
  timeZone: string;
}

/** The paired device's info, or null when this browser isn't a (still valid) kiosk. */
export async function kioskInfo(): Promise<KioskInfo | null> {
  const token = await kioskToken();
  if (!token) return null;
  const { data, error } = await createAnonClient().rpc("kiosk_info", { p_token: token });
  const row = data?.[0];
  if (error || !row) return null;
  return {
    deviceName: row.device_name,
    tenantName: row.tenant_name,
    locationName: row.location_name,
    confirmMode: row.confirm_mode === "photo" ? "photo" : "pin",
    timeZone: row.time_zone,
  };
}
