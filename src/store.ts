import fs from "node:fs/promises";
import path from "node:path";
import type { MonitorState, ObservationRecord, Slot } from "./types.js";
import { describeSlot } from "./match.js";

export function emptyState(): MonitorState {
  return { schemaVersion: 1, observations: {}, lastRuns: {} };
}

export async function loadState(statePath: string): Promise<MonitorState> {
  try {
    return JSON.parse(await fs.readFile(statePath, "utf8")) as MonitorState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyState();
    throw error;
  }
}

export async function saveState(statePath: string, state: MonitorState): Promise<void> {
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  const temporaryPath = `${statePath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await fs.rename(temporaryPath, statePath);
}

export function reconcileSlots(
  state: MonitorState,
  watchId: string,
  slots: Slot[],
  now: Date,
  cooldownMinutes: number
): { notify: Slot[]; records: ObservationRecord[] } {
  const nowIso = now.toISOString();
  const currentFingerprints = new Set(slots.map((slot) => slot.fingerprint));
  for (const record of Object.values(state.observations)) {
    if (record.watchId === watchId && !currentFingerprints.has(record.fingerprint)) record.active = false;
  }

  const notify: Slot[] = [];
  const records: ObservationRecord[] = [];
  for (const slot of slots) {
    const existing = state.observations[slot.fingerprint];
    const wasActive = existing?.active ?? false;
    const cooldownElapsed = !existing?.lastNotifiedAt ||
      now.valueOf() - new Date(existing.lastNotifiedAt).valueOf() >= cooldownMinutes * 60_000;
    const record: ObservationRecord = existing ?? {
      fingerprint: slot.fingerprint,
      watchId,
      description: describeSlot(slot),
      active: false,
      firstSeenAt: nowIso,
      lastSeenAt: nowIso
    };
    record.active = true;
    record.lastSeenAt = nowIso;
    if (!wasActive && cooldownElapsed) notify.push(slot);
    state.observations[slot.fingerprint] = record;
    records.push(record);
  }
  return { notify, records };
}

export function markNotified(state: MonitorState, slots: Slot[], at: Date): void {
  const atIso = at.toISOString();
  for (const slot of slots) {
    const record = state.observations[slot.fingerprint];
    if (record) record.lastNotifiedAt = atIso;
  }
}

export function pruneState(state: MonitorState, now: Date, retentionDays = 45): void {
  const cutoff = now.valueOf() - retentionDays * 24 * 60 * 60_000;
  for (const [key, record] of Object.entries(state.observations)) {
    if (!record.active && new Date(record.lastSeenAt).valueOf() < cutoff) delete state.observations[key];
  }
}
