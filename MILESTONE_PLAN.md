# MedImagingSim milestone plan

**Status:** Milestone 1 implemented as of November 15, 2026. Automated superuser verification passed. Verify the workflow in a browser with the superuser before dedicated role testing. The next implementation milestone is Milestone 2.

**Source:** [Medical Imaging Suite Simulator PRD v1.3](PRD%20Medical%20Imaging%20Simulator.md). This plan reconstructs the earlier planning handoff and adds scope and completion criteria for each milestone.

## Implementation order

MRI is the sole modality for the initial release. Milestones 1–5 deliver the MRI student-to-instructor workflow, hosting and pilot access, and institutional identity and LMS integration. Milestone 6 adds CT as a post-launch enhancement after institutional integration is complete and the MRI release is live.

| Milestone | Deliverable | Status |
| --- | --- | --- |
| 1 | Standalone sign-in, shared RIS sandbox, and base application | Implemented. Browser smoke test pending. |
| 2 | MRI planning console and acquisition | Pending |
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

- Route selected series from the MRI console through the common PACS interface to a study using the original RIS accession. Make repeated send attempts for the same acquisition safe. Build the shared viewer with scrolling, window/level, pan, zoom, and the measurement and annotation tools needed by the initial rubric.
- Open instructor review with the exact selected acquisition, geometry, technical metadata, and student window/level captured at send time. Store subsequent viewer presets and markups separately from the submitted presentation.
- Add instructor cohort and submission views, scenario and assignment creation, rubric ranges and positioning tolerances, manual grading, and student feedback. Complete the RIS workflow with technologist notes and contrast documentation where applicable. Put completed assignments in the instructor review queue.
- **Complete when** an instructor assigns an MRI scenario, a student screens and scans it, sends the selected series to PACS, and completes the exam in RIS. Verify that the instructor sees the exact submitted image and window/level under the original accession, can grade it, and the student can retrieve the feedback.

## 4. MRI hosting and pilot access

- Decide hosting, pilot size, invite and access model, and deployment environments. Estimate storage and image delivery needs during earlier milestones. Resolve image usage rights and review the data inventory before external pilot access.
- Verify role isolation, backups and restore, telemetry, incident ownership, and deployment rollback in the pilot environment.
- **Complete when** invited pilot users can run the approved workflows, access is limited to the intended pilot users, and recovery and rollback have been exercised.

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

At the end of each milestone, record the completion date, delivered scope, acceptance checks and results, decisions, remaining issues, and the first task for the next milestone. Use the first pending milestone and latest handoff as the starting point when asked to proceed.

| Date | Milestone | Handoff |
| --- | --- | --- |
| 2026-11-15 | Planning | Recorded the PRD v1.3 implementation order and acceptance criteria. Start Milestone 1 with stack selection and the initial authentication and RIS sandbox design. |
| 2026-11-15 | Release scope | Limited the initial release to MRI. Moved CT to Milestone 6 after institutional identity and LMS integration and MRI go-live. Milestone 1 remains next. |
| 2026-11-15 | Shared applications | Set RIS and PACS as shared across modalities. Start Milestone 1 with a shared RIS order model and MRI exam configuration. Validate PACS with MRI in Milestone 3 and reuse both applications when CT is added. |
| 2026-11-15 | Milestone 1 | Delivered standalone sign-in, role-specific workspaces, and the shared RIS worklist. Added two fictional MRI scenarios, persistent screening answers, and console eligibility for screened orders. Verified access isolation, launch retries, hold enforcement, sign-out and sign-in, and persistence after reopening SQLite. The execution sandbox denied binding a localhost listener, so the browser smoke test is pending. |
| 2026-11-15 | Superuser verification | Added a locally provisioned admin role with both workspaces and access to all RIS orders. Automated checks passed for workflow access, screening, and migration of existing accounts and sessions. Start browser verification with one admin account, then move to dedicated student and instructor testing. |

### Milestone 1 handoff to the MRI console

- Follow the [local run instructions](README.md) to verify both practice scenarios and the instructor workspace in a browser with one admin account. Then verify dedicated student and instructor roles.
- Start Milestone 2 with the routine brain exam. Connect the MRI console to the ready-order handoff in `src/app.js`, recheck student ownership and screening status server-side, and carry the original RIS accession into acquisition records.
- The simulated state moves from Ordered to Ready for console or Screening hold. Screening is read-only after submission. Console navigation and acquisition begin in Milestone 2.
