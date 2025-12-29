import { AgentBase } from '../base/AgentBase.js';
import type { AgentConfig, Tool } from '../base/types.js';
import { Exa } from 'exa-js';

// Lazy initialization to avoid startup errors when EXA_API_KEY is not set
let exaClient: Exa | null = null;
function getExa(): Exa {
  if (!exaClient) {
    exaClient = new Exa(process.env.EXA_API_KEY);
  }
  return exaClient;
}

export class SageAgent extends AgentBase {
  constructor() {
    const config: AgentConfig = {
      personality: {
        name: 'Sage',
        role: 'sage',
        emoji: '🧙',
        catchphrase: "Let me break this down for you...",
        description: 'a thoughtful strategic analyst who helps people understand complex topics and make better decisions',
        specialization: ['analysis', 'comparison', 'strategic insights', 'market research', 'decision support'],
      },
      model: process.env.SAGE_MODEL || 'anthropic/claude-opus-4',
      temperature: 0.7,
      systemPrompt: `You are a strategic analyst who helps people understand complex topics and make better decisions.

You're like a wise mentor who simplifies complexity without dumbing things down.

ANALYSIS APPROACH:
- Use frameworks and mental models
- Ask clarifying questions before diving deep
- Provide 'executive summaries' before detailed analysis
- Use analogies to explain complex concepts
- Always show your reasoning

WHEN COMPARING OPTIONS:
- Present clear trade-offs, not just lists
- Consider multiple dimensions (cost, time, quality, risk)
- Recommend based on context, not absolutes
- Acknowledge limitations and uncertainties

WHEN ANALYZING MARKETS/TOPICS:
- Identify patterns and trends
- Connect dots that aren't obvious
- Provide strategic recommendations
- Consider second-order effects

PERSONALITY:
- Thoughtful and deliberate
- Patient and educational
- Use strategic language naturally
- Balance detail with clarity`,
    };

    super(config);
  }

  protected registerTools(): void {
    // Web search for context (Sage uses search to inform analysis)
    this.registerTool({
      name: 'searchForContext',
      description: 'Search the web for information to inform analysis. Use this to gather facts before analyzing.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query for background information' },
        },
        required: ['query'],
      },
      execute: async (params: { query: string }) => {
        const { query } = params;

        const { results } = await getExa().searchAndContents(query, {
          livecrawl: 'fallback',
          numResults: 5,
          text: true,
        });

        return {
          query,
          results: results.map((r: any) => ({
            title: r.title,
            url: r.url,
            snippet: r.text?.slice(0, 800) || '',
            publishedDate: r.publishedDate,
          })),
        };
      },
    });

    // Market research tool
    this.registerTool({
      name: 'researchMarket',
      description: 'Research a market, industry, or topic for strategic analysis. Gathers multiple perspectives.',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'Market or topic to research (e.g., "UK social care market", "AI agent frameworks")',
          },
          includeCompetitors: {
            type: 'boolean',
            description: 'Whether to include competitive landscape',
            default: false,
          },
        },
        required: ['topic'],
      },
      execute: async (params: { topic: string; includeCompetitors?: boolean }) => {
        const { topic, includeCompetitors } = params;

        // Search for market overview
        const { results: overviewResults } = await getExa().searchAndContents(
          `${topic} market overview 2024 2025`,
          {
            numResults: 4,
            livecrawl: 'fallback',
            text: true,
          }
        );

        // Search for trends and analysis
        const { results: trendResults } = await getExa().searchAndContents(
          `${topic} trends analysis`,
          {
            numResults: 3,
            category: 'research paper',
            livecrawl: 'fallback',
            text: true,
          }
        );

        let competitorData = undefined;

        if (includeCompetitors) {
          try {
            const { results: compResults } = await getExa().searchAndContents(
              `${topic} key players companies`,
              {
                numResults: 3,
                category: 'company',
                livecrawl: 'fallback',
                text: true,
              }
            );

            competitorData = compResults.map((r: any) => ({
              title: r.title,
              url: r.url,
              description: r.text?.slice(0, 500) || '',
            }));
          } catch (error) {
            // Continue without competitor data
          }
        }

        return {
          topic,
          overview: overviewResults.map((r: any) => ({
            title: r.title,
            url: r.url,
            content: r.text?.slice(0, 1000) || '',
          })),
          trends: trendResults.map((r: any) => ({
            title: r.title,
            url: r.url,
            content: r.text?.slice(0, 1000) || '',
          })),
          competitors: competitorData,
        };
      },
    });
  }

  protected getErrorMessage(error: any): string {
    return `🧙 I need a moment to gather my thoughts. This is more complex than I initially assessed. Let me try a different approach, or feel free to rephrase your question.`;
  }
}
