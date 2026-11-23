# MR console workflow research and design decisions

**Local V 1.0.9 · Reviewed November 23, 2026**

This assessment compares public GE, Siemens and Philips materials and records the resulting MedImagingSim changes. Scanner family, software release, licenses and local configuration change the actual interface. A feature described for one product/release is not assumed to exist on every scanner bearing that manufacturer's name. Our console uses original layouts and terminology; vendor screenshots, proprietary protocol files and training exercises are not shipped in the application.

## Manufacturer findings

| Manufacturer / reviewed interface | Presentation and workflow evidence | Design principle adopted |
| --- | --- | --- |
| GE SIGNA One | Official upgrade material describes Express and Classic views: fewer common parameters versus fuller expert controls. GE's 2022 introduction describes visual progress cues and assistance with the next action. The current workflow page links worklist/patient preparation, scanning and subsequent review. | Reveal essential controls first, keep advanced controls available, retain patient context, and make the next action explicit. These are our design judgments, not claims of reproducing GE automation. |
| Siemens syngo / Dot / XA61 | Academy material separates the measurement queue, graphical planning and parameter cards. Its example proceeds from registration/program choice through localizer acquisition, slice prescription, measurement and subsequent sequences. The XA61 operator manual emphasizes identity/orientation validation before an examination. | Keep an ordered sequence rail beside planning, make the active sequence obvious, and separate protocol definitions from acquired evidence. Preserve identity/orientation context while the user changes tasks. |
| Philips Ingenia / Elition / MR Workspace | The 2018 IFU separates Plan and Review, with three planning viewports and parameters versus greater image-review space. The 2021 IFU separates scan overview, thumbnails, patient release and exam completion; its completion also includes configured archive/MPPS behavior. Current Workspace material emphasizes image space, parameter reveal and exam guidance. | Give planning and review dedicated space, retain the sequence/series overview, and distinguish image acquisition, saved image selection, exam end and RIS completion. We do not adopt archive/MPPS behavior that our simulator cannot perform. |

GE's older MR Excite HD Quick Steps PDF was found on the official site, but direct retrieval failed. We did not treat a third-party rehosted operator manual as a verified primary source, or infer detailed GE prescan/stop semantics from a product brochure. Recent GE material supports the interface principles above, not a complete operator procedure for every generation.

## Start-to-finish task assessment

The table is an original synthesis of the reviewed workflow concepts and our existing confirmed RIS rules. It is not an instruction for operating a clinical scanner.

| Technologist task | Console support in V 1.0.9 | Boundary |
| --- | --- | --- |
| Select the correct scheduled patient | Enter from the scoped RIS case; persistent patient name, MRN, DOB, age, exam, accession and RIS stage | Patient data are inherited rather than re-entered. Missing legacy identifiers say Not supplied. |
| Check preparation / setup | Setup shows the indication, recorded clear screening, Exam Begin timestamp and fixed head-first-supine brain/head context | Real positioning, coils, weight/SAR calculations, monitoring and device clearance are not simulated. No new safety checklist substitutes for local screening. |
| Choose and adapt a protocol | Built-in teaching starters, institution defaults and personal versions; compact expandable library/save controls | Student copies cannot replace staff defaults. Loading a different protocol replaces the working copy, not images. |
| Inspect localization and prescribe slices | Three larger localizers; orthogonal-view drag adjusts stack center; numeric plane, angle, FOV, slices, thickness and gap remain available | Fixed reference localizers are precomputed, not a newly acquired scout. Dragging moves the supported stack-center axis, not arbitrary 3-axis anatomy registration. |
| Set contrast and sampling | Essential geometry/timing view, All parameters reveal, model-time estimate and unsaved-draft indicator | Unsupported pulse sequences remain reference-only. The estimate is not a real-time countdown or scanner safety prediction. |
| Acquire and progress through sequences | One explicit Run scan; actual generation status, duplicate-submit protection and automatic return to Review. Next planned sequence opens its plan without scanning | No unattended sequence execution or fake prescan/pause/stop controls. Shared classroom compute can be busy. |
| Inspect images and decide on repeats | Larger dedicated review image, acquisition history, slice navigation, W/L, Reset display, review prompts and geometry reuse | Quality judgment is the learner's; Acquired does not mean quality-approved. Repeats retain original series. |
| Finish documentation and workflow | Finish summarizes acquisitions, PACS selection and RIS stage; existing performed-exam confirmation and notes; End exam then explicit Mark completed | All-sequence completion and PACS selection remain advisory, consistent with confirmed user rules. Completed neither transmits images nor acknowledges PACS delivery. |
| Resume/correct and instructor review | Existing RIS reopen/send-back workflow; ended studies have read-only image controls; instructor opening locks corrections | Only an instructor send-back releases the review lock. The new navigation does not bypass it. |

## Implemented interaction design

**Setup → Plan & scan → Review → Finish** is workspace navigation, separate from RIS lifecycle status. Switching these views changes neither lifecycle nor saved data and preserves the current unsaved form. The patient ribbon remains visible on desktop. Essential controls omit irrelevant timing fields; All parameters opens sampling and spatial saturation. These modes change visibility only. Narrow layouts stack panels without hiding controls.

