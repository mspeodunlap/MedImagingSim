// Fixture coordinates are millimetres along patient left, posterior and superior.
export const planes = {
  axial: { u: [1, 0, 0], v: [0, 1, 0], normal: [0, 0, 1], labels: ["A", "P", "R", "L"] },
  coronal: { u: [1, 0, 0], v: [0, 0, -1], normal: [0, 1, 0], labels: ["S", "I", "R", "L"] },
  sagittal: { u: [0, -1, 0], v: [0, 0, -1], normal: [1, 0, 0], labels: ["S", "I", "P", "A"] },
};

export const localizerSize = 144;
export const localizerFov = 264;

export { estimateScanSeconds } from "./mr-physics.js";

export function sliceFrame(plane, angle) {
  const { u, v, normal } = planes[plane];
  const radians = angle * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    u,
    v: v.map((axis, i) => axis * cos + normal[i] * sin),
    normal: normal.map((axis, i) => axis * cos - v[i] * sin),
  };
}

export function patientPoint(frame, x, y, offset) {
  return frame.u.map((u, i) => u * x + frame.v[i] * y + frame.normal[i] * offset);
}

export function sliceCenter(plan, index) {
  return plan.offset + (index - (plan.slices - 1) / 2) * (plan.thickness + plan.gap);
}

export function coverage(plan) {
  return plan.slices * plan.thickness + (plan.slices - 1) * plan.gap;
}

export function sampleGrid(plan) {
  const columnsArePhase = plan.phaseDirection === "horizontal";
  const phaseSize = plan.phaseMatrix ?? plan.matrix;
  const phaseFov = plan.fov * (plan.phaseFov ?? 100) / 100;
  return {
    columns: columnsArePhase ? phaseSize : plan.matrix,
    rows: columnsArePhase ? plan.matrix : phaseSize,
    widthMm: columnsArePhase ? phaseFov : plan.fov,
    heightMm: columnsArePhase ? plan.fov : phaseFov,
    columnsArePhase,
  };
}
