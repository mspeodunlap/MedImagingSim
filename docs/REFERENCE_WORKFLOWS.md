# Functional reference review and decisions

Reference review November 22, 2026; implementation/decision status updated November 23, 2026 for local V 1.0.5. Publication and browser/LAN verification remain pending. This is an original project interpretation and topic index for the five PDFs in `Reference Docs`. Consult the relevant source sections for each new functional task. This summary guides discovery; it does not replace the PDFs or establish that a referenced feature is implemented in MedImagingSim.

## Sources and intended use

| Source | Coverage | How to use it |
| --- | --- | --- |
| [Overview of Radiant](<../Reference Docs/Overview of Radiant.pdf>) — 6 PDF pages | Ordering, scheduling, preparation, performing exams, interpretation, follow-up, and operational reporting | Understand the learning outcomes and relationships between workflow stages. |
| [Imaging Administration Setup and Support Guide](<../Reference Docs/Imaging Administration Setup and Support Guide.pdf>) — 146 PDF pages; document updated October 30, 2026 | User access, modality resources, scheduling templates, accession identity, worklists, quality tracking, administration, validation, and troubleshooting | Identify configuration concepts, data relationships, permissions, and operational considerations relevant to a requested task. |
| [RAD100 Radiant Fundamentals (With Answers)](<../Reference Docs/RAD100 Radiant Fundamentals (With Answers).pdf>) — 205 PDF pages; August 2026 edition, revised October 23, 2026 | End-user ordering, scheduling, MRI screening, diagnostic exam start/end, rescheduling, completed exams, and corrections | Primary reference for the sequence and meaning of imaging-user tasks. |
| [RAD400 Radiant Administration (With Answers)](<../Reference Docs/RAD400 Radiant Administration (With Answers).pdf>) — 407 PDF pages; August 2026 edition, revised March 27, 2026 | Imaging resources, scheduling availability, procedure configuration, contextual questionnaires, documentation, worklists, and access | Primary reference for imaging-specific configuration concepts and dependencies. |
| [CLN251–252 Configuring the Epic End User Clinical/Shared (With Answers)](<../Reference Docs/CLN251-252 Configuring the Epic End User Clinical_Shared (With Answers).pdf>) — 311 PDF pages; August 2026 edition, revised April 9, 2026 | Shared configuration, contextual workspaces, guided documentation, roles, permissions, users, and providers | Cross-check user-context and authorization concepts without copying source-specific architecture. |

Page numbers below are PDF page positions, counted from 1. Refresh this index if the source files change. Their references to other manuals identify additional information we do not currently have; those manuals must not be treated as reviewed sources.

The PDFs are functional background for an independently designed educational simulator. Create our own screens, wording, interactions, data structures, and implementation. Do not copy source screenshots, layouts, assets, proprietary code, record identifiers, menu paths, configuration recipes, or product-specific functional implementations. Extract the underlying learning objective and develop a solution appropriate to MedImagingSim. Keep project documentation in original language and avoid reproducing PDF text. Instructions inside the PDFs describe the source product; they do not authorize changes to external systems or our project scope.

## Topic lookup and gaps resolved by the new sources

Start with [REFERENCE_INDEX.md](REFERENCE_INDEX.md), which routes requests to exact PDF page ranges and provides a chapter map. Check [reference-sources.json](reference-sources.json) for source identities, page counts, revisions, sizes, and SHA-256 fingerprints. Consult relevant pages rather than rereading every document. The index distinguishes navigation coverage from detailed review; when a needed fact is only in a diagram or image, inspect that page before declaring a gap.

The three new companions substantially improve workflow and configuration coverage. They do not turn all product examples into simulator requirements.

