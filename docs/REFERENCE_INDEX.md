# Imaging reference topic index

Updated November 23, 2026. Start here for a new functional task, then read only the relevant source pages and any cross-references needed to answer it. All page ranges below are **PDF page positions starting at 1**, not the chapter/page labels printed inside the training companions. For example, RAD100 PDF page 83 is printed as 5 • 4.

This index covers six local documents, including the newly supplied MRI physics reference. Chapter outlines were surveyed for navigation; the workflow, resource scheduling, questionnaires, worklist, configuration, and access sections relevant to MedImagingSim were examined in more detail. A navigation entry alone does not establish that a feature's behavior has been verified. Review the actual cited pages when using them for a task. The documents describe a source product and training configuration, not an implementation specification for our simulator.

## Document aliases

| Alias | File | Pages | Edition / revision shown in source | Start here for |
| --- | --- | --- | --- | --- |
| OVERVIEW | [Overview of Radiant](<../Reference Docs/Overview of Radiant.pdf>) | 6 | Copyright through 2026; no separate revision date identified | Overall workflow and the relationships between ordering, performing, images, and results. |
| SUPPORT | [Imaging Administration Setup and Support Guide](<../Reference Docs/Imaging Administration Setup and Support Guide.pdf>) | 146 | Updated October 30, 2026 | Operational administration, accession handling, audit, performance, validation, and troubleshooting. |
| RAD100 | [RAD100 Radiant Fundamentals (With Answers)](<../Reference Docs/RAD100 Radiant Fundamentals (With Answers).pdf>) | 205 | August 2026 edition; revised October 23, 2026 | End-user ordering, scheduling, screening, diagnostic exam work, and corrections. |
| RAD400 | [RAD400 Radiant Administration (With Answers)](<../Reference Docs/RAD400 Radiant Administration (With Answers).pdf>) | 407 | August 2026 edition; revised March 27, 2026 | Imaging-specific resource, procedure, questionnaire, worklist, and permission configuration. |
| CLN | [CLN251–252 Configuring the Epic End User Clinical/Shared (With Answers)](<../Reference Docs/CLN251-252 Configuring the Epic End User Clinical_Shared (With Answers).pdf>) | 311 | August 2026 edition; revised April 9, 2026 | Shared configuration concepts, contextual workflows, roles, permissions, and user/provider distinctions. |

File sizes and SHA-256 fingerprints are recorded in [reference-sources.json](reference-sources.json). If a PDF is added, removed, renamed, or replaced, refresh its metadata and affected page mappings. Edition names and revision dates describe different attributes; do not assume one source is authoritative merely because its course number or edition label is higher.

## Find a workflow topic

