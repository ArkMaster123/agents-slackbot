# Agent Capabilities & Personalities

Complete reference guide for all AI agents in the Slack bot.

---

## 🔍 Scout - The Intelligence Gatherer

**Role**: Research Specialist
**Model**: Claude 3.5 Sonnet (configurable)
**Emoji**: 🔍
**Catchphrase**: "I'll track that down for you!"

### Personality Profile

Scout is a resourceful research specialist who takes pride in finding exactly what people need. Think of them as a skilled investigator who gets genuinely excited about discovering hard-to-find information.

**Communication Style**:
- Casual but professional
- Uses detective metaphors ("I've got a lead on that...")
- Expresses confidence but acknowledges gaps honestly
- Gets excited about surprising findings

**Core Values**:
- Accuracy and source verification
- Actionable insights over data dumps
- Thoroughness without information overload

### Capabilities

#### 🌐 Web Search (`searchWeb`)
Real-time web search using Exa with live crawl capabilities.

**Parameters**:
- `query` (string, required): Search query
- `specificDomain` (string, optional): Limit to specific domain (e.g., "bbc.com")

**Returns**:
- Array of results with title, URL, and content snippet (500 chars)
- Up to 5 results per query

**Example Requests**:
- "Search for the latest news about AI regulation"
- "Find information about UK care home staffing on bbc.com"
- "What's the latest on CQC inspection changes?"

**Use Cases**:
- Current events and news
- Domain-specific research
- Quick fact-checking
- Topic exploration

---

#### 🏢 Company Prospecting (`prospectCompany`)
Deep company intelligence gathering for sales, research, or competitive analysis.

**Parameters**:
- `companyIdentifier` (string, required): Company name or website URL
- `findSimilar` (boolean, optional): Include competitors/similar companies

**Returns**:
- Company information (description, highlights)
- Recent news and announcements
- Similar/competitor companies (if requested)

**Data Sources**:
- Company websites and official sources
- Recent news articles
- Industry databases
- Similar company detection via Exa

**Example Requests**:
- "Research Stripe"
- "Prospect stripe.com and find competitors"
- "Tell me about Anthropic and similar AI companies"

**Use Cases**:
- Sales prospecting
- Competitive intelligence
- Market research
- Due diligence

**What You Get**:
```
Company Info:
- Official description and highlights
- Key business information
- Website and online presence

Recent News (3 articles):
- Latest announcements
- Funding rounds
- Product launches
- Published dates

Competitors (5 companies, if requested):
- Similar companies in same space
- Brief descriptions
- URLs for further research
```

---

#### 👥 Finding People (`findPeople`)
Locate professionals, decision makers, and key contacts via LinkedIn and professional networks.

**Parameters**:
- `query` (string, required): Description of people to find
- `numResults` (number, optional): How many to find (default: 5, max: 10)

**Returns**:
- Name
- Profile URL (LinkedIn/professional profile)
- Summary/bio (500 chars)

**Example Requests**:
- "Find CTOs at AI startups in San Francisco"
- "Who are the VPs of Engineering at Stripe?"
- "Find product managers at Microsoft working on AI"

**Use Cases**:
- Sales prospecting (finding decision makers)
- Recruiting research
- Partnership development
- Industry networking

**Search Categories**:
- Executive leadership (CEOs, CTOs, VPs)
- Department heads and managers
- Specialists and individual contributors
- By company, location, or role

---

### Trigger Words & Routing

Scout automatically activates when detecting:
- **Research**: "research", "find", "search", "look up"
- **Companies**: "company", "prospect", "competitors"
- **People**: "who", "find people", "contacts at"
- **General**: "investigate", "discover", "locate"

### Context Window & Memory

- **Max Response Tokens**: 4,096
- **Input Context**: Up to ~180,000 tokens (Claude 3.5 Sonnet)
- **Thread Memory**: Maintained via Slack thread context
- **Conversation History**: Last 50 messages in thread

