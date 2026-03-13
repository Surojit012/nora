"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PostCard } from "@/components/PostCard";
import { SkeletonTweetList } from "@/components/Skeletons";
import type { Post } from "@/lib/types";

type PageProps = {
  params: {
    postId: string[];
  };
};

export default function PostPage({ params }: PageProps) {
  const mountedRef = useRef(false);
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const id = useMemo(() => (params.postId ?? []).join("/"), [params.postId]);
  const apiPath = useMemo(() => `/api/posts/${(params.postId ?? []).map(encodeURIComponent).join("/")}`, [params.postId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    async function load() {
      if (!mountedRef.current) return;
      setLoading(true);
      setError(null);
      setPost(null);

      try {
        const res = await fetch(apiPath, { cache: "no-store" });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string; details?: string } | null;
          throw new Error(payload?.error ?? "Failed to load post.");
        }
        const data = (await res.json()) as Post;
        if (mountedRef.current) setPost(data);
      } catch (e) {
        if (mountedRef.current) setError(e instanceof Error ? e.message : "Failed to load post.");
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }

    void load();
  }, [apiPath, id]);

  return (
    <AppShell>
      <div className="feed-header">
        <div className="tab-bar">
          <div className="tab active">Post</div>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        <Link href="/" className="btn-ghost" style={{ display: "inline-flex", marginBottom: 12 }}>
          Back
        </Link>
      </div>

      {loading ? <SkeletonTweetList count={2} /> : null}
      {error ? (
        <div className="tweet" style={{ cursor: "default" }}>
          <div className="avatar av-red">!!</div>
          <div className="tweet-body">
            <div className="tweet-header">
              <span className="tweet-name">Error</span>
              <span className="tweet-handle">post</span>
            </div>
            <div className="tweet-text" style={{ color: "var(--danger)" }}>
              {error}
            </div>
          </div>
        </div>
      ) : null}
      {post ? <PostCard post={post} mode="detail" /> : null}
    </AppShell>
  );
}
