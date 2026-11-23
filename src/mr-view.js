import { samplingMetrics } from "../public/mr-physics.js";
import { coverage, localizerSize, planes } from "../public/mr-geometry.js";
import {
  defaultPlan, defaultPresentation, estimateScanSeconds, geometryFields, matrices, planFromAcquisition, presentationFields, presets,
  samplingFields, saturationFields, timingFields,
} from "./mr.js";
import { escape, page, workflowForm } from "./views.js";
import { durationLabel, sequenceProgress } from "./console-workflow.js";
import { workflowLabels } from "./lifecycle.js";
import { teachingStarters } from "./mri-dictionary.js";

function numberInput(key, [label, min, max, step], value, disabled = false, readOnly = false) {
  return `<label>${label}<input type="number" name="${key}" min="${min}" max="${max}" step="${step}"
    value="${value ?? ""}" required${disabled ? " disabled" : ""}${readOnly ? " readonly" : ""}></label>`;
}

function option(value, label, selected) {
  return `<option value="${value}"${value === selected ? " selected" : ""}>${label}</option>`;
}

function physicsFeedback(plan) {
  const m = samplingMetrics(plan);
  return `Voxel ${m.voxel.map(v => v.toFixed(2)).join(" × ")} mm · Relative sampling SNR ${m.relativeSamplingSnr.toFixed(2)}× · Readout ${m.readoutMs.toFixed(2)} ms · Fat shift ${m.chemicalShiftPixels.toFixed(2)} pixels · ${m.packages} slice package(s)`;
}

function planner(base, plan, scanKey, protocolRevision = 0, savedPlan = plan) {
  return `<section class="panel mr-controls">
    <div class="mr-panel-heading"><h2>Scan parameters</h2><div class="mr-parameter-views" aria-label="Parameter detail"><button type="button" class="secondary" data-parameter-view="basic" aria-pressed="true">Essential</button><button type="button" class="secondary" data-parameter-view="all" aria-pressed="false">All parameters</button></div></div>
    <form id="mr-plan" action="${base}/scan" method="post" class="mr-plan-fields" data-saved-plan="${escape(JSON.stringify(savedPlan))}">
      <input type="hidden" name="scanKey" value="${scanKey}">
      <input type="hidden" name="protocolRevision" value="${protocolRevision}">
      <label class="mr-preset">Preset<select name="preset" form="mr-plan">${Object.entries(presets).map(([key, preset]) => `<option value="${key}" data-tr="${preset.tr}" data-te="${preset.te}" data-ti="${preset.ti ?? ""}" data-flip="${preset.flip ?? ""}" data-echo-train="${preset.echoTrain ?? ""}" data-echo-spacing="${preset.echoSpacing ?? ""}" data-sequence="${preset.sequence}" ${key === plan.preset ? "selected" : ""}>${preset.label}</option>`).join("")}</select></label>
      <fieldset><legend>Slice geometry</legend><div class="mr-fields">
        <label>Plane<select name="plane">
          ${Object.keys(planes).map(plane => option(plane, plane, plan.plane)).join("")}
        </select></label>
        <label>Acquisition mode<select name="acquisition">
          ${option("2D", "2D slice stack", plan.acquisition)}
          <option value="3D"${plan.acquisition === "3D" ? " selected" : ""}${plan.preset !== "gre" ? " disabled" : ""}>3D slab (GRE)</option>
        </select></label>
        ${Object.entries(geometryFields).map(([key, field]) =>
          numberInput(key, field, plan[key], false, key === "gap" && plan.acquisition === "3D")).join("")}
      </div><p class="mr-coverage muted">Stack coverage <output id="mr-coverage">${coverage(plan)} mm</output></p></fieldset>
      <fieldset><legend>Sequence timing</legend>
        <div class="mr-fields">
          ${Object.entries(timingFields).map(([key, field]) => {
            const input = key === "tr" && plan.preset !== "gre" ? [field[0], 200, ...field.slice(2)] : field;
            return numberInput(key, input, plan[key] ?? (key === "echoSpacing" && plan.preset === "tse" ? 10 : null), plan[key] == null && !(key === "echoSpacing" && plan.preset === "tse"));
          }).join("")}
        </div>
      </fieldset>
      <p class="mr-hint" id="mr-physics-feedback" role="status">${physicsFeedback(plan)}</p>
      <p class="mr-hint">Fixed 1.5 T frequency assumption; synthetic tissue constants. FSE uses a center-first teaching echo order. Relative SNR excludes contrast. These are model estimates, not scanner safety limits.</p>
      <details class="mr-advanced"><summary>Sampling and encoding</summary><div class="mr-fields">
        <label>Frequency matrix<select name="matrix">
          ${matrices.map(size => option(size, size, plan.matrix)).join("")}
        </select></label>
        <label>Phase matrix<select name="phaseMatrix">
          ${option("match", "Match frequency", plan.phaseMatrix ?? "match")}
          ${matrices.map(size => option(size, size, plan.phaseMatrix)).join("")}
        </select></label>
        <label>Phase direction<select name="phaseDirection">
          ${option("vertical", "Top ↔ bottom", plan.phaseDirection)}
          ${option("horizontal", "Left ↔ right", plan.phaseDirection)}
        </select></label>
        ${Object.entries(samplingFields).map(([key, field]) => numberInput(key, field, plan[key])).join("")}
      </div></details>
      <details class="mr-advanced"${plan.satAxis !== "none" ? " open" : ""}><summary>Spatial saturation</summary>
        <div class="mr-fields"><label>Saturation band<select name="satAxis">
          ${option("none", "Off", plan.satAxis)}
          ${option("u", "Left ↔ right", plan.satAxis)}
          ${option("v", "Top ↔ bottom", plan.satAxis)}
          ${option("normal", "Through slice stack", plan.satAxis)}
        </select></label>
        ${Object.entries(saturationFields).map(([key, field]) => numberInput(key, field, plan[key], plan.satAxis === "none")).join("")}
      </div></details>
    </form>
  </section>`;
}