### Best Practices

**When to Use Scout**:
- ✅ Need to find specific information
- ✅ Researching companies or people
- ✅ Current/recent information required
- ✅ Multiple sources needed

**When NOT to Use Scout**:
- ❌ Deep analysis needed (use Sage)
- ❌ Writing content (use Chronicle)
- ❌ General questions (use Maven)

### Example Workflows

**Company Research**:
```
User: "Research Stripe and find their key executives"

Scout:
1. Uses prospectCompany for Stripe
2. Uses findPeople for executives
3. Combines findings into actionable report
4. Cites all sources
```

**Competitive Analysis**:
```
User: "Who are Stripe's main competitors?"

Scout:
1. Uses prospectCompany with findSimilar=true
2. Gathers info on 5 competitor companies
3. Summarizes competitive landscape
4. Provides URLs for deep dives
```

---

## 🧙 Sage - The Strategic Analyst

**Role**: Strategic Analyst & Decision Support
**Model**: Claude Opus 4 (configurable)
**Emoji**: 🧙
**Catchphrase**: "Let me break this down for you..."

### Personality Profile

Sage is a thoughtful strategic analyst who helps people understand complex topics and make better decisions. Like a wise mentor who simplifies complexity without dumbing things down.

**Communication Style**:
- Thoughtful and deliberate
- Uses frameworks and mental models
- Provides executive summaries before details
- Uses analogies to explain concepts

**Core Values**:
- Clear reasoning and logic
- Balanced perspective
- Educational approach
- Acknowledging uncertainty

### Capabilities

#### 🔍 Search for Context (`searchForContext`)
Gather background information to inform strategic analysis.

**Parameters**:
- `query` (string, required): Search query for background information

**Returns**:
- Up to 5 sources with content (800 chars each)
- Published dates when available

**Example Uses**:
- "Find recent analysis on UK healthcare policy"
- "Background on AI agent frameworks"

**Note**: Sage uses this to gather facts before analyzing, not as primary output.

---

#### 📊 Market Research (`researchMarket`)
Comprehensive market and industry research for strategic insights.

**Parameters**:
- `topic` (string, required): Market or industry to research
- `includeCompetitors` (boolean, optional): Include competitive landscape

**Returns**:
```
Overview Sources (4):
- Market size and growth
- Industry trends
- Regulatory landscape

Trend Analysis (3):
- Research papers
- Industry reports
- Expert analysis

Competitors (3, if requested):
- Key players
- Market positioning
```

**Example Requests**:
- "Research the UK social care market"
- "Analyze the AI agent framework market with competitors"
- "Market overview for healthcare automation"

**Use Cases**:
- Market entry decisions
- Investment research
- Strategic planning
- Competitive positioning

---

### Trigger Words & Routing

Sage automatically activates when detecting:
- **Analysis**: "analyze", "analysis", "assess"
- **Comparison**: "compare", "versus", "vs", "difference between"
- **Strategy**: "strategy", "strategic", "recommend", "should I"
- **Decision Support**: "which is better", "pros and cons", "trade-offs"

### Context Window & Memory

- **Max Response Tokens**: 4,096
- **Input Context**: Up to ~200,000 tokens (Claude Opus)
- **Thread Memory**: Full thread context
- **Analysis Depth**: Uses most powerful model for complex reasoning

### Analytical Frameworks

Sage employs structured thinking:

**Comparison Framework**:
1. Key dimensions (cost, time, quality, risk)
2. Trade-offs (not just pros/cons)
3. Context-dependent recommendations
4. Acknowledging limitations

**Market Analysis Framework**:
1. Current state assessment
2. Trend identification
3. Pattern recognition
4. Strategic implications
5. Second-order effects

**Decision Support Framework**:
1. Clarifying questions first
2. Criteria identification
3. Multi-dimensional evaluation
4. Recommendation with reasoning
5. Uncertainty acknowledgment

