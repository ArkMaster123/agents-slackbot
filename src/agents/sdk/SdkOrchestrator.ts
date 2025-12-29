/**
 * SDK-based Orchestrator using Claude Agent SDK with MCP
 * 
 * This orchestrator uses the Claude Agent SDK to:
 * 1. Route requests to the appropriate agent
 * 2. Use MCP tools (Exa for search, Firecrawl for scraping)
 * 3. Stream responses with stage callbacks
 */

import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { AgentRole, AgentContext, AgentResponse } from '../base/types.js';

// Agent configurations with system prompts
const AGENTS: Record<AgentRole, { 
  name: string; 
  emoji: string; 
  systemPrompt: string;
  model: string;
}> = {
  scout: {
    name: 'Scout',
    emoji: '🔍',
    model: 'sonnet',
    systemPrompt: `You are Scout, a resourceful research specialist who takes pride in finding exactly what people need.

PERSONALITY:
- Casual but professional, like a skilled investigator sharing findings
- Uses detective metaphors ("I've got a lead on that...")
- Gets excited about surprising findings
- Acknowledges gaps honestly

YOUR TOOLS:
- **web_search_exa** - Search the web for any information
- **company_research_exa** - Deep company intelligence (use for business research)
- **linkedin_search_exa** - Find people and companies on LinkedIn
- **crawling_exa** - Extract content from specific URLs
- **get_code_context_exa** - GET CODE/REPO INFO! Use this for:
  - GitHub repositories
  - Library/SDK documentation
  - API references
  - Code examples
  - Programming questions

WHEN TO USE EACH:
- General research → web_search_exa
- Company info → company_research_exa
- Find people → linkedin_search_exa
- Code/repos/libraries → get_code_context_exa
- Specific URL content → crawling_exa

Always cite sources with URLs in your responses.`,
  },
  sage: {
    name: 'Sage',
    emoji: '🧙',
    model: 'sonnet',
    systemPrompt: `You are Sage, a thoughtful strategic analyst who helps understand complex topics.

PERSONALITY:
- Thoughtful and deliberate
- Uses frameworks and mental models
- Provides executive summaries before details
- Uses analogies to explain concepts

CAPABILITIES:
- Analyze and compare options
- Provide strategic recommendations
- Break down complex topics

Always acknowledge uncertainty and provide balanced perspectives.`,
  },
  chronicle: {
    name: 'Chronicle',
    emoji: '✍️',
    model: 'sonnet',
    systemPrompt: `You are Chronicle, a senior journalist for CareScope Intelligence covering UK social care.

PERSONALITY:
- Professional journalist tone
- Uses journalism jargon ("what's the lede?", "let's fact-check that")
- High editorial standards
- Passionate about UK social care

CAPABILITIES:
- Research UK social care topics using web search
- Write news articles with proper structure
- Verify sources and attribute properly

ALWAYS use British English (analyse, organisation, recognise).`,
  },
  maven: {
    name: 'Maven',
    emoji: '👋',
    model: 'haiku',
    systemPrompt: `You are Maven, the friendly face of the AI team.

PERSONALITY:
- Very conversational and approachable
- Casual but professional
- Genuinely helpful and encouraging
- Great at understanding what people need

CAPABILITIES:
- Answer general questions
- Help users understand what each agent does
- Route to specialists when needed

When you detect a specialized need, suggest the right agent:
- Research/finding info → Scout 🔍
- Analysis/strategy → Sage 🧙
- UK care articles → Chronicle ✍️
- Trends/what's happening → Trends 📈`,
  },
  trends: {
    name: 'Trends',
    emoji: '📈',
    model: 'sonnet',
    systemPrompt: `You are Trends, a UK care sector intelligence specialist.

TODAY: ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}

TOOLS:
- **perplexity_ask**: AI-powered search with citations - USE THIS FIRST for news!
- **web_search_exa**: Search for specific topics

WORKFLOW:
1. Use perplexity_ask to find "latest UK care home news December 2025"
2. Summarize the TOP 5 stories with sources
3. Extract trending keywords

OUTPUT FORMAT (keep it concise for Slack):
**📰 TOP UK CARE NEWS**

1. **[Headline]** - [Source]
   Brief summary

2. **[Headline]** - [Source]
   Brief summary

(max 5 stories)

**🔥 TRENDING:** [5-10 keywords]

Keep responses under 2000 characters. Be concise. Always cite sources.`,
  },
  orchestrator: {
    name: 'Orchestrator',
    emoji: '🎯',
    model: 'haiku',
    systemPrompt: 'Internal routing agent.',
  },
};

// Exa MCP server configuration (remote HTTP) - FULL tools including code context
const EXA_MCP_SERVER = {
  type: 'http' as const,
  url: `https://mcp.exa.ai/mcp?exaApiKey=${process.env.EXA_API_KEY}&tools=web_search_exa,crawling_exa,company_research_exa,linkedin_search_exa,get_code_context_exa`,
};

// Firecrawl MCP server (local stdio-based)
const FIRECRAWL_MCP_SERVER = {
  type: 'stdio' as const,
  command: 'npx',
  args: ['firecrawl-mcp'],
  env: { 
    FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY || '',
    PATH: process.env.PATH || '',
  },
};

// BrightData MCP server (local stdio-based) - for trends and real-time data
const BRIGHTDATA_MCP_SERVER = {
  type: 'stdio' as const,
  command: 'npx',
  args: ['@brightdata/mcp'],
  env: {
    API_TOKEN: process.env.BRIGHTDATA_API_KEY || '',
    PATH: process.env.PATH || '',
  },
};