function patientExam(order) {
  return `<section class="panel mr-patient">
    <h2>Patient and exam</h2>
    <p class="mr-patient-name">${escape(order.patient_name)} <span>${order.patient_age} yr</span></p>
    <dl>
      <dt>Exam</dt><dd>${escape(order.exam_name)}</dd>
      <dt>Accession</dt><dd class="accession">${escape(order.accession)}</dd>
      <dt>Indication</dt><dd>${escape(order.indication)}</dd>
    </dl>
    <p class="status ready">Screening complete</p>
  </section>`;
}

function localizers(base) {
  return `<section class="panel mr-localizers" data-localizers="${base}/localizers">
    <h2>Positioning localizers</h2>
    <div class="mr-localizer-grid">${Object.entries(planes).map(([plane, { labels }]) => `
      <figure><figcaption>${plane}</figcaption><div class="mr-viewport">
        <canvas width="${localizerSize}" height="${localizerSize}" data-plane="${plane}" aria-label="${plane} localizer"></canvas>
        ${labels.map((label, index) => `<span class="mr-orientation mr-edge-${index}">${label}</span>`).join("")}
      </div></figure>`).join("")}
    </div>
    <p class="muted mr-hint">Cyan: slice stack and FOV · Amber: spatial saturation. Drag an orthogonal localizer to move the stack center; use Angulation to rotate it.</p>
    <p class="notice error" id="mr-localizer-error" role="alert" hidden></p>
  </section>`;
}

