"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PostCard } from "@/components/PostCard";
import { ExploreMediaGrid } from "@/components/ExploreMediaGrid";
import { SkeletonTweetList, SkeletonWidget } from "@/components/Skeletons";
import type { Post } from "@/lib/types";
import type { InteractionSummary } from "@/lib/interactions";
import {
  getExploreLayoutPreference,
  getExploreModePreference,
  setExploreLayoutPreference,
  setExploreModePreference
} from "@/lib/preferences";

type ExploreMode = "for_you" | "trending" | "latest";
type ExploreLayout = "feed" | "media";

type ExploreResponse = {
  posts: Post[];
  interactions: Record<string, InteractionSummary>;
};

export function ExploreFeed() {
  const { account } = useWallet();
  const viewer = account?.address?.toString() ?? "";
  const [mode, setMode] = useState<ExploreMode>(() => getExploreModePreference());
  const [layout, setLayout] = useState<ExploreLayout>(() => getExploreLayoutPreference());

  useEffect(() => {
    setExploreModePreference(mode);
  }, [mode]);

  useEffect(() => {
    setExploreLayoutPreference(layout);
  }, [layout]);

  const query = useQuery({
    queryKey: ["explore", mode, layout, viewer],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("mode", mode);
      params.set("limit", layout === "media" ? "45" : "30");
      if (layout === "media") params.set("mediaOnly", "1");
      if (viewer) params.set("viewer", viewer);

      const res = await fetch(`/api/explore?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string; details?: string } | null;
        throw new Error(payload?.details ? `${payload.error ?? "Explore failed."} ${payload.details}` : payload?.error ?? "Explore failed.");
      }
      return (await res.json()) as ExploreResponse;
    },
    staleTime: 10_000
  });

  const posts = query.data?.posts ?? [];
  const interactions = query.data?.interactions ?? {};

  const emptyState = useMemo(() => {
    if (query.isLoading) return null;
    if (query.isError) return null;
    if (posts.length > 0) return null;
    if (mode === "for_you" && !viewer) {
      return (
        <div className="tweet" style={{ cursor: "default" }}>
          <div className="avatar av-cream">..</div>
          <div className="tweet-body">
            <div className="tweet-header">
              <span className="tweet-name">For you</span>
              <span className="tweet-handle">needs wallet</span>
            </div>
            <div className="tweet-text">Connect your wallet to personalize “For you”, or switch to Trending/Latest.</div>
          </div>
        </div>
      );
    }
    return (
      <div className="tweet" style={{ cursor: "default" }}>
        <div className="avatar av-cream">..</div>
        <div className="tweet-body">
          <div className="tweet-header">
            <span className="tweet-name">Nothing</span>
            <span className="tweet-handle">yet</span>
          </div>
          <div className="tweet-text">Nothing to show yet.</div>
        </div>
      </div>
    );
  }, [mode, posts.length, query.isError, query.isLoading, viewer]);

  return (
    <>
      <div className="feed-header">
        <div className="tab-bar">
          <button type="button" className={`tab${mode === "for_you" ? " active" : ""}`} onClick={() => setMode("for_you")}>
            For you
          </button>
          <button type="button" className={`tab${mode === "trending" ? " active" : ""}`} onClick={() => setMode("trending")}>
            Trending
          </button>
          <button type="button" className={`tab${mode === "latest" ? " active" : ""}`} onClick={() => setMode("latest")}>
            Latest
          </button>
        </div>
      </div>

      <div className="widget" style={{ margin: 16 }}>
        <div className="widget-title">Explore</div>
        <div className="trend-item" style={{ cursor: "default" }}>
          <div className="trend-cat">Ranking by engagement, recency, and your interests.</div>
          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className={layout === "feed" ? "btn-primary" : "btn-ghost"} onClick={() => setLayout("feed")}>
              Feed
            </button>
            <button type="button" className={layout === "media" ? "btn-primary" : "btn-ghost"} onClick={() => setLayout("media")}>
              Media
            </button>
            <Link href="/tag/shelby" className="btn-ghost">
              Tags
            </Link>
          </div>
        </div>
      </div>

      {query.isLoading ? (
        <>
          <div style={{ padding: "0 16px 16px" }}>
            <SkeletonWidget rows={3} />
          </div>
          <SkeletonTweetList count={4} />
        </>
      ) : null}

      {query.isError ? (
        <div className="tweet" style={{ cursor: "default" }}>
          <div className="avatar av-red">!!</div>
          <div className="tweet-body">
            <div className="tweet-header">
              <span className="tweet-name">Error</span>
              <span className="tweet-handle">explore</span>
            </div>
            <div className="tweet-text" style={{ color: "var(--danger)" }}>
              {(query.error as Error).message}
            </div>
          </div>
        </div>
      ) : null}

      {emptyState}

      {!query.isLoading && !query.isError ? (
        layout === "media" ? (
          <ExploreMediaGrid posts={posts} interactions={interactions} />
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} initialInteractions={interactions[post.id]} />)
        )
      ) : null}
    </>
  );
}
