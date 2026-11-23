# Maintaining the user documentation

This is the ongoing release workflow for the detailed user guide, all role tip sheets, printable copies, and screenshots. It applies to each delivered change, introduced in V 1.3 and updated for V 1.0.3. The application version source remains `package.json`.

**Current documentation release: V 1.0.8 (November 23, 2026).** Added the MRI anatomy/protocol dictionary, sourced reference settings, seven runnable teaching starters and repeat-safe staff default installation. Sign-in, dictionary/reference, default-installation and console captures were checked in a disposable fictional environment; older screenshots remain preserved and refresh-pending. Four HTML exports are rebuilt. Local tests and the dictionary/starter browser walkthrough are complete; print layout and ThinkPad/LAN checks remain pending. The user handles commit/push. Historical verification entries below retain original dates/versions.

## Maintained files

| Deliverable | Canonical source | Supporting assets |
| --- | --- | --- |
| Detailed user guide | `docs/USER_GUIDE.md` | `docs/screenshots/*.jpg` |
| Student quick tips | `docs/quick-start/STUDENT.md` | Current student screenshots |
| Instructor quick tips | `docs/quick-start/INSTRUCTOR.md` | Current instructor screenshots |
| Administrator quick tips | `docs/quick-start/ADMIN.md` | Current admin screenshots |
| Printable/shareable copies | Generated `docs/print/USER_GUIDE.html`, `STUDENT.html`, `INSTRUCTOR.html`, `ADMIN.html` | Images embedded by `ops/docs/build.py` |
| Screenshot inventory | `docs/screenshots/manifest.json` | Capture and last-verified versions, roles, routes, and file hashes |
| Reference routing and decisions | `docs/REFERENCE_INDEX.md`, `docs/REFERENCE_WORKFLOWS.md` | Five local reference PDFs and their fingerprints |

## For every release/change set

1. Identify affected user tasks and roles using the reference index, confirmed decisions, and actual code. Ask about material uncovered requirements before dependent implementation. Source training screenshots, exercises, and answer keys must not enter our guide.
2. Increment the application version once per delivered change set with `npm run version:next`. The reset starts at 1.0.3; next 1.0.4, through 1.0.9 then 1.1.0. Do not use ordinary npm patch/minor semantics. Update guide/tip-sheet release labels and dates. Keep implemented steps separate from planned functionality.
3. Update prerequisites, entry points, exact visible labels, steps, expected results, validation/error handling, persistence, ownership, and role limits. A tip sheet must stay brief; link to detail rather than reproduce every control.
4. Walk the changed path on an isolated disposable database. Verify affected roles and the distinction between a normal result, blocked state, and unfinished feature. Confirm the guide does not imply grading, hold release, exam completion, or PACS transfer until those features work.
5. Recapture affected screens from our own running application, using fictional demo accounts/patients. Include a normal path and an important blocked/error state where relevant. Retain contextual headers so the role is visible. Do not capture passwords, patient data, reference manuals, or unrelated browser content. Inspect screenshots for blank canvases, truncation, confusing dates, and inconsistent case data.
6. Record each screenshot's capture version/date and last verified version in the manifest. Unchanged screenshots may be retained after checking they still represent the release, with their original capture version stated. Recapture sign-in when the visible version changes. Replace screenshots when labels, layout, permissions, or workflow change; update captions/alt text too.
7. Rebuild all printable HTML copies from Markdown. Do not hand-edit generated HTML. Verify guide/tip links, figure files, anchors, and embedded-image counts. Review layout in a browser/print preview when formatting changes. Generated copies are standalone HTML with embedded images; cross-links to project runbooks still require those files or the repository.
8. Run relevant application checks and `git diff --check`. Document what was verified locally, and what remains pending. Publishing and a separate LAN device check follow the ThinkPad runbook; local screenshots do not verify the deployed build.
9. Commit sources, updated screenshots/manifest, generated copies, version, instructions, and milestone handoff together. Record the deployed SHA and verification result once available. A public release should not accidentally add temporary demo databases, plaintext extracts, or source manuals as app assets.

The simulator publishes only the four generated HTML files at `/training/USER_GUIDE.html`, `/training/STUDENT.html`, `/training/INSTRUCTOR.html`, and `/training/ADMIN.html`. These contain original guidance and fictional screenshots and are accessible before sign-in. Raw manuals and arbitrary project files are not served. Simulator workflow links request a separate tab/window. Repository-only supplemental links in exported HTML are labeled as project-repository references rather than linking to unavailable HTTP routes.

## Create the disposable documentation environment

