#!/usr/bin/env tsx
/**
 * Test the SDK-based Orchestrator
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as readline from 'readline';
import { handleRequest, getAgents, type StageCallback } from './src/agents/sdk/SdkOrchestrator.js';
import type { AgentContext } from './src/agents/base/types.js';

// Stage callback for visual feedback
const onStage: StageCallback = (stage, data) => {
  switch (stage) {
    case 'routing':
      process.stdout.write('🎯 Routing... ');
      break;
    case 'thinking':
      console.log(`${data?.emoji || '🤔'} ${data?.agent || 'Agent'} is thinking...`);
      break;
    case 'tool_call':
      console.log(`🔧 Using tool: ${data?.tool}`);
      break;
    case 'responding':
      console.log('💬 Responding...\n');
      break;
  }
};

// Conversation history
const messages: { role: 'user' | 'assistant'; content: string }[] = [];

async function chat(userMessage: string): Promise<string> {
  // Add user message to history
  messages.push({ role: 'user', content: userMessage });

  // Create context
  const context: AgentContext = {
    userId: 'test-user',
    threadId: 'test-thread',
    channelId: 'test-channel',
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  };

  try {
    const response = await handleRequest(context, { onStage });

    // Add assistant response to history
    messages.push({ role: 'assistant', content: response.text });

    return response.text;
  } catch (error: any) {
    console.error('Error:', error.message);
    return `❌ Error: ${error.message}`;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     🤖 SDK Orchestrator Test                               ║');
  console.log('║                                                            ║');
  console.log('║  Using: Claude Agent SDK + OpenRouter + Exa MCP            ║');
  console.log('║                                                            ║');
  console.log('║  Agents:                                                   ║');
  
  const agents = getAgents();
  for (const agent of agents) {
    console.log(`║    ${agent.emoji} ${agent.name.padEnd(10)} - ${agent.role.padEnd(10)}              ║`);
  }
  
  console.log('║                                                            ║');
  console.log('║  Type "quit" to exit                                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const isPiped = !process.stdin.isTTY;

  const prompt = () => {
    rl.question('You: ', async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        if (!isPiped) prompt();
        return;
      }

      if (trimmed.toLowerCase() === 'quit' || trimmed.toLowerCase() === 'exit') {
        console.log('\n👋 Goodbye!\n');
        rl.close();
        process.exit(0);
      }

      console.log('');
      const response = await chat(trimmed);
      console.log(`\n${response}\n`);

      if (!isPiped) {
        prompt();
      }
    });
  };

  rl.on('close', () => {
    if (isPiped) {
      console.log('\n👋 Goodbye!\n');
      process.exit(0);
    }
  });

  prompt();
}

main();
