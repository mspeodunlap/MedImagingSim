import { defaultPlan, estimateScanSeconds, planFromAcquisition, readPlan } from "./mr.js";

export const geometryKeys = ["plane", "angle", "offset", "fov", "slices", "thickness", "gap", "phaseFov", "phaseDirection"];
export const durationLabel = seconds => `${Math.floor(Math.round(seconds) / 60)}m ${Math.round(seconds) % 60}s`;

export function copyGeometry(target, series) {
  const source = planFromAcquisition(series);
  const draft = { ...target, ...Object.fromEntries(geometryKeys.map(key => [key, source[key]])) };
  const form = new URLSearchParams(Object.entries(draft).filter(([key, value]) => key in defaultPlan && value !== null));
  return readPlan(form);
}

// An acquisition belongs to a particular loaded case copy and sequence, not just
// a matching contrast name. Legacy/unlinked series never imply protocol progress.
export function sequenceProgress(working, acquisitions) {
  if (!working) return [];
  return JSON.parse(working.payload).sequences.map((sequence, index) => {
    const series = acquisitions.find(a => {
      const context = JSON.parse(a.parameters).protocolContext;
      return context?.instanceKey === working.instance_key && context?.sequenceIndex === index;
    });
    const actual = series && planFromAcquisition(series);
    const matches = actual && Object.keys(defaultPlan).every(key => actual[key] === (key === "echoSpacing" && sequence.plan.preset === "tse" ? sequence.plan[key] ?? 10 : sequence.plan[key] ?? defaultPlan[key]));
    return { ...sequence, index, seriesId: series?.id, state: !series ? "Planned" : matches ? "Acquired" : "Settings changed", seconds: estimateScanSeconds(sequence.plan) };
  });
}
