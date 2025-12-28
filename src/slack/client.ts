import { WebClient } from '@slack/web-api';

// Initialize Slack client
export const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);

let botUserId: string | null = null;

/**
 * Get the bot's user ID (cached)
 */
export async function getBotId(): Promise<string> {
  if (botUserId) return botUserId;

  const authResult = await slackClient.auth.test();
  botUserId = authResult.user_id as string;
  return botUserId;
}

/**
 * Verify request is from Slack
 */
export async function verifySlackRequest(request: Request, rawBody: string): Promise<void> {
  const timestamp = request.headers.get('x-slack-request-timestamp');
  const signature = request.headers.get('x-slack-signature');

  if (!timestamp || !signature) {
    throw new Error('Missing Slack verification headers');
  }

  // Check timestamp is recent (within 5 minutes)
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - parseInt(timestamp)) > 300) {
    throw new Error('Request timestamp too old');
  }

  // Verify signature
  const crypto = await import('crypto');
  const signingSecret = process.env.SLACK_SIGNING_SECRET!;
  const sigBasestring = `v0:${timestamp}:${rawBody}`;
  const mySignature =
    'v0=' +
    crypto
      .createHmac('sha256', signingSecret)
      .update(sigBasestring, 'utf8')
      .digest('hex');

  if (signature !== mySignature) {
    throw new Error('Invalid request signature');
  }
}

/**
 * Check if bot is in a thread
 */
export async function isBotInThread(
  channel: string,
  threadTs: string,
  botId: string
): Promise<boolean> {
  try {
    const result = await slackClient.conversations.replies({
      channel,
      ts: threadTs,
      limit: 100,
    });

    return result.messages?.some((msg) => msg.user === botId) || false;
  } catch (error) {
    console.error('Error checking thread participation:', error);
    return false;
  }
}

/**
 * Get thread messages for context
 */
export async function getThreadMessages(
  channel: string,
  threadTs: string
): Promise<any[]> {
  try {
    const result = await slackClient.conversations.replies({
      channel,
      ts: threadTs,
      limit: 50,
    });

    return result.messages || [];
  } catch (error) {
    console.error('Error fetching thread:', error);
    return [];
  }
}