export function acquisitionViewer(base, series, selection, readOnly = false) {
  if (!series) return '<div class="mr-preview-empty"><p>Run a scan to preview its slices.</p></div>';
  const geometry = JSON.parse(series.geometry);
  const parameters = JSON.parse(series.parameters);
  const { rows, columns, slices } = geometry;
  const presentation = selection?.id === series.id ? selection : defaultPresentation;
  const initialSlice = Math.ceil(slices / 2);

  return `<div class="mr-review" data-preview-series="${series.id}">
    <div class="mr-series-caption"><strong>Series ${series.id}</strong><span>${escape(parameters.protocolContext?.sequenceName ?? presets[parameters.preset].label)}</span></div>
      <div>
        <canvas id="mr-image" class="mr-image" width="${columns}" height="${rows}" data-pixels="${base}/pixels/${series.id}"
          aria-label="Acquired image from series ${series.id}"></canvas>
        <label>Slice <output id="mr-slice-number">${initialSlice} / ${slices}</output>
          <input type="range" id="mr-slice" min="1" max="${slices}" value="${initialSlice}"${slices === 1 ? " disabled" : ""}>
        </label>
        <div class="mr-image-tools"><button type="button" class="secondary" data-slice-step="-1">Previous slice</button><button type="button" class="secondary" data-slice-step="1">Next slice</button><button type="button" class="secondary" data-reset-window>Reset display</button></div><p class="notice error" id="mr-image-error" role="alert" hidden></p>
      </div>
      <details class="mr-review-details"><summary>Series details</summary>
        <dl>
          <dt>Image model</dt><dd>${escape(series.engine_version ?? "Earlier saved model")}${parameters.physics ? ` · ${parameters.physics.fieldStrengthTesla} T frequency assumption` : " · Earlier model; current physics corrections do not alter these saved pixels"}</dd>
          ${parameters.physics ? `<dt>Physics at acquisition</dt><dd>${parameters.physics.voxel.map(v => v.toFixed(2)).join(" × ")} mm voxels · ${parameters.physics.readoutMs.toFixed(2)} ms readout · ${parameters.physics.chemicalShiftPixels.toFixed(2)} pixel fat shift · ${parameters.physics.packages} slice package(s)</dd>` : ""}
          <dt>Geometry</dt><dd class="mr-plane">${parameters.acquisition} · ${geometry.plane} · ${geometry.angle}° · ${slices} slices</dd>
          <dt>Sampling</dt><dd>${geometry.fov} mm readout FOV · ${geometry.thickness} mm thickness · ${geometry.gap} mm gap</dd>
          <dt>Timing</dt><dd>TR ${parameters.tr} ms · TE ${parameters.te} ms${parameters.ti === null ? "" : ` · TI ${parameters.ti} ms`}</dd>
          <dt>Matrix</dt><dd>${columns} × ${rows}</dd>
          ${parameters.durationSeconds === undefined ? "" : `<dt>Estimated acquisition time</dt><dd>${Math.round(parameters.durationSeconds)} s</dd>
          <dt>Encoding</dt><dd>${parameters.phaseDirection} phase · ${parameters.phaseFov}% phase FOV · ${parameters.oversampling}% oversampling</dd>
          <dt>Acquisition settings</dt><dd>${parameters.averages} averages · ${parameters.bandwidth} Hz/pixel
            ${parameters.flip === null ? "" : ` · ${parameters.flip}° flip`}
            ${parameters.echoTrain === null ? "" : ` · ETL ${parameters.echoTrain}${parameters.echoSpacing ? ` · spacing ${parameters.echoSpacing} ms` : ""}`}</dd>
          ${parameters.satAxis === "none" ? "" : `<dt>Spatial saturation</dt><dd>Band center ${parameters.satOffset} mm · ${parameters.satWidth} mm thick</dd>`}`}
        </dl>
      </details>
        <form id="mr-presentation" action="${base}/selection/${series.id}" method="post" class="stack"${readOnly ? ' data-preview-only' : ""}>
          <div class="mr-fields">
            ${Object.entries(presentationFields).map(([key, field]) => numberInput(key, field, presentation[key])).join("")}
          </div>
          ${readOnly ? '<p>Image review only. Window and level changes here are temporary.</p>' : '<button>Save PACS selection</button>'}
        </form>
  </div>`;
}

function seriesHistory(base, acquisitions, viewed, selection) {
  return `<section class="panel mr-protocol"><h2>Acquisition history <span class="mr-count">${acquisitions.length}</span></h2>
    ${selection ? `<p class="mr-hint">Selected for PACS · Series ${selection.id} · W ${selection.width} / L ${selection.level}</p>` : ""}
    <div class="mr-series" id="mr-series">${acquisitions.length ? `<ul>${acquisitions.map(series => {
      const p = JSON.parse(series.parameters), g = JSON.parse(series.geometry);
      return `<li><a draggable="true" data-series="${series.id}" href="${base}?series=${series.id}#review"${series.id === viewed?.id ? ' aria-current="true"' : ""}><strong>Series ${series.id}</strong><span>${escape(p.protocolContext?.sequenceName ?? presets[p.preset].label)} · ${g.plane} · ${g.slices} slices</span></a></li>`;
    }).join("")}</ul>` : '<p class="muted">No acquisitions yet. Run a sequence to generate images.</p>'}</div></section>`;
}

