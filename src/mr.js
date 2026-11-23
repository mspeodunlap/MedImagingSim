import { echoSpacing, fatWaterHz, fieldStrengthTesla, physicsVersion, samplingMetrics, sequenceKind, timingError, tissueSignal } from "../public/mr-physics.js";
import { filterPhase } from "./mr-reconstruction.js";
import { coverage, estimateScanSeconds, localizerFov, localizerSize, patientPoint, planes, sampleGrid, sliceCenter, sliceFrame } from "../public/mr-geometry.js";
export { estimateScanSeconds } from "../public/mr-geometry.js";

export const mrExamKey = "mr-brain-v1";
const sourceVersion = "synthetic-brain-v1";
const engineVersion = physicsVersion;

export const presets = {
  t1: { label: "T1 spin echo", sequence: "se", tr: 550, te: 12, ti: null },
  t2: { label: "T2 spin echo", sequence: "se", tr: 3500, te: 95, ti: null },
  pd: { label: "PD spin echo", sequence: "se", tr: 3500, te: 16, ti: null },
  ir: { label: "Fluid-suppressed inversion recovery", sequence: "ir", tr: 8500, te: 100, ti: 2200 },
  gre: { label: "Spoiled gradient echo", sequence: "gre", tr: 35, te: 8, ti: null, flip: 25 },
  tse: { label: "T2 fast spin echo", sequence: "tse", tr: 3500, te: 95, ti: null, echoTrain: 8, echoSpacing: 10 },
};

export const geometryFields = {
  angle: ["Angulation (°)", -45, 45, 1, 0],
  offset: ["Stack center (mm)", -80, 80, 1, 0],
  fov: ["Field of view (mm)", 100, 260, 1, 220],
  slices: ["Slices", 1, 24, 1, 20],
  thickness: ["Thickness (mm)", 1, 12, 0.5, 5],
  gap: ["Gap (mm)", 0, 6, 0.5, 1],
};

export const timingFields = {
  tr: ["TR (ms)", 6, 10000, 1],
  te: ["TE (ms)", 5, 250, 1],
  ti: ["TI (ms)", 50, 4500, 1],
  flip: ["Flip angle (°)", 1, 90, 1],
  echoTrain: ["Echo train length", 2, 32, 1],
  echoSpacing: ["Echo spacing (ms)", 5, 40, 1],
};

export const matrices = [64, 96, 128];
export const samplingFields = {
  phaseFov: ["Phase FOV (%)", 50, 100, 1, 100],
  oversampling: ["Phase oversampling (%)", 0, 100, 1, 0],
  averages: ["Averages (NEX / NSA)", 1, 8, 1, 1],
  bandwidth: ["Receiver bandwidth (Hz/pixel)", 80, 800, 10, 250],
};
export const saturationFields = {
  satOffset: ["Band center (mm)", -130, 130, 1, 0],
  satWidth: ["Band thickness (mm)", 5, 70, 1, 25],
};
export const defaultPresentation = { width: 210, level: 105 };
export const presentationFields = {
  width: ["Window width", 1, 255, 1],
  level: ["Window level", 0, 255, 1],
};

export const defaultPlan = {
  plane: "axial", preset: "t1", matrix: 128, phaseMatrix: null, phaseDirection: "vertical",
  acquisition: "2D", satAxis: "none",
  ...Object.fromEntries(Object.entries(geometryFields).map(([key, field]) => [key, field[4]])),
  ...Object.fromEntries(Object.entries({ ...samplingFields, ...saturationFields }).map(([key, field]) => [key, field[4]])),
  tr: presets.t1.tr, te: presets.t1.te, ti: null,
  flip: null, echoTrain: null, echoSpacing: null,
};

function numberField(form, key, [, min, max, step]) {
  const values = form.getAll(key);
  if (values.length !== 1 || !/^-?\d+(?:\.\d+)?$/.test(values[0])) return NaN;
  const value = Number(values[0]);
  return value >= min && value <= max && Number.isInteger((value - min) / step) ? value : NaN;
}

