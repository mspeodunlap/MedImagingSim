# Instructor quick tips

**MedImagingSim V 1.0.9 · November 23, 2026** · [Full guide](../USER_GUIDE.md#instructor-instructions)

**Open:** [Internal test server](https://192.168.0.180:8443/sign-in). Confirm Instructor in the header. You start in Order queue and see requests in your institution.

Use **Training help** in the simulator for the guide section and your role’s tips; links open in a new tab/window without leaving your work.

**Release status:** instructions match local V 1.0.9. Commit/push is being handled by the user; the ThinkPad deployed version and LAN workflow are unverified. **Screenshot refresh pending for V 1.0.9.** Current dictionary, installation and console screenshots are in the full guide. Other workflow screenshots and print/ThinkPad verification remain pending; the guided console workflow was checked in a disposable browser environment.

## Guided console workflow

**Setup → Plan & scan → Review → Finish** changes workspace view, not RIS status. Check the persistent patient/MRN/DOB/exam ribbon. Expand **Choose or manage protocol** to load a starting copy. In planning, **Essential** shows common controls; **All parameters** opens sampling/saturation. Drag an orthogonal localizer to move stack center; numeric angle/geometry controls remain available. **Run scan** acquires only the active sequence, then opens Review.

The rail's **Acquired** means a linked image matches saved settings, not quality approval. A new protocol copy does not inherit progress from older images. In Review, inspect slices/W/L, use **Reset display** or **Copy geometry from displayed series**, and select **Next planned sequence** without auto-scanning. Geometry reuse keeps target timing/contrast and requires a save/acquisition to persist. **Save or edit full protocol** contains personal save controls.

**Finish** summarizes images/selection and reuses the performed-exam confirmation and notes. **End exam**, then **Mark completed** explicitly; both return to Finish. Missing sequences and PACS selection are advisory, and completion does not deliver images. Existing role/review-lock/correction rules remain in force. [Detailed console guide](../USER_GUIDE.md#use-the-guided-console-workspace).

Initial instructor console use is review-only; acquisition remains available only in an unlocked correction cycle. Opening an ended/completed case still locks corrections immediately.

## MRI dictionary and starting protocols

Open **MRI protocols → MRI anatomy and protocol dictionary**. Browse/search 92 regions, 32 sequence concepts, 58 exam references and 43 sourced setting examples. Use **Sequence dictionary** for aliases and unsupported-method labels. Reference values are scanner examples or quality limits, not complete approved clinical recipes. Anatomy listings do not add orderable exams.

Under **Teaching starters**, use **Copy to protocol editor** to customize one, or **Install teaching starters as institution defaults** for all seven complete brain plans. Repeat installation skips existing names, preserving custom defaults and versions. Staff publish new default versions; students save private copies. Built-ins are immediately available in eligible consoles even without installation. References for other anatomy/advanced methods are not executable. [Full dictionary instructions](../USER_GUIDE.md#use-the-mri-anatomy-and-protocol-dictionary).

## Create institution-default MRI protocols

1. Open MRI protocols from the header, without needing a patient or instructor acquisition access. Select New protocol or load the latest Institution default version.
2. Enter Protocol name and each Sequence name. Choose Preset first, then set all supported geometry, timing, sampling/encoding and saturation controls.
3. Add sequence to build the ordered set; Move up/down or Remove sequence as needed. The editor supports 1–32 sequences. These list actions are not a published save.
4. Select Save institution default version. Students in your institution can explicitly load that version from the console as a separate case copy; nothing runs automatically.
5. To revise, load the latest default, keep its name and save again. Earlier versions and existing student copies are unchanged. A stale-version/name conflict requires loading the latest or choosing a new name.

You may also save personal definitions with Save my protocol version. Each personal library belongs to its creator; inspecting an accessible student's case still shows the case working copy and acquired metadata. Library editing never changes a reviewed case, and review-lock/correction permissions remain in force. See [full protocol instructions and current screenshots](../USER_GUIDE.md#create-load-and-save-mri-protocols).

## Concurrent classroom use

Provide one student account per learner and use separate profiles/devices for different signed-in identities. The default build is configured for 30-user classes and has passed a local 60-student workflow exercise; host/LAN capacity still needs validation. Students remain isolated by ownership; your instructor account sees the institution's cases. Simultaneous appointment times do not yet enforce resource conflicts.

## Review a learner's intake work

1. In Order queue, use Created by, patient, exam, and status to identify the request. Open its order number.
2. Read Review history before intervening. Inspect Original order as received to compare the incoming details with corrections.
3. Check demographics, requested exam, reason, and intended appointment date/time against the exercise. A nonblank value can still be wrong.
4. If your teaching plan calls for intervention, Return for missing information or correct the supplied details and Save corrections. Your actions are recorded under your own account.
5. To schedule, enter date/time, verify all three completeness categories, and select Schedule order. You return to Order queue. Ownership stays with the original creator.
6. Open RIS worklist, choose the appointment date, and select the patient to inspect active exam progress. Use View completeness review for intake evidence.

## Review and return a study

1. Open Completed/Recent and select the study's appointment date. Confirm Owner, patient, accession, and stage. Exam End and Completed cases appear here; unscheduled requests remain in Order queue.
2. Select a patient or open its image-review URL. **Opening an ended/completed study locks corrections immediately.** You do not need a Mark reviewed button. Listing rows or inspecting intake history does not lock it.
3. Inspect screening, the performed-exam confirmation, Technologist notes, Workflow history, and Review images. Preview slice/window/level changes do not alter the saved PACS selection. The lock persists after sign-out/restart.
4. If corrections are needed, enter Correction reason (required, up to 4,000 characters), then select Send back for correction. Only instructors can release this review lock; admin cannot override it.
5. The case unlocks and returns to Exam Begin in RIS worklist on its appointment date. The student can read your reason, add scans, revise notes, end, and complete again. Opening an active correction does not relock it. Opening it after the next end/completion locks it again.

Before review, all roles can Reopen for correction on an accessible ended/completed study. **As instructor, use the row's Reopen for correction action before opening the patient**, because opening locks it. Reopening preserves scans, selection, notes, and history; it requires end verification and completion again. Instructors can acquire and end during an unlocked correction cycle, but cannot submit initial screening, perform initial Begin exam, or reschedule.

**Progress:** Ordered → Scheduled → Screened → Exam Begin → Exam End → Completed. No arrival action. End requires a saved acquisition and performed-exam confirmation; notes are optional. Mark completed is an explicit RIS action and does not transfer images to PACS. The main guide has [full lifecycle instructions](../USER_GUIDE.md#end-complete-review-and-correct-an-exam).

## Plan a session

- Give each learner their own account, the server address, fictional case details, expected appointment date, and stopping point.
- Expect complete Quick orders 80% of the time and incomplete ones 20%, independently. Appointment date/time are always selected separately.
- Use the persisted intake history for review. Observe the student's screen for scan-planning exercises and ask them to explain changes and selected images.
- Record the request/accession when discussing a problem so everyone refers to the same case.

## Current boundaries

| Available today | Planned / not available yet |
| --- | --- |
| Institution intake review and scheduling | Assignment dispatch and automatic grading |
| Institution RIS and Completed/Recent date filters, exam and image review | Full PACS transfer |
| Manual/Quick order creation; correction-cycle console access | Initial screening/start and rescheduling for instructors |
| Instructor review lock and Send back for correction | Cohort setup and isolated/shared scheduling controls |

Instructor home links to Completed/Recent. Assignment dispatch and grading remain planned. Instructor accounts do not have the Practice scenarios menu; students/admins do. Do not bypass a screening hold to continue a lesson.