function savedProtocols(base, protocols, working, readOnly, progress) {
  const acquired = progress.filter(s => s.state === "Acquired").length;
  return `<section class="panel mr-queue"><div class="mr-panel-heading"><h2>Protocol and sequences</h2><span class="mr-count">${progress.length ? `${acquired}/${progress.length}` : "Single plan"}</span></div>
    <p class="mr-protocol-name">${escape(working?.protocol_name || "Ad hoc scan plan")}</p>
    ${working ? `<p class="muted mr-hint">Sequence ${working.selected_sequence + 1} of ${progress.length}${working.source_version ? ` · source v${working.source_version}` : ""}</p>` : `<p class="muted mr-hint">${readOnly ? "No saved protocol copy. Review the acquired series." : "Load a starter or plan a single sequence."}</p>`}
    ${progress.length ? `<ol class="mr-sequence-list">${progress.map(s => `<li${s.index === working.selected_sequence ? ' class="is-current"' : ""}>
      ${readOnly ? `<span>${escape(s.name)}</span>` : `<button class="mr-sequence-button" form="mr-plan" name="protocolAction" value="select:${s.index}" formaction="${base}/protocol"${s.index === working.selected_sequence ? ' aria-current="step"' : ""}><span class="mr-sequence-number">${s.index + 1}</span><span>${escape(s.name)}</span></button>`}
      <p class="mr-sequence-meta">${escape(s.plan.plane)} · ${durationLabel(s.seconds)} model estimate</p>
      <span class="mr-sequence-state" data-sequence-state="${s.index}">${s.state}${s.seriesId ? ` · Series ${s.seriesId}` : ""}</span></li>`).join("")}</ol>` : ""}
    ${progress.length ? `<p class="muted mr-hint">Acquired means matching saved sequence settings, not image quality approval.</p>` : ""}
    <details id="protocol-library-controls" class="mr-library"${!working && !readOnly ? " open" : ""}><summary>Choose or manage protocol</summary>
      <p class="mr-hint"><a href="/protocols/mr">Open protocol library</a> · <a href="/protocols/mr/dictionary">Anatomy and protocol dictionary</a></p>
      ${readOnly ? "" : `<form method="post" action="${base}/protocol" class="stack"><input type="hidden" name="protocolRevision" value="${working?.revision ?? 0}"><input type="hidden" name="protocolAction" value="load">
      <label>Saved protocol version<select name="protocolVersion" required><option value="">Choose a protocol</option><optgroup label="Built-in synthetic brain teaching starters">${teachingStarters.map(s => `<option value="starter:${s.id}">${escape(s.name)} · Built-in teaching starter</option>`).join("")}</optgroup>${protocols.map(v => `<option value="${v.id}">${escape(v.name)} · ${v.kind === "default" ? "Institution default" : "My version"} ${v.version}</option>`).join("")}</select></label><button class="secondary">Load protocol copy</button></form>
      <p class="muted mr-hint">Replaces the case copy and unsaved draft; save your version first. Nothing scans automatically.</p>`}
    </details>
    ${readOnly ? "" : `<details class="mr-library"><summary>Save or edit full protocol</summary><div class="stack"><button class="secondary" form="mr-plan" name="protocolAction" value="update" formaction="${base}/protocol">Save sequence settings</button>
    <label>Personal protocol name<input name="protocolName" form="mr-plan" maxlength="120" value="${escape(working?.protocol_name || "My MRI protocol")}"></label><button class="secondary" form="mr-plan" name="protocolAction" value="save" formaction="${base}/protocol">Save my protocol version</button>
    <a href="/protocols/mr?exam=${base.split("/").at(-1)}">Edit full protocol</a><p class="muted mr-hint">Save settings before opening the full editor. Switching sequences saves the displayed plan. Personal versions never overwrite defaults.</p></div></details>`}
  </section>`;
}

