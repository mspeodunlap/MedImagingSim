# MedImagingSim user guide

Covers standalone sign-in, the shared RIS worklist, and the brain MRI console introduced in Milestones 1 and 2. The examples use fictional patients and a synthetic brain phantom.

- [Open the simulator and sign in](#open-the-simulator-and-sign-in)
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
| Student | **RIS worklist** | Launch sandbox exams and work with your own orders. Screen an exam, run approved training scans, and save a series for the PACS handoff. |
| Instructor | **Instructor home** | View the **Submissions** area. Assignments, submissions, and grading are scheduled for Milestone 3. |
| Admin | **RIS worklist** | Use both workspaces in one session. View and work with orders across users in your institution. The local install starts with one practice institution. |

## Find and screen an exam in RIS

1. From **RIS worklist**, select an existing patient's name or create an exam in **Practice sandbox**. Choose a **Scenario**, then select **Launch exam**. Each new exam gets an accession beginning with `SIM-`. It identifies the same exam in the RIS and MRI console.
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
- As **instructor**, confirm sign-in opens **Instructor home** and the **Submissions** area is available. The local test accounts and provisioning commands are described in the [README](../README.md#dedicated-role-testing).

## Troubleshoot an issue

| What you see | What to check |
| --- | --- |
| Safari can't connect | For a local app, confirm the server is running in Terminal and use the address printed at startup. |
| A LAN address has a certificate warning or is unreachable | Check the HTTPS address and port, confirm you are on the host's private network, and ask the host for its public certificate and connection steps. |
| A recent update is missing | Wait until the host confirms it has published the update, then refresh the browser. In-progress scans can be interrupted during a host restart. |
| Sign-in returns to the form | Check the visible error, confirm the username and password, and verify that the account was created in the database used by the running server. If using another account, sign out first. |
| Too many sign-in attempts | Pause briefly, then retry. If the message persists after repeated attempts for the same account, wait up to a minute. |
| The MRI console button is missing | Return to the order and check its screening status. The button appears only on an eligible order marked **Ready for console**. If you are running from a local checkout, restart the server after installing a new version. |
| Safari flags slice coverage or sequence timing | Read the field message. Reduce coverage or move the stack closer to center. Set TE shorter than TR and, for inversion recovery, keep TI plus TE shorter than TR. |
| The scanner is busy | Wait a moment and select **Run scan** again. Your scan settings remain in the form. |
| A localizer or image fails to load | Reload the console. If your session ended, sign in again and reopen the same accession. |
| Dragging a series is impractical on a touch screen | Tap the series in **Acquisition history** to open the same preview. |
| A series or its display settings seem missing | Check that you are using the same account and accession, look in **Acquisition history**, and confirm which series and values appear in **Selected for PACS**. |
