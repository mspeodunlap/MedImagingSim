# Administrator quick tips

**MedImagingSim V 1.0.5 · November 23, 2026** · [Full guide](../USER_GUIDE.md#administrator-instructions)

**Open:** [Internal test server](https://192.168.0.180:8443/sign-in). Confirm Admin in the header. Admin actions span accessible orders within the current institution.

Use **Training help** in the simulator for the guide section and your role’s tips; links open in a new tab/window without leaving your work.

**Screenshot refresh pending for V 1.0.5.** Current screen images are omitted until browser capture is available.

## Support a learner

1. Open Order queue and check Created by before editing a request. Read Review history and Original order as received.
2. Correct from the exercise data, select an explicit appointment date/time, verify the three completeness checks, and Schedule order. The request keeps its creator as owner.
3. In RIS worklist, use the automatically applied appointment date filter, MRN, and Owner column to find the intended exam.
4. For an unstarted appointment, expand Reschedule appointment, confirm date/time, and Save appointment. Rescheduling is unavailable after screening is submitted.
5. Open the patient to inspect screening. A clear result is Screened: select Begin exam before Open MRI console. Save at least one scan, return to the order, confirm the performed exam, enter optional notes (up to 4,000 characters), and End exam. No arrival action is required.
6. Select Instructor home to inspect that workspace. Sign out to verify behavior under a separate student/instructor account.
7. Find ended cases in Completed/Recent on the appointment date. Mark completed records RIS completion without transferring images to PACS. Review images preserves saved data; window/level adjustments there are temporary.
8. Before instructor review, use Reopen for correction to return an ended/completed study to Exam Begin. Prior scans, selection, notes, and history remain. Add correction scans if needed, confirm the performed exam again, and repeat End exam/Mark completed.

**Progress:** Ordered → Scheduled → Screened → Exam Begin → Exam End → Completed. Unscheduled requests do not appear on RIS. Completed/Recent contains both ended and completed cases and filters by appointment date.

**Review lock:** an instructor opening an ended/completed study locks corrections for every role. Admin cannot reopen, change acquisitions or selection, mark completed, or release that lock. Only an instructor's Send back for correction action with a reason unlocks it and returns it to Exam Begin. Instructor home access under an admin account does not give the admin an instructor review identity.

Screen images are pending refresh for V 1.0.5; browser/LAN verification remains pending. See the [detailed lifecycle steps](../USER_GUIDE.md#end-complete-review-and-correct-an-exam).

## Release check

| Check | Evidence |
| --- | --- |
| Deployment finished | Active ThinkPad commit matches the intended GitHub commit. |
| Correct build | Version below sign-in matches the release; this guide is V 1.0.5. |
| LAN access | A separate network device can sign in over HTTPS. |
| Workflow works | Changed feature behaves as documented under the appropriate roles. |
| Saved work survives | Existing order, screening, scans, and PACS selection still open; check the appointment date. |

Use the [ThinkPad runbook](../LAN_HOSTING.md) for deploy status, service logs, persistent database, backups, and power/lid configuration. A successful push alone does not verify tester availability.

## Account and feature limits

Account creation is a host/operator command, not an admin page. In a correctly configured checkout/database, use `npm run create-user -- username student` (or `instructor` / `admin`); it prints a generated password. Consult the full guide/runbook before operating on the host. There is no in-app password reset, user editor, tenant editor, hold-release control, grading, or full PACS transfer yet. Never use the disposable documentation database as the tester database.

**Problem report:** include version, role, request/accession, appointment date/filter, device/browser, steps, and message. Share credentials privately; screenshots should show only relevant simulator content.
