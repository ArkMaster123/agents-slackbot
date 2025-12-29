import type { AgentRole, AgentContext, AgentResponse } from '../base/types.js';
import { MavenAgent } from '../maven/MavenAgent.js';
import { ScoutAgent } from '../scout/ScoutAgent.js';
import { SageAgent } from '../sage/SageAgent.js';
import { ChronicleAgent } from '../chronicle/ChronicleAgent.js';

/**
 * Call OpenRouter for intent classification
 */
async function classifyWithLLM(userMessage: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/agents-slackbot',
      'X-Title': 'Agents Slackbot'
    },
    body: JSON.stringify({
      model: process.env.ORCHESTRATOR_MODEL || 'google/gemini-2.0-flash-001',
      messages: [
        {
          role: 'user',
          content: `Classify this user request into ONE of these agent types:

- scout: Research, finding information, company prospecting, finding people, web search
- sage: Analysis, comparison, strategic insights, market research, decision support
- chronicle: News articles, writing content, CareScope articles, UK social care journalism
- maven: General help, weather, settings, unclear requests, casual conversation

User request: "${userMessage}"

Respond with ONLY the agent type (scout, sage, chronicle, or maven). No explanation.`
        }
      ],
      max_tokens: 50,
      temperature: 0.3,
    })
  });

  if (!response.ok) {
    console.error('Classification API error, defaulting to maven');
    return 'maven';
  }

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content?.trim().toLowerCase() || 'maven';
}

export class Orchestrator {
  private agents: Map<string, any>;

  constructor() {
    // Initialize all agents
    // Note: This is the legacy orchestrator. Use SdkOrchestrator for full agent support.
    this.agents = new Map<string, any>([
      ['maven', new MavenAgent()],
      ['scout', new ScoutAgent()],
      ['sage', new SageAgent()],
      ['chronicle', new ChronicleAgent()],
    ]);
  }

  /**
   * Main entry point - handles a request and routes to appropriate agent
   */
  async handle(context: AgentContext): Promise<AgentResponse> {
    // Classify intent and route to agent
    const targetAgent = await this.classifyIntent(context);

    // Get the agent
    const agent = this.agents.get(targetAgent);

    if (!agent) {
      // Fallback to Maven if agent not found
      return this.agents.get('maven')!.handleRequest(context);
    }

    // Handle the request with the selected agent
    const response = await agent.handleRequest(context);

    // Check if agent wants to handoff to another specialist
    if (response.shouldHandoff) {
      const handoffAgent = this.agents.get(response.shouldHandoff.to);
      if (handoffAgent) {
        // Create new context with handoff information
        const handoffContext: AgentContext = {
          ...context,
          previousAgent: targetAgent,
          metadata: {
            ...context.metadata,
            handoffReason: response.shouldHandoff.reason,
            handoffContext: response.shouldHandoff.context,
          },
        };

        return handoffAgent.handleRequest(handoffContext);
      }
    }

    return response;
  }

  /**
   * Classify user intent and determine which agent should handle it
   */
  private async classifyIntent(context: AgentContext): Promise<AgentRole> {
    // Get the last user message
    const lastMessage = context.messages
      .filter((m) => m.role === 'user')
      .pop();

    if (!lastMessage || typeof lastMessage.content !== 'string') {
      return 'maven'; // Default to Maven for unclear requests
    }

    const userMessage = lastMessage.content.toLowerCase();

    // Simple keyword-based routing for common cases (fast path)
    if (this.matchesKeywords(userMessage, ['research', 'find', 'search', 'who', 'company', 'prospect'])) {
      return 'scout';
    }

    if (this.matchesKeywords(userMessage, ['analyze', 'compare', 'strategy', 'insight', 'recommend', 'should i'])) {
      return 'sage';
    }

    if (this.matchesKeywords(userMessage, ['article', 'write', 'news', 'carescope', 'publish', 'cqc'])) {
      return 'chronicle';
    }

    if (this.matchesKeywords(userMessage, ['weather', 'help', 'settings', 'hello', 'hi', 'thanks'])) {
      return 'maven';
    }

    // If no clear keyword match, use LLM for classification
    return await this.classifyWithLLM(userMessage);
  }

  /**
   * Use LLM for intent classification when keywords don't match
   */
  private async classifyWithLLM(userMessage: string): Promise<AgentRole> {
    try {
      const classification = await classifyWithLLM(userMessage);

      // Validate response is one of our agent types
      if (['scout', 'sage', 'chronicle', 'maven'].includes(classification)) {
        return classification as AgentRole;
      }

      return 'maven'; // Default fallback
    } catch (error) {
      console.error('Error classifying intent:', error);
      return 'maven'; // Safe fallback
    }
  }

  /**
   * Simple keyword matching helper
   */
  private matchesKeywords(text: string, keywords: string[]): boolean {
    return keywords.some((keyword) => text.includes(keyword));
  }

  /**
   * Get all available agents with their info
   */
  getAgents() {
    return Array.from(this.agents.entries()).map(([role, agent]) => ({
      role,
      personality: agent.personality,
    }));
  }

  /**
   * Get a specific agent by role
   */
  getAgent(role: AgentRole) {
    return this.agents.get(role);
  }
}
