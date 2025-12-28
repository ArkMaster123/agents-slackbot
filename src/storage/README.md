# Storage Layer

Conversation memory and context management for the multi-agent Slack bot.

## Current Implementation: In-Memory

The current implementation uses in-memory storage with automatic cleanup.

### Features

- **Thread-based memory**: Each Slack thread maintains its own conversation context
- **Message history**: Stores up to 50 messages per thread (with smart trimming)
- **Agent continuity**: Remembers which agent is handling each thread
- **Agent-specific data**: Each agent can store custom data per thread
- **Auto-cleanup**: Expires conversations after 2 hours of inactivity
- **Memory limits**: Prevents unbounded memory growth

### Usage

```typescript
import { conversationMemory } from './storage/ConversationMemory.js';

// Get or create context
const context = conversationMemory.getOrCreate(threadId, channelId, userId);

// Add message
conversationMemory.addMessage(threadId, 'user', 'Hello!');
conversationMemory.addMessage(threadId, 'assistant', 'Hi there!', 'maven');

// Get messages
const messages = conversationMemory.getMessages(threadId);

// Agent-specific data (e.g., Chronicle saving drafts)
conversationMemory.setAgentData(threadId, 'chronicle', {
  draft: articleMarkdown,
  sources: researchSources,
});

const chronicleData = conversationMemory.getAgentData(threadId, 'chronicle');
```

## Configuration

Current settings (in `ConversationMemory.ts`):

```typescript
TTL = 2 * 60 * 60 * 1000;        // 2 hours
MAX_MESSAGES = 50;                // Last 50 messages
MAX_TOKENS_ESTIMATE = 150000;     // ~150K tokens
```

### Context Window Capacity

| Agent | Model | Context Window | Max Messages |
|-------|-------|----------------|--------------|
| Maven | Haiku | 200K tokens | ~50 msgs |
| Scout | Sonnet 3.5 | 200K tokens | ~50 msgs |
| Sage | Opus | 200K tokens | ~50 msgs |
| Chronicle | Sonnet 3.5 | 200K tokens | ~50 msgs |

**Estimated Token Usage**:
- Average message: ~100-500 tokens
- 50 messages: ~5,000-25,000 tokens
- Well within context limits for all agents

## Future: Redis/Upstash Implementation

For production with multiple instances, upgrade to Redis:

### Why Redis?

- **Distributed**: Works across multiple Vercel instances
- **Persistence**: Survives deployments and restarts
- **TTL support**: Built-in expiration
- **Performance**: Fast key-value lookup

### Migration Path

1. Install Upstash Redis:
```bash
npm install @upstash/redis
```

2. Create Redis adapter:
```typescript
// src/storage/RedisMemory.ts
import { Redis } from '@upstash/redis';

export class RedisConversationMemory {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_URL!,
      token: process.env.UPSTASH_REDIS_TOKEN!,
    });
  }

  async getOrCreate(threadId: string, channelId: string, userId: string) {
    const key = `conversation:${threadId}`;
    const existing = await this.redis.get(key);

    if (existing) {
      return existing;
    }

    const context = {
      threadId,
      channelId,
      userId,
      messages: [],
      currentAgent: null,
      agentData: {},
      createdAt: Date.now(),
    };

    await this.redis.set(key, context, { ex: 7200 }); // 2 hour TTL
    return context;
  }

  async addMessage(threadId: string, role: string, content: string, agent?: string) {
    const key = `conversation:${threadId}`;
    const context = await this.redis.get(key);

    if (context) {
      context.messages.push({ role, content });
      if (agent) context.currentAgent = agent;

      await this.redis.set(key, context, { ex: 7200 });
    }
  }

  // ... other methods
}
```

3. Environment variables:
```bash
UPSTASH_REDIS_URL=https://your-redis.upstash.io
UPSTASH_REDIS_TOKEN=your-token
STORAGE_BACKEND=redis  # or 'memory'
```

4. Conditional initialization:
```typescript
// src/storage/index.ts
export const conversationMemory = process.env.STORAGE_BACKEND === 'redis'
  ? new RedisConversationMemory()
  : new ConversationMemory();
```

## Agent-Specific Memory

### Chronicle Article Drafts

Chronicle can save article drafts in thread context:

```typescript
// Save draft
conversationMemory.setAgentData(threadId, 'chronicle', {
  draft: articleMarkdown,
  sources: researchSources,
  title: 'Article Title',
  savedAt: Date.now(),
});

// Retrieve later
const chronicleData = conversationMemory.getAgentData(threadId, 'chronicle');
if (chronicleData.draft) {
  // Continue editing draft
}
```

### Scout Research Cache

Scout can cache company research:

```typescript
conversationMemory.setAgentData(threadId, 'scout', {
  companiesResearched: {
    'stripe.com': {
      data: companyData,
      fetchedAt: Date.now(),
    },
  },
});

// Check cache before researching
const scoutData = conversationMemory.getAgentData(threadId, 'scout');
if (scoutData.companiesResearched?.['stripe.com']) {
  // Use cached data if < 1 hour old
}
```

### Sage Analysis History

Sage can remember past analyses:

```typescript
conversationMemory.setAgentData(threadId, 'sage', {
  analyses: [
    {
      topic: 'AWS vs GCP comparison',
      recommendation: 'GCP for your use case',
      completedAt: Date.now(),
    },
  ],
});
```

## Memory Management

### Automatic Cleanup

In-memory implementation:
- Runs every 10 minutes
- Removes conversations inactive for 2+ hours
- Logs cleanup activity

### Manual Cleanup

Users can clear their conversation:

```typescript
// Via slash command: /clear
conversationMemory.clear(threadId);
```

### Memory Limits

Protection against memory exhaustion:

1. **Message limit**: Keep last 50 messages (trim older ones)
2. **Thread TTL**: Auto-expire after 2 hours
3. **Cleanup interval**: Regular garbage collection
4. **Token estimation**: Track approximate token usage

## Monitoring

Get memory statistics:

```typescript
const stats = conversationMemory.getStats();
// {
//   totalConversations: 42,
//   activeThreads: 12,
//   averageMessages: 8.5
// }
```

Useful for:
- Capacity planning
- Performance monitoring
- Cost estimation (API tokens)

## Best Practices

### For Agents

1. **Store smartly**: Only cache data worth reusing
2. **Set TTLs**: Use timestamps to expire cached data
3. **Keep it small**: Don't store large binary data
4. **Namespace keys**: Use agent name in data keys

### For Users

1. **Long conversations**: Memory auto-manages, no action needed
2. **Privacy**: Conversations auto-expire (not permanently stored)
3. **Fresh start**: Use `/clear` to reset conversation

## Troubleshooting

### "Agent doesn't remember context"

- Check `conversationMemory.getMessages(threadId)` returns messages
- Verify thread ID is consistent across messages
- Ensure messages are being added via `addMessage()`

### "Memory growing too large"

- Reduce `MAX_MESSAGES` (currently 50)
- Decrease `TTL` (currently 2 hours)
- Implement Redis for distributed memory

### "Lost context after deployment"

- Expected with in-memory storage
- Upgrade to Redis/Upstash for persistence
- Or accept that deploys reset conversations (users can restart)

## Future Enhancements

- [ ] Redis/Upstash adapter for production
- [ ] Per-agent memory limits
- [ ] User preference storage
- [ ] Cross-thread memory (e.g., "remember my company")
- [ ] Export conversation history
- [ ] Analytics on conversation patterns
