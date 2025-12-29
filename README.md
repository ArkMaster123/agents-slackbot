# 🤖 Agenticators

> *Your AI crew for UK care sector intelligence*

![Agenticators Team](assets/agenticators-team.jpeg)

A multi-agent Slack bot where specialized AI agents collaborate to help your team. Powered by Claude Agent SDK + OpenRouter + MCP (Model Context Protocol).

Made using Claude Agents SDK

## Meet Your AI Team

| Agent | Role | Specialty |
|-------|------|-----------|
| 🔍 **Scout** | Intelligence Gatherer | Research, companies, people, code/repos |
| 🧙 **Sage** | Strategic Analyst | Analysis, comparisons, strategy |
| ✍️ **Chronicle** | Newsroom Editor | UK care articles, CareScope content |
| 👋 **Maven** | Friendly Generalist | General help, routing |
| 📈 **Trends** | SEO Intelligence | Google rankings, trending keywords, UK care news |

## How It Works

Users interact with the bot in Slack, and the **Orchestrator** intelligently routes requests to the right specialist:

```
User: "What are the top 10 things happening in UK care this week?"

📈 Trends is searching Google SERP...
   └─ Found 10 stories with rankings & sources

Here's what's trending:
#1 - Reform council care home closures (Guardian, 5 days ago)
#2 - CQC shuts unsafe Kent care home (ITV)
#3 - 95+ care homes closed since April (Estates Gazette)
...

TRENDING KEYWORDS:
• Care home closures
• CQC enforcement
• Funding crisis
• Understaffing
```

## Architecture

```
Slack Users
    ↓
Slack Bot (Vercel)
    ↓
SDK Orchestrator (intent routing)
    ↓
┌─────────┬─────────┬──────────┬────────┬────────┐
│ Scout   │ Sage    │Chronicle │ Maven  │ Trends │
│  🔍     │  🧙     │   ✍️     │  👋    │  📈    │
└─────────┴─────────┴──────────┴────────┴────────┘
    ↓           ↓          ↓                ↓
  Exa MCP    Exa MCP   Exa+Firecrawl   BrightData MCP
```

### MCP Tools by Agent

| Agent | MCP Server | Tools |
|-------|------------|-------|
| Scout | Exa | web_search, company_research, linkedin_search, crawling, **get_code_context** |
| Sage | Exa | web_search, company_research |
| Chronicle | Exa + Firecrawl | web_search, crawling, scrape |
| Maven | None | General responses |
| Trends | BrightData | **search_engine** (Google SERP with rankings), search_engine_batch |

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env.local`:

```bash
# OpenRouter (Claude via SDK)
ANTHROPIC_BASE_URL=https://openrouter.ai/api
ANTHROPIC_API_KEY=sk-or-v1-xxx
OPENROUTER_API_KEY=sk-or-v1-xxx

# MCP Servers
EXA_API_KEY=xxx
FIRECRAWL_API_KEY=fc-xxx
BRIGHTDATA_API_KEY=xxx

# Slack
SLACK_BOT_TOKEN=xoxb-xxx
SLACK_SIGNING_SECRET=xxx
```

### 3. Test Locally

```bash
# Test all agents routing
npx tsx test-routing.ts

# Test Trends agent (Google SERP + keywords)
npx tsx test-trends.ts

# Interactive chat
npx tsx test-sdk-orchestrator.ts
```

### 4. Deploy to Vercel

```bash
vercel deploy
```

Then update your Slack app's Request URL to: `https://your-app.vercel.app/api/events`

## Usage Examples

### For Scout (Research)
- "Research Anthropic and find competitors"
- "Find CTOs at AI startups in London"
- "Tell me about the @anthropic-ai/claude-agent-sdk npm package"
- "What's in this GitHub repo?"

### For Sage (Analysis)
- "Compare AWS vs GCP for startups"
- "Analyze the UK care home market"
- "What are the pros and cons of Next.js vs Remix?"

### For Chronicle (UK Care Articles)
- "Write an article about CQC inspection trends"
- "Research UK care home staffing crisis"

### For Trends (SEO Intelligence)
- "What are the top 10 things happening in UK care this week?"
- "Give me trending keywords in social care"
- "What's breaking in care homes today?"
- "Latest CQC news with sources"

### For Maven (General)
- "Hello!"
- "What can you help me with?"
- "Who should I ask about market research?"

## Tech Stack

- **Framework**: Claude Agent SDK
- **LLM Routing**: OpenRouter
- **MCP Servers**: Exa, Firecrawl, BrightData
- **Slack**: @slack/web-api
- **Deployment**: Vercel Serverless
- **Language**: TypeScript

## Project Structure

```
agenticators/
├── src/
│   ├── agents/
│   │   ├── sdk/              # SDK Orchestrator
│   │   ├── scout/            # Research specialist
│   │   ├── sage/             # Analysis specialist
│   │   ├── chronicle/        # News editor
│   │   ├── chronicle-qa/     # Article QA scoring
│   │   ├── maven/            # General assistant
│   │   └── trends/           # SEO intelligence
│   ├── mcp/                  # MCP server configs
│   └── slack/                # Slack client
├── api/
│   ├── events.ts             # Slack events webhook
│   └── slash.ts              # Slash commands
├── test-routing.ts           # Agent routing tests
├── test-trends.ts            # Trends agent test
└── test-chronicle-qa.ts      # QA scoring test
```

## Key Features

### Google SERP Rankings (Trends Agent)
The Trends agent uses BrightData MCP to get **actual Google search rankings**:
- Rank position (#1, #2, etc.) - SEO authority signal
- Source domain - authority tier (gov.uk = Tier 1)
- Recency - dates like "5 days ago"
- Real URLs - never makes up sources

### Code Context (Scout Agent)
Scout can research code/repos using Exa's `get_code_context` tool:
- GitHub repositories
- npm packages
- API documentation
- SDK usage examples

### Article QA (Chronicle QA Agent)
Chronicle QA scores articles on 6 dimensions:
- Structure, Data Quality, Writing Quality
- Source Quality, Uniqueness, SEO/Accessibility
- British English checks
- UK care terminology validation

## Documentation

- [AGENTS.md](./AGENTS.md) - Full agent capabilities & personalities
- [SETUP.md](./SETUP.md) - Detailed setup guide
- [TODO.md](./TODO.md) - Current status & roadmap

## License

MIT

---

Built with ❤️ by the CareScope team
