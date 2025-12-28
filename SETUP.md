# Setup Guide - Agents Slackbot

Complete setup guide for deploying your multi-agent Slack bot.

## Prerequisites

- Node.js 22.x
- npm or pnpm
- Slack workspace with admin access
- OpenRouter API key
- Exa API key
- Vercel account (for deployment)

## 1. Install Dependencies

```bash
cd agents-slackbot
npm install
```

## 2. Set Up Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in your credentials:

```bash
# Slack - Get from https://api.slack.com/apps
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret

# OpenRouter - Get from https://openrouter.ai/keys
OPENROUTER_API_KEY=sk-or-v1-xxxxx
ANTHROPIC_BASE_URL=https://openrouter.ai/api/v1

# Exa Search - Get from https://dashboard.exa.ai/api-keys
EXA_API_KEY=your-exa-api-key
```

## 3. Create Slack App

### A. Create the App

1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Name: "AI Team" (or your choice)
4. Select your workspace

### B. Configure OAuth & Permissions

Go to "OAuth & Permissions" and add these **Bot Token Scopes**:

- `app_mentions:read` - Read mentions
- `chat:write` - Send messages
- `im:history` - Read DM history
- `im:read` - View DMs
- `im:write` - Send DMs
- `channels:history` - Read channel messages (for threads)
- `channels:read` - View channel info

Click "Install to Workspace" and copy the **Bot User OAuth Token** to your `.env` as `SLACK_BOT_TOKEN`.

### C. Get Signing Secret

1. Go to "Basic Information"
2. Under "App Credentials", copy the **Signing Secret**
3. Add to `.env` as `SLACK_SIGNING_SECRET`

### D. Enable Events

**Important:** Deploy to Vercel first (step 4), then come back here.

1. Go to "Event Subscriptions"
2. Enable Events
3. Set Request URL: `https://your-app.vercel.app/api/events`
4. Under "Subscribe to bot events", add:
   - `app_mention`
   - `message.im`
5. Save Changes

### E. Enable Slash Commands

1. Go to "Slash Commands"
2. Create `/team` command:
   - Command: `/team`
   - Request URL: `https://your-app.vercel.app/api/slash`
   - Short Description: "Meet the AI team"
3. Create `/aisettings` command:
   - Command: `/aisettings`
   - Request URL: `https://your-app.vercel.app/api/slash`
   - Short Description: "Configure AI settings"

## 4. Deploy to Vercel

### Option A: Deploy via CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow prompts, then deploy to production
vercel --prod
```

### Option B: Deploy via GitHub

1. Push code to GitHub:
   ```bash
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/your-username/agents-slackbot.git
   git push -u origin main
   ```

2. Go to https://vercel.com
3. Import your GitHub repository
4. Add environment variables in Vercel project settings
5. Deploy

### C. Set Environment Variables in Vercel

In Vercel project settings → Environment Variables, add:

- `SLACK_BOT_TOKEN`
- `SLACK_SIGNING_SECRET`
- `OPENROUTER_API_KEY`
- `ANTHROPIC_BASE_URL`
- `EXA_API_KEY`

## 5. Test the Bot

### In Slack:

1. **Test Direct Message**:
   - Send DM to bot: "Hello!"
   - Maven should respond

2. **Test @Mention**:
   - In a channel: "@AI Team research Stripe"
   - Scout should respond

3. **Test /team Command**:
   - Type `/team` anywhere
   - See agent introductions

4. **Test Agent Routing**:
   - "Find CTOs at Google" → Scout
   - "Compare AWS vs GCP" → Sage
   - "Write an article about UK care homes" → Chronicle

## 6. Local Development

For local testing with ngrok/untun:

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Create tunnel
npx untun@latest tunnel http://localhost:3000
```

Update Slack Event Subscriptions URL to the tunnel URL.

## Architecture Overview

```
User in Slack
    ↓
API Endpoints (/api/events, /api/slash)
    ↓
Orchestrator (classifies intent)
    ↓
┌──────────┬──────────┬──────────┬──────────┐
│  Scout   │   Sage   │Chronicle │  Maven   │
│    🔍    │    🧙    │    ✍️    │    👋    │
└──────────┴──────────┴──────────┴──────────┘
    ↓
Tools (Exa, Weather, Article Generation)
```

## Agent Capabilities

### 🔍 Scout (Research)
- Web search
- Company prospecting
- Finding people/professionals
- Competitive intelligence

**Triggers**: "research", "find", "search", "company", "prospect"

### 🧙 Sage (Analysis)
- Strategic analysis
- Market research
- Comparisons
- Decision support

**Triggers**: "analyze", "compare", "strategy", "should I"

### ✍️ Chronicle (News)
- CareScope article generation
- Topic research
- UK social care journalism

**Triggers**: "article", "write", "news", "carescope", "CQC"

### 👋 Maven (General)
- Weather lookups
- General help
- Settings
- Routing to specialists

**Triggers**: "weather", "help", "settings", "hello"

## Customization

### Change Agent Models

Edit `.env`:

```bash
# Use faster/cheaper models
MAVEN_MODEL=anthropic/claude-3-haiku
SCOUT_MODEL=anthropic/claude-3.5-sonnet
SAGE_MODEL=anthropic/claude-opus-4
CHRONICLE_MODEL=anthropic/claude-3.5-sonnet
ORCHESTRATOR_MODEL=anthropic/claude-3-haiku
```

### Add New Tools

Edit the appropriate agent file in `src/agents/[agent-name]/`:

```typescript
protected registerTools(): void {
  this.registerTool({
    name: 'yourTool',
    description: 'What your tool does',
    parameters: { /* zod schema */ },
    execute: async (params) => {
      // Your tool logic
      return result;
    },
  });
}
```

### Modify Personalities

Edit personality configs in each agent's constructor:

```typescript
personality: {
  name: 'Scout',
  catchphrase: "Your custom catchphrase!",
  description: 'Your custom description',
  // ...
}
```

## Troubleshooting

### Bot not responding to @mentions
- Check Event Subscriptions URL is correct
- Verify bot has `app_mentions:read` scope
- Check Vercel logs: `vercel logs`

### "Unauthorized" errors
- Verify `SLACK_SIGNING_SECRET` matches Slack app
- Check request timestamp (system clock sync)

### Agent routing to wrong specialist
- Check Orchestrator keywords in `src/agents/orchestrator/Orchestrator.ts`
- Add more specific keywords for your use case

### API rate limits
- OpenRouter has rate limits per model
- Consider adding request queuing
- Use cheaper models for high-traffic agents

## Cost Estimation

Typical monthly costs (1000 requests/day):

- **OpenRouter API**: ~$50-100/month
  - Haiku (Maven, Orchestrator): $0.25/$1.25 per 1M tokens
  - Sonnet (Scout, Chronicle): $3/$15 per 1M tokens
  - Opus (Sage): $15/$75 per 1M tokens
- **Exa API**: Free tier → $30/month (Pro)
- **Vercel**: Free tier sufficient for most cases

Total: **~$50-130/month** depending on usage.

## Next Steps

- [ ] Add conversation memory/context storage
- [ ] Implement article preview generation
- [ ] Add agent collaboration visualization
- [ ] Create interactive buttons/modals
- [ ] Add usage analytics dashboard

## Support

For issues, check:
1. Vercel logs: `vercel logs --follow`
2. Slack API logs: https://api.slack.com/apps → Your App → Event Subscriptions
3. Agent classification: Add `DEBUG=true` to `.env`

## License

MIT
