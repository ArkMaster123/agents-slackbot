#!/usr/bin/env tsx
/**
 * Test the SDK Orchestrator routing
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { handleRequest, getAgents } from './src/agents/sdk/SdkOrchestrator.js';

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     🎯 SDK Orchestrator Routing Test                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(
    'Agents available:',
    getAgents()
      .map((a) => `${a.emoji} ${a.name}`)
      .join(', ')
  );
  console.log('\nTesting routing...\n');

  const tests = [
    { msg: 'Hello!', expected: 'maven' },
    { msg: 'What is the weather?', expected: 'maven' },
    { msg: 'Research AI companies', expected: 'scout' },
    { msg: 'Find information about Stripe', expected: 'scout' },
    { msg: 'Compare AWS vs GCP', expected: 'sage' },
    { msg: 'Analyze the market for home care', expected: 'sage' },
    { msg: 'Write an article about care homes', expected: 'chronicle' },
    { msg: 'CQC inspection trends', expected: 'chronicle' },
  ];

  for (const t of tests) {
    const result = await handleRequest(
      {
        userId: 'test',
        threadId: 'test',
        channelId: 'test',
        messages: [{ role: 'user', content: t.msg }],
      },
      {
        onStage: () => {}, // Suppress stage output
      }
    );
    const routed = result.agent;
    const icon = routed === t.expected ? '✅' : '❌';
    console.log(`${icon} "${t.msg}"`);
    console.log(`   → Routed to: ${routed} (expected: ${t.expected})\n`);
  }

  console.log('Done!');
}

main().catch(console.error);
