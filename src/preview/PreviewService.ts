/**
 * Preview Service - Create shareable links for long responses
 * 
 * For CareScope articles (Chronicle agent):
 *   → Uses CareScope Intel's preview API (Vercel KV, 24hr TTL)
 *   → Renders with full CareScope styling and interactive components
 * 
 * For general long responses (other agents):
 *   → Uses local in-memory storage (1hr TTL)
 *   → Renders with simple dark-themed HTML
 */

import crypto from 'crypto';

// ============ CARESCOPE PREVIEW API ============
// For article content from Chronicle agent

const CARESCOPE_PREVIEW_API_URL = "https://www.carescopeintel.com/api/preview";

interface CareScopePreviewMetadata {
  createdBy?: string;
  title?: string;
  slackChannel?: string;
  slackUser?: string;
}

interface CareScopePreviewResult {
  success: true;
  id: string;
  url: string;
  expiresIn: string;
}

interface CareScopePreviewError {
  success: false;
  error: string;
  details?: string[];
}

export type CareScopePreviewResponse = CareScopePreviewResult | CareScopePreviewError;

/**
 * Create an article preview on CareScope Intel
 * Used by Chronicle agent for properly formatted news articles
 * Returns a shareable URL that expires in 24 hours
 * 
 * IMPORTANT: The markdown MUST follow CareScope article format:
 * - YAML frontmatter with title, slug, excerpt, publishedAt, category, readTime, author, tags
 * - Key Data Summary table
 * - Sources section
 * - Optionally: ukmap, timeline, faq, checklist components
 */
