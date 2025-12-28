import Anthropic from '@anthropic-ai/sdk';
import type { AgentRole, AgentContext, AgentResponse } from '../base/types.js';
import { MavenAgent } from '../maven/MavenAgent.js';
import { ScoutAgent } from '../scout/ScoutAgent.js';
import { SageAgent } from '../sage/SageAgent.js';
import { ChronicleAgent } from '../chronicle/ChronicleAgent.js';

export class Orchestrator {
  private agents: Map<AgentRole, any>;
  private client: Anthropic;

  constructor() {
    // Initialize all agents
    this.agents = new Map([
      ['maven', new MavenAgent()],
      ['scout', new ScoutAgent()],
      ['sage', new SageAgent()],
      ['chronicle', new ChronicleAgent()],
    ]);

    // Fast model for intent classification
    this.client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY!,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });
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
   * Uses fast Haiku model for quick routing
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

    // If no clear keyword match, use Claude for classification
    return await this.classifyWithClaude(userMessage);
  }

  /**
   * Use Claude Haiku for intent classification when keywords don't match
   */
  private async classifyWithClaude(userMessage: string): Promise<AgentRole> {
    try {
      const response = await this.client.messages.create({
        model: process.env.ORCHESTRATOR_MODEL || 'anthropic/claude-3-haiku',
        max_tokens: 100,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: `Classify this user request into ONE of these agent types:

- scout: Research, finding information, company prospecting, finding people, web search
- sage: Analysis, comparison, strategic insights, market research, decision support
- chronicle: News articles, writing content, CareScope articles, UK social care journalism
- maven: General help, weather, settings, unclear requests, casual conversation

User request: "${userMessage}"

Respond with ONLY the agent type (scout, sage, chronicle, or maven). No explanation.`,
          },
        ],
      });

      const classification = response.content[0].type === 'text'
        ? response.content[0].text.trim().toLowerCase()
        : 'maven';

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
