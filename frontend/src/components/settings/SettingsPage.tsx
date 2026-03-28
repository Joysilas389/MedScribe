/**
 * SettingsPage — Profile management, language preferences, template selection.
 */

import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import type { SpecialtyTemplate } from '../../types';
import { SUPPORTED_LANGUAGES } from '../../types';
import {
  User, Globe, Layout, Save, Loader2, CheckCircle2
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
