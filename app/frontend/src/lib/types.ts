export type Sample = {
  id: string;
  scenario: string;
  referenceText: string;
  expectedDurationSeconds: number;
  durationSeconds: number | null;
  provenance: string;
  permission: string;
  status: string;
};

export type Manifest = {
  schemaVersion: number;
  language: string;
  model: string;
  samples: Sample[];
};

export type RuntimeHealth = {
  mode: "live" | "simulated" | "blocked";
  model: string;
  pythonAvailable: boolean;
  dependenciesAvailable: boolean;
  message: string;
};

export type TranscriptionResult = {
  mode: "live" | "simulated";
  model: string;
  text: string;
  elapsedSeconds: number;
  runtime?: Record<string, unknown>;
  warning?: string;
};

export type Evaluation = {
  id: string;
  sampleId: string;
  scenario: string;
  createdAt: string;
  mode: "live" | "simulated";
  transcript: string;
  referenceText: string;
  wordEdits: number;
  referenceWordCount: number;
  wordErrorRate: number | null;
  elapsedSeconds: number;
  meaningPreserved: "yes" | "no" | "unsure";
  usabilityRating: number;
  notes: string;
};