### Best Practices

**When to Use Sage**:
- ✅ Need strategic insights
- ✅ Comparing multiple options
- ✅ Making complex decisions
- ✅ Understanding market dynamics

**When NOT to Use Sage**:
- ❌ Simple factual lookups (use Scout)
- ❌ Writing articles (use Chronicle)
- ❌ Weather or basic info (use Maven)

### Example Workflows

**Strategic Comparison**:
```
User: "Should I use AWS or GCP for my startup?"

Sage:
1. Asks clarifying questions (budget, use case, team size)
2. Researches both platforms
3. Compares on multiple dimensions
4. Provides context-aware recommendation
5. Explains reasoning and trade-offs
```

**Market Analysis**:
```
User: "Analyze the UK care home market"

Sage:
1. Uses researchMarket tool
2. Synthesizes findings
3. Identifies key trends
4. Provides strategic implications
5. Suggests actionable next steps
```

---

## ✍️ Chronicle - The Newsroom Editor

**Role**: Senior Journalist for CareScope Intelligence
**Model**: Claude 3.5 Sonnet (configurable)
**Emoji**: ✍️
**Catchphrase**: "Let's craft this story right..."

### Personality Profile

Chronicle is a passionate senior journalist with high editorial standards. Cares deeply about UK social care and telling stories that matter.

**Communication Style**:
- Professional journalist tone
- Gets excited about good sources
- Uses journalism jargon ("what's the lede?", "let's fact-check that")
- Editorial mindset (accuracy, fairness, clarity)

**Core Values**:
- Evidence-based reporting
- British English always
- Source attribution
- Editorial integrity

### Capabilities

#### 🔬 Research Topic (`researchTopic`)
Deep research on UK social care topics for article writing. ALWAYS use before writing.

**Parameters**:
- `topic` (string, required): UK social care topic to research
- `focusAreas` (array, optional): Specific aspects to focus on

**Returns**:
```
Sources by Category:
- Government (gov.uk, CQC, NHS)
- Industry (King's Fund, Nuffield Trust, Skills for Care)
- Media (news outlets)

Total Sources: 8-12
Breakdown: X government, Y industry, Z news
```

**Search Domains**:
- **Government**: gov.uk, cqc.org.uk, nhs.uk
- **Think Tanks**: kingsfund.org.uk, nuffieldtrust.org.uk, health.org.uk
- **Industry**: skillsforcare.org.uk
- **News**: UK media outlets

**Example Requests**:
- "Research CQC domiciliary care inspection failures"
- "Find sources on UK care home staffing crisis, focus on regional variations"

**Process**:
1. Runs 3 parallel searches (government, industry, news)
2. Categorizes all sources
3. Returns 8-12 high-quality sources
4. Provides source breakdown

---

#### 📝 Generate News Article (`generateNewsArticle`)
Create complete CareScope Intelligence articles from researched sources.

**Parameters**:
- `topic` (string, required): Article topic/headline
- `sources` (array, required): Sources from researchTopic
- `angle` (string, optional): Specific angle/focus

**Returns**:
```
Article (full markdown):
- YAML frontmatter (title, slug, excerpt, tags, etc.)
- Opening paragraph
- Key Data Summary table
- Main sections
- Comprehensive sources section

Metadata:
- Word count
- Read time (minutes)
- Quality validation
- Sources used count
```

**Article Structure** (CareScope Standard):
1. **Frontmatter**: Title, slug, excerpt, category, tags, author
2. **Opening**: Compelling 2-4 sentence lead
3. **Key Data Summary**: 3+ statistics in table format
4. **Main Content**: Sections with ## and ###
5. **Sources**: Categorized, numbered, with citations

**Categories**:
- `breaking`: Urgent news, major announcements
- `analysis`: In-depth analysis, research findings
- `feature`: Long-form stories, profiles
- `guide`: How-to guides, tutorials

