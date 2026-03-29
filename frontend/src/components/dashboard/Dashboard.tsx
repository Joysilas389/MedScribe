/**
 * Dashboard — Overview of recent encounters, pending reviews, quick-start new encounter.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import type { Encounter, EncounterListResponse } from '../../types';
import {
  Mic, FileText, Clock, CheckCircle2, AlertTriangle,
  ArrowRight, Plus, Activity, Loader2
} from 'lucide-react';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  recording: { label: 'Recording', color: 'badge-red', icon: Mic },
  paused: { label: 'Paused', color: 'badge-amber', icon: Clock },
  transcribing: { label: 'Transcribing', color: 'badge-amber', icon: Activity },
  generating_note: { label: 'Generating', color: 'badge-amber', icon: Activity },
  pending_review: { label: 'Pending Review', color: 'badge-amber', icon: AlertTriangle },
  signed_off: { label: 'Signed Off', color: 'badge-green', icon: CheckCircle2 },
  amended: { label: 'Amended', color: 'badge-slate', icon: FileText },
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [stats, setStats] = useState({ total: 0, pendingReview: 0, signedOff: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data: EncounterListResponse = await api.listEncounters(1, 10);
      setEncounters(data.encounters);

      // Fetch accurate counts from API with status filters
      let pendingCount = 0;
      let signedCount = 0;
      try {
        const pendingData = await api.listEncounters(1, 1, 'pending_review');
        pendingCount = pendingData.total;
        const signedData = await api.listEncounters(1, 1, 'signed_off');
        signedCount = signedData.total;
      } catch {
        // Fall back to counting from current page
        pendingCount = data.encounters.filter((e) => e.status === 'pending_review').length;
        signedCount = data.encounters.filter((e) => e.status === 'signed_off').length;
      }

      setStats({
        total: data.total,
        pendingReview: pendingCount,
        signedOff: signedCount,
      });
    } catch {
      // Graceful degradation — show empty state
    } finally {
      setLoading(false);
    }
  };

  const handleNewEncounter = () => navigate('/encounter/new');

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Good {getGreeting()}, {user?.full_name?.split(' ')[0]}
          </h1>
          <p className="text-slate-500 mt-1">Here&apos;s your clinical documentation overview</p>
        </div>
        <button onClick={handleNewEncounter} className="btn-primary">
          <Plus className="w-4 h-4" />
          New Encounter
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Total Encounters"
          value={stats.total}
          icon={FileText}
          color="teal"
        />
        <StatCard
          label="Pending Review"
          value={stats.pendingReview}
          icon={AlertTriangle}
          color="amber"
          onClick={() => navigate('/history?status=pending_review')}
        />
        <StatCard
          label="Signed Off"
          value={stats.signedOff}
          icon={CheckCircle2}
          color="emerald"
        />
      </div>

      {/* Quick-start card */}
      <div className="card p-5 sm:p-6 mb-8 bg-gradient-to-r from-teal-50 to-cyan-50 border-teal-200/60">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-teal-600 flex items-center justify-center shadow-lg shadow-teal-600/20 flex-shrink-0">
            <Mic className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-base sm:text-lg font-semibold text-slate-800">Start a New Encounter</h3>
            <p className="text-sm text-slate-600 mt-0.5">
              Begin recording a clinical conversation. MedScribe will transcribe and generate structured notes.
            </p>
          </div>
          <button onClick={handleNewEncounter} className="btn-primary w-full sm:w-auto flex-shrink-0">
            Start Recording
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Recent encounters */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Recent Encounters</h2>
          <button
            onClick={() => navigate('/history')}
            className="text-sm text-teal-600 hover:text-teal-700 font-medium"
          >
            View all
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
          </div>
        ) : encounters.length === 0 ? (
          <div className="card p-12 text-center">
            <Mic className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No encounters yet</p>
            <p className="text-sm text-slate-400 mt-1">Start your first recording to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {encounters.map((encounter) => {
              const cfg = STATUS_CONFIG[encounter.status] || STATUS_CONFIG.recording;
              const Icon = cfg.icon;
              return (
                <div
                  key={encounter.id}
                  onClick={() => {
                    if (['pending_review', 'signed_off', 'locked', 'amended'].includes(encounter.status)) {
                      navigate(`/review/${encounter.id}`);
                    } else {
                      navigate(`/encounter/${encounter.id}`);
                    }
                  }}
                  className="card-hover p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {encounter.encounter_id}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {encounter.specialty_template.replace(/_/g, ' ')} • {formatDuration(encounter.duration_seconds)}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0 hidden sm:block" />
                  </div>
                  <div className="flex items-center gap-2 mt-2 ml-13 pl-[52px]">
                    <span className={clsx(cfg.color)}>{cfg.label}</span>
                    <span className="text-xs text-slate-400">
                      {formatDistanceToNow(new Date(encounter.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, onClick }: {
  label: string; value: number; icon: typeof Clock; color: string; onClick?: () => void;
}) {
  return (
    <div onClick={onClick} className={clsx('card p-5', onClick && 'cursor-pointer hover:shadow-md transition-shadow')}>
      <div className="flex items-center gap-3 mb-3">
        <div className={clsx(
          'w-9 h-9 rounded-lg flex items-center justify-center',
          color === 'teal' && 'bg-teal-100 text-teal-600',
          color === 'amber' && 'bg-amber-100 text-amber-600',
          color === 'emerald' && 'bg-emerald-100 text-emerald-600',
        )}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        <span className="text-sm text-slate-500">{label}</span>
      </div>
      <p className="text-3xl font-bold text-slate-800">{value}</p>
    </div>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return '0 min';
  const m = Math.floor(seconds / 60);
  return `${m} min`;
}
