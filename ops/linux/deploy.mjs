import { homedir } from "node:os";
import { join } from "node:path";
import { publish, run } from "../publish.mjs";

process.umask(0o077);

try {
  if (process.platform !== "linux" || process.getuid() === 0) {
    throw new Error("Run deployment as the unprivileged Linux hosting account.");
  }
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 1 || args[0] !== "--initial")) {
    throw new Error("Usage: node deploy.mjs [--initial]");
  }
  const sha = await publish(join(homedir(), "MedImagingSim-host"));
  if (sha && !args.includes("--initial")) {
    run("/usr/bin/systemctl", ["--user", "restart", "medimagingsim.service"]);
  }
  if (sha) console.log(`Published ${sha} at ${new Date().toISOString()}.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
