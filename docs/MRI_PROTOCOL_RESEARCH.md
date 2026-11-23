# MRI dictionary research and implementation assessment

**Local V 1.0.8 · Research reviewed November 23, 2026 · Dictionary 2026-11-23.1**

The application now contains a searchable, sourced MRI planning dictionary and seven complete, executable synthetic-brain teaching protocols. It covers nine anatomic groups, 92 regions, 32 sequence/contrast concepts, 58 exam planning references and 43 selected parameter examples. This is a broad instructor starting collection, not an exhaustive list of every indication or a clinically approved scanner protocol database. The application remains an educational brain simulator.

## Research conclusions and evidence boundaries

The reviewed primary sources include ACR accreditation modules and prostate practice guidance, SCMR consensus, AAPM physics education, OHSU institutional protocols, UW–Madison field-strength-specific scanner examples and NRG brain-oncology guidance. The complete source register is below and in **Sources and review** in the application. Source revision dates are retained separately from our review date; an old institutional page is not represented as newly updated guidance.

Four different kinds of information must remain separate:

| Kind | Application treatment | Instructor implication |
| --- | --- | --- |
| General anatomy and terminology | Original taxonomy and glossary, including vendor aliases | Weighting, pulse-sequence family, suppression method, derived map and exam indication are different concepts. |
| Institutional scanner example | Named source, strength where stated, units and source location | A published example does not establish universal optimal TR/TE/TI, coil or coverage. |
| Accreditation / society criteria | Explicitly labeled limits or guidance | A maximum thickness or minimum resolution is not a full prescription or proof this simulator meets accreditation. |
| Synthetic phantom teaching plan | Complete original supported settings, copied into the existing editor/console | Usable now for teaching controls and contrasts, without suggesting clinical diagnostic equivalence. |

The 58 exam entries are an original educational synthesis of the reviewed scope. Their short sequence lists are planning outlines: some entries include alternative methods or optional indication-dependent additions. They are not a mandatory sequence order, complete clinical recipes, or instructions to give contrast. Only the selected parameter examples reproduce specific reviewed numeric settings or limits. Entries without a numeric example explicitly require further scanner-specific review. No missing timing is filled by borrowing another anatomy's settings.

The UW examples demonstrate why strength is recorded rather than converted by a multiplier. Its sagittal knee PD examples use different TR, TE and echo trains at 1.5T and 3T; its shoulder FS and optional knee STIR examples also differ. These values are attributed scanner examples, not proposed universal defaults. Generic vendor aliases likewise do not justify transferring recipes between vendors/software versions.

The adult-directory enterography link redirected to a table explicitly labeled pediatric. Its geometry is included only in the pediatric entry. The cervical cancer page mixes 200–240 mm T2 FOV values with 20–24 mm T1 entries; only the unambiguous T2 values were imported, without silently repairing presumed typos.

The older OHSU prostate page includes site-specific coil and timing conventions. We used current accessible ACR technical/practice guidance for the prostate parameter entries rather than transplanting that older local workflow. The PI-RADS PDF's original ACR URL redirected to an unreadable site during review; the accessible ACR prostate parameter and designation criteria provided the technical basis instead. The NRG document is a 2021 oncology guideline, despite its later upload path; its FLAIR example is explicitly limited to that context. We did not generalize its vendor-specific IR-GRE timing or its 1.5T inversion time into a routine brain default.

## Settings and terminology controls

