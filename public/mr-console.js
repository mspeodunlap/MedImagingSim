import { coverage, estimateScanSeconds, localizerFov, patientPoint, planes, sampleGrid, sliceCenter, sliceFrame } from "./mr-geometry.js";

function showStage(stage, updateHash = true) {
  const root = document.querySelector(".mr-console");
  if (!root) return;
  if (location.pathname !== root.dataset.consoleBase) history.replaceState(null, "", `${root.dataset.consoleBase}${location.search}${location.hash}`);
  const valid = ["setup", "planning", "review", "finish"];
  if (!valid.includes(stage)) stage = root.dataset.defaultStage;
  root.querySelectorAll("[data-console-stage]").forEach(section => { section.hidden = section.dataset.consoleStage !== stage; });
  root.querySelectorAll("[data-stage-link]").forEach(link => {
    if (link.dataset.stageLink === stage) link.setAttribute("aria-current", "step");
    else link.removeAttribute("aria-current");
  });
  if (updateHash) history.replaceState(null, "", `#${stage}`);
}

function setupWorkspace() {
  const root = document.querySelector(".mr-console");
  if (!root) return;
  root.addEventListener("click", event => {
    const link = event.target.closest("[data-stage-link]");
    if (link && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault(); showStage(link.dataset.stageLink);
    }
  });
  window.addEventListener("hashchange", () => showStage(location.hash.slice(1), false));
  showStage(location.hash.slice(1), false);
  document.querySelectorAll("[data-parameter-view]").forEach(button => button.addEventListener("click", () => {
    const all = button.dataset.parameterView === "all";
    document.querySelectorAll(".mr-advanced").forEach(details => { details.open = all; });
    document.querySelectorAll("[data-parameter-view]").forEach(b => b.setAttribute("aria-pressed", String(b === button)));
  }));
  const form = document.getElementById("mr-plan");
  if (!form) return;
  form.addEventListener("invalid", () => showStage("planning"), true);
  let submitting = false;
  form.addEventListener("submit", event => {
    const action = event.submitter?.getAttribute("formaction") ?? form.action;
    if (!action.endsWith("/scan")) return;
    if (submitting) { event.preventDefault(); return; }
    submitting = true;
    form.setAttribute("aria-busy", "true");
    document.querySelectorAll(".mr-run").forEach(button => { button.disabled = true; });
    const status = document.getElementById("mr-scan-status");
    status.hidden = false; status.textContent = "Generating synthetic images… Please wait. The shared classroom scanner may be busy.";
  });
  window.addEventListener("pageshow", () => {
    submitting = false; form.removeAttribute("aria-busy");
    document.querySelectorAll(".mr-run").forEach(button => { button.disabled = false; });
    document.getElementById("mr-scan-status").hidden = true;
  });
}

function grayscale(ctx, pixels, width = 255, level = 127.5) {
  const { width: cols, height: rows } = ctx.canvas;
  const image = ctx.createImageData(cols, rows);
  const low = level - width / 2;
  for (let i = 0; i < pixels.length; i++) {
    const gray = (pixels[i] - low) * 255 / width;
    const offset = i * 4;
    image.data[offset] = image.data[offset + 1] = image.data[offset + 2] = gray;
    image.data[offset + 3] = 255;
  }
  return image;
}

async function loadPixels(url, expected, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok || response.headers.get("content-type") !== "application/octet-stream") throw new Error("Image request failed");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length !== expected) throw new Error("Unexpected image size");
  return bytes;
}

