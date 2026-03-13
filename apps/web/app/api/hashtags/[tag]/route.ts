import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { ShelbyNodeClient } from "@shelby-protocol/sdk/node";
import { Account, Ed25519PrivateKey, Network } from "@aptos-labs/ts-sdk";
import { Post } from "@/lib/types";

type RouteContext = { params: { tag: string } };

function error(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getShelbyNetwork(): Network {
  const configured = process.env.SHELBY_NETWORK?.trim()?.toLowerCase();
  if (!configured) return Network.TESTNET;
  if (configured === "testnet") return Network.TESTNET;
  if (configured === "shelbynet") return Network.SHELBYNET;
  if (configured === "local") return Network.LOCAL;
  return Network.TESTNET;
}

function getSigner(): Account {
  const privateKeyHex = getRequiredEnv("SHELBY_SIGNER_PRIVATE_KEY");
  const privateKey = new Ed25519PrivateKey(privateKeyHex);
  return Account.fromPrivateKey({ privateKey });
}

function getShelbyClient(): ShelbyNodeClient {
  const apiKey = getRequiredEnv("SHELBY_API_KEY");
  const network = getShelbyNetwork();

  const rpcBaseUrl = process.env.SHELBY_RPC_BASE_URL?.trim();
  const rpcApiKey = process.env.SHELBY_RPC_API_KEY?.trim();
  const aptosFullnode = process.env.SHELBY_APTOS_FULLNODE_URL?.trim();
  const aptosIndexer = process.env.SHELBY_APTOS_INDEXER_URL?.trim();
  const aptosApiKey = process.env.SHELBY_APTOS_API_KEY?.trim();

  return new ShelbyNodeClient(
    {
      network,
      apiKey,
      ...(aptosFullnode || aptosIndexer
        ? {
            aptos: {
              ...(aptosFullnode ? { fullnode: aptosFullnode } : {}),
              ...(aptosIndexer ? { indexer: aptosIndexer } : {}),
              clientConfig: {
                API_KEY: aptosApiKey ?? apiKey
              }
            }
          }
        : {}),
      ...(rpcBaseUrl || rpcApiKey
        ? {
            rpc: {
              ...(rpcBaseUrl ? { baseUrl: rpcBaseUrl } : {}),
              apiKey: rpcApiKey ?? apiKey
            }
          }
        : {})
    } as never
  );
}

async function downloadPost(client: ShelbyNodeClient, account: string, blobName: string): Promise<Post | null> {
  try {
    const blob = await client.download({ account, blobName });
    const raw = await new Response(blob.readable).text();
    const parsed = JSON.parse(raw) as { type?: string; author?: string; content?: string; timestamp?: number };
    if (parsed.type !== "post") return null;
    if (!parsed.author || !parsed.content || typeof parsed.timestamp !== "number") return null;
    return {
      id: `${account}/${blobName}`,
      author: String(parsed.author),
      text: String(parsed.content),
      createdAt: new Date(parsed.timestamp).toISOString()
    };
  } catch {
    console.warn("[GET /api/hashtags/:tag] Failed to download post blob:", { account, blobName });
    return null;
  }
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const tag = String(context.params.tag ?? "").trim().toLowerCase();
    if (!tag) return error(400, "Tag is required.");

    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit") ?? 20)));

    const supabase = getSupabaseAdmin();
    const { data, error: dbError } = await supabase
      .from("post_hashtags")
      .select("blob_name, post_timestamp")
      .eq("tag", tag)
      .order("post_timestamp", { ascending: false })
      .limit(limit);

    if (dbError) return error(500, dbError.message);

    const signer = getSigner();
    const client = getShelbyClient();
    const account = signer.accountAddress.toString();
    const blobNames = (data ?? []) as { blob_name: string }[];

    const posts = await Promise.all(blobNames.map((row) => downloadPost(client, account, row.blob_name)));
    return NextResponse.json(posts.filter((p): p is Post => p !== null));
  } catch (e) {
    return error(500, e instanceof Error ? e.message : "Failed to fetch hashtag feed.");
  }
}