- TR, TE and TI are in milliseconds. An inversion preparation's TR can describe a different cycle than a simple GRE repetition; names alone do not make those timings interchangeable.
- FOV, thickness, interslice gap and reconstruction interval are distinct. Acquired matrix/resolution is distinct from interpolation. A 384 × 312 clinical example is never silently reduced and presented as a diagnostic 128 × 128 equivalent.
- GRE excitation flip and FSE refocusing flip are different controls. Published 111–160° refocusing angles are retained as reference values, never passed to the console's 1–90° GRE flip input.
- Vendor bandwidth in kHz is not copied into the simulator's Hz/pixel field. Conversion requires the vendor bandwidth convention and sampled readout; no automatic conversion is claimed.
- T2FS/PDFS/T1FS, STIR, Dixon and spatial saturation are distinct. The console's saturation band does not implement spectral fat suppression. Fluid-null IR is a FLAIR teaching approximation, not STIR.
- DWI specifies diffusion sensitization/b-values; ADC is a derived map. A bright synthetic T2 image is never relabeled DWI/ADC. TOF needs inflow physics; ordinary GRE is not MRA. Generic 3D GRE is not MPRAGE.
- Cardiac temporal resolution and breast early-phase completion are different timing concepts. The ACR breast four-minute early-phase completion maximum is labeled separately from frame rate and is not proposed as an optimal dynamic temporal resolution.
- Pediatric, fetal, implant, motion and indication-dependent planning requires a dedicated review. No medication orders, contrast dosing, sedation, SAR limits, device clearance or clinical safety policy are populated by this dictionary.

## What instructors can do now

Open **MRI protocols → MRI anatomy and protocol dictionary**. Browse **Exam references**, **Sequence dictionary**, **Anatomic regions**, **Teaching starters**, or **Sources and review**. Search names and aliases, choose an anatomic group, and filter exam entries to those with a reviewed numeric example at 1.5T or 3T. Expand a reference and its parameter card to inspect values, basis and source. The filter does not certify every sequence in that recipe at that strength.

The seven teaching starters are immediately available in the console's **Saved protocol version** selector even before installation. Loading creates a separate case working copy. All current begin/screening, ownership, correction and review-lock checks still apply. Nothing acquires automatically.

Instructors/admins can select **Install teaching starters as institution defaults**. This creates immutable version-1 snapshots for missing names in the current institution. A matching existing default is skipped, including a locally customized one. Repeating installation or upgrading the application never replaces existing versions. Personal protocols are unaffected. Staff may instead use **Copy to protocol editor** and publish a customized default. Students can copy and save personal versions; server-side role checks still prevent default publication. Dictionary provenance is retained in saved payloads, including historical dictionary versions.

**Download dictionary JSON** returns the authenticated, read-only catalog. It is not a scanner-import format and has no import endpoint for unsupported reference recipes. No existing orderable list, patient, image, screening answer or live database is changed by browsing/exporting the dictionary.

## Coverage and remaining engine work

| Capability | Available in this release | Needed for clinical-style acquisition exercises |
| --- | --- | --- |
| Brain T1/T2/PD, 2D fluid-null IR | Complete runnable teaching starters | Educator validation, broader anatomy/lesion datasets and clinical-resolution performance |
| Spoiled GRE, 2D/3D; T2 FSE | Idealized existing model, complete starter settings | True susceptibility, prepared 3D T1, variable flip/echo-train physics, safety/field-strength effects |
| Fat-suppressed and diffusion methods | Definitions, limitations and selected settings | Fat/water and diffusion signal models, b-values, ADC fitting and appropriate fixtures |
| Body, MSK, head/neck, spine | Regions and indication-based planning references | Region-specific image fixtures, coils, larger geometry and orderable/console routing |
| Vascular, cardiac, breast | References and selected spatial/temporal criteria | Flow, gating, cine/dynamics, enhancement, MIP and organ-specific fixtures |
| Pediatric/fetal/whole-body | Dedicated planning entries; source-specific fetal geometry | Age/size-specific fixtures, motion and multistation support |

Recommended implementation order after instructor review is fat suppression plus DWI/ADC for brain completeness, additional anatomy with corresponding RIS orderables, then vascular/dynamic/cardiac capabilities with dedicated validation. Adding dropdown names alone would not deliver these capabilities. This ordering is an engineering assessment, not a clinical society recommendation.

## Verification and release limits

Automated checks cover all dictionary cross-references, starter validation, read-only browsing/export, escaping and invalid filters, supported-only loading, independent case copies, private versions, institution isolation, student default-write denial, repeat installation, local-name preservation, historical provenance and review-lock guards. Existing classroom and lifecycle regressions remain part of the full suite.

