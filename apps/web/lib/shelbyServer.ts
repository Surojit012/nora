import { Account, Ed25519PrivateKey, Network } from "@aptos-labs/ts-sdk";
import {
  createDefaultErasureCodingProvider,
  generateCommitments,
  ShelbyNodeClient
} from "@shelby-protocol/sdk/node";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Post } from "@/lib/types";
import { extractHashtags } from "@/lib/hashtags";
import { emitMentionsFromText } from "@/lib/notifications";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const POST_PREFIX = "nora/posts/";
const MAX_POST_LENGTH = 280;
const DEFAULT_EXPIRATION_DAYS = 30;
const MAX_INDEX_ITEMS = 500;
const POST_INDEX_FILE = path.join(process.cwd(), ".nora-post-index.json"); // legacy fallback/seed only
const DEFAULT_LIST_LIMIT = 50;
const DOWNLOAD_CONCURRENCY = 10;
const FEED_CACHE_TTL_MS = 5_000;

type ShelbyPostBlob = {
  type: "post";
  author: string;
  content: string;
  timestamp: number;
  scheduledAt?: number;
  location?: string;
  poll?: {
    options: string[];
    endsAt?: number;
  };
  attachments?: {
    blobName: string;
    mimeType: string;
    size: number;
  }[];
  txHash?: string;
  txExplorerUrl?: string;
  shelbyTxExplorerUrl?: string;
  shelbyExplorerUrl?: string;
};

type CreateShelbyPostInput = {
  author: string;
  content: string;
  scheduledAt?: number;
  location?: string;
  poll?: {
    options: string[];
    endsAt?: number;
  };
  attachments?: {
    blobName: string;
    mimeType: string;
    size: number;
    data: Uint8Array;
  }[];
};

type PostIndexItem = {
  blobName: string;
  timestamp: number;
  txHash?: string;
  txExplorerUrl?: string;
  shelbyTxExplorerUrl?: string;
  shelbyExplorerUrl?: string;
};

type PostIndex = {
  version: 1;
  items: PostIndexItem[];
};

