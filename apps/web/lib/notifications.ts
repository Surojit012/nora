import "server-only";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { extractMentions } from "@/lib/mentions";
import type { PublicUser } from "@/lib/identity";

export type NotificationType = "like" | "follow" | "mention";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  recipient: string;
  actor: string;
  createdAt: string;
  postId?: string;
  entityId?: string;
  metadata: Record<string, unknown>;
  actorUser?: Pick<PublicUser, "username" | "avatar">;
};

function normalizeAddress(value: string): string {
  return value.trim().toLowerCase();
}

function parsePostId(postId: string): { owner: string; blobName: string } | null {
  const id = postId.trim();
  const slash = id.indexOf("/");
  if (slash <= 0) return null;
  const owner = id.slice(0, slash).trim();
  const blobName = id.slice(slash + 1).trim();
  if (!owner || !blobName) return null;
  return { owner, blobName };
}

async function getPostAuthorAddressFromIndex(postId: string): Promise<string> {
  const parsed = parsePostId(postId);
  if (!parsed) return "";

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("post_blobs")
    .select("author_address")
    .eq("blob_name", parsed.blobName)
    .maybeSingle();

  if (error) throw new Error(`post_blobs read failed: ${error.message}`);
  return String((data as { author_address?: string } | null)?.author_address ?? "").trim().toLowerCase();
}

async function findUsersByWalletAddresses(addresses: string[]) {
  const unique = Array.from(new Set(addresses.map((v) => normalizeAddress(v)).filter(Boolean))).slice(0, 100);
  const map = new Map<string, Pick<PublicUser, "username" | "avatar">>();
  if (unique.length === 0) return map;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("users").select("wallet_address,username,avatar").in("wallet_address", unique);
  if (error) throw new Error(`users read failed: ${error.message}`);

  for (const row of (data ?? []) as { wallet_address: string; username: string; avatar: string | null }[]) {
    map.set(normalizeAddress(row.wallet_address), { username: row.username, avatar: row.avatar ?? "" });
  }

  return map;
}

