import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import type {
  DecrementResponse,
  IncrementResponse,
  InitResponse,
  VerdictData,
  VerdictResponse,
  VerdictActionRequest,
  VerdictActionResponse,
  ModHistoryEntry,
  UserSignals,
  ReporterSignal,
  VerdictSummary,
} from '../../shared/api';

type ErrorResponse = {
  status: 'error';
  message: string;
};

export const api = new Hono();

api.get('/init', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>({ status: 'error', message: 'postId is required but missing from context' }, 400);
  }
  try {
    const [count, username, targetRaw] = await Promise.all([
      redis.get('count'),
      reddit.getCurrentUsername(),
      redis.get(`verdict_target_${postId}`),
    ]);
    const target = targetRaw ? JSON.parse(targetRaw) : null;
    return c.json<InitResponse>({
      type: 'init',
      postId,
      count: count ? parseInt(count) : 0,
      username: username ?? 'anonymous',
      targetId: target?.targetId ?? null,
      targetType: target?.targetType ?? null,
    });
  } catch (error) {
    return c.json<ErrorResponse>({ status: 'error', message: `Initialization failed: ${error}` }, 400);
  }
});

api.post('/increment', async (c) => {
  const { postId } = context;
  if (!postId) return c.json<ErrorResponse>({ status: 'error', message: 'postId is required' }, 400);
  const count = await redis.incrBy('count', 1);
  return c.json<IncrementResponse>({ count, postId, type: 'increment' });
});

api.post('/decrement', async (c) => {
  const { postId } = context;
  if (!postId) return c.json<ErrorResponse>({ status: 'error', message: 'postId is required' }, 400);
  const count = await redis.incrBy('count', -1);
  return c.json<DecrementResponse>({ count, postId, type: 'decrement' });
});

// --- Verdict endpoint ---

