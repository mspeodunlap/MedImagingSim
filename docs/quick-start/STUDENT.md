# Student quick tips

**MedImagingSim V 1.0.6 · November 23, 2026** · [Full guide](../USER_GUIDE.md)

**Open:** [Internal test server](https://192.168.0.180:8443/sign-in). Check V 1.0.6 below the sign-in box, sign in with your supplied account, and confirm Student in the header.

Use **Training help** in the simulator for the guide section and your role’s tips; links open in a new tab/window without leaving your work.

**Release status:** instructions match local V 1.0.6. Commit/push is being handled by the user; the ThinkPad deployed version and LAN workflow are unverified. **Screenshot refresh pending for V 1.0.6.** Current screen images are omitted; browser/print verification remains pending.

## Concurrent classroom use

Use your own student account and browser profile/device. Tabs in the same profile share sign-in; a shared account shares saved cases. Other students cannot access your cases. If the scanner is busy, wait briefly and retry Run scan; sign-out affects only your current session.

## From order to completion

1. **Order queue:** select Quick order, use Manual order, or create a Practice scenario. Open the request number.
2. **Review:** check first/last name, MRN, DOB, recorded sex, exam, and reason. If details are missing, use Return for missing information. Correct only from the exercise data and Save corrections.
3. **Schedule:** choose the intended appointment date/time in the displayed timezone and check all three completeness confirmations. Schedule order returns to Order queue.
4. **RIS worklist:** find the appointment date by choosing the date (the list refreshes automatically) or selecting Today. Confirm patient, MRN, exam, and accession.
5. **Screen:** open the patient; read the history; answer all three questions. Yes or Unsure causes a hold. Submitted answers are read-only.
6. **Begin and scan:** clear screening changes the stage to Screened. Select Begin exam, then Open MRI console. Confirm Patient and exam. Choose Preset first, then geometry/timing. Run scan. No arrival action is required.
7. **Review:** use Slice and Window width/level. Choose an earlier series from Acquisition history or drag it into Series preview.
8. **Select:** Save PACS selection and check the Selected for PACS series number and W/L. This saves a selection, not a PACS transfer or graded submission.
9. **End:** Back to RIS order → Exam workflow. Confirm Performed exam matches the ordered exam, add optional Technologist notes (up to 4,000 characters), and select End exam. At least one saved acquisition is required.
10. **Complete:** find the study in Completed/Recent on its appointment date and select Mark completed. Completed is a RIS status; no PACS transfer is performed or required.
11. **Correct:** before instructor review, Reopen for correction returns the case to Exam Begin. Add scans or update end notes, confirm the performed exam again, then End exam and Mark completed again. Saved history remains.

**Progress:** Ordered → Scheduled → Screened → Exam Begin → Exam End → Completed. Unscheduled orders stay in Order queue; ended studies leave the active RIS worklist. Completed/Recent filters by appointment date.

**Review lock:** an instructor opening an ended/completed study locks all corrections. Only an instructor can Send back for correction with a reason. After send-back, read Workflow history and resume from Exam Begin. Review images is read-only for saved data; preview window/level changes are temporary. No grading is assigned yet.

See the [detailed lifecycle steps](../USER_GUIDE.md#end-complete-review-and-correct-an-exam).

## Remember

| Situation | Quick action |
| --- | --- |
| Exam missing | Check the RIS date, account, and whether it was scheduled. |
| Exam disappeared after ending | Use Completed/Recent and its appointment date. |
| Corrections locked | Ask the instructor to Send back for correction; admin cannot release the review lock. |
| Wrong appointment | Before screening, expand Reschedule appointment, confirm date/time, then Save appointment. |
| Future date | Cannot start. Correct the date only if wrong; later appointments today may start today. |
| Screening hold | Stop and discuss the case. There is no hold-clearance action yet. |
| Repeat scan | Run another acquisition; prior scans remain saved. |
| T1/T2 comparison | Keep geometry, slice, and W/L the same. |
| Invalid timing | TE < TR; for inversion recovery, TI + TE < TR. |
| Invalid coverage | Reduce stack span or move its center toward zero. |
| Returning/reloading | Recheck the preset/plan; unacquired edits are not a saved protocol. |

**Capture for help:** version, role, accession, date filter, browser, steps, and error. Sign out on shared devices. Use fictional data and the appointment date supplied for the exercise.