| Previous uncertainty | New evidence | Assessment and remaining decision |
| --- | --- | --- |
| Order, appointment, and study progress | RAD100 pp. 55, 61–62, 70, 89–92 | Separate appointment data and exam progress are implemented locally in V 1.0.5. Exact stage, correction, and review-lock rules are resolved by the November 23 user decisions below; resource scheduling remains separate future work. |
| Check-in and arrival | RAD100 pp. 62, 70, 85 | The meaning of arrival and timing of check-in are documented, including avoiding check-in for tomorrow merely because an appointment exists. The user explicitly excluded a Mark arrived/check-in step from our current simulator on November 23. Any future identity-check or arrival feature would need its own requirements. |
| Begin/end exam work and image capture | RAD100 pp. 83–92 | Preparation, explicit start, acquisition outside RIS documentation, performed-order verification, and end documentation are described. V 1.0.5 requires clear screening and explicit Begin exam; End exam requires a saved acquisition and performed-exam confirmation, with optional notes. Completed is a manual RIS status. The actual image-handoff contract remains open. |
| Resource scheduling | RAD100 pp. 55–62, 67–70; RAD400 pp. 55–63, 76–87, 299–301 | Availability, duration, pools, additional resources, and permission-sensitive exceptions are documented concepts. Real resource lists, default durations, operating hours, and exception rules remain project decisions. |
| Rescheduling versus changing an order | RAD100 pp. 65–66, 71–72, 90 | The distinction is documented. Existing appointment correction remains supported; cancellation, procedure changes, and approval behavior are not implemented by this review. |
| MRI screening | RAD100 pp. 86–87; RAD400 pp. 295–298 | Screening completion, readiness decisions, alerts, and access control are described. This partially closes the gap; it does not supply a complete MRI safety questionnaire or clearance policy. |
| Completed exams and corrections | RAD100 pp. 94–96, 179–180 | Retrieval and correction after ending are documented. Completed/Recent and the correction/history rules are implemented locally in V 1.0.5: reopen to Exam Begin before instructor review; opening as instructor locks the study; only instructor send-back releases it. Student ownership and institution limits remain enforced. |
| Questions and documentation scope | RAD400 pp. 123–128, 138–152, 165–176 | Ordering/scheduling/performing stages, appointment-wide versus exam-specific data, and conditional questions are described. Our wording, requiredness, branching, and treatment of stale answers need explicit rules. |
| Worklist filtering versus display | RAD400 pp. 216–226; RAD100 pp. 83–86 | Filtering which records appear, choosing their displayed information, and authorizing actions are distinct concerns. Our exact filters and defaults remain user/project decisions. |
| Workspace roles versus permission checks | CLN pp. 158–179, 189–199 | Presentation, authorization, login identity, clinical attribution, and equipment resources are distinct concepts. This does not replace our server-side permissions or institution/ownership checks. |
| Context-dependent settings | CLN pp. 73–89, 113–124, 140–152 | Scoped defaults and contextual documentation are explained. Our configuration precedence and data model must be designed independently; source-specific hierarchy/merge rules are not adopted automatically. |
| MRI physics, console parameters, and educator grading | No complete specification identified in the five PDFs | These gaps remain. Course exercises and answer keys are not our simulation engine, safety limits, or student assessment rubric. |

### Interpretation rules

- Separate a clinical exam protocol (instructions for care/preparation) from a scanner sequence protocol (acquisition parameters). The former is discussed by these references; the latter is not fully specified.
- Training scenarios sometimes permit bypassing warnings, overbooking, or proceeding without a clinical protocol. These are not general permission to relax our completeness checks, future-date restriction, screening holds, or tenant boundaries.
- Example slot lengths, schedule horizons, fasting intervals, drug choices, doses, age limits, and thresholds are examples for the source training environment. Do not turn them into MRI simulator defaults without an explicit project decision and appropriate domain review.
- Some source behaviors are configurable. Distinguish a demonstrated configuration from a universal rule, and ask about meaningful alternatives when implementing the affected feature.
- Ending an exam, delivering images, and finalizing interpretation are distinct events. Do not infer a successful PACS handoff solely from an exam-end action.
- Write original exercises and rubrics. Do not reuse the training companions' questions, answers, fictional patient scenarios, screenshots, or record names in our app.