From the project checkout with Node 24+, choose a **new** SQLite filename outside the tester database. The seed script refuses existing files. For example:

```sh
DOCS_DEMO_DIR=$(mktemp -d /tmp/medsim-docs.XXXXXX)
node ops/docs/demo.mjs "$DOCS_DEMO_DIR/demo.sqlite"
MEDSIM_DB="$DOCS_DEMO_DIR/demo.sqlite" MEDSIM_PORT=3301 npm start
```

Open `http://127.0.0.1:3301/sign-in`. The disposable fixture includes `demo-student`, `demo-instructor`, `demo-admin`, and `demo-classmate`, all using the test-only password `demo-docs-only`. These accounts are for this temporary environment only and are not credentials for the ThinkPad. The fixture provides complete/incomplete incoming orders, a future appointment, a held exam, and another user's exam. Dates are computed in America/New_York at seed time.

Use the browser to schedule Avery Morgan for today, submit clear screening, select Begin exam, run T1 and T2 scans, preview the earlier series, and save its window/level selection. Return to the RIS order, confirm the performed exam, add optional notes, End exam, and Mark completed in Completed/Recent. Reopen before instructor review, correct, end/complete again, then open as instructor to verify the immediate lock and image review. Send back with a reason and verify the student resumes at Exam Begin with history intact. The fixture also includes Finley Brooks at Exam End and Harper Vale at Completed for original review/correction captures. Capture scheduled/screened/begun stages, recent-list rows, end validation, lock, and send-back under affected roles, plus sign-in and navigation. Check the screenshot list in the manifest. After stopping the demo server, remove only that newly created temporary directory. Never point documentation tools at the persistent tester database.

## Generate browser and printable copies

The application still has no runtime package dependencies. The documentation builder uses the separate Python package `markdown-it-py`, available in the documentation environment used for V 1.3. If unavailable, install it in a documentation-only virtual environment according to local tooling policy. Then run:

```sh
python3 ops/docs/build.py
```

Open the files in `docs/print` in a browser. Use Print / Save as PDF for a paper/PDF copy. The printed tips use a compact style; actual page count depends on paper settings. Review it before distributing. The exported HTML is self-contained for screenshots; keep the four HTML files together for their navigation links.

## Documentation history

| Version | Update | Verification |
| --- | --- | --- |
| V 1.3 | Expanded current-feature instructions, detailed role permissions, 16 original app screenshots, three role tip sheets, four printable HTML files, demo fixture, and release maintenance workflow. | Isolated browser walkthrough for student intake/scheduling, date filters/blocked states, screening, T1/T2 scans, earlier-series preview, saved selection, instructor review/home, and admin multi-owner worklist. Automated/link/asset checks recorded in the milestone handoff. |

| V 1.0.3 | Reset to three-part numbering with patch rollover; added in-workflow training links and public allowlisted guide/tip routes; refreshed all 16 screenshots and exports. | 17 automated tests passed; browser confirmed guide section opens separately, all images load under the documentation CSP, and an unsaved order edit remains in the original tab. |

| V 1.0.4 | Added RIS MRN and automatic date filtering; updated guide/tips/HTML. | 18 automated tests pass. Sign-in and affected RIS screenshots omitted and marked refresh-pending because browser capture is unavailable. Live browser/ThinkPad check pending. |
| V 1.0.5 | Explicit exam begin/end/RIS completion, separate Completed/Recent, reopen correction cycles, immediate instructor-open lock, and instructor send-back; guide, all role tips, exports, and demo fixture updated. | Automated HTTP/state/migration checks in milestone handoff. Browser service cannot initialize (CODEX_CLI_PATH unavailable) and local HTTP listener returns EPERM; original screen images retained but all marked refresh-pending and omitted until recaptured. Rendered canvas, browser/print layout, GitHub publication, and ThinkPad/LAN checks remain pending. |

| V 1.0.6 | Classroom sessions, 64-slot scan backlog, configurable CPU pool, WAL-safe operation, and 60-user local validation documented in guide, all tips and hosting notes; printable copies regenerated. | Source/route and asset checks in milestone handoff. No screen layout change; sign-in version and previously pending captures remain refresh-pending. ThinkPad HTTPS classroom validation remains pending. |

| V 1.0.7 | Multi-sequence institution defaults, private personal versions, explicit case-copy loading, current role permissions, save/switch/scan behavior and conflict troubleshooting. | Local instructor→student browser walkthrough passed; new sign-in and three protocol images captured with fictional data and inspected for role context/rendered canvases. Other images, print and ThinkPad verification remain pending. |
