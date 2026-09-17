// Mission session: ghost slots, re-recording with backup, result bookkeeping. Pure (no DOM), fully testable.
import { MAX_GHOSTS } from '../sim/constants';
import type { EndKind, MissionDef, Recording } from '../sim/types';

export interface MissionRecord { clears: number; bestTicks: number | null; minGhosts: number | null; noDamageClear: boolean; bestComposition: string | null; attempts: number }
export interface MissionSave { version: number; slots: (Recording | null)[]; record: MissionRecord }
export const emptyRecord = (): MissionRecord => ({ clears: 0, bestTicks: null, minGhosts: null, noDamageClear: false, bestComposition: null, attempts: 0 });
export const emptyMissionSave = (version: number): MissionSave => ({ version, slots: [null, null, null], record: emptyRecord() });

export interface AttemptResult { attemptId: number; outcome: EndKind; ticks: number; ghostsUsed: number; damageTaken: number; composition: string }
export interface ResultFlags { firstClear: boolean; newBestTime: boolean; newMinGhosts: boolean; noDamage: boolean }

export class MissionSession {
  rerecording: number | null = null;
  private backup: Recording | null = null;
  private applied = new Set<number>();
  constructor(public readonly def: MissionDef, public save: MissionSave) {
    if (save.version !== def.version) { // map changed → recordings retired
      this.save = { ...emptyMissionSave(def.version), record: save.record };
      this.retired = save.slots.some((s) => s !== null);
    }
    while (this.save.slots.length < MAX_GHOSTS) this.save.slots.push(null);
  }
  /** True if recordings from an older map version were dropped when this session opened. */
  retired = false;

  get slots(): (Recording | null)[] { return this.save.slots; }
  usedSlots(): number { return this.save.slots.filter((s) => s !== null).length; }
  freeSlot(): number { return this.save.slots.findIndex((s) => s === null); }

  /** Ghost list for the next attempt: the slot being re-recorded is excluded (but kept as a backup). */
  ghostsForAttempt(): (Recording | null)[] { return this.save.slots.map((s, i) => (i === this.rerecording ? null : s)); }

  beginRerecord(slot: number): void {
    if (slot < 0 || slot >= MAX_GHOSTS) return;
    if (this.rerecording !== null) this.cancelRerecord();
    this.rerecording = slot; this.backup = this.save.slots[slot];
  }
  cancelRerecord(): void {
    if (this.rerecording === null) return;
    this.save.slots[this.rerecording] = this.backup; // restore (no-op if it was already there)
    this.rerecording = null; this.backup = null;
  }
  /** Store a recording. Returns the slot used, or -1 if a slot must be chosen explicitly. */
  commitRecording(rec: Recording, slot?: number): number {
    let target = slot ?? (this.rerecording !== null ? this.rerecording : this.freeSlot());
    if (target < 0 || target >= MAX_GHOSTS) return -1;
    this.save.slots[target] = rec;
    if (this.rerecording !== null) { this.rerecording = null; this.backup = null; }
    return target;
  }
  removeSlot(slot: number): void { if (slot >= 0 && slot < MAX_GHOSTS) { if (this.rerecording === slot) { this.rerecording = null; this.backup = null; } this.save.slots[slot] = null; } }
  clearAll(): void { this.rerecording = null; this.backup = null; this.save.slots = [null, null, null]; }

  /** Applies a finished attempt to the mission record exactly once per attemptId. */
  applyResult(r: AttemptResult): ResultFlags {
    const flags: ResultFlags = { firstClear: false, newBestTime: false, newMinGhosts: false, noDamage: false };
    if (this.applied.has(r.attemptId)) return flags;
    this.applied.add(r.attemptId);
    const rec = this.save.record; rec.attempts++;
    if (r.outcome !== 'escape') return flags;
    flags.firstClear = rec.clears === 0; rec.clears++;
    if (rec.bestTicks === null || r.ticks < rec.bestTicks) { rec.bestTicks = r.ticks; flags.newBestTime = true; rec.bestComposition = r.composition; }
    if (rec.minGhosts === null || r.ghostsUsed < rec.minGhosts) { rec.minGhosts = r.ghostsUsed; flags.newMinGhosts = true; }
    if (r.damageTaken === 0) { flags.noDamage = true; rec.noDamageClear = true; }
    return flags;
  }
}