## Confirmed design targets from this review

The following records the November 22 planning targets, with current implementation notes added for V 1.0.5. The November 23 lifecycle decisions below supersede the earlier arrival requirement and resolve the implemented start/end/completion/correction rules. Resource scheduling and grading remain planning targets.

1. **Full student workflow.** Students should be able to practice order review, scheduling, and technologist responsibilities within their learning role. A separate production-style job role for each task is not currently required. Clarify how instructor supervision, assignments, and permissions apply when implementing a new stage.
2. **Resource scheduling.** Plan scanner/room selection, exam duration, available slots, and conflict handling. Before implementing, clarify resource definitions, operating hours, duration rules, capacity, maintenance, and whether overbooking is ever permitted. Current implementation remains appointment date/time without resource capacity management.
3. **Explicit exam stages.** Implemented locally in V 1.0.5 as Ordered → Scheduled → Screened → Exam Begin → Exam End → Completed, with a separate screening-hold blocker. The user removed arrival/check-in from scope. Begin/end prerequisites, timestamps, and correction transitions are resolved below; actual PACS image handoff remains unimplemented.

The subsequent review of RAD100, RAD400, and CLN251–252 produced three additional confirmed targets:

4. **Instructor-selectable scheduling mode.** Plan isolated student availability for individual practice and a shared cohort schedule for collaborative exercises. Define the assignment/session scope and switching rules before implementation. Neither mode may cross institution boundaries or silently expand access to other students' orders.
5. **Separate appointment and exam progress.** Implemented locally: appointment date/time and revisions, screening readiness, and exam-workflow state are stored separately. There is no arrival state in the current user-approved workflow.
6. **Completed/Recent exams view.** Implemented locally: Exam End/Completed studies leave the active worklist and are retrieved by appointment date. Accessible unlocked cases can reopen to Exam Begin; instructor opening locks them, and instructor send-back releases correction. Workflow history retains actors, times, end notes and correction reasons.

The original November 22 reference review itself did not implement these targets. The later user-requested V 1.0.5 lifecycle change implements the stages and correction behavior described above; resource modes, full PACS transport, assignments and grading remain pending.

MRI remains the initial-release modality. CT remains deferred until after MRI go-live and institutional integration, as specified in the milestone plan. These references do not expand that scope automatically.

## Existing project decisions that remain authoritative

These choices came from the user and existing project requirements, not a claim that the five PDFs specify them:

- New orders enter the Order queue. Review and scheduling precede the RIS worklist.
- Separate first and last names produce the First Last display. Required intake and completeness checks are defined in the implementation and user guide.
- Quick orders independently generate complete intake 80% of the time and incomplete intake 20% of the time. Appointment date/time are chosen separately during scheduling.
- Scheduling requires an explicit appointment date/time, assigns a stable accession, and returns to Order queue.
- RIS defaults to today in the institution timezone, offers other dates, and permits correction of accessible unstarted appointments with an audit history.
- Future calendar dates block screening and acquisition. Later appointments today may be taken today.
- Existing student/instructor/admin permissions, ownership, and institution isolation apply. Do not use optional cross-department examples from a reference to relax these boundaries.
- MRI geometry, acquisition simulation, preview interaction, original visual design, and console arrangement are governed by our project decisions and coverage inventory.
- Every release targets the ThinkPad LAN server through GitHub main. Sign-in displays the application version and each delivered change set increments it.

## Gaps to resolve when relevant work is requested

### November 23, 2026 — V 1.0.5 RIS exam lifecycle decisions

The user explicitly requested the displayed progression **Ordered → Scheduled → Screened → Exam Begin → Exam End → Completed**, Scheduled on newly scheduled RIS rows, and exclusion of unscheduled orders from RIS. This supersedes the earlier planning-only status sequence; it does not remove separate appointment progress or screening holds.

