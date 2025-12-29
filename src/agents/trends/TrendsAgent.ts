/**
 * Trends Agent - UK Care Sector Intelligence
 * 
 * Uses BrightData MCP to find trending topics, breaking news,
 * and key developments in UK social care. Provides actionable
 * insights for content planning and staying informed.
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

// BrightData MCP server configuration (stdio-based)
const BRIGHTDATA_MCP_SERVER = {
  type: 'stdio' as const,
  command: 'npx',
  args: ['@brightdata/mcp'],
  env: {
    API_TOKEN: process.env.BRIGHTDATA_API_KEY || '',
    PATH: process.env.PATH || '',
  },
};

// Get current date for context
function getCurrentDate(): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  return now.toLocaleDateString('en-GB', options);
}

// System prompt for Trends agent
const SYSTEM_PROMPT = `You are Trends, a UK care sector intelligence specialist for CareScope Intelligence.

TODAY'S DATE: ${getCurrentDate()}

PERSONALITY:
- Sharp, informed, and always up-to-date
- Like a newsroom editor who knows what's breaking
- Gets excited about scoops and emerging stories
- Uses phrases like "here's what's trending", "big development", "worth watching"

YOUR ROLE:
You help the CareScope team stay on top of what's happening in UK social care by:
1. Finding trending topics and breaking news
2. Identifying stories worth covering
3. Spotting emerging patterns and keywords
4. Providing content ideas with supporting evidence

UK CARE SECTOR FOCUS AREAS:
- CQC (Care Quality Commission) - inspections, ratings, enforcement
- Care homes and nursing homes - closures, openings, quality issues
- Domiciliary care / home care - staffing, funding, quality
- Social care funding - local authority budgets, government policy
- Workforce - recruitment, retention, training, pay
- Safeguarding - serious incidents, inquiries
- Technology in care - AI, digital records, telecare
- Policy - government announcements, legislation, reform
- Major providers - HC-One, Four Seasons, Barchester, Care UK, etc.

KEY UK SOURCES TO SEARCH:
- gov.uk, cqc.org.uk, nhs.uk (official)
- theguardian.com, bbc.com, telegraph.co.uk (national news)
- carehomemagazine.co.uk, careappointments.co.uk (trade)
- communitycare.co.uk, nursingtimes.net (professional)
- kingsfund.org.uk, nuffieldtrust.org.uk, health.org.uk (think tanks)
- skillsforcare.org.uk (workforce data)

OUTPUT FORMAT:
When reporting trends, always include:
1. **Headline/Topic** - Clear, compelling summary
2. **Why it matters** - Relevance to care sector
3. **Key details** - Who, what, when, where
4. **Source** - URL and publication name
5. **Content angle** - How CareScope could cover this

For weekly roundups, organize by category:
- Breaking/Urgent
- Policy & Regulation
- Workforce
- Quality & Safety
- Business & Finance
- Technology & Innovation

ALWAYS cite sources with URLs. Never make up news - only report what you find.`;

export interface TrendsResult {
  trends: TrendItem[];
  keywords: string[];
  contentIdeas: string[];
  fullResponse: string;
}

export interface TrendItem {
  headline: string;
  summary: string;
  source: string;
  url: string;
  category: string;
  relevance: string;
}

export interface StageCallback {
  (stage: 'searching' | 'analyzing' | 'compiling' | 'complete', data?: any): void;
}

/**
 * Get trending topics in UK care sector
 */
export async function getTrends(
  query_text: string,
  options: {
    onStage?: StageCallback;
    timeframe?: 'today' | 'this_week' | 'this_month';
  } = {}
): Promise<TrendsResult> {
  const { onStage, timeframe = 'this_week' } = options;

  onStage?.('searching');

  // Build time-aware prompt
  let timeContext = '';
  switch (timeframe) {
    case 'today':
      timeContext = 'from today only';
      break;
    case 'this_week':
      timeContext = 'from the past 7 days';
      break;
    case 'this_month':
      timeContext = 'from the past 30 days';
      break;
  }

  const prompt = `${query_text}

Focus on news and developments ${timeContext}.

Use the search_engine tool to search Google for relevant UK care sector news. Run multiple searches if needed to cover different aspects.

After gathering results, provide:
1. A summary of the top trends/stories
2. Key keywords that are trending
3. Content ideas for CareScope articles

Remember: Today is ${getCurrentDate()}. Only include recent, verified news with sources.`;

  let fullResponse = '';
  const toolsUsed: string[] = [];

  try {
    const response = query({
      prompt,
      options: {
        model: 'sonnet',
        systemPrompt: SYSTEM_PROMPT,
        mcpServers: {
          brightdata: BRIGHTDATA_MCP_SERVER,
        },
        tools: [],
        maxTurns: 8, // Allow multiple searches
        permissionMode: 'bypassPermissions',
      },
    });

    for await (const message of response) {
      if (message.type === 'assistant') {
        const content = (message as any).message?.content || [];
        for (const block of content) {
          if (block.type === 'tool_use') {
            onStage?.('searching', { tool: block.name });
            toolsUsed.push(block.name);
          } else if (block.type === 'text' && block.text) {
            fullResponse = block.text;
          }
        }
      } else if (message.type === 'result') {
        onStage?.('compiling');
      }
    }
  } catch (error: any) {
    console.error('Trends agent error:', error);
    fullResponse = `Error gathering trends: ${error.message}`;
  }

  onStage?.('complete');

  // Parse response to extract structured data
  const result = parseResponse(fullResponse);
  result.fullResponse = fullResponse;

  return result;
}