// Perplexity MCP server - for AI-powered search with citations
const PERPLEXITY_MCP_SERVER = {
  type: 'stdio' as const,
  command: 'npx',
  args: ['-y', 'server-perplexity-ask'],
  env: {
    PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY || '',
    PATH: process.env.PATH || '',
  },
};

// MCP servers by agent type
const MCP_SERVERS: Record<string, Record<string, any>> = {
  scout: { exa: EXA_MCP_SERVER, perplexity: PERPLEXITY_MCP_SERVER },
  sage: { exa: EXA_MCP_SERVER, perplexity: PERPLEXITY_MCP_SERVER },
  chronicle: { exa: EXA_MCP_SERVER, firecrawl: FIRECRAWL_MCP_SERVER },
  trends: { exa: EXA_MCP_SERVER, perplexity: PERPLEXITY_MCP_SERVER }, // Exa + Perplexity for trends
  maven: { perplexity: PERPLEXITY_MCP_SERVER }, // Perplexity for general questions
  orchestrator: {},
};

/**
 * Classify user intent to determine which agent should handle the request
 */
function classifyIntent(message: string): AgentRole {
  const lower = message.toLowerCase();

  // Trends triggers - check first for time-sensitive queries
  if (/\b(trend|trending|this week|today|happening|top \d+|what.?s new|latest|breaking|roundup|keywords?|buzz)\b/.test(lower)) {
    return 'trends';
  }

  // Scout triggers - including code/repo questions
  if (/\b(research|find|search|look up|prospect|company|competitors?|who is|linkedin|people at|repo|repository|github|library|sdk|api|code|npm|package)\b/.test(lower)) {
    return 'scout';
  }

  // Sage triggers
  if (/\b(analy[sz]e|compare|versus|vs|strategy|recommend|should i|pros and cons|trade-?offs?|market)\b/.test(lower)) {
    return 'sage';
  }

  // Chronicle triggers
  if (/\b(article|write|news|carescope|cqc|care home|domiciliary|social care|publish)\b/.test(lower)) {
    return 'chronicle';
  }

  // Default to Maven
  return 'maven';
}

export interface StageCallback {
  (stage: 'routing' | 'thinking' | 'tool_call' | 'responding', data?: any): void;
}

export interface SdkOrchestratorOptions {
  onStage?: StageCallback;
}

/**
 * Handle a request using the Claude Agent SDK
 */
export async function handleRequest(
  context: AgentContext,
  options: SdkOrchestratorOptions = {}
): Promise<AgentResponse> {
  const { onStage } = options;

  // Get the last user message
  const lastMessage = context.messages
    .filter((m: { role: string }) => m.role === 'user')
    .pop();

  if (!lastMessage || typeof lastMessage.content !== 'string') {
    return {
      text: "I didn't catch that. Could you please repeat?",
      agent: 'maven',
      toolsUsed: [],
    };
  }

  const userMessage = lastMessage.content;

  // Classify intent
  onStage?.('routing');
  const targetAgent = classifyIntent(userMessage);
  const agent = AGENTS[targetAgent];

  onStage?.('thinking', { agent: agent.name, emoji: agent.emoji });

  // Build conversation history
  const conversationHistory = context.messages
    .map((m: { role: string; content: string | any }) => {
      if (m.role === 'user') {
        return `User: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`;
      }
      return `Assistant: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`;
    })
    .join('\n\n');

  // Create prompt with context
  const prompt = conversationHistory.length > 0
    ? `Previous conversation:\n${conversationHistory}\n\nCurrent request: ${userMessage}`
    : userMessage;

  // Query with Claude Agent SDK
  const toolsUsed: string[] = [];
  let responseText = '';

  try {
    // Get MCP servers for this agent
    const agentMcpServers = MCP_SERVERS[targetAgent] || {};

    const response = query({
      prompt,
      options: {
        model: agent.model,
        systemPrompt: agent.systemPrompt,
        mcpServers: agentMcpServers,
        tools: [], // Disable built-in tools, only use MCP
        maxTurns: 5,
        // YOLO mode - bypass all permission checks
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        // Pass environment variables to the Claude CLI subprocess
        env: {
          ...process.env,
          ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api',
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY,
          HOME: process.env.HOME || '/home/agenticators',
        },
      },
    });

    for await (const message of response) {
      if (message.type === 'assistant') {
        const content = (message as any).message?.content || [];
        for (const block of content) {
          if (block.type === 'tool_use') {
            onStage?.('tool_call', { tool: block.name });
            toolsUsed.push(block.name);
          } else if (block.type === 'text' && block.text) {
            responseText = block.text;
          }
        }
      } else if (message.type === 'result') {
        onStage?.('responding');
      }
    }
  } catch (error: any) {
    console.error('SDK query error:', error);
    responseText = `${agent.emoji} I encountered an issue while processing your request. Please try again.`;
  }

  // Format for Slack
  const slackFormattedText = formatForSlack(responseText);

  return {
    text: `${agent.emoji} *${agent.name}*\n\n${slackFormattedText}`,
    agent: targetAgent,
    toolsUsed,
  };
}

/**
 * Format text for Slack (markdown to Slack mrkdwn)
 */
function formatForSlack(text: string): string {
  return text
    .replace(/\[(.*?)\]\((.*?)\)/g, '<$2|$1>') // Convert [text](url) to <url|text>
    .replace(/\*\*/g, '*') // Convert ** to *
    .trim();
}

/**
 * Get info about all available agents
 */
export function getAgents() {
  return Object.entries(AGENTS)
    .filter(([role]) => role !== 'orchestrator')
    .map(([role, agent]) => ({
      role: role as AgentRole,
      name: agent.name,
      emoji: agent.emoji,
    }));
}
