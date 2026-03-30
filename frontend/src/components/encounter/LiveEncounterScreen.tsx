import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import api from '../../services/api';
import type { Encounter, EncounterCreateRequest } from '../../types';
import {
  Mic, Pause, Play, Square, Clock,
  AlertCircle, FileText, Loader2, Shield
} from 'lucide-react';
import clsx from 'clsx';
import { SUPPORTED_LANGUAGES } from '../../types';

const SPECIALTIES = [
  { value: 'general_practice', label: 'General Practice / Family Medicine' },
  { value: 'internal_medicine', label: 'Internal Medicine' },
  { value: 'emergency_medicine', label: 'Emergency Medicine' },
  { value: 'pediatrics', label: 'Pediatrics' },
  { value: 'surgery', label: 'General Surgery' },
  { value: 'orthopedics', label: 'Orthopedics' },
  { value: 'obstetrics_gynecology', label: 'Obstetrics & Gynecology' },
  { value: 'psychiatry', label: 'Psychiatry' },
  { value: 'cardiology', label: 'Cardiology' },
  { value: 'neurology', label: 'Neurology' },
  { value: 'pulmonology', label: 'Pulmonology' },
  { value: 'gastroenterology', label: 'Gastroenterology' },
  { value: 'nephrology', label: 'Nephrology' },
  { value: 'endocrinology', label: 'Endocrinology' },
  { value: 'dermatology', label: 'Dermatology' },
  { value: 'ophthalmology', label: 'Ophthalmology' },
  { value: 'ent', label: 'ENT / Otolaryngology' },
  { value: 'urology', label: 'Urology' },
  { value: 'oncology', label: 'Oncology' },
  { value: 'hematology', label: 'Hematology' },
  { value: 'rheumatology', label: 'Rheumatology' },
  { value: 'infectious_disease', label: 'Infectious Disease' },
  { value: 'anesthesiology', label: 'Anesthesiology' },
  { value: 'radiology', label: 'Radiology' },
  { value: 'palliative_care', label: 'Palliative Care' },
  { value: 'rehabilitation', label: 'Physical Medicine & Rehab' },
  { value: 'sports_medicine', label: 'Sports Medicine' },
  { value: 'geriatrics', label: 'Geriatrics' },
  { value: 'neonatology', label: 'Neonatology' },
  { value: 'telemedicine', label: 'Telemedicine' },
];

const NOTE_SECTIONS = [
  'Chief Complaint', 'Symptoms / HPI', 'Medications', 'Allergies',
  'Nutritional History', 'Immunization History', 'Examination Findings',
  'Assessment', 'Plan', 'Follow-up',
];

function formatTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p: string[] = [];
  if (h > 0) p.push(String(h).padStart(2, '0'));
  p.push(String(m).padStart(2, '0'));
  p.push(String(sec).padStart(2, '0'));
  return p.join(':');
}