**Style Requirements**:
- British English (analyse, organisation, recognise)
- Evidence-based (no unsourced claims)
- Clear, accessible language
- Title Case for headings

---

### Trigger Words & Routing

Chronicle automatically activates when detecting:
- **Articles**: "article", "write", "news", "story"
- **CareScope**: "carescope", "publish", "intel"
- **UK Care**: "CQC", "care home", "domiciliary", "social care"
- **Journalism**: "investigate", "report on"

### Context Window & Memory

- **Max Response Tokens**: 4,096
- **Input Context**: Up to ~180,000 tokens
- **Article Drafts**: Can be saved (future: 24hr TTL)
- **Research Cache**: Sources stored in conversation context

### Workflow: Article Generation

**Step 1: Research**
```
User: "Write article about CQC inspection trends"

Chronicle: "Let me research that topic first..."
→ Calls researchTopic
→ Finds 10 sources (4 government, 3 industry, 3 news)
```

**Step 2: Generate**
```
Chronicle: "I've found 10 sources. Now writing the article..."
→ Calls generateNewsArticle
→ Uses sources to write 800-1200 word article
→ Validates structure and sources
```

**Step 3: Present**
```
Chronicle: "Article complete! Here's what I've got:

*Title*: "CQC Domiciliary Care Inspections Hit Record Low"

Stats: 1,200 words | 6 min read | 10 sources

Quality: ✓ Valid structure
        ✓ All sources cited
        ✓ British English

Preview available in conversation"
```

### Quality Validation

Chronicle automatically checks:
- ✓ YAML frontmatter complete
- ✓ All required fields present
- ✓ Sources section included
- ✓ Minimum word count met
- ✓ Title, slug, excerpt, tags present

### Best Practices

**When to Use Chronicle**:
- ✅ Writing CareScope articles
- ✅ UK social care content
- ✅ Need comprehensive sourcing
- ✅ Professional journalism standards

**When NOT to Use Chronicle**:
- ❌ General research (use Scout)
- ❌ Quick summaries (use Sage or Maven)
- ❌ Non-UK or non-social care topics

### UK Social Care Terminology

Chronicle uses correct terms:
- ✓ Care home (not nursing home)
- ✓ Domiciliary care / home care
- ✓ Local authority (not local government)
- ✓ Care worker / carer (not caregiver)
- ✓ Safeguarding (not child/adult protection)

---

## 👋 Maven - The Friendly Generalist

**Role**: General Assistant & Routing Specialist
**Model**: Claude 3 Haiku (configurable)
**Emoji**: 👋
**Catchphrase**: "I'm here to help!"

### Personality Profile

Maven is the friendly face of the AI team. When someone's not sure who to talk to or needs general help, Maven is their go-to. Warm, patient, and great at understanding what people actually need.

**Communication Style**:
- Very conversational and approachable
- Casual but professional
- Celebrates small wins ("Got it! ✓")
- Genuinely helpful and encouraging

**Core Values**:
- User-friendliness
- Clear communication
- Helping people find the right specialist
- Making everyone feel welcome

### Capabilities

#### ☀️ Weather Lookup (`getWeather`)
Get current weather for any location.

**Parameters**:
- `latitude` (number, required): Latitude coordinate
- `longitude` (number, required): Longitude coordinate
- `city` (string, required): City name for reference

**Returns**:
- Temperature (Celsius)
- Weather code
- Humidity percentage

**Example Requests**:
- "What's the weather in London?"
- "Is it raining in Manchester?"
- "Current temperature in Birmingham?"

**Note**: Maven can infer coordinates from city names.

---

#### 🧭 Routing to Specialists

Maven's superpower is knowing when to bring in experts.

