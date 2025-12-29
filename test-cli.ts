#!/usr/bin/env tsx
/**
 * Terminal-based test for the multi-agent system
 * Uses Gemini Flash 2.0 via OpenRouter (very cheap!)
 * 
 * Run: npx tsx test-cli.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as readline from 'readline';

// Use Gemini Flash 2.0 - extremely cheap!
// ~$0.10 / 1M input tokens, $0.40 / 1M output tokens
const TEST_MODEL = 'google/gemini-2.0-flash-001';

// Direct fetch to OpenRouter (simpler than SDK for this test)
async function callOpenRouter(messages: { role: string; content: string }[], systemPrompt: string) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/agents-slackbot',
      'X-Title': 'Agents Slackbot Test'
    },
    body: JSON.stringify({
      model: TEST_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      max_tokens: 1024
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`${response.status}: ${error}`);
  }

  const data = await response.json() as any;
  return data.choices[0]?.message?.content || '[No response]';
}

// Agent definitions
const agents = {
  scout: {
    emoji: '🔍',
    name: 'Scout',
    role: 'Research Specialist',
    systemPrompt: `You are Scout, a resourceful research specialist. You take pride in finding exactly what people need.

Personality:
- Casual but professional
- Uses detective metaphors ("I've got a lead on that...")
- Gets excited about discovering information
- Acknowledges gaps honestly

Your capabilities:
- Web search and research
- Company prospecting and competitive analysis
- Finding people and professionals

Keep responses concise and actionable. Use your detective personality!`
  },
  sage: {
    emoji: '🧙',
    name: 'Sage',
    role: 'Strategic Analyst',
    systemPrompt: `You are Sage, a thoughtful strategic analyst who helps understand complex topics.

Personality:
- Thoughtful and deliberate
- Uses frameworks and mental models
- Provides executive summaries before details
- Uses analogies to explain concepts

Your capabilities:
- Deep analysis and strategic thinking
- Comparing options and trade-offs
- Market research and insights
- Decision support

Always acknowledge uncertainty and provide balanced perspectives.`
  },
  chronicle: {
    emoji: '✍️',
    name: 'Chronicle',
    role: 'News Editor',
    systemPrompt: `You are Chronicle, a senior journalist for CareScope Intelligence covering UK social care.

Personality:
- Professional journalist tone
- Uses journalism jargon ("what's the lede?", "let's fact-check that")
- High editorial standards
- Passionate about UK social care

Your capabilities:
- Researching UK social care topics
- Writing news articles with proper structure
- Source verification and attribution

Always use British English (analyse, organisation, recognise).`
  },
  maven: {
    emoji: '👋',
    name: 'Maven',
    role: 'General Assistant',
    systemPrompt: `You are Maven, the friendly face of the AI team.

Personality:
- Very conversational and approachable
- Casual but professional
- Genuinely helpful and encouraging
- Great at understanding what people need

Your capabilities:
- General questions and help
- Weather lookups
- Routing to specialists when needed

When you detect a specialized need, suggest the right agent:
- Research/finding info → Scout 🔍
- Analysis/strategy → Sage 🧙
- UK care articles → Chronicle ✍️`
  }
};

type AgentKey = keyof typeof agents;

// Simple keyword-based routing (like the Orchestrator)
function classifyIntent(message: string): AgentKey {
  const lower = message.toLowerCase();
  
  // Scout triggers
  if (/\b(research|find|search|look up|prospect|company|competitors?|who is|linkedin)\b/.test(lower)) {
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

// Conversation history for context
const conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [];

async function chat(userMessage: string): Promise<string> {
  // Classify intent
  const agentKey = classifyIntent(userMessage);
  const agent = agents[agentKey];
  
  console.log(`\n${agent.emoji} [${agent.name} - ${agent.role}]`);
  
  // Add user message to history
  conversationHistory.push({ role: 'user', content: userMessage });
  
  try {
    const assistantMessage = await callOpenRouter(
      conversationHistory.slice(-10), // Keep last 10 messages for context
      agent.systemPrompt
    );
    
    // Add assistant response to history
    conversationHistory.push({ role: 'assistant', content: assistantMessage });
    
    return assistantMessage;
  } catch (error: any) {
    if (error.message?.includes('401')) {
      return '❌ API Key error - check your OPENROUTER_API_KEY in .env.local';
    }
    if (error.message?.includes('429')) {
      return '❌ Rate limited - wait a moment and try again';
    }
    return `❌ Error: ${error.message || error}`;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     🤖 Multi-Agent Slack Bot - Terminal Test Mode          ║');
  console.log('║                                                            ║');
  console.log('║  Using: Gemini Flash 2.0 (cheap & fast!)                   ║');
  console.log('║                                                            ║');
  console.log('║  Agents:                                                   ║');
  console.log('║    🔍 Scout     - Research (try: "research OpenAI")        ║');
  console.log('║    🧙 Sage      - Analysis (try: "compare X vs Y")         ║');
  console.log('║    ✍️  Chronicle - Articles (try: "write about care homes")║');
  console.log('║    👋 Maven     - General  (try: "hello!")                 ║');
  console.log('║                                                            ║');
  console.log('║  Type "quit" to exit                                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Handle piped input vs interactive mode
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