function showError(id, message) {
  const error = document.getElementById(id);
  error.textContent = message;
  error.hidden = false;
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function drawStack(ctx, view, plan) {
  const frame = sliceFrame(plan.plane, plan.angle);
  const scale = ctx.canvas.width / localizerFov;
  const { widthMm, heightMm } = sampleGrid(plan);
  const halfU = widthMm / 2;
  const halfV = heightMm / 2;
  const project = (u, v, offset) => {
    const p = patientPoint(frame, u, v, offset);
    return [ctx.canvas.width / 2 + dot(p, view.u) * scale, ctx.canvas.height / 2 + dot(p, view.v) * scale];
  };
  const corners = offset => [
    project(-halfU, -halfV, offset), project(halfU, -halfV, offset),
    project(halfU, halfV, offset), project(-halfU, halfV, offset),
  ];
  const stroke = (points, closed = false) => {
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (const point of points.slice(1)) ctx.lineTo(...point);
    if (closed) ctx.closePath();
    ctx.stroke();
  };

  const start = corners(plan.offset - coverage(plan) / 2);
  const end = corners(plan.offset + coverage(plan) / 2);
  ctx.strokeStyle = "#78f5e5";
  ctx.lineWidth = 0.7;
  ctx.setLineDash([3, 2]);
  stroke(start, true);
  stroke(end, true);
  start.forEach((point, index) => stroke([point, end[index]]));
  ctx.setLineDash([]);

  // In a parallel view the slice centres coincide in projection. Show their common footprint.
  if (Math.abs(dot(view.normal, frame.normal)) > 0.999) {
    stroke(corners(plan.offset), true);
  } else {
    ctx.strokeStyle = "#78f5e599";
    for (let index = 0; index < plan.slices; index++) {
      const offset = sliceCenter(plan, index);
      const alongU = Math.abs(dot(frame.u, view.normal)) < Math.abs(dot(frame.v, view.normal));
      stroke(alongU ? [project(-halfU, 0, offset), project(halfU, 0, offset)]
        : [project(0, -halfV, offset), project(0, halfV, offset)]);
    }
  }
  if (plan.satAxis !== "none") {
    const band = [plan.satOffset - plan.satWidth / 2, plan.satOffset + plan.satWidth / 2];
    ctx.strokeStyle = "#ffc277";
    ctx.lineWidth = 1.2;
    for (const edge of band) {
      if (plan.satAxis === "normal") stroke(corners(edge), true);
      else if (plan.satAxis === "u") stroke([project(edge, -halfV, plan.offset), project(edge, halfV, plan.offset)]);
      else stroke([project(-halfU, edge, plan.offset), project(halfU, edge, plan.offset)]);
    }
  }
}

async function setupPlanner() {
  const form = document.getElementById("mr-plan");
  if (!form) return;
  const fields = form.elements;
  const canvases = [...document.querySelectorAll("canvas[data-plane]")];
  const output = document.getElementById("mr-coverage");
  let images;

  function update() {
    const keys = ["angle", "offset", "fov", "slices", "thickness", "gap", "phaseFov"];
    if (fields.satAxis.value !== "none") keys.push("satOffset", "satWidth");
    const plan = Object.fromEntries(keys.map(key => [key, fields[key].valueAsNumber]));
    plan.plane = fields.plane.value;
    plan.phaseDirection = fields.phaseDirection.value;
    plan.satAxis = fields.satAxis.value;
    const distance = coverage(plan);
    const validGeometry = keys.every(key => {
      const input = fields[key];
      const { badInput, rangeOverflow, rangeUnderflow, stepMismatch, valueMissing } = input.validity;
      return !badInput && !rangeOverflow && !rangeUnderflow && !stepMismatch && !valueMissing;
    });
    const fits = Math.abs(plan.offset) + distance / 2 <= localizerFov / 2;
    fields.offset.setCustomValidity(validGeometry && !fits ? "Reduce stack coverage or move the stack center toward zero." : "");
    fields.te.setCustomValidity(fields.te.valueAsNumber >= fields.tr.valueAsNumber ? "TE must be shorter than TR." : "");
    fields.ti.setCustomValidity(!fields.ti.disabled && fields.ti.valueAsNumber + fields.te.valueAsNumber >= fields.tr.valueAsNumber
      ? "TI plus TE must be shorter than TR." : "");
    output.value = validGeometry ? `${distance} mm` : "—";
    const estimate = estimateScanSeconds({ phaseMatrix: fields.phaseMatrix.value === "match" ? null : Number(fields.phaseMatrix.value), matrix: Number(fields.matrix.value), oversampling: fields.oversampling.valueAsNumber,
      acquisition: fields.acquisition.value, slices: plan.slices, averages: fields.averages.valueAsNumber, tr: fields.tr.valueAsNumber, echoTrain: fields.echoTrain.disabled ? null : fields.echoTrain.valueAsNumber });
    const time = document.getElementById("mr-model-time");
    if (time) time.textContent = Number.isFinite(estimate) ? `${Math.floor(estimate / 60)}m ${Math.round(estimate % 60)}s` : "—";
    const saved = JSON.parse(form.dataset.savedPlan);
    const dirty = Object.keys(saved).filter(key => fields[key] && !fields[key].disabled && !["durationSeconds", "protocolContext"].includes(key))
      .some(key => fields[key].value !== String(saved[key] ?? (key === "phaseMatrix" ? "match" : "")));
    document.getElementById("mr-draft-state").textContent = dirty ? "Unsaved draft changes" : "Saved plan";
    const state = document.querySelector(".mr-sequence-list .is-current [data-sequence-state]");
    if (state) {
      state.dataset.savedText ??= state.textContent;
      state.textContent = dirty ? "Draft changed · not acquired" : state.dataset.savedText;
    }
    images?.forEach(({ ctx, plane, image }) => {
      ctx.putImageData(image, 0, 0);
      if (validGeometry && fits) drawStack(ctx, planes[plane], plan);
    });
  }

  fields.preset.addEventListener("change", () => {
    const preset = fields.preset.selectedOptions[0].dataset;
    for (const key of ["tr", "te", "ti", "flip", "echoTrain"]) {
      fields[key].value = preset[key];
      fields[key].disabled = !preset[key];
    }
    const volumeOption = fields.acquisition.options[1];
    volumeOption.disabled = preset.sequence !== "gre";
    fields.tr.min = preset.sequence === "gre" ? "6" : "200";
    if (volumeOption.disabled) {
      fields.acquisition.value = "2D";
      fields.gap.readOnly = false;
    }
    update();
  });
  fields.acquisition.addEventListener("change", () => {
    fields.gap.readOnly = fields.acquisition.value === "3D";
    if (fields.gap.readOnly) fields.gap.value = "0";
    update();
  });
  fields.satAxis.addEventListener("change", () => {
    const off = fields.satAxis.value === "none";
    fields.satOffset.disabled = off;
    fields.satWidth.disabled = off;
    update();
  });
  form.addEventListener("input", update);
  canvases.forEach(canvas => {
    let drag;
    canvas.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      const frame = sliceFrame(fields.plane.value, fields.angle.valueAsNumber), view = planes[canvas.dataset.plane];
      const u = dot(frame.normal, view.u), v = dot(frame.normal, view.v), length = u * u + v * v;
      if (length < 0.01) return;
      drag = { x: event.clientX, y: event.clientY, offset: fields.offset.valueAsNumber, u, v, length };
      canvas.setPointerCapture(event.pointerId); event.preventDefault();
    });
    canvas.addEventListener("pointermove", event => {
      if (!drag) return;
      const rect = canvas.getBoundingClientRect();
      const delta = ((event.clientX - drag.x) * localizerFov / rect.width * drag.u + (event.clientY - drag.y) * localizerFov / rect.height * drag.v) / drag.length;
      const span = coverage({ slices: fields.slices.valueAsNumber, thickness: fields.thickness.valueAsNumber, gap: fields.gap.valueAsNumber });
      const limit = Math.min(80, Math.floor((localizerFov - span) / 2));
      if (!Number.isFinite(limit) || limit < 0) return;
      fields.offset.value = String(Math.max(-limit, Math.min(limit, Math.round(drag.offset + delta))));
      fields.offset.dispatchEvent(new Event("input", { bubbles: true }));
    });
    canvas.addEventListener("pointerup", () => { drag = null; });
    canvas.addEventListener("pointercancel", () => { drag = null; });
  });
  update();

  try {
    const size = canvases[0].width ** 2;
    const bytes = await loadPixels(document.querySelector("[data-localizers]").dataset.localizers, size * canvases.length);
    images = canvases.map((canvas, index) => {
      const ctx = canvas.getContext("2d");
      return { ctx, plane: canvas.dataset.plane, image: grayscale(ctx, bytes.subarray(index * size, (index + 1) * size)) };
    });
    update();
  } catch {
    showError("mr-localizer-error", "The localizers could not load. Reload the console to try again.");
  }
}

