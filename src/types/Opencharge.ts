// src/types/opencharge.ts

import type { DocumentData } from "firebase/firestore";

export interface OpenHours {
  [day: string]: string;
}

export interface Location {
  id: string;
  name: string;
  address?: string;
  city?: string;
  country?: string;
  category?: string;
  active: boolean;

  hasActivePromotion: boolean;
  hasActivePromotions: boolean;

  images: string[];

  lastAvailabilityUpdate?: Date;

  lat?: number;
  lng?: number;

  priority?: number;

  supportsOrdering: boolean;
  supportsPayments: boolean;
  supportsPromotions: boolean;

  totalSessions: number;
  unitInUse: number;
  unitTotal: number;

  openHours?: OpenHours;
}

export interface EditFormState {
  name: string;
  address: string;
  city: string;
  country: string;
  category: string;
  priority: string;
  lat: string;
  lng: string;
  active: boolean;
  supportsOrdering: boolean;
  supportsPayments: boolean;
  supportsPromotions: boolean;

  openHoursMon: string;
  openHoursTue: string;
  openHoursWed: string;
  openHoursThu: string;
  openHoursFri: string;
  openHoursSat: string;
  openHoursSun: string;
}


export interface UnitEditForm {
  id?: string; // present in edit mode
  name: string;
  position: string;
  status: string;
  inUse: boolean;
  totalSessions: string; // string in form, converted to number
}

export interface Session {
   // Firestore document id (chargesession doc)
  id: string;

  // From chargesessions
  unitId?: string;
  particleDeviceId?: string; // the "id" field in chargesessions
  deviceType?: string;
  mode?: string;

  // Derived / joined
  unitName?: string;
  locationId?: string;

  startedAt?: Date;
  endedAt?: Date;
  durationMinutes?: number;
  inProgress: boolean;
  raw?: DocumentData;
}

export interface Promotion {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  isActive: boolean;
  locationId?: string;
  priorityWeight?: number;
  qrPayload?: string;
  redemptionCode?: string;
  redemptionType?: string;
  termsAndConditions?: string;
  validFrom?: Date;
  validTo?: Date;
}

export interface UnitHealth {
  lastCalculated?: Date;
  needsMaintenance?: boolean;
  status?: string; // e.g. "ok", "warning", "critical"
}

export interface UnitMetrics {
  calculatedAt?: Date;
  faultRate?: number; // 0–1
  placementIssueRate?: number; // 0–1
  retryRate?: number; // 0–1
  successRate?: number; // 0–1
  totalInteractions?: number;
  totalSessions?: number;
}

export interface UnitInteractions {
  chargingStarted?: number;
  hardwareFault?: number;
  issueCleared?: number;
  placementIssue?: number;
  successfulCharge?: number;
}

export interface Unit {
  id: string;
  name: string;
  position?: string;
  status?: string; // "online" / "offline" etc.
  inUse?: boolean;

  // device state
  currentDeviceType?: string; // "Not_Charing" / "Samsung" etc.
  currentMode?: string; // "10W" / "Not_Charging" etc.

  // timestamps
  lastHeartbeat?: Date;
  lastInteraction?: Date;
  lastSessionTimestamp?: Date;

  // last interaction details
  lastInteractionType?: string; // "charging_started" etc.
  lastInteractionMode?: string;
  lastInteractionDeviceType?: string;

  // last session details
  lastSessionDuration?: number; // minutes
  lastSessionMode?: string;
  lastSessionDeviceType?: string;

  // aggregates
  totalSessions?: number;
  totalInteractions?: number;

  // Particle device id (useful for debugging)
  particleDeviceId?: string;

  // nested maps
  health?: UnitHealth;
  metrics?: UnitMetrics;
  interactions?: UnitInteractions;
}
export type DateFilter = "all" | "today" | "last7";

export type DateFilterSessions = "all" | "today" | "last7" | "last30";

export type CampaignStatus = "draft" | "active" | "paused" | "ended";

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  url: string;        // QR landing base URL
  targetUrl: string;  // final advertiser URL
  locationIds: string[];
  engagements: number;
  createdAt?: Date;
  startAt?: Date;
  endAt?: Date;
}

export interface CampaignLocation {
  id: string; // same as locationId
  locationId: string;
  qrUrl: string;
  status: "active" | "paused";
}

export interface UnitLookup {
  id: string;
  name: string;
  locationId?: string;
  particleDeviceId?: string;
}