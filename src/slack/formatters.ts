import type { AgentRole } from '../agents/base/types';

/**
 * Format agent working status message
 */
export function formatAgentStatus(
  agentRole: AgentRole,
  agentEmoji: string,
  agentName: string,
  status: string
): string {
  return `${agentEmoji} ${agentName} ${status}`;
}

/**
 * Format agent collaboration message
 */
export function formatAgentHandoff(
  fromAgent: string,
  fromEmoji: string,
  toAgent: string,
  toEmoji: string,
  reason: string
): string {
  return `${fromEmoji} ${fromAgent} → ${toEmoji} ${toAgent}\n_${reason}_`;
}

/**
 * Convert markdown links to Slack format
 */
export function markdownToSlack(text: string): string {
  return text
    .replace(/\[(.*?)\]\((.*?)\)/g, '<$2|$1>') // [text](url) → <url|text>
    .replace(/\*\*/g, '*') // ** → *
    .trim();
}

/**
 * Format error message
 */
export function formatError(message: string): string {
  return `⚠️ ${message}`;
}

/**
 * Create a "thinking" message
 */
export function createThinkingMessage(agentName: string, agentEmoji: string): string {
  return `${agentEmoji} ${agentName} is thinking...`;
}

/**
 * Format agent introduction for /team command
 */
export function formatTeamIntroduction(): string {
  return `👋 *Welcome to the AI Team!*

Meet your assistants:

🔍 *Scout* - Research Specialist
   _"I'll track that down for you!"_
   Try: "Research Stripe" or "Find CTOs at AI startups"

🧙 *Sage* - Strategic Analyst
   _"Let me break this down for you..."_
   Try: "Compare AWS vs GCP" or "Analyze this market"

✍️ *Chronicle* - News Editor (CareScope)
   _"Let's craft this story right..."_
   Try: "Write article about CQC inspection trends"

👋 *Maven* - General Assistant
   _"I'm here to help!"_
   Try: "What's the weather?" or "Show me settings"

You can @mention any agent directly, or just ask and I'll route you to the right expert!`;
}