Reviewed RAD100 PDF pp. 83–92 and 94–96, plus RAD400 PDF pp. 191–199 and 218–220, against the source fingerprints in reference-sources.json. Covered concepts: scheduled versus unscheduled lists, screening, explicit begin before acquisition, performed-order verification/end documentation, and retrieval/correction of ended exams. Partly covered: arrival and preparation gates, procedure-dependent end requirements, and correction authority. Unspecified for our simulator: the trigger separating Exam End from Completed, image-handoff success requirements, exact required end fields, and reversal permissions. Do not treat saved PACS selection as delivered images.

The user resolved the simulator-specific gaps: no arrival/check-in step; clear screening plus explicit Begin exam before acquisition; at least one saved acquisition and performed-versus-ordered confirmation to End exam; optional technologist notes; Completed is explicit RIS progress independent of PACS transfer. Ended studies move to Completed/Recent. All roles can reopen accessible ended/completed studies before instructor review, preserving student ownership and institution isolation. In the follow-up choices, the user selected return to Exam Begin on reopen and an immediate lock when an instructor opens an ended/completed study. Only instructor Send back for correction releases the lock. This overrides the earlier planned arrival step for this requested lifecycle.

Implementation: a separate additive exam_workflow record holds Scheduled, Screened, Exam Begin, Exam End, or Completed; original orders.status retains legacy screening readiness for data compatibility. Incoming unscheduled requests display Ordered in Order queue and do not appear in RIS. Screening hold is a separate blocker, not progression to Screened. Initial screening/start and rescheduling permissions are preserved; instructors may acquire/end during unlocked correction cycles. Completed/Recent retains the existing appointment-date filter rather than introducing a new time-window default. Ended images can be reviewed without mutating saved presentation; instructors entering details or image review automatically lock the study. Reopening is available on recent-list rows so instructors can choose it without first opening and locking the study. A correction reason is required for send-back, appears in workflow history, and does not send an external notification.

Each transition checks fresh membership, ownership, revision, state, and lock within a transaction; begin/resume retains the future-date rule. Acquisition persistence also rejects a workflow revision change during scan generation. Saved scans remain immutable, correction adds scans, and end notes and event timestamps are retained in history. Legacy ready exams with acquisitions migrate to Exam Begin using their earliest saved acquisition time; clear exams without acquisitions migrate to Screened, and unscreened/held exams to Scheduled. Migration never claims an old exam was ended, completed, reviewed, or delivered to PACS. Existing appointments, screening, pixels, selections, identities, sessions, and later locks are preserved.

Clinical hold clearance, procedure changes, full MRI safety clearance, grading, resource scheduling, and the PACS technical delivery contract remain outside this change. Source coverage is conceptual; exact completion, role corrections and review locking above are explicit user decisions rather than source-product defaults. Local checks and publication/browser limitations are recorded in MILESTONE_PLAN.md.

For a task touching one of these areas, explain that the exact behavior remains unspecified or only partly specified in the five supplied reference documents and ask the user for the missing decisions. Existing explicit user decisions do not need to be reconfirmed.

| Area | Clarification needed before dependent implementation |
| --- | --- |
| Resource scheduling | Instructor-selectable isolated/shared scheduling is confirmed. Clarify scanners/rooms, schedule scope, institution/department ownership, horizon, duration, slot interval, capacity, conflicts, maintenance, holidays, overrides, and changes of mode. |
| Additional lifecycle exceptions | The current no-arrival sequence, begin/end/completion prerequisites, review lock, send-back and recent view are resolved and implemented locally in V 1.0.5. No-show, cancellation, late/add-on handling, procedure changes, advanced preparation and other reversal workflows remain unspecified and unimplemented. Do not re-ask the resolved lifecycle decisions. |
| MRI screening and protocol approval | Required questions and documents, escalation responsibilities, how a hold is cleared, allowed exceptions, and which prerequisites block the next stage. Do not invent clinical thresholds or clearance rules. |
| MRI console and image simulation | Actual console parameter ranges and dependencies, image effects, safety limits, sequence behavior, and image-quality validation. None of the five supplied PDFs is a full scanner operation or MRI physics specification. Consult the existing coverage inventory and obtain task-specific requirements. |
| Instructor assessment | Learning objectives, pass/fail rules, rubric weights, correction credit, deliberate error frequency, supervision, and feedback timing. These educational requirements are not defined for MedImagingSim by the source training exercises or answer keys. |
| PACS and integration | Simulated versus live communication, transport and metadata requirements, image reconciliation, acknowledgments, retries, and what constitutes a completed handoff. The references establish the concept, not our technical contract. |
| Results and follow-up | Whether students perform these tasks at all, required reporting content, reviewer responsibilities, completion rules, and scope of simulated follow-up. |
| Privacy and real data | Any requested use of real patient data, live clinical systems, or external messaging is a separate explicit decision; current examples and test cases use fictional patients. |

