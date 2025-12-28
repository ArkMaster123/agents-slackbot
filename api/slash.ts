import { verifySlackRequest } from '../src/slack/client.js';
import { formatTeamIntroduction } from '../src/slack/formatters.js';

export const config = {
  runtime: 'nodejs22.x',
};

export default async function handler(request: Request) {
  const rawBody = await request.text();

  // Verify request is from Slack
  try {
    await verifySlackRequest(request, rawBody);
  } catch (error) {
    return new Response('Unauthorized', { status: 401 });
  }

  const params = new URLSearchParams(rawBody);
  const command = params.get('command');
  const responseUrl = params.get('response_url');

  // Handle /team command
  if (command === '/team') {
    const teamIntro = formatTeamIntroduction();

    // Send immediate response
    return new Response(
      JSON.stringify({
        response_type: 'ephemeral',
        text: teamIntro,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: teamIntro,
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Handle /aisettings command
  if (command === '/aisettings') {
    return new Response(
      JSON.stringify({
        response_type: 'ephemeral',
        text: '⚙️ *AI Settings*\n\nCurrently using: Claude 3.5 Sonnet (default)\n\nTo change models or preferences, contact your workspace admin.',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '⚙️ *AI Settings*\n\nCurrently using: Claude 3.5 Sonnet (default)\n\nTo change models or preferences, contact your workspace admin.',
            },
          },
        ],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  return new Response('Command not found', { status: 404 });
}
