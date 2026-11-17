import { spawnSync } from "node:child_process";
import {
  accessSync, constants, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { publish, run } from "../publish.mjs";

process.umask(0o077);

const root = join(homedir(), "MedImagingSim-host");
const repo = join(root, "repo");
const data = join(root, "data");
const database = join(data, "medimagingsim.sqlite");
const releases = join(root, "releases");
const current = join(root, "current");
const logs = join(root, "logs");
const config = join(root, "Caddyfile");
const caddyData = join(root, "caddy-data");
const caddyEnv = { XDG_DATA_HOME: caddyData };
const settingsFile = join(root, "host.json");
const updater = join(root, "ops", "macos", "host.mjs");
const appLabel = "com.gatecity.medimagingsim.app";
const proxyLabel = "com.gatecity.medimagingsim.caddy";
const deployLabel = "com.gatecity.medimagingsim.deploy";
const domain = `gui/${process.getuid()}`;

function xml(value) {
  if (Array.isArray(value)) return `<array>${value.map(xml).join("")}</array>`;
  if (typeof value === "boolean") return value ? "<true/>" : "<false/>";
  if (typeof value === "number") return `<integer>${value}</integer>`;
  if (typeof value === "object") {
    return `<dict>${Object.entries(value).map(([key, entry]) => `<key>${key}</key>${xml(entry)}`).join("")}</dict>`;
  }
  const escaped = value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return `<string>${escaped}</string>`;
}

function register(label, args, options) {
  const directory = join(homedir(), "Library", "LaunchAgents");
  mkdirSync(directory, { recursive: true });
  const plist = join(directory, `${label}.plist`);
  const properties = {
    Label: label, ProgramArguments: args, WorkingDirectory: root, Umask: 63,
    StandardOutPath: join(logs, `${label}.log`), StandardErrorPath: join(logs, `${label}.log`),
    ...options,
  };
  const source = `<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">${xml(properties)}</plist>\n`;
  writeFileSync(plist, source);
  const loaded = spawnSync("/bin/launchctl", ["print", `${domain}/${label}`], { stdio: "ignore" });
  if (loaded.status !== 0) run("/bin/launchctl", ["bootstrap", domain, plist]);
}

async function waitForApp(ip) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const probe = spawnSync("/usr/bin/curl", [
      "--fail", "--silent", "--max-time", "2", "--noproxy", "*",
      "--header", `Host: ${ip}:8443`, "http://127.0.0.1:3000/sign-in",
    ], { stdio: "ignore" });
    if (probe.status === 0) return;
    await setTimeout(500);
  }
  throw new Error("The app did not pass its startup check. Check the app and deploy logs.");
}

async function deploy({ restart = true } = {}) {
  const sha = await publish(root);
  if (!sha) return;
  if (restart) {
    run("/bin/launchctl", ["kickstart", "-k", `${domain}/${appLabel}`]);
    await waitForApp(JSON.parse(readFileSync(settingsFile, "utf8")).ip);
  }
  console.log(`Published ${sha} at ${new Date().toISOString()}.`);
}

function privateIp(value = "") {
  const parts = value.split(".");
  if (parts.length !== 4 || !parts.every(part => /^(0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255)) return false;
  const [a, b] = parts.map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

async function install(ip, caddy) {
  if (!privateIp(ip) || !caddy || !isAbsolute(caddy)) {
    throw new Error("Usage: node ops/macos/host.mjs install <private LAN IPv4 address> <absolute Caddy path>");
  }
  if (!existsSync(join(repo, ".git"))) throw new Error(`Clone the repository into ${repo} before setup.`);
  accessSync(caddy, constants.X_OK);
  if (existsSync(settingsFile)) {
    const existing = JSON.parse(readFileSync(settingsFile, "utf8"));
    if (existing.ip !== ip || existing.caddy !== caddy) throw new Error("Existing host settings differ. See the hosting guide.");
  }
  for (const path of [data, releases, logs, caddyData]) mkdirSync(path, { recursive: true });
  const origin = `https://${ip}:8443`;
  writeFileSync(settingsFile, JSON.stringify({ ip, caddy }) + "\n");
  writeFileSync(config, `{
  admin off
  auto_https disable_redirects
  skip_install_trust
}

${origin} {
  bind ${ip}
  tls internal
  reverse_proxy 127.0.0.1:3000
}
`);
  run(caddy, ["validate", "--config", config, "--adapter", "caddyfile"], { env: { ...process.env, ...caddyEnv } });
  if (!existsSync(current)) await deploy({ restart: false });
  const source = fileURLToPath(import.meta.url);
  if (source !== updater) {
    mkdirSync(dirname(updater), { recursive: true });
    copyFileSync(source, updater);
    copyFileSync(fileURLToPath(new URL("../publish.mjs", import.meta.url)), join(root, "ops", "publish.mjs"));
  }
  register(appLabel, [process.execPath, join(current, "src", "server.js")], {
    KeepAlive: true, EnvironmentVariables: { MEDSIM_DB: database, MEDSIM_PORT: "3000", MEDSIM_PUBLIC_ORIGIN: origin },
  });
  await waitForApp(ip);
  register(proxyLabel, [caddy, "run", "--config", config, "--adapter", "caddyfile"], {
    KeepAlive: true, EnvironmentVariables: caddyEnv,
  });
  register(deployLabel, [process.execPath, updater, "deploy"], { StartInterval: 60 });
  console.log(`Testers can use ${origin} after trusting the host's Caddy root certificate.`);
}

try {
  if (process.platform !== "darwin" || process.getuid() === 0) throw new Error("Run this on the hosting Mac from its signed-in standard user account.");
  const [, , command, ...args] = process.argv;
  if (command === "install") await install(...args);
  else if (command === "deploy") await deploy();
  else throw new Error("Expected install or deploy.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
