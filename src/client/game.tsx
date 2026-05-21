import './index.css';
import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { VerdictData, VerdictActionRequest } from '../shared/api';

const RISK_COLORS = {
  high: { bg: 'bg-red-950', border: 'border-red-500', text: 'text-red-400', badge: 'bg-red-500' },
  medium: { bg: 'bg-yellow-950', border: 'border-yellow-500', text: 'text-yellow-400', badge: 'bg-yellow-500' },
  low: { bg: 'bg-green-950', border: 'border-green-500', text: 'text-green-400', badge: 'bg-green-500' },
};

const ACTION_LABELS: Record<string, string> = {
  removelink: 'Post Removed',
  removecomment: 'Comment Removed',
  approvelink: 'Post Approved',
  approvecomment: 'Comment Approved',
  banuser: 'Banned',
  unbanuser: 'Unbanned',
  muteuser: 'Muted',
  warnuser: 'Warned',
  addnote: 'Note Added',
  note: 'Note',
};

function getParams(): { targetId: string | null; targetType: 'post' | 'comment' } {
  const params = new URLSearchParams(window.location.search);
  const targetId = params.get('targetId');
  const targetType = (params.get('targetType') ?? 'post') as 'post' | 'comment';
  return { targetId, targetType };
}

function RiskBadge({ level }: { level: 'low' | 'medium' | 'high' }) {
  const colors = RISK_COLORS[level];
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-white text-sm font-bold uppercase tracking-wider ${colors.badge}`}>
      {level} risk
    </span>
  );
}

function StatPill({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`flex flex-col items-center px-4 py-3 rounded-xl ${highlight ? 'bg-red-900 border border-red-600' : 'bg-gray-800'}`}>
      <span className={`text-xl font-bold ${highlight ? 'text-red-300' : 'text-white'}`}>{value}</span>
      <span className="text-xs text-gray-400 mt-1">{label}</span>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">{title}</h2>
  );
}

export const App = () => {
  const [verdict, setVerdict] = useState<VerdictData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');

  const { targetId, targetType } = getParams();

  useEffect(() => {
    if (!targetId) {
      setError('No target specified. Open Verdict from a post or comment menu.');
      setLoading(false);
      return;
    }
    fetch(`/api/verdict?targetId=${targetId}&targetType=${targetType}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.type === 'verdict') setVerdict(data.data);
        else setError(data.message ?? 'Failed to load verdict');
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [targetId, targetType]);

  const takeAction = async (action: VerdictActionRequest['action'], note?: string) => {
    if (!targetId || !verdict) return;
    setActionLoading(true);
    setActionStatus(null);
    try {
      const res = await fetch('/api/verdict/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId, action, note } satisfies VerdictActionRequest),
      });
      const data = await res.json();
      setActionStatus(data.message);
    } catch (e) {
      setActionStatus(`Error: ${e}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-gray-400 gap-4">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Assembling verdict...</p>
      </div>
    );
  }

  if (error || !verdict) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-red-400 gap-3 px-6">
        <p className="text-lg font-bold">Could not load Verdict</p>
        <p className="text-sm text-center text-gray-500">{error}</p>
      </div>
    );
  }

  const { userSignals, modHistory, summary, reporters, targetContent, reportReasons } = verdict;
  const colors = RISK_COLORS[summary.riskLevel];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 pb-32">

      {/* Header */}
      <div className={`px-5 pt-6 pb-5 border-b-2 ${colors.border} ${colors.bg}`}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono text-gray-500 uppercase tracking-widest">Verdict</span>
          <RiskBadge level={summary.riskLevel} />
        </div>
        <p className="text-base font-semibold text-white leading-snug">{summary.plainEnglish}</p>
        <p className={`text-xs mt-2 ${colors.text}`}>Driven by: {summary.riskReason}</p>
      </div>

      {/* Reported content */}
      {targetContent && (
        <div className="mx-5 mt-4 px-4 py-3 bg-gray-800 rounded-xl border border-gray-700">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Reported {targetType}</p>
          <p className="text-sm text-gray-200 line-clamp-3">{targetContent}</p>
          {reportReasons.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {reportReasons.map((r, i) => (
                <span key={i} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{r}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex mx-5 mt-5 gap-2">
        {(['overview', 'history'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === tab ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {tab === 'overview' ? 'User Signals' : `Mod History (${modHistory.length})`}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="px-5 mt-5 space-y-5">
          <div>
            <SectionHeader title="u/{userSignals.username}" />
            <div className="grid grid-cols-3 gap-3">
              <StatPill label="Account Age" value={userSignals.accountAgeDays < 30 ? `${userSignals.accountAgeDays}d` : `${Math.floor(userSignals.accountAgeDays / 30)}mo`} highlight={userSignals.accountAgeDays < 7} />
              <StatPill label="Recent Posts" value={userSignals.recentPostCount} />
              <StatPill label="Removal Rate" value={`${userSignals.removalRate}%`} highlight={userSignals.removalRate >= 50} />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <StatPill label="Removed" value={userSignals.recentRemovalCount} highlight={userSignals.recentRemovalCount >= 3} />
              <StatPill label="Approved" value={userSignals.recentApprovalCount} />
            </div>

            {userSignals.isFirstPost && (
              <div className="mt-3 flex items-center gap-2 px-4 py-3 bg-blue-950 border border-blue-700 rounded-xl">
                <span className="text-blue-400 text-lg">🆕</span>
                <span className="text-sm text-blue-300">First post in this community</span>
              </div>
            )}

            {userSignals.postingAccelerating && (
              <div className="mt-3 flex items-center gap-2 px-4 py-3 bg-orange-950 border border-orange-700 rounded-xl">
                <span className="text-orange-400 text-lg">⚡</span>
                <span className="text-sm text-orange-300">Posting frequency is accelerating</span>
              </div>
            )}

            {userSignals.uniqueDomains.length > 0 && (
              <div className="mt-3 px-4 py-3 bg-gray-800 rounded-xl">
                <p className="text-xs text-gray-500 mb-2">Domains posted</p>
                <div className="flex flex-wrap gap-2">
                  {userSignals.uniqueDomains.map((d, i) => (
                    <span key={i} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full font-mono">{d}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Reporter signals */}
          {reporters.length > 0 && (
            <div>
              <SectionHeader title="Reporter Reliability" />
              <div className="space-y-2">
                {reporters.map((r, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3 bg-gray-800 rounded-xl">
                    <span className="text-sm text-gray-300">u/{r.username}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">{r.actionedReports}/{r.totalReports} actioned</span>
                      <span className={`text-sm font-bold ${r.accuracyRate >= 80 ? 'text-green-400' : r.accuracyRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {r.accuracyRate}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* History tab */}
      {activeTab === 'history' && (
        <div className="px-5 mt-5">
          <SectionHeader title="Mod Action Timeline" />
          {modHistory.length === 0 ? (
            <div className="text-center py-10 text-gray-600">
              <p className="text-4xl mb-3">✓</p>
              <p className="text-sm">No prior mod actions on this user</p>
            </div>
          ) : (
            <div className="relative space-y-0">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-800" />
              {modHistory.map((entry, i) => (
                <div key={i} className="relative flex gap-4 pb-4">
                  <div className="relative z-10 w-8 h-8 rounded-full bg-gray-800 border-2 border-gray-600 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-xs">
                      {entry.action.includes('ban') ? '🔨' : entry.action.includes('remove') ? '🗑' : entry.action.includes('approve') ? '✓' : '📝'}
                    </span>
                  </div>
                  <div className="flex-1 pt-1 pb-2 px-4 bg-gray-800 rounded-xl">
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-semibold text-white">
                        {ACTION_LABELS[entry.action] ?? entry.action}
                      </span>
                      <span className="text-xs text-gray-500">{entry.date}</span>
                    </div>
                    {entry.description && entry.description !== entry.action && (
                      <p className="text-xs text-gray-400 mt-1">{entry.description}</p>
                    )}
                    <p className="text-xs text-gray-600 mt-1">by u/{entry.mod}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action bar — fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 px-5 py-4">
        {actionStatus && (
          <p className="text-xs text-center text-orange-400 mb-3">{actionStatus}</p>
        )}
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => takeAction('approve')}
            disabled={actionLoading}
            className="py-2 rounded-lg text-sm font-semibold bg-green-800 hover:bg-green-700 text-green-200 transition-colors disabled:opacity-50"
          >
            Approve
          </button>
          <button
            onClick={() => takeAction('remove')}
            disabled={actionLoading}
            className="py-2 rounded-lg text-sm font-semibold bg-red-900 hover:bg-red-800 text-red-200 transition-colors disabled:opacity-50"
          >
            Remove
          </button>
          <button
            onClick={() => takeAction('mute')}
            disabled={actionLoading}
            className="py-2 rounded-lg text-sm font-semibold bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors disabled:opacity-50"
          >
            Mute
          </button>
          <button
            onClick={() => takeAction('ban', `Verdict: ${summary.plainEnglish}`)}
            disabled={actionLoading}
            className="py-2 rounded-lg text-sm font-semibold bg-orange-900 hover:bg-orange-800 text-orange-200 transition-colors disabled:opacity-50"
          >
            Ban
          </button>
        </div>
      </div>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
