/**
 * Test Claude Agent SDK with OpenRouter + Official MCP servers
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { query } from '@anthropic-ai/claude-agent-sdk';

// Exa Remote MCP - HTTP streamable transport
const exaMcpServer = {
  type: 'http' as const,
  url: `https://mcp.exa.ai/mcp?exaApiKey=${process.env.EXA_API_KEY}`,
};

// Helper to extract text from assistant message
function extractText(message: any): string {
  if (message.message?.content) {
    return message.message.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('\n');
  }
  if (typeof message.content === 'string') {
    return message.content;
  }
  if (Array.isArray(message.content)) {
    return message.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('\n');
  }
  return '';
}

async function testExaSearch() {
  console.log('\n🔍 Test 1: Exa Web Search (Remote MCP)\n');
  console.log('Prompt: "Search for latest AI agent frameworks"\n');

  const response = query({
    prompt: "Search for the latest AI agent frameworks in 2024. Give me a 2 sentence summary.",
    options: {
      model: 'sonnet', // Use sonnet for better tool use
      mcpServers: { exa: exaMcpServer },
      tools: [], // Disable built-in tools, only use MCP
      maxTurns: 3,
      permissionMode: 'bypassPermissions',
    },
  });

  for await (const message of response) {
    if (message.type === 'system' && message.subtype === 'init') {
      console.log(`[Session started]`);
      console.log(`[Tools: ${message.tools.join(', ')}]`);
      console.log(`[MCP servers: ${JSON.stringify(message.mcp_servers)}]`);
    } else if (message.type === 'assistant') {
      // Check for tool use in the message
      const content = message.message?.content || [];
      for (const block of content) {
        if (block.type === 'tool_use') {
          console.log(`🔧 Tool: ${block.name}`);
          console.log(`   Input: ${JSON.stringify(block.input).slice(0, 100)}...`);
        } else if (block.type === 'text' && block.text) {
          console.log('💬', block.text.slice(0, 500) + (block.text.length > 500 ? '...' : ''));
        }
      }
    } else if (message.type === 'result') {
      console.log(`\n✅ Result: ${message.subtype}`);
      if (message.subtype === 'success') {
        console.log(`   Cost: $${message.total_cost_usd.toFixed(4)}`);
      }
    }
  }
}

async function testCompanyResearch() {
  console.log('\n🏢 Test 2: Exa Company Research\n');
  console.log('Prompt: "Research Anthropic"\n');

  const response = query({
    prompt: "Research Anthropic. What do they do? Keep it to 2 sentences.",
    options: {
      model: 'sonnet',
      mcpServers: { exa: exaMcpServer },
      tools: [],
      maxTurns: 3,
      permissionMode: 'bypassPermissions',
    },
  });

  for await (const message of response) {
    if (message.type === 'system' && message.subtype === 'init') {
      console.log(`[Tools: ${message.tools.join(', ')}]`);
    } else if (message.type === 'assistant') {
      const content = message.message?.content || [];
      for (const block of content) {
        if (block.type === 'tool_use') {
          console.log(`🔧 Tool: ${block.name}`);
        } else if (block.type === 'text' && block.text) {
          console.log('💬', block.text.slice(0, 500) + (block.text.length > 500 ? '...' : ''));
        }
      }
    } else if (message.type === 'result') {
      console.log(`\n✅ Result: ${message.subtype}`);
      if (message.subtype === 'success') {
        console.log(`   Cost: $${message.total_cost_usd.toFixed(4)}`);
      }
    }
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Exa Remote MCP Server Test                               ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Config:');
  console.log(`  ANTHROPIC_BASE_URL: ${process.env.ANTHROPIC_BASE_URL}`);
  console.log(`  ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? '✓' : '✗'}`);
  console.log(`  EXA_API_KEY: ${process.env.EXA_API_KEY ? '✓' : '✗'}`);

  try {
    await testExaSearch();
    await testCompanyResearch();
    console.log('\n\n✅ All tests completed!');
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

main();