type PostBlobRow = {
  blob_name: string;
  owner_address: string;
  author_address: string;
  post_timestamp: number;
  tx_hash: string | null;
  tx_explorer_url: string | null;
  shelby_tx_explorer_url: string | null;
  shelby_blob_url: string | null;
  created_at: string;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getOptionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function getShelbyNetwork(): Network {
  const configured = process.env.SHELBY_NETWORK?.trim()?.toLowerCase();
  if (!configured) return Network.TESTNET;
  if (configured === "testnet") return Network.TESTNET;
  if (configured === "shelbynet") return Network.SHELBYNET;
  if (configured === "local") return Network.LOCAL;
  return Network.TESTNET;
}

function getDefaultNetworkEndpoints(network: Network) {
  if (network === Network.LOCAL) {
    return {
      aptosFullnode: "http://127.0.0.1:8080/v1",
      aptosIndexer: "http://127.0.0.1:8090/v1/graphql",
      aptosFaucet: "http://127.0.0.1:8081",
      shelbyRpc: "http://localhost:9090/"
    };
  }

  if (network === Network.SHELBYNET) {
    return {
      aptosFullnode: "https://api.shelbynet.shelby.xyz/v1",
      aptosIndexer: "https://api.shelbynet.shelby.xyz/v1/graphql",
      aptosFaucet: "https://faucet.shelbynet.shelby.xyz",
      shelbyRpc: "https://api.shelbynet.shelby.xyz/shelby"
    };
  }

  return {
    aptosFullnode: "https://api.testnet.aptoslabs.com/v1",
    aptosIndexer: "https://api.testnet.aptoslabs.com/v1/graphql",
    shelbyRpc: "https://api.testnet.shelby.xyz/shelby"
  };
}

function getSigner(): Account {
  const privateKeyHex = getRequiredEnv("SHELBY_SIGNER_PRIVATE_KEY");
  const privateKey = new Ed25519PrivateKey(privateKeyHex);
  return Account.fromPrivateKey({ privateKey });
}

function getShelbyClientConfig() {
  const sharedApiKey = getRequiredEnv("SHELBY_API_KEY");
  const rpcApiKey = getOptionalEnv("SHELBY_RPC_API_KEY");
  const rpcBaseUrl = getOptionalEnv("SHELBY_RPC_BASE_URL");
  const aptosFullnodeUrl = getOptionalEnv("SHELBY_APTOS_FULLNODE_URL");
  const aptosIndexerUrl = getOptionalEnv("SHELBY_APTOS_INDEXER_URL");
  const aptosFaucetUrl = getOptionalEnv("SHELBY_APTOS_FAUCET_URL");
  const aptosApiKey = getOptionalEnv("SHELBY_APTOS_API_KEY");

  const network = getShelbyNetwork();
  const defaults = getDefaultNetworkEndpoints(network);

  return {
    network,
    apiKey: sharedApiKey,
    aptos: {
      fullnode: aptosFullnodeUrl ?? defaults.aptosFullnode,
      indexer: aptosIndexerUrl ?? defaults.aptosIndexer,
      ...(aptosFaucetUrl ? { faucet: aptosFaucetUrl } : {}),
      clientConfig: {
        API_KEY: aptosApiKey ?? sharedApiKey
      }
    },
    rpc: {
      baseUrl: rpcBaseUrl ?? defaults.shelbyRpc,
      apiKey: rpcApiKey ?? sharedApiKey
    }
  };
}

function getShelbyClient(): ShelbyNodeClient {
  return new ShelbyNodeClient(getShelbyClientConfig() as never);
}

function getAptosTxExplorerUrl(txHash: string, network: Network): string {
  const configuredNetwork = getOptionalEnv("APTOS_EXPLORER_NETWORK");
  const networkParam =
    configuredNetwork ??
    (network === Network.MAINNET ? "mainnet" : "testnet");
  return `https://explorer.aptoslabs.com/txn/${txHash}/userTxnOverview?network=${networkParam}`;
}

function getShelbyBlobReadUrl(network: Network, account: string, blobName: string): string {
  const rpcBase = getOptionalEnv("SHELBY_RPC_BASE_URL") ?? getDefaultNetworkEndpoints(network).shelbyRpc;
  const cleanBase = rpcBase.endsWith("/") ? rpcBase.slice(0, -1) : rpcBase;
  return `${cleanBase}/v1/blobs/${account}/${blobName}`;
}

function getShelbyTxExplorerUrl(txHash: string, account: string): string {
  const base =
    getOptionalEnv("SHELBY_TX_EXPLORER_BASE_URL") ??
    `https://explorer.shelby.xyz/testnet/account/${account}/blobs`;
  const cleanBase = base.endsWith("/") ? base.slice(0, -1) : base;
  if (cleanBase.includes("{txHash}") || cleanBase.includes("{account}")) {
    return cleanBase.replace("{txHash}", txHash).replace("{account}", account);
  }
  return `${cleanBase}?search=${encodeURIComponent(txHash)}`;
}

function generateBlobName(now: number): string {
  return `${POST_PREFIX}${now}-${crypto.randomUUID()}.json`;
}

function toPost(ownerAddress: string, id: string, payload: ShelbyPostBlob): Post {
  const network = getShelbyNetwork();

  return {
    id,
    text: payload.content,
    author: payload.author,
    createdAt: new Date(payload.timestamp).toISOString(),
    ...(typeof payload.location === "string" && payload.location.trim()
      ? { location: payload.location.trim() }
      : {}),
    ...(typeof payload.scheduledAt === "number"
      ? { scheduledAt: new Date(payload.scheduledAt).toISOString() }
      : {}),
    ...(payload.poll && Array.isArray(payload.poll.options) && payload.poll.options.length >= 2
      ? {
          poll: {
            options: payload.poll.options,
            ...(typeof payload.poll.endsAt === "number"
              ? { endsAt: new Date(payload.poll.endsAt).toISOString() }
              : {})
          }
        }
      : {}),
    ...(payload.attachments?.length
      ? {
          attachments: payload.attachments.map((att) => {
            const kind = att.mimeType.startsWith("image/")
              ? "image"
              : att.mimeType.startsWith("video/")
                ? "video"
                : "file";
            return {
              kind,
              blobName: att.blobName,
              mimeType: att.mimeType,
              size: att.size,
              url: getShelbyBlobReadUrl(network, ownerAddress, att.blobName)
            };
          })
        }
      : {}),
    txHash: payload.txHash,
    txExplorerUrl: payload.txExplorerUrl,
    shelbyTxExplorerUrl: payload.shelbyTxExplorerUrl,
    shelbyExplorerUrl: payload.shelbyExplorerUrl
  };
}

async function indexHashtagsForPost(args: {
  postId: string;
  blobName: string;
  author: string;
  timestamp: number;
  content: string;
}) {
  const tags = extractHashtags(args.content);
  if (tags.length === 0) return;

  const supabase = getSupabaseAdmin();

  // Ensure tag rows exist.
  const { error: tagUpsertError } = await supabase.from("hashtags").upsert(
    tags.map((tag) => ({ tag })),
    { onConflict: "tag" }
  );
  if (tagUpsertError) {
    console.warn("[hashtags] failed to upsert hashtags:", tagUpsertError);
    return;
  }

  const { error: mappingError } = await supabase.from("post_hashtags").upsert(
    tags.map((tag) => ({
      post_id: args.postId,
      blob_name: args.blobName,
      author: args.author,
      post_timestamp: args.timestamp,
      tag
    })),
    { onConflict: "post_id,tag" }
  );

  if (mappingError) {
    console.warn("[hashtags] failed to upsert post hashtags:", mappingError);
  }
}

function createEmptyPostIndex(): PostIndex {
  return { version: 1, items: [] };
}

function normalizePostIndex(parsed: unknown): PostIndex {
  if (!parsed || typeof parsed !== "object") return createEmptyPostIndex();
  const maybeIndex = parsed as Partial<PostIndex>;
  if (!Array.isArray(maybeIndex.items)) return createEmptyPostIndex();

  const items: PostIndexItem[] = maybeIndex.items
    .map((item) => item as Partial<PostIndexItem>)
    .filter((item) => typeof item.blobName === "string" && typeof item.timestamp === "number")
    .map((item) => ({
      blobName: item.blobName!,
      timestamp: item.timestamp!,
      ...(typeof item.txHash === "string" ? { txHash: item.txHash } : {}),
      ...(typeof item.txExplorerUrl === "string" ? { txExplorerUrl: item.txExplorerUrl } : {}),
      ...(typeof item.shelbyTxExplorerUrl === "string" ? { shelbyTxExplorerUrl: item.shelbyTxExplorerUrl } : {}),
      ...(typeof item.shelbyExplorerUrl === "string" ? { shelbyExplorerUrl: item.shelbyExplorerUrl } : {})
    }));

  return { version: 1, items };
}

function validateCreateInput(input: CreateShelbyPostInput) {
  const author = input.author.trim();
  const content = input.content.trim();

  if (!author) throw new Error("Author is required.");
  if (content.length > MAX_POST_LENGTH) {
    throw new Error("Content must be 280 characters or less.");
  }

  return { author, content };
}

async function uploadShelbyBlob(args: {
  client: ShelbyNodeClient;
  signer: Account;
  provider: Awaited<ReturnType<typeof createDefaultErasureCodingProvider>>;
  blobName: string;
  blobData: Uint8Array;
  expirationMicros: number;
}) {
  const commitments = await generateCommitments(args.provider, args.blobData);

  const { transaction } = await args.client.coordination.registerBlob({
    // @ts-expect-error: Account type mismatch between workspace sdk instances
    account: args.signer,
    blobName: args.blobName,
    blobMerkleRoot: commitments.blob_merkle_root,
    size: args.blobData.length,
    expirationMicros: args.expirationMicros,
    config: args.provider.config
  });

  await args.client.coordination.aptos.waitForTransaction({
    transactionHash: transaction.hash
  });

  await args.client.rpc.putBlob({
    // @ts-expect-error: AccountAddress type mismatch between workspace sdk instances
    account: args.signer.accountAddress,
    blobName: args.blobName,
    blobData: args.blobData
  });

  return { txHash: transaction.hash };
}

async function readShelbyBlobAsText(client: ShelbyNodeClient, account: string, blobName: string) {
  const blob = await client.download({ account, blobName });
  return new Response(blob.readable).text();
}

async function readPostIndex(): Promise<PostIndex> {
  try {
    const raw = await fs.readFile(POST_INDEX_FILE, "utf8");
    return normalizePostIndex(JSON.parse(raw));
  } catch {
    return createEmptyPostIndex();
  }
}

async function writePostIndex(index: PostIndex) {
  await fs.writeFile(POST_INDEX_FILE, JSON.stringify(index), "utf8");
}

function normalizeAddress(value: string): string {
  return value.trim().toLowerCase();
}

async function upsertPostIndexRow(row: Omit<PostBlobRow, "created_at">) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("post_blobs")
    .upsert(row, { onConflict: "blob_name" });
  if (error) {
    throw new Error(`Supabase post index upsert failed: ${error.message}`);
  }
}

