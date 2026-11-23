// Shared educational physics contract. Fixed frequency assumption, not scanner calibration.
export const physicsVersion = "analytic-mr-v3";
export const fieldStrengthTesla = 1.5;
export const fatWaterHz = 3.5e-6 * 42.57747892e6 * fieldStrengthTesla;
export const sequenceKind = plan => ({ gre: "gre", ir: "ir", tse: "tse" })[plan.preset] ?? "se";
export const echoSpacing = plan => sequenceKind(plan) === "tse" ? (plan.echoSpacing ?? 10) : null;

export function samplingMetrics(plan) {
  const phase = plan.phaseMatrix ?? plan.matrix;
  const encodedPhase = Math.ceil(phase * (1 + plan.oversampling / 100));
  const voxel = [plan.fov / plan.matrix, plan.fov * plan.phaseFov / (100 * phase), plan.thickness];
  const voxelVolume = voxel.reduce((a, b) => a * b, 1);
  const partitions = plan.acquisition === "3D" ? plan.slices : 1;
  // Hz/pixel fixes the readout duration: total bandwidth = matrix * Hz/pixel.
  const relativeSamplingSnr = voxelVolume / ((220 / 128) ** 2 * 5)
    * Math.sqrt(encodedPhase / 128 * partitions * plan.averages * 250 / plan.bandwidth);
  const readoutMs = 1000 / plan.bandwidth;
  const kind = sequenceKind(plan);
  const train = kind === "tse" ? plan.echoTrain : 1;
  const lastEchoMs = plan.te + (train - 1) * (echoSpacing(plan) ?? 0);
  // Explicit idealized RF/gradient overhead, not a vendor hardware limit.
  const slotMs = lastEchoMs + readoutMs / 2 + 4;
  const availableMs = plan.tr - (kind === "ir" ? plan.ti : 0);
  const slicesPerPackage = plan.acquisition === "3D" ? plan.slices : Math.max(1, Math.floor(availableMs / slotMs));
  const packages = plan.acquisition === "3D" ? 1 : Math.ceil(plan.slices / slicesPerPackage);
  const shots = Math.ceil(encodedPhase / train);
  return { voxel, voxelVolume, encodedPhase, readoutMs, relativeSamplingSnr,
    noiseSigma: 4 / relativeSamplingSnr, chemicalShiftPixels: fatWaterHz / plan.bandwidth,
    lastEchoMs, slicesPerPackage, packages,
    durationSeconds: shots * partitions * packages * plan.averages * plan.tr / 1000 };
}

export function timingError(plan) {
  const required = ["tr", "te", "bandwidth", ...(sequenceKind(plan) === "ir" ? ["ti"] : []), ...(sequenceKind(plan) === "tse" ? ["echoTrain"] : [])];
  if (required.some(key => !Number.isFinite(plan[key]) || plan[key] <= 0) || (sequenceKind(plan) === "tse" && !Number.isFinite(echoSpacing(plan)))) return "Enter valid positive sequence timing and bandwidth values.";
  const m = samplingMetrics(plan), kind = sequenceKind(plan);
  if (plan.te >= plan.tr) return "TE must be shorter than TR.";
  const minimumTe = kind === "gre" ? 2 + m.readoutMs / 2 : 4 + m.readoutMs;
  if (plan.te < minimumTe) return `TE must be at least ${Math.ceil(minimumTe)} ms for this bandwidth and sequence in the teaching model.`;
  if (kind === "tse" && echoSpacing(plan) < 4 + m.readoutMs)
    return `Echo spacing must be at least ${Math.ceil(4 + m.readoutMs)} ms for this bandwidth.`;
  if (kind === "tse" && plan.te < echoSpacing(plan)) return "Effective TE must be at least one echo spacing.";
  if ((kind === "ir" ? plan.ti : 0) + m.lastEchoMs + m.readoutMs / 2 + 4 >= plan.tr)
    return "The preparation, echo train, readout and recovery overhead must fit inside TR. Increase TR or shorten the timing.";
  return "";
}

// Signed transverse amplitude: take magnitude only AFTER partial-volume mixing.
// Ideal excitation/refocusing/spoiling; tissue constants are a synthetic fixture.
export function tissueSignal(plan, { density, t1, t2, t2Star }) {
  const kind = sequenceKind(plan);
  if (kind === "gre") {
    const angle = plan.flip * Math.PI / 180, e1 = Math.exp(-plan.tr / t1);
    return 255 * density * Math.sin(angle) * (1 - e1) / (1 - Math.cos(angle) * e1) * Math.exp(-plan.te / t2Star);
  }
  const recovery = kind === "ir"
    ? 1 - 2 * Math.exp(-plan.ti / t1) + Math.exp(-plan.tr / t1)
    : 1 - Math.exp(-plan.tr / t1);
  return 255 * density * recovery * Math.exp(-plan.te / t2);
}

export const estimateScanSeconds = plan => samplingMetrics(plan).durationSeconds;