export async function listNotifications(args: { viewer: string; limit?: number }): Promise<NotificationItem[]> {
  const viewer = normalizeAddress(args.viewer);
  const limit = Math.max(1, Math.min(80, args.limit ?? 40));
  if (!viewer) throw new Error("viewer is required.");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("notification_events")
    .select("id,type,recipient_address,actor_address,post_id,entity_id,metadata,created_at")
    .eq("recipient_address", viewer)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Notifications read failed: ${error.message}`);

  const items = (data ?? []) as {
    id: string;
    type: NotificationType;
    recipient_address: string;
    actor_address: string;
    post_id: string | null;
    entity_id: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }[];

  const actorUsers = await findUsersByWalletAddresses(items.map((i) => i.actor_address));

  return items.map((row) => ({
    id: row.id,
    type: row.type,
    recipient: row.recipient_address,
    actor: row.actor_address,
    createdAt: row.created_at,
    ...(row.post_id ? { postId: row.post_id } : {}),
    ...(row.entity_id ? { entityId: row.entity_id } : {}),
    metadata: row.metadata ?? {},
    actorUser: actorUsers.get(normalizeAddress(row.actor_address))
  }));
}

async function insertEvent(args: {
  type: NotificationType;
  recipient: string;
  actor: string;
  postId?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  const recipient = normalizeAddress(args.recipient);
  const actor = normalizeAddress(args.actor);
  if (!recipient || !actor) return;
  if (recipient === actor) return;

  const supabase = getSupabaseAdmin();
  const payload = {
    type: args.type,
    recipient_address: recipient,
    actor_address: actor,
    post_id: args.postId ?? null,
    entity_id: args.entityId ?? null,
    metadata: args.metadata ?? {}
  };

  const { error } = await supabase.from("notification_events").insert(payload);
  if (error) throw new Error(`Notification write failed: ${error.message}`);
}

async function deleteEvent(args: { type: NotificationType; actor: string; postId?: string; recipient?: string }) {
  const actor = normalizeAddress(args.actor);
  if (!actor) return;

  const supabase = getSupabaseAdmin();
  let q = supabase.from("notification_events").delete().eq("type", args.type).eq("actor_address", actor);
  if (args.postId) q = q.eq("post_id", args.postId);
  if (args.recipient) q = q.eq("recipient_address", normalizeAddress(args.recipient));
  const { error } = await q;
  if (error) throw new Error(`Notification delete failed: ${error.message}`);
}

export async function emitLikeNotification(args: { postId: string; actor: string }) {
  const recipient = await getPostAuthorAddressFromIndex(args.postId);
  if (!recipient) return;
  await insertEvent({ type: "like", recipient, actor: args.actor, postId: args.postId });
}

export async function retractLikeNotification(args: { postId: string; actor: string }) {
  // We don't know recipient cheaply; delete by type+actor+postId only.
  await deleteEvent({ type: "like", actor: args.actor, postId: args.postId });
}

export async function emitFollowNotification(args: { recipient: string; actor: string }) {
  await insertEvent({ type: "follow", recipient: args.recipient, actor: args.actor });
}

export async function retractFollowNotification(args: { recipient: string; actor: string }) {
  await deleteEvent({ type: "follow", actor: args.actor, recipient: args.recipient });
}

export async function emitMentionsFromText(args: { text: string; actor: string; postId: string; entityId?: string }) {
  const mentions = extractMentions(args.text);
  if (mentions.length === 0) return;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("users").select("username,wallet_address").in("username", mentions);
  if (error) throw new Error(`User lookup failed: ${error.message}`);

  for (const row of (data ?? []) as { username: string; wallet_address: string }[]) {
    const recipient = normalizeAddress(row.wallet_address);
    if (!recipient) continue;
    await insertEvent({
      type: "mention",
      recipient,
      actor: args.actor,
      postId: args.postId,
      ...(args.entityId ? { entityId: args.entityId } : {}),
      metadata: { username: row.username }
    });
  }
}

export async function toggleFollow(args: { follower: string; following: string }) {
  const follower = normalizeAddress(args.follower);
  const following = normalizeAddress(args.following);
  if (!follower) throw new Error("Connect wallet first.");
  if (!following) throw new Error("following is required.");
  if (follower === following) throw new Error("You cannot follow yourself.");

  const supabase = getSupabaseAdmin();

  const { data: existing, error: existsErr } = await supabase
    .from("follows")
    .select("follower_address")
    .eq("follower_address", follower)
    .eq("following_address", following)
    .maybeSingle();
  if (existsErr) throw new Error(`Follow read failed: ${existsErr.message}`);

  if (existing) {
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_address", follower)
      .eq("following_address", following);
    if (error) throw new Error(`Unfollow failed: ${error.message}`);
    await retractFollowNotification({ recipient: following, actor: follower });
    const followersCount = await getFollowersCount(following);
    await updateFollowersCount(following, followersCount);
    return { following: false, followersCount };
  }

  const { error } = await supabase.from("follows").insert({ follower_address: follower, following_address: following });
  if (error) throw new Error(`Follow failed: ${error.message}`);
  await emitFollowNotification({ recipient: following, actor: follower });
  const followersCount = await getFollowersCount(following);
  await updateFollowersCount(following, followersCount);
  return { following: true, followersCount };
}

export async function isFollowing(args: { follower: string; following: string }): Promise<boolean> {
  const follower = normalizeAddress(args.follower);
  const following = normalizeAddress(args.following);
  if (!follower || !following) return false;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("follows")
    .select("follower_address")
    .eq("follower_address", follower)
    .eq("following_address", following)
    .maybeSingle();
  if (error) throw new Error(`Follow read failed: ${error.message}`);
  return Boolean(data);
}

async function getFollowersCount(walletAddress: string): Promise<number> {
  const addr = normalizeAddress(walletAddress);
  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from("follows")
    .select("follower_address", { count: "exact", head: true })
    .eq("following_address", addr);
  if (error) throw new Error(`Followers count failed: ${error.message}`);
  return typeof count === "number" ? count : 0;
}

async function updateFollowersCount(walletAddress: string, followersCount: number) {
  const addr = normalizeAddress(walletAddress);
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("users").update({ followers_count: followersCount }).eq("wallet_address", addr);
  if (error) {
    // Best-effort; doesn't block follow flow.
    console.warn("[followers_count] update failed:", error.message);
  }
}