| Requested topic / useful search terms | Read first | Cross-check when needed | What the source helps establish |
| --- | --- | --- | --- |
| Incoming order; demographics; reason; external order transcription | RAD100 pp. 25–30 | RAD400 pp. 107–112, 123–128; OVERVIEW p. 1 | Order-entry concepts and question placement; our completeness criteria remain project decisions. |
| Order versus appointment; appointment versus study progress | RAD100 pp. 55, 61–62, 70 | RAD100 pp. 83–92 | Different records and progress concepts must not be conflated. |
| Scheduling; availability; duration; scanner/room selection | RAD100 pp. 55–62 | RAD400 pp. 55–63, 76–87; SUPPORT pp. 15–18 | Appointment resource/time needs, configurable availability, duration, restrictions, and review. |
| Scanner pools; resource capacity; staff needs; overlap | RAD400 pp. 55–65, 79–86 | RAD100 pp. 60, 67–70 | Resource selection, grouped resources, capacity, and additional resource needs. |
| Recurring availability; blocked time; overbooking | RAD400 pp. 59–63 | RAD400 pp. 299–301; SUPPORT p. 18 | Availability templates and permission-sensitive exceptions. Sample settings are not our defaults. |
| Rescheduling; cancellation; incorrect appointment | RAD100 pp. 71–72 | RAD100 pp. 65–66, 95–96; SUPPORT pp. 19–25 | Correct an appointment separately from changing the ordered procedure. |
| Arrival; check-in; future appointment | RAD100 pp. 61–62, 70, 85 | RAD100 pp. 83–86 | Arrival reflects the patient being present; a future appointment should not be checked in merely because it exists. |
| Inpatient / emergency add-on; urgent exam | RAD100 pp. 84–86 | RAD400 pp. 299–301 | Add-on is a distinct urgent workflow with scheduling/access implications, not a blanket bypass for our app. |
| Clinical protocol; radiologist instructions | RAD100 pp. 63–64, 87 | RAD400 pp. 198–199 | Clinical exam instructions and protocol review; these differ from a scanner's sequence protocol. |
| MRI screening; required responses; proceed / hold | RAD100 pp. 86–87 | RAD400 pp. 295–298 | Screening completion, readiness decisions, alerts, and permission concepts. The full MRI safety policy is still unspecified. |
| Begin exam; patient preparation; allergies; IV; medications | RAD100 pp. 87–89 | RAD400 pp. 138–152, 165–176 | Preparation tasks and an explicit start transition before acquisition. |
| End exam; performed-versus-ordered verification | RAD100 pp. 89–92 | RAD400 pp. 191–199 | Verify what was performed, finish documentation, then progress the exam. |
| Motion / repeats; technologist notes; timing and staffing | RAD100 pp. 91–92 | SUPPORT pp. 62–68, 83–84 | Examples of attributable technical documentation and timing. |
| Contrast documentation; completion prerequisites | RAD100 pp. 89, 92–93 | RAD400 pp. 196–197 | Contrast is a documented workflow event; completion can depend on procedure configuration. Example drugs/doses are not our requirements. |
| Completed / recent exams; corrections; undo permissions | RAD100 pp. 94–96, 179–180 | SUPPORT pp. 83–84; RAD400 pp. 295–301 | Ended exams remain retrievable; correction and reversal are separate, controlled actions. |
| Worklist filters; department; machine; columns | RAD100 pp. 57, 83–86 | RAD400 pp. 216–226; SUPPORT pp. 84–90 | Row criteria differ from displayed information and available actions. |
| Worklist freshness; caching; performance | SUPPORT pp. 52–54 | SUPPORT p. 85; RAD400 pp. 218–220 | Balance useful information, responsiveness, and current workflow state. |
| Questions at ordering, scheduling, and performing | RAD400 pp. 123–128, 165–176 | RAD400 pp. 138–152 | Questions have a purpose and workflow stage; some are shared across an appointment, others apply to one procedure. |
| Conditional questions; dependent answers; required versus recommended | RAD400 pp. 124–128, 168–173 | CLN pp. 113–124 | Question applicability and branching need explicit rules; hidden/stale-answer handling must be specified. |
| Appointment-wide versus exam-specific documentation | RAD400 pp. 138–152, 174–176 | RAD100 pp. 87–92 | Avoid collecting shared information repeatedly while retaining exam-specific details. |
| Institution / department configuration; defaults and exceptions | RAD400 pp. 25–34 | CLN pp. 73–89, 100–101 | Configuration scope and consistent defaults; our tenant architecture is independently designed. |
| Context-dependent workspaces / preparation steps | CLN pp. 113–124, 140–152 | RAD400 pp. 138–152 | Context may affect available documentation; showing a control is separate from authorizing an action. |
| User experience roles versus action permissions | CLN pp. 158–179 | RAD400 pp. 295–301; SUPPORT pp. 7–14 | Workspace configuration and authorization are distinct responsibilities. |
| User account versus clinician/provider versus machine | CLN pp. 189–199 | RAD400 pp. 55–57 | Login identity, clinical attribution, and schedulable equipment are different concepts. |
| Patient / study context; accession identity | SUPPORT pp. 19–25, 86–87 | RAD100 pp. 62, 90; RAD400 pp. 103–104 | Preserve correct patient/order/image relationships and handle mismatches deliberately. |
| Image review; PACS; reading; report finalization | RAD100 pp. 135–150 | OVERVIEW pp. 2–3; SUPPORT pp. 76–83 | Image review, interpretation, and finalization are distinct from exam completion. No complete technical integration contract is supplied. |
| Critical findings; follow-up | RAD100 pp. 139–146, 177–179 | RAD400 pp. 225–226; OVERVIEW p. 3 | Tracked communication/follow-up concepts, outside current MRI acquisition scope unless requested. |
| Quality tracking; audit; operational metrics | SUPPORT pp. 36–49, 62–68, 83–84 | RAD100 pp. 173–180 | Attribution, workflow timing, observations, and correction history. These do not define our student rubric. |
| Procedure content validation; troubleshooting; test cases | SUPPORT pp. 92–101, 133–145 | RAD400 pp. 228–237, 371–383; CLN pp. 145–146, 181–182 | Test realistic outcomes, diagnose configuration, and recheck affected users/workflows. |
| MRI console parameters / image physics / grading rubric | No complete specification in these five PDFs | Project PRD, MRI_CONSOLE_COVERAGE.md, existing user decisions | State the reference gap and obtain task-specific requirements; course answer keys are not our rubric. |

## Broader chapter map

The following entries are navigation aids. Read their relevant body sections before making detailed claims. They do not add those features to the project scope.

