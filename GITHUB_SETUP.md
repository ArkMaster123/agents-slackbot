# Push to GitHub

Your new `agents-slackbot` repo is ready to push! Follow these steps:

## Option 1: Create Repo via GitHub Web (Easiest)

### 1. Create the Repository

1. Go to https://github.com/new
2. Repository name: `agents-slackbot`
3. Description: "Multi-agent Slack bot with Scout, Sage, Chronicle, and Maven - powered by Claude Agent SDK"
4. **Keep it Public or Private** (your choice)
5. **DO NOT** initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

### 2. Push Your Code

GitHub will show you commands. Use these:

```bash
cd /home/user/agents-slackbot

# Add GitHub as remote
git remote add origin https://github.com/YOUR_USERNAME/agents-slackbot.git

# Push to GitHub
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

---

## Option 2: Using GitHub CLI

If you have `gh` CLI installed:

```bash
cd /home/user/agents-slackbot

# Create repo and push
gh repo create agents-slackbot --public --source=. --push

# Or for private repo
gh repo create agents-slackbot --private --source=. --push
```

---

## What Gets Pushed

Your repo includes:

```
✓ 22 files
✓ ~1,952 lines of TypeScript
✓ 2 commits:
  - Initial commit (4 agents + orchestrator)
  - Documentation & memory system

Files:
├── AGENTS.md (comprehensive agent docs)
├── README.md (project overview)
├── SETUP.md (deployment guide)
├── src/ (all agent code)
├── api/ (Slack webhooks)
└── package.json
```

---

## After Pushing

### 1. Deploy to Vercel

```bash
# From your local machine
vercel

# Link to your GitHub repo
# Vercel will auto-deploy on future pushes
```

### 2. Add Repository Topics (Optional)

On GitHub, click "⚙️ Settings" → scroll to "Topics" and add:
- `slack-bot`
- `claude-agent-sdk`
- `multi-agent`
- `openrouter`
- `typescript`
- `ai-agents`

### 3. Update README with Live Demo

Once deployed, add your Vercel URL to the README:

```markdown
🚀 **Live Demo**: https://your-app.vercel.app
```

---

## Troubleshooting

### "Permission denied (publickey)"

Using HTTPS? Try:
```bash
git remote set-url origin https://github.com/YOUR_USERNAME/agents-slackbot.git
```

### "Repository not found"

Make sure you created the repo on GitHub first, and the username is correct.

### Need to authenticate?

For HTTPS (easier):
```bash
# GitHub will prompt for credentials
git push -u origin main
```

For SSH:
```bash
# Use SSH URL instead
git remote set-url origin git@github.com:YOUR_USERNAME/agents-slackbot.git
```

---

## Next Steps After Push

1. ✅ **Star your own repo** (why not? 😄)
2. 🚀 **Deploy to Vercel** (see SETUP.md)
3. 🤖 **Configure Slack app** (see SETUP.md)
4. 🧪 **Test the agents**
5. 📣 **Share with your team**

---

**Ready?** Head to https://github.com/new and create `agents-slackbot`! 🎉
