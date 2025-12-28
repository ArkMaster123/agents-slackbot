# 🤖 Agents Slackbot

A multi-agent Slack bot where specialized AI characters collaborate to help your team. Powered by Claude Agent SDK with OpenRouter.

## Meet Your AI Team

**🔍 Scout** - The Intelligence Gatherer
*"I'll track that down for you!"*
Research specialist who finds companies, people, and information across the web.

**🧙 Sage** - The Strategic Analyst
*"Let me break this down for you..."*
Thoughtful analyst who provides deep insights and strategic recommendations.

**✍️ Chronicle** - The Newsroom Editor
*"Let's craft this story right..."*
Editorial specialist for CareScope Intelligence articles and news analysis.

**👋 Maven** - The Friendly Generalist
*"I'm here to help!"*
Your go-to assistant for general tasks and routing to specialists.

## How It Works

Users interact with the bot in Slack, and the **Orchestrator** intelligently routes requests to the right specialist. For complex tasks, agents collaborate:

```
User: "Research Stripe and analyze their market position"

🔍 Scout is researching Stripe...
   └─ Found company info, funding, competitors

🧙 Sage is analyzing market positioning...
   └─ Comparing to Square, Adyen, PayPal

✨ Here's your analysis: [combined response]
```

## Architecture

```
Slack Users
    ↓
Slack Bot (Vercel)
    ↓
Orchestrator (intent routing)
    ↓
┌─────────┬─────────┬──────────┬────────┐
│ Scout   │ Sage    │Chronicle │ Maven  │
└─────────┴─────────┴──────────┴────────┘
    ↓
Tools (Exa Search, Slack API, Database)
```

### Key Components

- **Agents**: Scout, Sage, Chronicle, Maven (each with personality and specialization)
- **Orchestrator**: Routes requests based on intent classification
- **Tools**: Web search, company prospecting, article generation, weather, etc.
- **Storage**: Thread context, user settings, article drafts

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in:

```bash
# Slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...

# OpenRouter (used as Anthropic API via base URL)
OPENROUTER_API_KEY=sk-or-v1-...
ANTHROPIC_BASE_URL=https://openrouter.ai/api/v1

# Exa (web search)
EXA_API_KEY=...
```

### 3. Set Up Slack App

1. Create app at [api.slack.com/apps](https://api.slack.com/apps)
2. Add Bot Token Scopes:
   - `app_mentions:read`
   - `chat:write`
   - `im:history`
   - `im:read`
   - `im:write`
3. Subscribe to events:
   - `app_mention`
   - `message:im`
4. Set Request URL: `https://your-app.vercel.app/api/events`

### 4. Deploy

```bash
# Deploy to Vercel
vercel

# Or run locally
npm run dev
```

## Usage

### Direct Messages
Just send a DM to the bot - Maven will greet you and route as needed!

### Channel Mentions
Mention the bot: `@AgentsBot research Stripe`

### Slash Commands
- `/team` - Meet all the agents
- `/aisettings` - Configure your model preferences

### Example Requests

**For Scout (Research):**
- "Research [company name]"
- "Find CTOs at AI startups in SF"
- "Who are the key people at Stripe?"

**For Sage (Analysis):**
- "Compare AWS vs GCP for startups"
- "Analyze the social care market"
- "What are the strategic implications of [topic]?"

**For Chronicle (Articles):**
- "Write an article about CQC inspection trends"
- "Research UK care home staffing crisis and write analysis"

**For Maven (General):**
- "What's the weather in London?"
- "Help me configure settings"
- "Who should I talk to about market research?"

## Tech Stack

- **Framework**: Claude Agent SDK (via OpenRouter)
- **Agents**: Custom multi-agent orchestration
- **Slack**: @slack/web-api
- **Search**: Exa API
- **Deployment**: Vercel Serverless Functions
- **Language**: TypeScript

## Project Structure

```
agents-slackbot/
├── src/
│   ├── agents/           # Character agents
│   │   ├── base/         # AgentBase class
│   │   ├── orchestrator/ # Routing & coordination
│   │   ├── scout/        # Research specialist
│   │   ├── sage/         # Analysis specialist
│   │   ├── chronicle/    # News editor
│   │   └── maven/        # General assistant
│   ├── mcp/              # MCP tool management
│   ├── slack/            # Slack client & formatters
│   ├── storage/          # Context & settings
│   └── utils/            # Logging, errors
├── api/                  # Vercel endpoints
│   ├── events.ts         # Slack events webhook
│   └── commands/         # Slash commands
└── tests/
```

## Development

```bash
# Type check
npm run type-check

# Build
npm run build

# Run tests (coming soon)
npm test
```

## Features

### ✅ Implemented
- Multi-agent architecture with character personalities
- Intelligent intent routing
- Web search and company prospecting
- Thread context and memory
- User settings and model selection

### 🚧 Coming Soon
- Agent collaboration visualization
- Agent memory callbacks ("I researched this for you last week...")
- Interactive workflows with buttons
- Agent stats and leaderboard
- Article preview generation

## Authentication

This bot uses **OpenRouter** with the Anthropic SDK base URL override:

```typescript
const client = new Anthropic({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1'
});
```

This lets us use the official Claude Agent SDK while routing through OpenRouter for cost efficiency and model flexibility.

## Contributing

Contributions welcome! Please:
1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Submit a PR

## License

MIT
