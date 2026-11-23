import { dictionary, teachingStarters } from "./mri-dictionary.js";
import { escape, page } from "./views.js";

const labels = {
  readout: "Readout", plane: "Plane", acquisition: "Mode", fovMm: "FOV (mm)", thicknessMm: "Thickness (mm)", gapMm: "Gap (mm)",
  trMs: "TR (ms)", teMs: "TE (ms)", tiMs: "TI (ms)", frequencyMatrix: "Frequency matrix", phaseMatrix: "Phase matrix",
  echoTrain: "Echo train length", averages: "Averages", refocusingFlipDeg: "Refocusing angle (°)", fatSuppression: "Fat suppression",
  bValuesSmm2: "b-values (s/mm²)", motion: "Motion handling", pixelAreaMm2: "Pixel area (mm²)", voxelVolumeMm3: "Voxel volume (mm³)",
  reconstructedIntervalMm: "Reconstruction interval (mm)", inPlanePixelMm: "In-plane pixel (mm)", temporalResolutionMs: "Temporal resolution (ms)", earlyPhaseCompletion: "Early enhancement phase",
};
const sourceLinks = ids => ids.map(id => {
  const s = dictionary.sources.find(s => s.id === id);
  return `<a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.title)} ↗</a>`;
}).join(" · ");
const table = (rows, heads = ["Parameter", "Value"]) => `<div class="dictionary-table"><table><thead><tr>${heads.map(h => `<th>${escape(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(v => `<td>${escape(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
const familyName = id => dictionary.families.find(f => f.id === id).name;
function profileView(p) {
  return `<details class="panel"><summary>${escape(p.label)} · ${escape(p.fieldStrength.join(" / "))}</summary>
    <p><strong>${escape(p.basis)}</strong> · ${escape(p.locator)}</p>
    ${table(Object.entries(p.settings).map(([key, value]) => [labels[key] ?? key, value]))}
    <p>Unlisted parameters are not supplied by this reviewed example. TR, TE, TI, bandwidth, matrix, acceleration, averages and coverage must be reviewed for the selected scanner; do not fill gaps from another anatomy or field strength.</p>
    <p>${sourceLinks(p.sources)}</p></details>`;
}
export function dictionaryPage(user, params) {
  const tab = params.get("tab") ?? "exams", q = (params.get("q") ?? "").trim(), category = params.get("category") ?? "", strength = params.get("strength") ?? "";
  const search = value => !q || JSON.stringify(value).toLowerCase().includes(q.toLowerCase());
  const options = (items, selected) => items.map(([value, label]) => `<option value="${escape(value)}"${value === selected ? " selected" : ""}>${escape(label)}</option>`).join("");
  let content;
  if (tab === "exams") {
    const recipes = dictionary.examRecipes.filter(r => (!category || r.category === category) && search({ name: r.name, region: r.region, coverage: r.coverage,
      families: r.sequences.map(id => { const f = dictionary.families.find(f => f.id === id); return { name: f.name, aliases: f.aliases }; }) }) &&
      (!strength || r.profiles.some(id => dictionary.profiles.find(p => p.id === id).fieldStrength.includes(strength))));
    content = `<h2>Exam reference recipes (${recipes.length})</h2><p>Sequence lists are planning outlines, not automatic scan order or clinical approval. Some methods are alternatives or indication-dependent additions. Field-strength filtering shows recipes with a reviewed numeric example at that strength; it does not validate every sequence at that strength.</p>
      ${recipes.length ? recipes.map(r => `<details class="panel"><summary>${escape(r.name)} · Reference only</summary><p>${escape(r.region)} · ${escape(r.coverage)}</p>
        <p><strong>${escape(r.completion)}</strong></p><p>Families: ${r.sequences.map(id => `<a href="/protocols/mr/dictionary?tab=sequences&amp;q=${encodeURIComponent(familyName(id))}">${escape(familyName(id))}</a>`).join(" · ")}</p>
        <p>${sourceLinks(r.sources)}</p>${r.profiles.map(id => dictionary.profiles.find(p => p.id === id)).filter(p => !strength || p.fieldStrength.includes(strength)).map(profileView).join("")}
        <p>Not loadable as an acquisition protocol. Consult the sequence dictionary for model limitations. Use a brain teaching starter for the current console.</p></details>`).join("") : '<p role="status">No matching exams. Clear a filter or search a broader term.</p>'}`;
  } else if (tab === "sequences") {
    const families = dictionary.families.filter(f => search({ name: f.name, aliases: f.aliases, purpose: f.purpose }));
    content = `<h2>Sequence and contrast dictionary (${families.length})</h2><p>Vendor aliases are orientation aids, not interchangeable parameter recipes. ADC is a derived map. FLAIR is fluid suppression; STIR and spectral fat suppression are different methods.</p>${families.map(f => `<section class="panel"><h3>${escape(f.name)}</h3><p>Also search: ${escape(f.aliases.join(", "))}</p><p>${escape(f.purpose)}</p><p><strong>${f.preset ? "Brain teaching approximation" : "Reference only"}:</strong> ${escape(f.limitation)}</p><p>${sourceLinks(f.sources)}</p>
      ${dictionary.profiles.filter(p => p.family === f.id).map(profileView).join("")}</section>`).join("") || "<p>No matching sequences.</p>"}`;
  } else if (tab === "anatomy") {
    const regions = dictionary.regions.filter(r => (!category || r.category === category) && search(r));
    content = `<h2>Anatomic regions (${regions.length})</h2><p>This taxonomy supports protocol planning. It does not add RIS orderable exams or image-generation anatomy. Laterality, age and indication are separate prescription choices.</p>${table(regions.map(r => [dictionary.categories.find(c => c.id === r.category).name, r.name]), ["Group", "Region"])}`;
  } else if (tab === "sources") {
    content = `<h2>Evidence and review</h2><p>Reviewed ${dictionary.reviewed}; dictionary ${dictionary.version}. Accreditation limits, society guidance, institutional examples and original simulator settings remain distinct. These entries are educational starting points; a qualified local protocol team must approve any clinical use. No medication, contrast dose, sedation or implant clearance is configured here.</p>
      ${dictionary.sources.filter(search).map(s => `<section class="panel"><h3>${escape(s.title)}</h3><p>${escape(s.kind)} · Source revision: ${escape(s.revision)} · Reviewed: ${s.reviewed}</p><p>${sourceLinks([s.id])}</p></section>`).join("")}`;
  } else {
    content = `<h2>Runnable brain teaching starters</h2><p>All ${teachingStarters.length} starters are original settings for the existing synthetic phantom. The model has no field-strength selector or 1.5T/3T-specific relaxation model. The 64/96/128 matrices and short stacks are teaching limits, not diagnostic spatial resolution. Review coverage in localizers for every exercise.</p>
      ${user.role !== "student" ? `<form method="post" action="/protocols/mr/install-starters"><button>Install teaching starters as institution defaults</button><p>Adds missing starter names in this institution only. Repeating this action preserves existing names and versions, including edited defaults.</p></form>` : '<p>Students may copy starters to personal versions. Only instructors/admins publish institution defaults.</p>'}
      ${teachingStarters.filter(search).map(s => `<section class="panel"><h3>${escape(s.name)}</h3><p>${escape(s.purpose)}</p><p><a href="/protocols/mr?starter=${s.id}">Copy to protocol editor</a></p>
        ${table(s.sequences.map(sequence => { const p = sequence.plan; return [sequence.name, p.plane, p.tr, p.te, p.ti ?? "—", p.flip ?? "—", `${p.fov}; ${p.slices} × ${p.thickness} + ${p.gap}`, `${p.matrix} × ${p.phaseMatrix ?? p.matrix}`]; }), ["Sequence", "Plane", "TR ms", "TE ms", "TI ms", "GRE flip °", "FOV mm; slices × thickness + gap mm", "Matrix"])}</section>`).join("")}`;
  }
  return page("MRI dictionary", `<div class="page-title"><h1>MRI anatomy and protocol dictionary</h1><p>${dictionary.regions.length} regions · ${dictionary.families.length} sequence/contrast entries · ${dictionary.examRecipes.length} exam references · ${dictionary.profiles.length} sourced parameter examples · ${teachingStarters.length} runnable teaching starters</p></div>
    <p><a href="/protocols/mr">Saved protocol library</a> · <a href="/protocols/mr/dictionary.json">Download dictionary JSON</a></p>
    <nav aria-label="Dictionary sections">${[["exams", "Exam references"], ["sequences", "Sequence dictionary"], ["anatomy", "Anatomic regions"], ["starters", "Teaching starters"], ["sources", "Sources and review"]].map(([key, label]) => `<a href="/protocols/mr/dictionary?tab=${key}"${tab === key ? ' aria-current="page"' : ""}>${label}</a>`).join(" · ")}</nav>
    <form method="get" action="/protocols/mr/dictionary" class="intake-fields"><input type="hidden" name="tab" value="${escape(tab)}"><label>Search dictionary<input name="q" value="${escape(q)}" maxlength="200" type="search"></label>
      ${["anatomy", "exams"].includes(tab) ? `<label>Anatomic group<select name="category">${options([["", "All groups"], ...dictionary.categories.map(c => [c.id, c.name])], category)}</select></label>` : ""}
      ${tab === "exams" ? `<label>Numeric example field strength<select name="strength">${options([["", "All / unspecified"], ["1.5T", "1.5T"], ["3T", "3T"]], strength)}</select></label>` : ""}<button>Search</button><a href="/protocols/mr/dictionary?tab=${escape(tab)}">Clear filters</a></form>
    ${content}`, user);
}
