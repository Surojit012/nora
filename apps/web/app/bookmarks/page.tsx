"use client";

import { AppShell } from "@/components/AppShell";
import { PostCard } from "@/components/PostCard";
import { SkeletonTweetList } from "@/components/Skeletons";
import type { Post } from "@/lib/types";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";

export default function BookmarksPage() {
  const { account, connected } = useWallet();
  const viewer = account?.address?.toString() ?? "";

  const query = useQuery({
    queryKey: ["bookmarks", viewer],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("viewer", viewer);
      params.set("limit", "50");
      const res = await fetch(`/api/bookmarks?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string; details?: string } | null;
        throw new Error(payload?.details ? `${payload.error ?? "Failed."} ${payload.details}` : payload?.error ?? "Failed.");
      }
      return (await res.json()) as Post[];
    },
    enabled: Boolean(connected && viewer),
    staleTime: 5_000
  });

  const posts = query.data ?? [];

  return (
    <AppShell>
      <div className="feed-header">
        <div className="tab-bar">
          <div className="tab active">Bookmarks</div>
        </div>
      </div>

      {!connected ? (
        <div className="tweet" style={{ cursor: "default" }}>
          <div className="avatar av-cream">..</div>
          <div className="tweet-body">
            <div className="tweet-header">
              <span className="tweet-name">Connect</span>
              <span className="tweet-handle">wallet</span>
            </div>
            <div className="tweet-text">Connect wallet to see your bookmarks.</div>
          </div>
        </div>
      ) : null}

      {query.isLoading ? <SkeletonTweetList count={4} /> : null}

      {query.isError ? (
        <div className="tweet" style={{ cursor: "default" }}>
          <div className="avatar av-red">!!</div>
          <div className="tweet-body">
            <div className="tweet-header">
              <span className="tweet-name">Error</span>
              <span className="tweet-handle">bookmarks</span>
            </div>
            <div className="tweet-text" style={{ color: "var(--danger)" }}>
              {(query.error as Error).message}
            </div>
          </div>
        </div>
      ) : null}

      {connected && !query.isLoading && !query.isError && posts.length === 0 ? (
        <div className="tweet" style={{ cursor: "default" }}>
          <div className="avatar av-cream">..</div>
          <div className="tweet-body">
            <div className="tweet-header">
              <span className="tweet-name">No bookmarks</span>
              <span className="tweet-handle">yet</span>
            </div>
            <div className="tweet-text">Bookmark posts to save them here.</div>
          </div>
        </div>
      ) : null}

      {connected && !query.isLoading && !query.isError ? posts.map((p) => <PostCard key={p.id} post={p} />) : null}
    </AppShell>
  );
}

