# Instructor quick tips

**MedImagingSim V 1.0.5 · November 23, 2026** · [Full guide](../USER_GUIDE.md#instructor-instructions)

**Open:** [Internal test server](https://192.168.0.180:8443/sign-in). Confirm Instructor in the header. You start in Order queue and see requests in your institution.

Use **Training help** in the simulator for the guide section and your role’s tips; links open in a new tab/window without leaving your work.

**Screenshot refresh pending for V 1.0.5.** Current screen images are omitted until browser capture is available.

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

Screen images are pending refresh for V 1.0.5; browser/LAN verification remains pending.

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
