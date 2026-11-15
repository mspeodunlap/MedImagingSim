# **Product Requirements Document (PRD): Medical Imaging Suite Simulator (v1.3)**

## **1\. Product Overview**

The Medical Imaging Suite Simulator is a comprehensive, web-based educational platform designed to bridge the gap between classroom theory and real-world clinical rotations for medical imaging students, with an initial core focus on **Magnetic Resonance Imaging (MRI)** followed by **Computed Tomography (CT)**. The application provides a hyper-realistic, end-to-end simulated workflow encompassing administrative tasks (RIS), clinical scanning (Console), and image management (PACS).

RIS and PACS are shared applications across all supported modalities. Each modality supplies its exam configuration, safety rules, console, and acquisition engine. MRI is the first modality to use the shared workflow.

## **2\. User Roles & Detailed Workflows**

### **2.1 The Clinical Instructor Role (The Orchestrator & Evaluator)**

The instructor needs tools to efficiently manage cohorts, create realistic clinical challenges, and evaluate highly technical student output.

* **Instructor Dashboard:**  
  * **Cohort Overview:** A high-level view of student progress, completion rates, and average scores separated by modality (MRI, CT).  
  * **Recent Submissions:** A queue of completed student exams waiting for manual review  
* **Scenario Builder & Assignment Engine:**  
  * **Patient Creator:** Input fictional patient demographics, body habitus, clinical history, and contraindications (e.g., pacemakers, claustrophobia, renal function).  
  * **Order Generation:** Select the modality and specific exam (e.g., *MRI Brain w/o Contrast* or *CT Abdomen/Pelvis w/ Contrast*).  
  * **Constraint & Rubric Setting:** Define the "Gold Standard" for the assignment.  
    * *Parameter ranges:* (e.g., Acceptable TR/TE for T1 vs. T2 weighting, acceptable Pitch for CT).  
    * *Positioning tolerances:* (e.g., MRI slice block angulation must be parallel to the corpus callosum).  
  * **Assignment Dispatch:** Push scenarios to individual students, specific groups, or the entire cohort with due dates.  
* **Evaluation & Grading Portal (Simulated PACS Review):**  
  * **The "Over-the-Shoulder" View:** Instructors view the *exact* image the student generated based on their chosen parameters, rather than an idealized master image.  
  * **Window/Level Verification:** The PACS viewer loads the image using the exact Window/Level (W/L) state the student applied before sending to PACS, allowing the instructor to grade their image contrast/brightness optimization.

  * **Metadata Inspection:** The instructor can view the simulated DICOM header to see the technical factors, pulse sequences, and patient dose (CTDIvol) the student applied.  
  * **RIS Documentation Review:** A side-panel displays the student's post-exam notes, safety screening logs, and contrast administration details.  
    

**2.2 The Imaging Student Role (The Practitioner)**  
The student environment must feel like a real clinical workstation, minimizing "educational UI" during the simulation to build genuine clinical muscle memory.

* **Student Dashboard:**  
  * **Worklist:** Displays pending assignments from the instructor (mimicking a hospital RIS pending queue).  
  * **Sandbox Launcher:** A button to auto-generate a random patient/order for self-guided practice when they don't have pending assignments.  
  * **Gradebook/Feedback:** An area to review past exams, see the instructor's image markups, and read feedback.

* **The Clinical Execution Workflow:**  
  * **Phase 1: RIS & Administration:** The student opens the pending order, reviews the clinical history, executes strict safety questionnaires (e.g., MRI metal screening, eGFR for CT contrast), and "begins" the exam.  
    * The RIS system generates study accession numbers that are sent to PACS (once the images are acquired at the console the student sends them to PACS, the accession number is the source of truth)  
  * **Phase 2: Console & Slice Planning:** The student enters the modality console. They utilize 2D localizer/scout images to plot their slice geometries, set all technical parameters (TR, TE, flip angle, mA, pitch), and initiate the scan sequence.  
    * This should be a full fledged console with all parameters that are available on actual imaging consoles  
    * The console should have the ability to switch between the nomenclature or lingo of the most commonly used systems available today such as GE, Philips, Siemens and Hitachi.  While this does not fundamentally change the function of the console it introduces each vendors lexicon to get the student familiar with the differences  
  * **Phase 3: Image QA & Processing:** The resulting image appears on the console. The student evaluates it for diagnostic quality, checking for artifacts (aliasing, motion, noise). They adjust the Window/Level to the appropriate diagnostic range.  
    * Allow repeating of sequences if necessary  
  * **Phase 4: PACS Routing:** The student clicks "Send to PACS" once satisfied with the image quality.  
    * Again this keeps the accession number obtained from RIS intach and sends to the correct study in PACS  
  * **Phase 5: Exam Completion:** The student returns to the RIS, inputs their technologist notes, logs any contrast media used (volume, flow rate), and marks the study as "Complete."  
    * This triggers a message on the instructors dashboard that the student has completed the assignment.  
      

### **2.3 Administrator (Superuser)**

The administrator can use all implemented student and instructor workflows in one session, including viewing and working with orders across users. Normal exam state transitions apply. Use the administrator account to verify each workflow before dedicated role testing.

## **3\. Core System Modules**

### **3.1 Radiology Information System (RIS)**

