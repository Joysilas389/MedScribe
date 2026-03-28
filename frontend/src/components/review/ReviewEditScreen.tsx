/**
 * ReviewEditScreen — Full note editor with section-by-section editing,
 * uncertainty highlights, version history, sign-off, and PDF export.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import type { ClinicalNote, NoteVersion } from '../../types';
import { NOTE_SECTION_LABELS, NoteSectionKey } from '../../types';
import {
  Save, Download, CheckCircle2, AlertTriangle, Edit3,
  Lock, History, ArrowLeft, Loader2, AlertCircle, X
} from 'lucide-react';
import clsx from 'clsx';

export default function ReviewEditScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [note, setNote] = useState<ClinicalNote | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [versions, setVersions] = useState<NoteVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [signingOff, setSigningOff] = useState(false);
  const [error, setError] = useState('');
  const [showSignOffConfirm, setShowSignOffConfirm] = useState(false);

  useEffect(() => {
    if (id) loadNote();
  }, [id]);

  const loadNote = async () => {
    if (!id) return;
    try {
      const n = await api.getNote(id);
      setNote(n);
    } catch {
      setError('Failed to load note.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditStart = (section: string, content: string | Record<string, unknown>) => {
    if (note?.status === 'locked') return;
    setEditingSection(section);
    setEditContent(typeof content === 'object' && content !== null ? JSON.stringify(content, null, 2) : String(content || ''));
  };

  const handleEditSave = async () => {
    if (!id || !editingSection) return;

    // Validate JSON for structured sections
    if (['review_of_systems', 'physical_examination'].includes(editingSection)) {
      try {
        JSON.parse(editContent);
      } catch {
        setError('Invalid JSON format. Please check the structure and try again.');
        return;
      }
    }

    setSaving(true);
    try {
      const updated = await api.editNote(id, {
        section: editingSection,
        content: editContent,
        change_description: `Edited ${NOTE_SECTION_LABELS[editingSection as NoteSectionKey] || editingSection}`,
      });
      setNote(updated);
      setEditingSection(null);
      setError('');
    } catch {
      setError('Failed to save edit. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOff = async () => {
    if (!id) return;
    setSigningOff(true);
    try {
      await api.signOffNote(id);
      await loadNote();
      setShowSignOffConfirm(false);
    } catch {
      setError('Sign-off failed.');
    } finally {
      setSigningOff(false);
    }
  };

  const handleExportPdf = async () => {
    if (!id) return;
    setExporting(true);
    try {
      const blob = await api.exportPdf(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MedScribe_Note_${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('PDF export failed.');
    } finally {
      setExporting(false);
    }
  };

  const loadVersions = async () => {
    if (!id) return;
    try {
      const data = await api.getNoteVersions(id);
      setVersions(data.versions);
      setShowVersions(true);
    } catch {
      setError('Failed to load version history.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    );
  }

  if (!note) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500">Note not found.</p>
        <button onClick={() => navigate('/dashboard')} className="btn-secondary mt-4">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const isLocked = note.status === 'locked' || note.status === 'signed_off';

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-4 no-print">
        <button onClick={() => navigate('/dashboard')} className="btn-icon">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-slate-800">Review Clinical Note</h1>
          <p className="text-xs text-slate-500">Version {note.current_version} • {note.status.replace('_', ' ')}</p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={loadVersions} className="btn-secondary py-2 px-3 text-sm">
            <History className="w-4 h-4" /> Versions
          </button>
          <button onClick={handleExportPdf} disabled={exporting} className="btn-secondary py-2 px-3 text-sm">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export PDF
          </button>
          {!isLocked && (
            <button onClick={() => setShowSignOffConfirm(true)} className="btn-primary py-2 px-4 text-sm">
              <CheckCircle2 className="w-4 h-4" /> Sign Off
            </button>
          )}
          {isLocked && (
            <span className="badge-green flex items-center gap-1.5 py-1.5 px-3">
              <Lock className="w-3.5 h-3.5" /> Signed &amp; Locked
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-3 ai-disclaimer">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span className="text-red-700">{error}</span>
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* AI Disclaimer */}
      <div className="mx-6 mt-4 ai-disclaimer">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <span>{note.ai_disclaimer}</span>
      </div>

      {/* Note sections */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {(Object.keys(NOTE_SECTION_LABELS) as NoteSectionKey[]).map((key) => {
            const label = NOTE_SECTION_LABELS[key];
            const content = note[key];
            const isMissing = note.missing_sections.includes(key);
            const isUncertain = note.uncertain_fields.includes(key);
            const isEditing = editingSection === key;

            return (
              <div
                key={key}
                className={clsx(
                  isLocked ? 'note-section-locked' :
                  isMissing ? 'note-section-missing' :
                  isUncertain ? 'note-section-uncertain' :
                  'note-section'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="section-header flex items-center gap-2">
                    {label}
                    {isMissing && <span className="badge-amber text-[10px]">Not Discussed</span>}
                    {isUncertain && <span className="badge-amber text-[10px]">Uncertain</span>}
                  </h3>
                  {!isLocked && !isEditing && (
                    <button
                      onClick={() => handleEditStart(key, content as string)}
                      className="btn-icon p-1.5"
                      aria-label={`Edit ${label}`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full min-h-[120px] p-3 rounded-lg border border-teal-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
                      autoFocus
                    />
                    <div className="flex gap-2 mt-2">
                      <button onClick={handleEditSave} disabled={saving} className="btn-primary py-1.5 px-3 text-sm">
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Save
                      </button>
                      <button onClick={() => setEditingSection(null)} className="btn-secondary py-1.5 px-3 text-sm">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {typeof content === 'object' && content !== null
                      ? Object.entries(content as Record<string, string>).map(([k, v]) => (
                          <div key={k} className="mb-1">
                            <span className="font-medium text-slate-600">{k.replace(/_/g, ' ')}:</span> {v}
                          </div>
                        ))
                      : (content as string) || '[No content]'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sign-off confirmation modal */}
      {showSignOffConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="card p-6 w-full max-w-md mx-4 animate-slide-up">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Confirm Sign-Off</h3>
            <p className="text-sm text-slate-600 mb-4">
              By signing off, you confirm that you have reviewed this AI-generated note,
              made any necessary edits, and approve it as part of the clinical record.
              The note will be locked from further edits.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowSignOffConfirm(false)} className="btn-secondary py-2 px-4 text-sm">
                Cancel
              </button>
              <button onClick={handleSignOff} disabled={signingOff} className="btn-primary py-2 px-4 text-sm">
                {signingOff ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Sign Off &amp; Lock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version history panel */}
      {showVersions && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="card p-6 w-full max-w-lg mx-4 mb-4 sm:mb-0 max-h-[70vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">Version History</h3>
              <button onClick={() => setShowVersions(false)} className="btn-icon"><X className="w-5 h-5" /></button>
            </div>
            {versions.length === 0 ? (
              <p className="text-sm text-slate-500">No version history yet.</p>
            ) : (
              <div className="space-y-3">
                {versions.map((v) => (
                  <div key={v.version_number} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">Version {v.version_number}</span>
                      <span className="text-xs text-slate-400">{new Date(v.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{v.change_description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