## Procedure for each new task

1. Read the relevant project requirements and [REFERENCE_INDEX.md](REFERENCE_INDEX.md). Select the primary source and any necessary supporting sources for the requested behavior; inspect their relevant pages. Do not reread all five documents when targeted lookup suffices.
2. Check source fingerprints if files have changed. Refresh affected index entries for additions/replacements; file identity does not prove all topics were reviewed. If a visual diagram or screenshot contains necessary context missing from extraction, inspect it locally without copying it.
3. Classify each material requested behavior as **covered**, **partly covered**, or **not specified** across the applicable references. Cite the actual PDF name and page/section used. Search other relevant indexed sections before declaring a behavior absent. A feature mention or index entry is not a detailed specification.
4. Separate documented concepts, user-confirmed project decisions, and proposed design choices. Explicit user direction governs our simulator. Surface a material conflict rather than silently changing agreed behavior. Already answered questions do not need reconfirmation.
5. For unresolved material details, tell the user what the references leave open and ask focused questions about actors, triggers, data, transitions, validation, exceptions, and acceptance criteria. Await answers for dependent implementation while continuing independent work where useful.
6. Implement an original design within the requested scope. Record resolved gaps here and update the index when needed. Update requirements, milestone notes, and the user guide, increment the version, and perform relevant verification and publishing steps.


November 22, 2026 documentation delivery decision: the user explicitly requested full three-component versioning starting at 1.0.3, next 1.0.4, with 1.0.9 rolling to 1.1.0, and contextual links from the simulator to our guide/role tip sheets in a new browsing context. This project-specific behavior is defined by the user request. The app publishes only the four original generated user-facing documents; source training PDFs and arbitrary project paths remain outside the training allowlist.


November 23, 2026 — V 1.0.4 worklist decision. The user requested an MRN column and automatic appointment-date filtering without a Show appointments button. RAD400 PDF p. 219 supports the distinction between row-selection criteria and display columns; the exact column and interaction are explicit project decisions. Use the saved intake Patient ID / MRN, with Not supplied for older exams lacking it. Preserve existing date eligibility, role/ownership, and institution checks.


## November 23, 2026 — V 1.0.6 independent classroom sessions

The user explicitly requested support for at least 30 concurrent users, each in an independent session. This is a runtime-capacity and isolation requirement, not a new clinical/scheduling transition, and no source-product training configuration is used as a capacity specification. Local V 1.0.6 has passed full 60-student credential/session workflows through the real request handler and a real localhost HTTP server using disposable databases. An extra pre-provisioned second-institution session verifies tenant isolation; no institution-picker behavior is added.

Per-user session tokens, student ownership filters, institution context, expiry, role authorization and token-specific sign-out are retained. Defaults now permit 64 waiting scan plans in addition to a CPU-aware 1–4 worker pool. Validated host overrides allow 1–8 workers and 1–256 waiting plans. Disk SQLite uses WAL with FULL durability and a five-second busy timeout; snapshot readers and consistent online backup are tested alongside writes. One local application service is the classroom configuration. Shared cohort resource availability, multiple replicas, grading and a large institutional pilot remain separate planned work. Browser profiles/tabs are documented accurately: tabs in one profile share identity, and one account shares saved cases even across separate tokens. HTTPS/ThinkPad classroom capacity remains unverified until the host/client exercise in docs/LAN_HOSTING.md is completed.


