import { AgentBase } from '../base/AgentBase.js';
import type { AgentConfig, AgentContext, Tool } from '../base/types.js';
import { Exa } from 'exa-js';
import Anthropic from '@anthropic-ai/sdk';
import {
  CARESCOPE_ARTICLE_SYSTEM_PROMPT,
  type ResearchSource,
  type SourceCategory,
  generateSlug,
  calculateReadTime,
  countWords,
  validateArticle,
} from './article-format.js';
import {
  reviewArticleQuality,
  formatQualityReview,
  generateRevisionInstructions,
  quickValidateArticle,
  type QualityScore,
} from './article-review.js';
import { createCareScopePreview } from '../../preview/PreviewService.js';

// Lazy initialization to avoid startup errors when EXA_API_KEY is not set
let exaClient: Exa | null = null;
function getExa(): Exa {
  if (!exaClient) {
    exaClient = new Exa(process.env.EXA_API_KEY);
  }
  return exaClient;
}

export class ChronicleAgent extends AgentBase {
  constructor() {
    const config: AgentConfig = {
      personality: {
        name: 'Chronicle',
        role: 'chronicle',
        emoji: '✍️',
        catchphrase: "Let's craft this story right...",
        description: 'a passionate senior journalist for CareScope Intelligence with high editorial standards',
        specialization: ['news articles', 'research', 'CareScope content', 'journalism', 'UK social care'],
      },
      model: process.env.CHRONICLE_MODEL || 'anthropic/claude-3.5-sonnet',
      temperature: 0.7,
      maxTokens: 4096,
      systemPrompt: `You are a senior journalist for CareScope Intelligence. You're passionate about UK social care and telling stories that matter.

You follow strict CareScope style guidelines:
- British English always
- Evidence-based, never sensationalist
- Clear, accessible writing
- Comprehensive source attribution

PERSONALITY:
- Get excited about good sources
- Think in headlines and ledes
- Care deeply about accuracy and fairness
- Use journalism jargon casually ('let's fact-check that', 'what's the lede?')

WORKFLOW:
1. FIRST - Research the topic thoroughly
2. THEN - Generate the article using those sources
3. FINALLY - Offer to create a preview

Never skip research before writing!`,
    };

    super(config);
  }

