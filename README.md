# MedImagingSim

Internal test server — [https://192.168.0.180:8443/sign-in](https://192.168.0.180:8443/sign-in), hosted on the ThinkPad T450s at its reserved LAN address. Access requires a connection to the local network and trust for the server’s Caddy certificate.

MedImagingSim is a web-based imaging workflow simulator with standalone sign-in, an incoming order queue, a shared Radiology Information System (RIS), and a brain MRI planning and acquisition console.

Read the [MedImagingSim user guide](docs/USER_GUIDE.md) for detailed role-based steps and troubleshooting (current dictionary/console captures included; older screen refresh pending). Quick references: [student](docs/quick-start/STUDENT.md), [instructor](docs/quick-start/INSTRUCTOR.md), and [admin](docs/quick-start/ADMIN.md). In the simulator, **Training help** opens the relevant guide section and role tips in a separate tab/window. Browser/print copies are in [docs/print](docs/print/USER_GUIDE.html); open an HTML file in a browser to print or save as PDF. For new functional work, start with the [reference topic index](docs/REFERENCE_INDEX.md) and [review decisions](docs/REFERENCE_WORKFLOWS.md), then consult relevant sections from the relevant workflow/physics PDFs in `Reference Docs`, following AGENTS.md.

**Current local release: V 1.1.0.** Classroom and regression checks are recorded in the milestone handoff. The user will handle the pending commit/push; a release commit, successful push, deployed SHA, and live ThinkPad version have not been verified in this session. Physics parameter/image tests and a fictional-data browser walkthrough verify the revised model. New sign-in/planning/review captures are V 1.1.0; unchanged task examples retain their V 1.0.9 capture metadata. Full print and live LAN checks remain pending.

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

Versioning starts at `1.0.3` for the current numbering scheme. Run `npm run version:next` for the next release (currently `1.1.1`); patch rollover takes `1.0.9` to `1.1.0`; include documentation updates in that change set.


## Concurrent classroom use

V 1.1.0 is configured for 30-user classrooms with headroom and has passed disposable-database request-handler and real localhost HTTP exercises with 60 independently authenticated students performing the full workflow and simultaneous scans. Each learner needs a distinct student account and browser profile/device. Tabs in the same profile share the session cookie; using the same account shares saved cases. Signing out one session does not sign out others. This is application-level validation, not a ThinkPad/network capacity guarantee.

The default MRI pool uses `min(4, max(1, availableParallelism() - 1))` worker threads with 64 additional waiting scans. `MEDSIM_SCAN_WORKERS` accepts 1–8 and `MEDSIM_SCAN_QUEUE_LIMIT` accepts 1–256; unset variables use the defaults, and invalid values fail startup. Keep defaults until measured host results justify tuning. Queue overflow returns a temporary busy response with Retry-After; it does not change ownership or another user's case. Authentication permits 64 in-flight checks and limits repeated attempts per username; neither is a cap on active sessions.

Disk databases use SQLite WAL, FULL durability and a five-second busy timeout. Keep the database on local storage and run one application service for this classroom configuration. Use SQLite online backup (as the existing deployment updater does), rather than copying a live database file alone. See [classroom hosting checks](docs/LAN_HOSTING.md#concurrent-classroom-operation).

Run `npm run test:classroom` for configuration, bounded-queue, WAL/online-backup and 60-user isolation/workflow coverage. Both transports also check same-account token independence, restart persistence and unauthorized cross-user/institution access. Synthetic local results do not replace a separate-client HTTPS classroom test on the ThinkPad. Scheduling resources/cohort availability, multiple app replicas and large institutional scaling remain separate planned work.


## Saved MRI protocol library — V 1.1.0

Instructors/admins create ordered multi-sequence defaults in MRI protocols without opening a patient. Each sequence retains all supported acquisition settings. Staff publish immutable institution-default versions; students explicitly Load protocol copy at Exam Begin and save their own personal versions, never replacing a default. A case copy can be edited sequence by sequence, and full definitions can be added/reordered in the library editor. Library saves never run acquisitions or alter already-loaded case copies. Successful scans retain the plan in an unchanged loaded case copy without publishing a reusable version.

Defaults are visible only inside the institution; personal versions are visible to their creator. Staff can inspect accessible case working copies without gaining browse access to private libraries. New saves under an existing name require the latest base; conflicting edits do not silently replace newer versions. Case protocol mutations retain the exam's role/ownership, future-date, begin/end and review-lock constraints. See [user instructions](docs/USER_GUIDE.md#create-load-and-save-mri-protocols). Current physics planning/review and sign-in captures accompany the guide; wider screen refresh and live ThinkPad/print checks remain pending.

## MRI anatomy and protocol dictionary — V 1.1.0

MRI protocols links to a searchable dictionary with nine groups, 92 regions, 32 sequence/contrast entries, 58 exam outlines, 43 source-linked parameter examples and seven immediately runnable synthetic-brain teaching starters. Examples distinguish source-specific 1.5T/3T values from accreditation limits and original model settings. Missing clinical values require review; reference recipes cannot become acquisitions. Staff can install missing teaching defaults without replacing existing names/versions. Students save private variants. See [research assessment](docs/MRI_PROTOCOL_RESEARCH.md) and [user instructions](docs/USER_GUIDE.md#use-the-mri-anatomy-and-protocol-dictionary). Additional anatomy, fat suppression, diffusion/ADC, flow, contrast dynamics and gating are not implemented by the dictionary.

## Guided MR console — V 1.1.0

The console now has Setup, Plan & scan, Review and Finish views, a persistent patient-identity ribbon, an ordered sequence rail with evidence-based progress, essential/full parameter reveal, orthogonal localizer drag for stack center, shared model-time estimates, larger image review with slice/display tools, geometry reuse preserving contrast/timing, and in-console guarded End/Completed actions. No automatic quality grading, new anatomy or fake hardware operations are implied. Old images remain available without fabricating protocol progress. See [manufacturer research and decisions](docs/MR_CONSOLE_WORKFLOW_RESEARCH.md) and the [guided console instructions](docs/USER_GUIDE.md#use-the-guided-console-workspace).

## MRI physics model

V 1.1.0 uses analytic-mr-v3: finite-voxel partial volumes; signed IR and complex magnitude/noise; voxel/averaging/bandwidth/phase/3D sampling SNR; single-peak fat displacement/GRE phase; and tissue-specific FSE phase Fourier modulation. New Echo spacing (ms), shared timing validation, live physics feedback and stored acquisition evidence make parameter tradeoffs visible. Existing bytes and immutable protocol versions remain unchanged. Dictionary revision 2026-11-23.2 updates FSE starters with 10 ms spacing; installation preserves existing names. See the [physics source assessment and parameter contract](docs/MRI_PHYSICS_AUDIT.md). The supplied PDF and requested sequence links were reviewed within disclosed access limits; direct Radiopaedia linked pages returned HTTP 402. No clinical scanner calibration or unsupported specialized sequence is implied.

## Standing MRI principles reference

For future MRI physics, sequence, image-quality, encoding or reconstruction work, use the [Larson Lab course index and critical assessment](docs/LARSON_MRI_REFERENCE_INDEX.md), then read the relevant original chapter/section. The complete 36-page course catalog, topic routing, verified section IDs and fingerprints are maintained alongside the local PDF references. This reference update leaves the application at V 1.1.0.


See the [timestamped MRI simulator video review](docs/MR_CONSOLE_VIDEO_REVIEW.md) for candidate console improvements in sequence duplication, comparison, parameter feedback and graphical planning. These are research proposals, with accuracy caveats and acceptance criteria; the demonstrated interface must not be copied.


## Deferred real-time MRI engine strategy

[MRI-ENGINE-001: real-time imaging architecture and implementation plan](docs/REALTIME_MRI_ENGINE_PLAN.md) records the adopted phantom → physics → generated raw k-space → reconstruction direction. Begin with validated hybrid acquisition and a shared job/result contract, then benchmark a GPU Bloch service. Includes data/sequence contracts, numerical safeguards, classroom capacity, phased gates and a resume checklist. Say **resume MRI-ENGINE-001** to return to this plan. Implementation has not started; current application remains V 1.1.0.