function finishExam(order, acquisitions, selection, readOnly, progress) {
  const missing = progress.filter(s => s.state !== "Acquired").length;
  const back = '<input type="hidden" name="returnToConsole" value="yes">';
  return `<section id="finish" class="panel mr-stage" data-console-stage="finish" aria-labelledby="mr-finish-title"><p class="mr-eyebrow">04 / Finish</p><h2 id="mr-finish-title">Finish the examination</h2>
    <div class="mr-finish-summary"><p><strong>${acquisitions.length}</strong> saved acquisitions</p><p><strong>${selection ? `Series ${selection.id}` : "None"}</strong> PACS selection</p><p><strong>${escape(workflowLabels[order.workflow_status])}</strong> RIS status</p></div>
    ${missing ? `<p class="notice">${missing} protocol sequence(s) are planned or have changed settings. Check the exercise requirements before ending; the simulator does not require every protocol sequence.</p>` : ""}
    <p>Review coverage, contrast and artifacts before ending. A saved PACS selection is not a transfer or receipt. Completed is a separate RIS action.</p>${readOnly ? `<p>Performed exam confirmed: ${order.performed_verified ? "Yes" : "Pending correction"}.</p><p>Technologist notes: ${escape(order.notes || "None recorded")}</p>` : ""}
    ${!readOnly ? acquisitions.length ? workflowForm(order, "end", "End exam", `${back}<label class="mr-confirm"><input type="checkbox" name="performedVerified" value="yes" required>Performed exam matches the ordered exam: ${escape(order.exam_name)}</label><label>Technologist notes (optional)<textarea name="notes" maxlength="4000" rows="3">${escape(order.notes)}</textarea></label>`) : '<p class="notice">Acquire at least one series before ending the exam.</p><a href="#planning" class="action" data-stage-link="planning">Go to planning</a>'
      : order.locked_by ? '<p class="notice">Locked for instructor review. Return to RIS for instructor send-back if corrections are required.</p>' : order.workflow_status === "exam_end" ? workflowForm(order, "complete", "Mark completed", back) : '<p class="notice cleared">RIS completion recorded. Saved images and history remain available for review.</p>'}
    <p class="mr-hint"><a href="/ris/orders/${order.accession}">RIS details and correction workflow</a> · <a href="/ris/recent">Completed/Recent</a></p></section>`;
}

