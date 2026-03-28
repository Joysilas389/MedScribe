/**
 * EncounterHistory — Searchable, filterable list of past encounters with status indicators.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import type { Encounter } from '../../types';
import {
  Filter, FileText,
  ChevronLeft, ChevronRight, Loader2, Mic
} from 'lucide-react';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'recording', label: 'Recording' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'signed_off', label: 'Signed Off' },
  { value: 'amended', label: 'Amended' },
];

const STATUS_BADGES: Record<string, { label: string; class: string }> = {
  recording: { label: 'Recording', class: 'badge-red' },
  paused: { label: 'Paused', class: 'badge-amber' },
  transcribing: { label: 'Transcribing', class: 'badge-amber' },
  generating_note: { label: 'Generating', class: 'badge-amber' },
  pending_review: { label: 'Pending Review', class: 'badge-amber' },
  signed_off: { label: 'Signed Off', class: 'badge-green' },
  amended: { label: 'Amended', class: 'badge-slate' },
};

export default function EncounterHistory() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [loading, setLoading] = useState(true);
  const pageSize = 15;

  useEffect(() => {
    loadEncounters();
  }, [page, statusFilter]);

  const loadEncounters = async () => {
    setLoading(true);
    try {
      const data = await api.listEncounters(page, pageSize, statusFilter || undefined);
      setEncounters(data.encounters);
      setTotal(data.total);
    } catch { /* empty state */ }
    finally { setLoading(false); }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Encounter History</h1>
          <p className="text-slate-500 mt-1">{total} encounters total</p>
        </div>
        <button onClick={() => navigate('/encounter/new')} className="btn-primary">
          <Mic className="w-4 h-4" /> New Encounter
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="input-field py-2 w-48"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
        </div>
      ) : encounters.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">No encounters found</p>
          <p className="text-sm text-slate-400 mt-1">
            {statusFilter ? 'Try changing the filter' : 'Start a recording to create your first encounter'}
          </p>
        </div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Encounter</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Template</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Duration</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {encounters.map((enc) => {
                  const badge = STATUS_BADGES[enc.status] || { label: enc.status, class: 'badge-slate' };
                  return (
                    <tr
                      key={enc.id}
                      onClick={() => {
                        if (['pending_review', 'signed_off', 'locked', 'amended'].includes(enc.status)) {
                          navigate(`/review/${enc.id}`);
                        } else {
                          navigate(`/encounter/${enc.id}`);
                        }
                      }}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-slate-800">{enc.encounter_id}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">{enc.specialty_template.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">{Math.floor(enc.duration_seconds / 60)} min</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={badge.class}>{badge.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-500">
                          {formatDistanceToNow(new Date(enc.created_at), { addSuffix: true })}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-slate-500">
                Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-icon"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn-icon"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
