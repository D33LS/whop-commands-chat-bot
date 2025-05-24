Run the development server:

```bash
pnpm i
pnpm run run-system

```

.env example

```bash
## API Keys
WHOP_API_KEY=
WHOP_ADMIN_USER_ID=
WHOP_COMPANY_ID=
WHOP_AGENT_USER_ID=

## for simple test starup
TARGET_FEED_ID=

##webhooks for mod logs
LOG_WEBHOOK_URL=
MODERATION_WEBHOOK_URL=
POLL_WEBHOOK_URL=
CONTENT_REWARDS_WEBHOOK_URL=

## cooldown presets
WHOP_CHAT_COOLDOWN_SECONDS=320
WHOP_CHAT_COOLDOWN_NOTICE_MINUTES=320

## admin presets if any
WHOP_ADMIN_WHITELIST=

```
