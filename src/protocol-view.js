import { escape, page } from "./views.js";
import { defaultPlan, geometryFields, matrices, presets, samplingFields, saturationFields, timingFields } from "./mr.js";
import { planes } from "../public/mr-geometry.js";

export function readProtocolDraft(form) {
  const count = form.get("sequenceCount");
  if (form.getAll("sequenceCount").length !== 1 || !/^(?:[1-9]|[12][0-9]|3[0-2])$/.test(count)) return null;
  if (["catalogOrigin", "catalogVersion"].some(key => form.getAll(key).length > 1)) return null;
  return { ...(form.get("catalogOrigin") ? { origin: { id: form.get("catalogOrigin"), version: form.get("catalogVersion") } } : {}), sequences: Array.from({ length: Number(count) }, (_, index) => ({
    name: form.getAll(`${index}.name`).length === 1 ? form.get(`${index}.name`) : "",
    plan: Object.fromEntries(Object.keys(defaultPlan).map(key => {
      const values = form.getAll(`${index}.${key}`);
      // Duplicate fields invalidate the plan rather than silently accepting an injected alternative.
      return [key, values.length > 1 ? "invalid" : values[0] ?? null];
    })),
  })) };
}

function sequenceEditor(sequence, index, count) {
  const p = sequence.plan;
  const select = (key, label, options) => `<label>${label}<select name="${index}.${key}" data-param="${key}">${options.map(([value, text, attributes = ""]) =>
    `<option value="${escape(value)}"${String(p[key] ?? (key === "phaseMatrix" ? "match" : "")) === String(value) ? " selected" : ""}${attributes}>${escape(text)}</option>`).join("")}</select></label>`;
  const numeric = (key, [label, min, max, step], disabled = false) => `<label>${label}<input type="number" name="${index}.${key}" data-param="${key}" value="${escape(p[key] ?? "")}" min="${min}" max="${max}" step="${step}" required${disabled ? " disabled" : ""}></label>`;
  return `<details open class="panel" data-protocol-sequence><summary>Sequence ${index + 1}: ${escape(sequence.name)}</summary>
    <label>Sequence name<input name="${index}.name" value="${escape(sequence.name)}" maxlength="120" required></label>
    <div class="intake-fields">
      ${select("preset", "Preset", Object.entries(presets).map(([key, preset]) => [key, preset.label,
        ` data-tr="${preset.tr}" data-te="${preset.te}" data-ti="${preset.ti ?? ""}" data-flip="${preset.flip ?? ""}" data-echo-train="${preset.echoTrain ?? ""}" data-sequence="${preset.sequence}"`]))}
      ${select("plane", "Plane", Object.keys(planes).map(value => [value, value]))}
      ${select("acquisition", "Acquisition mode", [["2D", "2D slice stack"], ["3D", "3D slab (GRE)"]])}
      ${Object.entries(geometryFields).map(([key, field]) => numeric(key, field)).join("")}
      ${Object.entries(timingFields).map(([key, field]) => numeric(key, key === "tr" && p.preset !== "gre" ? [field[0], 200, ...field.slice(2)] : field,
        ["ti", "flip", "echoTrain"].includes(key) && key !== ({ ir: "ti", gre: "flip", tse: "echoTrain" })[p.preset])).join("")}
      ${select("matrix", "Frequency matrix", matrices.map(value => [value, value]))}
      ${select("phaseMatrix", "Phase matrix", [["match", "Match frequency"], ...matrices.map(value => [value, value])])}
      ${select("phaseDirection", "Phase direction", [["vertical", "Top ↔ bottom"], ["horizontal", "Left ↔ right"]])}
      ${Object.entries(samplingFields).map(([key, field]) => numeric(key, field)).join("")}
      ${select("satAxis", "Saturation band", [["none", "Off"], ["u", "Left ↔ right"], ["v", "Top ↔ bottom"], ["normal", "Through slice stack"]])}
      ${Object.entries(saturationFields).map(([key, field]) => numeric(key, field, p.satAxis === "none")).join("")}
    </div>
    <div class="intake-actions">${index ? `<button name="editAction" value="up:${index}" formaction="/protocols/mr/edit" formnovalidate>Move up</button>` : ""}
    ${index < count - 1 ? `<button name="editAction" value="down:${index}" formaction="/protocols/mr/edit" formnovalidate>Move down</button>` : ""}
    ${count > 1 ? `<button name="editAction" value="remove:${index}" formaction="/protocols/mr/edit" formnovalidate>Remove sequence</button>` : ""}</div>
  </details>`;
}

export function protocolLibrary(user, versions, document, { name = "", sourceId = "", message = "", saved = false } = {}) {
  return page("MRI protocols", `<div class="page-title"><h1>MRI protocols</h1><p>Institution defaults and your personal protocol versions. Published versions are never overwritten.</p></div>
    ${message ? `<p class="notice ${saved ? "cleared" : "error"}" role="status">${escape(message)}</p>` : ""}
    <section class="panel"><h2>Saved protocol library</h2>
    <p><a href="/protocols/mr">New protocol</a> · <a href="/protocols/mr/dictionary">MRI anatomy and protocol dictionary</a> · <a href="/protocols/mr/dictionary?tab=starters">Out-of-the-box teaching starters</a></p>
    ${versions.length ? `<ul>${versions.map(version => `<li><a href="/protocols/mr?version=${version.id}">${escape(version.name)} · ${version.kind === "default" ? "Institution default" : "My version"} ${version.version}</a> · ${escape(version.created_at)} UTC</li>`).join("")}</ul>` : '<p>No saved protocols. Instructors/admins can publish defaults; personal copies belong to their creator.</p>'}
    </section>
    <form method="post" action="/protocols/mr/save" class="stack">
      <input type="hidden" name="sourceVersion" value="${sourceId}">
      <input type="hidden" name="sequenceCount" value="${document.sequences.length}">
      ${document.origin ? `<input type="hidden" name="catalogOrigin" value="${escape(document.origin.id)}"><input type="hidden" name="catalogVersion" value="${escape(document.origin.version)}"><p class="notice">Based on teaching dictionary ${escape(document.origin.version)}. Review these synthetic brain settings before publishing; they are not clinical prescriptions.</p>` : ""}
      <section class="panel"><h2>Protocol editor</h2><p>This editor saves reusable scan settings, not patient data, images, screening or PACS selections. Loading or saving never starts an acquisition.</p>
      <label>Protocol name<input name="name" value="${escape(name)}" maxlength="120" required></label>
      <p>Set all sequences before saving. Preset changes reset that sequence's timing defaults. Edit geometry and timing for the exercise; the server validates every sequence.</p></section>
      ${document.sequences.map((sequence, index) => sequenceEditor(sequence, index, document.sequences.length)).join("")}
      <div class="intake-actions">${document.sequences.length < 32 ? '<button name="editAction" value="add" formaction="/protocols/mr/edit" formnovalidate>Add sequence</button>' : ""}
      <button name="kind" value="personal">Save my protocol version</button>
      ${user.role !== "student" ? '<button name="kind" value="default">Save institution default version</button>' : ""}</div>
      <p>Same name plus the latest loaded version adds a new version. Change the name to save a separate protocol. Students can only save personal versions; institution defaults remain protected.</p>
    </form>`, user, { script: "/mr-protocol-editor.js" });
}