* **Auto-Generation Engine:** One-click generation of randomized clinical scenarios for both the instructor and the student (Sandbox Mode).  
* **Order & Encounter Management:** Use a common worklist, order lifecycle, accession assignment, scheduling, and documentation workflow across modalities. Each order identifies its modality and exam type. The exam configuration determines the screening questions and hold rules, and the modality determines which console opens.

### **3.2 Imaging Console Simulator (MRI & CT)**

Designed for point-and-click and touchscreen interfaces, mimicking standard cross-sectional vendor software (e.g., Siemens Syngo, GE AW).

* **2D Slice Planning & Positioning:**  
  * Positioning and slice planning are conducted in 2D over multi-planar localizer/scout images (Sagittal, Coronal, Axial).  
  * Students manipulate graphical bounding boxes and slice blocks to set Field of View (FOV), slice thickness, slice gap, and precise anatomical angulation.  
* **Modality-Specific Parameter Controls:**  
  * **MRI (Priority 1):** Pulse sequence selection (Spin Echo, Gradient Echo, Inversion Recovery), TR, TE, TI, flip angle, matrix size, FOV, bandwidth, NSA/NEX, and phase/frequency encoding directions, phase oversampling, sat band placement, etc..  Allow for 2D and 3D acquisitions.  Plan for allowing practice of contrast enhanced exams to practice timing  
  * **CT (Priority 2):** kVp, mA/mAs, rotation time, pitch, slice thickness, scan DFOV, and reconstruction algorithms (soft tissue, bone).  
* **Pre-PACS Image Processing:** Upon image acquisition, the console must feature robust Window/Level (W/L) controls. Students must be able to adjust the W/L to the appropriate diagnostic range *before* sending the images to PACS.  
  * Allow for advanced post processing like MIP, 3d image reconstruction, image subtraction etc.


  


  


  

### **3.3 Picture Archiving and Communication System (PACS)**

* **Study and Series Routing:** All modality consoles send selected series to the same archive under the original RIS accession. Preserve the images, geometry, modality, technical metadata, and window/level submitted by the student.

* **Diagnostic Viewer:** Web-based DICOM-style viewer with standard cross-sectional tools (scroll/cine, pan, zoom, measure, ROI, annotate).

* **Window/Level State Management:** If a student adjusts the W/L within the PACS viewer, the system must allow them to save those specific W/L settings (simulating DICOM Grayscale Softcopy Presentation State \- GSPS).


  ## **4\. Technical Architecture & Data Sourcing**

  ### **4.1 Image Generation Engine & Dataset Integration**

To generate realistic images that reflect student inputs, the backend will utilize large-scale public datasets. Engineering will implement one of two core methodologies:

**Option A: Algorithmic/Physics-Based Engine (Preferred for MRI)** This approach dynamically alters high-fidelity master volumes using mathematical models, GPU shaders, or k-space reconstruction to simulate physics artifacts (e.g., aliasing, signal-to-noise degradation, contrast weighting).

* **fastMRI (NYU Langone/Meta AI):** Provides raw k-space data alongside final DICOMs. This is the primary dataset for the MRI engine, allowing the system to mathematically reconstruct images based on student parameters (e.g., undersampling k-space if the student sets matrix/NEX too low).  
* **Human Connectome Project (HCP) & OASIS:** Provides ultra-high-resolution, "perfect" structural master volumes (T1, T2) that serve as baselines for the shader engine to manipulate.

**Option B: Database-Driven Engine (Preferred for CT)** This approach maps student parameter ranges (e.g., varying mA levels) to a vast matrix of pre-acquired clinical datasets, serving the closest matching real DICOM.

* **The Cancer Imaging Archive (TCIA):** A massive repository of diverse, real-world clinical datasets. The backend will scrape DICOM headers to categorize images by kVp, mA, slice thickness, and pitch, querying the appropriate image when a student selects matching parameters.  
* **DeepLesion (NIH):** Over 32,000 highly annotated CT slices. Used to quickly query specific anatomical cross-sections based on the student's virtual table position and scan DFOV.

  ### 

  ### 

  ### **4.2 Data Licensing & Compliance**

The engineering and legal teams must audit the usage of public datasets based on the product's commercialization strategy:

* **Academic Use:** If deployed purely as an internal non-profit educational tool, standard Data Use Agreements (DUAs) and CC BY-NC licenses allow free use of HCP, OASIS, and fastMRI.  
* **Commercial SaaS:** If the simulator is sold to institutions, the data ingest pipeline must strictly filter for CC0 (Public Domain) or CC BY (Attribution-only) datasets, or secure commercial licenses for specific subsets of TCIA and fastMRI. Note: all patient data used will be fully de-identified to maintain HIPAA/GDPR compliance.

  ### **4.3 Authentication & LMS Integration**

* **Phase 1 (MVP):** Standalone platform with a built-in authentication system and local user database.  
* **Phase 2 (Architected for Scale):** Decoupled architecture for future integration with Active Directory (AD) / SSO and Learning Management Systems (LMS, e.g., Canvas, Blackboard) via LTI standard interfaces.

## **5\. Development Phasing**

See the [milestone plan](MILESTONE_PLAN.md) for implementation order and acceptance criteria. The initial release covers MRI, including hosting, pilot access, and institutional identity and LMS integration. CT follows after MRI go-live and reuses the shared RIS and PACS applications.
