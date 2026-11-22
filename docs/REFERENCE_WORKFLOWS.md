# Functional reference review and decisions

Reviewed November 22, 2026. This is an original project interpretation and topic index for the five PDFs in `Reference Docs`. Consult the relevant source sections for each new functional task. This summary guides discovery; it does not replace the PDFs or establish that a referenced feature is implemented in MedImagingSim.

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
| Order, appointment, and study progress | RAD100 pp. 55, 61–62, 70, 89–92 | The conceptual distinction is documented. The user confirmed separate appointment/exam progress for our target design. Exact states and correction permissions still need specification for implementation. |
| Check-in and arrival | RAD100 pp. 62, 70, 85 | The meaning of arrival and timing of check-in are documented, including avoiding check-in for tomorrow merely because an appointment exists. Our patient identity checks and arrival actor still need definition. |
| Begin/end exam work and image capture | RAD100 pp. 83–92 | Preparation, explicit start, acquisition outside RIS documentation, performed-order verification, and end documentation are described. Our precise required fields and image-handoff completion contract remain open. |
| Resource scheduling | RAD100 pp. 55–62, 67–70; RAD400 pp. 55–63, 76–87, 299–301 | Availability, duration, pools, additional resources, and permission-sensitive exceptions are documented concepts. Real resource lists, default durations, operating hours, and exception rules remain project decisions. |
| Rescheduling versus changing an order | RAD100 pp. 65–66, 71–72, 90 | The distinction is documented. Existing appointment correction remains supported; cancellation, procedure changes, and approval behavior are not implemented by this review. |
| MRI screening | RAD100 pp. 86–87; RAD400 pp. 295–298 | Screening completion, readiness decisions, alerts, and access control are described. This partially closes the gap; it does not supply a complete MRI safety questionnaire or clearance policy. |
| Completed exams and corrections | RAD100 pp. 94–96, 179–180 | Retrieval and correction after ending are documented. The user chose a separate Completed/Recent view as a design target. Correction limits and history rules remain to be defined. |
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

The user selected the following directions on November 22, 2026. They establish planning intent. They do not mark those features complete or request their implementation as part of this document review.

1. **Full student workflow.** Students should be able to practice order review, scheduling, and technologist responsibilities within their learning role. A separate production-style job role for each task is not currently required. Clarify how instructor supervision, assignments, and permissions apply when implementing a new stage.
2. **Resource scheduling.** Plan scanner/room selection, exam duration, available slots, and conflict handling. Before implementing, clarify resource definitions, operating hours, duration rules, capacity, maintenance, and whether overbooking is ever permitted. Current implementation remains appointment date/time without resource capacity management.
3. **Explicit exam stages.** Plan arrival, preparation/screening, exam start, exam end, and image handoff. Before implementation, agree on each transition's trigger, required information, allowed roles, blocking checks, reversals, and recorded timestamps. Current Ordered / Screening hold / Ready for console behavior remains until deliberately changed.

The subsequent review of RAD100, RAD400, and CLN251–252 produced three additional confirmed targets:

4. **Instructor-selectable scheduling mode.** Plan isolated student availability for individual practice and a shared cohort schedule for collaborative exercises. Define the assignment/session scope and switching rules before implementation. Neither mode may cross institution boundaries or silently expand access to other students' orders.
5. **Separate appointment and exam progress.** Track scheduling/arrival independently from preparation, exam start, and exam completion. Agree on exact states and transition prerequisites when implementing the lifecycle. Keep screening readiness as a distinct concept.
6. **Completed/Recent exams view.** Keep ended exams out of the active technologist workflow while retaining a separate route for review and permitted corrections. Define who can correct, reopen, or reverse an exam and what audit evidence is retained before implementing.

These targets do not change current appointment, worklist, or status behavior as part of this review.

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

For a task touching one of these areas, explain that the exact behavior remains unspecified or only partly specified in the five supplied reference documents and ask the user for the missing decisions. Existing explicit user decisions do not need to be reconfirmed.

| Area | Clarification needed before dependent implementation |
| --- | --- |
| Resource scheduling | Instructor-selectable isolated/shared scheduling is confirmed. Clarify scanners/rooms, schedule scope, institution/department ownership, horizon, duration, slot interval, capacity, conflicts, maintenance, holidays, overrides, and changes of mode. |
| Arrival and exam lifecycle | The sources now explain check-in, begin/end, and correction concepts. Clarify exact simulator states, who marks arrival, no-show/cancellation/late/add-on behavior, preparation requirements, timestamps, and transition reversals. Separate appointment/exam progress and a Completed/Recent view are confirmed targets. |
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
