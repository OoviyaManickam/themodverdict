import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context, redis, reddit } from '@devvit/web/server';
import { createPost } from '../core/post';

export const menu = new Hono();

menu.post('/post-create', async (c) => {
  try {
    const post = await createPost();
    return c.json<UiResponse>({ navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}` }, 200);
  } catch (error) {
    return c.json<UiResponse>({ showToast: 'Failed to create post' }, 400);
  }
});

menu.post('/verdict', async (c) => {
  try {
    const body = await c.req.json<{ location: string; targetId: string }>();
    const { location, targetId } = body;
    const targetType = location === 'post' ? 'post' : 'comment';
    const subredditName = context.subredditName!;

    let authorUsername = 'unknown';
    try {
      const target = targetType === 'post'
        ? await reddit.getPostById(targetId)
        : await reddit.getCommentById(targetId);
      const author = await reddit.getUserById(target.authorId!);
      authorUsername = author.username;
    } catch (_) {}

    const post = await reddit.submitCustomPost({
      title: `Verdict — u/${authorUsername}`,
      subredditName,
    });

    // Store targetId and targetType in Redis keyed by the verdict post ID
    await redis.set(`verdict_target_${post.id}`, JSON.stringify({ targetId, targetType }));

    return c.json<UiResponse>(
      { navigateTo: `https://reddit.com/r/${subredditName}/comments/${post.id}` },
      200
    );
  } catch (error) {
    console.error('Verdict menu error:', error);
    return c.json<UiResponse>({ showToast: 'Failed to open Verdict' }, 400);
  }
});
