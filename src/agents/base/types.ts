import type Anthropic from '@anthropic-ai/sdk';

export type AgentRole = 'scout' | 'sage' | 'chronicle' | 'maven' | 'orchestrator';

export interface AgentPersonality {
  name: string;
  role: AgentRole;
  emoji: string;
  catchphrase: string;
  description: string;
  specialization: string[];
}

export interface AgentConfig {
  personality: AgentPersonality;
  model: string;
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AgentContext {
  userId: string;
  threadId: string;
  channelId: string;
  messages: Anthropic.MessageParam[];
  previousAgent?: AgentRole;
  metadata?: Record<string, any>;
}

export interface AgentResponse {
  text: string;
  agent: AgentRole;
  toolsUsed: string[];
  shouldHandoff?: {
    to: AgentRole;
    reason: string;
    context?: Record<string, any>;
  };
  metadata?: Record<string, any>;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (params: any, context: AgentContext) => Promise<any>;
}

export interface AgentMemory {
  threadId: string;
  messages: Anthropic.MessageParam[];
  currentAgent: AgentRole;
  agentContext: Record<string, any>;
  createdAt: number;
  expiresAt: number;
}
