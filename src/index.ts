import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { slackClient, getBotId, verifySlackRequest, getThreadMessages, isBotInThread } from './slack/client.js';
import { Orchestrator } from './agents/orchestrator/Orchestrator.js';
import type { SlackEvent } from '@slack/types';
import 'dotenv/config';

const PORT = process.env.PORT || 3000;

// Create orchestrator instance
const orchestrator = new Orchestrator();

// Type for dependencies
interface Deps {
  slackClient: typeof slackClient;
  getThreadMessages: typeof getThreadMessages;
  handleRequest: (context: any) => Promise<any>;
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
    text: '🤔 Routing to the right specialist...',
  });

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

    const agentEmoji = getAgentEmoji(response.agent);
    const agentName = getAgentName(response.agent);
    const formattedText = `${agentEmoji} *${agentName}*\n\n${response.text}`;

    await slackClient.chat.update({
      channel,
      ts: thinkingMsg.ts!,
      text: formattedText,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: formattedText,
          },
        },
      ],
    });
  } catch (error: any) {
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
    text: '👋 Thinking...',
  });

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

    const agentEmoji = getAgentEmoji(response.agent);
    const agentName = getAgentName(response.agent);
    const formattedText = `${agentEmoji} *${agentName}*\n\n${response.text}`;

    await slackClient.chat.update({
      channel,
      ts: thinkingMsg.ts!,
      text: formattedText,
    });
  } catch (error: any) {
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
    text: '🤔 Processing...',
  });

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

    const agentEmoji = getAgentEmoji(response.agent);
    const agentName = getAgentName(response.agent);
    const formattedText = `${agentEmoji} *${agentName}*\n\n${response.text}`;

    await slackClient.chat.update({
      channel,
      ts: thinkingMsg.ts!,
      text: formattedText,
    });
  } catch (error: any) {
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

      const handleAgentRequest = async (context: any) => orchestrator.handle(context);
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
