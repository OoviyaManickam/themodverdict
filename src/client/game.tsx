import './index.css';
import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { navigateTo } from '@devvit/web/client';
import type { VerdictData, VerdictActionRequest, InitResponse } from '../shared/api';

const ACTION_LABELS: Record<string, string> = {
  removelink: 'Post Removed',
  removecomment: 'Comment Removed',
  approvelink: 'Post Approved',
  approvecomment: 'Comment Approved',
  spamlink: 'Flagged as Spam',
  spamcomment: 'Flagged as Spam',
  banuser: 'Banned',
  unbanuser: 'Unbanned',
  muteuser: 'Muted',
  unmuteuser: 'Unmuted',
  warnuser: 'Warned',
  addnote: 'Note Added',
  deletenote: 'Note Deleted',
  note: 'Note',
  lock: 'Locked',
  unlock: 'Unlocked',
};

const riskColor = (level: string) => {
  if (level === 'high') return { bg: '#0f0505', border: '#ef4444', text: '#fca5a5', badge: '#ef4444', glow: 'rgba(239,68,68,0.15)', stripe: '#ef4444' };
  if (level === 'medium') return { bg: '#0f0e05', border: '#eab308', text: '#fde68a', badge: '#ca8a04', glow: 'rgba(234,179,8,0.15)', stripe: '#eab308' };
  return { bg: '#050f05', border: '#22c55e', text: '#86efac', badge: '#16a34a', glow: 'rgba(34,197,94,0.15)', stripe: '#22c55e' };
};

const actionBorderColor = (action: string | undefined) => {
  const a = action ?? '';
  if (a.includes('ban') || a.includes('remove')) return '#dc2626';
  if (a.includes('spam')) return '#ea580c';
  if (a.includes('approve')) return '#16a34a';
  return '#374151';
};