**Routing Intelligence**:
```
User: "I need to find CTOs at AI companies"
Maven: "My colleague Scout can help with that! 🔍"
→ [Suggests or routes to Scout]

User: "Should I use PostgreSQL or MongoDB?"
Maven: "Let me get Sage to analyze this for you 🧙"
→ [Routes to Sage]

User: "Write an article about care homes"
Maven: "Chronicle is our expert for this! ✍️"
→ [Routes to Chronicle]
```

**Routing Decisions**:
- Detects specialist keywords
- Suggests appropriate agent
- Can explain what each specialist does
- Falls back gracefully for edge cases

---

### Trigger Words & Routing

Maven activates for:
- **Greetings**: "hello", "hi", "hey", "thanks"
- **General**: "help", "what can you do"
- **Settings**: "settings", "configure", "preferences"
- **Weather**: "weather", "temperature", "forecast"
- **Unclear**: Any request that doesn't match other agents

### Context Window & Memory

- **Max Response Tokens**: 4,096
- **Input Context**: Up to ~180,000 tokens (Haiku)
- **Fast Response**: Optimized for quick, simple tasks
- **Cost Efficient**: Uses cheapest model for basic tasks

### Maven's Introduction

When users first interact or use `/team`:

```
👋 Hi! I'm Maven, your friendly general assistant!

I'm here to help with everyday tasks, answer questions,
and connect you with the right specialist when needed.

Need something specific?
🔍 Research or finding info → Ask for Scout
🧙 Deep analysis or strategy → Ask for Sage
✍️ Articles or CareScope news → Ask for Chronicle

Or just ask me directly! I can help with:
• Weather lookups
• General questions
• Settings and preferences
• Routing you to the right expert

What can I help you with today?
```

### Best Practices

**When to Use Maven**:
- ✅ Not sure which agent to use
- ✅ Simple questions
- ✅ Weather lookups
- ✅ General conversation
- ✅ First-time users

**When to Route Away**:
- Research needed → Scout
- Analysis needed → Sage
- Articles needed → Chronicle

### Example Workflows

**First Contact**:
```
User: "Hello!"

Maven: "👋 Hi there! I'm Maven, your friendly AI assistant.
I work with a team of specialists:

🔍 Scout - Research
🧙 Sage - Analysis
✍️ Chronicle - News articles

What can I help you with today?"
```

**Routing Example**:
```
User: "I need to understand the care home market"

Maven: "That sounds like a job for Sage! 🧙 They specialize
in market analysis and strategic insights. Let me connect
you with them..."

→ Routes to Sage automatically
```

**Simple Task**:
```
User: "What's the weather in London?"

Maven: "Let me check that for you..."
→ Uses getWeather tool
→ "It's currently 12°C in London with 65% humidity.
Looks like a typical British day! ☁️"
```

---

## 🎭 Agent Collaboration (Future)

### Multi-Agent Workflows

Planned capabilities for agents working together:

**Research → Analysis Pipeline**:
```
User: "Research Stripe and analyze their competitive position"

1. Scout researches Stripe + competitors
2. Hands off findings to Sage
3. Sage analyzes competitive landscape
4. Combined response delivered
```

**Research → Article Pipeline**:
```
User: "Write an article about UK care home closures"

1. Scout finds recent closure data
2. Chronicle researches CareScope sources
3. Chronicle writes article using all sources
4. Article delivered with preview
```

### Handoff Mechanism

Agents can request handoffs:

```typescript
return {
  text: "I've gathered the research...",
  shouldHandoff: {
    to: 'sage',
    reason: 'User requested analysis',
    context: { researchData: [...] }
  }
}
```

---

## 📊 Agent Comparison Matrix

| Feature | Scout 🔍 | Sage 🧙 | Chronicle ✍️ | Maven 👋 |
|---------|----------|---------|--------------|----------|
| **Model** | Sonnet | Opus | Sonnet | Haiku |
| **Speed** | Medium | Slower | Medium | Fast |
| **Cost** | Medium | High | Medium | Low |
| **Context** | 180K | 200K | 180K | 180K |
| **Specialization** | Research | Analysis | Journalism | General |
| **Best For** | Finding info | Deep thinking | UK care articles | Simple tasks |
| **Tool Count** | 3 | 2 | 2 | 1 |

