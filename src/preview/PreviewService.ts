/**
 * Preview Service - Store long responses and generate shareable links
 * 
 * Uses in-memory storage with TTL. For production, could use Redis/DB.
 */

import crypto from 'crypto';

interface PreviewData {
  id: string;
  content: string;
  agent: string;
  title: string;
  createdAt: Date;
  expiresAt: Date;
}

// In-memory store (for production, use Redis or a database)
const previews = new Map<string, PreviewData>();

// Clean up expired previews periodically
setInterval(() => {
  const now = new Date();
  for (const [id, data] of previews) {
    if (data.expiresAt < now) {
      previews.delete(id);
    }
  }
}, 60000); // Clean up every minute

/**
 * Generate a unique preview ID
 */
function generateId(): string {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Store content and return a preview ID
 */
export function createPreview(
  content: string,
  agent: string,
  title?: string,
  ttlMinutes: number = 60 // Default 1 hour TTL
): string {
  const id = generateId();
  const now = new Date();
  
  previews.set(id, {
    id,
    content,
    agent,
    title: title || `${agent} Response`,
    createdAt: now,
    expiresAt: new Date(now.getTime() + ttlMinutes * 60000),
  });
  
  return id;
}

/**
 * Get preview by ID
 */
export function getPreview(id: string): PreviewData | null {
  const data = previews.get(id);
  if (!data) return null;
  
  // Check expiration
  if (data.expiresAt < new Date()) {
    previews.delete(id);
    return null;
  }
  
  return data;
}

/**
 * Get preview URL
 */
export function getPreviewUrl(id: string): string {
  const baseUrl = process.env.BASE_URL || 'https://slackbot.bornandbrand.com';
  return `${baseUrl}/preview/${id}`;
}

/**
 * Generate HTML page for preview
 */
export function renderPreviewHtml(data: PreviewData): string {
  const agentEmojis: Record<string, string> = {
    scout: '🔍',
    sage: '🧙',
    chronicle: '✍️',
    maven: '👋',
    trends: '📈',
  };
  
  const emoji = agentEmojis[data.agent.toLowerCase()] || '🤖';
  
  // Convert markdown-ish content to HTML
  const htmlContent = data.content
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${emoji} ${data.title} - Agenticators</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      color: #e0e0e0;
      line-height: 1.6;
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
    h1 {
      font-size: 1.5rem;
      color: #fff;
      margin-bottom: 0.5rem;
    }
    .meta {
      font-size: 0.8rem;
      color: #888;
    }
    .content {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 2rem;
      white-space: pre-wrap;
    }
    .content p { margin-bottom: 1rem; }
    .content strong { color: #4fc3f7; }
    .content code {
      background: rgba(0,0,0,0.3);
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      font-family: monospace;
    }
    .content ul { margin: 1rem 0; padding-left: 1.5rem; }
    .content li { margin: 0.5rem 0; }
    a { color: #4fc3f7; }
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
      padding: 0.5rem 1rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
      margin-top: 1rem;
    }
    .copy-btn:hover { background: #29b6f6; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="agent-badge">${emoji} ${data.agent}</div>
      <h1>${data.title}</h1>
      <div class="meta">Generated ${data.createdAt.toLocaleString()} • Expires in ${Math.round((data.expiresAt.getTime() - Date.now()) / 60000)} minutes</div>
    </header>
    <div class="content">
      <p>${htmlContent}</p>
    </div>
    <div style="text-align: center;">
      <button class="copy-btn" onclick="navigator.clipboard.writeText(document.querySelector('.content').innerText); this.innerText='Copied!';">Copy to Clipboard</button>
    </div>
    <footer>
      Powered by Agenticators 🤖
    </footer>
  </div>
</body>
</html>`;
}
