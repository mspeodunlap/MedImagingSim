# MedImagingSim milestone plan

Internal test server — [https://192.168.0.180:8443/sign-in](https://192.168.0.180:8443/sign-in), hosted on the ThinkPad T450s at its reserved LAN address. Access requires a connection to the local network and trust for the server’s Caddy certificate.

**Status:** Milestones 1 and 2 are implemented as of November 15, 2026. Automated checks passed. Complete the local Safari walkthrough with the superuser, then verify dedicated roles. Milestone 3 implements PACS routing and instructor review.

**Source:** [Medical Imaging Suite Simulator PRD v1.3](PRD%20Medical%20Imaging%20Simulator.md). This plan reconstructs the earlier planning handoff and adds scope and completion criteria for each milestone.

## Implementation order

MRI is the sole modality for the initial release. Milestones 1–5 deliver the MRI student-to-instructor workflow, hosting and pilot access, and institutional identity and LMS integration. Milestone 6 adds CT as a post-launch enhancement after institutional integration is complete and the MRI release is live.

| Milestone | Deliverable | Status |
| --- | --- | --- |
| 1 | Standalone sign-in, shared RIS sandbox, and base application | Implemented. Browser smoke test pending. |
| 2 | MRI planning console and acquisition | Implemented. Browser smoke test and educator review pending. |
| 3 | Shared PACS and instructor assignment, review, and grading, validated with MRI | Pending |
| 4 | MRI hosting and pilot access | Pending |
| 5 | Institutional identity and LMS integration for MRI | Pending |
| 6 | CT planning console and acquisition | Deferred until after MRI go-live |

## Shared RIS and PACS design

- **RIS** provides one worklist, order lifecycle, accession workflow, and exam documentation interface. The order carries its modality and exam type, which select the scenario, screening questions and hold rules, and console. Technologist notes and contrast documentation use the same RIS workflow across modalities, with scenario-specific fields where applicable.
- **PACS** provides one study and series archive, routing workflow, and viewer. Every console sends selected images and geometry under the original RIS accession, with modality, technical metadata, and the window/level at send time. PACS displays applicable metadata, such as MRI sequence parameters or simulated CT dose, through the same viewer and review workflow.
- Each modality supplies its own exam and screening configuration, console controls, and acquisition engine. MRI is the first end-to-end implementation of the shared interfaces.

## 1. Standalone sign-in, shared RIS sandbox, and base application

- Choose the application stack, persistence layer, and local development setup. Implement standalone authentication with student, instructor, and admin roles. The admin can use both workspaces and work across orders. Enforce role and ownership checks on server operations for ordinary accounts.
- Add role-specific entry screens and the shared student RIS worklist. Create a sandbox launcher that generates a fictional patient and order from a seeded scenario template. Seed MRI first. Persist patient history, order modality and exam type, and the stable RIS accession number.
- Build the shared exam-opening and safety-screening workflow, using MRI screening questions and a hold scenario as the first configuration. Define the common exam state transitions and the handoff that opens the console for the order's modality in Milestone 2.
- **Complete when** the admin can launch and screen MRI sandbox exams, verify hold behavior and accession persistence, and open the instructor workspace in the same session. Follow this walkthrough with dedicated student and instructor testing for role and ownership boundaries. Confirm the RIS worklist, order lifecycle, and accession generation use the shared model and the MRI-specific screening rules come from the exam configuration.

## 2. MRI planning console and acquisition

- Start with a generic MRI console and one representative brain exam. Build axial, coronal, and sagittal localizer views with positioning controls for slice angulation, coverage, FOV, thickness, and gap.
- Implement a bounded set of pulse sequences and parameter controls that demonstrate meaningful differences in the scenario. Use versioned fixtures and reviewed effects for the first acquisition engine. Use precomputed variants when a dynamic effect cannot be validated adequately. Keep external dataset acquisition and full-physics reconstruction off the initial delivery path.
- Record each acquisition separately, including the exact generated image or an immutable reference, source and engine version, slice geometry, and technical parameters. Support repeat scans and console window/level adjustment. Preserve the selected series and window/level state at PACS send time.
- Expand supported sequence families, 2D and 3D acquisition, saturation bands and other advanced parameters, contrast timing, post-processing, and vendor terminology in increments. Keep vendor vocabulary separate from the shared parameter model.
- **Complete when** a student can open a screened MRI order from the RIS, plan and run a scan, change a supported parameter and observe its reviewed effect, repeat the sequence, and select which acquisition and window/level to send. Verify that repeat scans preserve earlier acquisition records.

## 3. Shared PACS and instructor assignment, review, and grading

- Carry the active institution from the authenticated session through every PACS, assignment, cohort, rubric, submission, and feedback operation. A local admin exercises both roles inside their institution. Require instructor assignment or cohort access for submissions. Test two institutions and multiple memberships before connecting PACS.
- Route selected series from the MRI console through the common PACS interface to a study using the original RIS accession. Make repeated send attempts for the same acquisition safe. Build the shared viewer with scrolling, window/level, pan, zoom, and the measurement and annotation tools needed by the initial rubric.
- Open instructor review with the exact selected acquisition, geometry, technical metadata, and student window/level captured at send time. Store subsequent viewer presets and markups separately from the submitted presentation.
- Add instructor cohort and submission views, scenario and assignment creation, rubric ranges and positioning tolerances, manual grading, and student feedback. Complete the RIS workflow with technologist notes and contrast documentation where applicable. Put completed assignments in the instructor review queue.
- **Complete when** an instructor assigns an MRI scenario, a student screens and scans it, sends the selected series to PACS, and completes the exam in RIS. Verify that the instructor sees the exact submitted image and window/level under the original accession, can grade it, and the student can retrieve the feedback.

## 4. MRI hosting and pilot access

- Decide hosting, pilot size, invite and access model, and deployment environments. Estimate storage and image delivery needs during earlier milestones. Resolve image usage rights and review the data inventory before external pilot access.
- Use a managed client/server database for overlapping institutional traffic. The proposed hosted architecture uses PostgreSQL with tenant-aware foreign keys, app authorization and row-level isolation, private object storage for immutable acquisition payloads, and at least two app replicas behind an HTTPS entry point. Add paginated worklists and acquisition history, bounded shared scan execution, a shared session and sign-in policy, tenant-aware quotas, encrypted backups, and an operator audit log. Validate feature and database compatibility with the local practice workflow.
- Load-test with realistic data across two institutions. Start with an explicitly provisional exercise of two concurrent 30-student classes, 60 sign-ins at class start, and 20 coincident scans while instructors review submissions. Initial targets are p95 under 500 ms for routine worklist requests, 2 seconds for sign-in, and 5 seconds for scan completion, with zero cross-institution exposure and zero lost or duplicate committed acquisitions. Confirm the traffic model with pilot hosts and repeat at twice the agreed peak before expanding access.
- Verify role isolation, backups and restore, telemetry, incident ownership, and deployment rollback in the pilot environment.
- **Complete when** invited pilot users can run the approved workflows, access is limited to the intended pilot users, and recovery and rollback have been exercised.

The [ThinkPad LAN runbook](docs/LAN_HOSTING.md) covers invited local testing on the ThinkPad T450s with Ubuntu Server 26.04.1 LTS amd64. The existing build and every subsequent release must be pushed or merged into GitHub `main`, deployed to the ThinkPad, and verified over its private HTTPS address from a separate tester device. Confirm the intended commit, session and workflow behavior, and persistence of test records. Record the deployed commit and outcome in the handoff. Initial machine setup, HTTPS trust, and the first two live release checks are pending. Use the hosted architecture and load acceptance criteria above for a multi-institution pilot.

## 5. Institutional identity and LMS integration for MRI

- Confirm an institution's identity provider, LMS, provisioning, roster, and grade return requirements. Keep authentication and LMS integrations behind boundaries so standalone access remains supported.
- Validate AD-backed sign-in or SSO and Blackboard or another target LMS using the agreed LTI capabilities in an institutional test environment.
- **Complete when** the agreed sign-in, course launch, roster or role mapping, and grade return flows pass in the target test environment, alongside regression checks for standalone access.

## 6. CT planning console and acquisition (post-launch)

- **Start after** Milestone 5 is complete and the MRI release is live.
- Add a representative CT scenario with scout-based coverage, CT-specific screening, and scenario-appropriate contrast workflow. Implement controls for kVp, mA/mAs, rotation time, pitch, slice thickness, reconstruction FOV, and algorithm as applicable to the scenario.
- Start with curated CT variants and explicit parameter-to-image mappings. Register the CT exam configuration and connect the CT console to the existing RIS and PACS interfaces. Send simulated dose metadata such as CTDIvol for instructor review.
- **Complete when** a CT scenario passes through the same RIS worklist, order lifecycle, and PACS viewer as MRI. Verify the original accession, submitted window/level, CT settings, and simulated dose are visible in the shared review workflow, and rerun the MRI acceptance checks.

## Decisions and open items

| Item | Current position |
| --- | --- |
| Build order | MRI-only through go-live, including pilot access and institutional identity and LMS integration. CT follows as a post-launch enhancement. |
| RIS and PACS | Shared applications across modalities. Exam configurations and acquisition consoles supply modality-specific behavior and metadata. |
| MRI acquisition | Hybrid fixture and reviewed-effects approach with precomputed variants as a fallback. |
| Submission fidelity | Preserve acquisition image, geometry, parameters, and presentation as submitted. |
| Console terminology | Generic MRI first. Add vendor vocabulary after the shared workflow is stable. |
| Dataset sourcing | Use synthetic or permission-cleared fixtures for early development. Confirm usage rights for the intended release before adding any external dataset. |
| Milestone 1 implementation | Node.js 24+, server-rendered HTML and CSS, and SQLite. Accounts are provisioned locally as student, instructor, or admin. The shared order model persists accession, modality, and versioned exam configuration. |
| Decisions for later milestones | Initial MRI technique and fidelity coverage, pilot host and audience, dataset permissions, and institutional integration targets. |

## Milestone handoff log

At the end of each milestone, record the completion date, delivered scope, acceptance checks and results, decisions, remaining issues, and the first task for the next milestone. Use the first pending milestone and latest handoff as the starting point when asked to proceed. Update the [user guide](docs/USER_GUIDE.md) with every new feature or behavior change as required by the [project instructions](AGENTS.md).

| Date | Milestone | Handoff |
| --- | --- | --- |
| 2026-11-15 | Planning | Recorded the PRD v1.3 implementation order and acceptance criteria. Start Milestone 1 with stack selection and the initial authentication and RIS sandbox design. |
| 2026-11-15 | Release scope | Limited the initial release to MRI. Moved CT to Milestone 6 after institutional identity and LMS integration and MRI go-live. Milestone 1 remains next. |
| 2026-11-15 | Shared applications | Set RIS and PACS as shared across modalities. Start Milestone 1 with a shared RIS order model and MRI exam configuration. Validate PACS with MRI in Milestone 3 and reuse both applications when CT is added. |
| 2026-11-15 | Milestone 1 | Delivered standalone sign-in, role-specific workspaces, and the shared RIS worklist. Added two fictional MRI scenarios, persistent screening answers, and console eligibility for screened orders. Verified access isolation, launch retries, hold enforcement, sign-out and sign-in, and persistence after reopening SQLite. The execution sandbox denied binding a localhost listener, so the browser smoke test is pending. |
| 2026-11-15 | Superuser verification | Added a locally provisioned admin role with both workspaces and access to all RIS orders. Automated checks passed for workflow access, screening, and migration of existing accounts and sessions. Start browser verification with one admin account, then move to dedicated student and instructor testing. |
| 2026-11-15 | Milestone 2 | Linked screened brain MRI orders to the MRI console under the original RIS accession. Added three synthetic localizers, live slice planning, T1/T2/PD spin echo and inversion-recovery presets, slice review, window/level, and selection for PACS. Automated checks passed for role and hold enforcement, contrast effects, scan retries, pixel and metadata persistence, and the saved PACS selection. Safari smoke testing remains pending because the execution sandbox denied a local listener. |
| 2026-11-15 | Scale review | Added institution membership, institution-bound sessions and orders, scope checks for MRI and PACS selections, asynchronous sign-in hashing, per-account throttling, and a bounded MRI worker pool. A database snapshot migration preserved three accounts, three orders, and five scans. Tests passed for isolation across two institutions and a 30-account request-handler sign-in burst. Hosted capacity remains unverified. |
| 2026-11-15 | Console expansion | Added modeled GRE flip angle, fast spin echo time estimation, phase and frequency sampling, wrap and oversampling, averages and bandwidth noise, contiguous 3D GRE partitions, and a spatial saturation band. Recorded the [vendor and parameter inventory](docs/MRI_CONSOLE_COVERAGE.md). |
| 2026-11-15 | Console layout | Grouped patient/exam and protocol/history in the left rail, positioning across the top, and scan parameters beside the lower-right series preview. New scans open in preview. Dragging or selecting a history row loads the preview independently of the scan plan. |
| 2026-11-17 | LAN test hosting | Added HTTPS reverse-proxy mode, a macOS LaunchAgent installer and test-gated publisher, and a setup/publishing runbook. The publisher keeps the tester database separate from releases and checks candidate migrations against a snapshot. Hardware setup and tester acceptance remain pending. |
| 2026-11-17 | ThinkPad release requirement | Designated the ThinkPad T450s as the LAN tester host and selected Ubuntu Server 24.04 LTS as the setup path. Added the Linux publishing entry point and documented host setup, GitHub release checks, and separate-device acceptance. The current build's first live deployment is pending. |
| 2026-11-17 | ThinkPad OS target | Updated the installation target to Ubuntu Server 26.04.1 LTS amd64 and linked the official installer and checksums. ThinkPad installation and live release verification are pending. |
| 2026-11-17 | First ThinkPad deployment verified | User staged commit `9dfc9ebeca5af59a05d88fdd2f757f8c4cd70ca0` on Ubuntu Server 26.04.1 LTS with Node 24.22.3. All nine tests passed on the ThinkPad. App and Caddy services are running. User confirmed Safari access from the development Mac at `https://192.168.0.180:8443/sign-in`, admin sign-in, and exam launch. Automatic update timer, a subsequent deployment, and persistence across that deployment remain pending. |

The user enabled `medimagingsim-deploy.timer` on November 17, 2026. The manual deployment check returned without an error and systemd listed the next check in 59 seconds. User confirmed the temporary login notice from commit `71cbdfd` (“Testing Server build”) appeared in Safari at the ThinkPad address, verifying automatic publication to a separate LAN host. User subsequently confirmed the removal deployment and saved exam check succeeded.

### Milestone 1 handoff to the MRI console

November 17, 2026 host operation update. Documented the logind override for lid-closed operation on external power, service checks after reboot, and a two-minute closed-lid availability check. Application of the setting and live verification on the ThinkPad are pending user execution. These documentation changes await publication with the next commit.

Temporary deployment check confirmed on November 17, 2026. Removed “Auto-update test · ThinkPad update check 01” from the sign-in screen and its temporary user-guide paragraph after the user's screenshot confirmed it was visible. User confirmed the notice disappeared and the saved exam check succeeded after publishing removal commit `021b425`. Verification is based on the user’s browser confirmation. The active host SHA was not independently read after this deployment.

- Follow the [local run instructions](README.md) to verify both practice scenarios and the instructor workspace in a browser with one admin account. Then verify dedicated student and instructor roles.
- The simulated state moves from Ordered to Ready for console or Screening hold. Screening is read-only after submission. The ready-order handoff in `src/app.js` rechecks ownership and safety screening before opening the modality console.

### Milestone 2 handoff to shared PACS

- Run the [Safari walkthrough](README.md#walk-through-the-mri-console) with the superuser. Compare T1 and T2 at the same geometry, slice, and presentation. Confirm that a previous series can be selected after a repeat scan and that the selection survives a reload. Then verify student and instructor account boundaries.
- The console records scans from the versioned synthetic brain phantom (`synthetic-brain-v1`) and idealized signal engine (`analytic-mr-v2`). Earlier scans retain their original image bytes and engine version. Automated checks exercise qualitative contrast and sampling effects. Educator review of the fixture, presets, and image fidelity is pending.
- Start Milestone 3 by reading the selected series and window/level for an accession from `pacs_selections`. Resolve the referenced immutable acquisition in `acquisitions`, which stores exact 8-bit slice pixels in row-major order, dimensions, slice centers and orientation in patient coordinates, technical parameters, and fixture and engine versions. Capture a distinct presentation snapshot on send, route it through the shared PACS service, and make repeated sends safe.

## Incoming order queue enhancement

Requested November 22, 2026. Delivered an order queue ahead of the shared RIS worklist. Manual, randomized quick, and existing practice-scenario entry paths require completeness review and scheduling. Required demographics are name, patient ID/MRN, date of birth, and recorded sex, plus the supported exam and reason. Quick orders omit one to three required fields with a 20% probability per generated order. The remaining 80% are complete, as specified by the user. Original intake and reviewer snapshots are retained for assessment. Scheduling is atomic, preserves the creator's ownership, and is safe to retry.

Students review their own incoming orders. Instructors and admins review their institution's queue and scheduled worklist. Instructors inspect scheduled intake records through the worklist. Existing student/admin screening and console permissions continue to apply. Existing exams and acquisitions are preserved by additive intake tables.

All eleven automated tests passed. A browser walkthrough on an isolated local database verified blocked scheduling with missing demographics and indication, recording information follow-up, correcting the fields, checking completeness, scheduling, and the resulting RIS worklist entry. A snapshot migration preserved all existing users, sessions, orders, acquisitions, and PACS selections. Validation includes incomplete and unchecked schedule attempts, correction and information follow-up, reviewer history, scheduling races, creation retries, cross-user and cross-institution isolation, restart persistence, and prior MRI workflows. GitHub publication and ThinkPad HTTPS verification are pending. On the internal server, create a quick order, identify missing details, record information follow-up, correct it, verify all completeness items, and schedule. Confirm it appears once in RIS and a preexisting exam and its scans still open.


November 22, 2026 name entry update. Intake now uses separate First name and Last name fields, both required before scheduling. The server derives the First Last display, normalizes whitespace, and preserves punctuation and multipart names. Quick orders retain the independent 80% complete / 20% incomplete probability and practice scenarios supply explicit name components. Older pending orders show the original unsplit name and require confirmation of its parts. Existing scheduled names and original assessment snapshots are preserved. Historical reviews using the old patientName field remain readable. All twelve automated tests passed, including name normalization, missing name components, protection against a supplied display-name override, legacy queued-name confirmation, historical review rendering, and the unchanged quick-order probability split. GitHub publication and ThinkPad LAN verification are pending. After publication, check First name / Last name entry and scheduling at https://192.168.0.180:8443/sign-in from another LAN device.


November 22, 2026 scheduling navigation update. Successful scheduling and scheduling retries now return every role to the order queue to continue reviewing incoming orders. Safety screening starts when the technologist opens the scheduled patient from that worklist. Scheduling leaves the order at Ordered with no screening answers. Regression checks cover the order-queue redirect, removal of the scheduled order from the queue, the RIS patient link, absence of screening controls on the worklist, and unchanged screening/console permissions. All twelve automated tests and the whitespace diff check passed. GitHub publication and ThinkPad HTTPS verification remain pending. The current session cannot write the Git index; commit and push through VS Code, then schedule an order on the LAN server and confirm it returns to Order queue and removes the scheduled order from the pending list. Open RIS worklist separately, then select the patient to begin screening.


## Appointment scheduling and dated RIS worklist

November 22, 2026. Scheduling now requires an explicit date and time and returns to Order queue. RIS defaults to today, supports another date and a Today shortcut, sorts by appointment time, and shows the appointment and future-date warning. Students and admins can reschedule accessible unstarted exams from a RIS row or order page; the correction defaults to today and records the actor, old/new appointment, institution timezone, and timestamp. Revision checking prevents overwriting a concurrent correction. Screening submission and console entry/acquisition saving reject future calendar dates. Later appointments today may start today. Once screening has been submitted, rescheduling is unavailable. Instructor console permissions remain unchanged.

Each institution stores an IANA timezone, defaulting to America/New_York for the internal test host. Calendar checks never depend on the browser timezone or the ThinkPad’s UTC setting. The additive migration backfills existing appointments from the original creation timestamp in the institution timezone and preserves patient names, screening, scans, and sessions. Historical exams may require choosing their original date in RIS. Date indexes cover institution-wide and student-specific worklists.

All fifteen automated tests passed. Coverage includes missing/invalid appointment fields, dates and leap years, midnight and DST timezone boundaries, today/past/future date filtering, institution/owner isolation, future screening and console/scan blocking, rescheduling conflicts and history, reopening the database, and migration preservation of saved pixels and screening. An isolated local browser walkthrough verified scheduling tomorrow, returning to the queue, today’s empty worklist, tomorrow’s exam via the filter, blocked future screening, correction to today, and screening availability after selecting the corrected patient. README, requirements, and user guide are updated. GitHub publication and verification on the ThinkPad remain pending.

Publish through GitHub main and verify the active host SHA. From another LAN device at https://192.168.0.180:8443/sign-in, schedule tomorrow, check the date filter and future warning, correct to today, open screening, and confirm a saved exam still opens on its original date. Record the deployed commit and result. The current session cannot write the Git index; commit and push through VS Code if that limitation remains.
