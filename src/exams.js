export const exams = {
  "mr-brain-v1": {
    modality: "MR",
    examName: "MRI Brain without contrast",
    consolePath: "/console/mr",
    consoleLabel: "MRI console",
    questions: [
      { id: "implant", label: "Any implanted device or surgical hardware requiring verification?" },
      { id: "metal", label: "Any history of metallic fragments or an injury involving metal?" },
      { id: "tolerance", label: "Any concern about tolerating the exam as planned?" },
    ],
    holdAnswers: ["yes", "unsure"],
  },
};

export const scenarios = {
  "routine-brain": {
    title: "Routine brain MRI",
    examKey: "mr-brain-v1",
    patient: "Morgan Ellis",
    age: 36,
    indication: "Persistent headaches",
    history: "The fictional patient reports no implanted devices, metal injuries, or concerns about tolerating the scan.",
  },
  "implant-review": {
    title: "Implant review",
    examKey: "mr-brain-v1",
    patient: "Riley Patel",
    age: 54,
    indication: "Follow-up for headaches",
    history: "The fictional patient reports an implanted neurostimulator and does not have the device identification card.",
  },
};

export const screeningAnswers = [
  ["no", "No"],
  ["yes", "Yes"],
  ["unsure", "Unsure"],
];

export const statusLabels = {
  ordered: "Ordered",
  held: "Screening hold",
  ready: "Ready for console",
};

export function readScreening(exam, form) {
  const answers = Object.fromEntries(exam.questions.map(({ id }) => [id, form.get(id)]));
  if (exam.questions.some(({ id }) =>
    form.getAll(id).length !== 1 || !screeningAnswers.some(([value]) => value === answers[id]))) {
    return null;
  }
  const held = Object.values(answers).some(answer => exam.holdAnswers.includes(answer));
  return { answers, status: held ? "held" : "ready" };
}
