# ThinkPad T450s LAN hosting and publishing

Internal test server — [https://192.168.0.180:8443/sign-in](https://192.168.0.180:8443/sign-in). The ThinkPad’s wired IPv4 address `192.168.0.180` is reserved in the router. Administer it from the Mac with `ssh mike@192.168.0.180`.

The development Mac builds and tests MedImagingSim. GitHub `main` carries releases to the **ThinkPad T450s**, which serves the tester URL and owns the tester database. Testers connect only to the ThinkPad. The development Mac can be offline after a push.

Use Ubuntu Server 26.04.1 LTS amd64, Node.js 24 LTS, and Caddy on the ThinkPad. The app and update timer run as an unprivileged Linux user. Caddy exposes HTTPS on the private LAN while Node listens on ThinkPad localhost. Keep router port forwarding disabled.

## 1. Install Ubuntu Server on the ThinkPad

1. Back up Windows files and recovery information first. For a reversible setup, keep the Windows drive and install Ubuntu on a separate drive. If you choose to replace Windows, the installer can erase the selected disk. Confirm the target by model and size before committing.
2. Download the standard **Ubuntu Server 26.04.1 LTS for 64-bit Intel/AMD** image, `ubuntu-26.04.1-live-server-amd64.iso`. Verify it against the release's `SHA256SUMS` and write it to a spare USB drive. Rufus can write the image from Windows. Plug the ThinkPad into power and connect its built-in Ethernet port. Press **F12** when the ThinkPad logo appears and choose the USB drive.
3. During installation, use a hostname such as `medsim-thinkpad` and a Linux account such as `medsim`. Install OpenSSH only if you want to administer the ThinkPad from the development Mac. Reboot into Ubuntu and apply updates.
4. Run `ip -4 -brief address`. Reserve the ThinkPad's wired address in the router's DHCP settings. In the commands below, the reserved host address is `192.168.0.180` on network `192.168.0.0/24`. Use these values for this installation. Keep the ThinkPad connected to power and verify it stays reachable with the lid in your intended position.

[Ubuntu 26.04.1 images and checksums](https://releases.ubuntu.com/26.04/) · [Ubuntu Server installer](https://ubuntu.com/tutorials/install-ubuntu-server) · [Lenovo USB boot instructions](https://support.lenovo.com/lk/en/solutions/HT118361) · [Windows 10 lifecycle](https://support.microsoft.com/en-us/windows/deployment/updates-lifecycle/windows-10-support-has-ended-on-october-14-2025)

On the ThinkPad:

```sh
sudo apt update
sudo apt upgrade
sudo apt install git ca-certificates curl xz-utils sqlite3 ufw
uname -m
ip -4 -brief address
```

Install Node for the hosting user from the official Node 24 x64 distribution. These commands verify the selected archive against the release checksum before extracting it. The timer uses the fixed install path, so it works without a login shell.

```sh
(
  set -eu
  temp=$(mktemp -d)
  trap 'rm -rf "$temp"' EXIT
  cd "$temp"
  url=https://nodejs.org/dist/latest-v24.x
  curl -fsSLO "$url/SHASUMS256.txt"
  archive=$(awk '$2 ~ /^node-v24\..*-linux-x64\.tar\.xz$/ { print $2 }' SHASUMS256.txt)
  test -n "$archive"
  curl -fsSLO "$url/$archive"
  awk -v archive="$archive" '$2 == archive' SHASUMS256.txt | sha256sum -c -
  install -d -m 700 "$HOME/.local/opt/node24"
  tar -xJf "$archive" --strip-components=1 -C "$HOME/.local/opt/node24"
)
"$HOME/.local/opt/node24/bin/node" --version
```

[Node 24 platform requirements](https://nodejs.org/en/blog/migrations/v22-to-v24)

## 2. Give the ThinkPad read access to GitHub

Publish the hosting files and current build to GitHub `main` from the development Mac using [section 5](#5-publish-builds-from-the-development-mac), then continue on the ThinkPad:

```sh
HOST="$HOME/MedImagingSim-host"
install -d -m 700 "$HOST" "$HOST/data" "$HOME/.ssh"
ssh-keygen -t ed25519 -f "$HOME/.ssh/medsim_deploy" -C "MedImagingSim ThinkPad" -N ""
cat "$HOME/.ssh/medsim_deploy.pub"
```

In [the GitHub repository](https://github.com/mspeodunlap/MedImagingSim), open **Settings → Deploy keys → Add deploy key**, paste the public key, and leave **Allow write access** unchecked. Verify the first SSH prompt against GitHub's published fingerprints. A successful `ssh -T` can return status 1 because GitHub does not provide an interactive shell.

```sh
ssh -T -i "$HOME/.ssh/medsim_deploy" -o IdentitiesOnly=yes git@github.com
GIT_SSH_COMMAND='ssh -i ~/.ssh/medsim_deploy -o IdentitiesOnly=yes -o BatchMode=yes' \
  git clone git@github.com:mspeodunlap/MedImagingSim.git "$HOST/repo"
git -C "$HOST/repo" config core.sshCommand \
  'ssh -i ~/.ssh/medsim_deploy -o IdentitiesOnly=yes -o BatchMode=yes'
```

[GitHub deploy keys](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys#deploy-keys) · [GitHub SSH fingerprints](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints)

## 3. Start the application and HTTPS services

### Stage the current build and enable updates

Run as the regular hosting account. The first command to stage a release runs the repository tests on the ThinkPad.

```sh
HOST="$HOME/MedImagingSim-host"
NODE="$HOME/.local/opt/node24/bin/node"
install -D -m 600 "$HOST/repo/ops/publish.mjs" "$HOST/ops/publish.mjs"
install -D -m 600 "$HOST/repo/ops/linux/deploy.mjs" "$HOST/ops/linux/deploy.mjs"
"$NODE" "$HOST/ops/linux/deploy.mjs" --initial

units="$HOME/.config/systemd/user"
install -d -m 700 "$units"
cat > "$units/medimagingsim.service" <<'UNIT'
[Unit]
Description=MedImagingSim application

[Service]
Type=exec
UMask=0077
Environment=MEDSIM_PUBLIC_ORIGIN=https://192.168.0.180:8443
Environment=MEDSIM_DB=%h/MedImagingSim-host/data/medimagingsim.sqlite
Environment=MEDSIM_PORT=3000
ExecStart=%h/.local/opt/node24/bin/node %h/MedImagingSim-host/current/src/server.js
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
UNIT

cat > "$units/medimagingsim-deploy.service" <<'UNIT'
[Unit]
Description=Publish MedImagingSim from GitHub main

[Service]
Type=oneshot
ExecStart=%h/.local/opt/node24/bin/node %h/MedImagingSim-host/ops/linux/deploy.mjs
UNIT

cat > "$units/medimagingsim-deploy.timer" <<'UNIT'
[Unit]
Description=Check GitHub for MedImagingSim releases

[Timer]
OnActiveSec=60s
OnUnitInactiveSec=60s
AccuracySec=5s

[Install]
WantedBy=timers.target
UNIT

sudo loginctl enable-linger "$USER"
systemctl --user daemon-reload
systemctl --user enable --now medimagingsim.service medimagingsim-deploy.timer
curl --fail -H 'Host: 192.168.0.180:8443' http://127.0.0.1:3000/sign-in
```

User lingering keeps the service and timer running after logout and starts them at boot. [systemd loginctl](https://www.freedesktop.org/software/systemd/man/latest/loginctl.html)

### Put Caddy in front of the app

Install the Caddy package following its Debian/Ubuntu instructions. On this dedicated host, replace the default `/etc/caddy/Caddyfile` with the following. The IP address must match both the DHCP reservation and `MEDSIM_PUBLIC_ORIGIN`.

```caddyfile
{
    auto_https disable_redirects
    skip_install_trust
}

https://192.168.0.180:8443 {
    bind 192.168.0.180
    tls internal
    reverse_proxy 127.0.0.1:3000
}
```

Before enabling a firewall over SSH, allow your management computer's SSH address first. The following example provides browser access from your private subnet. Use your actual subnet.

```sh
sudo ufw allow from 192.168.0.0/24 to any port 8443 proto tcp
sudo ufw enable
sudo -u caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl enable caddy
sudo systemctl restart caddy
```

The browser port is TCP 8443. App port 3000 stays on ThinkPad localhost. [Caddy installation](https://caddyserver.com/docs/install#debian-ubuntu-raspbian) · [Caddy Linux service](https://caddyserver.com/docs/running#linux-service)

## 4. Connect a tester

Create accounts on the **ThinkPad** using the live tester database. Give each tester their generated credentials privately.

```sh
HOST="$HOME/MedImagingSim-host"
NODE="$HOME/.local/opt/node24/bin/node"
MEDSIM_DB="$HOST/data/medimagingsim.sqlite" "$NODE" "$HOST/current/src/create-user.js" admin admin
MEDSIM_DB="$HOST/data/medimagingsim.sqlite" "$NODE" "$HOST/current/src/create-user.js" tester1 student
```

1. Share the Caddy public root certificate with authorized testers through a trusted channel. With the packaged Linux service it is normally at `/var/lib/caddy/.local/share/caddy/pki/authorities/local/root.crt`. Copy the certificate only. The same directory contains private keys.
2. Have testers trust the certificate using their OS/browser controls, or through their device administrator on managed machines. On a Mac, use Keychain Access. From another device, verify HTTPS with `curl --fail --cacert /path/to/root.crt https://192.168.0.180:8443/sign-in`.
3. Open the ThinkPad's HTTPS address in the browser, sign in, run a practice scan, and confirm a saved order still opens after sign-out and sign-in. Keep router port forwarding disabled and use only fictional cases.

[Caddy local HTTPS](https://caddyserver.com/docs/automatic-https#local-https) · [Apple certificate trust](https://support.apple.com/guide/keychain-access/change-the-trust-settings-of-a-certificate-kyca11871/mac) · [MRI user walkthrough](USER_GUIDE.md#plan-and-run-an-mri-scan)

## 5. Publish builds from the development Mac

**V 1.0.5 handoff — November 23, 2026:** the user will handle the pending commit/push. No release commit, successful push, active host SHA, or live V 1.0.5 is verified from this session. Include the new lifecycle source/tests and documentation with the pending work; exclude local databases, credentials and unrelated edits. Check the working tree before committing, and never force-push. Routine automatic publication remains authorized for later tasks when execution access permits it.

After the push, verify the active commit and HTTPS sign-in from a separate LAN device. Test Scheduled RIS rows and unscheduled exclusion; clear screening → Begin exam → saved scan → performed-exam confirmation → End exam → Completed/Recent → Mark completed; then reopen, end/complete, instructor-open lock, and instructor Send back for correction. Verify that a locked case rejects student/admin corrections and that the sent-back student can resume at Exam Begin. Confirm the original saved case/scan/selection survives. Completed records RIS progress only; a missing PACS transfer is expected in this release. Record the actual commit, version, device, browser and result in MILESTONE_PLAN.md. Screenshot/browser checks remain pending as recorded there.

The development assistant is authorized to commit and push each completed, checked feature or fix automatically, with a descriptive commit message, following `AGENTS.md`. Its execution environment must permit writes to the repository's `.git` directory and network access to GitHub. macOS file ownership alone does not override a read-only session sandbox. Adjust access through the development app's permissions controls; changing who reviews approvals alone does not expand file or network access. Report publication as pending until a push succeeds, and report ThinkPad/LAN verification separately.

For the existing build and every new build, run `npm test` in `~/Developer/MedImagingSim`, commit the release files, and push or merge to GitHub `main`. In Terminal, use `git push origin main` after committing on `main`. Keep development accounts and SQLite data local.

On the ThinkPad the timer stages the new commit, runs its tests, checks a database migration against a snapshot, switches the release link, then restarts the application. A test or migration failure leaves the previous release live. The deployment itself can briefly interrupt an in-progress scan. The live tester database stays at `~/MedImagingSim-host/data/medimagingsim.sqlite`.

Verify each release on the ThinkPad and from a separate tester device:

```sh
systemctl --user start medimagingsim-deploy.service
journalctl --user -u medimagingsim-deploy.service -n 30 --no-pager
systemctl --user is-active medimagingsim.service
readlink "$HOME/MedImagingSim-host/current"
```

Compare the active SHA with the intended GitHub commit. Reload the tester URL, verify browser sign-in and a changed or representative feature, and confirm a saved order survived. Record the commit and outcome in the project handoff. A push alone does not establish tester availability.

## 6. Operate and recover

### Keep serving with the lid closed

In the ThinkPad SSH session, create a logind override for operation on external power:

```sh
sudo mkdir -p /etc/systemd/logind.conf.d
sudo tee /etc/systemd/logind.conf.d/90-medimagingsim-lid.conf >/dev/null <<'CONFIG'
[Login]
HandleLidSwitch=suspend
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
IdleAction=ignore
CONFIG
sudo reboot
```

The reboot interrupts current sessions. Reconnect from the Mac using `ssh mike@192.168.0.180` after the ThinkPad starts, then check `systemctl --user is-active medimagingsim.service medimagingsim-deploy.timer` and `sudo systemctl is-active caddy`. With power and Ethernet attached, close the lid, wait two minutes, and confirm the app still loads and a command runs in the SSH session. This enables lid-closed use on external power and keeps the ordinary undocked battery lid action as suspend. Keep the laptop on a hard ventilated surface with its vents clear.

To undo the override, remove `/etc/systemd/logind.conf.d/90-medimagingsim-lid.conf` and reboot in a maintenance window.

[systemd lid and idle settings](https://www.freedesktop.org/software/systemd/man/latest/logind.conf.html)

- Check the application with `journalctl --user -u medimagingsim.service -n 40 --no-pager` and Caddy with `sudo journalctl -u caddy -n 40 --no-pager`.
- If the URL is unreachable, verify the ThinkPad's reserved IP, Ethernet connection, firewall, and user services. A guest network may block direct connections between devices.
- Keep protected backups off the ThinkPad. Create an online snapshot with SQLite's `.backup` command. The updater keeps the latest pre-deployment snapshot at `~/MedImagingSim-host/data/before-update.sqlite`.
- For a broken release, push a tested Git revert and verify the next deployment. If a migration changed the schema, verify compatibility before reverting. Restoring an old snapshot discards changes made after that snapshot.
- When the publisher itself changes, refresh the installed copies in section 3 from the approved release. Regular deploys switch the application code. Check disk use periodically for growing release directories and backups.

See the [macOS fallback runbook](MACOS_LAN_HOSTING.md) if the tester host changes in the future.


## Concurrent classroom operation

**Current candidate: V 1.0.6 (November 23, 2026).** Defaults support 30-user classroom use with headroom, verified locally through 60-student request-handler and real localhost HTTP workloads. The user handles the pending commit/push. No deployed V 1.0.6 or ThinkPad/LAN load result has been verified from this session. Earlier dated V 1.0.5 notes above remain historical.

| Setting | Default | Accepted override / effect |
| --- | --- | --- |
| `MEDSIM_SCAN_WORKERS` | CPU-aware: `min(4, max(1, availableParallelism() - 1))` | Integer 1–8. CPU work runs in worker threads, not the request thread. |
| `MEDSIM_SCAN_QUEUE_LIMIT` | 64 waiting scan plans | Integer 1–256. In addition to active workers; excessive backlog returns HTTP 503 with Retry-After: 2. |
| Active sessions | No classroom-count cap | Separate random session tokens, server-side institution context, eight-hour expiry. One sign-out removes only that token. |
| Sign-in protection | 64 in-flight checks; 20 attempts per username per minute | Excess attempts return HTTP 429. This is separate from the number of signed-in users. |
| Disk database | SQLite WAL; synchronous FULL; busy timeout 5,000 ms | Use local writable storage. One writer commits at a time; snapshot readers can coexist with writes. |

Defaults require no changes to the existing service unit. If tuning is necessary, add the two `Environment=` settings through a service override, run `systemctl --user daemon-reload`, and restart `medimagingsim.service` during a class break. Restarting interrupts unfinished requests/scans; it preserves committed work and unexpired stored sessions. The startup log reports worker and queue limits. Invalid overrides fail startup instead of silently exceeding a limit. More workers can increase host contention; a larger queue does not create more CPU capacity. Test after any override and avoid values below classroom demand without informing the instructor.

Provision distinct student accounts before the class; account creation remains a host command, not a browser registration screen. Each learner uses their own profile/device. Separate tabs in one profile share cookies. The local workload uses 60 real credential sign-ins at the handler and a separately provisioned second-institution session for isolation checks; it does not add an institution picker or SSO capability.

The deployment updater already uses the SQLite online backup API, which includes committed WAL data. Do not back up a running WAL database by copying only `medimagingsim.sqlite`. Its `-wal` and `-shm` files are runtime state; never delete them while the app or another database connection is active. Keep `/data` and credentials out of Git. Do not put this database on network-mounted/shared storage or start multiple app replicas against it as a substitute for the planned hosted architecture.

Before calling the host classroom-ready:

1. On the intended checked-out release, run `npm test` and `npm run test:classroom`. The classroom command runs the workload twice on new disposable databases: through the request handler and through a real localhost HTTP server with real worker generation. It never opens the tester database and does not measure Caddy/HTTPS or the LAN. If the environment forbids local listeners, the HTTP case is explicitly skipped rather than reported as verified.
2. Verify the deployed commit, startup worker/queue log, and V 1.0.6 over HTTPS from a separate LAN client.
3. Have at least 30 distinct student accounts work concurrently, including sign-in, separate intake/scheduling, screening/begin, simultaneous scans, selection, end/completion, and reopening. Verify that worklists, images and writes remain scoped correctly. Use fictional cases and retain the tester database.
4. While scans run, check worklist responsiveness and instructor review under the agreed roles. Record client count, host CPU/RAM, worker/queue settings, request/scan timing, busy/error rate, and lost/duplicate or cross-user data checks. Confirm signing out one session leaves another active and committed work survives a planned restart.
5. Record actual host results and any limits in MILESTONE_PLAN.md. Until that check passes, local 60-user measurements demonstrate correctness and headroom in development, not a response-time guarantee for the ThinkPad. Larger institutional pilots and multi-replica hosting retain their separate architecture/load requirements.


## V 1.0.7 protocol release check

After the user commits/pushes and the host deploys, verify its active SHA and V 1.0.7 from a separate LAN device. As instructor/admin, open MRI protocols without a patient, create two named sequences with distinct parameters, and Save institution default version. As student, begin an eligible case, choose that Saved protocol version and Load protocol copy; modify settings, switch sequences, Save my protocol version and run one sequence. Confirm the default's original values remain unchanged and the student's personal full version restores both sequence edits. Verify another student cannot access that personal version, an instructor can revise the default only by appending a new version, and existing case copies do not change. Repeat the lock/send-back boundary check and confirm saved library versions and working copies survive restart. Preserve the tester database. Publication, active SHA, live HTTPS and these workflow checks remain pending until observed; local tests/screenshots do not establish deployment.

## V 1.0.8 dictionary release check

After the user publishes, verify the active SHA and V 1.0.8 over ThinkPad HTTPS from a separate LAN device. Open MRI protocols → MRI anatomy and protocol dictionary. Confirm 92 regions, 32 sequence entries, 58 exam references, 43 setting examples and seven teaching starters. Search knee, group MSK, example strength 1.5T: only the 1.5T PD example should appear under the matching exam. Verify sources and reference-only status. As staff, install teaching defaults; record added/preserved counts. Repeat: no new versions or replacement of existing names. On a student's eligible begun case, load a built-in or installed default, edit/switch/save a personal version, run one sequence, and confirm original default settings and another learner's case remain unchanged. Verify the reference recipe cannot be selected for acquisition, private/foreign libraries stay inaccessible and reviewed cases stay locked. Check persistence after restart. Preserve the tester database. This host/LAN verification remains pending; local browser screenshots are not deployment evidence.
