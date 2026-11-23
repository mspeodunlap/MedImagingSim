import { availableParallelism } from "node:os";

function integerSetting(env, name, fallback, maximum) {
  const raw = env[name];
  if (raw === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(raw) || Number(raw) > maximum) {
    throw new Error(`${name} must be a whole number from 1 to ${maximum}.`);
  }
  return Number(raw);
}

// Queue lightweight plans, not generated images. Keep CPU work off the request thread.
export function readScanLimits(env = process.env, parallelism = availableParallelism()) {
  return Object.freeze({
    workers: integerSetting(env, "MEDSIM_SCAN_WORKERS", Math.min(4, Math.max(1, parallelism - 1)), 8),
    waiting: integerSetting(env, "MEDSIM_SCAN_QUEUE_LIMIT", 64, 256),
  });
}
