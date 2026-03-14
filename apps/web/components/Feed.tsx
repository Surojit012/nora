"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Post } from "@/lib/types";
import { Composer } from "@/components/Composer";
import { PostCard } from "@/components/PostCard";
import { SkeletonTweetList } from "@/components/Skeletons";
import type { InteractionSummary } from "@/lib/interactions";

export function Feed() {
  const { account } = useWallet();
  const viewer = account?.address?.toString() ?? "";
  const queryClient = useQueryClient();
  const mountedRef = useRef(false);
  const [tab, setTab] = useState<"for-you" | "following" | "trending">("for-you");

  useEffect(() => {
    mountedRef.current = true;

    const onPostCreated = () => {
      if (mountedRef.current) {
        void queryClient.invalidateQueries({ queryKey: ["feed"] });
      }
    };

    // initial load is handled by the query below
    window.addEventListener("nora:post-created", onPostCreated);

    const onOpenComposer = () => {
      const el = document.getElementById("nora-composer");
      if (el) el.scrollIntoView({ block: "start" });
    };
    window.addEventListener("nora:open-composer", onOpenComposer);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("nora:post-created", onPostCreated);
      window.removeEventListener("nora:open-composer", onOpenComposer);
    };
  }, []);

  const query = useQuery({
    queryKey: ["feed", tab, viewer],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("mode", tab === "for-you" ? "for_you" : tab);
      params.set("limit", "50");
      if (viewer) params.set("viewer", viewer);

      const res = await fetch(`/api/feed?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string; details?: string } | null;
        throw new Error(payload?.details ? `${payload.error ?? "Feed failed."} ${payload.details}` : payload?.error ?? "Feed failed.");
      }
      return (await res.json()) as { posts: Post[]; interactions: Record<string, InteractionSummary> };
    },
    staleTime: 10_000
  });

  const posts = query.data?.posts ?? [];
  const interactions = query.data?.interactions ?? {};

  return (
    <>
      <div className="feed-header">
        <div className="tab-bar">
          <button
            type="button"
            className={`tab${tab === "for-you" ? " active" : ""}`}
            onClick={() => setTab("for-you")}
          >
            For you
          </button>
          <button
            type="button"
            className={`tab${tab === "following" ? " active" : ""}`}
            onClick={() => setTab("following")}
          >
            Following
          </button>
          <button
            type="button"
            className={`tab${tab === "trending" ? " active" : ""}`}
            onClick={() => setTab("trending")}
          >
            Trending
          </button>
        </div>
      </div>

      <div id="nora-composer">
        <Composer />
      </div>

      {query.isLoading ? <SkeletonTweetList count={4} /> : null}

      {query.isError ? (
        <div className="tweet" style={{ cursor: "default" }}>
          <div className="avatar av-red">!!</div>
          <div className="tweet-body">
            <div className="tweet-header">
              <span className="tweet-name">Error</span>
              <span className="tweet-handle">feed</span>
            </div>
            <div className="tweet-text">{(query.error as Error).message}</div>
          </div>
        </div>
      ) : null}

      {!query.isLoading && !query.isError && posts.length === 0 ? (
        <div className="tweet" style={{ cursor: "default" }}>
          <div className="avatar av-cream">..</div>
          <div className="tweet-body">
            <div className="tweet-header">
              <span className="tweet-name">No posts</span>
              <span className="tweet-handle">yet</span>
            </div>
            <div className="tweet-text">
              {tab === "following" && !viewer
                ? "Connect wallet to see posts from people you follow."
                : tab === "following"
                  ? "No posts yet. Follow some people to populate this feed."
                  : "No posts yet."}
            </div>
          </div>
        </div>
      ) : null}

      {!query.isLoading && !query.isError
        ? posts.map((post) => (
            <PostCard key={post.id} post={post} initialInteractions={interactions[post.id]} />
          ))
        : null}
    </>
  );
}