async function setupViewer(root, signal) {
  const canvas = root.querySelector("#mr-image");
  if (!canvas) return;
  const slice = root.querySelector("#mr-slice");
  const count = Number(slice.max);
  const output = root.querySelector("#mr-slice-number");
  const form = root.querySelector("#mr-presentation");
  if (form.hasAttribute("data-preview-only")) form.addEventListener("submit", event => event.preventDefault());
  const { width, level } = form.elements;
  const ctx = canvas.getContext("2d");
  const sliceSize = canvas.width * canvas.height;

  const bytes = await loadPixels(canvas.dataset.pixels, sliceSize * count, signal);
  function draw() {
    const current = slice.valueAsNumber;
    output.value = `${current} / ${count}`;
    if (!width.validity.valid || !level.validity.valid) return;
    ctx.putImageData(grayscale(ctx, bytes.subarray((current - 1) * sliceSize, current * sliceSize),
      width.valueAsNumber, level.valueAsNumber), 0, 0);
  }
  slice.addEventListener("input", draw);
  root.querySelectorAll("[data-slice-step]").forEach(button => button.addEventListener("click", () => {
    slice.value = String(Math.max(1, Math.min(count, slice.valueAsNumber + Number(button.dataset.sliceStep)))); draw();
  }));
  root.querySelector("[data-reset-window]")?.addEventListener("click", () => { width.value = "210"; level.value = "105"; draw(); });
  form.addEventListener("input", draw);
  draw();
}

