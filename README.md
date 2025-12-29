# 🤖 Agenticators

> *Your AI crew for UK care sector intelligence*

![Agenticators Team](assets/agenticators-team.jpeg)

A multi-agent Slack bot where specialized AI agents collaborate to help your team. Powered by **Claude Agent SDK + OpenRouter + MCP** (Model Context Protocol).

## The Magic: Claude Agent SDK + OpenRouter

**This is a rare architecture that few people know about!** We've combined:

1. **Claude Agent SDK** - Anthropic's official agentic framework
2. **OpenRouter** - Access to multiple LLMs through one API
3. **MCP Servers** - Standardized tool protocol for agents

The trick? Claude Agent SDK uses the Anthropic SDK under the hood, which can be pointed to OpenRouter by setting:

```bash
ANTHROPIC_BASE_URL=https://openrouter.ai/api
ANTHROPIC_API_KEY=sk-or-v1-your-openrouter-key
```

This gives you Claude Agent SDK's powerful agentic capabilities while routing through OpenRouter for flexible model selection!

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                   SLACK                                         │
│                          (Users send messages)                                  │
└─────────────────────────────────────┬───────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            VERCEL SERVERLESS                                    │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         api/events.ts                                    │   │
│  │                    (Slack Event Handler)                                 │   │
│  │                                                                          │   │
│  │   • URL Verification (fast path, no imports)                            │   │
│  │   • Signature Verification                                               │   │
│  │   • Event Routing (app_mention, DM, thread)                             │   │
│  │   • waitUntil() for background processing                               │   │
│  └──────────────────────────────────┬──────────────────────────────────────┘   │
│                                      │                                          │
│                                      ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                      SDK ORCHESTRATOR                                    │   │
│  │                  (src/agents/sdk/SdkOrchestrator.ts)                    │   │
│  │                                                                          │   │
│  │   Intent Classification (keyword matching + LLM fallback)               │   │
│  │                                                                          │   │
│  │   Routes to specialized agents based on:                                │   │
│  │   • "research", "find", "company" → Scout                               │   │
│  │   • "analyze", "compare", "strategy" → Sage                             │   │
│  │   • "article", "write", "CQC" → Chronicle                               │   │
│  │   • "trending", "this week", "top 10" → Trends                          │   │
│  │   • General/unclear → Maven                                              │   │
│  └──────────────────────────────────┬──────────────────────────────────────┘   │
│                                      │                                          │
└──────────────────────────────────────┼──────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CLAUDE AGENT SDK                                      │
│                                                                                 │
│   ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌─────────┐            │
│   │  Scout  │  │  Sage   │  │Chronicle │  │  Maven  │  │ Trends  │            │
│   │   🔍    │  │   🧙    │  │    ✍️    │  │   👋    │  │   📈    │            │
│   │         │  │         │  │          │  │         │  │         │            │
│   │Research │  │Analysis │  │UK Care   │  │General  │  │Google   │            │
│   │Expert   │  │Expert   │  │Journalist│  │Helper   │  │SERP/SEO │            │
│   └────┬────┘  └────┬────┘  └────┬─────┘  └────┬────┘  └────┬────┘            │
│        │            │            │             │            │                  │
│        ▼            ▼            ▼             │            ▼                  │
│   ┌─────────────────────────────────────┐     │     ┌─────────────┐           │
│   │           EXA MCP SERVER            │     │     │ BRIGHTDATA  │           │
│   │  (https://mcp.exa.ai/mcp)           │     │     │ MCP SERVER  │           │
│   │                                     │     │     │             │           │
│   │  • web_search_exa                   │     │     │• search_    │           │
│   │  • company_research_exa             │   None   │  engine     │           │
│   │  • linkedin_search_exa              │     │     │• SERP with  │           │
│   │  • crawling_exa                     │     │     │  rankings   │           │
│   │  • get_code_context_exa             │     │     │• Batch      │           │
│   └─────────────────────────────────────┘     │     │  search     │           │
│                      │                         │     └─────────────┘           │
│                      ▼                         │                               │
│             ┌─────────────────┐                │                               │
│             │ FIRECRAWL MCP   │                │                               │
│             │ (Chronicle only)│                │                               │
│             │ • scrape        │                │                               │
│             │ • crawl         │                │                               │
│             └─────────────────┘                │                               │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              OPENROUTER                                         │
│                     (https://openrouter.ai/api)                                │
│                                                                                 │
│   Claude Agent SDK → ANTHROPIC_BASE_URL → OpenRouter → Claude/Other Models    │
│                                                                                 │
│   Models used:                                                                  │
│   • Scout, Chronicle, Trends: claude-3.5-sonnet                                │
│   • Sage: claude-opus-4 (most powerful for analysis)                           │
│   • Maven: claude-3-haiku (fast, cheap for simple tasks)                       │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Example

```
User: "What are the top 10 things happening in UK care this week?"
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────┐
│ 1. SLACK EVENT                                                 │
│    POST /api/events                                            │
│    { type: "app_mention", text: "What are the top 10..." }    │
└────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────┐
│ 2. ORCHESTRATOR CLASSIFICATION                                 │
│    Keywords detected: "top 10", "this week", "happening"       │
│    → Routes to: TRENDS agent 📈                                │
└────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────┐
│ 3. CLAUDE AGENT SDK (via OpenRouter)                          │
│    Model: claude-3.5-sonnet                                    │
│    System prompt: Trends agent personality + instructions      │
│    MCP Server: BrightData                                      │
└────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────┐
│ 4. MCP TOOL CALLS                                              │
│    search_engine("UK care home news December 2024")            │
│    search_engine("CQC enforcement 2024")                       │
│    search_engine("social care funding UK")                     │
│                                                                │
│    Returns: Real Google results with:                          │
│    • Rank position (#1, #2, #3...)                            │
│    • Title, URL, source domain                                 │
│    • Date ("5 days ago")                                       │
└────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────┐
│ 5. RESPONSE                                                    │
│                                                                │
│    📈 *Trends*                                                 │
│                                                                │
│    ## TOP 10 UK CARE NEWS THIS WEEK                           │
│                                                                │
│    #1 - Reform UK councils 'betrayed' over care homes         │
│         Source: The Guardian - theguardian.com                │
│         Date: 5 days ago                                       │
│                                                                │
│    #2 - CQC shuts unsafe Kent care home                       │
│         Source: ITV News - itv.com                            │
│         Date: 3 days ago                                       │
│    ...                                                         │
│                                                                │
│    TRENDING KEYWORDS: care home closures, CQC enforcement,    │
│    funding crisis, understaffing, Reform UK councils          │
└────────────────────────────────────────────────────────────────┘
```

---

## Meet Your AI Team

| Agent | Role | Specialty | MCP Tools |
|-------|------|-----------|-----------|
| 🔍 **Scout** | Intelligence Gatherer | Research, companies, people, code/repos | Exa (full) |
| 🧙 **Sage** | Strategic Analyst | Analysis, comparisons, strategy | Exa |
| ✍️ **Chronicle** | Newsroom Editor | UK care articles, CareScope content | Exa + Firecrawl |
| 👋 **Maven** | Friendly Generalist | General help, routing | None |
| 📈 **Trends** | SEO Intelligence | Google rankings, trending keywords | BrightData |

---

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/ArkMaster123/agents-slackbot.git
cd agents-slackbot
npm install
```

### 2. Configure Environment

Create `.env.local`:

```bash
# THE MAGIC: Point Claude SDK to OpenRouter
ANTHROPIC_BASE_URL=https://openrouter.ai/api
ANTHROPIC_API_KEY=sk-or-v1-your-key
OPENROUTER_API_KEY=sk-or-v1-your-key

# MCP Servers
EXA_API_KEY=your-exa-key
FIRECRAWL_API_KEY=fc-your-key
BRIGHTDATA_API_KEY=your-brightdata-key

# Slack
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_SIGNING_SECRET=your-secret
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
vercel deploy --prod
```

### 5. Configure Slack App

Use this manifest (replace URL with your Vercel deployment):

```json
{
    "_metadata": {
        "major_version": 1,
        "minor_version": 1
    },
    "display_information": {
        "name": "Agenticators",
        "description": "Your AI crew for UK care sector intelligence"
    },
    "features": {
        "bot_user": {
            "display_name": "Agenticators",
            "always_online": true
        },
        "slash_commands": [
            {
                "command": "/aiteam",
                "description": "Meet the AI agent team",
                "should_escape": false
            }
        ]
    },
    "oauth_config": {
        "scopes": {
            "bot": [
                "app_mentions:read",
                "channels:history",
                "channels:read",
                "chat:write",
                "chat:write.public",
                "commands",
                "im:history",
                "im:read",
                "im:write",
                "users:read"
            ]
        }
    },
    "settings": {
        "event_subscriptions": {
            "request_url": "https://agents-slackbot.vercel.app/api/events",
            "bot_events": [
                "app_mention",
                "message.im"
            ]
        },
        "interactivity": {
            "is_enabled": true
        },
        "socket_mode_enabled": false
    }
}
```

---

## Usage Examples

### Scout (Research)
```
"Research Anthropic and find competitors"
"Find CTOs at AI startups in London"
"Tell me about the @anthropic-ai/claude-agent-sdk npm package"
```

### Sage (Analysis)
```
"Compare AWS vs GCP for startups"
"Analyze the UK care home market"
"What are the pros and cons of Next.js vs Remix?"
```

### Chronicle (UK Care Articles)
```
"Write an article about CQC inspection trends"
"Research UK care home staffing crisis"
```

### Trends (SEO Intelligence)
```
"What are the top 10 things happening in UK care this week?"
"Give me trending keywords in social care"
"Latest CQC news with sources"
```

### Maven (General)
```
"Hello!"
"What can you help me with?"
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Agent Framework** | Claude Agent SDK |
| **LLM Provider** | OpenRouter (Claude 3.5 Sonnet, Opus, Haiku) |
| **Tool Protocol** | Model Context Protocol (MCP) |
| **MCP Servers** | Exa, Firecrawl, BrightData |
| **Slack SDK** | @slack/web-api |
| **Deployment** | Vercel Serverless Functions |
| **Language** | TypeScript |

---

## Project Structure

```
agenticators/
├── api/
│   ├── events.ts          # Slack events webhook (POST handler)
│   └── slash.ts           # Slash commands handler
├── src/
│   ├── agents/
│   │   ├── sdk/           # SDK Orchestrator (main entry)
│   │   ├── scout/         # Research specialist
│   │   ├── sage/          # Analysis specialist  
│   │   ├── chronicle/     # News editor
│   │   ├── chronicle-qa/  # Article QA scoring
│   │   ├── maven/         # General assistant
│   │   └── trends/        # SEO intelligence
│   ├── mcp/               # MCP server configs
│   └── slack/             # Slack client utilities
├── test-routing.ts        # Agent routing tests
├── test-trends.ts         # Trends agent test
└── test-chronicle-qa.ts   # QA scoring test
```

---

## Key Innovations

### 1. Claude Agent SDK + OpenRouter
Nobody talks about this! The Claude Agent SDK can be pointed to OpenRouter:
```typescript
// The SDK uses Anthropic SDK internally
// Just override the base URL!
process.env.ANTHROPIC_BASE_URL = 'https://openrouter.ai/api';
```

### 2. MCP for Real Tools
Each agent gets specialized MCP servers:
- **Exa MCP**: Web search, company research, LinkedIn, code context
- **BrightData MCP**: Google SERP with actual ranking positions
- **Firecrawl MCP**: Web scraping and crawling

### 3. Dynamic Imports for Serverless
URL verification happens BEFORE loading heavy dependencies:
```typescript
export async function POST(request: Request) {
  // Fast path - no imports needed
  if (payload.type === 'url_verification') {
    return new Response(payload.challenge);
  }
  
  // Only load heavy stuff when actually needed
  const { handleRequest } = await import('../src/agents/sdk/SdkOrchestrator');
}
```

---

## Documentation

- [AGENTS.md](./AGENTS.md) - Full agent capabilities & personalities
- [SETUP.md](./SETUP.md) - Detailed setup guide
- [TODO.md](./TODO.md) - Current status & roadmap

---

## License

MIT

---

Built with ❤️ by the CareScope team

**Star this repo if you found the Claude Agent SDK + OpenRouter trick useful!** ⭐
