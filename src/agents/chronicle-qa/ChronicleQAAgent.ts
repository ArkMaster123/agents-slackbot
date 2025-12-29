/**
 * Chronicle QA Agent
 * 
 * Expert editor for CareScope Intelligence articles.
 * Reviews, scores, and improves blog content before publication.
 */

import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load skills.md as system prompt (use __dirname directly in CommonJS)
const SKILLS_PATH = join(__dirname, 'skills.md');
let SYSTEM_PROMPT: string;
try {
  SYSTEM_PROMPT = readFileSync(SKILLS_PATH, 'utf-8');
} catch {
  SYSTEM_PROMPT = 'You are an expert editor for CareScope Intelligence articles.';
}

// MCP server configurations
const EXA_MCP_SERVER = {
  type: 'http' as const,
  url: `https://mcp.exa.ai/mcp?exaApiKey=${process.env.EXA_API_KEY}`,
};

export interface QAReviewResult {
  overallScore: number;
  maxScore: number;
  percentage: number;
  dimensions: {
    structure: { score: number; notes: string };
    dataQuality: { score: number; notes: string };
    writingQuality: { score: number; notes: string };
    sourceQuality: { score: number; notes: string };
    uniqueness: { score: number; notes: string };
    seoAccessibility: { score: number; notes: string };
  };
  criticalIssues: string[];
  improvements: string[];
  formattingFixes: string[];
  britishEnglishCorrections: string[];
  uniquenessAnalysis: string;
  fullReview: string;
}

export interface StageCallback {
  (stage: 'loading' | 'analyzing' | 'scoring' | 'comparing' | 'complete', data?: any): void;
}

/**
 * Review article content for CareScope standards
 */
export async function reviewArticle(
  articleContent: string,
  options: {
    onStage?: StageCallback;
    compareWithExisting?: boolean;
  } = {}
): Promise<QAReviewResult> {
  const { onStage, compareWithExisting = true } = options;

  onStage?.('loading');

  // Build the review prompt
  let prompt = `Please review this article for CareScope Intelligence publication.

## Article to Review

${articleContent}

---

## Your Task

1. Check the article against all CareScope format standards in your skills
2. Score each dimension (Structure, Data Quality, Writing Quality, Source Quality, Uniqueness, SEO/Accessibility)
3. Identify critical issues that must be fixed before publication
4. Suggest improvements with specific examples
5. Check for British English usage and UK terminology
6. Provide an overall quality assessment

Please provide your review in the format specified in your skills document.`;

  if (compareWithExisting) {
    prompt += `

Also, use your web search tool to check if similar articles already exist on CareScope or other UK care news sites. Compare the uniqueness of this article's angle and data.`;
  }

  onStage?.('analyzing');

  let fullReview = '';
  const toolsUsed: string[] = [];

  try {
    const response = query({
      prompt,
      options: {
        model: 'sonnet',
        systemPrompt: SYSTEM_PROMPT,
        mcpServers: {
          exa: EXA_MCP_SERVER,
        },
        tools: [], // Disable built-in tools, only use MCP
        maxTurns: 5,
        permissionMode: 'bypassPermissions',
      },
    });

    for await (const message of response) {
      if (message.type === 'assistant') {
        const content = (message as any).message?.content || [];
        for (const block of content) {
          if (block.type === 'tool_use') {
            onStage?.('comparing', { tool: block.name });
            toolsUsed.push(block.name);
          } else if (block.type === 'text' && block.text) {
            fullReview = block.text;
          }
        }
      } else if (message.type === 'result') {
        onStage?.('scoring');
      }
    }
  } catch (error: any) {
    console.error('Chronicle QA review error:', error);
    fullReview = `Error during review: ${error.message}`;
  }

  onStage?.('complete');

  // Parse the review to extract scores (basic parsing - could be enhanced)
  const result = parseReview(fullReview);
  result.fullReview = fullReview;

  return result;
}

