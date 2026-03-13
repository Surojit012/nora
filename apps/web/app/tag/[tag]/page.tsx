"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PostCard } from "@/components/PostCard";
import { SkeletonTweetList } from "@/components/Skeletons";
import { Post } from "@/lib/types";

type TagPageProps = {
  params: { tag: string };
};

export default function TagPage({ params }: TagPageProps) {
  const mountedRef = useRef(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tag = decodeURIComponent(params.tag);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/hashtags/${encodeURIComponent(tag)}?limit=25`, { cache: "no-store" });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Failed to load hashtag feed.");
        }
        const data = (await res.json()) as Post[];
        if (mountedRef.current) setPosts(data);
      } catch (e) {
        if (mountedRef.current) setError(e instanceof Error ? e.message : "Failed to load hashtag feed.");
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }

    void load();
  }, [tag]);

  return (
    <AppShell>
      <div className="feed-header">
        <div className="tab-bar">
          <div className="tab active">#{tag}</div>
        </div>
      </div>

      {loading ? <SkeletonTweetList count={4} /> : null}
      {error ? (
        <div className="tweet" style={{ cursor: "default" }}>
          <div className="avatar av-red">!!</div>
          <div className="tweet-body">
            <div className="tweet-header">
              <span className="tweet-name">Error</span>
              <span className="tweet-handle">tag</span>
            </div>
            <div className="tweet-text" style={{ color: "var(--danger)" }}>
              {error}
            </div>
          </div>
        </div>
      ) : null}

      {!loading && !error && posts.length === 0 ? (
        <div className="tweet" style={{ cursor: "default" }}>
          <div className="avatar av-cream">..</div>
          <div className="tweet-body">
            <div className="tweet-header">
              <span className="tweet-name">No posts</span>
              <span className="tweet-handle">yet</span>
            </div>
            <div className="tweet-text">No posts yet.</div>
          </div>
        </div>
      ) : null}

      {!loading && !error ? posts.map((post) => <PostCard key={post.id} post={post} />) : null}
    </AppShell>
  );
}
