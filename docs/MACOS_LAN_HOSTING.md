# macOS hosting fallback (not the current tester host)

**Current status — November 23, 2026:** the dedicated tester host is the ThinkPad T450s at [https://192.168.0.180:8443/sign-in](https://192.168.0.180:8443/sign-in), managed through the [ThinkPad hosting runbook](LAN_HOSTING.md). This document preserves an alternative macOS setup; it does not describe the active host or prove a deployment. Local release V 1.0.5 is prepared; deployed commit, HTTPS sign-in and workflow verification remain pending. Follow this fallback only if the hosting target is deliberately changed.

## Alternative setup overview

Use the current Mac for development, GitHub as the source of published code, and the older Intel MacBook Pro as the tester host. The host checks GitHub's `main` branch every 60 seconds while awake and signed in. It runs the tests and checks the database migration on a snapshot before switching to a new release. Testers use a single HTTPS address and reload their browser to pick up changes.

Run the installer only on the separate computer that will receive tester traffic. Give testers that computer's LAN address. The development Mac can stay offline after a push. Its local development server remains on `127.0.0.1`, and its IP address is unnecessary for setup.

This setup is for invited testers on a private network using simulated cases. Leave router port forwarding disabled. Keep the tester database separate from your development database.

## 1. Prepare the older Mac

1. Plug in power and connect the host to your private network. Wired Ethernet through an adapter is useful if the laptop will stay in one place. Give the Mac a DHCP reservation in your router so its LAN address stays the same. On the host, check **System Settings → Network** for the IP address of the active connection. This guide uses `192.168.1.50` as an example. Substitute your actual address throughout.
2. Create or use a standard macOS account for hosting. Sign into it on the older Mac. Keep the lid open and, under **System Settings → Battery → Options**, enable **Prevent automatic sleeping on power adapter when the display is off** if available. You can lock the screen. With the provided LaunchAgents, sign back into the hosting account after a reboot. [Apple LaunchAgent documentation](https://support.apple.com/guide/terminal/script-management-with-launchd-apdc6c1077b-5d5d-4d35-9c19-60f2397b2369/mac)
3. Verify this is the Intel host and install the Command Line Tools and the current **Node.js 24 LTS macOS x64** installer. Node 24's prebuilt Mac binaries support macOS 13.5 and later. Apple lists MacBook Pro support for Sonoma beginning with 2018 models, so the 2013 machine's patched installation should be tested on the hardware. [Node.js download archive](https://nodejs.org/en/download/archive/v24) · [Node.js macOS requirements](https://nodejs.org/en/blog/migrations/v22-to-v24) · [Apple Sonoma compatibility](https://support.apple.com/en-us/105113)

On the older Mac, in Terminal:

```sh
sw_vers
uname -m
xcode-select --install
```

After the tools and Node installer finish, open a new Terminal window and check:

```sh
node -v
node -p 'process.arch'
git --version
```

Use a current Node 24.x build. The architecture should be `x64` in Node and `x86_64` in `uname`.

## 2. Give the host read access to GitHub

First publish the hosting code to GitHub `main` from your development Mac using [the publish steps below](#5-develop-and-publish-from-your-current-mac). Then return to the older Mac:

```sh
HOST="$HOME/MedImagingSim-host"
install -d -m 700 "$HOST" "$HOST/bin" "$HOME/.ssh"
ssh-keygen -t ed25519 -f "$HOME/.ssh/medsim_deploy" -C "MedImagingSim LAN host" -N ""
cat "$HOME/.ssh/medsim_deploy.pub"
```

In GitHub, open the [MedImagingSim repository](https://github.com/mspeodunlap/MedImagingSim), then **Settings → Deploy keys → Add deploy key**. Name it `MedImagingSim LAN host`, paste the public key, and leave **Allow write access** unchecked. The dedicated key has no passphrase so background fetches work. Keep the private key on the host. [GitHub deploy keys](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys#deploy-keys)

Check the first SSH host key prompt against [GitHub's published fingerprints](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints). GitHub can report successful authentication and exit with status 1 because it provides Git access without an interactive shell.

```sh
ssh -T -i "$HOME/.ssh/medsim_deploy" -o IdentitiesOnly=yes git@github.com
GIT_SSH_COMMAND='ssh -i ~/.ssh/medsim_deploy -o IdentitiesOnly=yes -o BatchMode=yes' \
  git clone git@github.com:mspeodunlap/MedImagingSim.git "$HOST/repo"
git -C "$HOST/repo" config core.sshCommand \
  'ssh -i ~/.ssh/medsim_deploy -o IdentitiesOnly=yes -o BatchMode=yes'
```

## 3. Install Caddy and start the host

Download the **macOS amd64** archive from the official Caddy releases, compare its SHA-256 checksum with the release's checksums, and extract the `caddy` binary to `~/MedImagingSim-host/bin/caddy`. The direct binary avoids requiring a Homebrew build on the older Intel Mac. [Caddy releases and checksums](https://github.com/caddyserver/caddy/releases)

```sh
HOST="$HOME/MedImagingSim-host"
chmod 755 "$HOST/bin/caddy"
"$HOST/bin/caddy" version
cd "$HOST/repo"
node ops/macos/host.mjs install 192.168.1.50 "$HOST/bin/caddy"
```

Run the installer from Terminal in the signed-in hosting account. It installs three user LaunchAgents for the app, HTTPS proxy, and GitHub update checks. Node listens on `127.0.0.1:3000`, and Caddy listens on the reserved LAN interface at `8443`. If the macOS firewall prompts for incoming connections, allow Caddy. [Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy) · [Caddy interface binding](https://caddyserver.com/docs/caddyfile/directives/bind)

Create individual application accounts on the older Mac. Each command prints a generated password. Give your testers their own student or instructor credentials and keep the admin credentials for yourself.

```sh
MEDSIM_DB="$HOST/data/medimagingsim.sqlite" node "$HOST/current/src/create-user.js" admin admin
MEDSIM_DB="$HOST/data/medimagingsim.sqlite" node "$HOST/current/src/create-user.js" tester1 student
MEDSIM_DB="$HOST/data/medimagingsim.sqlite" node "$HOST/current/src/create-user.js" reviewer1 instructor
```

## 4. Connect a tester

1. Share the public Caddy root certificate at `~/MedImagingSim-host/caddy-data/caddy/pki/authorities/local/root.crt` with authorized testers through a trusted channel. Use this file only. The Caddy data directory also holds private keys. If the file is absent, check the Caddy log and wait for Caddy to complete its first startup. [Caddy local HTTPS](https://caddyserver.com/docs/automatic-https#local-https) · [Caddy data directory](https://caddyserver.com/docs/conventions#data-directory)
2. On a Mac, open the certificate in **Keychain Access** and configure the imported certificate's trust for SSL as appropriate for the account or device. Managed devices may need their administrator to install the certificate. [Apple certificate trust settings](https://support.apple.com/guide/keychain-access/change-the-trust-settings-of-a-certificate-kyca11871/mac)
3. On an authorized device on the same network, open `https://192.168.1.50:8443/sign-in` using your actual address. Confirm the browser reports a trusted connection before entering credentials. Sign in, run the [MRI console walkthrough](USER_GUIDE.md#plan-and-run-an-mri-scan), sign out, and sign in again to check persistence.

To check HTTPS independently of browser trust configuration, copy the certificate to a tester machine and run:

```sh
curl --fail --cacert /path/to/root.crt https://192.168.1.50:8443/sign-in
```

## 5. Develop and publish from your current Mac

Keep using `~/Developer/MedImagingSim` as your development checkout. Test locally at `http://127.0.0.1:3000`. The hosting copy fetches only GitHub `main`. This gives you a private place to edit and test before making a change visible.

```sh
cd ~/Developer/MedImagingSim
npm test
git status --short
git add -- <files-you-changed>
git commit -m "Describe the update"
git push origin main
```

Replace the `git add` placeholder with the files in `git status` that belong in the release. If you develop on a feature branch, merge it into `main` through GitHub when ready. You can also develop on the old Mac in a separate development clone using your normal developer credentials.

On the host, the next scheduled check stages the new commit, runs the tests, checks the database migration on a copy, and then switches the live code and restarts the app. A failed test or migration check leaves the existing release live. Testers can refresh after the published commit appears in the deploy log. Schedule updates between tester sessions when practical because an app restart can interrupt an in-progress scan.

On the older Mac, to check immediately or see the active revision:

```sh
HOST="$HOME/MedImagingSim-host"
launchctl kickstart "gui/$(id -u)/com.gatecity.medimagingsim.deploy"
tail -n 40 "$HOST/logs/com.gatecity.medimagingsim.deploy.log"
readlink "$HOST/current"
```

For a first end-to-end publishing test, push a small visible change, verify the published revision on the host, then reload on a tester device and confirm a previously saved exam is still present.

## 6. Operate and troubleshoot the host

| Symptom | Where to check |
| --- | --- |
| Tester cannot reach the HTTPS address | Verify the host is awake and signed in, the address matches the DHCP reservation, and both devices are on a network that permits client-to-client access. Check the Caddy log and macOS firewall. |
| Tester sees a certificate warning | Check the URL and install the public root certificate for this host. An address change requires coordinated changes to the Caddy listener, app origin, and tester URL. |
| Sign-in returns **Access denied** | Use the exact HTTPS address, including port 8443. Check that Caddy preserves the incoming Host and that the app's configured origin matches it. |
| A pushed change is absent | Confirm GitHub `main` contains it. Check the deploy log for SSH, test, or database migration errors and compare the active revision with GitHub. |
| Caddy reports an upstream connection error | Check the app log and verify another process on the hosting Mac is not using port 3000. |
| The host was restarted | Sign into the hosting macOS account. The LaunchAgents start again at login. |

`$HOST/data/medimagingsim.sqlite` is the live tester database. The updater stores the most recent pre-update snapshot as `$HOST/data/before-update.sqlite`. Keep periodic backups in a separate protected location. Use SQLite's backup command for an online snapshot. [SQLite backup command](https://www.sqlite.org/cli.html)

```sh
HOST="$HOME/MedImagingSim-host"
sqlite3 "$HOST/data/medimagingsim.sqlite" ".backup '$HOST/data/manual-$(date +%Y%m%d-%H%M%S).sqlite'"
ls -lh "$HOST/data"
```

If a deployed change needs reversing, stop running new exercises and push a Git revert from the development Mac. Check schema compatibility before reverting a commit that migrated the database. Restoring the pre-update snapshot in a maintenance window will discard tester work created after that snapshot. The host keeps release directories and logs, so check disk usage periodically and archive older materials as needed. Changes to the installer or Caddy settings require maintenance on the host. The automatic update job publishes app code.

## When to use Linux instead

Start with the macOS setup if the laptop stays awake, keeps its network connection, and performs reliably during test runs. Consider **Ubuntu Server 24.04 LTS amd64** if you want it to boot unattended or if the patched Sonoma installation becomes unreliable. The hardware has ample memory for Ubuntu Server's baseline. The simulator's actual scan capacity still needs testing on this machine. [Ubuntu Server requirements](https://ubuntu.com/server/docs/system-requirements/) · [Ubuntu Server downloads](https://ubuntu.com/download/server)

Back up the Mac, create a bootable Ubuntu Server USB, and hold **Option** at startup to choose **EFI Boot**. Verify Ethernet, disk detection, and stable operation before choosing a target disk. Use a separate SSD for the trial if possible. On Linux, use official Node 24 x64 and Caddy builds and keep the same GitHub and HTTPS architecture. Replace the macOS LaunchAgents with app and proxy `systemd` services and a deploy timer. The installer in this repository targets macOS.
