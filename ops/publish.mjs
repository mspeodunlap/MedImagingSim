import { spawnSync } from "node:child_process";
import {
  copyFileSync, existsSync, mkdirSync, mkdtempSync, readlinkSync, renameSync, rmSync, symlinkSync,
} from "node:fs";
import { basename, join } from "node:path";
import { backup, DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";

export function run(command, args, options = {}) {
  const { capture = false, ...rest } = options;
  const result = spawnSync(command, args, { encoding: "utf8", stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit", ...rest });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args[0]} failed (${result.status ?? result.signal}).`);
  return result.stdout?.trim();
}

async function checkDatabase(data, staging) {
  const database = join(data, "medimagingsim.sqlite");
  if (!existsSync(database)) return;
  const snapshot = join(staging, ".predeploy.sqlite");
  const live = new DatabaseSync(database, { readOnly: true });
  try {
    await backup(live, snapshot);
  } finally {
    live.close();
  }
  const candidate = join(staging, ".migration-test.sqlite");
  copyFileSync(snapshot, candidate);
  const { openDatabase } = await import(pathToFileURL(join(staging, "src", "db.js")));
  const checked = openDatabase(candidate);
  try {
    if (checked.prepare("PRAGMA quick_check").get().quick_check !== "ok" ||
        checked.prepare("PRAGMA foreign_key_check").get()) throw new Error("Database migration preflight failed.");
  } finally {
    checked.close();
  }
  rmSync(candidate);
  for (const suffix of ["-wal", "-shm", "-journal"]) rmSync(candidate + suffix, { force: true });
  renameSync(snapshot, join(data, "before-update.sqlite"));
}

export async function publish(root) {
  const repo = join(root, "repo");
  const data = join(root, "data");
  const current = join(root, "current");
  const releases = join(root, "releases");
  mkdirSync(data, { recursive: true });
  mkdirSync(releases, { recursive: true });
  const git = (args, options) => run("/usr/bin/git", ["-C", repo, ...args], options);
  const previous = existsSync(current) ? basename(readlinkSync(current)) : undefined;
  git(["fetch", "--no-tags", "origin", "refs/heads/main:refs/remotes/origin/main"], {
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  const sha = git(["rev-parse", "refs/remotes/origin/main"], { capture: true });
  if (previous === sha) return null;
  if (previous) git(["merge-base", "--is-ancestor", previous, sha]);

  const staging = mkdtempSync(join(releases, ".candidate-"));
  const nextLink = join(root, `.current-${process.pid}`);
  try {
    const archive = join(staging, "release.tar");
    const release = join(releases, sha);
    git(["archive", "--format=tar", "--output", archive, sha]);
    run("/usr/bin/tar", ["-xf", archive, "-C", staging]);
    rmSync(archive);
    run(process.execPath, ["--test"], { cwd: staging });
    await checkDatabase(data, staging);
    // A failed switch may leave an already-tested release ready for the same commit.
    if (!existsSync(release)) renameSync(staging, release);
    symlinkSync(release, nextLink);
    renameSync(nextLink, current);
    return sha;
  } finally {
    rmSync(staging, { recursive: true, force: true });
    rmSync(nextLink, { force: true });
  }
}

