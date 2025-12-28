import type { AgentRole } from '../agents/base/types.js';
import type Anthropic from '@anthropic-ai/sdk';

/**
 * Conversation memory for maintaining context across interactions
 * Currently in-memory, can be upgraded to Redis/Upstash for production
 */

interface ConversationContext {
  threadId: string;
  channelId: string;
  userId: string;
  messages: Anthropic.MessageParam[];
  currentAgent: AgentRole | null;
  agentData: Record<string, any>; // Agent-specific memory
  createdAt: number;
  lastActivityAt: number;
}

export class ConversationMemory {
  private conversations: Map<string, ConversationContext> = new Map();
  private readonly TTL = 2 * 60 * 60 * 1000; // 2 hours
  private readonly MAX_MESSAGES = 50; // Keep last 50 messages
  private readonly MAX_TOKENS_ESTIMATE = 150000; // ~150K tokens max

  constructor() {
    // Cleanup expired conversations every 10 minutes
    setInterval(() => this.cleanup(), 10 * 60 * 1000);
  }

  /**
   * Get or create conversation context
   */
  getOrCreate(threadId: string, channelId: string, userId: string): ConversationContext {
    let context = this.conversations.get(threadId);

    if (!context) {
      context = {
        threadId,
        channelId,
        userId,
        messages: [],
        currentAgent: null,
        agentData: {},
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
      };
      this.conversations.set(threadId, context);
    }

    // Update last activity
    context.lastActivityAt = Date.now();

    return context;
  }

  /**
   * Add message to conversation
   */
  addMessage(
    threadId: string,
    role: 'user' | 'assistant',
    content: string,
    agent?: AgentRole
  ): void {
    const context = this.conversations.get(threadId);
    if (!context) return;

    // Add message
    context.messages.push({ role, content });

    // Update current agent
    if (agent) {
      context.currentAgent = agent;
    }

    // Trim if exceeds max messages
    if (context.messages.length > this.MAX_MESSAGES) {
      // Keep first message (often important context) and trim from middle
      const keep = Math.floor(this.MAX_MESSAGES * 0.8); // Keep 80% of max
      context.messages = [
        context.messages[0],
        ...context.messages.slice(-keep),
      ];
    }

    // Update activity time
    context.lastActivityAt = Date.now();
  }

  /**
   * Get conversation messages
   */
  getMessages(threadId: string): Anthropic.MessageParam[] {
    const context = this.conversations.get(threadId);
    return context?.messages || [];
  }

  /**
   * Get current agent for thread
   */
  getCurrentAgent(threadId: string): AgentRole | null {
    const context = this.conversations.get(threadId);
    return context?.currentAgent || null;
  }

  /**
   * Set agent-specific data
   */
  setAgentData(threadId: string, agent: AgentRole, data: any): void {
    const context = this.conversations.get(threadId);
    if (!context) return;

    context.agentData[agent] = {
      ...context.agentData[agent],
      ...data,
    };
  }

  /**
   * Get agent-specific data
   */
  getAgentData(threadId: string, agent: AgentRole): any {
    const context = this.conversations.get(threadId);
    return context?.agentData[agent] || {};
  }

  /**
   * Clear conversation (for user request)
   */
  clear(threadId: string): void {
    this.conversations.delete(threadId);
  }

  /**
   * Cleanup expired conversations
   */
  private cleanup(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [threadId, context] of this.conversations.entries()) {
      if (now - context.lastActivityAt > this.TTL) {
        expired.push(threadId);
      }
    }

    for (const threadId of expired) {
      this.conversations.delete(threadId);
    }

    if (expired.length > 0) {
      console.log(`Cleaned up ${expired.length} expired conversations`);
    }
  }

  /**
   * Get memory stats
   */
  getStats() {
    return {
      totalConversations: this.conversations.size,
      activeThreads: Array.from(this.conversations.values()).filter(
        (c) => Date.now() - c.lastActivityAt < 5 * 60 * 1000 // Active in last 5 min
      ).length,
      averageMessages:
        Array.from(this.conversations.values()).reduce(
          (sum, c) => sum + c.messages.length,
          0
        ) / Math.max(this.conversations.size, 1),
    };
  }
}

// Singleton instance
export const conversationMemory = new ConversationMemory();