api.get('/verdict', async (c) => {
  const targetId = c.req.query('targetId');
  const targetType = c.req.query('targetType') as 'post' | 'comment';

  if (!targetId || !targetType) {
    return c.json<ErrorResponse>({ status: 'error', message: 'targetId and targetType are required' }, 400);
  }

  try {
    const subredditName = context.subredditName!;

    // Fetch the target post/comment
    const target = targetType === 'post'
      ? await reddit.getPostById(targetId)
      : await reddit.getCommentById(targetId);

    const authorId = target.authorId;
    if (!authorId) {
      return c.json<ErrorResponse>({ status: 'error', message: 'Could not determine post author' }, 400);
    }

    const author = await reddit.getUserById(authorId);
    const username = author.username;

    // Fetch all data in parallel — each wrapped to avoid one failure killing all
    const [recentPosts, modLog, modNotes] = await Promise.all([
      reddit.getPostsByUser({ username, subredditName, limit: 25 }).all().catch(() => []),
      reddit.getModerationLog({ subredditName, limit: 25 }).all().catch(() => []),
      reddit.getModNotes({ subredditName, redditorName: username }).all().catch(() => []),
    ]);

    // --- User signals ---
    const removedPosts = recentPosts.filter((p) => p.removed);
    const approvedPosts = recentPosts.filter((p) => p.approved);
    const removalRate = recentPosts.length > 0 ? removedPosts.length / recentPosts.length : 0;

    // Detect acceleration: more than half of recent posts in last 3 days
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    const recentActivity = recentPosts.filter((p) => new Date(p.createdAt).getTime() > threeDaysAgo);
    const postingAccelerating = recentActivity.length >= Math.ceil(recentPosts.length / 2) && recentPosts.length > 3;

    // Unique domains from URLs in posts
    const domainRegex = /https?:\/\/(?:www\.)?([^\/\s]+)/g;
    const domains = new Set<string>();
    recentPosts.forEach((p) => {
      const matches = (p.url ?? '').matchAll(domainRegex);
      for (const m of matches) domains.add(m[1]);
    });

    const accountCreatedAt = author.createdAt ? new Date(author.createdAt).getTime() : Date.now();
    const accountAgeDays = Math.floor((Date.now() - accountCreatedAt) / (1000 * 60 * 60 * 24));

    const userSignals: UserSignals = {
      username,
      accountAgeDays,
      isFirstPost: recentPosts.length <= 1,
      recentPostCount: recentPosts.length,
      recentRemovalCount: removedPosts.length,
      recentApprovalCount: approvedPosts.length,
      removalRate: Math.round(removalRate * 100),
      postingAccelerating,
      uniqueDomains: Array.from(domains).slice(0, 5),
    };

    // --- Mod history (filtered to this user, deduplicated) ---
    const userModActions = modLog.filter((entry) => {
      const target = (entry as any).target;
      return target?.author === username || target?.authorName === username;
    });
    const seen = new Set<string>();
    const modHistory: ModHistoryEntry[] = [];
    for (const entry of userModActions) {
      const key = `${entry.action}_${entry.createdAt}`;
      if (!seen.has(key)) {
        seen.add(key);
        modHistory.push({
          action: entry.action,
          date: new Date(entry.createdAt).toLocaleDateString(),
          description: entry.description ?? entry.action,
          mod: entry.moderatorName ?? 'unknown',
        });
      }
    }

    // Add mod notes
    for (const note of modNotes) {
      modHistory.push({
        action: 'note',
        date: new Date((note as any).createdAt ?? Date.now()).toLocaleDateString(),
        description: (note as any).note ?? (note as any).label ?? '',
        mod: (note as any).operator?.name ?? (note as any).moderatorName ?? 'unknown',
      });
    }

    modHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // --- Reporter signals ---
    // Store reporter action history in Redis to build accuracy over time
    const reporterKey = `reporter_stats_${subredditName}`;
    const reporterStatsRaw = await redis.get(reporterKey);
    const reporterStats: Record<string, { total: number; actioned: number }> = reporterStatsRaw
      ? JSON.parse(reporterStatsRaw)
      : {};

    const reporters: ReporterSignal[] = Object.entries(reporterStats)
      .slice(0, 5)
      .map(([uname, stats]) => ({
        username: uname,
        totalReports: stats.total,
        actionedReports: stats.actioned,
        accuracyRate: stats.total > 0 ? Math.round((stats.actioned / stats.total) * 100) : 0,
      }));

    // --- Rule-based summary ---
    const summary = buildSummary(userSignals, modHistory, reporters);

    // --- Target content ---
    const targetContent = targetType === 'post'
      ? (target as Awaited<ReturnType<typeof reddit.getPostById>>).title
      : (target as Awaited<ReturnType<typeof reddit.getCommentById>>).body ?? '';

    const verdictData: VerdictData = {
      targetId,
      targetType,
      targetContent,
      reportReasons: [],
      reporters,
      userSignals,
      modHistory,
      summary,
    };

    return c.json<VerdictResponse>({ type: 'verdict', data: verdictData });
  } catch (error) {
    console.error('Verdict error:', error);
    return c.json<ErrorResponse>({ status: 'error', message: `Failed to fetch verdict: ${error}` }, 500);
  }
});

