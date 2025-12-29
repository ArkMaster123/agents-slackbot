You can integrate OpenRouter with Claude Agent SDK by configuring it to use OpenRouter's Anthropic-compatible endpoint. Here's how to set it up:

## Environment Variables Setup

Configure these environment variables to redirect the Claude Agent SDK to OpenRouter [^1]:

```bash
# Set these in your shell (e.g., ~/.bashrc, ~/.zshrc)
export ANTHROPIC_BASE_URL="https://openrouter.ai/api"
export ANTHROPIC_API_KEY="your-openrouter-api-key"
```

## Alternative Configuration Methods

### Shell Profile Configuration

Add the environment variables to your shell profile for persistence [^1]:

```bash
# Add to ~/.bashrc, ~/.zshrc, or ~/.config/fish/config.fish
export ANTHROPIC_BASE_URL="https://openrouter.ai/api"
export ANTHROPIC_API_KEY="your-openrouter-api-key"
```

### Project-Level Configuration

Create a configuration file at your project root [^1]:

```json
// .claude/settings.local.json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://openrouter.ai/api",
    "ANTHROPIC_API_KEY": "your-openrouter-api-key"
  }
}
```

## How It Works

OpenRouter provides an Anthropic-compatible API endpoint that allows the Claude Agent SDK to work seamlessly [^1]:

- **Direct Connection**: When you set `ANTHROPIC_BASE_URL` to `https://openrouter.ai/api`, the SDK communicates directly with OpenRouter using its native protocol
- **Anthropic Compatibility**: OpenRouter's "Anthropic Skin" behaves exactly like the Anthropic API, handling model mapping and advanced features
- **Billing**: You're billed using your OpenRouter credits, and usage appears in your OpenRouter dashboard

## Using Different Models

You can configure the SDK to use any model available on OpenRouter by setting model override environment variables [^1]:

```bash
# Use GPT models instead of Claude
export ANTHROPIC_DEFAULT_SONNET_MODEL="openai/gpt-4o"
export ANTHROPIC_DEFAULT_OPUS_MODEL="openai/gpt-4o-2024-11-20"
export ANTHROPIC_DEFAULT_HAIKU_MODEL="openai/gpt-4o-mini"
```

**Important**: Make sure the models you choose support tool use capabilities, as the Claude Agent SDK requires this for proper functionality [^1].

## Verification

After setup, you can verify the connection by checking your OpenRouter Activity Dashboard at [openrouter.ai/activity](https://openrouter.ai/activity) to see requests appearing in real-time [^1].

This configuration allows you to use OpenRouter's extensive model catalog while keeping your existing Claude Agent SDK code unchanged.

[^1]: https://openrouter.ai/docs/guides/guides/claude-code-integration