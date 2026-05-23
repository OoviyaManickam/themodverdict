# Verdict — Mod Decision Assistant

Verdict gives Reddit moderators instant, decision-quality context on any reported user — directly inside the modqueue, without opening a single extra tab.

## What it does

When a moderator encounters a reported post or comment, they right-click and select **"Get Verdict"**. A fullscreen panel opens in under two seconds showing everything needed to make a confident moderation decision:

- **Risk summary** — plain-English assessment (High / Medium / Low) with the exact reasons driving it
- **User signals** — account age, recent post count, removal rate, approval count, posting acceleration, domains posted
- **Mod history timeline** — deduplicated, readable list of all prior mod actions on this user in your subreddit
- **One-click actions** — Approve, Remove, Mute, or Ban without leaving the panel

All signals are derived from Reddit's own data. No external APIs, no AI tokens, no cost to run at any scale.

## Why Verdict

Reddit's modqueue splits user context across two panels that replace each other — mods can't see conversation context and user history simultaneously. Research shows 84% of moderators regularly leave the modqueue to gather context before making a decision, opening multiple tabs to piece together a picture that should have been right in front of them.

Verdict solves this. One right-click. Two seconds. Full picture. Act immediately.

## Installing Verdict

1. Go to [developers.reddit.com/apps/themodverdict](https://developers.reddit.com/apps/themodverdict)
2. Click **Install**
3. Select the subreddit you want to install it in (you must be a moderator)
4. Done — "Get Verdict" will now appear in the right-click menu on any post or comment in your subreddit

No configuration required. Verdict works immediately after install.

## Using Verdict

1. In your subreddit, find a reported post or comment in the mod queue
2. Click the **three-dot menu** (⋯) on the post or comment
3. Select **"Get Verdict"**
4. Review the panel — risk level, user signals, mod history
5. Hit **Approve**, **Remove**, **Mute**, or **Ban** directly from the panel

Verdict is mod-only. Regular users will not see the "Get Verdict" menu item.

## Risk Scoring

Verdict uses a transparent, rule-based scoring system — no black-box AI, no hallucinations. Every risk signal is a verifiable fact:

| Signal | Risk Added |
|---|---|
| Account less than 7 days old | +3 |
| Account less than 30 days old | +1 |
| Removal rate ≥ 60% | +3 |
| Removal rate ≥ 30% | +2 |
| Posting frequency accelerating | +2 |
| 3 or more prior mod actions | +2 |
| Repeatedly posting same domain | +2 |

- Score ≥ 6 → **HIGH** risk (red)
- Score ≥ 3 → **MEDIUM** risk (yellow)
- Score < 3 → **LOW** risk (green)

## Changelog

### v1.0.0
- Initial release
- Risk summary with plain-English explanation
- User signals panel (account age, removal rate, post count, domain tracking)
- Mod history timeline with deduplication
- One-click action bar (Approve / Remove / Mute / Ban)
- Works on both posts and comments
- Mobile and web compatible