api.post('/verdict/action', async (c) => {
  const body = await c.req.json<VerdictActionRequest>();
  const { targetId, action, banDays, note } = body;
  const subredditName = context.subredditName!;

  try {
    const target = await reddit.getPostById(targetId).catch(() => reddit.getCommentById(targetId));
    const author = await reddit.getUserById(target.authorId!);

    if (action === 'approve') {
      await reddit.approve(targetId);
    } else if (action === 'remove') {
      await reddit.remove(targetId, false);
    } else if (action === 'ban') {
      await reddit.banUser({
        subredditName,
        username: author.username,
        duration: banDays ?? 7,
        reason: note ?? 'Verdict: rule violation',
        note: note ?? '',
        context: targetId,
      });
      await reddit.remove(targetId, false);
    } else if (action === 'mute') {
      await reddit.muteUser({ subredditName, username: author.username });
    }

    if (note) {
      await reddit.addModNote({
        subredditName,
        username: author.username,
        note,
        label: 'SPAM_WARNING',
      });
    }

    // Update reporter accuracy stats
    if (action === 'remove' || action === 'ban') {
      await updateReporterStats(subredditName, true);
    } else if (action === 'approve') {
      await updateReporterStats(subredditName, false);
    }

    return c.json<VerdictActionResponse>({ type: 'action', success: true, message: `Action "${action}" completed.` });
  } catch (error) {
    return c.json<VerdictActionResponse>({ type: 'action', success: false, message: `Action failed: ${error}` });
  }
});

async function updateReporterStats(subredditName: string, actioned: boolean) {
  const key = `reporter_stats_${subredditName}`;
  const raw = await redis.get(key);
  const stats: Record<string, { total: number; actioned: number }> = raw ? JSON.parse(raw) : {};
  // We track aggregate stats — in future we can pass reporter username
  if (!stats['__aggregate']) stats['__aggregate'] = { total: 0, actioned: 0 };
  stats['__aggregate'].total += 1;
  if (actioned) stats['__aggregate'].actioned += 1;
  await redis.set(key, JSON.stringify(stats));
}

function buildSummary(
  signals: UserSignals,
  history: ModHistoryEntry[],
  reporters: ReporterSignal[]
): VerdictSummary {
  const reasons: string[] = [];
  let riskScore = 0;

  if (signals.accountAgeDays < 7) {
    riskScore += 3;
    reasons.push('account less than 7 days old');
  } else if (signals.accountAgeDays < 30) {
    riskScore += 1;
    reasons.push('account less than 30 days old');
  }

  if (signals.removalRate >= 60) {
    riskScore += 3;
    reasons.push(`${signals.removalRate}% of recent posts removed`);
  } else if (signals.removalRate >= 30) {
    riskScore += 2;
    reasons.push(`${signals.removalRate}% removal rate`);
  }

  if (signals.postingAccelerating) {
    riskScore += 2;
    reasons.push('posting frequency accelerating');
  }

  if (history.length >= 3) {
    riskScore += 2;
    reasons.push(`${history.length} prior mod actions`);
  } else if (history.length > 0) {
    riskScore += 1;
    reasons.push(`${history.length} prior mod action${history.length > 1 ? 's' : ''}`);
  }

  if (signals.uniqueDomains.length === 1 && signals.recentPostCount > 3) {
    riskScore += 2;
    reasons.push('repeatedly posting same domain');
  }

  const highAccuracyReporter = reporters.find((r) => r.accuracyRate >= 80 && r.totalReports >= 5);
  if (highAccuracyReporter) {
    riskScore += 1;
    reasons.push(`reported by reliable reporter (${highAccuracyReporter.accuracyRate}% accuracy)`);
  }

  let riskLevel: 'low' | 'medium' | 'high';
  if (riskScore >= 6) riskLevel = 'high';
  else if (riskScore >= 3) riskLevel = 'medium';
  else riskLevel = 'low';

  const riskReason = reasons.length > 0 ? reasons.join(', ') : 'no significant risk signals detected';

  let plainEnglish = '';
  if (riskLevel === 'high') {
    plainEnglish = `High-risk user — ${riskReason}. Recommend removal and review for ban.`;
  } else if (riskLevel === 'medium') {
    plainEnglish = `Some concerns — ${riskReason}. Review content carefully before deciding.`;
  } else {
    plainEnglish = signals.isFirstPost
      ? 'First-time poster with no prior issues. Likely a genuine new member.'
      : `Low risk — ${riskReason || 'established member with clean history'}.`;
  }

  return { riskLevel, riskReason, plainEnglish };
}