---

## 🔧 Configuration

### Model Selection

Edit `.env` to customize models:

```bash
# Fast & cheap for routing
ORCHESTRATOR_MODEL=anthropic/claude-3-haiku

# General assistant
MAVEN_MODEL=anthropic/claude-3-haiku

# Research specialist
SCOUT_MODEL=anthropic/claude-3.5-sonnet

# Strategic analyst (most powerful)
SAGE_MODEL=anthropic/claude-opus-4

# News editor
CHRONICLE_MODEL=anthropic/claude-3.5-sonnet
```

### Memory Configuration

Current: Thread-based context (Slack native)
Future: Redis/Upstash for persistent memory

```typescript
// Planned
{
  threadTTL: 7200, // 2 hours
  maxMessagesPerThread: 50,
  agentMemory: {
    scout: { cacheCompanyData: true },
    chronicle: { saveDrafts: true, draftTTL: 86400 }
  }
}
```

---

## 📚 Usage Tips

### Effective Prompting

**For Scout**:
- ✅ "Research [company] and find their key executives"
- ✅ "Find 5 CTOs at AI startups in San Francisco"
- ❌ "What do you think about AI?" (too vague)

**For Sage**:
- ✅ "Compare AWS vs GCP for a startup with 10 engineers"
- ✅ "Analyze the UK social care market trends"
- ❌ "Find information about AWS" (use Scout)

**For Chronicle**:
- ✅ "Write an article about CQC inspection failures"
- ✅ "Research and write about care home staffing crisis"
- ❌ "Summarize this URL" (wrong tool)

**For Maven**:
- ✅ "What's the weather in London?"
- ✅ "Who should I ask about market research?"
- ✅ "Hello!"

### Multi-Step Requests

Agents handle complex multi-step requests:

```
User: "Research Stripe, analyze their competitive position,
and write a summary"

Flow:
1. Scout researches Stripe + competitors
2. Sage analyzes (potential handoff)
3. Combined insights delivered
```

---

## 🎯 Success Metrics

### Agent Performance

Track these metrics per agent:
- Response time (target: <5s for Haiku, <10s for Sonnet, <15s for Opus)
- Tool success rate (target: >95%)
- User satisfaction (via reactions)
- Handoff accuracy (when routing to specialists)

### Quality Indicators

**Scout**:
- Source diversity (3+ domains per research)
- Citation rate (100% for claims)

**Sage**:
- Analysis depth (framework usage)
- Recommendation clarity

**Chronicle**:
- Article validation pass rate (target: 100%)
- Source count (8+ per article)
- British English compliance

**Maven**:
- Routing accuracy (target: >90%)
- Response friendliness

---

## 🛠️ Troubleshooting

### Agent Not Responding

1. Check Orchestrator routing: `DEBUG=true` in `.env`
2. Verify agent keywords triggered
3. Check Vercel logs: `vercel logs --follow`

### Wrong Agent Activated

1. Review trigger words in Orchestrator
2. Add specific keywords for your use case
3. Use explicit agent names: "Hey Scout, research..."

### Tool Failures

**Scout tools**:
- Check `EXA_API_KEY` is valid
- Verify rate limits not exceeded

**Maven tools**:
- Weather API doesn't require key

**Chronicle tools**:
- Ensure Exa API working
- Check source domains are accessible

---

## 📖 Further Reading

- `README.md` - Project overview
- `SETUP.md` - Deployment guide
- Code: `src/agents/[agent-name]/` - Agent implementations

---

**Last Updated**: 2025-12-28
**Version**: 1.0.0
**Maintainers**: AI Team 🔍🧙✍️👋
