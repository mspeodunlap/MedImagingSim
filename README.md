# MedImagingSim

Internal test server — [https://192.168.0.180:8443/sign-in](https://192.168.0.180:8443/sign-in), hosted on the ThinkPad T450s at its reserved LAN address. Access requires a connection to the local network and trust for the server’s Caddy certificate.

MedImagingSim is a web-based imaging workflow simulator with standalone sign-in, an incoming order queue, a shared Radiology Information System (RIS), and a brain MRI planning and acquisition console.

Read the [MedImagingSim user guide](docs/USER_GUIDE.md) for detailed role-based steps and troubleshooting (V 1.0.6 screenshot refresh is pending). Quick references: [student](docs/quick-start/STUDENT.md), [instructor](docs/quick-start/INSTRUCTOR.md), and [admin](docs/quick-start/ADMIN.md). In the simulator, **Training help** opens the relevant guide section and role tips in a separate tab/window. Browser/print copies are in [docs/print](docs/print/USER_GUIDE.html); open an HTML file in a browser to print or save as PDF. For new functional work, start with the [reference topic index](docs/REFERENCE_INDEX.md) and [review decisions](docs/REFERENCE_WORKFLOWS.md), then consult relevant sections from the five PDFs in `Reference Docs`, following AGENTS.md.

**Current local release: V 1.0.6.** Classroom and regression checks are recorded in the milestone handoff. The user will handle the pending commit/push; a release commit, successful push, deployed SHA, and live ThinkPad version have not been verified in this session. Screenshot refresh and rendered-browser/print/LAN checks remain pending.

Publish the current build and each new release to the dedicated ThinkPad T450s by following the [LAN hosting and publishing guide](docs/LAN_HOSTING.md).

## Run locally

Use Node.js 24 or later. The app uses Node's HTTP server and SQLite driver and has no package dependencies.

```sh
npm run create-user -- admin admin
npm start
```

The account command prints a generated password. Open [MedImagingSim](http://127.0.0.1:3000) and sign in as `admin`. The local server binds to 127.0.0.1 and stores its SQLite database in `data/medimagingsim.sqlite` by default. Set `MEDSIM_PORT` to change the port. Set `MEDSIM_DB` for both account creation and the server to use a different database path.

## Verify with the superuser

1. As admin, open **Order queue → Practice scenarios**, choose **Routine brain MRI**, and select **Create scenario order**. Verify the order fields, select today’s **Appointment date** and an **Appointment time**, check all three completeness confirmations, and select **Schedule order**. You return to **Order queue**. Open **RIS worklist**, select the patient, and review the history and submit **No** for all three answers. The order shows **Screened**. Select **Begin exam** before **Open MRI console**; the stage becomes **Exam Begin**.
2. Return to **Order queue → Practice scenarios**, create **Implant review**, and review it, choose today’s appointment date and a time, and schedule it. Open **RIS worklist**, select the patient, and review the history and select **Yes** or **Unsure** for the implant question. The order remains **Scheduled** with a **Screening hold** indicator.
3. Select **Instructor home** in the header, then return to **RIS worklist** with the same session. The admin worklist includes orders and their owners from the current practice institution.
4. Return to the clear **Routine brain MRI** case at **Exam Begin** (not the held case). Save at least one acquisition, return to the RIS order, confirm the performed exam, and select **End exam**. Find the case in **Completed/Recent** on its appointment date and **Mark completed**. Completion is a RIS status, separate from PACS transfer. Before instructor review, all roles can **Reopen for correction** to return it to Exam Begin. An instructor opening an ended/completed study locks it; only an instructor can **Send back for correction** with a reason.
5. Sign out and back in as admin. Both orders retain their accession, status, and submitted answers.

The screening scenarios are fictional training exercises. Responses become read-only after submission.

## Walk through the MRI console

If the app is already running, stop it with **Control-C** in Terminal and run `npm start` again to load the new code. Continue with the [MRI walkthrough](docs/USER_GUIDE.md#plan-and-run-an-mri-scan). Your existing local accounts and orders remain available when you use the same database.

See the [MRI console parameter inventory](docs/MRI_CONSOLE_COVERAGE.md) for modeled controls, vendor references, and the remaining capabilities.

## Dedicated role testing

After the admin walkthrough passes, create separate test accounts with `npm run create-user -- student1 student` and `npm run create-user -- instructor1 instructor`.

Run `npm test` for automated coverage of intake completeness and review history, dated scheduling, RIS date filters, rescheduling history, future-date restrictions, scheduling retries, roles, migration, screening, explicit exam start/end/completion, recent views, correction cycles, review locks/send-back, console access, simulated contrast, repeat scan persistence, and PACS selection through the request handler and an on-disk SQLite database.

See the [milestone plan](MILESTONE_PLAN.md) for the implementation sequence and handoff notes.

Versioning starts at `1.0.3` for the current numbering scheme. Run `npm run version:next` for the next release (currently `1.0.7`), through `1.0.9`, then `1.1.0`; include documentation updates in that change set.


## Concurrent classroom use

V 1.0.6 is configured for 30-user classrooms with headroom and has passed disposable-database request-handler and real localhost HTTP exercises with 60 independently authenticated students performing the full workflow and simultaneous scans. Each learner needs a distinct student account and browser profile/device. Tabs in the same profile share the session cookie; using the same account shares saved cases. Signing out one session does not sign out others. This is application-level validation, not a ThinkPad/network capacity guarantee.

The default MRI pool uses `min(4, max(1, availableParallelism() - 1))` worker threads with 64 additional waiting scans. `MEDSIM_SCAN_WORKERS` accepts 1–8 and `MEDSIM_SCAN_QUEUE_LIMIT` accepts 1–256; unset variables use the defaults, and invalid values fail startup. Keep defaults until measured host results justify tuning. Queue overflow returns a temporary busy response with Retry-After; it does not change ownership or another user's case. Authentication permits 64 in-flight checks and limits repeated attempts per username; neither is a cap on active sessions.

Disk databases use SQLite WAL, FULL durability and a five-second busy timeout. Keep the database on local storage and run one application service for this classroom configuration. Use SQLite online backup (as the existing deployment updater does), rather than copying a live database file alone. See [classroom hosting checks](docs/LAN_HOSTING.md#concurrent-classroom-operation).

Run `npm run test:classroom` for configuration, bounded-queue, WAL/online-backup and 60-user isolation/workflow coverage. Both transports also check same-account token independence, restart persistence and unauthorized cross-user/institution access. Synthetic local results do not replace a separate-client HTTPS classroom test on the ThinkPad. Scheduling resources/cohort availability, multiple app replicas and large institutional scaling remain separate planned work.
