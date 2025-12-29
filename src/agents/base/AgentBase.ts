import type {
  AgentConfig,
  AgentContext,
  AgentResponse,
  AgentRole,
  Tool,
} from './types.js';

// Types for OpenRouter/OpenAI-compatible API
interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Call OpenRouter API (OpenAI-compatible format)
 * Works with any model including Gemini, Claude, Llama, etc.
 */
async function callOpenRouter(
  model: string,
  messages: ChatMessage[],
  tools?: any[],
  maxTokens = 4096,
  temperature = 0.7
): Promise<OpenRouterResponse> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/agents-slackbot',
      'X-Title': 'Agents Slackbot'
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      tools: tools && tools.length > 0 ? tools : undefined,
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  return await response.json() as OpenRouterResponse;
}

export abstract class AgentBase {
  protected config: AgentConfig;
  protected tools: Map<string, Tool> = new Map();

  constructor(config: AgentConfig) {
    this.config = config;
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

      // Prepare OpenAI-format tools from registered tools
      const openaiTools = Array.from(this.tools.values()).map((tool) => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));

      // Convert Anthropic-style messages to OpenAI format
      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...context.messages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        }))
      ];

      // Call LLM via OpenRouter
      const response = await callOpenRouter(
        this.config.model,
        messages,
        openaiTools.length > 0 ? openaiTools : undefined,
        this.config.maxTokens || 4096,
        this.config.temperature || 0.7
      );

      // Process the response
      const message = response.choices?.[0]?.message;
      let finalText = message?.content || '';
      const toolCalls = message?.tool_calls || [];

      // Execute tools if there are tool calls
      if (toolCalls.length > 0) {
        const toolResults = await this.executeTools(toolCalls, context);
        toolsUsed.push(...toolCalls.map((tc) => tc.function.name));

        // Continue conversation with tool results
        const followUpMessages: ChatMessage[] = [
          ...messages,
          { 
            role: 'assistant', 
            content: message?.content || '',
            tool_calls: toolCalls 
          },
          ...toolResults.map((result) => ({
            role: 'tool' as const,
            tool_call_id: result.tool_call_id,
            content: JSON.stringify(result.content),
          })),
        ];

        const followUpResponse = await callOpenRouter(
          this.config.model,
          followUpMessages,
          undefined, // No tools on follow-up
          this.config.maxTokens || 4096,
          this.config.temperature || 0.7
        );

        finalText = followUpResponse.choices?.[0]?.message?.content || finalText;
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
   * Execute tool calls (OpenAI format)
   */
  protected async executeTools(
    toolCalls: ToolCall[],
    context: AgentContext
  ): Promise<Array<{ tool_call_id: string; content: any }>> {
    const results = [];

    for (const toolCall of toolCalls) {
      const tool = this.tools.get(toolCall.function.name);

      if (!tool) {
        results.push({
          tool_call_id: toolCall.id,
          content: { error: `Tool ${toolCall.function.name} not found` },
        });
        continue;
      }

      try {
        const args = JSON.parse(toolCall.function.arguments);
        const result = await tool.execute(args, context);
        results.push({
          tool_call_id: toolCall.id,
          content: result,
        });
      } catch (error: any) {
        results.push({
          tool_call_id: toolCall.id,
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
