/**
 * MedScribe TypeScript Type Definitions
 */

// --- Auth ---

export interface User {
  id: string;
  email: string;
  full_name: string;
  credentials: string;
  specialty: string;
  institution: string;
  role: UserRole;
  preferred_language: string;
  preferred_template: string;
}

export type UserRole = 'physician' | 'nurse' | 'admin' | 'system';

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  credentials?: string;
  specialty?: string;
  institution?: string;
}

// --- Encounter ---

export type EncounterStatus =
  | 'recording'
  | 'paused'
  | 'transcribing'
  | 'generating_note'
  | 'pending_review'
  | 'signed_off'
  | 'amended';

export interface Encounter {
  id: string;
  encounter_id: string;
  physician_id: string;
  patient_name: string;
  status: EncounterStatus;
  specialty_template: string;
  spoken_language: string;
  output_language: string;
  duration_seconds: number;
  consent_recorded: boolean;
  created_at: string;
  updated_at: string;
  signed_off_at: string | null;
}

export interface EncounterCreateRequest {
  patient_name?: string;
  patient_dob?: string;
  patient_mrn?: string;
  specialty_template?: string;
  encounter_type?: string;
  spoken_language?: string;
  output_language?: string;
}

export interface EncounterListResponse {
  encounters: Encounter[];
  total: number;
  page: number;
  page_size: number;
}

// --- Transcript ---

export interface TranscriptSegment {
  sequence: number;
  speaker: string;
  content: string;
  timestamp_start: number;
  timestamp_end: number;
  language: string;
  confidence: number;
}

// --- Clinical Note ---

export type NoteStatus = 'draft' | 'pending_review' | 'signed_off' | 'locked' | 'amended';

export interface ClinicalNote {
  id: string;
  encounter_id: string;
  status: NoteStatus;
  chief_complaint: string;
  hpi: string;
  on_direct_questioning: string;
  past_medical_history: string;
  past_surgical_history: string;
  drug_history: string;
  medications: string;
  allergies: string;
  family_history: string;
  social_history: string;
  nutritional_history: string;
  immunization_history: string;
  developmental_history: string;
  gynecological_history: string;
  obstetric_history: string;
  review_of_systems: Record<string, string>;
  physical_examination: Record<string, string>;
  lab_investigations: string;
  imaging_investigations: string;
  investigation_comments: string;
  provisional_diagnosis: string;
  differential_diagnosis: string;
  final_diagnosis: string;
  assessment: string;
  plan: string;
  recommended_plan: string;
  sbar_summary: string;
  primary_survey: string;
  secondary_survey: string;
  follow_up: string;
  missing_sections: string[];
  uncertain_fields: string[];
  ai_generated: boolean;
  ai_disclaimer: string;
  current_version: number;
  generated_at: string;
  signed_off_at: string | null;
}

export interface NoteEditRequest {
  section: string;
  content: string;
  change_description?: string;
}

export interface NoteVersion {
  version_number: number;
  change_description: string;
  edited_by: string;
  created_at: string;
}

// --- Template ---

export interface SpecialtyTemplate {
  id: string;
  name: string;
  specialty: string;
  description: string;
  sections?: string[];
  section_order?: string[];
  custom_fields?: Record<string, unknown>;
}

// --- WebSocket Messages ---

export interface WSMessage {
  type: string;
  [key: string]: unknown;
}

export interface WSTranscriptMessage extends WSMessage {
  type: 'transcript';
  text: string;
  speaker: string;
  language: string;
  confidence: number;
  chunk_number: number;
}

export interface WSStatusMessage extends WSMessage {
  type: 'status';
  status: string;
  timestamp: string;
}

// --- UI State ---

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  elapsedSeconds: number;
  isConnected: boolean;
}

export type NoteSectionKey =
  | 'chief_complaint'
  | 'hpi'
  | 'on_direct_questioning'
  | 'past_medical_history'
  | 'past_surgical_history'
  | 'drug_history'
  | 'medications'
  | 'allergies'
  | 'family_history'
  | 'social_history'
  | 'nutritional_history'
  | 'immunization_history'
  | 'developmental_history'
  | 'gynecological_history'
  | 'obstetric_history'
  | 'review_of_systems'
  | 'physical_examination'
  | 'lab_investigations'
  | 'imaging_investigations'
  | 'investigation_comments'
  | 'provisional_diagnosis'
  | 'differential_diagnosis'
  | 'final_diagnosis'
  | 'assessment'
  | 'plan'
  | 'recommended_plan'
  | 'sbar_summary'
  | 'primary_survey'
  | 'secondary_survey'
  | 'follow_up';

export const NOTE_SECTION_LABELS: Record<NoteSectionKey, string> = {
  chief_complaint: 'Chief Complaint',
  hpi: 'History of Present Illness',
  on_direct_questioning: 'On Direct Questioning',
  past_medical_history: 'Past Medical History',
  past_surgical_history: 'Past Surgical History',
  drug_history: 'Drug History',
  medications: 'Current Medications',
  allergies: 'Allergies',
  family_history: 'Family History',
  social_history: 'Social History',
  nutritional_history: 'Nutritional History',
  immunization_history: 'Immunization History',
  developmental_history: 'Developmental History',
  gynecological_history: 'Gynecological History',
  obstetric_history: 'Obstetric History',
  review_of_systems: 'Review of Systems',
  physical_examination: 'Physical Examination',
  lab_investigations: 'Laboratory Investigations',
  imaging_investigations: 'Imaging Investigations',
  investigation_comments: 'Investigation Comments',
  provisional_diagnosis: 'Provisional Diagnosis',
  differential_diagnosis: 'Differential Diagnosis',
  final_diagnosis: 'Final Diagnosis',
  assessment: 'Assessment',
  plan: 'Plan',
  recommended_plan: 'Recommended Plan (AI Suggestion)',
  sbar_summary: 'SBAR Summary',
  primary_survey: 'Primary Survey (ABCDE)',
  secondary_survey: 'Secondary Survey',
  follow_up: 'Follow-up Instructions',
};

// --- Language ---

export const SUPPORTED_LANGUAGES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  pt: 'Portuguese',
  ar: 'Arabic',
  zh: 'Mandarin',
  hi: 'Hindi',
  sw: 'Swahili',
  de: 'German',
  it: 'Italian',
  ja: 'Japanese',
  ko: 'Korean',
  ru: 'Russian',
  tr: 'Turkish',
  nl: 'Dutch',
  pl: 'Polish',
  vi: 'Vietnamese',
  th: 'Thai',
  id: 'Indonesian',
  ms: 'Malay',
  tl: 'Filipino/Tagalog',
  ha: 'Hausa',
  yo: 'Yoruba',
  ig: 'Igbo',
  am: 'Amharic',
  tw: 'Twi/Akan',
  zu: 'Zulu',
  xh: 'Xhosa',
  so: 'Somali',
  rw: 'Kinyarwanda',
};
