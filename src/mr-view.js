import { coverage, localizerSize, planes } from "../public/mr-geometry.js";
import {
  defaultPresentation, geometryFields, matrices, planFromAcquisition, presentationFields, presets,
  samplingFields, saturationFields, timingFields,
} from "./mr.js";
import { escape, page } from "./views.js";
import { teachingStarters } from "./mri-dictionary.js";

function numberInput(key, [label, min, max, step], value, disabled = false, readOnly = false) {
  return `<label>${label}<input type="number" name="${key}" min="${min}" max="${max}" step="${step}"
    value="${value ?? ""}" required${disabled ? " disabled" : ""}${readOnly ? " readonly" : ""}></label>`;
}

function option(value, label, selected) {
  return `<option value="${value}"${value === selected ? " selected" : ""}>${label}</option>`;
}

function planner(base, plan, scanKey, protocolRevision = 0) {
  return `<section class="panel mr-controls">
    <div class="mr-panel-heading"><h2>Scan parameters</h2><button form="mr-plan">Run scan</button></div>
    <form id="mr-plan" action="${base}/scan" method="post" class="mr-plan-fields">
      <input type="hidden" name="scanKey" value="${scanKey}">
      <input type="hidden" name="protocolRevision" value="${protocolRevision}">
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
            return numberInput(key, input, plan[key], plan[key] === null);
          }).join("")}
        </div>
      </fieldset>
      <details class="mr-advanced" open><summary>Sampling and encoding</summary><div class="mr-fields">
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
    <p class="muted mr-hint">Cyan shows the projected field of view and slice stack. Amber shows the saturation band.</p>
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
    <div class="mr-series-caption"><strong>Series ${series.id}</strong><span>${presets[parameters.preset].label}</span></div>
      <div>
        <canvas id="mr-image" class="mr-image" width="${columns}" height="${rows}" data-pixels="${base}/pixels/${series.id}"
          aria-label="Acquired image from series ${series.id}"></canvas>
        <label>Slice <output id="mr-slice-number">${initialSlice} / ${slices}</output>
          <input type="range" id="mr-slice" min="1" max="${slices}" value="${initialSlice}"${slices === 1 ? " disabled" : ""}>
        </label>
        <p class="notice error" id="mr-image-error" role="alert" hidden></p>
      </div>
      <details class="mr-review-details"><summary>Series details</summary>
        <dl>
          <dt>Geometry</dt><dd class="mr-plane">${parameters.acquisition} · ${geometry.plane} · ${geometry.angle}° · ${slices} slices</dd>
          <dt>Sampling</dt><dd>${geometry.fov} mm readout FOV · ${geometry.thickness} mm thickness · ${geometry.gap} mm gap</dd>
          <dt>Timing</dt><dd>TR ${parameters.tr} ms · TE ${parameters.te} ms${parameters.ti === null ? "" : ` · TI ${parameters.ti} ms`}</dd>
          <dt>Matrix</dt><dd>${columns} × ${rows}</dd>
          ${parameters.durationSeconds === undefined ? "" : `<dt>Estimated acquisition time</dt><dd>${Math.round(parameters.durationSeconds)} s</dd>
          <dt>Encoding</dt><dd>${parameters.phaseDirection} phase · ${parameters.phaseFov}% phase FOV · ${parameters.oversampling}% oversampling</dd>
          <dt>Acquisition settings</dt><dd>${parameters.averages} averages · ${parameters.bandwidth} Hz/pixel
            ${parameters.flip === null ? "" : ` · ${parameters.flip}° flip`}
            ${parameters.echoTrain === null ? "" : ` · ETL ${parameters.echoTrain}`}</dd>
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

function protocolPanel(base, plan, acquisitions, viewed, selection, readOnly) {
  return `<section class="panel mr-protocol">
    <h2>Protocol and sequences</h2>
    <label>Preset<select name="preset" form="mr-plan"${readOnly ? " disabled" : ""}>${Object.entries(presets).map(([key, preset]) => `
      <option value="${key}" data-tr="${preset.tr}" data-te="${preset.te}" data-ti="${preset.ti ?? ""}"
        data-flip="${preset.flip ?? ""}" data-echo-train="${preset.echoTrain ?? ""}" data-sequence="${preset.sequence}"
        ${key === plan.preset ? "selected" : ""}>${preset.label}</option>`).join("")}</select></label>
    <div class="mr-series" id="mr-series"><h3>Acquisition history</h3>
    ${selection ? `<p class="notice cleared">Selected for PACS · Series ${selection.id} · W ${selection.width} / L ${selection.level}</p>` : ""}
    ${acquisitions.length ? '<p class="muted mr-hint">Select a series or drag it into the preview.</p>' : ""}
    ${acquisitions.length ? `<ul>${acquisitions.map(series => {
      const { preset } = JSON.parse(series.parameters);
      const { plane, slices } = JSON.parse(series.geometry);
      return `<li><a draggable="true" data-series="${series.id}" href="${base}?series=${series.id}"${series.id === viewed?.id ? ' aria-current="true"' : ""}>
        <strong>Series ${series.id}</strong><span>${presets[preset].label} · ${plane} · ${slices} slices</span>
      </a></li>`;
    }).join("")}</ul>` : '<p class="muted mr-hint">No acquisitions yet.</p>'}
    </div>
  </section>`;
}

function savedProtocols(base, protocols, working, readOnly) {
  const document = working && JSON.parse(working.payload);
  return `<section class="panel"><h2>Saved MRI protocols</h2><p><a href="/protocols/mr">Open protocol library</a> · <a href="/protocols/mr?exam=${base.split("/").at(-1)}">Edit full protocol</a> · <a href="/protocols/mr/dictionary">Anatomy and protocol dictionary</a></p>
    ${working ? `<p>Case working copy: ${escape(working.protocol_name || "Unsaved protocol")} ${working.source_version ? `· source version ${working.source_version}` : ""}. Sequence ${working.selected_sequence + 1} of ${document.sequences.length}. Changes never overwrite an institution default.</p>` : '<p>No library protocol loaded. Choose a saved version, or save your current plan as a personal starting point. Save sequence settings before opening the full editor to copy the current plan.</p>'}
    ${readOnly ? '<p>Ended studies are read-only. Reopen for correction before changing the case protocol.</p>' : `
    <form method="post" action="${base}/protocol" class="intake-actions">
      <input type="hidden" name="protocolRevision" value="${working?.revision ?? 0}">
      <input type="hidden" name="protocolAction" value="load">
      <label>Saved protocol version<select name="protocolVersion" required><option value="">Choose a protocol</option>
        <optgroup label="Built-in synthetic brain teaching starters">${teachingStarters.map(s => `<option value="starter:${s.id}">${escape(s.name)} · Built-in teaching starter</option>`).join("")}</optgroup>
        ${protocols.map(v => `<option value="${v.id}">${escape(v.name)} · ${v.kind === "default" ? "Institution default" : "My version"} ${v.version}</option>`).join("")}</select></label>
      <button>Load protocol copy</button></form>
    <p>Loading replaces this case's protocol copy with the saved version; save your personal version first to keep edits. It does not run scans or change acquired images.</p>
    ${document ? `<div class="intake-actions">${document.sequences.map((s, index) => `<button form="mr-plan" name="protocolAction" value="select:${index}" formaction="${base}/protocol"${index === working.selected_sequence ? ' aria-current="true"' : ""}>${index + 1}. ${escape(s.name)}</button>`).join("")}</div>` : ""}
    <p>Changing sequences saves the displayed settings into this case copy. Running a scan alone does not save a protocol version.</p>
    <div class="intake-actions"><button form="mr-plan" name="protocolAction" value="update" formaction="${base}/protocol">Save sequence settings</button>
      <label>Personal protocol name<input name="protocolName" form="mr-plan" maxlength="120" value="${escape(working?.protocol_name || "My MRI protocol")}"></label>
      <button form="mr-plan" name="protocolAction" value="save" formaction="${base}/protocol">Save my protocol version</button></div>`}
  </section>`;
}

export function mrConsole(user, handoff, order, { acquisitions, selection, viewed, scanKey, message, plan, readOnly = false, protocols = [], workingProtocol }) {
  const { accession, consolePath } = handoff;
  const base = `${consolePath}/${accession}`;
  const scanPlan = plan ?? (workingProtocol ? JSON.parse(workingProtocol.payload).sequences[workingProtocol.selected_sequence].plan : planFromAcquisition(viewed));
  return page("MRI console", `
    <header class="mr-heading">
      <div><a class="back" href="/ris/orders/${accession}">← Back to RIS order</a><h1>MRI console</h1></div>
      <p class="muted">Synthetic brain phantom · Training simulation</p>
    </header>
    ${message ? `<p class="notice error" role="alert">${escape(message)}</p>` : ""}
    ${readOnly ? '<p class="notice">Image review only. Reopen the study for correction to acquire images or save a PACS selection. Instructor review locks the study until it is sent back.</p>' : ""}
    ${savedProtocols(base, protocols, workingProtocol, readOnly)}
    <div class="mr-layout">
      ${patientExam(order)}
      ${readOnly ? "" : localizers(base)}
      ${protocolPanel(base, scanPlan, acquisitions, viewed, selection, readOnly)}
      ${readOnly ? "" : planner(base, scanPlan, scanKey, workingProtocol?.revision ?? 0)}
      <section class="panel mr-preview" id="mr-preview" aria-labelledby="mr-preview-title" data-base="${base}">
        <h2 id="mr-preview-title">Series preview</h2>
        <p class="mr-hint" id="mr-preview-status" role="status" hidden></p>
        <div id="mr-preview-content">${acquisitionViewer(base, viewed, selection, readOnly)}</div>
      </section>
    </div>`, user, { script: "/mr-console.js", helpTopic: readOnly ? "lifecycle" : "MRI console" });
}
