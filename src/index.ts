import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { slackClient, getBotId, verifySlackRequest, getThreadMessages, isBotInThread } from './slack/client.js';
import { handleRequest as sdkHandleRequest } from './agents/sdk/SdkOrchestrator.js';
import type { SlackEvent } from '@slack/types';
import 'dotenv/config';

const PORT = process.env.PORT || 3000;

console.log('🤖 Using Claude Agent SDK Orchestrator with MCP tools');

// Animated thinking messages with color-like effect using emojis
const THINKING_FRAMES = [
  '🟣 *Thinking*...',
  '🔵 *Thinking.*..',
  '🟢 *Thinking..*.',
  '🟡 *Thinking...*',
  '🟠 *Thinking*...',
  '🔴 *Thinking.*..', 
  '🟣 *Processing*...',
  '🔵 *Processing.*..', 
  '🟢 *Processing..*.',
  '🟡 *Processing...*',
  '🟠 *Analyzing*...',
  '🔴 *Analyzing.*..', 
  '🟣 *Researching*...',
  '🔵 *Researching.*..', 
  '🟢 *Crafting response*...',
  '🟡 *Almost there*...',
];

/**
 * Animated thinking indicator that updates the message while processing
 */
function startThinkingAnimation(
  channel: string,
  ts: string,
  slackClient: any
): { stop: () => void } {
  let frameIndex = 0;
  let stopped = false;

  const interval = setInterval(async () => {
    if (stopped) return;
    
    try {
      await slackClient.chat.update({
        channel,
        ts,
        text: THINKING_FRAMES[frameIndex % THINKING_FRAMES.length],
      });
      frameIndex++;
    } catch (e) {
      // Ignore rate limiting errors
    }
  }, 800); // Update every 800ms

  return {
    stop: () => {
      stopped = true;
      clearInterval(interval);
    },
  };
}

// Type for dependencies
interface Deps {
  slackClient: typeof slackClient;
  getThreadMessages: typeof getThreadMessages;
  handleRequest: (context: any, options?: any) => Promise<any>;
  isBotInThread: typeof isBotInThread;
}

/**
 * Get agent emoji by role
 */
function getAgentEmoji(agent: string): string {
  const emojis: Record<string, string> = {
    scout: '🔍',
    sage: '🧙',
    chronicle: '✍️',
    maven: '👋',
    trends: '📈',
  };
  return emojis[agent] || '🤖';
}

/**
 * Get agent display name by role
 */
function getAgentName(agent: string): string {
  const names: Record<string, string> = {
    scout: 'Scout',
    sage: 'Sage',
    chronicle: 'Chronicle',
    maven: 'Maven',
    trends: 'Trends',
  };
  return names[agent] || 'Agent';
}

/**
 * Truncate response to fit Slack's message limit
 * Slack has a ~4000 char limit for messages, we use 3500 to be safe
 */
function truncateForSlack(text: string, maxLength: number = 3500): string {
  if (text.length <= maxLength) return text;
  
  // Try to cut at a natural break point
  const truncated = text.slice(0, maxLength);
  const lastNewline = truncated.lastIndexOf('\n');
  const lastPeriod = truncated.lastIndexOf('. ');
  
  // Find the best cut point
  const cutPoint = Math.max(lastNewline, lastPeriod);
  const finalText = cutPoint > maxLength * 0.7 
    ? truncated.slice(0, cutPoint + 1) 
    : truncated;
  
  return finalText + '\n\n_...response truncated for Slack_';
}

/**
 * Build Anthropic messages from Slack thread
 */
function buildMessages(
  threadMessages: any[],
  currentText: string,
  botUserId: string
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  for (const msg of threadMessages) {
    if (msg.bot_id || msg.subtype) continue;

    const role: 'user' | 'assistant' = msg.user === botUserId ? 'assistant' : 'user';
    const content = msg.text || '';
    const cleanContent = content.replace(/<@[A-Z0-9]+>/g, '').trim();

    if (cleanContent) {
      messages.push({ role, content: cleanContent });
    }
  }

  const currentClean = currentText.replace(/<@[A-Z0-9]+>/g, '').trim();
  if (currentClean && !messages.some((m) => m.content === currentClean)) {
    messages.push({ role: 'user', content: currentClean });
  }

  return messages;
}

/**
 * Handle @mentions in channels
 */
async function handleAppMention(event: any, botUserId: string, deps: Deps) {
  const { slackClient, getThreadMessages, handleRequest } = deps;
  const { channel, text, thread_ts, ts, user } = event;

  const thinkingMsg = await slackClient.chat.postMessage({
    channel,
    thread_ts: thread_ts || ts,
    text: '🟣 *Thinking*...',
  });

  // Start the animated thinking indicator
  const animation = startThinkingAnimation(channel, thinkingMsg.ts!, slackClient);

  try {
    const threadMessages = thread_ts
      ? await getThreadMessages(channel, thread_ts)
      : [];

    const messages = buildMessages(threadMessages, text, botUserId);

    const context = {
      userId: user,
      threadId: thread_ts || ts,
      channelId: channel,
      messages,
    };

    const response = await handleRequest(context);

    // Stop animation before updating with response
    animation.stop();

    // Truncate response if too long for Slack
    const truncatedText = truncateForSlack(response.text);

    // SDK Orchestrator already formats with emoji and agent name
    await slackClient.chat.update({
      channel,
      ts: thinkingMsg.ts!,
      text: truncatedText,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: truncatedText,
          },
        },
      ],
    });
  } catch (error: any) {
    animation.stop();
    console.error('Error in handleAppMention:', error);

    await slackClient.chat.update({
      channel,
      ts: thinkingMsg.ts!,
      text: `⚠️ Oops, something went wrong! ${error.message}`,
    });
  }
}

