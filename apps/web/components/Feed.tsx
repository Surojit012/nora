"use client";

import { useEffect, useRef, useState } from "react";
import { fetchPosts } from "@/lib/shelbyClient";
import { Post } from "@/lib/types";
import { Composer } from "@/components/Composer";
import { PostCard } from "@/components/PostCard";
import { SkeletonTweetList } from "@/components/Skeletons";

export function Feed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const [tab, setTab] = useState<"for-you" | "following" | "trending">("for-you");

  async function loadPosts() {
    if (!mountedRef.current) return;
    setLoading(true);
    setError(null);

    try {
      const data = await fetchPosts(50);
      if (mountedRef.current) {
        setPosts(data);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to load feed");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    mountedRef.current = true;

    const onPostCreated = () => {
      void loadPosts();
    };

    void loadPosts();
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

      {loading ? <SkeletonTweetList count={4} /> : null}

      {error ? (
        <div className="tweet" style={{ cursor: "default" }}>
          <div className="avatar av-red">!!</div>
          <div className="tweet-body">
            <div className="tweet-header">
              <span className="tweet-name">Error</span>
              <span className="tweet-handle">feed</span>
            </div>
            <div className="tweet-text">{error}</div>
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
    </>
  );
}