async function getTxMappingsForBlobs(blobNames: string[]): Promise<Map<string, PostBlobRow>> {
  const out = new Map<string, PostBlobRow>();
  const deduped = Array.from(new Set(blobNames)).slice(0, 500);
  if (deduped.length === 0) return out;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("post_blobs")
    .select(
      "blob_name,owner_address,author_address,post_timestamp,tx_hash,tx_explorer_url,shelby_tx_explorer_url,shelby_blob_url,created_at"
    )
    .in("blob_name", deduped);

  if (error) {
    // Don’t fail feed rendering if tx mapping table is missing/misconfigured.
    console.warn("[post_blobs] tx mapping read failed:", error.message);
    return out;
  }

  for (const row of (data ?? []) as PostBlobRow[]) {
    out.set(row.blob_name, row);
  }
  return out;
}

function parseTimestampFromBlobName(blobNameSuffix: string): number | null {
  // Expected: nora/posts/<timestamp>-<uuid>.json
  if (!blobNameSuffix.startsWith(POST_PREFIX)) return null;
  const rest = blobNameSuffix.slice(POST_PREFIX.length);
  const dashIdx = rest.indexOf("-");
  if (dashIdx <= 0) return null;
  const maybe = Number(rest.slice(0, dashIdx));
  if (!Number.isFinite(maybe)) return null;
  return maybe;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const workers = new Array(Math.max(1, concurrency)).fill(0).map(async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx], idx);
    }
  });

  await Promise.all(workers);
  return results;
}

