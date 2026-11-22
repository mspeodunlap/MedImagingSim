# MedImagingSim user guide

Internal test server — [https://192.168.0.180:8443/sign-in](https://192.168.0.180:8443/sign-in), hosted on the ThinkPad T450s at its reserved LAN address. Access requires a connection to the local network and trust for the server’s Caddy certificate.

Covers standalone sign-in, the shared RIS worklist, and the brain MRI console introduced in Milestones 1 and 2. The examples use fictional patients and a synthetic brain phantom.

- [Open the simulator and sign in](#open-the-simulator-and-sign-in)
- [Review and schedule an incoming order](#review-and-schedule-an-incoming-order)
- [Find and screen an exam in RIS](#find-and-screen-an-exam-in-ris)
- [Plan and run an MRI scan](#plan-and-run-an-mri-scan)
- [Review, repeat, and select a series](#review-repeat-and-select-a-series)
- [Verify the instructor and administrator workspaces](#verify-the-instructor-and-administrator-workspaces)
- [Troubleshoot an issue](#troubleshoot-an-issue)

## Open the simulator and sign in

1. Open the exact address supplied by the host. For LAN testing, use the ThinkPad's HTTPS address, including its port, and follow the host's certificate trust instructions first. For testing on the same Mac that runs the development copy, open [MedImagingSim](http://127.0.0.1:3000/sign-in). See the [LAN tester connection steps](LAN_HOSTING.md#4-connect-a-tester) or [local setup instructions](../README.md#run-locally).
2. Enter your **Username** and **Password**, then select **Sign in**.
3. Check the account name and role in the header. Select **Sign out** in the header when you are finished or before testing another role.

| Role | First screen | What you can do today |
| --- | --- | --- |
| Student | **Order queue** | Create, review, correct, and schedule your own orders. Continue to screening, scanning, and PACS selection in RIS. |
| Instructor | **Order queue** | Review and schedule incoming orders in your institution. View the RIS worklist and open the scheduled intake review from its patient row. Use **Instructor home** for the submissions workspace. |
| Admin | **Order queue** | Review and schedule all incoming orders in your institution, and use the student and instructor workspaces. |

## Review and schedule an incoming order

1. After signing in, open **Order queue**. All newly created orders appear here before scheduling.
2. Select **Quick order** to generate a fictional patient and MRI order. Each generated order has an 80% chance of being complete and a 20% chance of deliberately omitting required details. Consecutive orders are independent, so small batches may have a different mix. Alternatively expand **Manual order**, enter the supplied information, and select **Create order**. You may leave unavailable information blank so it can be reviewed.
3. Open an order by its number. Check **Patient name**, **Patient ID / MRN**, **Date of birth**, **Recorded sex**, **Requested exam**, and **Reason for exam**. **Clinical history** is optional in the initial completeness check. This release offers the configured brain MRI exam.
4. If required information is missing, select **Return for missing information**. The order stays in the queue as **Needs information** and the decision appears in **Review history**. Use fictional information supplied for the exercise to correct the fields, then select **Save corrections**. The original received details remain available under **Original order as received**.
5. When the order is complete, check each item under **Completeness review**, then select **Schedule order**. All three checks must be verified. The server blocks scheduling if any required information is absent and records the attempt for assessment. After a correction or blocked attempt, review the fields and verify the checks again.
6. Scheduling removes the order from the pending queue and adds it to **RIS worklist** with a stable accession and **Ordered** status. Students and admins can continue to safety screening. Instructors return to the worklist and can inspect the scheduled intake record.
7. **Review history** records the reviewer, timestamp, decision, missing fields at that review, and checked categories. Instructors and admins can inspect student reviews within the same institution. Student access is limited to their own orders.

An instructor or admin reviewing a student's order preserves its original owner, so the scheduled exam appears in that student's worklist. Assignment dispatch and cohort grading remain planned for Milestone 3. Existing exams created before the order queue keep their accession, screening answers, and scan history.

## Find and screen an exam in RIS

1. From **RIS worklist**, select a scheduled patient. To create one of the earlier practice cases, open **Order queue → Practice scenarios**, choose a scenario, and select **Create scenario order**. Review and schedule it first. Scheduling assigns an accession beginning with `SIM-` that identifies the same exam in RIS and the console.
2. Read **Patient history**, including the indication and clinical history. Under **Safety screening**, answer all three questions, then select **Submit screening**. Submitted answers are read-only.
3. Check the order status.

| Status | What you can do |
| --- | --- |
| **Ordered** | Review the case and submit screening. |
| **Ready for console** | Select **Open MRI console** to plan and acquire scans. |
| **Screening hold** | Review the saved answers and history. The exercise ends at the hold. Start another practice order to run a scan. |

### Try both screening outcomes

- **Routine brain MRI** opens a case for Morgan Ellis. In this fictional case, answer **No** to all three questions to reach **Ready for console**.
- **Implant review** opens a case for Riley Patel. The history describes an implanted neurostimulator and missing device identification. Select **Yes** or **Unsure** on the implant question, answer the other questions from the history, and submit. Confirm the **Screening hold** and that the console button is absent.

## Plan and run an MRI scan

1. Open an order marked **Ready for console** and select **Open MRI console**. Check **Patient and exam** in the upper left. Confirm the patient, exam, and accession match your RIS order. Select **Back to RIS order** to return at any time.
2. Across the top, under **Positioning localizers**, inspect the axial, coronal, and sagittal views. The orientation letters label the image edges. The cyan overlay shows the projected field of view and slice stack on all three views. An amber overlay marks the saturation band when enabled. Change a planning control and watch the overlay update.
3. In the lower-left **Protocol and sequences** panel, choose a **Preset**. Use **Scan parameters** below the localizers to set geometry, timing, sampling and encoding, or spatial saturation. Choose the preset before editing timing because choosing a new preset reloads its timing defaults.
4. Select **Run scan**. The newest series opens automatically in **Series preview**, beside the parameters on a wide screen. Open **Series details** to confirm that its geometry and timing match the plan you entered.

### Slice geometry controls

| Control | What it changes |
| --- | --- |
| **Acquisition mode** | Use a 2D slice stack or select **3D slab (GRE)** after choosing **Spoiled gradient echo**. A 3D slab uses contiguous partitions, so the gap is set to zero. |
| **Plane** | Sets the base orientation to axial, coronal, or sagittal. |
| **Angulation (°)** | Tilts the slice stack relative to the chosen plane. |
| **Stack center (mm)** | Shifts the stack along its slice direction. Check the perpendicular localizers for the shift. |
| **Field of view (mm)** | Sets the readout field of view. **Phase FOV (%)** can make the other dimension smaller. |
| **Slices** | Sets how many images the scan acquires. |
| **Thickness (mm)** | Sets slice thickness. |
| **Gap (mm)** | Sets the spacing between adjacent slice edges. |
| **Stack coverage** | Shows the total span. For example, 20 slices at 5 mm with a 1 mm gap span 119 mm. |

### Pulse sequence controls

| Control | What it changes |
| --- | --- |
| **Preset** | Loads **T1 spin echo**, **T2 spin echo**, **PD spin echo**, **Fluid-suppressed inversion recovery**, **Spoiled gradient echo**, or **T2 fast spin echo**. |
| **TR (ms)** and **TE (ms)** | Set repetition and echo timing for the simulated signal. |
| **TI (ms)** | Sets inversion timing. This field is enabled when you select the inversion-recovery preset. |
| **Flip angle (°)** | Changes signal in the spoiled GRE preset. |
| **Echo train length** | Changes the estimated time for **T2 fast spin echo**. The simulator uses an idealized image signal for this preset. |

### Sampling, encoding, and spatial saturation

| Control | What it changes |
| --- | --- |
| **Frequency matrix** and **Phase matrix** | Set sample counts along the readout and phase directions. Choose **Match frequency** for the same count in both directions. |
| **Phase direction** | Sets vertical or horizontal encoding in the slice view. The readout direction follows the other axis. Phase wrap follows the phase axis. |
| **Phase FOV (%)** | Sets the phase field of view as a percentage of the readout FOV. Reducing it can make anatomy wrap into the displayed field. |
| **Phase oversampling (%)** | Expands the encoded phase field while keeping the displayed field the same. It can reduce wrap and increases the estimated acquisition time. |
| **Averages (NEX / NSA)** | More averages reduce simulated noise and increase the estimated acquisition time. |
| **Receiver bandwidth (Hz/pixel)** | Higher bandwidth increases noise in this training model. |
| **Saturation band** | Choose its direction, then set **Band center** and **Band thickness**. Check the amber marks on the localizers. The band reduces signal in the selected region. |

For parameter coverage and upcoming controls, see the [MRI console parameter inventory](MRI_CONSOLE_COVERAGE.md).

## Review, repeat, and select a series

1. In **Series preview**, use the **Slice** slider to step through the series. Compare images at the same slice number when geometry is unchanged.
2. Adjust **Window width** and **Window level** beside the image. Width controls the displayed intensity range and level shifts its midpoint. The preview updates as you change valid values.
3. To repeat a scan, change a setting under **Scan parameters** and select **Run scan** again. Each run appears in **Acquisition history**. To preview an earlier run, drag its series row onto **Series preview**. You can also click the row or press **Enter** while it has keyboard focus. Your current scan settings stay in place. Open **Series details** to inspect the displayed series metadata.
4. To prepare a series for PACS, open that series, set the desired window and level, and select **Save PACS selection**. Confirm the **Selected for PACS** notice lists the intended series number and values. Saving a different series replaces the saved selection for this exam. Each scan remains in the history.
5. Reopen the exam and check the **Selected for PACS** notice. A fresh console visit previews the latest acquisition. Select the saved series from history to verify its stored window and level. This version prepares the selection. PACS transfer, exam completion, and instructor review are scheduled for Milestone 3.

### Practice comparing contrast and preserving a repeat scan

1. Start with **Routine brain MRI** cleared by screening. Run **T1 spin echo** with the default geometry and note the series number.
2. Keep the geometry and matrix the same. Select **T2 spin echo** and run another scan.
3. Open each series in **Acquisition history** and compare the same slice with the same window and level. Pick a slice through the simulated ventricles near the middle of the stack. Fluid appears darker on T1 and brighter on T2 in the training phantom.
4. Reopen the first series, set a different window and level, and save it for PACS. Return to the console from RIS and verify the second series previews by default. Drag the first series into **Series preview** and confirm its saved window and level. Compare the values under **Scan parameters** before and after the drop to confirm the plan stays in place.

## Verify the instructor and administrator workspaces

- As **admin**, complete both practice scenarios and the repeat-scan exercise. Select **Instructor home** in the header, then return to **RIS worklist**. Confirm the app keeps you signed in and the worklist shows the **Owner** column.
- As **student**, launch a practice order. Confirm you can see and resume your own order. Use a second student account to check that the order is absent from that student's worklist.
- As **instructor**, confirm sign-in opens **Order queue**. Create or review an order, schedule it, and confirm it appears on **RIS worklist**. Select **Instructor home** to reach **Submissions**. The local test accounts and provisioning commands are described in the [README](../README.md#dedicated-role-testing).

## Troubleshoot an issue

| What you see | What to check |
| --- | --- |
| Safari can't connect | For a local app, confirm the server is running in Terminal and use the address printed at startup. |
| A LAN address has a certificate warning or is unreachable | Check the HTTPS address and port, confirm you are on the host's private network, and ask the host for its public certificate and connection steps. |
| A recent update is missing | Wait until the host confirms it has published the update, then refresh the browser. In-progress scans can be interrupted during a host restart. |
| Sign-in returns to the form | Check the visible error, confirm the username and password, and verify that the account was created in the database used by the running server. If using another account, sign out first. |
| Too many sign-in attempts | Pause briefly, then retry. If the message persists after repeated attempts for the same account, wait up to a minute. |
| An incoming order is absent from RIS | Review it in **Order queue** and schedule it after correcting required information and checking the three completeness confirmations. |
| The order changed while you were reviewing it | Reopen the order to load the latest revision before submitting another review. |
| The MRI console button is missing | Return to the order and check its screening status. The button appears only on an eligible order marked **Ready for console**. If you are running from a local checkout, restart the server after installing a new version. |
| Safari flags slice coverage or sequence timing | Read the field message. Reduce coverage or move the stack closer to center. Set TE shorter than TR and, for inversion recovery, keep TI plus TE shorter than TR. |
| The scanner is busy | Wait a moment and select **Run scan** again. Your scan settings remain in the form. |
| A localizer or image fails to load | Reload the console. If your session ended, sign in again and reopen the same accession. |
| The site stops responding after the host lid closes | Ask the host operator to check power, Ethernet, and the lid-close configuration in the [hosting runbook](LAN_HOSTING.md#keep-serving-with-the-lid-closed). |
| Dragging a series is impractical on a touch screen | Tap the series in **Acquisition history** to open the same preview. |
| A series or its display settings seem missing | Check that you are using the same account and accession, look in **Acquisition history**, and confirm which series and values appear in **Selected for PACS**. |
