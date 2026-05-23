import './index.css';
import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { VerdictData, VerdictActionRequest, InitResponse } from '../shared/api';

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

const riskColor = (level: string) => {
  if (level === 'high') return { bg: '#1a0000', border: '#ef4444', text: '#fca5a5', badge: '#ef4444' };
  if (level === 'medium') return { bg: '#1a1500', border: '#eab308', text: '#fde68a', badge: '#ca8a04' };
  return { bg: '#001a00', border: '#22c55e', text: '#86efac', badge: '#16a34a' };
};

const actionIcon = (action: string | undefined) => {
  const a = action ?? '';
  if (a.includes('ban')) return '🔨';
  if (a.includes('remove')) return '🗑️';
  if (a.includes('approve')) return '✅';
  return '📝';
};

export const App = () => {
  const [verdict, setVerdict] = useState<VerdictData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetch('/api/init')
      .then((r) => r.json())
      .then((init: InitResponse) => {
        const { targetId, targetType } = init;
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
    } catch (e) {
      setActionStatus(`Error: ${e}`);
    } finally {
      setActionLoading(false);
    }
  };

  const wrap: React.CSSProperties = { background: '#030712', color: '#f3f4f6', minHeight: '100vh', paddingBottom: '80px', fontFamily: 'system-ui, sans-serif' };

  if (loading) {
    return (
      <div style={{ ...wrap, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: '36px', height: '36px', border: '4px solid #ea580c', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0 }}>Assembling verdict...</p>
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

  return (
    <div style={wrap}>

      {/* Header */}
      <div style={{ padding: '20px 16px 16px', borderBottom: `2px solid ${c.border}`, background: c.bg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', color: '#6b7280', letterSpacing: '2px' }}>VERDICT</span>
          <span style={{ padding: '4px 12px', borderRadius: '999px', background: c.badge, color: 'white', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>
            {summary.riskLevel} risk
          </span>
        </div>
        <p style={{ fontSize: '15px', fontWeight: '600', color: 'white', margin: '0 0 6px' }}>{summary.plainEnglish}</p>
        <p style={{ fontSize: '12px', color: c.text, margin: 0 }}>Driven by: {summary.riskReason}</p>
      </div>

      {/* Reported content */}
      {targetContent && (
        <div style={{ margin: '12px 16px 0', padding: '12px', background: '#1f2937', borderRadius: '12px', border: '1px solid #374151' }}>
          <p style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 6px' }}>Reported {verdict.targetType}</p>
          <p style={{ fontSize: '13px', color: '#e5e7eb', margin: 0 }}>{targetContent}</p>
        </div>
      )}

      {/* User signals */}
      <div style={{ padding: '16px' }}>
        <p style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 10px' }}>u/{userSignals.username}</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          {[
            { label: 'Account Age', value: userSignals.accountAgeDays === 0 ? '<1d' : userSignals.accountAgeDays < 30 ? `${userSignals.accountAgeDays}d` : userSignals.accountAgeDays < 365 ? `${Math.floor(userSignals.accountAgeDays / 30)}mo` : `${(userSignals.accountAgeDays / 365).toFixed(1)}yr`, alert: userSignals.accountAgeDays < 7 },
            { label: 'Recent Posts', value: userSignals.recentPostCount, alert: false },
            { label: 'Removal Rate', value: `${userSignals.removalRate}%`, alert: userSignals.removalRate >= 50 },
          ].map((s, i) => (
            <div key={i} style={{ background: s.alert ? '#450a0a' : '#1f2937', border: `1px solid ${s.alert ? '#dc2626' : '#374151'}`, borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: s.alert ? '#fca5a5' : 'white' }}>{s.value}</div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          {[
            { label: 'Removed', value: userSignals.recentRemovalCount, alert: userSignals.recentRemovalCount >= 3 },
            { label: 'Approved', value: userSignals.recentApprovalCount, alert: false },
          ].map((s, i) => (
            <div key={i} style={{ background: s.alert ? '#450a0a' : '#1f2937', border: `1px solid ${s.alert ? '#dc2626' : '#374151'}`, borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: s.alert ? '#fca5a5' : 'white' }}>{s.value}</div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {userSignals.isFirstPost && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: '#0c1a3a', border: '1px solid #1d4ed8', borderRadius: '10px', marginBottom: '8px' }}>
            <span>🆕</span><span style={{ fontSize: '13px', color: '#93c5fd' }}>First post in this community</span>
          </div>
        )}

        {userSignals.postingAccelerating && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: '#1a0f00', border: '1px solid #c2410c', borderRadius: '10px', marginBottom: '8px' }}>
            <span>⚡</span><span style={{ fontSize: '13px', color: '#fdba74' }}>Posting frequency is accelerating</span>
          </div>
        )}

        {userSignals.uniqueDomains.length > 0 && (
          <div style={{ padding: '10px 12px', background: '#1f2937', borderRadius: '10px' }}>
            <p style={{ fontSize: '11px', color: '#9ca3af', margin: '0 0 6px' }}>Domains posted</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {userSignals.uniqueDomains.map((d, i) => (
                <span key={i} style={{ fontSize: '11px', background: '#374151', color: '#d1d5db', padding: '2px 8px', borderRadius: '999px', fontFamily: 'monospace' }}>{d}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mod history */}
      <div style={{ padding: '0 16px 16px' }}>
        <p style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 10px' }}>
          Mod History ({modHistory.length})
        </p>
        {modHistory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#4b5563' }}>
            <p style={{ fontSize: '24px', margin: '0 0 6px' }}>✓</p>
            <p style={{ fontSize: '13px', margin: 0 }}>No prior mod actions on this user</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {modHistory.map((entry, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', background: '#1f2937', borderRadius: '10px', padding: '10px 12px', border: '1px solid #374151' }}>
                <span>{actionIcon(entry.action)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'white' }}>{ACTION_LABELS[entry.action ?? ''] ?? entry.action ?? 'Action'}</span>
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>{entry.date}</span>
                  </div>
                  {entry.description && entry.description !== entry.action && (
                    <p style={{ fontSize: '11px', color: '#d1d5db', margin: '4px 0 0' }}>{entry.description}</p>
                  )}
                  <p style={{ fontSize: '11px', color: '#6b7280', margin: '2px 0 0' }}>by u/{entry.mod}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fixed action bar */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#111827', borderTop: '1px solid #1f2937', padding: '12px 16px' }}>
        {actionStatus && <p style={{ fontSize: '12px', textAlign: 'center', color: '#fb923c', margin: '0 0 8px' }}>{actionStatus}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
          {[
            { label: 'Approve', action: 'approve' as const, bg: '#14532d', color: '#bbf7d0' },
            { label: 'Remove', action: 'remove' as const, bg: '#450a0a', color: '#fecaca' },
            { label: 'Mute', action: 'mute' as const, bg: '#374151', color: '#e5e7eb' },
            { label: 'Ban', action: 'ban' as const, bg: '#431407', color: '#fed7aa' },
          ].map((btn) => (
            <button
              key={btn.action}
              onClick={() => takeAction(btn.action, btn.action === 'ban' ? `Verdict: ${summary.plainEnglish}` : undefined)}
              disabled={actionLoading}
              style={{ padding: '10px', borderRadius: '8px', background: btn.bg, color: btn.color, fontSize: '13px', fontWeight: '600', border: 'none', cursor: 'pointer', opacity: actionLoading ? 0.5 : 1 }}
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