export default function LiveEncounterScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'manual' | 'transcript' | 'preview'>('manual');
  const [manualTranscript, setManualTranscript] = useState('');
  const [encounterMode, setEncounterMode] = useState<'regular' | 'emergency' | 'trauma'>('regular');

  const [formData, setFormData] = useState<EncounterCreateRequest>({
    patient_name: '', patient_dob: '', patient_mrn: '',
    specialty_template: user?.preferred_template || 'general_practice',
    encounter_type: 'regular',
    spoken_language: 'en',
    output_language: user?.preferred_language || 'en',
  });

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const encounterId = encounter?.id || '';

  const {
    state: recState, segments, isSupported: isSpeechSupported,
    startRecording, stopRecording, pauseRecording, resumeRecording,
  } = useAudioRecorder({
    encounterId,
    language: ({ en:'en-US', es:'es-ES', fr:'fr-FR', pt:'pt-PT', ar:'ar-SA', zh:'zh-CN', hi:'hi-IN', sw:'sw-KE' }[formData.spoken_language] || 'en-US'),
    onError: (err) => setErrorMsg(err),
  });

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [segments]);

  useEffect(() => {
    if (id && id !== 'new') {
      api.getEncounter(id).then(setEncounter).catch(() => setErrorMsg('Encounter not found'));
    }
  }, [id]);

  // --- Handlers ---

  const handleCreateAndStart = async () => {
    setIsCreating(true);
    setErrorMsg('');
    try {
      const enc = await api.createEncounter(formData);
      setEncounter(enc);
      await api.recordConsent(enc.id, true, formData.patient_name || 'Patient');
    } catch {
      setErrorMsg('Failed to create encounter.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartRecording = async () => {
    if (!consentChecked) {
      setErrorMsg('Patient consent must be confirmed before recording.');
      return;
    }
    await startRecording();
  };

  const handleStopAndGenerate = async () => {
    stopRecording();
    if (!encounter) return;
    setIsGenerating(true);
    // Small delay to let the WebSocket 'stop' message flush before generating
    await new Promise(r => setTimeout(r, 600));
    try {
      await api.generateNote(encounter.id);
      navigate(`/review/${encounter.id}`);
    } catch {
      setErrorMsg('Note generation failed.');
      setIsGenerating(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!encounter) return;
    if (manualTranscript.trim().length < 20) {
      setErrorMsg('Please enter at least a few sentences of the conversation.');
      return;
    }
    setIsGenerating(true);
    setErrorMsg('');
    try {
      await api.submitManualTranscript(encounter.id, manualTranscript, encounterMode);
      await api.generateNote(encounter.id);
      navigate(`/review/${encounter.id}`);
    } catch {
      setErrorMsg('Note generation failed. Please try again.');
      setIsGenerating(false);
    }
  };

  // =============================
  // SCREEN 1: ENCOUNTER SETUP
  // =============================
  if (!encounter) {
    return (
      <div className="p-5 lg:p-8 max-w-2xl mx-auto overflow-y-auto">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">New Encounter</h1>
        <p className="text-slate-500 mb-6 text-sm">Set up encounter details</p>

        {errorMsg && (
          <div className="flex items-center gap-2 p-3 mb-5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="card p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Patient Name</label>
              <input value={formData.patient_name}
                onChange={(e) => setFormData(f => ({ ...f, patient_name: e.target.value }))}
                className="input-field" placeholder="Patient name (optional)" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">MRN</label>
              <input value={formData.patient_mrn}
                onChange={(e) => setFormData(f => ({ ...f, patient_mrn: e.target.value }))}
                className="input-field" placeholder="Medical Record Number" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth</label>
              <input type="date" value={formData.patient_dob}
                onChange={(e) => setFormData(f => ({ ...f, patient_dob: e.target.value }))}
                className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Specialty Template</label>
              <select value={formData.specialty_template}
                onChange={(e) => setFormData(f => ({ ...f, specialty_template: e.target.value }))}
                className="input-field">
                {SPECIALTIES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Encounter Mode */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Encounter Mode</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'regular', label: 'Regular Clerking', desc: 'Standard clinical encounter' },
                { value: 'emergency', label: 'Emergency', desc: 'Emergency with ABCDE survey' },
                { value: 'trauma', label: 'Trauma', desc: 'Primary & secondary survey' },
              ] as const).map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setEncounterMode(mode.value)}
                  className={clsx(
                    'p-3 rounded-xl border-2 text-left transition-all',
                    encounterMode === mode.value
                      ? mode.value === 'regular' ? 'border-teal-500 bg-teal-50' : 'border-red-500 bg-red-50'
                      : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <p className={clsx('text-xs font-semibold leading-tight',
                    encounterMode === mode.value
                      ? mode.value === 'regular' ? 'text-teal-700' : 'text-red-700'
                      : 'text-slate-700'
                  )}>{mode.label}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight line-clamp-2">{mode.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Spoken Language</label>
              <select value={formData.spoken_language}
                onChange={(e) => setFormData(f => ({ ...f, spoken_language: e.target.value }))}
                className="input-field">
                {Object.entries(SUPPORTED_LANGUAGES).map(([c, n]) => (
                  <option key={c} value={c}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Output Language</label>
              <select value={formData.output_language}
                onChange={(e) => setFormData(f => ({ ...f, output_language: e.target.value }))}
                className="input-field">
                {Object.entries(SUPPORTED_LANGUAGES).map(([c, n]) => (
                  <option key={c} value={c}>{n}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Consent Checkbox */}
          <div className="p-4 rounded-xl bg-teal-50 border border-teal-200">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-teal-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-teal-800 mb-1">Patient Consent</p>
                <p className="text-xs text-teal-600 mb-3">
                  Before using AI-assisted documentation, obtain verbal or written consent from the patient.
                </p>
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-teal-400 text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                  <span className="text-sm text-teal-800 leading-snug">
                    I confirm that I have informed the patient about AI-assisted clinical documentation
                    and have obtained their consent to proceed.
                  </span>
                </label>
              </div>
            </div>
          </div>

          <button
            onClick={handleCreateAndStart}
            disabled={isCreating || !consentChecked}
            className="btn-primary w-full py-3"
          >
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

  // =============================
  // SCREEN 2: ACTIVE ENCOUNTER
  // =============================
  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 56px)' }}>
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-3 py-2 flex items-center gap-2 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          {recState.isRecording && !recState.isPaused && <div className="recording-dot" />}
          <span className={clsx('text-xs font-medium',
            recState.isRecording && !recState.isPaused ? 'text-red-600' : 'text-slate-600'
          )}>
            {recState.isRecording ? (recState.isPaused ? 'Paused' : 'Rec') : isGenerating ? 'Generating...' : 'Ready'}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs font-mono text-slate-500">
          <Clock className="w-3 h-3" />
          {formatTime(recState.elapsedSeconds)}
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          {!recState.isRecording ? (
            <button onClick={handleStartRecording} className="btn-primary py-1.5 px-3 text-xs" disabled={isGenerating}>
              <Mic className="w-3.5 h-3.5" /> Record
            </button>
          ) : (
            <>
              {recState.isPaused ? (
                <button onClick={resumeRecording} className="btn-primary py-1.5 px-3 text-xs">
                  <Play className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button onClick={pauseRecording} className="btn-secondary py-1.5 px-3 text-xs">
                  <Pause className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={handleStopAndGenerate} className="btn-danger py-1.5 px-3 text-xs">
                <Square className="w-3.5 h-3.5" /> Stop
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error / generating banners */}
      {errorMsg && (
        <div className="mx-3 mt-2 flex items-center gap-2 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex-shrink-0">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {isGenerating && (
        <div className="mx-3 mt-2 flex items-center gap-2 p-3 rounded-xl bg-teal-50 border border-teal-200 flex-shrink-0">
          <Loader2 className="w-4 h-4 text-teal-600 animate-spin flex-shrink-0" />
          <span className="text-sm font-medium text-teal-800">Generating clinical note...</span>
        </div>
      )}

      {/* Tab panels */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Mobile tab bar */}
        <div className="lg:hidden flex border-b border-slate-200 bg-white flex-shrink-0">
          {(['manual', 'transcript', 'preview'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={clsx('flex-1 py-2.5 text-xs font-medium text-center border-b-2',
                activeTab === tab ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500'
              )}>
              {tab === 'manual' ? 'Type Input' : tab === 'transcript' ? `Live (${segments.length})` : 'Preview'}
            </button>
          ))}
        </div>

        {/* PANEL: Manual Input */}
        <div className={clsx('lg:w-1/3 flex flex-col min-h-0 lg:border-r border-slate-200',
          activeTab === 'manual' ? 'flex-1' : 'hidden lg:flex'
        )}>
          <div className="hidden lg:block px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex-shrink-0">
            <h3 className="text-sm font-semibold text-slate-700">Type / Paste Transcript</h3>
          </div>
          <div className="flex-1 flex flex-col p-3 min-h-0">
            <p className="text-xs text-slate-500 mb-2 flex-shrink-0">
              Type or paste the doctor-patient conversation. The AI will structure it into a clinical note.
            </p>
            <textarea
              value={manualTranscript}
              onChange={(e) => setManualTranscript(e.target.value)}
              placeholder={`[Doctor]: What brings you in today?\n[Patient]: I've had chest pain for two days. Sharp on the left side.\n[Doctor]: Any shortness of breath?\n[Patient]: Yes, especially climbing stairs.\n[Doctor]: Current medications?\n[Patient]: Aspirin 81mg daily.\n[Doctor]: Allergies?\n[Patient]: Penicillin — causes rash.\n[Doctor]: Heart sounds regular, lungs clear.\n[Doctor]: Likely costochondritis. Ordering ECG.\n[Doctor]: Follow up in one week.`}
              className="flex-1 min-h-[180px] w-full p-3 rounded-xl border border-slate-200 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
            <div className="flex items-center gap-2 mt-2 flex-shrink-0">
              <span className="text-[11px] text-slate-400">{manualTranscript.length} chars</span>
              <button onClick={handleManualSubmit}
                disabled={isGenerating || manualTranscript.trim().length < 20}
                className="btn-primary py-2 px-4 text-sm ml-auto">
                {isGenerating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                ) : (
                  <><FileText className="w-4 h-4" /> Generate Note</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* PANEL: Live Transcript */}
        <div className={clsx('lg:w-1/3 lg:border-r border-slate-200 flex flex-col min-h-0',
          activeTab === 'transcript' ? 'flex-1' : 'hidden lg:flex'
        )}>
          <div className="hidden lg:block px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex-shrink-0">
            <h3 className="text-sm font-semibold text-slate-700">Live Transcript</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {segments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center px-4">
                <Mic className="w-10 h-10 mb-3 opacity-40" />
                {!isSpeechSupported ? (
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-left">
                    <p className="text-xs font-medium text-amber-700">Browser not supported</p>
                    <p className="text-xs text-amber-600 mt-1">Live recording requires Chrome or Edge. Please use the &quot;Type Input&quot; tab to paste your transcript manually.</p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm">Tap &quot;Record&quot; to capture live audio</p>
                    <p className="text-xs mt-2">Uses your browser&apos;s built-in speech recognition — no API key needed</p>
                    <p className="text-xs mt-1 text-slate-300">Or use &quot;Type Input&quot; to enter text manually</p>
                  </>
                )}
              </div>
            ) : (
              segments.map((seg, i) => (
                <div key={i}>
                  <span className={clsx('text-xs font-medium uppercase',
                    seg.speaker === 'physician' ? 'text-teal-600' : 'text-blue-600'
                  )}>
                    {seg.speaker === 'unknown' ? 'Speaker' : seg.speaker}
                  </span>
                  <p className="text-sm text-slate-700 mt-0.5 leading-relaxed">{seg.content}</p>
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>

        {/* PANEL: Note Preview */}
        <div className={clsx('lg:w-1/3 flex flex-col min-h-0',
          activeTab === 'preview' ? 'flex-1' : 'hidden lg:flex'
        )}>
          <div className="hidden lg:block px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex-shrink-0">
            <h3 className="text-sm font-semibold text-slate-700">Note Preview</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs mb-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>AI-generated note requires physician review before finalization.</span>
            </div>
            <div className="space-y-2">
              {NOTE_SECTIONS.map((label) => (
                <div key={label} className="p-3 rounded-lg border border-dashed border-slate-200">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
                  <p className="text-xs text-slate-300 mt-1 italic">Awaiting content...</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