A disposable fictional-data browser walkthrough checked MSK/knee/1.5T filtering and source values, staff installation (seven added; repeat zero added/seven preserved), student loading of a three-sequence starter, editing/switching/saving a personal version and a real synthetic acquisition. Default TR 550 remained unchanged while the student's first-sequence TR was 650. Original screenshots are maintained with the user guide. No tester database was used. Commit/push belongs to the user; deployed SHA, live ThinkPad/LAN verification and print layout remain pending.

## Anatomic coverage inventory

| Group | Regions | Exam references |
| --- | --- | --- |
| Brain | Brain; Cerebrum; Posterior fossa; Brainstem; Cerebellum; Hippocampi; Sella / pituitary; Internal auditory canals; Cranial nerves; Ventricles / CSF spaces | 7 |
| Head and neck | Orbits; Face; Skull base; Paranasal sinuses; Temporomandibular joints; Neck soft tissues; Salivary glands; Nasopharynx / oropharynx; Larynx / hypopharynx | 4 |
| Spine | Cervical spine; Thoracic spine; Lumbar spine; Sacrum / coccyx; Whole spine; Spinal cord; Brachial plexus; Lumbosacral plexus | 5 |
| Body | Abdomen; Liver; Biliary tree / gallbladder; Pancreas; Spleen; Adrenal glands; Kidneys; Urinary collecting systems / ureters; Bladder; Small bowel; Colon / rectum; Perianal region; Pelvis; Uterus / cervix; Ovaries / adnexa; Prostate / seminal vesicles; Scrotum / testes; Chest / mediastinum; Abdominal wall; Pelvic floor | 15 |
| MSK | Shoulder; Humerus; Elbow; Forearm; Wrist; Hand / fingers; Bony pelvis; Hip; Femur / thigh; Knee; Tibia / fibula / calf; Ankle; Achilles tendon; Hindfoot; Midfoot; Forefoot / toes; Sacroiliac joints; Sternum / chest wall | 12 |
| Vascular | Intracranial arteries; Cerebral venous sinuses; Carotid / vertebral arteries; Thoracic aorta; Abdominal aorta; Renal arteries; Mesenteric arteries; Pelvic arteries / veins; Lower extremity arteries; Peripheral veins; Pulmonary arteries / veins | 6 |
| Cardiac | Left ventricle; Right ventricle; Atria; Myocardium; Cardiac valves; Pericardium; Great vessels | 3 |
| Breast | Bilateral breast tissue; Axillary tails; Breast implants | 2 |
| Pediatric, fetal and whole body | Pediatric brain; Pediatric spine; Pediatric abdomen / pelvis; Fetal brain; Fetal body / placenta; Whole body / marrow | 4 |

## Executable starter inventory

| Starter | Sequences |
| --- | --- |
| Brain structural teaching starter | Sagittal T1; Axial T2 FSE; Axial fluid-null IR (FLAIR approximation) |
| Brain T1 / T2 / PD comparison | Axial T1; Axial T2; Axial PD |
| Brain spin echo / fast spin echo | Axial T2 SE; Axial T2 FSE ETL 4; Axial T2 FSE ETL 8 |
| Brain fluid suppression comparison | Axial T2; Axial fluid-null IR |
| Brain multiplanar T2 planning | Axial T2; Coronal T2; Sagittal T2 |
| Brain GRE 2D / 3D comparison | Axial spoiled GRE 2D; Axial spoiled GRE 3D slab |
| Brain sampling / signal tradeoffs | T2 128 matrix; T2 96 matrix two averages; T2 128 matrix higher bandwidth |

## Source register

These public primary sources support the linked examples and concepts, not endorsement of MedImagingSim. Review date for all entries: November 23, 2026.