async function seedPostIndexFromLocalFile(client: ShelbyNodeClient, signerAddress: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("post_blobs").select("blob_name").limit(1);
  if (error) return;
  if (data && data.length > 0) return;

  const legacy = await readPostIndex();
  if (legacy.items.length === 0) return;

  const candidates = legacy.items
    .filter((item) => item.blobName.startsWith(POST_PREFIX))
    .slice(0, MAX_INDEX_ITEMS);

  const rows: Omit<PostBlobRow, "created_at">[] = [];
  for (const item of candidates) {
    let authorAddress = "";
    try {
      const raw = await readShelbyBlobAsText(client, signerAddress, item.blobName);
      const post = parsePostBlob(signerAddress, `${signerAddress}/${item.blobName}`, raw);
      authorAddress = post?.author ? normalizeAddress(post.author) : "";
    } catch {
      authorAddress = "";
    }

    rows.push({
      blob_name: item.blobName,
      owner_address: signerAddress,
      author_address: authorAddress,
      post_timestamp: item.timestamp,
      tx_hash: item.txHash ?? null,
      tx_explorer_url: item.txExplorerUrl ?? null,
      shelby_tx_explorer_url: item.shelbyTxExplorerUrl ?? null,
      shelby_blob_url: item.shelbyExplorerUrl ?? null
    });
  }

  // Best-effort seed; do not fail hard.
  try {
    await supabase.from("post_blobs").upsert(rows, { onConflict: "blob_name" });
  } catch {
    // ignore
  }
}