## November 23, 2026 — V 1.0.7 saved MRI acquisition protocols

Explicit user decisions: instructor/admin can create and save institution-default full MRI protocols; students can save their own versions but never overwrite defaults. Follow-up choices specified an ordered set of multiple sequences and explicit library selection rather than automatic loading. This concerns acquisition-parameter templates, distinct from the clinical preparation/protocolling concepts in the source PDFs. It reuses the simulator's existing supported and validated MRI parameters without adopting a source configuration recipe or adding a clinical safety rule.

Implemented a patient-independent MRI protocols editor/library; 1–32 ordered named sequences; complete supported scan settings per sequence; immutable version payloads; institution-shared staff defaults; creator-private personal versions; source-version provenance; and independently persisted per-case working copies with optimistic revisions. Same names in default/personal namespaces do not collide. Extending a saved name requires the latest base version, while a new name creates a separate branch. Defaults and earlier versions remain unchanged when edited copies or revised defaults are saved. Loading and sequence switching do not run scans. A successful scan retains its plan in an unchanged loaded case copy, without publishing a reusable library version. Existing acquisition metadata/images and PACS presentation remain separate.

Initial instructor acquisition permissions remain unchanged: the library is accessible independently, and case-copy writes require existing Exam Begin/correction eligibility. Future dates, ownership, institution isolation, ended/read-only behavior and review locks remain enforced. Instructors/admins can inspect an accessible case working copy; private personal libraries are not exposed as a staff browse list. Case protocol actions record attributable workflow events. Full protocol use does not impose new exam-end/grading requirements; automatic multi-sequence execution, clinical protocol approval, contrast/safety workflows, additional exam types and scoring remain outside this change.

## V 1.0.8 MRI dictionary decisions — November 23, 2026

The user requested comprehensive research and a populated anatomy/sequence/protocol starting dictionary. Consulted the public primary-source register in [MRI_PROTOCOL_RESEARCH.md](MRI_PROTOCOL_RESEARCH.md), independently of the workflow manuals. Added nine groups/92 regions, 32 sequence/contrast concepts, 58 exam planning references, 43 selected source parameter examples and seven complete original synthetic-brain teaching plans. Selected examples retain strength, units, evidence type, source/revision and review date; absent clinical settings are explicitly unresolved. The older prostate coil workflow, vendor bandwidth conversion, inconsistent cervical T1 FOV units, and adult-directory/pediatric enterography ambiguity are not imported as generic defaults.

Only supported teaching plans can enter the editor/console. Reference-only body/MSK/vascular/cardiac, DWI/ADC, chemical fat suppression, contrast dynamics, gating and prepared 3D methods are not made runnable by relabeling existing brain images. ADC remains a derived map; spatial saturation is not fat saturation. Seven built-ins are available without changing a database. Staff may install missing default names as immutable, institution-scoped versions; matching names are preserved, and students save personal variants. Historical catalog provenance is descriptive, not permission. Existing ownership/review-lock/lifecycle rules apply. No new clinical safety clearance, medication, contrast-dose, RIS orderable or automatic scan execution is introduced.

## V 1.0.9 manufacturer-informed console decisions — November 23, 2026

Reviewed public primary GE SIGNA One descriptions, Siemens Academy/syngo XA61 examination material, and Philips IFU/Workspace documentation; [research/source register](MR_CONSOLE_WORKFLOW_RESEARCH.md) records release differences and limits. Adopted an original four-view workflow, essential parameter reveal, persistent identity, visible sequence/series context, larger dedicated review and explicit finish actions. These are interface design judgments, not claims of vendor equivalence or independent performance superiority.

