#!/usr/bin/env tsx
/**
 * Test the Trends Agent
 * 
 * Uses BrightData MCP to find real UK care news with sources
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { handleRequest, getAgents } from './src/agents/sdk/SdkOrchestrator.js';

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     📈 Trends Agent Test (BrightData MCP)                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('Today:', new Date().toLocaleDateString('en-GB', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }));
  
  console.log('\nAgents available:', getAgents().map(a => `${a.emoji} ${a.name}`).join(', '));

  // Test routing first
  console.log('\n=== Testing Routing ===\n');
  
  const routingTests = [
    { msg: 'What are the top 10 things that happened this week in UK care?', expected: 'trends' },
    { msg: 'Give me trending keywords in social care', expected: 'trends' },
    { msg: "What's happening in care homes today?", expected: 'trends' },
    { msg: 'Latest breaking news in UK care sector', expected: 'trends' },
  ];

  for (const t of routingTests) {
    const result = await handleRequest({
      userId: 'test',
      threadId: 'test',
      channelId: 'test',
      messages: [{ role: 'user', content: t.msg }],
    }, { onStage: () => {} });
    
    const icon = result.agent === t.expected ? '✅' : '❌';
    console.log(`${icon} "${t.msg.slice(0, 50)}..."`);
    console.log(`   → Routed to: ${result.agent} (expected: ${t.expected})\n`);
  }

  // Now test actual Trends query
  console.log('=== Testing Live Trends Query ===\n');
  console.log('Query: "Top 10 things in UK social care this week with sources and keywords"\n');

  const result = await handleRequest({
    userId: 'test',
    threadId: 'test', 
    channelId: 'test',
    messages: [{ 
      role: 'user', 
      content: `Give me the top 10 things happening in UK social care this week.

Use search_engine_batch to search multiple queries at once:
- UK care home news December 2025
- CQC news December 2025
- social care funding UK
- care home closure UK

For each story give me the SOURCE URL, summary, and keywords.
Then list the TOP TRENDING KEYWORDS from all stories.`
    }],
  }, {
    onStage: (stage, data) => {
      switch (stage) {
        case 'routing':
          process.stdout.write('🎯 Routing... ');
          break;
        case 'thinking':
          console.log(`${data?.emoji || '📈'} ${data?.agent || 'Trends'} is thinking...`);
          break;
        case 'tool_call':
          console.log(`🔧 Using tool: ${data?.tool}`);
          break;
        case 'responding':
          console.log('💬 Preparing response...\n');
          break;
      }
    },
  });

  console.log('=== Response ===\n');
  console.log(result.text);
  console.log('\n=== Tools Used ===');
  console.log(result.toolsUsed.join(', ') || 'None');
}

main().catch(console.error);
