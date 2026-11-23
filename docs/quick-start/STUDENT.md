# Student quick tips

**MedImagingSim V 1.0.7 · November 23, 2026** · [Full guide](../USER_GUIDE.md)

**Open:** [Internal test server](https://192.168.0.180:8443/sign-in). Check V 1.0.7 below the sign-in box, sign in with your supplied account, and confirm Student in the header.

Use **Training help** in the simulator for the guide section and your role’s tips; links open in a new tab/window without leaving your work.

**Release status:** instructions match local V 1.0.7. Commit/push is being handled by the user; the ThinkPad deployed version and LAN workflow are unverified. **Screenshot refresh pending for V 1.0.7.** Current protocol screenshots are in the full guide. Other workflow screenshots and print/ThinkPad verification remain pending; the new protocol workflow was checked in a disposable browser environment.

## Use defaults and save your own MRI protocols

1. At Exam Begin, open the console. Under Saved MRI protocols, choose a Saved protocol version and select Load protocol copy. Institution defaults are protected starting points; loading does not run scans.
2. Edit the current sequence's scan parameters. A numbered sequence button saves those settings to this case copy and opens the next sequence. Save sequence settings keeps edits without switching. Run scan separately; successful scans retain their plan in an unchanged loaded case copy but do not publish a library version.
3. Enter Personal protocol name and select Save my protocol version. This saves the full ordered sequence set, including current edits. Use the same name and latest personal version for versions 2, 3 and later; choose a new name to branch from older work.
4. To add/remove/reorder sequences, first Save sequence settings, then Edit full protocol. In the editor, use Add sequence, Move up/down, Remove sequence and Save my protocol version. Return to the console and Load protocol copy for the saved version you want to use.
5. MRI protocols in the header lists institution defaults and your personal versions. You cannot publish defaults or view another student's private library. Same names are safe: your personal definition is separate. Ended/locked cases must be reopened or sent back before their case copy can change.

See [protocol steps and current screenshots](../USER_GUIDE.md#create-load-and-save-mri-protocols). Saved protocols contain supported acquisition settings, not patient data, images or PACS selections.

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
| Returning/reloading | Recheck the plan. Save sequence settings or a personal version to retain edits; a scan does not publish a library version. |

**Capture for help:** version, role, accession, date filter, browser, steps, and error. Sign out on shared devices. Use fictional data and the appointment date supplied for the exercise.