export function readPlan(form, { allowTimingInvalid = false } = {}) {
  const plane = form.get("plane");
  const preset = form.get("preset");
  if (form.getAll("plane").length !== 1 || form.getAll("preset").length !== 1 ||
      !Object.hasOwn(planes, plane) || !Object.hasOwn(presets, preset)) return null;
  const matrix = numberField(form, "matrix", ["Matrix", 64, 128, 32]);
  const sequence = presets[preset].sequence;
  const fields = { ...geometryFields, tr: timingFields.tr, te: timingFields.te };
  if (sequence === "ir") fields.ti = timingFields.ti;
  if (sequence === "gre") fields.flip = timingFields.flip;
  if (sequence === "tse") { fields.echoTrain = timingFields.echoTrain; if (form.has("echoSpacing")) fields.echoSpacing = timingFields.echoSpacing; }
  const phaseMatrix = form.get("phaseMatrix") ?? "match";
  const phaseDirection = form.get("phaseDirection") ?? "vertical";
  const acquisition = form.get("acquisition") ?? "2D";
  const satAxis = form.get("satAxis") ?? "none";
  if (["phaseMatrix", "phaseDirection", "acquisition", "satAxis"].some(key => form.getAll(key).length > 1) ||
      !["match", ...matrices.map(String)].includes(phaseMatrix) ||
      !["horizontal", "vertical"].includes(phaseDirection) || !["none", "u", "v", "normal"].includes(satAxis) ||
      !(acquisition === "2D" || (acquisition === "3D" && sequence === "gre"))) return null;
  const optionalFields = satAxis === "none" ? samplingFields : { ...samplingFields, ...saturationFields };
  for (const [key, field] of Object.entries(optionalFields)) {
    if (form.has(key) || Object.hasOwn(saturationFields, key)) fields[key] = field;
  }
  const values = Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, numberField(form, key, field)]));
  if (!matrices.includes(matrix) || Object.values(values).some(Number.isNaN)) return null;
  const plan = {
    ...defaultPlan, ...values, plane, preset, matrix, phaseDirection, acquisition, satAxis,
    phaseMatrix: phaseMatrix === "match" ? null : Number(phaseMatrix),
  };
  if (sequence === "tse" && !form.has("echoSpacing")) plan.echoSpacing = 10;
  if (acquisition === "3D" && plan.gap !== 0) return null;
  if (sequence !== "gre" && plan.tr < 200) return null;
  if (!allowTimingInvalid && timingError(plan)) return null;
  if (Math.abs(plan.offset) + coverage(plan) / 2 > localizerFov / 2) return null;
  return plan;
}

export function readPresentation(form) {
  const width = numberField(form, "width", presentationFields.width);
  const level = numberField(form, "level", presentationFields.level);
  return Number.isNaN(width) || Number.isNaN(level) ? null : { width, level };
}

// Each index describes one tissue in the versioned teaching fixture (density, T1, T2).
const tissues = [
  [0, 1, 1], [0.92, 1300, 90], [0.76, 780, 75], [1, 3600, 1600],
  [0.84, 320, 85], [0.07, 500, 15], [0.83, 1470, 105], [0.83, 1110, 85],
];

function tissueAt(x, y, z) {
  const ax = Math.abs(x);
  const head = (x / 86) ** 2 + ((y - 3) / 108) ** 2 + ((z - 1) / 106) ** 2;
  if (head > 1) return 0;
  const brain = (x / 76) ** 2 + ((y - 4) / 96) ** 2 + ((z - 14) / 84) ** 2;
  const folding = Math.sin(ax * 0.36 + z * 0.12) * Math.cos(y * 0.22 - z * 0.09);
  if (brain < 1) {
    const ventricle = ((ax - 12) / 8) ** 2 + ((y - 2 - 0.55 * ax) / 34) ** 2 + ((z - 22 + (ax - 11) * 0.5) / 10) ** 2;
    if (ventricle < 1 || (x / 3.5) ** 2 + (y / 15) ** 2 + ((z - 11) / 11) ** 2 < 1) return 3;
    if (ax < 1.25 && z > 30) return 3;
    if (((ax - 25) / 13) ** 2 + ((y - 4) / 24) ** 2 + ((z - 15) / 15) ** 2 < 1) return 7;
    if (brain > 0.92 + 0.045 * folding && folding > 0.48) return 3;
    return brain > 0.72 + 0.085 * folding ? 1 : 2;
  }
  const cerebellum = (x / 59) ** 2 + ((y - 51) / 36) ** 2 + ((z + 38) / 25) ** 2;
  if (cerebellum < 1) return cerebellum > 0.64 + 0.15 * Math.cos(z * 1.4 + y * 0.18) ? 6 : 2;
  if ((x / 15) ** 2 + ((y - 14) / 18) ** 2 + ((z + 43) / 41) ** 2 < 1) return 2;
  if (head > 0.87) return 4;
  if (head > 0.72) return 5;
  if (z < -27 && y < 5 && ((ax - 24) / 16) ** 2 + ((z + 36) / 22) ** 2 < 1) return 0;
  return 3;
}