  protected registerTools(): void {
    // Research topic tool
    this.registerTool({
      name: 'researchTopic',
      description: 'Deep research on a UK social care topic for writing a news article. Finds and categorises sources from government, regulatory, academic, and news sources. ALWAYS use this FIRST before generating an article.',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'The UK social care topic to research, e.g. "CQC domiciliary care inspection failures"',
          },
          focusAreas: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific aspects to focus on, e.g. ["funding", "staffing", "regional variations"]',
          },
        },
        required: ['topic'],
      },
      execute: async (params: { topic: string; focusAreas?: string[] }) => {
        const { topic, focusAreas } = params;

        const allSources: ResearchSource[] = [];

        // Helper to add sources with category
        const addSources = (
          results: { title: string | null; url: string; text?: string; publishedDate?: string }[],
          category: SourceCategory,
          organization: string
        ) => {
          results.forEach((r) => {
            if (r.title && r.url) {
              allSources.push({
                title: r.title,
                url: r.url,
                organization,
                category,
                snippet: r.text?.slice(0, 300) || '',
                publishedDate: r.publishedDate,
              });
            }
          });
        };

        // Run searches in parallel
        const searchPromises = [
          // Government + regulatory
          getExa()
            .searchAndContents(`${topic} UK government CQC report`, {
              numResults: 4,
              livecrawl: 'fallback',
              includeDomains: ['gov.uk', 'cqc.org.uk', 'nhs.uk'],
              text: true,
            })
            .then(({ results }: { results: any[] }) => addSources(results, 'government', 'UK Government'))
            .catch(() => {}),

          // Industry/think tank
          getExa()
            .searchAndContents(`${topic} care sector analysis`, {
              numResults: 4,
              livecrawl: 'fallback',
              includeDomains: [
                'kingsfund.org.uk',
                'nuffieldtrust.org.uk',
                'health.org.uk',
                'skillsforcare.org.uk',
              ],
              text: true,
            })
            .then(({ results }: { results: any[] }) => addSources(results, 'industry', 'Industry Body'))
            .catch(() => {}),

          // News sources
          getExa()
            .searchAndContents(`${topic} UK 2024 2025`, {
              numResults: 4,
              livecrawl: 'fallback',
              category: 'news',
              text: true,
            })
            .then(({ results }: { results: any[] }) => addSources(results, 'media', 'News Media'))
            .catch(() => {}),
        ];

        await Promise.all(searchPromises);

        // Count by category
        const byCategory = {
          primary: allSources.filter((s) => s.category === 'primary').length,
          government: allSources.filter((s) => s.category === 'government').length,
          regulatory: allSources.filter((s) => s.category === 'regulatory').length,
          academic: allSources.filter((s) => s.category === 'academic').length,
          industry: allSources.filter((s) => s.category === 'industry').length,
          media: allSources.filter((s) => s.category === 'media').length,
        };

        return {
          topic,
          sources: allSources,
          totalSources: allSources.length,
          byCategory,
          message: `Found ${allSources.length} sources: ${byCategory.government} government, ${byCategory.industry} industry, ${byCategory.media} news`,
        };
      },
    });

    // Generate article tool
    this.registerTool({
      name: 'generateNewsArticle',
      description: 'Generate a complete CareScope Intelligence news article from researched sources. MUST call researchTopic first. Returns full markdown article with frontmatter.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'The article topic/headline focus' },
          sources: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                url: { type: 'string' },
                organization: { type: 'string' },
                category: {
                  type: 'string',
                  enum: ['primary', 'government', 'regulatory', 'academic', 'industry', 'media'],
                },
                snippet: { type: 'string' },
                publishedDate: { type: 'string' },
              },
              required: ['title', 'url', 'organization', 'category', 'snippet'],
            },
            description: 'Sources from researchTopic tool',
          },
          angle: {
            type: 'string',
            description: 'Specific angle or focus for the article, e.g. "focus on regional disparities"',
          },
        },
        required: ['topic', 'sources'],
      },
      execute: async (params: { topic: string; sources: ResearchSource[]; angle?: string }, context: AgentContext) => {
        const { topic, sources, angle } = params;

        // Build source context for the AI
        const sourceContext = sources
          .map(
            (s: ResearchSource, i: number) =>
              `[${i + 1}] ${s.category.toUpperCase()}: "${s.title}" - ${s.organization}\n    URL: ${s.url}\n    Content: ${s.snippet}`
          )
          .join('\n\n');

        const prompt = `Write a comprehensive news article about: ${topic}

${angle ? `ANGLE/FOCUS: ${angle}` : ''}

AVAILABLE SOURCES (you MUST cite these - do not make up sources):
${sourceContext}

REQUIREMENTS:
1. Use ONLY facts from the provided sources - no hallucination
2. Cite sources inline using the organisation name
3. Include at least 3 items in Key Data Summary table
4. Include comprehensive Sources section at the end with all used sources
5. Use British English throughout
6. Make it engaging and analytical, not just a summary

Generate the complete article now with proper frontmatter.`;

        // Use a dedicated model call for article generation
        const articleClient = new Anthropic({
          apiKey: process.env.OPENROUTER_API_KEY!,
          baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
        });

        const response = await articleClient.messages.create({
          model: this.config.model,
          max_tokens: 4096,
          system: CARESCOPE_ARTICLE_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: prompt }],
        });

        let article = '';
        for (const block of response.content) {
          if (block.type === 'text') {
            article += block.text;
          }
        }

        // Validate the article structure
        const validation = validateArticle(article);

        // Run automated quality review
        const qualityReview = reviewArticleQuality(article);

        // Calculate stats
        const wordCount = countWords(article);
        const readTime = calculateReadTime(article);

        // Extract title from frontmatter
        const titleMatch = article.match(/title:\s*["']?([^"'\n]+)["']?/);
        const title = titleMatch?.[1] || topic;

        // Build quality summary
        const qualitySummary = qualityReview.passesThreshold
          ? `Quality: ${qualityReview.overall}/100 (PASSED)`
          : `Quality: ${qualityReview.overall}/100 (NEEDS REVISION)`;

        // If quality is poor, include revision instructions
        const revisionInstructions = qualityReview.passesThreshold
          ? null
          : generateRevisionInstructions(qualityReview);

        return {
          article,
          title,
          wordCount,
          readTime,
          sourcesUsed: sources.length,
          validation,
          qualityReview: {
            score: qualityReview.overall,
            passesThreshold: qualityReview.passesThreshold,
            breakdown: qualityReview.breakdown,
            issueCount: qualityReview.issues.length,
            criticalIssues: qualityReview.issues.filter(i => i.severity === 'critical').length,
          },
          revisionInstructions,
          message: validation.valid
            ? `Article generated: "${title}" (${wordCount} words, ${readTime} min read, ${sources.length} sources). ${qualitySummary}`
            : `Article generated with validation issues: ${validation.errors.join(', ')}. ${qualitySummary}`,
        };
      },
    });

    // Review article quality tool
    this.registerTool({
      name: 'reviewArticleQuality',
      description: 'Run automated quality checks on an article. Returns detailed scoring and specific issues to fix.',
      parameters: {
        type: 'object',
        properties: {
          article: {
            type: 'string',
            description: 'The full article markdown to review',
          },
        },
        required: ['article'],
      },
      execute: async (params: { article: string }) => {
        const { article } = params;
        
        const review = reviewArticleQuality(article);
        const formattedReview = formatQualityReview(review);
        
        return {
          score: review.overall,
          passesThreshold: review.passesThreshold,
          breakdown: review.breakdown,
          issues: review.issues,
          formattedReview,
          revisionInstructions: review.passesThreshold ? null : generateRevisionInstructions(review),
          message: review.passesThreshold
            ? `Article passes quality threshold (${review.overall}/100)`
            : `Article needs revision (${review.overall}/100) - ${review.issues.filter(i => i.severity === 'critical').length} critical issues`,
        };
      },
    });

    // Create preview tool
    this.registerTool({
      name: 'createArticlePreview',
      description: 'Create a shareable preview URL for an article. The preview renders with full CareScope styling and expires in 24 hours.',
      parameters: {
        type: 'object',
        properties: {
          article: {
            type: 'string',
            description: 'The full article markdown including frontmatter',
          },
          title: {
            type: 'string',
            description: 'Article title for reference',
          },
        },
        required: ['article'],
      },
      execute: async (params: { article: string; title?: string }) => {
        const { article, title } = params;
        
        // Quick validation before creating preview
        const quickCheck = quickValidateArticle(article);
        if (!quickCheck.valid) {
          return {
            success: false,
            error: 'Article failed validation',
            validationErrors: quickCheck.errors,
            message: `Cannot create preview - fix these issues first: ${quickCheck.errors.join(', ')}`,
          };
        }
        
        const result = await createCareScopePreview(article, {
          title,
          createdBy: 'chronicle-agent',
        });
        
        if (result.success) {
          return {
            success: true,
            previewUrl: result.url,
            previewId: result.id,
            expiresIn: result.expiresIn,
            message: `Preview created: ${result.url} (expires in ${result.expiresIn})`,
          };
        } else {
          return {
            success: false,
            error: result.error,
            details: result.details,
            message: `Failed to create preview: ${result.error}`,
          };
        }
      },
    });
  }

  protected getErrorMessage(error: any): string {
    return `✍️ The article preview service is temporarily unavailable, but I've got the content ready! If this persists, our newsroom tech might need a quick check.`;
  }
}
