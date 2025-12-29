// Article Quality Review System
// Reviews generated articles against CareScope standards before publishing
// Ported from ai-sdk-slackbot with enhancements for multi-agent workflows

export interface QualityScore {
  overall: number; // 0-100
  breakdown: {
    dataQuality: number; // Are there specific numbers, not placeholders?
    sourceAttribution: number; // Are sources properly cited inline?
    formatting: number; // Is markdown properly formatted?
    depth: number; // Is there analysis, not just summaries?
    actionability: number; // Is it useful for the reader?
    britishEnglish: number; // Correct spelling/terminology?
  };
  issues: QualityIssue[];
  passesThreshold: boolean;
}

export interface QualityIssue {
  severity: "critical" | "major" | "minor";
  category: string;
  description: string;
  example?: string;
  suggestion: string;
}

// Minimum score to pass (out of 100)
const QUALITY_THRESHOLD = 70;

/**
 * Review an article for quality issues
 * This is an automated pre-check before sending to ChronicleQA agent
 */
export function reviewArticleQuality(article: string): QualityScore {
  const issues: QualityIssue[] = [];
  const scores = {
    dataQuality: 100,
    sourceAttribution: 100,
    formatting: 100,
    depth: 100,
    actionability: 100,
    britishEnglish: 100,
  };

  // ============================================
  // DATA QUALITY CHECKS
  // ============================================

  // Check for placeholder data
  const placeholderPatterns = [
    /to be confirmed/gi,
    /TBC/g,
    /TBD/g,
    /\[insert/gi,
    /\[add/gi,
    /N\/A/g,
    /data unavailable/gi,
    /figures pending/gi,
    /awaiting data/gi,
    /XX%/g,
    /X,XXX/g,
    /\$X/g,
    /£X/g,
    /\[TODO\]/gi,
    /\[PLACEHOLDER\]/gi,
  ];

  placeholderPatterns.forEach((pattern) => {
    const matches = article.match(pattern);
    if (matches) {
      scores.dataQuality -= 15 * matches.length;
      issues.push({
        severity: "critical",
        category: "Data Quality",
        description: `Found placeholder data: "${matches[0]}"`,
        example: matches[0],
        suggestion: "Replace with actual figures from research sources, or remove the section if data unavailable",
      });
    }
  });

  // Check Key Data Summary table has real numbers
  const keyDataMatch = article.match(/Key Data Summary[\s\S]*?\|[\s\S]*?\|/);
  if (keyDataMatch) {
    const hasRealNumbers = /\d+[%,.\d]*/.test(keyDataMatch[0]);
    if (!hasRealNumbers) {
      scores.dataQuality -= 20;
      issues.push({
        severity: "critical",
        category: "Data Quality",
        description: "Key Data Summary table lacks specific numbers",
        suggestion: "Include at least 3 concrete statistics with actual figures (e.g., '£12.50/hour', '152,000 vacancies', '8.3% increase')",
      });
    }
  } else {
    // Key Data Summary is required
    scores.dataQuality -= 15;
    issues.push({
      severity: "major",
      category: "Data Quality",
      description: "Missing Key Data Summary table",
      suggestion: "Add a Key Data Summary section with a markdown table showing 3+ key statistics",
    });
  }

  // Check for specific statistics (should have at least 5)
  const statPatterns = [
    /\d+%/, // percentages
    /£[\d,]+/, // money
    /\d{1,3}(,\d{3})+/, // large numbers with commas
    /\d+\.\d+/, // decimals
  ];
  let statCount = 0;
  statPatterns.forEach((pattern) => {
    const matches = article.match(new RegExp(pattern, "g"));
    if (matches) statCount += matches.length;
  });

  if (statCount < 5) {
    scores.dataQuality -= 15;
    issues.push({
      severity: "major",
      category: "Data Quality",
      description: `Only ${statCount} specific statistics found (minimum 5 recommended)`,
      suggestion: "Add more concrete data points from your research sources",
    });
  }

  // ============================================
  // SOURCE ATTRIBUTION CHECKS
  // ============================================

  // Check for proper inline citations
  const inlineCitations = article.match(/according to|reported by|data from|states that|found that|published by|research by|analysis by/gi);
  if (!inlineCitations || inlineCitations.length < 3) {
    scores.sourceAttribution -= 20;
    issues.push({
      severity: "major",
      category: "Source Attribution",
      description: "Insufficient inline source attribution",
      suggestion: "Cite sources naturally in the text (e.g., 'According to Skills for Care...', 'CQC data shows...')",
    });
  }

  // Check for weird citation formats like [1], [10]
  const bracketCitations = article.match(/\[\d+\]/g);
  if (bracketCitations && bracketCitations.length > 3) {
    scores.sourceAttribution -= 15;
    issues.push({
      severity: "major",
      category: "Source Attribution",
      description: "Using academic-style bracket citations [1], [2] instead of natural attribution",
      example: bracketCitations.slice(0, 3).join(", "),
      suggestion: "Replace [1] style citations with natural attribution: 'According to the CQC...' or 'Skills for Care reports that...'",
    });
  }

  // Check for Sources section
  if (!article.includes("## Sources")) {
    scores.sourceAttribution -= 25;
    issues.push({
      severity: "critical",
      category: "Source Attribution",
      description: "Missing Sources section",
      suggestion: "Add a '## Sources' section at the end with categorised references",
    });
  }

  // ============================================
  // FORMATTING CHECKS
  // ============================================

  // Check for broken markdown
  const brokenPatterns = [
    { pattern: /\\\\[*_]/, name: "escaped markdown characters" },
    { pattern: /\n\s*\\[*]/, name: "broken bullet points" },
    { pattern: /\*\*\s+\*\*/, name: "empty bold text" },
    { pattern: /##\s*$/, name: "empty headings" },
    { pattern: /\n#+[^\s]/, name: "headings without space after #" },
  ];

  brokenPatterns.forEach(({ pattern, name }) => {
    if (pattern.test(article)) {
      scores.formatting -= 15;
      issues.push({
        severity: "major",
        category: "Formatting",
        description: `Found ${name}`,
        suggestion: "Fix markdown formatting - use proper * for bullets, ** for bold",
      });
    }
  });

  // Check frontmatter exists and is valid
  if (!article.startsWith("---")) {
    scores.formatting -= 25;
    issues.push({
      severity: "critical",
      category: "Formatting",
      description: "Missing frontmatter",
      suggestion: "Article must start with --- frontmatter block containing title, slug, excerpt, publishedAt, category, readTime, author, tags",
    });
  } else {
    // Check required frontmatter fields
    const frontmatterMatch = article.match(/^---\s*\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      const requiredFields = ['title', 'slug', 'excerpt', 'publishedAt', 'category', 'readTime', 'author', 'tags'];
      const missingFields = requiredFields.filter(field => !frontmatter.includes(`${field}:`));
      
      if (missingFields.length > 0) {
        scores.formatting -= 5 * missingFields.length;
        issues.push({
          severity: "major",
          category: "Formatting",
          description: `Missing frontmatter fields: ${missingFields.join(', ')}`,
          suggestion: "Add all required frontmatter fields",
        });
      }
    }
  }

  // ============================================
  // DEPTH & ANALYSIS CHECKS
  // ============================================

  // Check for generic filler phrases
  const fillerPhrases = [
    /it is important to/gi,
    /it is essential to/gi,
    /in today's world/gi,
    /in this day and age/gi,
    /going forward/gi,
    /at the end of the day/gi,
    /when it comes to/gi,
    /there is no doubt that/gi,
    /it goes without saying/gi,
    /needless to say/gi,
    /as we all know/gi,
  ];

  let fillerCount = 0;
  fillerPhrases.forEach((pattern) => {
    const matches = article.match(pattern);
    if (matches) fillerCount += matches.length;
  });

  if (fillerCount > 3) {
    scores.depth -= 10 * Math.min(fillerCount - 3, 5);
    issues.push({
      severity: "minor",
      category: "Depth",
      description: `Found ${fillerCount} filler phrases that add no value`,
      suggestion: "Replace generic phrases with specific analysis and insights",
    });
  }

  // Check for analysis indicators
  const analysisIndicators = [
    /this suggests/gi,
    /this indicates/gi,
    /the implication/gi,
    /this means that/gi,
    /compared to/gi,
    /in contrast/gi,
    /however/gi,
    /despite/gi,
    /although/gi,
    /while/gi,
    /consequently/gi,
    /as a result/gi,
  ];

  let analysisCount = 0;
  analysisIndicators.forEach((pattern) => {
    const matches = article.match(pattern);
    if (matches) analysisCount += matches.length;
  });

  if (analysisCount < 5) {
    scores.depth -= 15;
    issues.push({
      severity: "major",
      category: "Depth",
      description: "Article lacks analytical depth",
      suggestion: "Add more analysis: compare data, explain implications, discuss what the findings mean for care workers",
    });
  }

  // ============================================
  // ACTIONABILITY CHECKS
  // ============================================

  // Check word count (should be 800-1500 for a good article)
  const wordCount = article.split(/\s+/).length;
  if (wordCount < 600) {
    scores.actionability -= 20;
    issues.push({
      severity: "major",
      category: "Actionability",
      description: `Article too short (${wordCount} words, minimum 800 recommended)`,
      suggestion: "Expand the article with more detail, analysis, and practical insights",
    });
  }

  // Check for practical takeaways
  const actionablePatterns = [
    /care providers should/gi,
    /care workers can/gi,
    /this means/gi,
    /the key takeaway/gi,
    /in practice/gi,
    /practical/gi,
    /steps to/gi,
    /how to/gi,
    /what this means for/gi,
    /implications for/gi,
  ];

  let actionableCount = 0;
  actionablePatterns.forEach((pattern) => {
    const matches = article.match(pattern);
    if (matches) actionableCount += matches.length;
  });

  if (actionableCount < 2) {
    scores.actionability -= 15;
    issues.push({
      severity: "minor",
      category: "Actionability",
      description: "Article lacks practical takeaways",
      suggestion: "Add specific implications for care providers, workers, or policymakers",
    });
  }

  // ============================================
  // BRITISH ENGLISH CHECKS
  // ============================================

  const americanSpellings = [
    { american: /\borganization\b/gi, british: "organisation" },
    { american: /\borganize\b/gi, british: "organise" },
    { american: /\borganizing\b/gi, british: "organising" },
    { american: /\brecognize\b/gi, british: "recognise" },
    { american: /\brecognizing\b/gi, british: "recognising" },
    { american: /\banalyze\b/gi, british: "analyse" },
    { american: /\banalyzing\b/gi, british: "analysing" },
    { american: /\bcenter\b/gi, british: "centre" },
    { american: /\bcolor\b/gi, british: "colour" },
    { american: /\bfavor\b/gi, british: "favour" },
    { american: /\bhonor\b/gi, british: "honour" },
    { american: /\blabor\b/gi, british: "labour" },
    { american: /\bprogram\b/gi, british: "programme" },
    { american: /\bspecialize\b/gi, british: "specialise" },
    { american: /\bspecialized\b/gi, british: "specialised" },
    { american: /\bminimize\b/gi, british: "minimise" },
    { american: /\bmaximize\b/gi, british: "maximise" },
    { american: /\bprioritize\b/gi, british: "prioritise" },
    { american: /\butilize\b/gi, british: "utilise" },
    { american: /\bdefense\b/gi, british: "defence" },
    { american: /\blicense\b/gi, british: "licence" }, // noun only
    { american: /\bpractice\b/gi, british: "practise" }, // verb only - careful with this one
  ];

  americanSpellings.forEach(({ american, british }) => {
    const matches = article.match(american);
    if (matches) {
      scores.britishEnglish -= 5 * matches.length;
      issues.push({
        severity: "minor",
        category: "British English",
        description: `American spelling "${matches[0]}" should be "${british}"`,
        suggestion: `Use British spelling: "${british}"`,
      });
    }
  });

  // Check for wrong UK care terminology
  const wrongTerminology = [
    { wrong: /\bnursing home\b/gi, correct: "care home" },
    { wrong: /\bcaregiver\b/gi, correct: "carer or care worker" },
    { wrong: /\blocal government\b/gi, correct: "local authority" },
    { wrong: /\bchild protection\b/gi, correct: "safeguarding" },
    { wrong: /\badult protection\b/gi, correct: "safeguarding" },
  ];

  wrongTerminology.forEach(({ wrong, correct }) => {
    const matches = article.match(wrong);
    if (matches) {
      scores.britishEnglish -= 10;
      issues.push({
        severity: "minor",
        category: "UK Terminology",
        description: `"${matches[0]}" should be "${correct}" in UK social care context`,
        suggestion: `Use UK social care terminology: "${correct}"`,
      });
    }
  });

  // ============================================
  // CALCULATE OVERALL SCORE
  // ============================================

  // Ensure scores don't go below 0
  Object.keys(scores).forEach((key) => {
    scores[key as keyof typeof scores] = Math.max(0, scores[key as keyof typeof scores]);
  });

  // Calculate weighted average
  const weights = {
    dataQuality: 0.25,      // 25% - data is king
    sourceAttribution: 0.2,  // 20% - sources are critical
    formatting: 0.15,        // 15% - structure matters
    depth: 0.2,              // 20% - analysis is valuable
    actionability: 0.1,      // 10% - practical value
    britishEnglish: 0.1,     // 10% - consistency
  };

  const overall = Math.round(
    Object.entries(weights).reduce(
      (sum, [key, weight]) => sum + scores[key as keyof typeof scores] * weight,
      0
    )
  );

  return {
    overall,
    breakdown: scores,
    issues: issues.sort((a, b) => {
      const severityOrder = { critical: 0, major: 1, minor: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    }),
    passesThreshold: overall >= QUALITY_THRESHOLD,
  };
}

/**
 * Format quality review for Slack display
 */
export function formatQualityReview(review: QualityScore): string {
  const statusEmoji = review.passesThreshold ? "PASSED" : "FAILED";
  const scoreEmoji = review.overall >= 80 ? "excellent" : review.overall >= 60 ? "acceptable" : "needs work";

  let output = `*Quality Review: ${statusEmoji}*\n`;
  output += `*Overall Score: ${review.overall}/100* (${scoreEmoji})\n\n`;

  // Breakdown
  output += "*Score Breakdown:*\n";
  output += `  Data Quality: ${review.breakdown.dataQuality}/100\n`;
  output += `  Source Attribution: ${review.breakdown.sourceAttribution}/100\n`;
  output += `  Formatting: ${review.breakdown.formatting}/100\n`;
  output += `  Depth & Analysis: ${review.breakdown.depth}/100\n`;
  output += `  Actionability: ${review.breakdown.actionability}/100\n`;
  output += `  British English: ${review.breakdown.britishEnglish}/100\n\n`;

  // Issues
  if (review.issues.length > 0) {
    output += "*Issues Found:*\n";
    review.issues.slice(0, 7).forEach((issue) => {
      const severityLabel = issue.severity === "critical" ? "[CRITICAL]" : issue.severity === "major" ? "[MAJOR]" : "[minor]";
      output += `${severityLabel} *${issue.category}:* ${issue.description}\n`;
      output += `   -> ${issue.suggestion}\n`;
    });

    if (review.issues.length > 7) {
      output += `\n_...and ${review.issues.length - 7} more issues_\n`;
    }
  }

  if (!review.passesThreshold) {
    output += `\n*Article does not meet quality threshold (${QUALITY_THRESHOLD}/100). Revisions needed.*`;
  } else {
    output += `\n*Article passes quality threshold. Ready for preview.*`;
  }

  return output;
}

/**
 * Generate revision instructions based on quality review
 */
export function generateRevisionInstructions(review: QualityScore): string {
  if (review.passesThreshold) {
    return "";
  }

  const criticalIssues = review.issues.filter((i) => i.severity === "critical");
  const majorIssues = review.issues.filter((i) => i.severity === "major");

  let instructions = "REVISION REQUIRED - Fix these issues:\n\n";

  if (criticalIssues.length > 0) {
    instructions += "CRITICAL (must fix):\n";
    criticalIssues.forEach((issue, i) => {
      instructions += `${i + 1}. ${issue.description}\n   Fix: ${issue.suggestion}\n`;
    });
    instructions += "\n";
  }

  if (majorIssues.length > 0) {
    instructions += "MAJOR (should fix):\n";
    majorIssues.forEach((issue, i) => {
      instructions += `${i + 1}. ${issue.description}\n   Fix: ${issue.suggestion}\n`;
    });
  }

  // Add specific guidance based on scores
  if (review.breakdown.dataQuality < 70) {
    instructions += "\nDATA: Replace ALL placeholder text with real statistics from sources. Every claim needs a number.\n";
  }

  if (review.breakdown.sourceAttribution < 70) {
    instructions += "\nSOURCES: Use natural citations like 'According to Skills for Care...' instead of [1] style brackets. Add a ## Sources section.\n";
  }

  if (review.breakdown.depth < 70) {
    instructions += "\nDEPTH: Add analysis - don't just report facts, explain what they mean and their implications for the care sector.\n";
  }

  if (review.breakdown.formatting < 70) {
    instructions += "\nFORMATTING: Ensure YAML frontmatter is complete with all required fields (title, slug, excerpt, publishedAt, category, readTime, author, tags).\n";
  }

  if (review.breakdown.britishEnglish < 70) {
    instructions += "\nLANGUAGE: Use British English spellings (analyse, organisation, recognise) and UK social care terminology (care home not nursing home).\n";
  }

  return instructions;
}

/**
 * Quick validation check for article format
 * Use this before full quality review
 */
export function quickValidateArticle(markdown: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check for frontmatter
  const frontmatterMatch = markdown.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    errors.push("Missing YAML frontmatter (content between --- markers)");
    return { valid: false, errors };
  }

  const frontmatter = frontmatterMatch[1];

  // Check required fields
  if (!frontmatter.includes("title:")) errors.push("Missing title");
  if (!frontmatter.includes("slug:")) errors.push("Missing slug");
  if (!frontmatter.includes("excerpt:")) errors.push("Missing excerpt");
  if (!frontmatter.includes("publishedAt:")) errors.push("Missing publishedAt");
  if (!frontmatter.includes("category:")) errors.push("Missing category");
  if (!frontmatter.includes("readTime:")) errors.push("Missing readTime");
  if (!frontmatter.includes("author:")) errors.push("Missing author");
  if (!frontmatter.includes("tags:")) errors.push("Missing tags");

  // Check content length
  const content = markdown.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, "");
  if (content.length < 200) {
    errors.push("Article content too short (minimum 200 characters)");
  }

  // Check for Sources section
  if (!markdown.includes("## Sources")) {
    errors.push("Missing Sources section");
  }

  return { valid: errors.length === 0, errors };
}
