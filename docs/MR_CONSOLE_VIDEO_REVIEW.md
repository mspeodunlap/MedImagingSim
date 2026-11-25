# MRI simulator video review and candidate enhancements

**Reviewed November 23, 2026 · Application baseline V 1.1.0, commit 967ed96. Research only; the candidates below are not implemented by this review.**

## Source and evidence

**VIDEO-CORSMED-01:** [Corsmed MRI Simulator in 6 min – Like a Real MRI Scanner on Your Laptop](https://www.youtube.com/watch?v=aDVdH8Hv9UE), published by **Corsmed – MRI Simulator for Colleges & Clinics**, February 26, 2026; duration **6:18**. The description identifies presenter Erik Jacobsson as CEO/co-founder. This is a vendor demonstration, useful for observing functionality and teaching interactions, not independent validation of its simulation accuracy or clinical equivalence.

Reviewed the complete available English auto-caption narrative, the expanded description and chapter list, and sampled console/result frames across the demonstration. Visual checkpoints included approximately 0:37, 0:54, 1:15, 1:53, 2:04, 2:31, 3:09, 3:25, 4:24, 5:02 and 5:54. This was a transcript-assisted visual review, not continuous frame-by-frame viewing or hands-on testing of Corsmed. Auto-captions contain obvious name/terminology errors; timestamps are approximate entry points. Ads and suggested videos were excluded. No competitor screenshots, transcript, patient examples, assets or code are included in the project.

The user's goal is functional depth, credible parameter-to-image behavior and a clean, intuitive console. **Do not copy the demonstrated interface.** Recommendations below are original project proposals, grounded in that goal and our existing capabilities.

## Timestamped topic index

| Entry | Video interval | Observation or narrated claim | Project relevance |
| --- | --- | --- | --- |
| V01 | [0:00–0:26](https://www.youtube.com/watch?v=aDVdH8Hv9UE&t=0s) | Narration frames simulation as repeatable practice without clinical scheduling pressure. | Preserve quick experimentation and durable student-owned work. |
| V02 | [0:27–0:50](https://www.youtube.com/watch?v=aDVdH8Hv9UE&t=27s) | Knee localizers, sequence/protocol selection; narration describes whole protocols, subsets and raw sequences. | Improve reuse while distinguishing executable plans from reference-only entries. |
| V03 | [0:51–1:19](https://www.youtube.com/watch?v=aDVdH8Hv9UE&t=51s) | FOV, matrix, timing and slice placement are adjusted before save/run. | Direct planning, explicit draft state and immediate validation. |
| V04 | [1:20–1:53](https://www.youtube.com/watch?v=aDVdH8Hv9UE&t=80s) | Sequence cloning supports matrix/thickness experiments; derived pixel size is highlighted. | Fast duplication and before/after parameter evidence. |
| V05 | [1:54–2:15](https://www.youtube.com/watch?v=aDVdH8Hv9UE&t=114s) | Acquired images are compared for detail, partial volume and noise. | Comparison should be a first-class learning task. |
| V06 | [2:16–2:50](https://www.youtube.com/watch?v=aDVdH8Hv9UE&t=136s) | Longer TR/TE changes contrast; narration distinguishes scanner duration from simulation runtime. | Keep image effects causal and the two clocks explicit. |
| V07 | [2:51–3:11](https://www.youtube.com/watch?v=aDVdH8Hv9UE&t=171s) | Higher ETL is presented as faster, with image-quality tradeoffs. | Explain effective TE, spacing, echo order and model limitations. |
| V08 | [3:12–3:41](https://www.youtube.com/watch?v=aDVdH8Hv9UE&t=192s) | Scout views are restored, prescription is angled, and an oblique result follows. | Planning geometry must drive sampling, not merely overlays. |
| V09 | [3:42–4:45](https://www.youtube.com/watch?v=aDVdH8Hv9UE&t=222s) | Broad accuracy claims accompany an artifact montage. | Treat artifacts as model-development work with testable causes. |
| V10 | [4:46–5:42](https://www.youtube.com/watch?v=aDVdH8Hv9UE&t=286s) | Anatomy, field/gradient options and libraries are shown; narration advertises extensive sequences and 3D planning. | Separate dictionary breadth from supported anatomy/hardware physics. |
| V11 | [5:43–6:18](https://www.youtube.com/watch?v=aDVdH8Hv9UE&t=343s) | Educator/student-management screens accompany analytics, grading and cohort claims. | Future instructor evidence tools; no demonstrated rubric or authorization contract. |

## Current-state comparison

Cross-checked against [console coverage](MRI_CONSOLE_COVERAGE.md), [current guide](USER_GUIDE.md), [manufacturer assessment](MR_CONSOLE_WORKFLOW_RESEARCH.md), [physics audit](MRI_PHYSICS_AUDIT.md) and the current view/editor/physics code. Documentation describes local implementation, not tester deployment.

| Capability | V 1.1.0 status | Useful next improvement |
| --- | --- | --- |
| Guided examination | Setup / Plan & scan / Review / Finish, persistent identifiers, sequence rail and guarded RIS transitions exist. | Retain this original task structure; reduce steps inside it. |
| Reusable protocols | Immutable institution defaults, personal versions, explicit case copies and full ordered editor exist. | Add sequence duplication and selective insertion without a full library round trip. |
| Experiments and repeats | Repeat acquisition, stored settings, history and geometry-only reuse exist. | No dedicated one-action sequence clone or simultaneous acquired-series comparison. |
| Live feedback | Voxel dimensions, relative sampling SNR, readout, fat shift, packages and estimated scan duration exist. | Add a baseline delta and concise explanation; avoid duplicating existing metrics. |
| Slice planning | Three fixed brain localizers, through-plane center drag, plane and one-axis angle exist. | In-plane translation, rotation/double-oblique prescription and multiple stacks are incomplete. |
| Image review | One displayed series, slice navigation and window/level exist. | Add comparison, pan/zoom and clear geometry compatibility. |
| Image physics | Analytic SE/IR/spoiled GRE, FSE phase weighting, finite voxels, magnitude noise, wrap and single-peak fat effects exist. | Extend validated mechanisms; do not replace physics with cosmetic effects. |
| Scope | Brain fixture with fixed 1.5 T frequency assumption; dictionary contains many reference-only anatomies/families. | New anatomy, coils, fields and advanced acquisitions need substantive models and data. |
| Education | Ownership, histories and instructor lock/send-back exist. | Cohort assignment, parameter-experiment analytics and grading remain planned. |

## Candidate backlog and acceptance criteria

Priorities are recommendations, not implementation authorization or promised release dates. **P1** offers the strongest near-term learning/workflow value; **P2** adds deeper acquisition capability; **P3** requires a broader model or educational specification.

| ID / priority | Proposed functionality and original interaction | Acceptance evidence before delivery |
| --- | --- | --- |
| C01 / P1 | **Duplicate the current sequence into a new working plan.** Preserve the source and all supported settings, name the new draft clearly, and make changed fields easy to find. Allow selective insertion of supported library sequences into the working protocol. V02/V04. | Clone acquires nothing, carries no acquired/approved state, does not alter the source/default, respects the 32-sequence limit, stale revisions, ownership and review locks. Unsupported reference families cannot be inserted as executable plans. |
| C02 / P1 | **Compare two acquired series in Review.** Choose a baseline and comparison from this case, with an original compact settings-difference summary. Offer linked display controls only where appropriate. V05/V06/V07. | Enforce case/institution access. Preserve stored pixels. Explain different geometry; equal slice numbers do not imply matching anatomy. Match physical location when possible; otherwise unlink slice navigation. Label independent versus linked W/L and resampling. A consistent display scale must not hide noise or fabricate resolution. |
| C03 / P1 | **Explain the effect of a parameter change.** Compare current metrics with a saved plan/acquisition, showing voxel/time deltas and qualified tradeoff text near the edited field. V03/V04/V07. | Browser/server agree on units and metrics; changing a preset must not silently erase an intended contrast experiment. Relative sampling SNR stays distinct from tissue signal/CNR. Invalid drafts remain correctable and cannot acquire. Give keyboard-accessible inline messages rather than relying on color or hover alone. |
| C04 / P1 | **Make acquisition state and the two clocks explicit.** Distinguish estimated scanner acquisition duration, waiting for shared compute, generating and saved result. V06. | Do not present a simulated duration as elapsed compute time or invent a scanner countdown. Keep duplicate-submit protection and source-version linkage. A failure never marks a plan acquired. Cancellation/pause needs an actual worker/state design before a control is offered. |
| C05 / P2 | **Extend graphical prescription in our Plan & scan view.** Add in-plane center movement, FOV/stack handles, rotation and eventually double-oblique planning, with matching numeric controls and reset/undo. V03/V08. | Use one patient-coordinate transform for overlays, sampling and saved metadata. Verify orientation, translation, angle, coverage, slab/stack bounds and reload round trips using asymmetric synthetic landmarks. Numeric/keyboard alternatives must cover every drag action. Existing acquisitions remain immutable. |
| C06 / P2 | **Add original parameter experiments and artifact lessons.** Start with controlled resolution/thickness, averaging/BW, phase-wrap and FSE ETL/spacing comparisons; ask for a prediction and retain the result. V05/V07/V09. | Change one variable when teaching causality; disclose unavoidable coupled changes. Add mechanism-specific tests before adding motion ghosts, Gibbs or susceptibility controls. Exercises must not infer quality approval from acquisition success or reuse vendor scenarios/answers. |
| C07 / P3 | **Broaden anatomy and hardware deliberately.** Prioritize a reviewed additional anatomy, then field/coil context and supported sequence families in stages. V10. | Establish lawful data provenance, tissue properties, orientation, anatomy-specific planning and outcome tests. Field/coil controls require modeled relaxation/off-resonance/sensitivity/noise effects and explicit limits; changing a label or multiplying brightness is insufficient. Keep reference-only recipes visibly separate. |
| C08 / P3 | **Build instructor evidence views before automated grading.** Show student parameter revisions, repeat reasons, comparison results and correction cycles; later connect assignments/cohorts. V11. | Define learning outcomes, permissions, retention and rubric with the instructor first. Preserve institution isolation and instructor-open lock/send-back semantics. Do not automatically grade a student from a pixel appearance, runtime or sequence-count badge. |

Recommended first package: C01–C04. It makes existing physics easier to explore before expanding the engine. C05 is the next major console capability because planning should agree with the acquired anatomy. C06 can begin with supported effects; unimplemented mechanisms stay separate. No unattended protocol execution is implied by these proposals.

## Accuracy assessment and physics checkpoints

The video's useful teaching examples are not a numerical conformance specification. There is no disclosed full acquisition/reconstruction configuration, tissue truth, reference dataset or uncertainty analysis sufficient to certify all results. Its comparisons with other simulators and claims of scanner equivalence remain vendor claims. A formula-based analytic model can represent valid physics within stated assumptions; using a more detailed solver alone does not establish fidelity.

The following primary teaching sections were read for this review, alongside the existing audit. Use [the Larson index](LARSON_MRI_REFERENCE_INDEX.md) for source caveats, including its repetition-count inconsistency and Philips TFE alias error.

| Topic | Assessment and implementation consequence | Primary cross-check |
| --- | --- | --- |
| Matrix / FOV | At 150 mm FOV, 100, 200 and 300 acquired samples imply nominal spacings 1.5, 0.75 and 0.5 mm. This is acquired sampling, not proof that all detail at that scale is resolved. Enlarging the display or interpolating cannot create acquired detail. | [L18: Spatial resolution](https://larsonlab.github.io/MRI-education-resources/FOV%20and%20Resolution.html#spatial-resolution). |
| Thickness / noise | Smaller voxels reduce signal volume; sampling duration, bandwidth and sequence/tissue signal also matter. A noise comparison requires controlled geometry, acquisition and display conditions. Keep our sampling-only SNR label qualified; changing matrix and thickness together is not a one-variable test. | [L19: SNR dependencies](https://larsonlab.github.io/MRI-education-resources/Signal%20to%20Noise%20Ratio.html#snr-dependencies). |
| ETL / timing | More echoes per repetition can reduce required shots; echo spacing and effective TE matter. The narrated 35-second example is not a universal ETL-30 duration or a default for our engine. ETL 1 in the demonstration must not bypass our supported-family validation. | [L22: Multiple spin-echo sequences](https://larsonlab.github.io/MRI-education-resources/Fast%20Imaging%20Pulse%20Sequences.html#multiple-spin-echo-sequences-rare-fse-tse); [current timing contract](MRI_PHYSICS_AUDIT.md). |
| ETL / quality | Long trains can cause tissue-dependent T2 modulation and blur. Do not implement “ETL up = apply generic blur and noise.” The video's lower-SNR statement needs sequence, ordering and signal assumptions; it is not a universal rule. Our current sampling metric excludes FSE tissue attenuation and is not measured image SNR. | [L22: Tradeoffs](https://larsonlab.github.io/MRI-education-resources/Fast%20Imaging%20Pulse%20Sequences.html#tradeoffs); [L24: K-space weighting](https://larsonlab.github.io/MRI-education-resources/Point%20Spread%20Function%20Analysis.html#k-space-data-weighting). |
| Obliquity / artifacts | Prescription must change the sampled anatomy. Artifact appearance needs its causal acquisition/field mechanism, not a decorative overlay; a montage alone does not verify parameter sensitivity. | [L24: MRI signal equation](https://larsonlab.github.io/MRI-education-resources/Point%20Spread%20Function%20Analysis.html#mri-signal-equation); our geometry and physics contracts. |

For each future physics enhancement, define units, model domain, conserved/reference quantities, controlled comparisons, tolerances and stored engine metadata before UI delivery. Keep old acquisitions unchanged. Full Bloch/EPG, calibrated coil/field behavior, motion, clinical safety/SAR and advanced sequences remain separate engineering requirements.

## Ease-of-use and original-design direction

Keep our four task views and identity ribbon. Prefer one explicit duplicate action, an understandable draft-to-acquired transition and a short parameter/result comparison over a wholesale layout replacement. Retain essential/advanced disclosure and put units, current value and validation together. Optional teaching explanations should not obstruct routine scanning.

Do not reproduce the video's panel arrangement, tab taxonomy, colors, icons, control styling, wording, library descriptions, anatomical examples or branded terminology. Start design work from our users' tasks and existing components. The transferable relationships are localizer → prescription → acquisition → review, and parameter change → predicted tradeoff → acquired evidence.

Proposed usability exercise, not yet performed: ask students and an instructor to load a protected default, make a private variant, duplicate a sequence, change one parameter, acquire/compare, explain the tradeoff and finish the case. Observe wrong-sequence edits, unintended setting resets, lost drafts, help requests and completion time. Include keyboard-only operation and a narrow display. Set success thresholds with the educator after a baseline exercise; this review provides no measured usability scores.

## Scope retained for subsequent work

The video does not resolve our RIS/safety/ownership policy. Retain **Ordered → Scheduled → Screened → Exam Begin → Exam End → Completed**, no arrival step, explicit completion independent of PACS transfer, default protection, student ownership and instructor review locking/send-back. Hardware calibration/monitoring, automated queue execution and a grading rubric cannot be inferred from the video.

This review changes references and candidate planning only. Application code, available controls, user-guide steps, screenshots and V 1.1.0 remain unchanged. See [reference decisions](REFERENCE_WORKFLOWS.md) and [milestone handoff](../MILESTONE_PLAN.md).


Subsequent direction: the user adopted the phantom/physics/generated-raw-data approach in [MRI-ENGINE-001](REALTIME_MRI_ENGINE_PLAN.md). Use that deferred engine plan for architecture, backend, fidelity, capacity and implementation sequencing; the candidates here remain the interface/learning backlog.
