/**
 * LiveEncounterScreen — Split view with transcript panel (left) and evolving note panel (right).
 * Recording controls, encounter timer, consent capture.
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import api from '../../services/api';
import type { Encounter, EncounterCreateRequest, TranscriptSegment } from '../../types';
import {
  Mic, Pause, Play, Square, Clock, Wifi, WifiOff,
  AlertCircle, FileText, Loader2, Shield
} from 'lucide-react';
import clsx from 'clsx';
import { SUPPORTED_LANGUAGES } from '../../types';

export default function LiveEncounterScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'transcript' | 'preview'>('transcript');

  // Check browser microphone support on mount
  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
      setErrorMsg('Your browser does not support audio recording. Please use Chrome, Firefox, or Edge.');
    }
  }, []);

  // New encounter form state
  const [formData, setFormData] = useState<EncounterCreateRequest>({
    patient_name: '',
    patient_dob: '',
    patient_mrn: '',
    specialty_template: user?.preferred_template || 'general_practice',
    spoken_language: 'en',
    output_language: user?.preferred_language || 'en',
  });

  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const encounterId = encounter?.id || '';
  const {
    state: recState,
    segments,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  } = useAudioRecorder({
    encounterId,
    onError: (err) => setErrorMsg(err),
  });

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [segments]);

  // Load existing encounter if ID provided
  useEffect(() => {
    if (id && id !== 'new') {
      api.getEncounter(id).then(setEncounter).catch(() => setErrorMsg('Encounter not found'));
    }
  }, [id]);

  const handleCreateAndStart = async () => {
    setIsCreating(true);
    setErrorMsg('');
    try {
      const enc = await api.createEncounter(formData);
      setEncounter(enc);
      // Record consent
      await api.recordConsent(enc.id, true, formData.patient_name || 'Patient');
      setConsentGiven(true);
    } catch (err) {
      setErrorMsg('Failed to create encounter. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartRecording = async () => {
    if (!consentGiven) {
      setErrorMsg('Patient consent must be recorded before starting.');
      return;
    }
    await startRecording();
  };

  const handleStopAndGenerate = async () => {
    stopRecording();
    if (!encounter) return;
    setIsGenerating(true);
    try {
      await api.stopRecording(encounter.id);
      await api.generateNote(encounter.id);
      navigate(`/review/${encounter.id}`);
    } catch (err) {
      setErrorMsg('Note generation failed. You can retry from the encounter history.');
      setIsGenerating(false);
    }
  };

  // Pre-recording setup view
  if (!encounter) {
    return (
      <div className="p-6 lg:p-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">New Encounter</h1>
        <p className="text-slate-500 mb-8">Set up the encounter details before recording</p>

        {errorMsg && (
          <div className="ai-disclaimer mb-6">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="text-red-700">{errorMsg}</span>
          </div>
        )}

        <div className="card p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Patient Name</label>
              <input value={formData.patient_name} onChange={(e) => setFormData((f) => ({ ...f, patient_name: e.target.value }))}
                     className="input-field" placeholder="Patient name (optional)" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">MRN</label>
              <input value={formData.patient_mrn} onChange={(e) => setFormData((f) => ({ ...f, patient_mrn: e.target.value }))}
                     className="input-field" placeholder="Medical Record Number" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth</label>
              <input type="date" value={formData.patient_dob}
                     onChange={(e) => setFormData((f) => ({ ...f, patient_dob: e.target.value }))}
                     className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Specialty Template</label>
              <select value={formData.specialty_template}
                      onChange={(e) => setFormData((f) => ({ ...f, specialty_template: e.target.value }))}
                      className="input-field">
                <option value="general_practice">General Practice / Family Medicine</option>
                <option value="internal_medicine">Internal Medicine</option>
                <option value="emergency_medicine">Emergency Medicine</option>
                <option value="pediatrics">Pediatrics</option>
                <option value="surgery">General Surgery</option>
                <option value="orthopedics">Orthopedics</option>
                <option value="obstetrics_gynecology">Obstetrics & Gynecology</option>
                <option value="psychiatry">Psychiatry</option>
                <option value="cardiology">Cardiology</option>
                <option value="neurology">Neurology</option>
                <option value="pulmonology">Pulmonology</option>
                <option value="gastroenterology">Gastroenterology</option>
                <option value="nephrology">Nephrology</option>
                <option value="endocrinology">Endocrinology</option>
                <option value="dermatology">Dermatology</option>
                <option value="ophthalmology">Ophthalmology</option>
                <option value="ent">ENT / Otolaryngology</option>
                <option value="urology">Urology</option>
                <option value="oncology">Oncology</option>
                <option value="hematology">Hematology</option>
                <option value="rheumatology">Rheumatology</option>
                <option value="infectious_disease">Infectious Disease</option>
                <option value="anesthesiology">Anesthesiology</option>
                <option value="radiology">Radiology</option>
                <option value="pathology">Pathology</option>
                <option value="palliative_care">Palliative Care</option>
                <option value="rehabilitation">Physical Medicine & Rehab</option>
                <option value="sports_medicine">Sports Medicine</option>
                <option value="geriatrics">Geriatrics</option>
                <option value="neonatology">Neonatology</option>
                <option value="telemedicine">Telemedicine</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Spoken Language</label>
              <select value={formData.spoken_language}
                      onChange={(e) => setFormData((f) => ({ ...f, spoken_language: e.target.value }))}
                      className="input-field">
                {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Output Language</label>
              <select value={formData.output_language}
                      onChange={(e) => setFormData((f) => ({ ...f, output_language: e.target.value }))}
                      className="input-field">
                {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Consent */}
          <div className="p-4 rounded-xl bg-teal-50 border border-teal-200">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-teal-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-teal-800">Patient Consent Required</p>
                <p className="text-xs text-teal-600 mt-1">
                  By proceeding, you confirm that patient consent for AI-assisted documentation 
                  has been obtained and recorded.
                </p>
              </div>
            </div>
          </div>

          <button onClick={handleCreateAndStart} disabled={isCreating} className="btn-primary w-full py-3">
            {isCreating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Setting up encounter...</>
            ) : (
              <><Mic className="w-4 h-4" /> Create Encounter &amp; Begin</>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Active recording view — split panel
  return (
    <div className="flex flex-col h-full">
      {/* Top bar — recording controls */}
      <div className="bg-white border-b border-slate-200 px-3 py-2 flex flex-wrap items-center gap-2 sm:gap-4 no-print">
        {/* Status indicator */}
        <div className="flex items-center gap-2">
          {recState.isRecording && !recState.isPaused && <div className="recording-dot" />}
          <span className={clsx(
            'text-xs sm:text-sm font-medium',
            recState.isRecording && !recState.isPaused ? 'text-red-600' : 'text-slate-600'
          )}>
            {recState.isRecording
              ? recState.isPaused ? 'Paused' : 'Recording'
              : isGenerating ? 'Generating...' : 'Ready'}
          </span>
        </div>

        {/* Timer */}
        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-mono text-slate-600">
          <Clock className="w-3.5 h-3.5" />
          {formatTime(recState.elapsedSeconds)}
        </div>

        {/* Connection */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
          {recState.isConnected ? (
            <><Wifi className="w-3.5 h-3.5 text-emerald-500" /> Connected</>
          ) : (
            <><WifiOff className="w-3.5 h-3.5 text-slate-400" /> Disconnected</>
          )}
        </div>

        {/* Encounter ID */}
        <span className="hidden sm:inline badge-slate text-xs ml-auto">{encounter.encounter_id}</span>

        {/* Controls */}
        <div className="flex items-center gap-2 ml-auto sm:ml-0">
          {!recState.isRecording ? (
            <button onClick={handleStartRecording} className="btn-primary py-2 px-4 text-sm" disabled={isGenerating}>
              <Mic className="w-4 h-4" /> Start
            </button>
          ) : (
            <>
              {recState.isPaused ? (
                <button onClick={resumeRecording} className="btn-primary py-2 px-4 text-sm">
                  <Play className="w-4 h-4" /> Resume
                </button>
              ) : (
                <button onClick={pauseRecording} className="btn-secondary py-2 px-4 text-sm">
                  <Pause className="w-4 h-4" /> Pause
                </button>
              )}
              <button onClick={handleStopAndGenerate} className="btn-danger py-2 px-4 text-sm">
                <Square className="w-4 h-4" /> Stop &amp; Generate Note
              </button>
            </>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="mx-4 mt-3 ai-disclaimer">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span className="text-red-700">{errorMsg}</span>
        </div>
      )}

      {isGenerating && (
        <div className="mx-4 mt-3 flex items-center gap-3 p-4 rounded-xl bg-teal-50 border border-teal-200">
          <Loader2 className="w-5 h-5 text-teal-600 animate-spin" />
          <div>
            <p className="text-sm font-medium text-teal-800">Generating clinical note...</p>
            <p className="text-xs text-teal-600 mt-0.5">AI is processing the transcript and structuring your note</p>
          </div>
        </div>
      )}

      {/* Split panels — stacked on mobile, side-by-side on desktop */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Mobile tab switcher */}
        <div className="lg:hidden flex border-b border-slate-200 bg-white">
          <button
            onClick={() => setActiveTab('transcript')}
            className={clsx(
              'flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors',
              activeTab === 'transcript'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500'
            )}
          >
            Transcript ({segments.length})
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={clsx(
              'flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors',
              activeTab === 'preview'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500'
            )}
          >
            Note Preview
          </button>
        </div>

        {/* Left — Transcript */}
        <div className={clsx(
          'lg:w-1/2 border-r border-slate-200 flex flex-col',
          activeTab === 'transcript' ? 'flex-1' : 'hidden lg:flex'
        )}>
          <div className="hidden lg:flex px-4 py-3 bg-slate-50 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 w-full">
              <FileText className="w-4 h-4" />
              Live Transcript
              <span className="badge-slate ml-auto">{segments.length} segments</span>
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {segments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Mic className="w-10 h-10 mb-3 opacity-50" />
                <p className="text-sm">Transcript will appear here as you speak</p>
              </div>
            ) : (
              segments.map((seg, i) => (
                <div key={i} className="animate-slide-up" style={{ animationDelay: `${i * 0.05}s` }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={clsx(
                      'text-xs font-medium uppercase tracking-wider',
                      seg.speaker === 'physician' ? 'text-teal-600' : 'text-blue-600'
                    )}>
                      {seg.speaker === 'unknown' ? 'Speaker' : seg.speaker}
                    </span>
                    {seg.confidence > 0 && (
                      <span className="text-[10px] text-slate-400">
                        {Math.round(seg.confidence * 100)}%
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{seg.content}</p>
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>

        {/* Right — Live Note Preview (dynamically built from transcript) */}
        <div className={clsx(
          'lg:w-1/2 flex flex-col',
          activeTab === 'preview' ? 'flex-1' : 'hidden lg:flex'
        )}>
          <div className="hidden lg:flex px-4 py-3 bg-slate-50 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 w-full">
              <ClipboardIcon className="w-4 h-4" />
              Live Note Preview
              {segments.length > 0 && (
                <span className="badge-teal ml-auto text-[10px]">Auto-updating</span>
              )}
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="ai-disclaimer mb-4">
              <AlertCircle className="w-4 h-4" />
              <span>This note will be generated by AI and requires physician review before finalization.</span>
            </div>

            {segments.length === 0 ? (
              <div className="space-y-4 text-sm text-slate-400">
                <p>The note preview will build dynamically as you speak. Detected clinical content will populate into sections below.</p>
                <div className="space-y-2">
                  {NOTE_PREVIEW_SECTIONS.map((s) => (
                    <div key={s.key} className="p-3 rounded-lg border border-dashed border-slate-200">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{s.label}</span>
                      <p className="text-xs text-slate-300 mt-1 italic">Awaiting content...</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <LiveNotePreview segments={segments} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ClipboardIcon({ className }: { className?: string }) {
  return <FileText className={className} />;
}

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const parts = [];
  if (h > 0) parts.push(String(h).padStart(2, '0'));
  parts.push(String(m).padStart(2, '0'));
  parts.push(String(s).padStart(2, '0'));
  return parts.join(':');
}

// Section definitions for preview
const NOTE_PREVIEW_SECTIONS = [
  { key: 'chief_complaint', label: 'Chief Complaint' },
  { key: 'symptoms', label: 'Symptoms / HPI' },
  { key: 'medications', label: 'Medications' },
  { key: 'allergies', label: 'Allergies' },
  { key: 'exam_findings', label: 'Examination Findings' },
  { key: 'assessment', label: 'Assessment' },
  { key: 'plan', label: 'Plan' },
  { key: 'follow_up', label: 'Follow-up' },
];

// Client-side keyword extraction for live preview
const SECTION_KEYWORDS: Record<string, RegExp> = {
  chief_complaint: /(?:here|came|coming|visit)\s+(?:for|about|because|regarding)|(?:complain|concern|problem|issue|bother)/i,
  symptoms: /(?:pain|ache|fever|cough|nausea|vomit|diarrhea|fatigue|weakness|dizz|headache|shortness|swelling|rash|itch|numb|bleed|weight\s+(?:loss|gain)|insomnia|anxiety|depression|palpitation)/i,
  medications: /(?:taking|prescri|started|dose|mg|mcg|units?\b|tablets?|pills?|medication)/i,
  allergies: /(?:allerg|react(?:ion)?)/i,
  exam_findings: /(?:exam|palpat|auscultat|inspect|normal|abnormal|tender|swollen|clear|murmur|blood\s+pressure|bp\b|heart\s+rate|pulse|temperature)/i,
  assessment: /(?:diagnos|assessment|impression|suspect|consistent|likely|differential|rule\s+out)/i,
  plan: /(?:prescri|order|refer|start|increase|decrease|discontinue|recommend)/i,
  follow_up: /(?:follow.?up|return|come\s+back|weeks?\b|months?\b|call\s+if|warning|emergency)/i,
};

// Non-clinical filter
const NON_CLINICAL_REGEX = /(?:weather|traffic|parking|weekend|holiday|vacation|how\s+are\s+you|nice\s+to\s+see|have\s+a\s+good|take\s+care|insurance|copay|billing|appointment|receptionist|sorry\s+i.m\s+late)/i;

function extractLivePreview(segments: TranscriptSegment[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const key of Object.keys(SECTION_KEYWORDS)) {
    result[key] = [];
  }

  for (const seg of segments) {
    const text = seg.content.trim();
    if (!text || NON_CLINICAL_REGEX.test(text)) continue;

    for (const [section, regex] of Object.entries(SECTION_KEYWORDS)) {
      if (regex.test(text) && !result[section].includes(text)) {
        result[section].push(text);
      }
    }
  }
  return result;
}

function LiveNotePreview({ segments }: { segments: TranscriptSegment[] }) {
  const preview = extractLivePreview(segments);
  const hasAnyContent = Object.values(preview).some((arr) => arr.length > 0);

  return (
    <div className="space-y-3">
      {!hasAnyContent && (
        <p className="text-sm text-slate-400 italic mb-3">
          Listening for clinical content... speak naturally and clinical data will appear in the relevant sections below.
        </p>
      )}
      {NOTE_PREVIEW_SECTIONS.map(({ key, label }) => {
        const items = preview[key] || [];
        const hasContent = items.length > 0;
        return (
          <div
            key={key}
            className={clsx(
              'p-3 rounded-lg border transition-all duration-300',
              hasContent
                ? 'border-teal-200 bg-teal-50/40'
                : 'border-dashed border-slate-200 bg-white'
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={clsx(
                'text-xs font-semibold uppercase tracking-wider',
                hasContent ? 'text-teal-700' : 'text-slate-400'
              )}>
                {label}
              </span>
              {hasContent && (
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
              )}
            </div>
            {hasContent ? (
              <div className="space-y-1">
                {items.map((item, i) => (
                  <p key={i} className="text-xs text-slate-600 leading-relaxed animate-fade-in">
                    {item}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-300 italic">Awaiting content...</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