export function mrConsole(user, handoff, order, { acquisitions, selection, viewed, scanKey, message, messageKind = "error", plan, readOnly = false, protocols = [], workingProtocol }) {
  const { accession, consolePath } = handoff, base = `${consolePath}/${accession}`;
  const savedPlan = workingProtocol ? JSON.parse(workingProtocol.payload).sequences[workingProtocol.selected_sequence].plan : planFromAcquisition(viewed);
  const scanPlan = plan ?? savedPlan, progress = sequenceProgress(workingProtocol, acquisitions);
  const selected = progress[workingProtocol?.selected_sequence], next = progress.find(s => s.state !== "Acquired" && s.index > (workingProtocol?.selected_sequence ?? -1)) ?? progress.find(s => s.state !== "Acquired" && s.index !== workingProtocol?.selected_sequence);
  const intake = order.intake_details ? JSON.parse(order.intake_details) : {};
  return page("MRI console", `<div class="mr-console" data-console-base="${base}" data-default-stage="${readOnly ? "review" : workingProtocol ? "planning" : "setup"}">
    <header class="mr-heading"><a class="back" href="/ris/orders/${accession}">← RIS order</a><h1>MRI console</h1><span class="mr-training-label">Synthetic brain · Training simulation</span></header>
    <section class="mr-identity" aria-label="Current patient"><div><strong>${escape(order.patient_name)}</strong><span>MRN ${escape(intake.patientId || "Not supplied")} · DOB ${escape(intake.dob || "Not supplied")} · ${order.patient_age} yr</span></div><div><strong>${escape(order.exam_name)}</strong><span class="accession">${escape(accession)}</span></div><span class="status">${escape(workflowLabels[order.workflow_status])}${order.locked_by ? " · Locked" : ""}</span></section>
    ${message ? `<p class="notice ${messageKind}" role="${messageKind === "error" ? "alert" : "status"}">${escape(message)}</p>` : ""}
    ${readOnly ? '<p class="notice">Image review only. Corrections require reopening in RIS; instructor review locks the study until send-back.</p>' : ""}
    <nav class="mr-workflow-nav" aria-label="MRI examination steps">${[["setup", "Setup"], ["planning", "Plan & scan"], ["review", "Review"], ["finish", "Finish"]].map(([id, label], i) => readOnly && id === "planning" ? `<span class="mr-step-unavailable" aria-disabled="true"><span>0${i + 1}</span>${label}</span>` : `<a href="#${id}" data-stage-link="${id}"><span>0${i + 1}</span>${label}</a>`).join("")}</nav>
    <div class="mr-console-workspace"><aside class="mr-console-rail">${savedProtocols(base, protocols, workingProtocol, readOnly, progress)}${seriesHistory(base, acquisitions, viewed, selection)}</aside>
    <div class="mr-console-main">
      <section id="setup" class="panel mr-stage" data-console-stage="setup" aria-labelledby="mr-setup-title"><p class="mr-eyebrow">01 / Setup</p><h2 id="mr-setup-title">Confirm the patient and starting protocol</h2>
        ${patientExam(order)}<div class="mr-setup-facts"><p><strong>Screening</strong> Recorded as clear in RIS</p><p><strong>Exam Begin</strong> ${escape(order.begun_at || "Recorded")} UTC</p><p><strong>Training position</strong> Head first supine</p><p><strong>Fixture / coil context</strong> Synthetic brain / head; fixed training model</p></div>
        <p>Compare the patient identifiers and indication with the exercise. Choose a starting protocol in the sequence panel, then review its geometry in the localizers. Hardware setup, RF calibration and patient monitoring are not simulated.</p>
        <a class="action" href="#${readOnly ? "review" : "planning"}" data-stage-link="${readOnly ? "review" : "planning"}">${readOnly ? "Continue to image review" : "Continue to planning"}</a></section>
      <section id="planning" class="mr-stage" data-console-stage="planning" aria-labelledby="mr-planning-title"><div class="mr-planning-bar"><div><p class="mr-eyebrow">02 / Plan & scan</p><h2 id="mr-planning-title">${escape(selected?.name ?? "Plan the next acquisition")}</h2><p class="mr-hint"><span id="mr-draft-state">Saved plan</span> · <span id="mr-model-time">${durationLabel(estimateScanSeconds(scanPlan))}</span> model estimate</p></div>
        ${readOnly ? '<p>Acquisition controls are unavailable after exam end.</p>' : '<button form="mr-plan" class="mr-run">Run scan</button>'}</div>
        <p id="mr-scan-status" class="notice" role="status" hidden></p>
        ${readOnly ? '<p class="panel">Use Review to inspect the acquired images.</p>' : `${localizers(base)}${planner(base, scanPlan, scanKey, workingProtocol?.revision ?? 0, savedPlan)}`}</section>
      <section id="review" class="mr-stage" data-console-stage="review" aria-labelledby="mr-review-title"><div class="mr-panel-heading"><div><p class="mr-eyebrow">03 / Review</p><h2 id="mr-review-title">Inspect the acquired images</h2></div>${readOnly ? "" : `<a href="#planning" data-stage-link="planning" class="secondary action">Back to planning</a>`}</div>
        <div class="mr-review-layout"><section class="panel mr-preview" id="mr-preview" aria-labelledby="mr-preview-title" data-base="${base}"><h2 id="mr-preview-title">Series preview</h2><p class="mr-hint" id="mr-preview-status" role="status" hidden></p><div id="mr-preview-content">${acquisitionViewer(base, viewed, selection, readOnly)}</div></section>
        <aside class="panel mr-review-guidance"><h2>Before you continue</h2><ol><li>Check anatomy coverage and orientation.</li><li>Check the intended contrast and slice positions.</li><li>Inspect artifacts and decide whether to repeat.</li><li>${readOnly ? "Review the recorded PACS selection in the summary." : "Save the intended PACS selection when appropriate."}</li></ol>
          ${!readOnly ? '<p>To repeat, return to planning, adjust the current sequence and Run scan. Earlier images remain saved.</p><button type="button" class="secondary" form="mr-plan" id="mr-copy-geometry" data-geometry-action>Copy geometry from displayed series</button><p class="mr-hint">Replaces geometry in the current draft; keeps its contrast/timing. No scan starts.</p>' : ""}
          ${!readOnly && next ? `<button form="mr-plan" class="secondary" name="protocolAction" value="select:${next.index}" formaction="${base}/protocol">Next planned sequence: ${escape(next.name)}</button>` : `<p>${readOnly ? "Review mode cannot advance an acquisition queue." : "No other sequence is waiting in this loaded copy."}</p>`}
          <a class="action" href="#finish" data-stage-link="finish">Continue to finish</a><p class="mr-hint">Review guidance is not an automatic quality score or an instructor review lock.</p></aside></div></section>
      ${finishExam(order, acquisitions, selection, readOnly, progress)}
    </div></div></div>`, user, { script: "/mr-console.js", helpTopic: readOnly ? "lifecycle" : "MRI console" });
}