| ID | Source | Revision / location | Evidence type |
| --- | --- | --- | --- |
| ohsu | [OHSU MRI protocol directory](https://www.ohsu.edu/school-of-medicine/diagnostic-radiology/mri-protocols) | Individual protocols have separate revision dates | Institution examples / anatomy coverage |
| aapm | [AAPM: MRI Protocol Basics — Kocharian](https://amos3.aapm.org/abstracts/pdf/165-55219-15561640-168390-34957739.pdf) | 2021-03-27 | Physics education |
| head | [ACR head and neck module](https://accreditationsupport.acr.org/support/solutions/articles/11000061019-mri-exam-specific-parameters-head-and-neck-module) | 2026-05-06 | Accreditation criteria |
| spine | [ACR spine module](https://accreditationsupport.acr.org/support/solutions/articles/11000061020-mri-exam-specific-parameters-spine-module) | 2022-05-10 | Accreditation criteria |
| msk | [ACR MSK module](https://accreditationsupport.acr.org/support/solutions/articles/11000061021-mri-exam-specific-parameters-msk-module-revised-10-18-2021-) | 2025-03-05 | Accreditation criteria |
| body | [ACR body module](https://accreditationsupport.acr.org/support/solutions/articles/11000061022-mri-exam-specific-parameters-body-module) | 2020-09-11 | Accreditation criteria |
| mra | [ACR MRA module](https://accreditationsupport.acr.org/support/solutions/articles/11000061023-mri-exam-specific-parameters-mra-module) | 2026-03-17 | Accreditation criteria |
| breast | [ACR breast criteria](https://accreditationsupport.acr.org/support/solutions/articles/11000114407-mri-exam-specific-parameters-breast-revised-3-19-2025-) | 2025-03-19 | Accreditation criteria |
| prostate | [ACR–SABI–SAR prostate MRI practice parameter](https://gravitas.acr.org/PPTS/DownloadPreviewDocument?DocId=40&ReleaseId=2) | Version accessed 2026-11-23 | Practice parameter |
| prostate-quality | [ACR prostate center technical criteria](https://accreditationsupport.acr.org/support/solutions/articles/11000112416-prostate-cancer-mri-center-designation-3-29-2023) | 2025-02-27 | Designation criteria |
| scmr | [SCMR standardized CMR protocols: 2020 update](https://link.springer.com/article/10.1186/s12968-020-00607-1) | 2020-02-24 | Society consensus |
| uw | [UW–Madison MSK protocol directory](https://www.radiology.wisc.edu/sections/musculoskeletal-imaging-and-intervention/protocols) | Accessed 2026-11-23 | Institution examples |
| knee15 | [UW knee 1.5T: sagittal PD example](https://www.radiology.wisc.edu/wp-content/uploads/sites/65/2026/01/1.5T-KNEE.pdf) | 2025-05-29; PDF pp. 8–9 | Scanner-specific example |
| knee3 | [UW knee 3T: sagittal PD example](https://www.radiology.wisc.edu/wp-content/uploads/sites/65/2026/01/3T-Knee.pdf) | PDF pp. 9–10; accessed 2026-11-23 | Scanner-specific example |
| shoulder15 | [UW shoulder 1.5T: coronal T2 FS example](https://www.radiology.wisc.edu/wp-content/uploads/sites/65/2026/01/1.5T-SHOULDER-ROUTINE.pdf) | PDF pp. 8–9; accessed 2026-11-23 | Scanner-specific example |
| shoulder3 | [UW shoulder 3T: coronal T2 FS example](https://www.radiology.wisc.edu/wp-content/uploads/sites/65/2026/01/3T_Shoulder.pdf) | PDF pp. 8–9; accessed 2026-11-23 | Scanner-specific example |
| brain | [OHSU brain W/WO](https://www.ohsu.edu/school-of-medicine/diagnostic-radiology/mr-brain-wwo-neuro-protocol) | 2019-03-21 | Institution geometry example |
| stroke | [OHSU stroke brain WO](https://www.ohsu.edu/school-of-medicine/diagnostic-radiology/mr-stroke-brain-wo-neuro-protocol) | 2023-06-30 | Institution example |
| ms | [OHSU multiple sclerosis brain WO](https://www.ohsu.edu/school-of-medicine/diagnostic-radiology/mr-ms-brain-wo-neuro-protocol) | 2023-10-19 | Institution example |
| epilepsy | [OHSU epilepsy brain WO](https://www.ohsu.edu/school-of-medicine/diagnostic-radiology/mr-epilepsy-brain-wo-neuro-protocol) | 2022-04-15 | Institution example |
| lumbar | [OHSU lumbar spine WO](https://www.ohsu.edu/school-of-medicine/diagnostic-radiology/mr-lsp-wo-protocol) | 2020-10-16 | Institution geometry example |
| liver | [OHSU liver mass W/WO](https://www.ohsu.edu/school-of-medicine/diagnostic-radiology/mr-liver-mass-w-wo-body-protocol) | 2024-01-31 | Institution geometry example |
| pancreas | [OHSU pancreas / MRCP](https://www.ohsu.edu/school-of-medicine/diagnostic-radiology/mr-pancreas-w-wo-mrcp-body-protocol) | 2024-01-31 | Institution geometry example |
| renal | [OHSU renal mass W/WO](https://www.ohsu.edu/school-of-medicine/diagnostic-radiology/mr-renal-mass-w-wo-protocol) | 2019-04-12 | Institution geometry example |
| fetal | [OHSU fetal brain WO](https://www.ohsu.edu/school-of-medicine/diagnostic-radiology/mr-fetus-brain-wo) | 2025-05-08 | Institution example |
| nrg | [NRG Oncology brain MRI guideline v1.02](https://www.nrgoncology.org/wp-content/uploads/2025/09/MRI-Brain-Guidelines-v1.02.pdf) | 2021-06-10 | Oncology research guideline |
| wrist | [OHSU wrist WO](https://www.ohsu.edu/school-of-medicine/diagnostic-radiology/mr-adult-wrist-wo-protocol) | Revision not stated in reviewed table | Institution geometry example |
| ankle | [OHSU ankle WO](https://www.ohsu.edu/school-of-medicine/diagnostic-radiology/mr-ankle-wo-msk-protocol) | 2019-04-08 | Institution geometry example |
| hip | [OHSU routine hip WO](https://www.ohsu.edu/school-of-medicine/diagnostic-radiology/mr-hip-routine-wo-detail-hip-msk-protocol) | 2019-04-08 | Institution geometry example |
| pituitary | [OHSU dynamic pituitary W/WO](https://www.ohsu.edu/school-of-medicine/diagnostic-radiology/mr-dynamic-pituitary-wwo-neuro-protocol) | 2022-01-20 | Institution example |
| orbits | [OHSU orbits WO](https://www.ohsu.edu/school-of-medicine/diagnostic-radiology/mr-orbits-wo-neuro-protocol) | 2022-03-18 | Institution example |
| iac | [OHSU IAC WO](https://www.ohsu.edu/school-of-medicine/diagnostic-radiology/mr-iac-wo-ent-protocol) | 2023-12-12 | Institution example |
| rectal | [OHSU rectal staging W/WO](https://www.ohsu.edu/school-of-medicine/diagnostic-radiology/mr-rectum-rectal-ca-w-wo-protocol) | 2021-09-20 | Institution geometry example |
| renal-mra | [OHSU renal artery MRA](https://www.ohsu.edu/school-of-medicine/diagnostic-radiology/mra-renal-arteries-protocol) | Directory lists 2023-04-28 | Institution geometry example |
| cervix | [OHSU cervical cancer staging](https://www.ohsu.edu/school-of-medicine/diagnostic-radiology/mr-adult-female-pelvis-cervical-cancer-staging-w-wo-body) | 2023-12-08 | Institution geometry example |
| enterography-peds | [OHSU enterography page (pediatric table)](https://www.ohsu.edu/school-of-medicine/diagnostic-radiology/mre-enterography-w-wo-body-protocol-peds) | 2026-03-14 | Pediatric institution example |
