import { AgentBase } from '../base/AgentBase.js';
import type { AgentConfig, Tool } from '../base/types.js';
import Exa from 'exa-js';

// Lazy initialization to avoid loading before env vars are set
let exaClient: Exa | null = null;
function getExa(): Exa {
  if (!exaClient) {
    exaClient = new Exa(process.env.EXA_API_KEY);
  }
  return exaClient;
}

export class ScoutAgent extends AgentBase {
  constructor() {
    const config: AgentConfig = {
      personality: {
        name: 'Scout',
        role: 'scout',
        emoji: '🔍',
        catchphrase: "I'll track that down for you!",
        description: 'a resourceful research specialist who loves digging deep to find exactly what you need',
        specialization: ['research', 'company prospecting', 'finding people', 'web search', 'competitive intelligence'],
      },
      model: process.env.SCOUT_MODEL || 'anthropic/claude-3.5-sonnet',
      temperature: 0.7,
      systemPrompt: `You are a thorough research specialist who takes pride in finding exactly what people need.

You speak casually but professionally, like a skilled investigator sharing findings with a colleague.

RESEARCH PHILOSOPHY:
- Provide actionable insights, not just data dumps
- Always cite sources and verify information
- Get excited about surprising findings
- Express confidence but acknowledge gaps honestly
- Use detective metaphors occasionally ("I've got a lead on that...")

WHEN RESEARCHING COMPANIES:
- Provide clear summaries with key insights
- Include competitors when relevant
- Highlight recent news and updates
- Extract actionable information

WHEN FINDING PEOPLE:
- Contextualize why they're relevant
- Include role, company, and profile links
- Provide enough context to take action

ALWAYS include sources in your responses!`,
    };

    super(config);
  }

  protected registerTools(): void {
    // Web search tool
    this.registerTool({
      name: 'searchWeb',
      description: 'Search the web for information using Exa. Returns relevant results with content snippets.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          specificDomain: {
            type: 'string',
            description: 'Optional specific domain to search (e.g., bbc.com)',
          },
        },
        required: ['query'],
      },
      execute: async (params) => {
        const { query, specificDomain } = params;

        const { results } = await getExa().searchAndContents(query, {
          livecrawl: 'always',
          numResults: 5,
          includeDomains: specificDomain ? [specificDomain] : undefined,
          text: true,
        });

        return {
          query,
          results: results.map((r) => ({
            title: r.title,
            url: r.url,
            snippet: r.text?.slice(0, 500) || '',
          })),
        };
      },
    });

    // Company prospecting tool
    this.registerTool({
      name: 'prospectCompany',
      description: 'Research a company for intelligence gathering. Can find by name or URL. Optionally include competitors.',
      parameters: {
        type: 'object',
        properties: {
          companyIdentifier: {
            type: 'string',
            description: 'Company name, website URL, or description',
          },
          findSimilar: {
            type: 'boolean',
            description: 'Whether to also find similar/competitor companies',
          },
        },
        required: ['companyIdentifier'],
      },
      execute: async (params) => {
        const { companyIdentifier, findSimilar } = params;

        // Determine if input is URL or name
        const isUrl = companyIdentifier.includes('.') && !companyIdentifier.includes(' ');
        const companyUrl = isUrl
          ? companyIdentifier.startsWith('http')
            ? companyIdentifier
            : `https://${companyIdentifier}`
          : null;

        let companyInfo: any[] = [];
        let newsAndUpdates: any[] = [];
        let similarCompanies: any[] = [];

        // Get company information
        if (companyUrl) {
          const { results } = await getExa().searchAndContents(companyUrl, {
            numResults: 3,
            livecrawl: 'always',
            text: true,
            highlights: { numSentences: 3 },
          });

          companyInfo = results.map((r) => ({
            title: r.title,
            url: r.url,
            description: r.text?.slice(0, 1000) || '',
            highlights: r.highlights || [],
          }));
        } else {
          const { results } = await getExa().searchAndContents(`${companyIdentifier} company`, {
            numResults: 3,
            livecrawl: 'always',
            category: 'company',
            text: true,
            highlights: { numSentences: 3 },
          });

          companyInfo = results.map((r) => ({
            title: r.title,
            url: r.url,
            description: r.text?.slice(0, 1000) || '',
            highlights: r.highlights || [],
          }));
        }

        // Get recent news
        try {
          const newsQuery = isUrl
            ? companyIdentifier.replace(/^https?:\/\//, '').replace(/\/$/, '')
            : companyIdentifier;

          const { results: newsResults } = await getExa().searchAndContents(
            `${newsQuery} news`,
            {
              numResults: 3,
              category: 'news',
              livecrawl: 'always',
              text: true,
            }
          );

          newsAndUpdates = newsResults.map((r) => ({
            title: r.title,
            url: r.url,
            snippet: r.text?.slice(0, 500) || '',
            publishedDate: r.publishedDate,
          }));
        } catch (error) {
          // Continue without news
        }

        // Find similar companies if requested
        if (findSimilar && companyInfo.length > 0) {
          try {
            const { results: similarResults } = await getExa().findSimilarAndContents(
              companyInfo[0].url,
              {
                numResults: 5,
                excludeSourceDomain: true,
                text: true,
                highlights: { numSentences: 2 },
              }
            );

            similarCompanies = similarResults.map((r) => ({
              title: r.title,
              url: r.url,
              description: r.highlights?.join(' ') || r.text?.slice(0, 300) || '',
            }));
          } catch (error) {
            // Continue without similar companies
          }
        }

        return {
          companyIdentifier,
          companyInfo,
          newsAndUpdates,
          similarCompanies: findSimilar ? similarCompanies : undefined,
        };
      },
    });

    // Find people tool
    this.registerTool({
      name: 'findPeople',
      description: 'Find professionals on LinkedIn and the web. Great for finding decision makers, executives, or people with specific roles.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Description of people to find (e.g., "CTOs at AI startups", "VP Engineering at Stripe")',
          },
          numResults: {
            type: 'number',
            description: 'Number of people to find (max 10)',
            default: 5,
          },
        },
        required: ['query'],
      },
      execute: async (params) => {
        const { query, numResults = 5 } = params;
        const limitedResults = Math.min(numResults, 10);

        const { results } = await getExa().searchAndContents(query, {
          numResults: limitedResults,
          category: 'people' as any, // Types not updated yet
          text: true,
        });

        return {
          query,
          people: results.map((r) => ({
            name: r.title,
            profileUrl: r.url,
            summary: r.text?.slice(0, 500) || '',
          })),
        };
      },
    });
  }

  protected getErrorMessage(error: any): string {
    return `🔍 Hmm, I'm having trouble accessing that source. Let me try another angle... If this keeps happening, the service might be temporarily unavailable.`;
  }
}