function setupSeriesPreview() {
  const history = document.getElementById("mr-series");
  const preview = document.getElementById("mr-preview");
  const content = document.getElementById("mr-preview-content");
  const status = document.getElementById("mr-preview-status");
  const links = [...history.querySelectorAll("[data-series]")];
  const dragType = "text/x-medsim-series";
  let pending;

  async function showSeries(link) {
    pending?.abort();
    const controller = new AbortController();
    const { signal } = controller;
    pending = controller;
    preview.setAttribute("aria-busy", "true");
    status.textContent = `Loading series ${link.dataset.series}…`;
    status.hidden = false;
    try {
      const response = await fetch(`${preview.dataset.base}/preview/${link.dataset.series}`, { signal });
      if (response.redirected && new URL(response.url).pathname === "/sign-in") {
        window.location.assign("/sign-in");
        return;
      }
      if (!response.ok) throw new Error("Series preview request failed");
      const documentFragment = new DOMParser().parseFromString(await response.text(), "text/html");
      const next = documentFragment.querySelector("[data-preview-series]");
      if (next?.dataset.previewSeries !== link.dataset.series) throw new Error("Unexpected preview series");
      const viewer = document.importNode(next, true);
      await setupViewer(viewer, signal);
      if (signal.aborted) return;
      content.replaceChildren(viewer);
      links.forEach(entry => {
        if (entry === link) entry.setAttribute("aria-current", "true");
        else entry.removeAttribute("aria-current");
      });
      status.textContent = `Showing series ${link.dataset.series}.`;
      status.hidden = true;
      window.history.replaceState(null, "", link.href);
      showStage("review");
      updateGeometrySource(link.dataset.series);
    } catch {
      if (!signal.aborted) status.textContent = "The series could not load. Select it again to retry.";
    } finally {
      if (pending === controller) preview.removeAttribute("aria-busy");
    }
  }

  history.addEventListener("click", event => {
    const link = event.target.closest("a[data-series]");
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    showSeries(link);
  });
  history.addEventListener("dragstart", event => {
    const link = event.target.closest("a[data-series]");
    if (!link) return;
    event.dataTransfer.setData(dragType, link.dataset.series);
    event.dataTransfer.effectAllowed = "copy";
  });
  history.addEventListener("dragend", () => preview.classList.remove("is-drop-target"));
  preview.addEventListener("dragover", event => {
    if (!event.dataTransfer.types.includes(dragType)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    preview.classList.add("is-drop-target");
  });
  preview.addEventListener("dragleave", event => {
    if (!preview.contains(event.relatedTarget)) preview.classList.remove("is-drop-target");
  });
  preview.addEventListener("drop", event => {
    const id = event.dataTransfer.getData(dragType);
    if (!id) return;
    event.preventDefault();
    preview.classList.remove("is-drop-target");
    const link = links.find(entry => entry.dataset.series === id);
    if (link) showSeries(link);
  });

  const initialViewer = content.firstElementChild;
  updateGeometrySource(initialViewer?.dataset.previewSeries);
  setupViewer(initialViewer).catch(() => {
    const error = initialViewer.querySelector("#mr-image-error");
    if (error) {
      error.textContent = "The acquired image could not load. Select the series again to retry.";
      error.hidden = false;
    }
  });
}

function updateGeometrySource(id) {
  const button = document.querySelector("[data-geometry-action]");
  if (!button) return;
  button.disabled = !id;
  button.type = "submit";
  button.name = "protocolAction";
  button.value = `geometry:${id}`;
  button.setAttribute("formaction", `${document.getElementById("mr-preview").dataset.base}/protocol`);
}

setupWorkspace();
setupPlanner();
setupSeriesPreview();
