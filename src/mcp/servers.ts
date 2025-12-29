/**
 * MCP Server Configurations
 * 
 * Exa: Remote HTTP MCP (https://mcp.exa.ai/mcp)
 * Firecrawl: Local stdio MCP (npx firecrawl-mcp)
 */

// Exa MCP - Remote HTTP server (much simpler!)
// Tools: web_search_exa, deep_search_exa, get_code_context_exa, 
//        crawling_exa, company_research_exa, linkedin_search_exa,
//        deep_researcher_start, deep_researcher_check
export const exaMcpServer = {
  url: `https://mcp.exa.ai/mcp?exaApiKey=${process.env.EXA_API_KEY}&tools=web_search_exa,company_research_exa,linkedin_search_exa,crawling_exa,deep_search_exa`,
};

// Firecrawl MCP - Local stdio server
// Tools: firecrawl_scrape, firecrawl_map, firecrawl_crawl, 
//        firecrawl_extract, firecrawl_deep_research
export const firecrawlMcpServer = {
  command: 'npx',
  args: ['firecrawl-mcp'],
  env: {
    FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY || '',
  },
};

// Tool mappings per agent
export const agentTools = {
  scout: [
    // Exa tools for research
    'mcp__exa__web_search_exa',
    'mcp__exa__company_research_exa',
    'mcp__exa__linkedin_search_exa',
    'mcp__exa__crawling_exa',
  ],
  sage: [
    // Exa deep research
    'mcp__exa__web_search_exa',
    'mcp__exa__deep_search_exa',
    // Firecrawl for deep research
    'mcp__firecrawl__firecrawl_deep_research',
  ],
  chronicle: [
    // Exa for news/research
    'mcp__exa__web_search_exa',
    'mcp__exa__crawling_exa',
    // Firecrawl for scraping articles
    'mcp__firecrawl__firecrawl_scrape',
    'mcp__firecrawl__firecrawl_extract',
  ],
  maven: [
    // General web search only
    'mcp__exa__web_search_exa',
  ],
};

// All MCP servers
export const allMcpServers = {
  exa: exaMcpServer,
  firecrawl: firecrawlMcpServer,
};

// Get MCP config for a specific agent
export function getMcpConfigForAgent(agent: keyof typeof agentTools) {
  return {
    mcpServers: allMcpServers,
    allowedTools: agentTools[agent],
  };
}