/**
 * Handle direct messages
 */
async function handleDirectMessage(event: any, botUserId: string, deps: Deps) {
  const { slackClient, handleRequest } = deps;
  const { channel, text, user } = event;

  const thinkingMsg = await slackClient.chat.postMessage({
    channel,
    text: '🟣 *Thinking*...',
  });

  // Start the animated thinking indicator
  const animation = startThinkingAnimation(channel, thinkingMsg.ts!, slackClient);

  try {
    const messages = [
      {
        role: 'user' as const,
        content: text,
      },
    ];

    const context = {
      userId: user,
      threadId: channel,
      channelId: channel,
      messages,
    };

    const response = await handleRequest(context);

    // Stop animation before updating with response
    animation.stop();

    // Truncate response if too long for Slack
    const truncatedText = truncateForSlack(response.text);

    // SDK Orchestrator already formats with emoji and agent name
    await slackClient.chat.update({
      channel,
      ts: thinkingMsg.ts!,
      text: truncatedText,
    });
  } catch (error: any) {
    animation.stop();
    console.error('Error in handleDirectMessage:', error);

    await slackClient.chat.update({
      channel,
      ts: thinkingMsg.ts!,
      text: `⚠️ Something went wrong: ${error.message}`,
    });
  }
}

/**
 * Handle thread replies
 */
async function handleThreadReply(event: any, botUserId: string, deps: Deps) {
  const { slackClient, getThreadMessages, handleRequest, isBotInThread } = deps;
  const { channel, text, thread_ts, user } = event;

  const inThread = await isBotInThread(channel, thread_ts, botUserId);
  if (!inThread) return;

  const thinkingMsg = await slackClient.chat.postMessage({
    channel,
    thread_ts,
    text: '🟣 *Thinking*...',
  });

  // Start the animated thinking indicator
  const animation = startThinkingAnimation(channel, thinkingMsg.ts!, slackClient);

  try {
    const threadMessages = await getThreadMessages(channel, thread_ts);
    const messages = buildMessages(threadMessages, text, botUserId);

    const context = {
      userId: user,
      threadId: thread_ts,
      channelId: channel,
      messages,
    };

    const response = await handleRequest(context);

    // Stop animation before updating with response
    animation.stop();

    // Truncate response if too long for Slack
    const truncatedText = truncateForSlack(response.text);

    // SDK Orchestrator already formats with emoji and agent name
    await slackClient.chat.update({
      channel,
      ts: thinkingMsg.ts!,
      text: truncatedText,
    });
  } catch (error: any) {
    animation.stop();
    console.error('Error in handleThreadReply:', error);

    await slackClient.chat.update({
      channel,
      ts: thinkingMsg.ts!,
      text: `⚠️ Error: ${error.message}`,
    });
  }
}

/**
 * Read request body
 */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

/**
 * Main request handler
 */
async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  
  // Health check endpoint
  if (url.pathname === '/' || url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'agenticators' }));
    return;
  }

  // Slack events endpoint
  if (url.pathname === '/api/events' && req.method === 'POST') {
    try {
      const rawBody = await readBody(req);
      const payload = JSON.parse(rawBody);
      const requestType = payload.type as 'url_verification' | 'event_callback';

      // URL verification challenge
      if (requestType === 'url_verification') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(payload.challenge);
        return;
      }

      // Verify Slack signature (create a mock Request object)
      const mockRequest = {
        headers: new Headers(req.headers as Record<string, string>),
      } as Request;

      try {
        await verifySlackRequest(mockRequest, rawBody);
      } catch (error: any) {
        console.error('Slack verification failed:', error);
        res.writeHead(401, { 'Content-Type': 'text/plain' });
        res.end('Unauthorized');
        return;
      }

      const event = payload.event as SlackEvent;
      const botUserId = await getBotId();

      // Use SDK Orchestrator with MCP tools
      const handleAgentRequest = async (context: any, options?: any) => sdkHandleRequest(context, options);
      const deps: Deps = { slackClient, getThreadMessages, handleRequest: handleAgentRequest, isBotInThread };

      // Respond immediately, process in background
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');

      // Process events in background (don't await)
      if (event.type === 'app_mention') {
        handleAppMention(event, botUserId, deps).catch(console.error);
      }

      if (
        event.type === 'message' &&
        !event.subtype &&
        event.channel_type === 'im' &&
        !event.bot_id &&
        event.user !== botUserId
      ) {
        handleDirectMessage(event, botUserId, deps).catch(console.error);
      }

      if (
        event.type === 'message' &&
        !event.subtype &&
        event.channel_type === 'channel' &&
        event.thread_ts &&
        !event.bot_id &&
        event.user !== botUserId
      ) {
        handleThreadReply(event, botUserId, deps).catch(console.error);
      }

      return;
    } catch (error) {
      console.error('Error handling event:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
      return;
    }
  }

  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
}

// Create and start server
const server = createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`🚀 Agenticators server running on port ${PORT}`);
  console.log(`📡 Slack events endpoint: http://localhost:${PORT}/api/events`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
