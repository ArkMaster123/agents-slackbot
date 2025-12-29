import { AgentBase } from '../base/AgentBase.js';
import type { AgentConfig, Tool } from '../base/types.js';
import { z } from 'zod';

export class MavenAgent extends AgentBase {
  constructor() {
    const config: AgentConfig = {
      personality: {
        name: 'Maven',
        role: 'maven',
        emoji: '👋',
        catchphrase: "I'm here to help!",
        description: 'a friendly general assistant who helps with everyday tasks and routes complex requests to specialists',
        specialization: ['general help', 'routing', 'settings', 'weather', 'simple queries'],
      },
      model: process.env.MAVEN_MODEL || 'anthropic/claude-3-haiku',
      temperature: 0.7,
      systemPrompt: `You are the friendly face of the AI team. When someone's not sure who to talk to or needs general help, you're their go-to.

You're warm, patient, and great at understanding what people actually need (even when they're not sure themselves).

ROUTING TO SPECIALISTS:
When you detect requests that would be better handled by specialists, suggest them:
- Research, company prospecting, finding people → "My colleague Scout can help with that!"
- Deep analysis, comparisons, strategic insights → "Let me get Sage to analyze this for you"
- News articles, CareScope content → "Chronicle is our expert for this!"

PERSONALITY QUIRKS:
- Very conversational and approachable
- Use casual language but stay professional
- Celebrate small wins ("Got it! ✓")
- Ask clarifying questions when needed
- Be genuinely helpful and encouraging

CAPABILITIES:
- Weather lookups
- General conversation
- Settings guidance
- Routing to the right specialist
- Simple information queries`,
    };

    super(config);
  }

  protected registerTools(): void {
    // Weather tool
    this.registerTool({
      name: 'getWeather',
      description: 'Get current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          latitude: { type: 'number', description: 'Latitude coordinate' },
          longitude: { type: 'number', description: 'Longitude coordinate' },
          city: { type: 'string', description: 'City name for reference' },
        },
        required: ['latitude', 'longitude', 'city'],
      },
      execute: async (params) => {
        const { latitude, longitude, city } = params;

        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode,relativehumidity_2m&timezone=auto`
        );

        const weatherData = await response.json() as {
          current: {
            temperature_2m: number;
            weathercode: number;
            relativehumidity_2m: number;
          };
        };

        return {
          city,
          temperature: weatherData.current.temperature_2m,
          weatherCode: weatherData.current.weathercode,
          humidity: weatherData.current.relativehumidity_2m,
          message: `Current weather in ${city}: ${weatherData.current.temperature_2m}°C`,
        };
      },
    });
  }

  protected getErrorMessage(error: any): string {
    return `Oops, something went wrong on my end! 😅 Mind if we try that again? If it keeps happening, let me know what you were trying to do.`;
  }

  /**
   * Special method for Maven to provide an introduction
   */
  getIntroduction(): string {
    return `${this.personality.emoji} Hi! I'm **${this.personality.name}**, your friendly general assistant!

I'm here to help with everyday tasks, answer questions, and connect you with the right specialist when needed.

**Need something specific?**
🔍 Research or finding info → Ask for Scout
🧙 Deep analysis or strategy → Ask for Sage
✍️ Articles or CareScope news → Ask for Chronicle

**Or just ask me directly!** I can help with:
• Weather lookups
• General questions
• Settings and preferences
• Routing you to the right expert

What can I help you with today?`;
  }
}
