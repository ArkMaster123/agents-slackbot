import type { SlackEvent } from '@slack/types';
import { slackClient, getBotId, verifySlackRequest, getThreadMessages } from '../src/slack/client.js';
import { Orchestrator } from '../src/agents/orchestrator/Orchestrator.js';
import type { AgentContext } from '../src/agents/base/types.js';
import type Anthropic from '@anthropic-ai/sdk';

export const config = {
  runtime: 'nodejs22.x',
};

export default async function handler(request: Request) {
  const rawBody = await request.text();
  const payload = JSON.parse(rawBody);

  // URL verification challenge
  if (payload.type === 'url_verification') {
    return new Response(payload.challenge, { status: 200 });
  }

  // Verify request is from Slack
  try {
    await verifySlackRequest(request, rawBody);
  } catch (error: any) {
    console.error('Slack verification failed:', error);
    return new Response('Unauthorized', { status: 401 });
  }

  const event = payload.event as SlackEvent;
  const botUserId = await getBotId();

  // Handle different event types
  try {
    // App mentions
    if (event.type === 'app_mention') {
      handleAppMention(event, botUserId);
    }

    // Direct messages
    if (
      event.type === 'message' &&
      !event.subtype &&
      event.channel_type === 'im' &&
      !event.bot_id &&
      event.user !== botUserId
    ) {
      handleDirectMessage(event, botUserId);
    }

    // Thread replies
    if (
      event.type === 'message' &&
      !event.subtype &&
      event.channel_type === 'channel' &&
      event.thread_ts &&
      !event.bot_id &&
      event.user !== botUserId
    ) {
      handleThreadReply(event, botUserId);
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Error handling event:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

/**
 * Handle @mentions in channels
 */
async function handleAppMention(event: any, botUserId: string) {
  const { channel, text, thread_ts, ts, user } = event;

  // Post initial thinking message
  const thinkingMsg = await slackClient.chat.postMessage({
    channel,
    thread_ts: thread_ts || ts,
    text: '🤔 Routing to the right specialist...',
  });

  try {
    // Get thread context if in a thread
    const threadMessages = thread_ts
      ? await getThreadMessages(channel, thread_ts)
      : [];

    // Build conversation context
    const messages = buildMessages(threadMessages, text, botUserId);

    // Create agent context
    const context: AgentContext = {
      userId: user,
      threadId: thread_ts || ts,
      channelId: channel,
      messages,
    };

    // Orchestrate the request
    const orchestrator = new Orchestrator();
    const response = await orchestrator.handle(context);

    // Update thinking message with response
    await slackClient.chat.update({
      channel,
      ts: thinkingMsg.ts!,
      text: response.text,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: response.text,
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
async function handleDirectMessage(event: any, botUserId: string) {
  const { channel, text, user } = event;

  // Post thinking message
  const thinkingMsg = await slackClient.chat.postMessage({
    channel,
    text: '👋 Maven is thinking...',
  });

  try {
    // Build messages
    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: text,
      },
    ];

    // Create agent context
    const context: AgentContext = {
      userId: user,
      threadId: channel,
      channelId: channel,
      messages,
    };

    // Orchestrate
    const orchestrator = new Orchestrator();
    const response = await orchestrator.handle(context);

    // Update message
    await slackClient.chat.update({
      channel,
      ts: thinkingMsg.ts!,
      text: response.text,
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
async function handleThreadReply(event: any, botUserId: string) {
  const { channel, text, thread_ts, user } = event;

  // Check if bot is in this thread
  const { isBotInThread } = await import('../src/slack/client.js');
  const inThread = await isBotInThread(channel, thread_ts, botUserId);

  if (!inThread) return; // Don't respond to threads we're not part of

  // Post thinking message
  const thinkingMsg = await slackClient.chat.postMessage({
    channel,
    thread_ts,
    text: '🤔 Processing...',
  });

  try {
    // Get thread context
    const threadMessages = await getThreadMessages(channel, thread_ts);

    // Build messages
    const messages = buildMessages(threadMessages, text, botUserId);

    // Create context
    const context: AgentContext = {
      userId: user,
      threadId: thread_ts,
      channelId: channel,
      messages,
    };

    // Orchestrate
    const orchestrator = new Orchestrator();
    const response = await orchestrator.handle(context);

    // Update message
    await slackClient.chat.update({
      channel,
      ts: thinkingMsg.ts!,
      text: response.text,
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
 * Build Anthropic messages from Slack thread
 */
function buildMessages(
  threadMessages: any[],
  currentText: string,
  botUserId: string
): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = [];

  // Add thread history
  for (const msg of threadMessages) {
    if (msg.bot_id || msg.subtype) continue; // Skip bot messages and system messages

    const role = msg.user === botUserId ? 'assistant' : 'user';
    const content = msg.text || '';

    // Remove bot mention
    const cleanContent = content.replace(/<@[A-Z0-9]+>/g, '').trim();

    if (cleanContent) {
      messages.push({ role, content: cleanContent });
    }
  }

  // Add current message if not already in thread
  const currentClean = currentText.replace(/<@[A-Z0-9]+>/g, '').trim();
  if (currentClean && !messages.some((m) => m.content === currentClean)) {
    messages.push({ role: 'user', content: currentClean });
  }

  return messages;
}