function parsePostBlob(ownerAddress: string, id: string, raw: string): Post | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const payload = parsed as Partial<ShelbyPostBlob>;
  if (payload.type !== "post") return null;
  if (!payload.author || typeof payload.timestamp !== "number") return null;

  const content = String(payload.content ?? "").trim();
  const author = String(payload.author).trim();
  if (!author) return null;

  const attachments = Array.isArray(payload.attachments)
    ? payload.attachments
        .map((a) => a as Partial<{ blobName: string; mimeType: string; size: number }>)
        .filter((a) => typeof a.blobName === "string" && typeof a.mimeType === "string" && typeof a.size === "number")
        .map((a) => ({ blobName: a.blobName!, mimeType: a.mimeType!, size: a.size! }))
    : undefined;

  return toPost(ownerAddress, id, {
    type: "post",
    author,
    content,
    timestamp: payload.timestamp,
    ...(typeof payload.scheduledAt === "number" ? { scheduledAt: payload.scheduledAt } : {}),
    ...(typeof payload.location === "string" ? { location: payload.location } : {}),
    ...(payload.poll && typeof payload.poll === "object" ? { poll: payload.poll as ShelbyPostBlob["poll"] } : {}),
    ...(attachments?.length ? { attachments } : {})
  });
}

export async function createShelbyPost(input: CreateShelbyPostInput): Promise<Post> {
  const { author, content } = validateCreateInput(input);
  const client = getShelbyClient();
  const signer = getSigner();
  const network = getShelbyNetwork();
  const signerAddress = signer.accountAddress.toString();
  const timestamp = Date.now();
  const blobName = generateBlobName(timestamp);
  const postId = `${signerAddress}/${blobName}`;
  const expirationMicros = (timestamp + DEFAULT_EXPIRATION_DAYS * 24 * 60 * 60 * 1000) * 1000;

  try {
    const provider = await createDefaultErasureCodingProvider();
    const attachmentInputs = input.attachments ?? [];
    const attachmentMeta: ShelbyPostBlob["attachments"] = [];

    for (const file of attachmentInputs) {
      await uploadShelbyBlob({
        client,
        signer,
        provider,
        blobName: file.blobName,
        blobData: file.data,
        expirationMicros
      });

      attachmentMeta.push({
        blobName: file.blobName,
        mimeType: file.mimeType,
        size: file.size
      });
    }

    const location = typeof input.location === "string" ? input.location.trim() : "";
    const scheduledAt = typeof input.scheduledAt === "number" ? input.scheduledAt : undefined;
    const poll =
      input.poll && Array.isArray(input.poll.options)
        ? {
            options: input.poll.options.map((o) => String(o).trim()).filter(Boolean).slice(0, 4),
            ...(typeof input.poll.endsAt === "number" ? { endsAt: input.poll.endsAt } : {})
          }
        : undefined;

    const basePayload: ShelbyPostBlob = {
      type: "post",
      author,
      content,
      timestamp,
      ...(scheduledAt ? { scheduledAt } : {}),
      ...(location ? { location: location.slice(0, 80) } : {}),
      ...(poll && poll.options.length >= 2 ? { poll } : {}),
      ...(attachmentMeta.length ? { attachments: attachmentMeta } : {})
    };
    const baseEncoded = new TextEncoder().encode(JSON.stringify(basePayload));
    const { txHash } = await uploadShelbyBlob({
      client,
      signer,
      provider,
      blobName,
      blobData: baseEncoded,
      expirationMicros
    });
    const txExplorerUrl = getAptosTxExplorerUrl(txHash, network);
    const shelbyTxExplorerUrl = getShelbyTxExplorerUrl(txHash, signerAddress);
    const shelbyExplorerUrl = getShelbyBlobReadUrl(network, signerAddress, blobName);

    await upsertPostIndexRow({
      blob_name: blobName,
      owner_address: signerAddress,
      author_address: normalizeAddress(author),
      post_timestamp: timestamp,
      tx_hash: txHash,
      tx_explorer_url: txExplorerUrl,
      shelby_tx_explorer_url: shelbyTxExplorerUrl,
      shelby_blob_url: shelbyExplorerUrl
    });

    // Best-effort: index hashtags in Supabase for trending/tag feeds.
    await indexHashtagsForPost({
      postId,
      blobName,
      author,
      timestamp,
      content
    });

    // Best-effort: emit @mention notifications (post + metadata).
    try {
      await emitMentionsFromText({ text: content, actor: author, postId });
    } catch (e) {
      console.warn("[notifications] emit post mentions failed:", e);
    }

    return toPost(signerAddress, postId, {
      ...basePayload,
      txHash,
      txExplorerUrl,
      shelbyTxExplorerUrl,
      shelbyExplorerUrl
    });
  } catch (error) {
    throw new Error(`Shelby upload failed: ${errorMessage(error)}`);
  }
}