Workspace views do not create new RIS stages. Existing user-confirmed Ordered→Scheduled→Screened→Exam Begin→Exam End→Completed, no arrival, one-acquisition end prerequisite, independent PACS selection, reopen/send-back rules and instructor-open lock remain unchanged. New in-console end/complete forms invoke the same lifecycle transitions. Hardware prescan/calibration, SAR/weight clearance, pause/stop, actual scouts, unattended execution and archive/MPPS were not invented to imitate vendor controls. The existing fixed brain fixture is head-first supine; orientation/coils are context rather than editable unsupported physical settings.

Sequence progress uses a particular loaded case copy plus index and actual matching plan, not contrast name or legacy image presence. Additive identity keys preserve existing payloads/revisions and avoid historical backfill. Current browser submissions use protocol-revision guards; legacy API scans remain supported without acquisition linkage. Geometry reuse reads only the accessible case and retains target contrast/timing, rejecting incompatible 3D gaps. It creates a draft only. Current fields and print/user guidance are maintained with this release.

## November 23, 2026 — V 1.1.0 physics alignment

The user explicitly requested that all current parameter effects align with image physics, using the supplied mri-physics.pdf and linked sequence articles. PHYSICS pp. 36–46 cover multislicing/contrast/families; pp. 47–58 cover active controls and pp. 59–65 cover artifacts/tradeoffs/tissue examples. Covered: qualitative TR/TE/TI/flip, resolution, averaging, bandwidth, phase-wrap and time relationships. Partly covered: exact tissue/field/coil values, finite RF profiles, FSE ordering and slice-package scheduling. Unspecified: clinical calibration, grading, SAR/hardware acceptance and specialized acquisitions. The original simulator retains explicit idealized assumptions rather than inventing those capabilities.

Implemented analytic-mr-v3 with finite-voxel tissue integration, signed IR components before magnitude, complex Gaussian/Rician receiver noise, voxel/time-dependent sampling SNR, single-peak fat/water readout displacement and GRE phase, 3D partition gain, bounded multislice packaging, FSE tissue-specific phase Fourier modulation and new Echo spacing (ms). Shared browser/server timing checks reject infeasible bandwidth/TE/spacing/train/TR combinations; timing-invalid scan drafts retain safe numeric inputs without acquiring. Existing saved bytes/metadata and immutable protocol versions are preserved; absent legacy FSE spacing resolves to 10 ms at read time. Dictionary revision becomes 2026-11-23.2; existing installed defaults are never overwritten.

Full equations, model overhead choices, limitations and tests are in MRI_PHYSICS_AUDIT.md. Direct Radiopaedia parent/child fetches returned HTTP 402; cached parent and accessible university primary sources were used transparently. Full linked Radiopaedia review remains pending. No change to user-confirmed RIS lifecycle, ownership, instructor locks, PACS selection semantics or manual publication preference.

## November 23, 2026 — standing Larson Lab physics reference

The user explicitly requested a full evaluation/index of https://larsonlab.github.io/MRI-education-resources/Introduction.html and standing use for future MRI principle, pulse-sequence and image-quality changes. Completed the 36-page course inventory and expository review, indexed 360 headings, and checked 367 internal article links with no missing fragments. Evaluation distinguishes the live pages, repository HEAD (5fdaf8e274ac2c694ee50bbadc797616e7d149a6), v2.0 archived DOI and older v1.0 citation-file metadata. Source caveats include inconsistent repetition-count notation, a Philips TFE/FSE alias error, and a suspected two-sided decay display issue; they must be resolved before dependent numerical use.

Use docs/LARSON_MRI_REFERENCE_INDEX.md and docs/larson-reference-pages.json to locate source chapters/sections, then inspect the actual source and conditions. The course is strong for core teaching physics/encoding/quality/reconstruction, partly covers more advanced subjects, and does not fully specify diffusion/flow/MT models, clinical/device safety, calibrated hardware, protocol acceptance or project grading. Notebooks, videos and external tools were not exhaustively executed. No app behavior/version change is part of this reference-only task.