/**
 * Parse the review text to extract structured scores
 */
function parseReview(reviewText: string): QAReviewResult {
  // Default scores
  const result: QAReviewResult = {
    overallScore: 0,
    maxScore: 60,
    percentage: 0,
    dimensions: {
      structure: { score: 0, notes: '' },
      dataQuality: { score: 0, notes: '' },
      writingQuality: { score: 0, notes: '' },
      sourceQuality: { score: 0, notes: '' },
      uniqueness: { score: 0, notes: '' },
      seoAccessibility: { score: 0, notes: '' },
    },
    criticalIssues: [],
    improvements: [],
    formattingFixes: [],
    britishEnglishCorrections: [],
    uniquenessAnalysis: '',
    fullReview: reviewText,
  };

  // Try to extract overall score
  const overallMatch = reviewText.match(/Overall Score:\s*(\d+)\/60/i);
  if (overallMatch) {
    result.overallScore = parseInt(overallMatch[1], 10);
    result.percentage = Math.round((result.overallScore / 60) * 100);
  }

  // Try to extract individual dimension scores
  const dimensionPatterns = [
    { key: 'structure', pattern: /Structure\s*\|\s*(\d+)\/10\s*\|\s*(.+?)(?=\n|\|)/i },
    { key: 'dataQuality', pattern: /Data Quality\s*\|\s*(\d+)\/10\s*\|\s*(.+?)(?=\n|\|)/i },
    { key: 'writingQuality', pattern: /Writing Quality\s*\|\s*(\d+)\/10\s*\|\s*(.+?)(?=\n|\|)/i },
    { key: 'sourceQuality', pattern: /Source Quality\s*\|\s*(\d+)\/10\s*\|\s*(.+?)(?=\n|\|)/i },
    { key: 'uniqueness', pattern: /Uniqueness\s*\|\s*(\d+)\/10\s*\|\s*(.+?)(?=\n|\|)/i },
    { key: 'seoAccessibility', pattern: /SEO.*Accessibility\s*\|\s*(\d+)\/10\s*\|\s*(.+?)(?=\n|\|)/i },
  ];

  for (const { key, pattern } of dimensionPatterns) {
    const match = reviewText.match(pattern);
    if (match) {
      (result.dimensions as any)[key] = {
        score: parseInt(match[1], 10),
        notes: match[2].trim(),
      };
    }
  }

  // Calculate overall score from dimensions if not found
  if (result.overallScore === 0) {
    result.overallScore = Object.values(result.dimensions).reduce((sum, d) => sum + d.score, 0);
    result.percentage = Math.round((result.overallScore / 60) * 100);
  }

  // Extract critical issues
  const criticalSection = reviewText.match(/### Critical Issues.*?\n([\s\S]*?)(?=###|$)/i);
  if (criticalSection) {
    result.criticalIssues = extractListItems(criticalSection[1]);
  }

  // Extract improvements
  const improvementSection = reviewText.match(/### Improvements.*?\n([\s\S]*?)(?=###|$)/i);
  if (improvementSection) {
    result.improvements = extractListItems(improvementSection[1]);
  }

  // Extract formatting fixes
  const formattingSection = reviewText.match(/### Formatting Fixes.*?\n([\s\S]*?)(?=###|$)/i);
  if (formattingSection) {
    result.formattingFixes = extractListItems(formattingSection[1]);
  }

  // Extract British English corrections
  const englishSection = reviewText.match(/### British English Corrections.*?\n([\s\S]*?)(?=###|$)/i);
  if (englishSection) {
    result.britishEnglishCorrections = extractListItems(englishSection[1]);
  }

  // Extract uniqueness analysis
  const uniquenessSection = reviewText.match(/### Uniqueness Analysis.*?\n([\s\S]*?)(?=###|$)/i);
  if (uniquenessSection) {
    result.uniquenessAnalysis = uniquenessSection[1].trim();
  }

  return result;
}

/**
 * Extract list items from markdown text
 */
function extractListItems(text: string): string[] {
  const items: string[] = [];
  const lines = text.split('\n');
  
  for (const line of lines) {
    const match = line.match(/^\s*[-*\d.]+\s*(.+)/);
    if (match && match[1].trim()) {
      items.push(match[1].trim());
    }
  }
  
  return items;
}

/**
 * Quick check for British English issues
 */
export function checkBritishEnglish(text: string): string[] {
  const issues: string[] = [];
  
  const americanToBritish: Record<string, string> = {
    'analyze': 'analyse',
    'organization': 'organisation',
    'recognize': 'recognise',
    'favor': 'favour',
    'color': 'colour',
    'center': 'centre',
    'behavior': 'behaviour',
    'defense': 'defence',
    'offense': 'offence',
    'traveling': 'travelling',
    'canceled': 'cancelled',
    'labeled': 'labelled',
    'modeling': 'modelling',
    'catalog': 'catalogue',
    'dialog': 'dialogue',
    'fulfill': 'fulfil',
    'enrollment': 'enrolment',
    'aging': 'ageing',
    'caregiver': 'carer',
  };

  for (const [american, british] of Object.entries(americanToBritish)) {
    const regex = new RegExp(`\\b${american}\\b`, 'gi');
    if (regex.test(text)) {
      issues.push(`"${american}" → "${british}"`);
    }
  }

  return issues;
}

/**
 * Check for UK care terminology
 */
export function checkUKTerminology(text: string): string[] {
  const issues: string[] = [];
  
  const wrongTerms: Record<string, string> = {
    'nursing home': 'care home (or care home with nursing)',
    'assisted living': 'extra care housing or supported living',
    'home health care': 'domiciliary care or home care',
    'caregiver': 'carer or care worker',
    'local government': 'local authority',
    'child protection': 'safeguarding',
    'adult protection': 'safeguarding',
  };

  for (const [wrong, correct] of Object.entries(wrongTerms)) {
    const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
    if (regex.test(text)) {
      issues.push(`"${wrong}" → "${correct}"`);
    }
  }

  return issues;
}

/**
 * Format a review result for Slack
 */
export function formatReviewForSlack(result: QAReviewResult): string {
  const emoji = result.percentage >= 80 ? '✅' : result.percentage >= 60 ? '⚠️' : '❌';
  
  let output = `${emoji} *Chronicle QA Review*\n\n`;
  output += `*Overall Score: ${result.overallScore}/60 (${result.percentage}%)*\n\n`;
  
  output += `*Dimension Scores:*\n`;
  output += `• Structure: ${result.dimensions.structure.score}/10\n`;
  output += `• Data Quality: ${result.dimensions.dataQuality.score}/10\n`;
  output += `• Writing Quality: ${result.dimensions.writingQuality.score}/10\n`;
  output += `• Source Quality: ${result.dimensions.sourceQuality.score}/10\n`;
  output += `• Uniqueness: ${result.dimensions.uniqueness.score}/10\n`;
  output += `• SEO/Accessibility: ${result.dimensions.seoAccessibility.score}/10\n\n`;

  if (result.criticalIssues.length > 0) {
    output += `*Critical Issues (Must Fix):*\n`;
    for (const issue of result.criticalIssues.slice(0, 5)) {
      output += `• ${issue}\n`;
    }
    output += '\n';
  }

  if (result.britishEnglishCorrections.length > 0) {
    output += `*British English Corrections:*\n`;
    for (const correction of result.britishEnglishCorrections.slice(0, 5)) {
      output += `• ${correction}\n`;
    }
    output += '\n';
  }

  if (result.improvements.length > 0) {
    output += `*Top Improvements:*\n`;
    for (const improvement of result.improvements.slice(0, 3)) {
      output += `• ${improvement}\n`;
    }
  }

  return output;
}
