# Nora Architecture

## Overview

Nora is a Next.js monorepo app where:

- UI runs in `apps/web`
- post create/read requests go through Next.js API routes
- post payloads are stored as Shelby blobs
- feed ordering metadata is stored in a local server index file
- profile/identity data is stored in Supabase (`public.users`)

## High-Level Components

- UI and pages:
  - `apps/web/app/*`
  - `apps/web/components/*`
- Client data adapter:
  - `apps/web/lib/shelbyClient.ts`
- Server Shelby service:
  - `apps/web/lib/shelbyServer.ts`
- Server identity service:
  - `apps/web/lib/identity.ts`
  - `apps/web/lib/supabaseAdmin.ts`
- API handlers:
  - `apps/web/app/api/posts/route.ts`
  - `apps/web/app/api/health/shelby/route.ts`
  - `apps/web/app/signup/route.ts`
  - `apps/web/app/login/route.ts`
  - `apps/web/app/user/*`

## Runtime Data Flow

### Create Post

1. User submits composer in browser.
2. Client calls `POST /api/posts` with `{ content, author }`.
3. Server validates payload and builds post JSON blob.
4. Server creates commitments and registers blob on coordination layer.
5. Server uploads blob bytes to Shelby RPC.
6. Server updates local index file `.nora-post-index.json`.
7. API returns normalized post object with tx metadata.
8. Client shows success, tx hash, and explorer/blob links.

### Fetch Feed

1. Client calls `GET /api/posts`.
2. Server reads `.nora-post-index.json`.
3. For each index entry, server downloads corresponding Shelby blob.
4. Server parses JSON blobs and returns sorted posts.
5. UI renders feed cards.

## Flow Diagram

```mermaid
flowchart TD
  U[User (Petra Wallet)] --> UI[Next.js UI: Composer/Feed]
  UI --> API[POST /api/posts]
  API --> SVC[Server: shelbyServer.ts]

  SVC --> C1[Generate commitments]
  C1 --> C2[registerBlob on Aptos testnet]
  C2 --> TX[(Aptos Tx Hash)]
  C2 --> C3[putBlob to Shelby RPC]
  C3 --> B[(Shelby Blob Storage)]
  C3 --> IDX[(Local index file: .nora-post-index.json)]

  UI --> API2[GET /api/posts]
  API2 --> SVC2[Server: read index]
  SVC2 --> IDX
  SVC2 --> B
  B --> SVC2
  SVC2 --> UI

  TX --> AEXP[Aptos Explorer link]
  B --> BLINK[Shelby Blob URL]
```

## Storage Model

### Shelby blobs

- Path format: `nora/posts/<timestamp>-<uuid>.json`
- Blob payload:
  - `type`
  - `author`
  - `content`
  - `timestamp`

### Local index

- File: `.nora-post-index.json`
- Contains:
  - `blobName`
  - `timestamp`
  - `txHash`
  - `txExplorerUrl`
  - `shelbyExplorerUrl`

### Supabase users

- Table: `public.users`
- Columns:
  - `id`
  - `username` (unique)
  - `wallet_address` (unique)
  - `bio`
  - `avatar`
  - `followers_count`
  - `created_at`

## Why local index exists

Testnet endpoint behavior can break SDK paths that rely on a `blobs` GraphQL schema.
Using a local index allows stable post/feed behavior while still keeping actual post content in Shelby blobs.

## Environment Configuration

Primary server-side variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SHELBY_API_KEY`
- `SHELBY_SIGNER_PRIVATE_KEY`
- `SHELBY_NETWORK`
- `SHELBY_APTOS_FULLNODE_URL`
- `SHELBY_APTOS_INDEXER_URL`
- `SHELBY_RPC_BASE_URL`
- `SHELBY_APTOS_API_KEY` (optional)
- `SHELBY_RPC_API_KEY` (optional)

Client-side optional:

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_TESTNET_API_KEY` (wallet adapter)

## Health and Observability

- `GET /api/health/shelby` checks:
  - coordination metadata path
  - RPC read path
  - active endpoint/config hints

## Operational Notes

- `.nora-post-index.json` is local to the running server instance.
- In multi-instance deployments, this file should be replaced by shared storage.
- Post blobs remain portable because they are stored in Shelby.

## Future Improvements

- Move index to shared durable storage (DB or object store).
- Add background reconciliation job to rebuild index from chain/RPC metadata.
- Add pagination and cursor-based feed reads.
- Add per-author profile feeds and richer post metadata.