export const tissueProperties = tissues.map(([density, t1, t2], index) => ({
  density, t1, t2, t2Star: [1, 55, 45, 250, 45, 8, 55, 48][index],
}));

function tissueSignals(plan) { return tissueProperties.map(tissue => tissueSignal(plan, tissue)); }

// Integrate tissue fractions over finite voxels, then reconstruct complex signals.
// A fixed quadrature keeps classroom runs bounded; it is not an anatomical dataset.
function pixelsForSlice(grid, frame, offset, thickness, signals, target, plan, sliceIndex = 0) {
  const { rows, columns, widthMm, heightMm, columnsArePhase } = grid;
  const phaseCount = columnsArePhase ? columns : rows;
  const m = plan && samplingMetrics(plan);
  const encoded = m?.encodedPhase ?? phaseCount;
  const encodedGrid = { rows: columnsArePhase ? rows : encoded, columns: columnsArePhase ? encoded : columns };
  const er = encodedGrid.rows, ec = encodedGrid.columns;
  const du = widthMm / columns, dv = heightMm / rows;
  const period = (columnsArePhase ? du : dv) * encoded;
  const components = tissueProperties.map(() => new Float64Array(er * ec));
  const through = Math.max(1, Math.ceil(thickness / 2));
  const norm = 1 / (4 * through);
  const shiftMm = plan ? m.chemicalShiftPixels * plan.fov / plan.matrix : 0;
  function integrate(u, v, at, fatOnly = false) {
    for (const su of [-0.25, 0.25]) for (const sv of [-0.25, 0.25]) for (let z = 0; z < through; z++) {
      const a = u + su * du, b = v + sv * dv, c = offset + ((z + 0.5) / through - 0.5) * thickness;
      const point = patientPoint(frame, a, b, c);
      const tissue = tissueAt(...point);
      if (!tissue || (fatOnly ? tissue !== 4 : tissue === 4 && plan)) continue;
      let attenuation = 1;
      if (plan?.satAxis && plan.satAxis !== "none") {
        const position = plan.satAxis === "u" ? a : plan.satAxis === "v" ? b : c;
        // Ideal spatial 90-degree saturation followed by 10 ms T1 recovery.
        if (Math.abs(position - plan.satOffset) <= plan.satWidth / 2) attenuation = 1 - Math.exp(-10 / tissueProperties[tissue].t1);
      }
      components[tissue][at] += norm * attenuation;
    }
  }
  for (let row = 0; row < er; row++) for (let col = 0; col < ec; col++) {
    const u = (col + 0.5 - ec / 2) * du, v = (row + 0.5 - er / 2) * dv, at = row * ec + col;
    const phase = columnsArePhase ? u : v;
    for (let wrap = -Math.ceil(264 / period); wrap <= Math.ceil(264 / period); wrap++) {
      const a = u + (columnsArePhase ? wrap * period : 0), b = v + (columnsArePhase ? 0 : wrap * period);
      if (Math.abs((columnsArePhase ? a : b)) > 132) continue;
      integrate(a, b, at);
      if (plan) integrate(a - (columnsArePhase ? 0 : shiftMm), b - (columnsArePhase ? shiftMm : 0), at, true);
    }
  }
  if (plan && sequenceKind(plan) === "tse") {
    components.forEach((component, index) => {
      if (index) filterPhase(component, er, ec, columnsArePhase, plan.echoTrain, echoSpacing(plan), tissueProperties[index].t2);
    });
  }
  let seed = sliceIndex + 1;
  const uniform = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return (seed + 0.5) / 4294967296; };
  const fatPhase = plan && sequenceKind(plan) === "gre" ? 2 * Math.PI * fatWaterHz * plan.te / 1000 : 0;
  const fatCos = Math.cos(fatPhase), fatSin = Math.sin(fatPhase);
  function complex(at) {
    let real = 0, imag = 0;
    for (let t = 1; t < components.length; t++) {
      const amplitude = components[t][at] * signals[t];
      real += amplitude * (t === 4 ? fatCos : 1);
      if (t === 4) imag += amplitude * fatSin;
    }
    return [real, imag];
  }
  const crop = (encoded - phaseCount) / 2;
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const p = (columnsArePhase ? col : row) + crop, lo = Math.floor(p), fraction = p - lo;
    const at = columnsArePhase ? row * ec + lo : lo * ec + col;
    const next = columnsArePhase ? row * ec + Math.min(lo + 1, ec - 1) : Math.min(lo + 1, er - 1) * ec + col;
    const first = complex(at), second = fraction ? complex(next) : first;
    let real = first[0] * (1 - fraction) + second[0] * fraction, imag = first[1] * (1 - fraction) + second[1] * fraction;
    if (plan) {
      const radius = m.noiseSigma * Math.sqrt(-2 * Math.log(uniform())), angle = 2 * Math.PI * uniform();
      real += radius * Math.cos(angle); imag += radius * Math.sin(angle);
    }
    target[row * columns + col] = Math.max(0, Math.min(255, Math.round(Math.hypot(real, imag))));
  }
}

