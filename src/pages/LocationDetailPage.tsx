// src/pages/LocationDetailPage.tsx
import { useEffect, useState, Fragment } from "react";
import type { FormEvent, ChangeEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp,
  orderBy,
  limit,
  type DocumentData,
  type Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { MainLayout } from "../components/layout/MainLayout";
import { useAuth } from "../hooks/useAuth";

import {
  Box,
  Typography,
  Chip,
  Card,
  CardContent,
  Divider,
  List,
  ListItem,
  ListItemText,
  Stack,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  Drawer,
  IconButton,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import CloseIcon from "@mui/icons-material/Close";

// Shared types & helpers
import type {
  Location,
  EditFormState,
  Unit,
  UnitEditForm,
  Session,
  Promotion,
  DateFilter,
  OpenHours,
  UnitHealth,
  UnitMetrics,
  UnitInteractions,
} from "../types/Opencharge";
import {
  formatDateTime,
  formatDurationMinutes,
  formatDateRange,
  formatShortDateTime,
  formatPercent,
  ORDERED_DAYS,
} from "../utils/Format";

// ---------- Component ----------

export function LocationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();
  const canEdit = role === "admin";

  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Location edit dialog
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Units
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [unitsError, setUnitsError] = useState<string | null>(null);

  // Unit add/edit dialog
  const [isUnitDialogOpen, setIsUnitDialogOpen] = useState(false);
  const [unitDialogMode, setUnitDialogMode] = useState<"add" | "edit">("add");
  const [unitForm, setUnitForm] = useState<UnitEditForm | null>(null);
  const [unitSaving, setUnitSaving] = useState(false);
  const [unitSaveError, setUnitSaveError] = useState<string | null>(null);

  // Sessions
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  // Session filters
  const [sessionsDateFilter, setSessionsDateFilter] =
    useState<DateFilter>("all");
  const [sessionsUnitFilter, setSessionsUnitFilter] = useState<string>("all");
  const [sessionsInProgressOnly, setSessionsInProgressOnly] =
    useState<boolean>(false);

  // Session detail drawer
  const [sessionDetailOpen, setSessionDetailOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  // Promotions
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [promotionsLoading, setPromotionsLoading] = useState(true);
  const [promotionsError, setPromotionsError] = useState<string | null>(null);

  // Images dialog
  const [imagesDialogOpen, setImagesDialogOpen] = useState(false);
  const [imagesText, setImagesText] = useState("");
  const [savingImages, setSavingImages] = useState(false);
  const [imagesError, setImagesError] = useState<string | null>(null);

  // ---------- Fetch LOCATION ----------
  useEffect(() => {
    const fetchLocation = async () => {
      if (!id) {
        setError("No location ID");
        setLoading(false);
        return;
      }

      try {
        const ref = doc(db, "locations", id);
        const snapshot = await getDoc(ref);

        if (!snapshot.exists()) {
          setError("Location not found");
          setLoading(false);
          return;
        }

        const data = snapshot.data() as DocumentData;

        const lastAvailabilityTs = data.lastAvailabilityUpdate as
          | Timestamp
          | undefined;

        const openHours =
          data.openHours && typeof data.openHours === "object"
            ? (data.openHours as OpenHours)
            : undefined;

        const images =
          Array.isArray(data.images) && data.images.length > 0
            ? (data.images as string[])
            : [];

        const loc: Location = {
          id: snapshot.id,
          name: (data.name as string) ?? "Unnamed location",

          address: (data.address as string | undefined) ?? "",
          city: (data.city as string | undefined) ?? "",
          country: (data.country as string | undefined) ?? "",
          category: (data.category as string | undefined) ?? "",
          active: (data.active as boolean | undefined) ?? false,

          hasActivePromotion:
            (data.hasActivePromotion as boolean | undefined) ?? false,
          hasActivePromotions:
            (data.hasActivePromotions as boolean | undefined) ?? false,

          images,
          lastAvailabilityUpdate: lastAvailabilityTs
            ? lastAvailabilityTs.toDate()
            : undefined,

          lat: typeof data.lat === "number" ? (data.lat as number) : undefined,
          lng: typeof data.lng === "number" ? (data.lng as number) : undefined,

          priority:
            typeof data.priority === "number"
              ? (data.priority as number)
              : undefined,

          supportsOrdering:
            (data.supportsOrdering as boolean | undefined) ?? false,
          supportsPayments:
            (data.supportsPayments as boolean | undefined) ?? false,
          supportsPromotions:
            (data.supportsPromotions as boolean | undefined) ?? false,

          totalSessions: (data.totalSessions as number | undefined) ?? 0,
          unitInUse: (data.unitInUse as number | undefined) ?? 0,
          unitTotal: (data.unitTotal as number | undefined) ?? 0,

          openHours,
        };

        setLocation(loc);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load location";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void fetchLocation();
  }, [id]);

  // ---------- Fetch UNITS ----------
  useEffect(() => {
    const fetchUnits = async () => {
      if (!id) {
        setUnitsLoading(false);
        return;
      }

      try {
        const unitsRef = collection(db, "units");
        const qUnits = query(unitsRef, where("locationId", "==", id));
        const snapshot = await getDocs(qUnits);

        const unitItems: Unit[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;

          const lastHeartbeatTs = data.lastHeartbeat as Timestamp | undefined;
          const lastInteractionTs = data.lastInteraction as Timestamp | undefined;
          const lastSessionTs = data.lastSessionTimestamp as Timestamp | undefined;

          const healthRaw = data.health as
            | {
                lastCalculated?: Timestamp;
                needsMaintenance?: boolean;
                status?: string;
              }
            | undefined;

          const metricsRaw = data.metrics as
            | {
                calculatedAt?: Timestamp;
                faultRate?: number;
                placementIssueRate?: number;
                retryRate?: number;
                successRate?: number;
                totalInteractions?: number;
                totalSessions?: number;
              }
            | undefined;

          const health: UnitHealth | undefined = healthRaw
            ? {
                lastCalculated: healthRaw.lastCalculated
                  ? healthRaw.lastCalculated.toDate()
                  : undefined,
                needsMaintenance: healthRaw.needsMaintenance ?? false,
                status: healthRaw.status,
              }
            : undefined;

          const metrics: UnitMetrics | undefined = metricsRaw
            ? {
                calculatedAt: metricsRaw.calculatedAt
                  ? metricsRaw.calculatedAt.toDate()
                  : undefined,
                faultRate:
                  typeof metricsRaw.faultRate === "number"
                    ? metricsRaw.faultRate
                    : undefined,
                placementIssueRate:
                  typeof metricsRaw.placementIssueRate === "number"
                    ? metricsRaw.placementIssueRate
                    : undefined,
                retryRate:
                  typeof metricsRaw.retryRate === "number"
                    ? metricsRaw.retryRate
                    : undefined,
                successRate:
                  typeof metricsRaw.successRate === "number"
                    ? metricsRaw.successRate
                    : undefined,
                totalInteractions:
                  typeof metricsRaw.totalInteractions === "number"
                    ? metricsRaw.totalInteractions
                    : undefined,
                totalSessions:
                  typeof metricsRaw.totalSessions === "number"
                    ? metricsRaw.totalSessions
                    : undefined,
              }
            : undefined;

          const interactions: UnitInteractions = {
            chargingStarted:
              typeof data["interactions.charging_started"] === "number"
                ? (data["interactions.charging_started"] as number)
                : undefined,
            hardwareFault:
              typeof data["interactions.hardware_fault"] === "number"
                ? (data["interactions.hardware_fault"] as number)
                : undefined,
            issueCleared:
              typeof data["interactions.issue_cleared"] === "number"
                ? (data["interactions.issue_cleared"] as number)
                : undefined,
            placementIssue:
              typeof data["interactions.placement_issue"] === "number"
                ? (data["interactions.placement_issue"] as number)
                : undefined,
            successfulCharge:
              typeof data["interactions.successful_charge"] === "number"
                ? (data["interactions.successful_charge"] as number)
                : undefined,
          };

          return {
            id: docSnap.id,
            name: (data.name as string) ?? "Unnamed unit",
            position: data.position as string | undefined,

            status: data.status as string | undefined,
            inUse:
              typeof data.inUse === "boolean" ? (data.inUse as boolean) : undefined,

            currentDeviceType: data.currentDeviceType as string | undefined,
            currentMode: data.currentMode as string | undefined,

            lastHeartbeat: lastHeartbeatTs ? lastHeartbeatTs.toDate() : undefined,
            lastInteraction: lastInteractionTs
              ? lastInteractionTs.toDate()
              : undefined,
            lastSessionTimestamp: lastSessionTs
              ? lastSessionTs.toDate()
              : undefined,

            lastInteractionType: data.lastInteractionType as string | undefined,
            lastInteractionMode: data.lastInteractionMode as string | undefined,
            lastInteractionDeviceType:
              (data.lastInteractionDeviceType as string | undefined) ?? undefined,

            lastSessionDuration:
              typeof data.lastSessionDuration === "number"
                ? (data.lastSessionDuration as number)
                : undefined,
            lastSessionMode: data.lastSessionMode as string | undefined,
            lastSessionDeviceType:
              (data.lastSessionDeviceType as string | undefined) ?? undefined,

            totalSessions:
              typeof data.totalSessions === "number"
                ? (data.totalSessions as number)
                : metrics?.totalSessions,
            totalInteractions:
              typeof data.totalInteractions === "number"
                ? (data.totalInteractions as number)
                : metrics?.totalInteractions,

            particleDeviceId: data.particleDeviceId as string | undefined,

            health,
            metrics,
            interactions,
          };
        });

        setUnits(unitItems);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load units";
        setUnitsError(message);
      } finally {
        setUnitsLoading(false);
      }
    };

    void fetchUnits();
  }, [id]);

// ---------- Fetch SESSIONS ----------
useEffect(() => {
  const fetchSessions = async () => {
    if (!id) {
      setSessionsLoading(false);
      return;
    }

    // If the location has no units, we can bail early
    if (!units || units.length === 0) {
      setSessions([]);
      setSessionsLoading(false);
      return;
    }

    setSessionsLoading(true);
    setSessionsError(null);

    try {
      // 1) Get latest chargesessions from Firestore
      const sessionsRef = collection(db, "chargesessions");
      const qSessions = query(
        sessionsRef,
        orderBy("start", "desc"),
        limit(200) // adjust as needed
      );

      const snapshot = await getDocs(qSessions);

      // 2) Index units for quick lookup by unitId
      const unitsById = new Map(units.map((u) => [u.id, u]));
      const locationUnitIds = new Set(units.map((u) => u.id));

      // 3) Build our Session objects, only keeping sessions
      //    whose unitId belongs to this location
      const items: Session[] = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data() as DocumentData;

          const startTs = data.start as Timestamp | undefined;
          const endTs = data.end as Timestamp | undefined;

          const startedAt = startTs ? startTs.toDate() : undefined;
          const endedAt = endTs ? endTs.toDate() : undefined;

          const durationMinutes =
            typeof data.duration === "number" ? data.duration : undefined;

          const inProgress = !endedAt;

          const unitId = data.unitId as string | undefined;
          const unit = unitId ? unitsById.get(unitId) : undefined;

          // If this session's unit does not belong to this location,
          // we'll drop it later in the filter step.
          return {
            id: docSnap.id,
            unitId,
            particleDeviceId: data.id as string | undefined,
            deviceType: data.deviceType as string | undefined,
            mode: data.mode as string | undefined,

            // joined fields
            unitName: unit?.name,
            locationId: id,

            startedAt,
            endedAt,
            durationMinutes,
            inProgress,
            raw: data,
          } as Session;
        })
        .filter((s) => !s.unitId || locationUnitIds.has(s.unitId)); // keep only this location's units

      setSessions(items);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load sessions";
      setSessionsError(message);
    } finally {
      setSessionsLoading(false);
    }
  };

  void fetchSessions();
}, [id, units]);

  // ---------- Fetch PROMOTIONS ----------
  useEffect(() => {
    const fetchPromotions = async () => {
      if (!id) {
        setPromotionsLoading(false);
        return;
      }

      try {
        const promotionsRef = collection(db, "promotions");
        const qPromos = query(promotionsRef, where("locationId", "==", id));
        const snapshot = await getDocs(qPromos);

        const items: Promotion[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;

          const validFromRaw = data.validFrom as number | Timestamp | undefined;
          const validToRaw = data.validTo as number | Timestamp | undefined;

          let validFrom: Date | undefined;
          let validTo: Date | undefined;

          if (typeof validFromRaw === "number") {
            validFrom = new Date(validFromRaw);
          } else if (
            validFromRaw &&
            typeof (validFromRaw as Timestamp).toDate === "function"
          ) {
            validFrom = (validFromRaw as Timestamp).toDate();
          }

          if (typeof validToRaw === "number") {
            validTo = new Date(validToRaw);
          } else if (
            validToRaw &&
            typeof (validToRaw as Timestamp).toDate === "function"
          ) {
            validTo = (validToRaw as Timestamp).toDate();
          }

          return {
            id: docSnap.id,
            title: (data.title as string) ?? "Untitled promotion",
            description: data.description as string | undefined,
            imageUrl: data.imageUrl as string | undefined,
            isActive: (data.isActive as boolean | undefined) ?? false,
            locationId: data.locationId as string | undefined,
            priorityWeight:
              typeof data.priorityWeight === "number"
                ? (data.priorityWeight as number)
                : undefined,
            qrPayload: data.qrPayload as string | undefined,
            redemptionCode: data.redemptionCode as string | undefined,
            redemptionType: data.redemptionType as string | undefined,
            termsAndConditions:
              (data.termsAndConditions as string | undefined) ?? undefined,
            validFrom,
            validTo,
          };
        });

        items.sort((a, b) => {
          const pa = a.priorityWeight ?? 0;
          const pb = b.priorityWeight ?? 0;
          if (pb !== pa) return pb - pa;
          const da = a.validFrom?.getTime() ?? 0;
          const db = b.validFrom?.getTime() ?? 0;
          return db - da;
        });

        setPromotions(items);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load promotions";
        setPromotionsError(message);
      } finally {
        setPromotionsLoading(false);
      }
    };

    void fetchPromotions();
  }, [id]);

  // ---------- LOCATION EDIT ----------
  const openEditDialog = () => {
    if (!location) return;

    const oh = location.openHours ?? {};

    const form: EditFormState = {
      name: location.name,
      address: location.address ?? "",
      city: location.city ?? "",
      country: location.country ?? "",
      category: location.category ?? "",
      priority: location.priority != null ? String(location.priority) : "",
      lat: location.lat != null ? String(location.lat) : "",
      lng: location.lng != null ? String(location.lng) : "",
      active: location.active,
      supportsOrdering: location.supportsOrdering,
      supportsPayments: location.supportsPayments,
      supportsPromotions: location.supportsPromotions,

      openHoursMon: oh.mon ?? "",
      openHoursTue: oh.tue ?? "",
      openHoursWed: oh.wed ?? "",
      openHoursThu: oh.thu ?? "",
      openHoursFri: oh.fri ?? "",
      openHoursSat: oh.sat ?? "",
      openHoursSun: oh.sun ?? "",
    };

    setEditForm(form);
    setSaveError(null);
    setIsEditOpen(true);
  };

  const closeEditDialog = () => {
    if (saving) return;
    setIsEditOpen(false);
  };

  const handleEditChange =
    (field: keyof EditFormState) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      if (!editForm) return;

      if (
        field === "active" ||
        field === "supportsOrdering" ||
        field === "supportsPayments" ||
        field === "supportsPromotions"
      ) {
        setEditForm({
          ...editForm,
          [field]: event.target.checked,
        });
      } else {
        setEditForm({
          ...editForm,
          [field]: event.target.value,
        });
      }
    };

  const handleEditSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!location || !editForm) return;

    setSaving(true);
    setSaveError(null);

    try {
      const ref = doc(db, "locations", location.id);

      const priorityNumber =
        editForm.priority.trim().length > 0
          ? Number(editForm.priority.trim())
          : null;

      const latNumber =
        editForm.lat.trim().length > 0 ? Number(editForm.lat.trim()) : null;
      const lngNumber =
        editForm.lng.trim().length > 0 ? Number(editForm.lng.trim()) : null;

      const updates: Record<string, unknown> = {
        name: editForm.name.trim(),
        address: editForm.address.trim(),
        city: editForm.city.trim(),
        country: editForm.country.trim(),
        category: editForm.category.trim(),
        active: editForm.active,
        supportsOrdering: editForm.supportsOrdering,
        supportsPayments: editForm.supportsPayments,
        supportsPromotions: editForm.supportsPromotions,
      };

      if (priorityNumber !== null && !Number.isNaN(priorityNumber)) {
        updates.priority = priorityNumber;
      } else {
        updates.priority = null;
      }

      updates.lat =
        latNumber !== null && !Number.isNaN(latNumber) ? latNumber : null;
      updates.lng =
        lngNumber !== null && !Number.isNaN(lngNumber) ? lngNumber : null;

      const openHoursUpdates: OpenHours = {
        mon: editForm.openHoursMon.trim(),
        tue: editForm.openHoursTue.trim(),
        wed: editForm.openHoursWed.trim(),
        thu: editForm.openHoursThu.trim(),
        fri: editForm.openHoursFri.trim(),
        sat: editForm.openHoursSat.trim(),
        sun: editForm.openHoursSun.trim(),
      };

      updates.openHours = openHoursUpdates;

      await updateDoc(ref, updates);

      const newLocation: Location = {
        ...location,
        name: updates.name as string,
        address: updates.address as string,
        city: updates.city as string,
        country: updates.country as string,
        category: updates.category as string,
        active: updates.active as boolean,
        supportsOrdering: updates.supportsOrdering as boolean,
        supportsPayments: updates.supportsPayments as boolean,
        supportsPromotions: updates.supportsPromotions as boolean,
        priority:
          priorityNumber !== null && !Number.isNaN(priorityNumber)
            ? priorityNumber
            : undefined,
        lat:
          latNumber !== null && !Number.isNaN(latNumber)
            ? latNumber
            : undefined,
        lng:
          lngNumber !== null && !Number.isNaN(lngNumber)
            ? lngNumber
            : undefined,
        openHours: openHoursUpdates,
      };

      setLocation(newLocation);
      setIsEditOpen(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save changes";
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  // ---------- UNIT ADD / EDIT ----------
  const openAddUnitDialog = () => {
    if (!location) return;

    const form: UnitEditForm = {
      name: "",
      position: "",
      status: "online",
      inUse: false,
      totalSessions: "0",
    };

    setUnitDialogMode("add");
    setUnitForm(form);
    setUnitSaveError(null);
    setIsUnitDialogOpen(true);
  };

  const openEditUnitDialog = (unit: Unit) => {
    const form: UnitEditForm = {
      id: unit.id,
      name: unit.name,
      position: unit.position ?? "",
      status: unit.status ?? "",
      inUse: !!unit.inUse,
      totalSessions: String(unit.totalSessions ?? 0),
    };

    setUnitDialogMode("edit");
    setUnitForm(form);
    setUnitSaveError(null);
    setIsUnitDialogOpen(true);
  };

  const closeUnitDialog = () => {
    if (unitSaving) return;
    setIsUnitDialogOpen(false);
  };

  const handleUnitChange =
    (field: keyof UnitEditForm) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      if (!unitForm) return;

      if (field === "inUse") {
        setUnitForm({
          ...unitForm,
          inUse: event.target.checked,
        });
      } else {
        setUnitForm({
          ...unitForm,
          [field]: event.target.value,
        });
      }
    };

  const handleUnitSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!location || !unitForm) return;

    setUnitSaving(true);
    setUnitSaveError(null);

    try {
      const totalSessionsNumber =
        unitForm.totalSessions.trim().length > 0
          ? Number(unitForm.totalSessions.trim())
          : 0;

      const baseData: Record<string, unknown> = {
        name: unitForm.name.trim(),
        position: unitForm.position.trim(),
        status: unitForm.status.trim() || "online",
        inUse: unitForm.inUse,
        totalSessions: Number.isNaN(totalSessionsNumber)
          ? 0
          : totalSessionsNumber,
      };

      if (unitDialogMode === "edit" && unitForm.id) {
        const ref = doc(db, "units", unitForm.id);
        await updateDoc(ref, baseData);

        setUnits((prev) =>
          prev.map((u) =>
            u.id === unitForm.id
              ? {
                  ...u,
                  name: baseData.name as string,
                  position: baseData.position as string,
                  status: baseData.status as string,
                  inUse: baseData.inUse as boolean,
                  totalSessions: baseData.totalSessions as number,
                }
              : u
          )
        );
      } else {
        const ref = await addDoc(collection(db, "units"), {
          ...baseData,
          locationId: location.id,
          lastHeartbeat: serverTimestamp(),
        });

        const newUnit: Unit = {
          id: ref.id,
          name: baseData.name as string,
          position: baseData.position as string,
          status: baseData.status as string,
          inUse: baseData.inUse as boolean,
          totalSessions: baseData.totalSessions as number,
        };

        setUnits((prev) => [...prev, newUnit]);
      }

      setIsUnitDialogOpen(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save unit";
      setUnitSaveError(message);
    } finally {
      setUnitSaving(false);
    }
  };

  // ---------- GROUP & SORT UNITS BY POSITION ----------
  const groupedUnits = (() => {
    if (!units || units.length === 0) return [];

    const byPosition: Record<string, Unit[]> = {};

    units.forEach((u) => {
      const key =
        u.position && u.position.trim().length > 0
          ? u.position.trim()
          : "Unassigned position";

      if (!byPosition[key]) {
        byPosition[key] = [];
      }
      byPosition[key].push(u);
    });

    const positions = Object.keys(byPosition).sort((a, b) =>
      a.localeCompare(b)
    );

    return positions.map((position) => ({
      position,
      units: byPosition[position]
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
  })();

  // ---------- SESSION FILTERING ----------
  const unitNameOptions: string[] = Array.from(
    new Set(
      sessions
        .map((s) => s.unitName ?? s.unitId)
        .filter((name): name is string => !!name)
    )
  ).sort((a, b) => a.localeCompare(b));

  const filteredSessions: Session[] = (() => {
    if (!sessions || sessions.length === 0) return [];

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0
    );
    const sevenDaysAgo = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 7,
      0,
      0,
      0,
      0
    );

    return sessions.filter((s) => {
      if (sessionsInProgressOnly && !s.inProgress) return false;

      if (sessionsUnitFilter !== "all") {
        const nameOrId = s.unitName ?? s.unitId ?? "";
        if (nameOrId !== sessionsUnitFilter) return false;
      }

      if (sessionsDateFilter === "today") {
        if (!s.startedAt) return false;
        return s.startedAt >= startOfToday;
      }

      if (sessionsDateFilter === "last7") {
        if (!s.startedAt) return false;
        return s.startedAt >= sevenDaysAgo;
      }

      return true;
    });
  })();

  const openSessionDetail = (session: Session) => {
    setSelectedSession(session);
    setSessionDetailOpen(true);
  };

  const closeSessionDetail = () => {
    setSessionDetailOpen(false);
  };

  // ---------- ACTIVE PROMOTIONS ----------
  const now = new Date();
  const activePromotions: Promotion[] = promotions.filter((p) => {
    if (!p.isActive) return false;
    if (p.validFrom && p.validFrom > now) return false;
    if (p.validTo && p.validTo < now) return false;
    return true;
  });

  // ---------- IMAGES ----------
  const handleOpenImagesDialog = () => {
    if (!location) return;
    setImagesText((location.images ?? []).join("\n"));
    setImagesError(null);
    setImagesDialogOpen(true);
  };

  const handleCloseImagesDialog = () => {
    if (savingImages) return;
    setImagesDialogOpen(false);
  };

  const handleSaveImages = async () => {
    if (!location) return;
    setSavingImages(true);
    setImagesError(null);

    try {
      const urls = imagesText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      const ref = doc(db, "locations", location.id);
      await updateDoc(ref, { images: urls });

      setLocation((prev) =>
        prev
          ? {
              ...prev,
              images: urls,
            }
          : prev
      );

      setImagesDialogOpen(false);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to save images";
      setImagesError(msg);
    } finally {
      setSavingImages(false);
    }
  };

  // ---------- RENDER ----------
  if (loading) {
    return (
      <MainLayout>
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  if (error || !location) {
    return (
      <MainLayout>
        <Typography variant="h4" gutterBottom>
          Location
        </Typography>
        <Typography color="error">{error ?? "Location not found"}</Typography>
      </MainLayout>
    );
  }

  const hasPromo =
    location.hasActivePromotion || location.hasActivePromotions;
  const unitsHeaderColSpan = canEdit ? 8 : 7;

  return (
    <MainLayout>
      {/* Header */}
      <Box sx={{ mb: 3, display: "flex", gap: 2, alignItems: "center" }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" gutterBottom>
            {location.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {location.address}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {location.city} {location.country && `• ${location.country}`}
          </Typography>
        </Box>

        <Stack direction="column" spacing={1} alignItems="flex-end">
          <Chip
            label={location.active ? "Active" : "Inactive"}
            color={location.active ? "success" : "default"}
            size="small"
          />
          {hasPromo && (
            <Chip label="Promotion active" color="primary" size="small" />
          )}

          {canEdit && (
            <Button variant="outlined" size="small" onClick={openEditDialog}>
              Edit location
            </Button>
          )}
        </Stack>
      </Box>

      {/* Top hero image */}
      {location.images[0] && (
        <Box sx={{ mb: 3 }}>
          <Box
            component="img"
            src={location.images[0]}
            alt={location.name}
            sx={{
              width: "100%",
              maxHeight: 320,
              objectFit: "cover",
              borderRadius: 2,
            }}
          />
        </Box>
      )}

      {/* Images / media card */}
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 1,
            }}
          >
            <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
              Images
            </Typography>
            {canEdit && (
              <Button
                size="small"
                variant="outlined"
                onClick={handleOpenImagesDialog}
              >
                Edit images
              </Button>
            )}
          </Box>

          {location.images && location.images.length > 0 ? (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                gap: 1.5,
              }}
            >
              {location.images.map((url, idx) => (
                <Box
                  key={`${url}-${idx}`}
                  sx={{
                    borderRadius: 2,
                    overflow: "hidden",
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <img
                    src={url}
                    alt={`Location image ${idx + 1}`}
                    style={{
                      width: "100%",
                      height: 100,
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No images configured for this location yet.
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* GRID LAYOUT */}
      <Grid container spacing={2} sx={{ mt: 2 }}>
        {/* Left column */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Location info
              </Typography>

              <List dense>
                <ListItem>
                  <ListItemText
                    primary="Category"
                    secondary={location.category ?? "-"}
                  />
                </ListItem>
                <Divider component="li" />

                <ListItem>
                  <ListItemText
                    primary="Address"
                    secondary={location.address ?? "-"}
                  />
                </ListItem>
                <Divider component="li" />

                <ListItem>
                  <ListItemText
                    primary="City"
                    secondary={location.city ?? "-"}
                  />
                </ListItem>
                <Divider component="li" />

                <ListItem>
                  <ListItemText
                    primary="Country"
                    secondary={location.country ?? "-"}
                  />
                </ListItem>
                <Divider component="li" />

                <ListItem>
                  <ListItemText
                    primary="Coordinates"
                    secondary={
                      location.lat != null && location.lng != null
                        ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(
                            6
                          )}`
                        : "-"
                    }
                  />
                </ListItem>

                <Divider component="li" />
                <ListItem>
                  <ListItemText
                    primary="Priority"
                    secondary={
                      location.priority != null ? location.priority : "-"
                    }
                  />
                </ListItem>
              </List>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle1" gutterBottom>
                Capabilities
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip
                  label="Ordering"
                  color={location.supportsOrdering ? "success" : "default"}
                  variant={location.supportsOrdering ? "filled" : "outlined"}
                  size="small"
                />
                <Chip
                  label="Payments"
                  color={location.supportsPayments ? "success" : "default"}
                  variant={location.supportsPayments ? "filled" : "outlined"}
                  size="small"
                />
                <Chip
                  label="Promotions"
                  color={location.supportsPromotions ? "success" : "default"}
                  variant={location.supportsPromotions ? "filled" : "outlined"}
                  size="small"
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Right column */}
        <Grid item xs={12} md={6}>
          {/* Usage */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Usage & units
              </Typography>

              <List dense>
                <ListItem>
                  <ListItemText
                    primary="Units in use / total"
                    secondary={`${location.unitInUse} / ${location.unitTotal}`}
                  />
                </ListItem>
                <Divider component="li" />

                <ListItem>
                  <ListItemText
                    primary="Total sessions"
                    secondary={location.totalSessions}
                  />
                </ListItem>
                <Divider component="li" />

                <ListItem>
                  <ListItemText
                    primary="Last availability update"
                    secondary={formatDateTime(
                      location.lastAvailabilityUpdate
                    )}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>

          {/* Opening hours */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Opening hours
              </Typography>

              {location.openHours ? (
                <List dense>
                  {ORDERED_DAYS.map((day) => (
                    <ListItem key={day} sx={{ py: 0.3 }}>
                      <ListItemText
                        primary={day.toUpperCase()}
                        secondary={location.openHours?.[day] ?? "Closed"}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No opening hours configured.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Active promotions */}
      <Box sx={{ mt: 4 }}>
        <Card>
          <CardContent>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: 1,
              }}
            >
              <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
                Active promotions
              </Typography>
              <Button
                size="small"
                variant="text"
                onClick={() =>
                  navigate(
                    `/promotions?locationId=${encodeURIComponent(location.id)}`
                  )
                }
              >
                Manage in Promotions
              </Button>
            </Box>

            {promotionsLoading && (
              <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
                <CircularProgress size={24} />
              </Box>
            )}

            {promotionsError && (
              <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                {promotionsError}
              </Typography>
            )}

            {!promotionsLoading &&
              !promotionsError &&
              activePromotions.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No active promotions for this location.
                </Typography>
              )}

            {!promotionsLoading &&
              !promotionsError &&
              activePromotions.length > 0 && (
                <Stack spacing={2} sx={{ mt: 1 }}>
                  {activePromotions.map((promo) => (
                    <Box
                      key={promo.id}
                      sx={{
                        borderRadius: 1,
                        border: "1px solid",
                        borderColor: "divider",
                        p: 1.5,
                        display: "flex",
                        gap: 2,
                      }}
                    >
                      {promo.imageUrl && (
                        <Box
                          component="img"
                          src={promo.imageUrl}
                          alt={promo.title}
                          sx={{
                            width: 80,
                            height: 80,
                            objectFit: "cover",
                            borderRadius: 1,
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <Box sx={{ flexGrow: 1 }}>
                        <Stack
                          direction="row"
                          alignItems="center"
                          justifyContent="space-between"
                          spacing={1}
                        >
                          <Typography variant="subtitle1">
                            {promo.title}
                          </Typography>
                          <Chip label="Active" color="success" size="small" />
                        </Stack>
                        {promo.description && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 0.5 }}
                          >
                            {promo.description}
                          </Typography>
                        )}
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: "block", mt: 0.5 }}
                        >
                          {formatDateRange(promo.validFrom, promo.validTo)}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              )}
          </CardContent>
        </Card>
      </Box>

      {/* Units list */}
      <Box sx={{ mt: 4 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1.5 }}>
          <Typography variant="h6">Units at this location</Typography>
          {canEdit && (
            <Button variant="contained" size="small" onClick={openAddUnitDialog}>
              Add unit
            </Button>
          )}
        </Box>

        {unitsLoading && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {unitsError && (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            {unitsError}
          </Typography>
        )}

        {!unitsLoading && !unitsError && (
          <TableContainer component={Paper} sx={{ mt: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Unit</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Health</TableCell>
                  <TableCell>Last heartbeat</TableCell>
                  <TableCell>Last interaction</TableCell>
                  <TableCell>Last session</TableCell>
                  <TableCell align="right">Success / Fault</TableCell>
                  {canEdit && <TableCell align="right">Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {groupedUnits.map((group) => (
                  <Fragment key={group.position}>
                    {/* Group header */}
                    <TableRow sx={{ backgroundColor: "action.hover" }}>
                      <TableCell colSpan={unitsHeaderColSpan}>
                        <Typography variant="subtitle2">
                          {group.position}
                        </Typography>
                      </TableCell>
                    </TableRow>

                    {/* Units in this group */}
                    {group.units.map((unit) => {
                      const healthStatus = unit.health?.status ?? "unknown";
                      const healthNeedsMaintenance =
                        unit.health?.needsMaintenance ?? false;

                      return (
                        <TableRow key={unit.id} hover>
                          {/* Unit name + device type */}
                          <TableCell>
                            <Box
                              sx={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 0.25,
                              }}
                            >
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 500 }}
                              >
                                {unit.name}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {unit.currentDeviceType ?? "-"}
                                {unit.currentMode
                                  ? ` · ${unit.currentMode}`
                                  : ""}
                              </Typography>
                            </Box>
                          </TableCell>

                          {/* Status / in use */}
                          <TableCell>
                            <Box
                              sx={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 0.5,
                              }}
                            >
                              <Chip
                                label={unit.status ?? "unknown"}
                                size="small"
                                color={
                                  unit.status === "online"
                                    ? "success"
                                    : unit.status === "warning"
                                    ? "warning"
                                    : "default"
                                }
                              />
                              {unit.inUse != null && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {unit.inUse ? "In use" : "Idle"}
                                </Typography>
                              )}
                            </Box>
                          </TableCell>

                          {/* Health */}
                          <TableCell>
                            <Box
                              sx={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 0.5,
                              }}
                            >
                              <Chip
                                label={healthStatus}
                                size="small"
                                color={
                                  healthStatus === "ok"
                                    ? "success"
                                    : healthStatus === "warning"
                                    ? "warning"
                                    : healthStatus === "critical"
                                    ? "error"
                                    : "default"
                                }
                                variant={
                                  healthNeedsMaintenance ? "filled" : "outlined"
                                }
                              />
                              {healthNeedsMaintenance && (
                                <Typography variant="caption" color="error">
                                  Needs maintenance
                                </Typography>
                              )}
                            </Box>
                          </TableCell>

                          {/* Last heartbeat */}
                          <TableCell>
                            {formatShortDateTime(unit.lastHeartbeat)}
                          </TableCell>

                          {/* Last interaction */}
                          <TableCell>
                            <Box
                              sx={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 0.25,
                              }}
                            >
                              <Typography variant="body2">
                                {unit.lastInteractionType ?? "-"}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {formatShortDateTime(unit.lastInteraction)}
                              </Typography>
                            </Box>
                          </TableCell>

                          {/* Last session */}
                          <TableCell>
                            <Box
                              sx={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 0.25,
                              }}
                            >
                              <Typography variant="body2">
                                {unit.lastSessionDuration != null
                                  ? `${unit.lastSessionDuration} min`
                                  : "-"}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {formatShortDateTime(
                                  unit.lastSessionTimestamp
                                )}
                              </Typography>
                            </Box>
                          </TableCell>

                          {/* Success / fault rates */}
                          <TableCell align="right">
                            <Box
                              sx={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 0.25,
                              }}
                            >
                              <Typography variant="body2">
                                {formatPercent(unit.metrics?.successRate)}{" "}
                                success
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {formatPercent(unit.metrics?.faultRate)} fault
                              </Typography>
                            </Box>
                          </TableCell>

                          {/* Actions */}
                          {canEdit && (
                            <TableCell align="right">
                              <Button
                                size="small"
                                variant="text"
                                onClick={() => openEditUnitDialog(unit)}
                              >
                                Edit
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </Fragment>
                ))}

                {groupedUnits.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={unitsHeaderColSpan}>
                      <Typography
                        align="center"
                        variant="body2"
                        sx={{ py: 1.5 }}
                      >
                        No units found for this location.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* Sessions list */}
      <Box sx={{ mt: 4 }}>
        <Box
          sx={{
            mb: 1.5,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <Typography variant="h6">Recent sessions</Typography>

          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            flexWrap="wrap"
          >
            <ToggleButtonGroup
              size="small"
              value={sessionsDateFilter}
              exclusive
              onChange={(_, value: DateFilter | null) => {
                if (value) setSessionsDateFilter(value);
              }}
            >
              <ToggleButton value="all">All</ToggleButton>
              <ToggleButton value="today">Today</ToggleButton>
              <ToggleButton value="last7">Last 7 days</ToggleButton>
            </ToggleButtonGroup>

            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel id="sessions-unit-filter-label">Unit</InputLabel>
              <Select
                labelId="sessions-unit-filter-label"
                label="Unit"
                value={sessionsUnitFilter}
                onChange={(e) => setSessionsUnitFilter(e.target.value)}
              >
                <MenuItem value="all">All units</MenuItem>
                {unitNameOptions.map((name) => (
                  <MenuItem key={name} value={name}>
                    {name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Checkbox
                  checked={sessionsInProgressOnly}
                  onChange={(e) =>
                    setSessionsInProgressOnly(e.target.checked)
                  }
                  size="small"
                />
              }
              label="In progress only"
            />
          </Stack>
        </Box>

        {sessionsLoading && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {sessionsError && (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            {sessionsError}
          </Typography>
        )}

        {!sessionsLoading && !sessionsError && (
          <TableContainer component={Paper} sx={{ mt: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Unit</TableCell>
                  <TableCell>Started</TableCell>
                  <TableCell>Ended</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredSessions.map((s) => {
                  const statusLabel = s.inProgress ? "In progress" : "Completed";

                  let duration = s.durationMinutes;
                  if (duration == null && s.startedAt && s.endedAt) {
                    const diffMs = s.endedAt.getTime() - s.startedAt.getTime();
                    const mins = Math.round(diffMs / 60000);
                    duration = mins;
                  }

                  const unitDisplay = s.unitName ?? s.unitId ?? "-";

                  return (
                    <TableRow
                      key={s.id}
                      hover
                      sx={{ cursor: "pointer" }}
                      onClick={() => openSessionDetail(s)}
                    >
                      <TableCell>{unitDisplay}</TableCell>
                      <TableCell>{formatDateTime(s.startedAt)}</TableCell>
                      <TableCell>
                        {s.inProgress ? "—" : formatDateTime(s.endedAt)}
                      </TableCell>
                      <TableCell>
                        {s.inProgress ? "—" : formatDurationMinutes(duration)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={statusLabel}
                          color={s.inProgress ? "primary" : "default"}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}

                {filteredSessions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography
                        align="center"
                        variant="body2"
                        sx={{ py: 1.5 }}
                      >
                        No sessions match the current filters.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* Location edit dialog */}
      <Dialog
        open={isEditOpen}
        onClose={closeEditDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Edit location</DialogTitle>
        <form onSubmit={handleEditSubmit}>
          <DialogContent sx={{ pt: 1 }}>
            {editForm && (
              <>
                <TextField
                  label="Name"
                  fullWidth
                  margin="normal"
                  value={editForm.name}
                  onChange={handleEditChange("name")}
                  required
                />
                <TextField
                  label="Address"
                  fullWidth
                  margin="normal"
                  value={editForm.address}
                  onChange={handleEditChange("address")}
                />
                <TextField
                  label="City"
                  fullWidth
                  margin="normal"
                  value={editForm.city}
                  onChange={handleEditChange("city")}
                />
                <TextField
                  label="Country"
                  fullWidth
                  margin="normal"
                  value={editForm.country}
                  onChange={handleEditChange("country")}
                />
                <TextField
                  label="Category"
                  fullWidth
                  margin="normal"
                  value={editForm.category}
                  onChange={handleEditChange("category")}
                />
                <TextField
                  label="Latitude"
                  type="number"
                  fullWidth
                  margin="normal"
                  value={editForm.lat}
                  onChange={handleEditChange("lat")}
                />
                <TextField
                  label="Longitude"
                  type="number"
                  fullWidth
                  margin="normal"
                  value={editForm.lng}
                  onChange={handleEditChange("lng")}
                />
                <TextField
                  label="Priority"
                  type="number"
                  fullWidth
                  margin="normal"
                  value={editForm.priority}
                  onChange={handleEditChange("priority")}
                />

                <Box sx={{ mt: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={editForm.active}
                        onChange={handleEditChange("active")}
                      />
                    }
                    label="Active"
                  />
                </Box>
                <Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={editForm.supportsOrdering}
                        onChange={handleEditChange("supportsOrdering")}
                      />
                    }
                    label="Supports ordering"
                  />
                </Box>
                <Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={editForm.supportsPayments}
                        onChange={handleEditChange("supportsPayments")}
                      />
                    }
                    label="Supports payments"
                  />
                </Box>
                <Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={editForm.supportsPromotions}
                        onChange={handleEditChange("supportsPromotions")}
                      />
                    }
                    label="Supports promotions"
                  />
                </Box>

                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" gutterBottom>
                  Opening hours (e.g. 08:00-20:00, leave blank for closed)
                </Typography>

                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <TextField
                      label="Mon"
                      fullWidth
                      margin="dense"
                      value={editForm.openHoursMon}
                      onChange={handleEditChange("openHoursMon")}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Tue"
                      fullWidth
                      margin="dense"
                      value={editForm.openHoursTue}
                      onChange={handleEditChange("openHoursTue")}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Wed"
                      fullWidth
                      margin="dense"
                      value={editForm.openHoursWed}
                      onChange={handleEditChange("openHoursWed")}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Thu"
                      fullWidth
                      margin="dense"
                      value={editForm.openHoursThu}
                      onChange={handleEditChange("openHoursThu")}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Fri"
                      fullWidth
                      margin="dense"
                      value={editForm.openHoursFri}
                      onChange={handleEditChange("openHoursFri")}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Sat"
                      fullWidth
                      margin="dense"
                      value={editForm.openHoursSat}
                      onChange={handleEditChange("openHoursSat")}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Sun"
                      fullWidth
                      margin="dense"
                      value={editForm.openHoursSun}
                      onChange={handleEditChange("openHoursSun")}
                    />
                  </Grid>
                </Grid>

                {saveError && (
                  <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                    {saveError}
                  </Typography>
                )}
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={closeEditDialog} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Unit add/edit dialog */}
      <Dialog
        open={isUnitDialogOpen}
        onClose={closeUnitDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {unitDialogMode === "add" ? "Add unit" : "Edit unit"}
        </DialogTitle>
        <form onSubmit={handleUnitSubmit}>
          <DialogContent sx={{ pt: 1 }}>
            {unitForm && (
              <>
                <TextField
                  label="Unit name"
                  helperText='e.g. "SBSP-BR05"'
                  fullWidth
                  margin="normal"
                  value={unitForm.name}
                  onChange={handleUnitChange("name")}
                  required
                />
                <TextField
                  label="Position"
                  helperText="e.g. Boardroom, Oval Power Table, Balcony Edge Tables"
                  fullWidth
                  margin="normal"
                  value={unitForm.position}
                  onChange={handleUnitChange("position")}
                />
                <TextField
                  label="Status"
                  helperText='e.g. "online", "offline", "maintenance"'
                  fullWidth
                  margin="normal"
                  value={unitForm.status}
                  onChange={handleUnitChange("status")}
                />
                <TextField
                  label="Total sessions"
                  type="number"
                  fullWidth
                  margin="normal"
                  value={unitForm.totalSessions}
                  onChange={handleUnitChange("totalSessions")}
                />
                <Box sx={{ mt: 1 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={unitForm.inUse}
                        onChange={handleUnitChange("inUse")}
                      />
                    }
                    label="In use right now"
                  />
                </Box>

                {unitSaveError && (
                  <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                    {unitSaveError}
                  </Typography>
                )}
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={closeUnitDialog} disabled={unitSaving}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={unitSaving}>
              {unitSaving
                ? "Saving..."
                : unitDialogMode === "add"
                ? "Add unit"
                : "Save changes"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Edit images dialog */}
      <Dialog
        open={imagesDialogOpen}
        onClose={handleCloseImagesDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Edit location images</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Paste one image URL per line. These URLs are used both in the admin
            dashboard and in the mobile app.
          </Typography>

          <TextField
            label="Image URLs"
            multiline
            minRows={6}
            fullWidth
            margin="normal"
            value={imagesText}
            onChange={(e) => setImagesText(e.target.value)}
            placeholder={"https://...\nhttps://...\nhttps://..."}
          />

          {imagesError && (
            <Typography color="error" variant="body2" sx={{ mt: 1 }}>
              {imagesError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseImagesDialog} disabled={savingImages}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveImages}
            variant="contained"
            disabled={savingImages}
          >
            {savingImages ? "Saving..." : "Save images"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Session detail drawer */}
      <Drawer
        anchor="right"
        open={sessionDetailOpen}
        onClose={closeSessionDetail}
      >
        <Box
          sx={{
            width: 360,
            p: 2,
            display: "flex",
            flexDirection: "column",
            height: "100%",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 2,
            }}
          >
            <Typography variant="h6">Session details</Typography>
            <IconButton size="small" onClick={closeSessionDetail}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {selectedSession ? (
            <>
              <Typography variant="subtitle2" gutterBottom>
                Overview
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary="Session ID"
                    secondary={selectedSession.id}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Location ID"
                    secondary={selectedSession.locationId ?? location.id}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Unit"
                    secondary={
                      selectedSession.unitName ??
                      selectedSession.unitId ??
                      "-"
                    }
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Status"
                    secondary={
                      selectedSession.inProgress
                        ? "In progress"
                        : "Completed"
                    }
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Started"
                    secondary={formatDateTime(selectedSession.startedAt)}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Ended"
                    secondary={
                      selectedSession.inProgress
                        ? "—"
                        : formatDateTime(selectedSession.endedAt)
                    }
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Duration"
                    secondary={
                      selectedSession.inProgress
                        ? "—"
                        : formatDurationMinutes(
                            selectedSession.durationMinutes
                          )
                    }
                  />
                </ListItem>
              </List>

              {selectedSession.raw && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" gutterBottom>
                    Raw metadata
                  </Typography>
                  <Box
                    component="pre"
                    sx={{
                      fontSize: 12,
                      bgcolor: "grey.100",
                      p: 1,
                      borderRadius: 1,
                      overflow: "auto",
                      maxHeight: 260,
                    }}
                  >
                    {JSON.stringify(selectedSession.raw, null, 2)}
                  </Box>
                </>
              )}
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No session selected.
            </Typography>
          )}
        </Box>
      </Drawer>
    </MainLayout>
  );
}