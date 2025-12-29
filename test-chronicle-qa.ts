#!/usr/bin/env tsx
/**
 * Test the Chronicle QA Agent
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import {
  reviewArticle,
  formatReviewForSlack,
  checkBritishEnglish,
  checkUKTerminology,
} from './src/agents/chronicle-qa/ChronicleQAAgent.js';

// Sample article with intentional issues for testing
const sampleArticle = `---
title: "CQC Inspection Failures Rise Dramatically in 2024"
slug: cqc-inspection-failures-2024
excerpt: "A new report reveals concerning trends in CQC inspection outcomes across England."
publishedAt: "2024-12-15"
category: "analysis"
readTime: 6
author:
  name: "Sarah Mitchell"
  role: "Senior Correspondent"
  avatar: "/images/authors/sarah.png"
featuredImage: "/images/cqc-inspections.jpg"
tags: [CQC, inspections, care homes]
---

The Care Quality Commission has released data showing a significant increase in "Requires Improvement" and "Inadequate" ratings for nursing homes across England in 2024.

## Key Statistics

According to the latest data:
- 23% of care homes now rated "Requires Improvement" (up from 18% in 2023)  
- 412 nursing homes rated "Inadequate" (up 15% year-on-year)
- Average inspection wait time now 3.2 years

## Regional Variations

The North West of England has seen the most significant decline, with 28% of services requiring improvement. The South East remains the best performing region.

## Key Data Summary

| Metric | 2023 | 2024 | Change |
|--------|------|------|--------|
| Requires Improvement | 18% | 23% | +5% |
| Inadequate ratings | 358 | 412 | +15% |
| Good/Outstanding | 78% | 72% | -6% |

## Expert Analysis

Industry experts have analyzed the data and recognize that staffing shortages are a key driver. Local government authorities are struggling to fund proper oversight.

Professor Jane Thompson, a healthcare analyst, told CareScope: "The care home sector is facing unprecedented challenges. We need to prioritize investment in caregivers."

## Sources

1. CQC Annual State of Care Report 2024
2. Skills for Care Workforce Data 2024
`;

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     ✍️  Chronicle QA Agent Test                             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Quick checks first
  console.log('=== Quick Checks (No API calls) ===\n');

  const britishIssues = checkBritishEnglish(sampleArticle);
  console.log(
    'British English Issues:',
    britishIssues.length > 0 ? britishIssues.join(', ') : 'None found'
  );

  const ukTermIssues = checkUKTerminology(sampleArticle);
  console.log(
    'UK Terminology Issues:',
    ukTermIssues.length > 0 ? ukTermIssues.join(', ') : 'None found'
  );

  console.log('\n=== Full Review (Claude SDK + Exa MCP) ===\n');

  const result = await reviewArticle(sampleArticle, {
    onStage: (stage, data) => {
      switch (stage) {
        case 'loading':
          console.log('📚 Loading skills...');
          break;
        case 'analyzing':
          console.log('🔍 Analyzing article...');
          break;
        case 'comparing':
          console.log('🔗 Comparing with existing articles...', data?.tool || '');
          break;
        case 'scoring':
          console.log('📊 Scoring...');
          break;
        case 'complete':
          console.log('✅ Review complete!\n');
          break;
      }
    },
    compareWithExisting: true,
  });

  console.log('=== Results Summary ===\n');
  console.log(`Overall Score: ${result.overallScore}/60 (${result.percentage}%)\n`);

  console.log('Dimension Scores:');
  for (const [dim, data] of Object.entries(result.dimensions)) {
    const paddedDim = dim.padEnd(18);
    console.log(`  ${paddedDim}: ${data.score}/10`);
  }

  if (result.criticalIssues.length > 0) {
    console.log('\nCritical Issues:');
    for (const issue of result.criticalIssues.slice(0, 5)) {
      console.log(`  - ${issue}`);
    }
  }

  if (result.britishEnglishCorrections.length > 0) {
    console.log('\nBritish English Corrections:');
    for (const correction of result.britishEnglishCorrections.slice(0, 5)) {
      console.log(`  - ${correction}`);
    }
  }

  if (result.improvements.length > 0) {
    console.log('\nTop Improvements:');
    for (const improvement of result.improvements.slice(0, 3)) {
      console.log(`  - ${improvement}`);
    }
  }

  console.log('\n=== Full Review ===\n');
  console.log(result.fullReview);

  console.log('\n=== Slack Format ===\n');
  console.log(formatReviewForSlack(result));
}

main().catch(console.error);