export async function listShelbyPosts(args?: { author?: string; limit?: number }): Promise<Post[]> {
  const cacheKey = (() => {
    const author = typeof args?.author === "string" ? normalizeAddress(args.author) : "";
    const limit = typeof args?.limit === "number" && Number.isFinite(args.limit) ? args.limit : DEFAULT_LIST_LIMIT;
    return `${author}:${limit}`;
  })();

  const cacheStore = (globalThis as unknown as { __noraShelbyFeedCache?: Map<string, { ts: number; posts: Post[] }> })
    .__noraShelbyFeedCache ??= new Map();

  const cached = cacheStore.get(cacheKey);
  if (cached && Date.now() - cached.ts < FEED_CACHE_TTL_MS) {
    return cached.posts;
  }

  const client = getShelbyClient();
  const signer = getSigner();
  const signerAddress = signer.accountAddress.toString();
  const limit = Math.max(1, Math.min(200, args?.limit ?? DEFAULT_LIST_LIMIT));
  const authorFilter = typeof args?.author === "string" && args.author.trim() ? normalizeAddress(args.author) : "";

  // Best-effort: keep local legacy seed for tx mapping, but do not depend on it for listing.
  await seedPostIndexFromLocalFile(client, signerAddress);

  // List all blobs for the signer account via the SDK (SDK handles auth/indexer).
  const accountBlobs = await client.coordination.getAccountBlobs({
    // @ts-expect-error: AccountAddress type mismatch between workspace sdk instances
    account: signer.accountAddress
  });

  const postMetas = accountBlobs
    .filter((b) => Boolean(b) && b.isWritten && !b.isDeleted && typeof b.blobNameSuffix === "string")
    .map((b) => ({
      blobName: b.blobNameSuffix,
      createdMicros: typeof b.creationMicros === "number" ? b.creationMicros : 0
    }))
    .filter((b) => b.blobName.startsWith(POST_PREFIX))
    .sort((a, b) => {
      const ta = parseTimestampFromBlobName(a.blobName) ?? Math.floor(a.createdMicros / 1000);
      const tb = parseTimestampFromBlobName(b.blobName) ?? Math.floor(b.createdMicros / 1000);
      return tb - ta;
    });

  // Use Supabase mapping (if present) to pre-filter author timelines without downloading hundreds of blobs.
  const txMap = await getTxMappingsForBlobs(postMetas.slice(0, 500).map((m) => m.blobName));

  const selected: { blobName: string; createdMicros: number }[] = [];
  const unknown: { blobName: string; createdMicros: number }[] = [];

  if (authorFilter) {
    for (const meta of postMetas) {
      const mappedAuthor = txMap.get(meta.blobName)?.author_address?.trim().toLowerCase() ?? "";
      if (mappedAuthor) {
        if (mappedAuthor === authorFilter) selected.push(meta);
      } else {
        unknown.push(meta);
      }
      if (selected.length >= limit) break;
    }
  } else {
    selected.push(...postMetas.slice(0, limit));
  }

  // If we still need more for author timelines (unmapped legacy posts), scan by downloading until we fill `limit`.
  if (authorFilter && selected.length < limit && unknown.length) {
    const needed = limit - selected.length;
    const scan = unknown.slice(0, Math.min(200, Math.max(needed * 10, 50)));
    const scanned = await mapWithConcurrency(scan, DOWNLOAD_CONCURRENCY, async (meta) => {
      try {
        const raw = await readShelbyBlobAsText(client, signerAddress, meta.blobName);
        const post = parsePostBlob(signerAddress, `${signerAddress}/${meta.blobName}`, raw);
        if (!post) return null;
        if (normalizeAddress(post.author) !== authorFilter) return null;
        return meta;
      } catch {
        return null;
      }
    });

    for (const meta of scanned) {
      if (!meta) continue;
      selected.push(meta);
      if (selected.length >= limit) break;
    }
  }

  const hydrated = await mapWithConcurrency(selected, DOWNLOAD_CONCURRENCY, async (meta) => {
    try {
      const raw = await readShelbyBlobAsText(client, signerAddress, meta.blobName);
      const post = parsePostBlob(signerAddress, `${signerAddress}/${meta.blobName}`, raw);
      if (!post) return null;

      // If it wasn't pre-filtered (feed), apply author filter here too.
      if (authorFilter && normalizeAddress(post.author) !== authorFilter) return null;

      const mapping = txMap.get(meta.blobName);
      const base = post as Post;
      return {
        ...base,
        txHash: mapping?.tx_hash ?? base.txHash,
        txExplorerUrl: mapping?.tx_explorer_url ?? base.txExplorerUrl,
        shelbyTxExplorerUrl: mapping?.shelby_tx_explorer_url ?? base.shelbyTxExplorerUrl,
        shelbyExplorerUrl: mapping?.shelby_blob_url ?? base.shelbyExplorerUrl
      } as Post;
    } catch {
      return null;
    }
  });

  const posts = hydrated.filter((post): post is Post => post !== null);
  posts.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  const finalPosts = posts.slice(0, limit);
  cacheStore.set(cacheKey, { ts: Date.now(), posts: finalPosts });
  return finalPosts;
}

