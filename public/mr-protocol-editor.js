for (const row of document.querySelectorAll("[data-protocol-sequence]")) {
  const field = key => row.querySelector(`[data-param="${key}"]`);
  const update = resetTiming => {
    const preset = field("preset").selectedOptions[0].dataset;
    for (const key of ["tr", "te", "ti", "flip", "echoTrain"]) {
      if (resetTiming) field(key).value = preset[key];
      if (!["tr", "te"].includes(key)) field(key).disabled = !preset[key];
    }
    field("tr").min = preset.sequence === "gre" ? "6" : "200";
    field("acquisition").options[1].disabled = preset.sequence !== "gre";
    if (preset.sequence !== "gre") field("acquisition").value = "2D";
    field("gap").readOnly = field("acquisition").value === "3D";
    if (field("gap").readOnly) field("gap").value = "0";
    for (const key of ["satOffset", "satWidth"]) field(key).disabled = field("satAxis").value === "none";
  };
  field("preset").addEventListener("change", () => update(true));
  for (const key of ["acquisition", "satAxis"]) field(key).addEventListener("change", () => update(false));
  row.addEventListener("invalid", () => { row.open = true; }, true);
  update(false);
}