The sequence rail shows Planned, Acquired or Settings changed. Draft changes are labeled separately. Evidence requires the exact loaded case-copy identity and sequence index, with the latest linked acquisition matching all supported saved settings. Matching a preset name is insufficient. Reloading a protocol creates a new case-copy identity. Legacy acquisitions remain available in history but are not backfilled as proof of acquiring a protocol sequence. The count is not grading or a quality-approval stamp.

Each new acquisition from the current console records a server-derived protocol context. Optional revision checking preserves old API compatibility: legacy scan requests without a protocol revision still work, but do not create sequence-progress linkage. A stale revision from a current console is rejected before a new scan, while replaying an already saved scan key remains idempotent. Case-copy changes during generation do not overwrite a newer plan.

**Copy geometry from displayed series** copies plane, angle, center, FOV, slice count/thickness/gap and phase geometry into the current draft. Target contrast, TR/TE/TI, flip, echo train, matrix, averages and bandwidth are retained. Source series must belong to the accessible case. Incompatible geometry, such as a nonzero gap into a 3D GRE target, is rejected. No library version, case copy or image changes until the user saves settings or acquires. Selecting an old series for review otherwise leaves the draft alone.

**Reset display** restores preview W/L 210/105 and is temporary until Save PACS selection. The displayed-series source for geometry copying follows review changes. End/complete forms reuse existing transactional lifecycle guards and optionally return to the Finish view; they do not add a separate completion model.

## Technical and verification record

An additive `instance_key` column on `mri_exam_protocols` identifies each loaded case copy. Existing payloads, revisions, saved library versions and image bytes are preserved; existing copies receive identity keys without fabricated acquisition linkage. Acquisition protocol context is stored in the existing parameters snapshot. Model-time estimation is shared by the browser and generator. Scope, fresh membership, correction permissions, review locks and optimistic revisions remain enforced on writes.

Automated additions exercise sequence evidence and changed settings, reload/reset semantics, legacy migration, idempotent/stale scans, geometry contrast preservation and cross-case denial, and guarded console End/Completed flow without PACS delivery. Browser verification uses only a disposable database and fictional users. Captures document our own interface; vendor images were not copied. Live ThinkPad/LAN capacity, educator usability validation, and full print layout remain separate release checks.

## Primary source register

All links below were accessed November 23, 2026. Older IFUs establish behavior for the named release; current product pages describe advertised features, not comparative performance evidence.

| ID | Primary source | Use / limitations |
| --- | --- | --- |
| GE-1 | [SIGNA One Interface Upgrade](https://www.gehealthcare.com/en-us/products/magnetic-resonance-imaging/signa-continuum-upgrade-options/signa-one-interface-upgrade) | Express/Classic and platform workflow; page limits availability to selected systems/markets. |
| GE-2 | [GE SIGNA Experience introduction, 2022](https://www.gehealthcare.com/en-us/about/newsroom/press-releases/ge-healthcare-introduces-signa-experience-with-ai-and-deep-learning-for-mri-scanning) | Visual guidance and next-action design descriptions. Manufacturer claims are not independent usability measurements. |
| GE-3 | [SIGNA One workflow solutions](https://www.gehealthcare.com/en-us/products/magnetic-resonance-imaging/signa-one-mri-workflow-solutions) | Planning-to-scanning workflow scope; hardware/AI features not transplanted into the simulator. |
| SI-1 | [Siemens Academy: MR Basic syngo](https://academy.siemens-healthineers.com/_/en-us/mr-basic-syngo/) | Exam Task Card, queue, GSP/parameter cards and routine scan example. Older example, not every XA version. |
| SI-2 | [DotGO workflow](https://www.siemens-healthineers.com/en-us/magnetic-resonance-imaging/technologies-and-innovations/dotgo-workflow) | Protocol management and guidance concepts; automation/product claims are not simulator features. |
| SI-3 | [syngo MR XA61: MR Examination and Review](https://doclib.siemens-healthineers.com/rest/v1/view?document-id=1033243) | Printed pp. 65–66: starting from Scheduler and identity/orientation validation; manual identifier MR-05061U.630.21.02.24. |
| PH-1 | [Philips Elition IFU, 2018-04](https://www.documents.philips.com/assets/Instruction%20for%20Use/20181214/51fcb64f33e84d9dbd73a9b6014ed766.pdf?feed=ifu_docs_feed) | Printed pp. 398–399: Plan/Review, Current ExamCard/list and thumbnail views. |
| PH-2 | [Philips Ingenia IFU, 2021-02](https://www.documents.philips.com/assets/Instruction%20for%20Use/20210505/40dcea0e77ed48699b12ad1f00fb2b76.pdf?feed=ifu_docs_feed) | Printed pp. 244–246: overview and release/complete/discontinue distinctions. Real archive/MPPS semantics are explicitly not our RIS semantics. |
| PH-3 | [Philips MR Workspace](https://www.usa.philips.com/healthcare/technology/mr-workspace) | Image-centered interface, essential parameter reveal and guidance. Automation and throughput percentages were not used as promises or design acceptance criteria. |

## Local verification

The complete regression suite passed 37/37 tests with no skips, including 60-user isolation exercises and targeted protocol-instance migration, acquisition evidence, stale-revision, geometry-copy and Finish checks. A fictional-data browser walkthrough exercised planning through acquisition, review, end/completion and correction reopening, then confirmed instructor-locked image review. Original screenshots are in the guide and screenshot manifest. ThinkPad/LAN, mobile usability and full print-layout checks remain pending.