export async function runShelbyHealthCheck() {
  const client = getShelbyClient();
  const signer = getSigner();
  const signerAddress = signer.accountAddress.toString();

  const metadata = { ok: false, error: "" };
  const rpc = { ok: false, error: "" };

  try {
    await client.coordination.getBlobMetadata({
      account: signerAddress,
      name: `${POST_PREFIX}health-check.json`
    });
    metadata.ok = true;
  } catch (error) {
    const msg = errorMessage(error);
    metadata.error = msg;
    if (msg.toLowerCase().includes("blob not found")) {
      metadata.ok = true;
    }
  }

  try {
    await client.rpc.getBlob({
      account: signerAddress,
      blobName: "nora/health/non-existent.txt"
    });
    rpc.ok = true;
  } catch (error) {
    const msg = errorMessage(error);
    rpc.error = msg;
    if (!msg.toLowerCase().includes("unauthorized")) {
      rpc.ok = true;
    }
  }

  return {
    signerAddress,
    network: process.env.SHELBY_NETWORK ?? "TESTNET",
    env: {
      hasShelbyApiKey: !!getOptionalEnv("SHELBY_API_KEY"),
      hasRpcApiKey: !!getOptionalEnv("SHELBY_RPC_API_KEY"),
      rpcEndpoint: getOptionalEnv("SHELBY_RPC_BASE_URL") ?? getDefaultNetworkEndpoints(getShelbyNetwork()).shelbyRpc ?? null,
      aptosFullnodeUrl: getOptionalEnv("SHELBY_APTOS_FULLNODE_URL") ?? getDefaultNetworkEndpoints(getShelbyNetwork()).aptosFullnode ?? null,
      aptosIndexerUrl: getOptionalEnv("SHELBY_APTOS_INDEXER_URL") ?? getDefaultNetworkEndpoints(getShelbyNetwork()).aptosIndexer ?? null
    },
    checks: {
      metadata,
      rpc
    }
  };
}

