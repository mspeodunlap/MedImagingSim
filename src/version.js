import { readFileSync } from "node:fs";

export const applicationVersion = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

export function nextVersion(version) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.[0-9]$/.test(version)) throw new Error("Use major.minor.patch with patch from 0 to 9.");
  const [major, minor, patch] = version.split(".").map(Number);
  return `${major}.${minor + (patch === 9 ? 1 : 0)}.${(patch + 1) % 10}`;
}
