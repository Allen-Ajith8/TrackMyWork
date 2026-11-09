# TrackMyWork - Hackathon Management Ecosystem

A zero-cost, hyper-optimized hackathon management ecosystem deployable on Vercel (Hobby Tier) and Capacitor (Android).

## 🚀 Tech Stack

- **Frontend & API**: Next.js 14+ (App Router), React 18, Tailwind CSS, TypeScript
- **Database & Auth**: Supabase (PostgreSQL, Realtime WebSockets, Google OAuth, Row-Level Security)
- **Mobile Wrapper**: Capacitor (compile to native Android APK) + Firebase Cloud Messaging (FCM)
- **AI Engine**: NVIDIA NIM API (Llama 3.3 70B, DeepSeek-R1, Qwen 2.5 Coder)
- **Background Jobs**: Upstash QStash (bypass Vercel's 24h cron limit)
- **IDE Telemetry**: Custom MCP Server using @modelcontextprotocol/sdk

## 📋 Features

### Two-Layer Permission Architecture (RBAC)
- **Global Super-Admin**: View/edit all rooms, manage master integrations, Ghost Mode
- **Room Team Leader**: Scoped admin, edit room settings, approve invites, bypass custom roles
- **Custom Roles**: Discord-style toggles (can_edit_repo, can_trigger_nim, can_assign_tasks, can_upload_assets, can_manage_bom, can_invite_members, can_edit_rules)

### Core Modules
- **Room Creation Wizard**: 3-step setup (Basics, Team/RBAC, Rules) with 6-digit invite codes
- **Jury Rubric & Hackathon Sync**: NIM-powered scope-creep detection, Mock Jury Q&A, Google Sheets sync
- **Submission Hub**: Canva API sync, Discord webhooks/slash commands, Artifact tracking (APK, Lottie, presentations)
- **Hardware BOM & Budget**: Component tracking, prototype vs mass-production costs via NIM
- **NIM Automation Engine**: GitHub webhook → auto-task progression, non-technical translations, 1-tap SOS debugging
- **MCP Server (Vibe Coding Telemetry)**: Live heartbeat dots, file lock warnings, .env vault pull, Vibe Rollback

## 🛠 Installation

### Prerequisites
- Node.js 20 LTS
- pnpm (recommended) or npm
- Supabase account
- Vercel account (for deployment)
- GitHub account (for OAuth & webhooks)

### 1. Clone & Install Dependencies

```bash
# Create project directory
mkdir trackmywork && cd trackmywork

# Copy all files from this repository
# (or clone if you have a git remote)

# Install dependencies
pnpm install
# or npm install
```

### 2. Environment Setup

```bash
# Copy example env file
cp .env.example .env.local

# Fill in your credentials:
# - Supabase URL & keys
# - NVIDIA NIM API key
# - GitHub App credentials
# - Upstash QStash tokens
# - Firebase FCM keys
# - Discord, Canva, Google Sheets credentials
```

### 3. Database Setup (Supabase)

1. Create a new Supabase project
2. Go to **SQL Editor** → **New Query**
3. Copy and paste the entire contents of `schema.sql`
4. Run the query
5. Go to **Authentication** → **Providers** → Enable **Google** and **GitHub** OAuth
6. Go to **Storage** → Create buckets: `artifacts` (private), `avatars` (public), `room-assets` (private)
7. Apply storage policies (see comments at bottom of schema.sql)

### 4. Development

```bash
# Start Next.js dev server
pnpm dev

# Start MCP server (separate terminal)
pnpm mcp:dev

# In another terminal, expose MCP server for Capacitor
# ngrok http 3001 (or use VS Code port forwarding)
```

### 5. Capacitor Android Build

```bash
# Add Android platform (first time only)
pnpm cap:add

# Sync web assets to Android
pnpm cap:sync

# Open in Android Studio
pnpm cap:open

# Build debug APK
pnpm cap:build
```

## 📁 Project Structure

```
trackmywork/
├── schema.sql                 # Complete Supabase schema with RLS
├── package.json               # Dependencies & scripts
├── tsconfig.json              # TypeScript config
├── next.config.mjs            # Next.js config
├── tailwind.config.ts         # Tailwind CSS config
├── postcss.config.mjs         # PostCSS config
├── capacitor.config.ts        # Capacitor config
├── .env.example               # Environment template
├── src/
│   ├── app/
│   │   ├── globals.css        # Global styles
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Landing page
│   │   ├── middleware.ts      # Auth middleware
│   │   ├── auth/
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   └── callback/route.ts
│   │   ├── dashboard/
│   │   │   ├── layout.tsx     # Dashboard layout with sidebar
│   │   │   └── page.tsx       # Main dashboard
│   │   └── api/
│   │       ├── webhooks/
│   │       │   └── github/route.ts    # GitHub webhook handler
│   │       └── cron/route.ts          # QStash cron endpoint
│   ├── components/            # React components (to be added)
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts      # Browser Supabase client
│   │   │   ├── server.ts      # Server Supabase client
│   │   │   └── admin.ts       # Admin (service role) client
│   │   ├── nim/
│   │   │   └── client.ts      # NVIDIA NIM API client
│   │   ├── store.ts           # Zustand stores
│   │   └── utils.ts           # Utility functions
│   ├── types/
│   │   └── database.ts        # TypeScript types from schema
│   └── hooks/                 # Custom React hooks (to be added)
├── mcp-server/                # MCP Server (separate project)
│   ├── src/
│   │   └── index.ts           # MCP server entry point
│   ├── package.json
│   └── tsconfig.json
└── android/                   # Capacitor Android project (generated)
```

## 🔧 Configuration

### Supabase Row-Level Security
The schema includes comprehensive RLS policies implementing the two-layer RBAC:
- Global admins bypass all policies
- Team Leaders have elevated permissions in their rooms
- Custom role flags control granular permissions
- All policies use helper functions (`is_global_admin`, `is_team_leader`, `has_room_permission`)

### GitHub App Setup (Repository Connection)
Rooms connect to repositories through a GitHub App, so webhooks are installed
automatically when a team leader clicks **Connect with GitHub** in
**Room → Settings → Repository**.

1. Create a GitHub App: <https://github.com/settings/apps/new>
2. Set **Homepage URL** to `https://your-domain.vercel.app`
3. Set **Setup URL** to `https://your-domain.vercel.app/api/github/callback`
   and enable **Redirect on update**
4. Set **Webhook URL** to `https://your-domain.vercel.app/api/webhooks/github`
5. Set a **Webhook secret** and copy it to `GITHUB_WEBHOOK_SECRET`
6. Repository permissions: **Contents** (read), **Metadata** (read),
   **Issues** (read), **Pull requests** (read)
7. Subscribe to events: `push`, `pull_request`, `issues`, `workflow_run`
8. Add the app credentials to `.env.local`:
   - `GITHUB_APP_ID`
   - `GITHUB_APP_PRIVATE_KEY` (the downloaded `.pem`, newlines escaped as `\n`)
   - `GITHUB_APP_SLUG` (the slug after `github.com/apps/`)
   - `GITHUB_WEBHOOK_SECRET`
   - optionally `GITHUB_STATE_SECRET` (defaults to the webhook secret)

Once installed, commits, pull requests, and issues on the linked repository are
matched to the room by repository URL and flow through
`/api/webhooks/github`.

### Upstash QStash Cron Jobs
Configure these schedules in QStash dashboard:
- `deadline_check` - Every 15 minutes
- `cleanup_heartbeats` - Every 5 minutes
- `cleanup_file_locks` - Every 10 minutes
- `send_daily_digest` - Daily at 9 AM
- `sync_google_sheets` - Every hour

### NVIDIA NIM Models
Default models (adjust in `.env.local`):
- **Llama 3.3 70B**: Task summaries, jury alignment, non-technical translations
- **DeepSeek-R1**: Rust compiler errors, complex debugging
- **Qwen 2.5 Coder 32B**: PR code reviews, general debugging

## 🚀 Deployment (Vercel)

1. Push to GitHub
2. Import in Vercel
3. Add environment variables from `.env.local`
4. Deploy
5. Configure custom domain (optional)

**Vercel Hobby Tier Limits:**
- 100 GB-hours serverless execution/month
- 100 GB bandwidth/month
- 12 function invocations/second
- ✅ Works perfectly for hackathon-scale usage

## 📱 Capacitor Android

### Build Requirements
- Android Studio (latest)
- JDK 17+
- Android SDK 34+

### FCM Push Notifications
1. Create Firebase project
2. Add Android app with package name `com.trackmywork.app`
3. Download `google-services.json` → `android/app/`
4. Add VAPID key to `.env.local`
5. Enable FCM in Capacitor config

### Release Build
```bash
# Configure signing in capacitor.config.ts or Android Studio
# Generate signed bundle/APK in Android Studio
# Or use: ./gradlew bundleRelease
```

## 🧪 Testing

```bash
# Type checking
pnpm type-check

# Linting
pnpm lint

# Run tests (when added)
pnpm test
```

## 📝 License

MIT License - Built for hackathons, by hackathon veterans.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run type-check and lint
5. Submit a PR

## 📞 Support

- **Discord**: [Join our community](#)
- **GitHub Issues**: [Report bugs](#)
- **Documentation**: [Full docs](#)

---

**TrackMyWork** - Dominate your next hackathon with AI-powered automation 🚀