# Nora

Minimal social media app built with Next.js and Shelby Protocol.

## Deployment

This project is configured for deployment on **Vercel**.

### Prerequisites

- A Vercel account.
- Environment variables configured in the Vercel project dashboard (see `apps/web/.env.example`).

### Deployment Steps

1. Connect your GitHub repository to Vercel.
2. Vercel should automatically detect the monorepo structure.
3. Configure the **Root Directory** as `apps/web` or use the root `vercel.json` configuration provided.
4. Add the required environment variables in the Vercel Dashboard.
5. Deploy!

## Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Aptos wallet adapter (`@aptos-labs/wallet-adapter-react`)
- Shelby SDK (`@shelby-protocol/sdk`)

## Monorepo Layout

- `apps/web` - main app
- `packages/*` - reserved for shared packages

## Features

- Wallet connect (Petra-first selection in UI)
- Wallet-first identity onboarding (username, bio, avatar)
- Create 280-char text post
- Feed rendering with timestamp and social-style cards
- Shelby-backed storage for post blobs
- Tx hash + explorer links immediately after publish
- Supabase-backed user profiles

## Quick Start

### 1. Install dependencies

Use one package manager consistently.

```bash
npm install
```

### 2. Configure environment

Create `apps/web/.env.local`:

```env
# Supabase (required for identity/profile)
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Required (server-side)
SHELBY_API_KEY=your_api_key
SHELBY_SIGNER_PRIVATE_KEY=ed25519-priv-0x...
SHELBY_NETWORK=TESTNET

# Recommended endpoint overrides
SHELBY_APTOS_FULLNODE_URL=https://api.testnet.aptoslabs.com/v1
SHELBY_APTOS_INDEXER_URL=https://api.testnet.aptoslabs.com/v1/graphql
SHELBY_RPC_BASE_URL=https://api.testnet.shelby.xyz/shelby

# Optional service-specific keys
SHELBY_APTOS_API_KEY=your_api_key
SHELBY_RPC_API_KEY=your_api_key

# Optional wallet adapter API key (client-side)
NEXT_PUBLIC_TESTNET_API_KEY=your_api_key
```

### 3. Create Supabase table

Run SQL from:

- `apps/web/supabase/schema.sql`

in your Supabase SQL editor.

### 4. Run the app

```bash
npm run dev
```

Open `http://localhost:3000`.

## Available Scripts

From repo root:

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
```

## API Endpoints

- `GET /api/posts` - fetch feed
- `POST /api/posts` - create post `{ content, author }`
- `GET /api/health/shelby` - Shelby connectivity/auth health check
- `GET /api/hashtags/trending` - trending hashtags
- `GET /api/hashtags/:tag` - hashtag feed (server downloads blobs)
- `POST /signup` - create wallet-linked user profile
- `POST /login` - wallet-based login
- `GET /user/:username` - public profile
- `GET /user/by-wallet?wallet_address=...` - profile lookup by wallet
- `PATCH /user/me` - update bio/avatar by wallet

## Post Storage Model

- Each post is uploaded as a Shelby blob under:
  - `nora/posts/<timestamp>-<uuid>.json`
- Feed index is maintained server-side in:
  - `.nora-post-index.json`
- Feed reads index entries, then downloads corresponding Shelby blobs.

This avoids the testnet `blobs` GraphQL schema dependency that caused earlier query failures.

## Identity Storage

- Users are stored in Supabase `public.users`.
- Auth model is wallet-first (no password storage).
- On first connect, users are redirected to `/onboarding` to set username, bio, and avatar.

## Tx and Explorer Links

After publish, UI shows:

- Aptos transaction hash
- Tx explorer URL
- Blob retrieval URL (`.../shelby/v1/blobs/{account}/{blobName}`)

## Troubleshooting

### `Failed to complete multipart upload (400)`

Usually one of:

- signer account missing required funds
- endpoint/key mismatch
- stale dev server env

Restart dev server after env changes and retry.

### `field 'blobs' not found in type: 'query_root'`

You are pointing at a non-Shelby blob indexer schema. Current app avoids this for posting/feed by using server API + local index file.

### `Unauthorized` errors

Verify key scope for the configured endpoint and set service-specific keys if needed:

- `SHELBY_API_KEY`
- `SHELBY_APTOS_API_KEY`
- `SHELBY_RPC_API_KEY`

## Architecture Reference

See [ARCHITECTURE.md](/Users/surojitpvt/Desktop/nora/ARCHITECTURE.md) for a full system overview and data flow.

## Open Source & Contributing

Nora is fully open-sourced under the MIT License! We encourage you to fork the repository, deploy your own instance of Nora, or contribute back to the project.

**Security Notice:** When deploying your own fork of Nora, please ensure that you securely populate your own `.env.local` based on `.env.example`. Never commit real API keys or wallets to version control! 

Feel free to open Issues for bugs and feature requests, or submit Pull Requests for improvements.

## License
MIT License. See [LICENSE](LICENSE) for more details.
