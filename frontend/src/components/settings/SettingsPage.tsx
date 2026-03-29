/**
 * SettingsPage — Profile management, language preferences, template selection.
 */

import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import type { SpecialtyTemplate } from '../../types';
import { SUPPORTED_LANGUAGES } from '../../types';
import {
  User, Globe, Layout, Save, Loader2, CheckCircle2, Moon, Sun, Info, Shield
} from 'lucide-react';

export default function SettingsPage() {
  const { user, refreshProfile } = useAuth();
  const [templates, setTemplates] = useState<SpecialtyTemplate[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    credentials: user?.credentials || '',
    specialty: user?.specialty || '',
    institution: user?.institution || '',
    preferred_language: user?.preferred_language || 'en',
    preferred_template: user?.preferred_template || 'general_practice',
  });

  useEffect(() => {
    api.listTemplates().then(setTemplates).catch(() => {});
  }, []);

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name,
        credentials: user.credentials,
        specialty: user.specialty,
        institution: user.institution,
        preferred_language: user.preferred_language,
        preferred_template: user.preferred_template,
      });
    }
  }, [user]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await api.updateProfile(form);
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Settings</h1>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Profile */}
        <section className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <User className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-semibold text-slate-800">Profile</h2>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input value={form.full_name} onChange={(e) => update('full_name', e.target.value)}
                       className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Credentials</label>
                <input value={form.credentials} onChange={(e) => update('credentials', e.target.value)}
                       className="input-field" placeholder="MD, FACP" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Specialty</label>
                <input value={form.specialty} onChange={(e) => update('specialty', e.target.value)}
                       className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Institution</label>
                <input value={form.institution} onChange={(e) => update('institution', e.target.value)}
                       className="input-field" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input value={user?.email || ''} disabled className="input-field bg-slate-50 text-slate-400 cursor-not-allowed" />
              <p className="text-xs text-slate-400 mt-1">Email cannot be changed</p>
            </div>
          </div>
        </section>

        {/* Language Preferences */}
        <section className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Globe className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-semibold text-slate-800">Language</h2>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Preferred Output Language</label>
            <select value={form.preferred_language} onChange={(e) => update('preferred_language', e.target.value)}
                    className="input-field w-64">
              {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">Default language for generated clinical notes</p>
          </div>
        </section>

        {/* Template Preferences */}
        <section className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Layout className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-semibold text-slate-800">Default Template</h2>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Default Specialty Template</label>
            <select value={form.preferred_template} onChange={(e) => update('preferred_template', e.target.value)}
                    className="input-field w-64">
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">Used as default when creating new encounters</p>
          </div>
        </section>

        {/* Dark / Light Mode */}
        <section className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Moon className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-semibold text-slate-800">Appearance</h2>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Dark Mode</p>
              <p className="text-xs text-slate-400 mt-0.5">Switch between light and dark theme</p>
            </div>
            <button
              type="button"
              onClick={() => {
                document.documentElement.classList.toggle('dark');
                const isDark = document.documentElement.classList.contains('dark');
                localStorage.setItem('medscribe_theme', isDark ? 'dark' : 'light');
              }}
              className="btn-secondary py-2 px-4 text-sm"
            >
              <Sun className="w-4 h-4" /> / <Moon className="w-4 h-4" /> Toggle
            </button>
          </div>
        </section>

        {/* How to Use */}
        <section className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Info className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-semibold text-slate-800">How to Use MedScribe</h2>
          </div>
          <div className="space-y-3 text-sm text-slate-600">
            <div className="flex gap-3"><span className="font-bold text-teal-600 flex-shrink-0">1.</span><span><strong>Create Encounter</strong> — Enter patient details, select specialty, tick consent checkbox, and create.</span></div>
            <div className="flex gap-3"><span className="font-bold text-teal-600 flex-shrink-0">2.</span><span><strong>Input Transcript</strong> — Type/paste the conversation in the &quot;Type Input&quot; tab, or use &quot;Record&quot; for live audio capture (requires OpenAI Whisper API key).</span></div>
            <div className="flex gap-3"><span className="font-bold text-teal-600 flex-shrink-0">3.</span><span><strong>Generate Note</strong> — Tap &quot;Generate Note&quot; and the AI structures the conversation into a professional clinical note with all sections.</span></div>
            <div className="flex gap-3"><span className="font-bold text-teal-600 flex-shrink-0">4.</span><span><strong>Review &amp; Edit</strong> — Review every section. Edit any field by tapping the pencil icon. The AI also suggests evidence-based management plans.</span></div>
            <div className="flex gap-3"><span className="font-bold text-teal-600 flex-shrink-0">5.</span><span><strong>Sign Off</strong> — Once satisfied, sign off to lock the note. This creates a permanent clinical record.</span></div>
            <div className="flex gap-3"><span className="font-bold text-teal-600 flex-shrink-0">6.</span><span><strong>Export PDF</strong> — Download a professionally formatted PDF with all sections, SBAR summary, timestamps, and your digital signature.</span></div>
          </div>
        </section>

        {/* Disclaimer */}
        <section className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Shield className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-slate-800">Disclaimer</h2>
          </div>
          <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
            <p><strong>MedScribe is a clinical documentation assistant, NOT a clinical decision-making tool.</strong></p>
            <p>AI-generated content including recommended plans, differential diagnoses, and SBAR summaries are suggestions based on the transcript provided. They do not replace clinical judgment, physical examination, or professional medical decision-making.</p>
            <p>The physician is solely responsible for verifying all AI-generated content, making clinical decisions, and ensuring accuracy before signing off on any clinical note.</p>
            <p>MedScribe does not diagnose, prescribe, or recommend treatment. It documents what is discussed during clinical encounters and structures it into professional medical notes.</p>
            <p className="text-xs text-slate-400 mt-2">By using this application, you acknowledge and accept these terms.</p>
          </div>
        </section>

        {/* Save button */}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="btn-primary py-2.5 px-6">
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
            ) : (
              <><Save className="w-4 h-4" /> Save Settings</>
            )}
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600 animate-fade-in">
              <CheckCircle2 className="w-4 h-4" /> Settings saved
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