export async function getDebugBlobStats(args?: { author?: string; limit?: number }) {
  const client = getShelbyClient();
  const signer = getSigner();
  const signerAddress = signer.accountAddress.toString();
  const limit = Math.max(1, Math.min(500, args?.limit ?? 200));
  const authorFilter = typeof args?.author === "string" && args.author.trim() ? normalizeAddress(args.author) : "";

  // @ts-expect-error: AccountAddress type mismatch between workspace sdk instances
  const blobs = await client.coordination.getAccountBlobs({ account: signer.accountAddress });
  const postBlobs = blobs
    .filter((b) => Boolean(b) && b.isWritten && !b.isDeleted && typeof b.blobNameSuffix === "string")
    .map((b) => b.blobNameSuffix)
    .filter((name) => name.startsWith(POST_PREFIX))
    .slice(0, limit);

  const authors = new Map<string, number>();
  let parsedPosts = 0;
  let authorMatched = 0;
  const failures: { blobName: string; error: string }[] = [];

  for (const blobName of postBlobs) {
    try {
      const raw = await readShelbyBlobAsText(client, signerAddress, blobName);
      const post = parsePostBlob(signerAddress, `${signerAddress}/${blobName}`, raw);
      if (!post) continue;
      parsedPosts++;
      const a = normalizeAddress(post.author);
      authors.set(a, (authors.get(a) ?? 0) + 1);
      if (authorFilter && a === authorFilter) authorMatched++;
    } catch (error) {
      failures.push({ blobName, error: errorMessage(error) });
    }
  }

  return {
    signerAddress,
    network: process.env.SHELBY_NETWORK ?? "TESTNET",
    counts: {
      totalBlobs: blobs.length,
      postBlobs: postBlobs.length,
      parsedPosts,
      ...(authorFilter ? { authorMatched } : {})
    },
    topAuthors: Array.from(authors.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([author, count]) => ({ author, count })),
    sample: postBlobs.slice(0, 20),
    failures: failures.slice(0, 10)
  };
}

export async function fetchShelbyPostById(postId: string): Promise<Post | null> {
  const id = postId.trim();
  if (!id) return null;

  const slash = id.indexOf("/");
  if (slash <= 0) return null;

  const ownerAddress = id.slice(0, slash).trim();
  const blobName = id.slice(slash + 1).trim();
  if (!ownerAddress || !blobName) return null;
  if (!blobName.startsWith(POST_PREFIX)) return null;

  const client = getShelbyClient();

  try {
    const raw = await readShelbyBlobAsText(client, ownerAddress, blobName);
    const post = parsePostBlob(ownerAddress, `${ownerAddress}/${blobName}`, raw);
    if (!post) return null;

    const txMap = await getTxMappingsForBlobs([blobName]);
    const mapping = txMap.get(blobName);

    return {
      ...post,
      txHash: mapping?.tx_hash ?? post.txHash,
      txExplorerUrl: mapping?.tx_explorer_url ?? post.txExplorerUrl,
      shelbyTxExplorerUrl: mapping?.shelby_tx_explorer_url ?? post.shelbyTxExplorerUrl,
      shelbyExplorerUrl: mapping?.shelby_blob_url ?? post.shelbyExplorerUrl
    };
  } catch {
    return null;
  }
}