/**
 * Get weekly roundup of UK care news
 */
export async function getWeeklyRoundup(
  options: { onStage?: StageCallback } = {}
): Promise<TrendsResult> {
  return getTrends(
    `Give me a comprehensive roundup of the top 10 things that happened this week in UK social care.

Search for:
1. CQC news and enforcement actions
2. Care home closures or major incidents
3. Government policy announcements
4. Workforce and staffing news
5. Major provider news (HC-One, Four Seasons, etc.)
6. Funding and local authority news
7. Technology and innovation in care
8. Safeguarding concerns or inquiries

For each story, tell me:
- What happened
- Why it matters for the sector
- The source with URL
- A potential angle for CareScope coverage`,
    { ...options, timeframe: 'this_week' }
  );
}

/**
 * Get trending keywords in UK care
 */
export async function getTrendingKeywords(
  options: { onStage?: StageCallback } = {}
): Promise<TrendsResult> {
  return getTrends(
    `What are the trending keywords and topics in UK social care right now?

Search multiple sources to identify:
1. Breaking news topics getting coverage
2. Policy terms being discussed
3. Emerging issues in care homes
4. Workforce-related keywords
5. Technology and innovation terms

Provide a list of 15-20 keywords/phrases that are trending, with context on why each is relevant.`,
    { ...options, timeframe: 'this_week' }
  );
}

/**
 * Parse response to extract structured trend data
 */
function parseResponse(text: string): TrendsResult {
  const result: TrendsResult = {
    trends: [],
    keywords: [],
    contentIdeas: [],
    fullResponse: text,
  };

  // Extract keywords (look for numbered lists or bullet points)
  const keywordPatterns = [
    /(?:keyword|term|topic)s?:?\s*\n((?:[-•*\d.]+\s*.+\n?)+)/gi,
    /trending:?\s*\n((?:[-•*\d.]+\s*.+\n?)+)/gi,
  ];

  for (const pattern of keywordPatterns) {
    const match = text.match(pattern);
    if (match) {
      const lines = match[0].split('\n');
      for (const line of lines) {
        const cleaned = line.replace(/^[-•*\d.]+\s*/, '').trim();
        if (cleaned && cleaned.length > 2 && cleaned.length < 100) {
          result.keywords.push(cleaned);
        }
      }
    }
  }

  // Extract content ideas
  const ideaPatterns = [
    /content ideas?:?\s*\n((?:[-•*\d.]+\s*.+\n?)+)/gi,
    /article ideas?:?\s*\n((?:[-•*\d.]+\s*.+\n?)+)/gi,
    /coverage angles?:?\s*\n((?:[-•*\d.]+\s*.+\n?)+)/gi,
  ];

  for (const pattern of ideaPatterns) {
    const match = text.match(pattern);
    if (match) {
      const lines = match[0].split('\n');
      for (const line of lines) {
        const cleaned = line.replace(/^[-•*\d.]+\s*/, '').trim();
        if (cleaned && cleaned.length > 10) {
          result.contentIdeas.push(cleaned);
        }
      }
    }
  }

  return result;
}

/**
 * Format trends result for Slack
 */
export function formatTrendsForSlack(result: TrendsResult): string {
  let output = `📈 *Trends Report*\n\n`;
  output += result.fullResponse;

  if (result.keywords.length > 0) {
    output += `\n\n*Trending Keywords:*\n`;
    for (const keyword of result.keywords.slice(0, 10)) {
      output += `• ${keyword}\n`;
    }
  }

  if (result.contentIdeas.length > 0) {
    output += `\n*Content Ideas:*\n`;
    for (const idea of result.contentIdeas.slice(0, 5)) {
      output += `• ${idea}\n`;
    }
  }

  return output;
}
