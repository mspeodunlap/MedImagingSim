import { readFileSync, writeFileSync } from "node:fs";
import { nextVersion } from "../src/version.js";
const file = new URL("../package.json", import.meta.url);
const pkg = JSON.parse(readFileSync(file, "utf8"));
pkg.version = nextVersion(pkg.version);
writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
console.log(`Version updated to ${pkg.version}. Update the guides, tip sheets, screenshots and milestone handoff before publishing.`);
