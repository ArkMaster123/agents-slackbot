/**
 * Exa MCP Server for search tools
 * Uses Claude Agent SDK's createSdkMcpServer for native integration
 * 
 * Tools: searchWeb, prospectCompany, findPeople, researchMarket, researchUKSocialCare
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { Exa } from 'exa-js';
import { z } from 'zod';

// Lazy initialization of Exa client
let exaClient: Exa | null = null;
function getExa(): Exa {
  if (!exaClient) {
    exaClient = new Exa(process.env.EXA_API_KEY);
  }
  return exaClient;
}

export const exaServer = createSdkMcpServer({
  name: 'exa-search',
  version: '1.0.0',
  tools: [
    // ===================
    // SCOUT TOOLS
    // ===================
    
    tool(
      'searchWeb',
      'Search the web for current information. Returns relevant results with content snippets. Great for news, research, and fact-finding.',
      {
        query: z.string().describe('Search query'),
        domain: z.string().optional().describe('Limit to specific domain (e.g., "bbc.com")'),
      },
      async ({ query, domain }) => {
        try {
          const { results } = await getExa().searchAndContents(query, {
            livecrawl: 'always',
            numResults: 5,
            includeDomains: domain ? [domain] : undefined,
            text: true,
          });

          if (results.length === 0) {
            return { content: [{ type: 'text', text: `No results found for: "${query}"` }] };
          }

          const formatted = results.map((r: any, i: number) => 
            `### ${i + 1}. ${r.title || 'Untitled'}\n${r.url}\n\n${r.text?.slice(0, 400) || 'No content available'}...`
          ).join('\n\n---\n\n');

          return {
            content: [{
              type: 'text',
              text: `## Search Results for "${query}"\n\n${formatted}`
            }]
          };
        } catch (error: any) {
          return { content: [{ type: 'text', text: `Search error: ${error.message}` }] };
        }
      }
    ),

    tool(
      'prospectCompany',
      'Research a company for sales prospecting, competitive analysis, or due diligence. Gets company info, recent news, and optionally competitors.',
      {
        company: z.string().describe('Company name or website URL'),
        includeCompetitors: z.boolean().optional().describe('Also find similar/competitor companies'),
      },
      async ({ company, includeCompetitors }) => {
        try {
          const exa = getExa();
          const isUrl = company.includes('.') && !company.includes(' ');
          const searchQuery = isUrl ? company : `${company} company`;
          
          let output = `## Company Research: ${company}\n\n`;

          // Get company information
          const { results: companyResults } = await exa.searchAndContents(searchQuery, {
            numResults: 3,
            livecrawl: 'always',
            category: isUrl ? undefined : 'company',
            text: true,
            highlights: { numSentences: 3 },
          });

          if (companyResults.length > 0) {
            output += `### Overview\n`;
            companyResults.forEach((r: any) => {
              output += `**${r.title}**\n${r.highlights?.join(' ') || r.text?.slice(0, 400) || ''}\n\nSource: ${r.url}\n\n`;
            });
          }

          // Get recent news
          try {
            const newsQuery = isUrl ? company.replace(/^https?:\/\//, '').replace(/\/$/, '') : company;
            const { results: newsResults } = await exa.searchAndContents(
              `${newsQuery} news`,
              { numResults: 3, category: 'news', livecrawl: 'always', text: true }
            );

            if (newsResults.length > 0) {
              output += `### Recent News\n`;
              newsResults.forEach((r: any) => {
                output += `- **${r.title}**\n  ${r.text?.slice(0, 200) || ''}\n  ${r.url}\n\n`;
              });
            }
          } catch (e) { /* Continue */ }

          // Find competitors
          if (includeCompetitors && companyResults.length > 0) {
            try {
              const { results: similarResults } = await exa.findSimilarAndContents(
                companyResults[0].url,
                { numResults: 5, excludeSourceDomain: true, text: true }
              );

              if (similarResults.length > 0) {
                output += `### Competitors / Similar Companies\n`;
                similarResults.forEach((r: any) => {
                  output += `- **${r.title}**: ${r.text?.slice(0, 150) || ''}\n  ${r.url}\n`;
                });
              }
            } catch (e) { /* Continue */ }
          }

          return { content: [{ type: 'text', text: output }] };
        } catch (error: any) {
          return { content: [{ type: 'text', text: `Company research error: ${error.message}` }] };
        }
      }
    ),

    tool(
      'findPeople',
      'Find professionals on LinkedIn and the web. Great for finding decision makers, executives, or people with specific roles.',
      {
        query: z.string().describe('Who to find (e.g., "CTOs at AI startups", "VP Engineering at Stripe")'),
        count: z.number().min(1).max(10).optional().describe('Number of people to find (default: 5)'),
      },
      async ({ query, count = 5 }) => {
        try {
          const { results } = await getExa().searchAndContents(query, {
            numResults: Math.min(count, 10),
            category: 'people' as any,
            text: true,
          });

          if (results.length === 0) {
            return { content: [{ type: 'text', text: `No people found for: "${query}"` }] };
          }

          let output = `## People Found: "${query}"\n\n`;
          results.forEach((r: any, i: number) => {
            output += `### ${i + 1}. ${r.title || 'Unknown'}\n`;
            output += `**Profile:** ${r.url}\n\n`;
            output += `${r.text?.slice(0, 300) || 'No summary available'}\n\n`;
          });

          return { content: [{ type: 'text', text: output }] };
        } catch (error: any) {
          return { content: [{ type: 'text', text: `People search error: ${error.message}` }] };
        }
      }
    ),

    // ===================
    // SAGE TOOLS
    // ===================

    tool(
      'researchMarket',
      'Comprehensive market and industry research for strategic analysis. Gets market overview, trends, and key players.',
      {
        topic: z.string().describe('Market or industry to research (e.g., "UK social care", "AI agents")'),
        includeKeyPlayers: z.boolean().optional().describe('Include key companies and players'),
      },
      async ({ topic, includeKeyPlayers }) => {
        try {
          const exa = getExa();
          let output = `## Market Research: ${topic}\n\n`;

          // Market overview
          const { results: overviewResults } = await exa.searchAndContents(
            `${topic} market overview industry analysis 2024 2025`,
            { numResults: 4, livecrawl: 'always', text: true }
          );

          output += `### Market Overview\n`;
          overviewResults.forEach((r: any) => {
            output += `**${r.title}**\n${r.text?.slice(0, 400) || ''}\n\nSource: ${r.url}\n\n`;
          });

          // Trends
          const { results: trendResults } = await exa.searchAndContents(
            `${topic} trends forecast growth`,
            { numResults: 3, livecrawl: 'always', text: true }
          );

          output += `### Trends & Forecasts\n`;
          trendResults.forEach((r: any) => {
            output += `- **${r.title}**\n  ${r.text?.slice(0, 300) || ''}\n  Source: ${r.url}\n\n`;
          });

          // Key players
          if (includeKeyPlayers) {
            const { results: playerResults } = await exa.searchAndContents(
              `${topic} leading companies market leaders`,
              { numResults: 4, livecrawl: 'always', text: true }
            );

            output += `### Key Players\n`;
            playerResults.forEach((r: any) => {
              output += `- **${r.title}**\n  ${r.text?.slice(0, 250) || ''}\n  Source: ${r.url}\n\n`;
            });
          }

          return { content: [{ type: 'text', text: output }] };
        } catch (error: any) {
          return { content: [{ type: 'text', text: `Market research error: ${error.message}` }] };
        }
      }
    ),

    tool(
      'searchForContext',
      'Gather background information to inform strategic analysis. Use before providing insights or recommendations.',
      {
        query: z.string().describe('What to research for context'),
      },
      async ({ query }) => {
        try {
          const { results } = await getExa().searchAndContents(query, {
            numResults: 5,
            livecrawl: 'always',
            text: true,
          });

          let output = `## Background Research: "${query}"\n\n`;
          results.forEach((r: any) => {
            output += `### ${r.title || 'Source'}\n`;
            output += `${r.text?.slice(0, 600) || ''}\n\n`;
            output += `Source: ${r.url}${r.publishedDate ? ` | Published: ${r.publishedDate}` : ''}\n\n---\n\n`;
          });

          return { content: [{ type: 'text', text: output }] };
        } catch (error: any) {
          return { content: [{ type: 'text', text: `Context research error: ${error.message}` }] };
        }
      }
    ),

    // ===================
    // CHRONICLE TOOLS
    // ===================

    tool(
      'researchUKSocialCare',
      'Research UK social care topics from authoritative sources (gov.uk, CQC, NHS, King\'s Fund, Skills for Care). Use for CareScope articles.',
      {
        topic: z.string().describe('UK social care topic to research'),
      },
      async ({ topic }) => {
        try {
          const exa = getExa();
          let output = `## UK Social Care Research: ${topic}\n\n`;

          // Government sources
          const { results: govResults } = await exa.searchAndContents(
            `${topic} site:gov.uk OR site:cqc.org.uk OR site:nhs.uk`,
            { numResults: 4, livecrawl: 'always', text: true }
          );

          output += `### Government & Regulatory Sources\n`;
          if (govResults.length > 0) {
            govResults.forEach((r: any) => {
              output += `**${r.title}**\n${r.text?.slice(0, 350) || ''}\n\nSource: ${r.url}\n\n`;
            });
          } else {
            output += `No government sources found.\n\n`;
          }

          // Think tanks
          const { results: thinkTankResults } = await exa.searchAndContents(
            `${topic} site:kingsfund.org.uk OR site:nuffieldtrust.org.uk OR site:health.org.uk`,
            { numResults: 4, livecrawl: 'always', text: true }
          );

          output += `### Think Tank & Industry Sources\n`;
          if (thinkTankResults.length > 0) {
            thinkTankResults.forEach((r: any) => {
              output += `**${r.title}**\n${r.text?.slice(0, 350) || ''}\n\nSource: ${r.url}\n\n`;
            });
          } else {
            output += `No think tank sources found.\n\n`;
          }

          // News
          const { results: newsResults } = await exa.searchAndContents(
            `${topic} UK social care`,
            { numResults: 4, category: 'news', livecrawl: 'always', text: true }
          );

          output += `### Recent News\n`;
          if (newsResults.length > 0) {
            newsResults.forEach((r: any) => {
              output += `**${r.title}**\n${r.text?.slice(0, 300) || ''}\n\nSource: ${r.url}${r.publishedDate ? ` | ${r.publishedDate}` : ''}\n\n`;
            });
          } else {
            output += `No recent news found.\n\n`;
          }

          return { content: [{ type: 'text', text: output }] };
        } catch (error: any) {
          return { content: [{ type: 'text', text: `UK social care research error: ${error.message}` }] };
        }
      }
    ),
  ],
});

// Export tool names for reference
export const exaToolNames = [
  'mcp__exa-search__searchWeb',
  'mcp__exa-search__prospectCompany', 
  'mcp__exa-search__findPeople',
  'mcp__exa-search__researchMarket',
  'mcp__exa-search__searchForContext',
  'mcp__exa-search__researchUKSocialCare',
];

// Tool sets per agent
export const scoutTools = [
  'mcp__exa-search__searchWeb',
  'mcp__exa-search__prospectCompany',
  'mcp__exa-search__findPeople',
];

export const sageTools = [
  'mcp__exa-search__researchMarket',
  'mcp__exa-search__searchForContext',
];

export const chronicleTools = [
  'mcp__exa-search__researchUKSocialCare',
  'mcp__exa-search__searchWeb',
];
