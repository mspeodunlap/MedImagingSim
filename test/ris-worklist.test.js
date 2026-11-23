import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

test("the worklist date picker navigates on a valid change and ignores cleared or invalid dates", () => {
  const navigations = [];
  const handlers = {};
  let valid = true;
  const date = { value: "2026-11-23", checkValidity: () => valid,
    addEventListener: (event, handler) => { handlers[event] = handler; } };
  const form = { elements: { namedItem: () => date }, requestSubmit: () => navigations.push(`/ris?date=${date.value}`) };
  const script = readFileSync(new URL("../public/ris-worklist.js", import.meta.url), "utf8");
  runInNewContext(script, { document: { querySelector: selector => selector === "[data-ris-date-filter]" ? form : null } });
  date.value = "2026-11-24"; handlers.change();
  date.value = "2026-11-22"; handlers.change();
  date.value = ""; handlers.change();
  date.value = "2026-02-30"; valid = false; handlers.change();
  assert.deepEqual(navigations, ["/ris?date=2026-11-24", "/ris?date=2026-11-22"]);
  assert.doesNotThrow(() => runInNewContext(script, { document: { querySelector: () => null } }));
});