export function acquireMr(plan) {
  plan = { ...defaultPlan, ...plan };
  if (sequenceKind(plan) === "tse" && plan.echoSpacing == null) plan.echoSpacing = 10;
  const frame = sliceFrame(plan.plane, plan.angle);
  const grid = sampleGrid(plan);
  const { rows, columns, widthMm, heightMm } = grid;
  const signals = tissueSignals(plan);
  const sliceSize = rows * columns;
  const pixels = new Uint8Array(plan.slices * sliceSize);
  const centersMm = Array.from({ length: plan.slices }, (_, index) => {
    const offset = sliceCenter(plan, index);
    pixelsForSlice(grid, frame, offset, plan.thickness, signals,
      pixels.subarray(index * sliceSize, (index + 1) * sliceSize), plan, index);
    return patientPoint(frame, 0, 0, offset);
  });
  return {
    sourceVersion, engineVersion, pixels,
    geometry: {
      ...frame, centersMm, plane: plan.plane, angle: plan.angle, offset: plan.offset, fov: plan.fov,
      slices: plan.slices, thickness: plan.thickness, gap: plan.gap, coverage: coverage(plan),
      rows, columns, widthMm, heightMm, columnSpacingMm: widthMm / columns, rowSpacingMm: heightMm / rows,
    },
    parameters: {
      sequence: presets[plan.preset].sequence, preset: plan.preset,
      tr: plan.tr, te: plan.te, ti: plan.ti, matrix: plan.matrix, acquisition: plan.acquisition,
      flip: plan.flip, echoTrain: plan.echoTrain, echoSpacing: plan.echoSpacing, phaseFov: plan.phaseFov, phaseMatrix: plan.phaseMatrix,
      phaseDirection: plan.phaseDirection, frequencyDirection: grid.columnsArePhase ? "vertical" : "horizontal",
      oversampling: plan.oversampling, averages: plan.averages, bandwidth: plan.bandwidth,
      satAxis: plan.satAxis, satOffset: plan.satOffset, satWidth: plan.satWidth,
      durationSeconds: estimateScanSeconds(plan),
      physics: { version: physicsVersion, fieldStrengthTesla, fatWaterHz, ...samplingMetrics(plan),
        echoOrdering: sequenceKind(plan) === "tse" ? "centric-bands-center-first" : null,
        signalModel: "ideal-spoiled-steady-state", saturationRecoveryMs: 10 },
    },
  };
}

export function makeLocalizers() {
  const sliceSize = localizerSize ** 2;
  const pixels = Buffer.alloc(Object.keys(planes).length * sliceSize);
  const signals = tissueSignals({ ...presets.pd, preset: "pd" });
  const grid = { rows: localizerSize, columns: localizerSize, widthMm: localizerFov, heightMm: localizerFov };
  Object.keys(planes).forEach((plane, index) => {
    pixelsForSlice(grid, planes[plane], 0, 5, signals,
      pixels.subarray(index * sliceSize, (index + 1) * sliceSize));
  });
  return pixels;
}

export function planFromAcquisition(series) {
  if (!series) return defaultPlan;
  const geometry = JSON.parse(series.geometry);
  const plan = { ...defaultPlan, ...geometry, ...JSON.parse(series.parameters) };
  if (plan.preset === "tse" && plan.echoSpacing == null) plan.echoSpacing = 10;
  return plan;
}