export const App = () => {
  const [verdict, setVerdict] = useState<VerdictData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [subredditName, setSubredditName] = useState<string | null>(null);
  const [actionDone, setActionDone] = useState(false);

  useEffect(() => {
    fetch('/api/init')
      .then((r) => r.json())
      .then((init: InitResponse) => {
        const { targetId, targetType, subredditName } = init;
        if (subredditName) setSubredditName(subredditName);
        if (!targetId || !targetType) {
          setError('No target specified. Open Verdict from a post or comment menu.');
          setLoading(false);
          return;
        }
        return fetch(`/api/verdict?targetId=${targetId}&targetType=${targetType}`)
          .then((r) => r.json())
          .then((data) => {
            if (data.type === 'verdict') setVerdict(data.data);
            else setError(data.message ?? 'Failed to load verdict');
          });
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const takeAction = async (action: VerdictActionRequest['action'], note?: string) => {
    if (!verdict) return;
    setActionLoading(true);
    setActionStatus(null);
    try {
      const res = await fetch('/api/verdict/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: verdict.targetId, action, note }),
      });
      const data = await res.json();
      setActionStatus(data.message);
      setActionDone(true);
    } catch (e) {
      setActionStatus(`Error: ${e}`);
    } finally {
      setActionLoading(false);
    }
  };

  const wrap: React.CSSProperties = {
    background: '#030712',
    color: '#f3f4f6',
    minHeight: '100vh',
    paddingBottom: '88px',
    fontFamily: 'system-ui, sans-serif',
  };

  if (loading) {
    return (
      <div style={{ ...wrap, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: '36px', height: '36px', border: '3px solid #ea580c', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#6b7280', fontSize: '13px', margin: 0, letterSpacing: '1px' }}>ASSEMBLING VERDICT</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !verdict) {
    return (
      <div style={{ ...wrap, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', padding: '24px' }}>
        <p style={{ color: '#f87171', fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Could not load Verdict</p>
        <p style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center', margin: 0 }}>{error ?? 'verdict is null'}</p>
      </div>
    );
  }

  const { userSignals, modHistory, summary, targetContent } = verdict;
  const c = riskColor(summary.riskLevel);
  const accountAgeValue = userSignals.accountAgeDays === 0
    ? '<1d'
    : userSignals.accountAgeDays < 30
      ? `${userSignals.accountAgeDays}d`
      : userSignals.accountAgeDays < 365
        ? `${Math.floor(userSignals.accountAgeDays / 30)}mo`
        : `${(userSignals.accountAgeDays / 365).toFixed(1)}yr`;

  return (
    <div style={wrap}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div style={{
        borderLeft: `4px solid ${c.stripe}`,
        background: `linear-gradient(135deg, ${c.bg} 0%, #030712 100%)`,
        boxShadow: `inset 0 0 40px ${c.glow}`,
        padding: '20px 16px 18px 20px',
        borderBottom: `1px solid #111827`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '10px', color: '#4b5563', letterSpacing: '3px', fontWeight: '600' }}>VERDICT</span>
          <span style={{
            padding: '4px 14px',
            borderRadius: '999px',
            background: c.badge,
            color: 'white',
            fontSize: '11px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            boxShadow: `0 0 12px ${c.glow}`,
          }}>
            {summary.riskLevel} risk
          </span>
        </div>
        <p style={{ fontSize: '15px', fontWeight: '600', color: 'white', margin: '0 0 8px', lineHeight: '1.4' }}>{summary.plainEnglish}</p>
        <p style={{ fontSize: '11px', color: c.text, margin: 0, opacity: 0.85 }}>
          <span style={{ color: '#4b5563', marginRight: '4px' }}>DRIVEN BY</span>{summary.riskReason}
        </p>
      </div>

      {/* Reported content */}
      {targetContent && (
        <div style={{ margin: '12px 16px 0', padding: '12px 14px', background: '#0d1117', borderRadius: '10px', border: '1px solid #1f2937' }}>
          <p style={{ fontSize: '10px', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 6px', fontWeight: '600' }}>
            Reported {verdict.targetType}
          </p>
          <p style={{ fontSize: '13px', color: '#d1d5db', margin: 0, lineHeight: '1.5' }}>{targetContent}</p>
        </div>
      )}

      {/* Divider */}
      <div style={{ height: '1px', background: '#111827', margin: '16px 0 0' }} />

      {/* User signals */}
      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '12px' }}>
          <span style={{ fontSize: '14px', color: '#ea580c', fontWeight: '700' }}>u/</span>
          <span style={{ fontSize: '16px', color: 'white', fontWeight: '700' }}>{userSignals.username}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          {[
            { label: 'Account Age', value: accountAgeValue, alert: userSignals.accountAgeDays < 7 },
            { label: 'Recent Posts', value: userSignals.recentPostCount, alert: false },
            { label: 'Removal Rate', value: `${userSignals.removalRate}%`, alert: userSignals.removalRate >= 50 },
          ].map((s, i) => (
            <div key={i} style={{
              background: s.alert ? '#1a0505' : '#0d1117',
              border: `1px solid ${s.alert ? '#7f1d1d' : '#1f2937'}`,
              borderRadius: '10px',
              padding: '12px 8px',
              textAlign: 'center',
              boxShadow: s.alert ? '0 0 14px rgba(239,68,68,0.2)' : 'none',
            }}>
              <div style={{ fontSize: '22px', fontWeight: '700', color: s.alert ? '#fca5a5' : 'white', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '10px', color: '#4b5563', marginTop: '5px', letterSpacing: '0.5px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
          {[
            { label: 'Removed', value: userSignals.recentRemovalCount, alert: userSignals.recentRemovalCount >= 3 },
            { label: 'Approved', value: userSignals.recentApprovalCount, alert: false },
          ].map((s, i) => (
            <div key={i} style={{
              background: s.alert ? '#1a0505' : '#0d1117',
              border: `1px solid ${s.alert ? '#7f1d1d' : '#1f2937'}`,
              borderRadius: '10px',
              padding: '12px 8px',
              textAlign: 'center',
              boxShadow: s.alert ? '0 0 14px rgba(239,68,68,0.2)' : 'none',
            }}>
              <div style={{ fontSize: '22px', fontWeight: '700', color: s.alert ? '#fca5a5' : 'white', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '10px', color: '#4b5563', marginTop: '5px', letterSpacing: '0.5px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {userSignals.isFirstPost && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: '#060d1f', border: '1px solid #1e3a8a', borderRadius: '10px', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px' }}>🆕</span>
            <span style={{ fontSize: '12px', color: '#93c5fd' }}>First post in this community</span>
          </div>
        )}

        {userSignals.postingAccelerating && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: '#0f0800', border: '1px solid #9a3412', borderRadius: '10px', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px' }}>⚡</span>
            <span style={{ fontSize: '12px', color: '#fdba74' }}>Posting frequency is accelerating</span>
          </div>
        )}

        {userSignals.uniqueDomains.length > 0 && (
          <div style={{ padding: '10px 12px', background: '#0d1117', border: '1px solid #1f2937', borderRadius: '10px' }}>
            <p style={{ fontSize: '10px', color: '#4b5563', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '600' }}>Domains Posted</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {userSignals.uniqueDomains.map((d, i) => (
                <span key={i} style={{ fontSize: '11px', background: '#161b22', color: '#9ca3af', padding: '3px 10px', borderRadius: '999px', fontFamily: 'monospace', border: '1px solid #30363d' }}>{d}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: '#111827', margin: '0 0 0' }} />

      {/* Mod history */}
      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ fontSize: '10px', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '3px', fontWeight: '600' }}>Mod History</span>
          <span style={{ fontSize: '11px', color: '#374151', background: '#111827', padding: '2px 8px', borderRadius: '999px', border: '1px solid #1f2937' }}>{modHistory.length}</span>
        </div>

        {modHistory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 16px', background: '#0d1117', borderRadius: '10px', border: '1px solid #1f2937' }}>
            <p style={{ fontSize: '20px', margin: '0 0 6px' }}>✓</p>
            <p style={{ fontSize: '13px', color: '#374151', margin: 0 }}>No prior mod actions on this user</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {modHistory.map((entry, i) => (
              <div key={i} style={{
                display: 'flex',
                gap: '0',
                alignItems: 'stretch',
                background: '#0d1117',
                borderRadius: '10px',
                border: '1px solid #1f2937',
                overflow: 'hidden',
              }}>
                <div style={{ width: '3px', background: actionBorderColor(entry.action), flexShrink: 0 }} />
                <div style={{ flex: 1, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'white' }}>
                      {ACTION_LABELS[entry.action ?? ''] ?? entry.action ?? 'Action'}
                    </span>
                    <span style={{ fontSize: '11px', color: '#374151' }}>{entry.date}</span>
                  </div>
                  {entry.description && entry.description !== entry.action && (
                    <p style={{ fontSize: '11px', color: '#6b7280', margin: '4px 0 0', lineHeight: '1.4' }}>{entry.description}</p>
                  )}
                  <p style={{ fontSize: '11px', color: '#374151', margin: '3px 0 0' }}>by u/{entry.mod}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fixed action bar */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#0a0f1a',
        borderTop: '1px solid #111827',
        padding: '10px 16px 14px',
      }}>
        {actionStatus && (
          <div style={{ marginBottom: '8px', textAlign: 'center' }}>
            <p style={{ fontSize: '12px', color: '#fb923c', margin: '0 0 4px' }}>{actionStatus}</p>
            {actionDone && subredditName && (
              <button
                onClick={() => navigateTo(`https://www.reddit.com/r/${subredditName}/about/modqueue`)}
                style={{ fontSize: '12px', color: '#60a5fa', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                ← Back to mod queue
              </button>
            )}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
          {[
            { label: 'Approve', action: 'approve' as const, bg: '#052e16', color: '#bbf7d0', border: '#14532d' },
            { label: 'Remove', action: 'remove' as const, bg: '#2d0a0a', color: '#fecaca', border: '#7f1d1d' },
            { label: 'Mute', action: 'mute' as const, bg: '#0d1117', color: '#9ca3af', border: '#1f2937' },
            { label: 'Ban', action: 'ban' as const, bg: '#2d1200', color: '#fed7aa', border: '#7c2d12' },
          ].map((btn) => (
            <button
              key={btn.action}
              onClick={() => takeAction(btn.action, btn.action === 'ban' ? `Verdict: ${summary.plainEnglish}` : undefined)}
              disabled={actionLoading}
              style={{
                padding: '11px 0',
                borderRadius: '8px',
                background: btn.bg,
                color: btn.color,
                fontSize: '13px',
                fontWeight: '600',
                border: `1px solid ${btn.border}`,
                cursor: actionLoading ? 'not-allowed' : 'pointer',
                opacity: actionLoading ? 0.4 : 1,
                letterSpacing: '0.3px',
              }}
            >
              {btn.label}
            </button>
          ))}
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
