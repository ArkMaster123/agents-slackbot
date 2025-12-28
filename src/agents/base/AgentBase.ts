import Anthropic from '@anthropic-ai/sdk';
import type {
  AgentConfig,
  AgentContext,
  AgentResponse,
  AgentRole,
  Tool,
} from './types.js';

export abstract class AgentBase {
  protected config: AgentConfig;
  protected client: Anthropic;
  protected tools: Map<string, Tool> = new Map();

  constructor(config: AgentConfig) {
    this.config = config;

    // Initialize Anthropic client with OpenRouter base URL
    this.client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY!,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    // Register tools for this agent
    this.registerTools();
  }

  /**
   * Each agent implements this to register their specific tools
   */
  protected abstract registerTools(): void;

  /**
   * Get the agent's personality info
   */
  get personality() {
    return this.config.personality;
  }

  /**
   * Get the agent's role
   */
  get role(): AgentRole {
    return this.config.personality.role;
  }

  /**
   * Main method to handle requests
   */
  async handleRequest(context: AgentContext): Promise<AgentResponse> {
    const toolsUsed: string[] = [];

    try {
      // Build the system prompt with personality
      const systemPrompt = this.buildSystemPrompt(context);

      // Prepare Anthropic tools from registered tools
      const anthropicTools: Anthropic.Tool[] = Array.from(this.tools.values()).map(
        (tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.parameters,
        })
      );

      // Call Claude with tools
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens || 4096,
        temperature: this.config.temperature || 0.7,
        system: systemPrompt,
        messages: context.messages,
        tools: anthropicTools.length > 0 ? anthropicTools : undefined,
      });

      // Process the response
      let finalText = '';
      const toolCalls: Anthropic.ToolUseBlock[] = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          finalText += block.text;
        } else if (block.type === 'tool_use') {
          toolCalls.push(block);
        }
      }

      // Execute tools if there are tool calls
      if (toolCalls.length > 0) {
        const toolResults = await this.executeTools(toolCalls, context);
        toolsUsed.push(...toolCalls.map((tc) => tc.name));

        // Continue conversation with tool results
        const followUpMessages: Anthropic.MessageParam[] = [
          ...context.messages,
          {
            role: 'assistant',
            content: response.content,
          },
          {
            role: 'user',
            content: toolResults.map((result) => ({
              type: 'tool_result' as const,
              tool_use_id: result.tool_use_id,
              content: JSON.stringify(result.content),
            })),
          },
        ];

        const followUpResponse = await this.client.messages.create({
          model: this.config.model,
          max_tokens: this.config.maxTokens || 4096,
          temperature: this.config.temperature || 0.7,
          system: systemPrompt,
          messages: followUpMessages,
        });

        // Extract final text
        for (const block of followUpResponse.content) {
          if (block.type === 'text') {
            finalText += block.text;
          }
        }
      }

      // Convert markdown links to Slack format
      const slackFormattedText = this.formatForSlack(finalText);

      return {
        text: slackFormattedText,
        agent: this.role,
        toolsUsed,
      };
    } catch (error) {
      console.error(`Error in ${this.personality.name}:`, error);

      // Return friendly error message with personality
      return {
        text: this.getErrorMessage(error),
        agent: this.role,
        toolsUsed,
      };
    }
  }

  /**
   * Build system prompt with personality injection
   */
  protected buildSystemPrompt(context: AgentContext): string {
    const basePrompt = `You are ${this.personality.name}, ${this.personality.description}

Your catchphrase: "${this.personality.catchphrase}"

${this.config.systemPrompt}

IMPORTANT:
- Stay in character with your personality
- Be helpful and professional
- Cite sources when using web search
- Keep responses concise for Slack
- Current date: ${new Date().toISOString().split('T')[0]}
`;

    return basePrompt;
  }

  /**
   * Execute tool calls
   */
  protected async executeTools(
    toolCalls: Anthropic.ToolUseBlock[],
    context: AgentContext
  ): Promise<Array<{ tool_use_id: string; content: any }>> {
    const results = [];

    for (const toolCall of toolCalls) {
      const tool = this.tools.get(toolCall.name);

      if (!tool) {
        results.push({
          tool_use_id: toolCall.id,
          content: { error: `Tool ${toolCall.name} not found` },
        });
        continue;
      }

      try {
        const result = await tool.execute(toolCall.input, context);
        results.push({
          tool_use_id: toolCall.id,
          content: result,
        });
      } catch (error: any) {
        results.push({
          tool_use_id: toolCall.id,
          content: { error: error.message },
        });
      }
    }

    return results;
  }

  /**
   * Format text for Slack (markdown to Slack mrkdwn)
   */
  protected formatForSlack(text: string): string {
    return text
      .replace(/\[(.*?)\]\((.*?)\)/g, '<$2|$1>') // Convert [text](url) to <url|text>
      .replace(/\*\*/g, '*') // Convert ** to *
      .trim();
  }

  /**
   * Get a personality-appropriate error message
   */
  protected abstract getErrorMessage(error: any): string;

  /**
   * Register a tool for this agent
   */
  protected registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }
}
