import {
  DEFAULT_DECAY_HALF_LIFE_DAYS,
  type DecayFormula,
} from "./constants";
import { SIGNAL_DEFINITIONS, type LeadSnapshot, type ScoringSignal } from "./signals";

const MS_PER_DAY = 86_400_000;

export type DecayConfig = {
  formula: DecayFormula;
  halfLifeDays?: number;
  minFactor?: number;
};

export type DecayResult = {
  signal: ScoringSignal;
  originalPoints: number;
  decayedPoints: number;
  decayFactor: number;
  ageDays: number;
  formula: DecayFormula;
};

/**
 * LINEAR decay: factor decreases linearly from 1.0 to minFactor over halfLifeDays.
 *   factor = max(minFactor, 1 - (ageDays / halfLifeDays) * (1 - minFactor))
 *
 * EXPONENTIAL decay: factor halves every halfLifeDays (standard half-life).
 *   factor = max(minFactor, 0.5 ^ (ageDays / halfLifeDays))
 */
export function applyDecay(
  points: number,
  ageDays: number,
  config: DecayConfig,
): { decayedPoints: number; decayFactor: number } {
  const halfLifeDays = config.halfLifeDays ?? DEFAULT_DECAY_HALF_LIFE_DAYS;
  const minFactor = config.minFactor ?? 0;

  if (ageDays <= 0 || points === 0) {
    return { decayedPoints: points, decayFactor: 1 };
  }

  let decayFactor: number;

  if (config.formula === "LINEAR") {
    const progress = Math.min(ageDays / halfLifeDays, 1);
    decayFactor = Math.max(minFactor, 1 - progress * (1 - minFactor));
  } else {
  // EXPONENTIAL
    decayFactor = Math.max(minFactor, 0.5 ** (ageDays / halfLifeDays));
  }

  const decayedPoints = Math.round(points * decayFactor * 1000) / 1000;
  return { decayedPoints, decayFactor };
}

export function shouldDecaySignal(signal: ScoringSignal): boolean {
  return SIGNAL_DEFINITIONS[signal]?.decayable ?? false;
}

function resolveSignalAgeDays(
  snapshot: LeadSnapshot,
  signal: ScoringSignal,
  now: Date,
): number | null {
  const timestamp = snapshot.signalTimestamps?.[signal];
  if (!timestamp) return null;

  const signalDate = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(signalDate.getTime())) return null;

  return (now.getTime() - signalDate.getTime()) / MS_PER_DAY;
}

export function applySignalDecay(
  signal: ScoringSignal,
  points: number,
  snapshot: LeadSnapshot,
  config: DecayConfig,
  now = new Date(),
): DecayResult {
  if (!shouldDecaySignal(signal) || points === 0) {
    return {
      signal,
      originalPoints: points,
      decayedPoints: points,
      decayFactor: 1,
      ageDays: 0,
      formula: config.formula,
    };
  }

  const ageDays = resolveSignalAgeDays(snapshot, signal, now) ?? 0;
  const { decayedPoints, decayFactor } = applyDecay(points, ageDays, config);

  return {
    signal,
    originalPoints: points,
    decayedPoints,
    decayFactor,
    ageDays,
    formula: config.formula,
  };
}

export function applyEvidenceDecay(
  evidence: Array<{ signal: ScoringSignal; points: number; cappedPoints: number }>,
  snapshot: LeadSnapshot,
  config: DecayConfig,
  now = new Date(),
): Array<{
  signal: ScoringSignal;
  originalPoints: number;
  decayedPoints: number;
  decayFactor: number;
}> {
  return evidence.map((item) => {
    const decay = applySignalDecay(item.signal, item.cappedPoints, snapshot, config, now);
    return {
      signal: item.signal,
      originalPoints: item.cappedPoints,
      decayedPoints: decay.decayedPoints,
      decayFactor: decay.decayFactor,
    };
  });
}