export async function createCareScopePreview(
  markdown: string,
  metadata?: CareScopePreviewMetadata,
): Promise<CareScopePreviewResponse> {
  const secret = process.env.PREVIEW_API_SECRET;

  if (!secret) {
    return {
      success: false,
      error: "PREVIEW_API_SECRET environment variable is not set",
    };
  }

  try {
    const response = await fetch(CARESCOPE_PREVIEW_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        markdown,
        metadata: {
          ...metadata,
          createdBy: metadata?.createdBy || "agenticators-bot",
        },
      }),
    });

    const data = await response.json() as {
      id?: string;
      url?: string;
      expiresIn?: string;
      error?: string;
      details?: string[];
      exists?: boolean;
    };

    if (response.status === 401) {
      return {
        success: false,
        error: "Unauthorized - invalid PREVIEW_API_SECRET",
      };
    }

    if (response.status === 400) {
      return {
        success: false,
        error: "Invalid article format",
        details: data.details || [data.error || "Unknown error"],
      };
    }

    if (!response.ok) {
      return {
        success: false,
        error: data.error || "Failed to create preview",
      };
    }

    return {
      success: true,
      id: data.id || "",
      url: data.url || "",
      expiresIn: data.expiresIn || "24 hours",
    };
  } catch (error) {
    return {
      success: false,
      error: `Network error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Check if a CareScope preview exists (hasn't expired)
 */
export async function checkCareScopePreviewExists(id: string): Promise<boolean> {
  try {
    const response = await fetch(`${CARESCOPE_PREVIEW_API_URL}?id=${id}`);
    const data = await response.json() as { exists?: boolean };
    return data.exists === true;
  } catch {
    return false;
  }
}


// ============ LOCAL PREVIEW (FALLBACK) ============
// For general long responses from non-Chronicle agents

interface LocalPreviewData {
  id: string;
  content: string;
  agent: string;
  title: string;
  createdAt: Date;
  expiresAt: Date;
}

// In-memory store for local previews
const localPreviews = new Map<string, LocalPreviewData>();

// Clean up expired previews periodically
setInterval(() => {
  const now = new Date();
  for (const [id, data] of localPreviews) {
    if (data.expiresAt < now) {
      localPreviews.delete(id);
    }
  }
}, 60000); // Every minute

function generateId(): string {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Create a local in-memory preview
 * Used for general long responses (non-article content)
 */
export function createLocalPreview(
  content: string,
  agent: string,
  title?: string,
  ttlMinutes: number = 60
): { id: string; url: string; expiresIn: string } {
  const id = generateId();
  const now = new Date();
  const baseUrl = process.env.BASE_URL || 'https://slackbot.bornandbrand.com';
  
  localPreviews.set(id, {
    id,
    content,
    agent,
    title: title || `${agent} Response`,
    createdAt: now,
    expiresAt: new Date(now.getTime() + ttlMinutes * 60000),
  });
  
  return {
    id,
    url: `${baseUrl}/preview/${id}`,
    expiresIn: `${ttlMinutes} minutes`,
  };
}

/**
 * Get local preview by ID
 */
export function getLocalPreview(id: string): LocalPreviewData | null {
  const data = localPreviews.get(id);
  if (!data) return null;
  
  if (data.expiresAt < new Date()) {
    localPreviews.delete(id);
    return null;
  }
  
  return data;
}


// ============ CONVENIENCE FUNCTIONS ============

/**
 * Create preview - routes to CareScope API for articles, local for general responses
 */
export async function createPreview(
  content: string,
  agent: string,
  title?: string,
  isArticle: boolean = false
): Promise<string> {
  // For Chronicle articles, use CareScope preview API
  if (isArticle || agent.toLowerCase() === 'chronicle') {
    const result = await createCareScopePreview(content, { 
      title, 
      createdBy: `agenticators-${agent}` 
    });
    
    if (result.success) {
      return result.url;
    }
    
    // If CareScope API fails, fall back to local
    console.warn("CareScope preview failed, using local:", result.error);
  }
  
  // For other agents, use local preview
  const local = createLocalPreview(content, agent, title);
  return local.url;
}

/**
 * Legacy compatibility - get preview by ID (local only)
 */
export function getPreview(id: string): LocalPreviewData | null {
  return getLocalPreview(id);
}

/**
 * Legacy compatibility - get preview URL
 */
export function getPreviewUrl(id: string): string {
  const baseUrl = process.env.BASE_URL || 'https://slackbot.bornandbrand.com';
  return `${baseUrl}/preview/${id}`;
}

/**
 * Generate HTML page for local preview
 */
export function renderPreviewHtml(data: LocalPreviewData): string {
  const agentEmojis: Record<string, string> = {
    scout: '🔍',
    sage: '🧙',
    chronicle: '✍️',
    maven: '👋',
    trends: '📈',
  };
  
  const emoji = agentEmojis[data.agent.toLowerCase()] || '🤖';
  
  // Convert markdown to HTML
  const htmlContent = data.content
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^- (.+)$/gm, '<li>$1</li>');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>${emoji} ${data.title} - Agenticators</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      color: #e0e0e0;
      line-height: 1.7;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }
    header {
      text-align: center;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #333;
    }
    .agent-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(255,255,255,0.1);
      padding: 0.5rem 1rem;
      border-radius: 20px;
      font-size: 0.9rem;
      margin-bottom: 1rem;
    }
    h1 { font-size: 1.5rem; color: #fff; margin-bottom: 0.5rem; }
    .meta { font-size: 0.8rem; color: #888; }
    .content {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 2rem;
    }
    .content p { margin-bottom: 1rem; }
    .content strong { color: #4fc3f7; }
    .content code {
      background: rgba(0,0,0,0.3);
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.9em;
    }
    .content ul { margin: 1rem 0; padding-left: 1.5rem; }
    .content li { margin: 0.5rem 0; }
    .content a { color: #4fc3f7; text-decoration: none; }
    .content a:hover { text-decoration: underline; }
    footer {
      text-align: center;
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid #333;
      font-size: 0.8rem;
      color: #666;
    }
    .copy-btn {
      background: #4fc3f7;
      color: #000;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
      margin-top: 1.5rem;
      font-weight: 500;
    }
    .copy-btn:hover { background: #29b6f6; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="agent-badge">${emoji} ${data.agent}</div>
      <h1>${data.title}</h1>
      <div class="meta">
        Generated ${data.createdAt.toLocaleString()} • 
        Expires in ${Math.max(0, Math.round((data.expiresAt.getTime() - Date.now()) / 60000))} minutes
      </div>
    </header>
    <div class="content">
      <p>${htmlContent}</p>
    </div>
    <div style="text-align: center;">
      <button class="copy-btn" onclick="navigator.clipboard.writeText(document.querySelector('.content').innerText).then(() => this.innerText='✓ Copied!')">
        Copy to Clipboard
      </button>
    </div>
    <footer>
      Powered by Agenticators 🤖
    </footer>
  </div>
</body>
</html>`;
}
