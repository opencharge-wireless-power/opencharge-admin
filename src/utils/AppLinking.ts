// src/utils/appLinking.ts
import type { DocumentData } from "firebase/firestore";

export type AppSessionFields = {
  appLinked?: boolean;
  appBatteryDelta?: number;
  appDeviceMake?: string;
  appDeviceModel?: string;
  appLocationId?: string;
  appIsWireless?: boolean;
  appPluggedType?: string;
  appUserId?: string;
  appPlatform?: string; // optional if you store it
};

export function extractAppSessionFields(data: DocumentData): AppSessionFields {
  return {
    appLinked: data.appLinked as boolean | undefined,
    appBatteryDelta:
      typeof data.appBatteryDelta === "number" ? data.appBatteryDelta : undefined,
    appDeviceMake: data.appDeviceMake as string | undefined,
    appDeviceModel: data.appDeviceModel as string | undefined,
    appLocationId: data.appLocationId as string | undefined,
    appIsWireless: data.appIsWireless as boolean | undefined,
    appPluggedType: data.appPluggedType as string | undefined,
    appUserId: data.appUserId as string | undefined,
    appPlatform: data.appPlatform as string | undefined,
  };
}

/**
 * Single source of truth for "does this session have app info?"
 * (We treat any of these fields as proof of app linkage.)
 */
export function isSessionAppLinked(data: DocumentData): boolean {
  return Boolean(
    data.appLinked === true ||
      data.appDeviceMake ||
      data.appDeviceModel ||
      data.appUserId ||
      data.appBatteryDelta != null ||
      data.appIsWireless != null ||
      data.appPluggedType
  );
}