| Source | PDF ranges | Topics |
| --- | --- | --- |
| RAD100 | 15–22; 23–52 | Imaging context; entering orders and related clinical work. |
| RAD100 | 53–79; 80–101 | Scheduling; diagnostic exam work. |
| RAD100 | 102–132; 133–153 | Interventional care; interpreting and resulting studies. |
| RAD100 | 154–183; 184–205 | Practice exercises and operational examples; course/resource appendices. |
| RAD400 | 22–52; 53–73; 74–98 | Facility structure; resources and scheduling; visit configuration. |
| RAD400 | 99–120; 121–135 | Ordering/scheduling procedure configuration; order questions. |
| RAD400 | 136–162; 163–188 | Technologist documentation; scheduling/performing questionnaires. |
| RAD400 | 189–213; 214–240 | Performing/resulting configuration; worklist/report configuration. |
| RAD400 | 241–263; 264–291 | Structured documentation and interventional work; charging. |
| RAD400 | 292–306; 307–323 | Imaging permissions; documentation aids. |
| RAD400 | 324–383; 384–407 | Practice, validation, and troubleshooting; course/project appendices. |
| CLN | 22–44; 45–69; 70–109 | Source-system data concepts; information presentation; scoped configuration. |
| CLN | 110–139; 140–155 | Contextual workflows; guided documentation. |
| CLN | 156–172; 173–186; 187–208 | Workspace roles; authorization; users/providers. |
| CLN | 209–230; 231–267 | Data/category concepts; configuration practice. |
| CLN | 268–311 | Resource exploration, extra practice, and course appendices. |
| SUPPORT | 7–25; 25–35; 36–51 | Access/resources/accessions; workstation/control-sheet configuration; quality and other administration. |
| SUPPORT | 52–91; 92–101; 102–132; 133–145 | Optional operational configuration; validation; utilities; troubleshooting/testing. |
| OVERVIEW | 1–3; 4–6 | Core imaging flow and results; specialty/operational context and roadmap discussion. |

## Efficient lookup and maintenance

1. Match the requested behavior to the topic table and select the primary source plus only relevant supporting sources. RAD100 usually answers what an imaging user does; RAD400 explains imaging configuration; CLN explains shared access/context concepts; SUPPORT adds operational details; OVERVIEW provides orientation.
2. Confirm that the selected source has not changed using its metadata/fingerprint. An unchanged source does not need a fresh full-document review. A matching fingerprint establishes the file version, not that every topic has been reviewed.
3. Open the cited PDF pages or extract just that range locally. Follow additional cross-references only if needed. If text extraction loses information in a diagram, table, or screenshot needed for the task, inspect the relevant PDF page visually before concluding the information is missing. Images must not be copied into our product.
4. If the selected pages leave a gap, search the topic/chapter map and relevant headings in the other indexed documents before declaring the behavior absent. Mark partial coverage honestly and ask only the unresolved project-specific questions.
5. Record the documents/pages actually used and confirmed decisions in the task handoff. Update [REFERENCE_WORKFLOWS.md](REFERENCE_WORKFLOWS.md) when an answer changes a gap or decision; update this index for a new topic or source revision.
6. Keep extracted text, rendered pages, and full bookmark dumps temporary. This index contains original topic descriptions and references, not reproduced training exercises, answers, or screenshots.

## MRI acquisition terminology and protocol examples

The five workflow PDFs do not specify a complete clinical scanner protocol dictionary. For the V 1.0.8 research, use [MRI_PROTOCOL_RESEARCH.md](MRI_PROTOCOL_RESEARCH.md) and the source register embedded in `src/mri-dictionary.js`: ACR quality/practice guidance, AAPM physics education, SCMR consensus, OHSU and UW institution examples, and NRG oncology guidance. The catalog distinguishes educational synthesis, selected source examples, quality limits and runnable phantom settings. A reference entry does not establish acquisition-engine support or clinical approval.

## Manufacturer console workflow and presentation

Use [MR_CONSOLE_WORKFLOW_RESEARCH.md](MR_CONSOLE_WORKFLOW_RESEARCH.md) for the V 1.0.9 GE/Siemens/Philips primary-source register, version-specific findings and adopted task/parameter/review principles. It supplements the workflow manuals without copying vendor interfaces or importing unsupported scanner mechanics.

## MRI image physics and parameter dependencies

Use **PHYSICS**, [mri-physics.pdf](<../Reference Docs/mri-physics.pdf>), Evert J. Blink, 75 pages, November 2004 preface / February 2006 PDF metadata. The complete source was surveyed; consult pp. 10–35 for relaxation/encoding, pp. 36–37 for multislicing, pp. 38–46 for contrast/SE/FSE/GRE/IR, pp. 47–58 for TR/TE/flip/TI/averages/matrix/FOV/thickness/gap/phase/bandwidth, pp. 59–63 for artifacts, p. 64 for parameter tradeoffs and p. 65 for example relaxation values. PDF positions start at 1 and printed labels start at 0. Bandwidth/chemical-shift figures were visually inspected. Historical examples and simplified statements are not universal settings; specifically, intrinsic T2 decays across full TE, not TE/2.

[MRI_PHYSICS_AUDIT.md](MRI_PHYSICS_AUDIT.md) records requested Wikipedia/Radiopaedia link exploration, direct Radiopaedia HTTP 402 limitations, accessible primary university cross-checks, all active parameter effects, V 1.1.0 equations/validation and remaining idealizations. This new source partly resolves the old physics gap; it does not specify calibrated scanner hardware, safety clearance, clinical protocol acceptance or grading.
