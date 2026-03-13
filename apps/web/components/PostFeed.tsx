"use client";

import { useEffect, useRef, useState } from "react";
import { Post } from "@/lib/types";
import { fetchPosts } from "@/lib/shelbyClient";
import { PostCard } from "@/components/PostCard";

export function PostFeed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(false);

  async function loadPosts() {
    if (!isMountedRef.current) return;
    setLoading(true);
    setError(null);

    try {
      const data = await fetchPosts(50);
      if (isMountedRef.current) setPosts(data);
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to load posts.");
      }
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    isMountedRef.current = true;
    const onPostCreated = () => {
      void loadPosts();
    };

    void loadPosts();
    window.addEventListener("nora:post-created", onPostCreated);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener("nora:post-created", onPostCreated);
    };
  }, []);

  if (loading) {
    return <p className="px-4 py-6 text-muted">Loading feed...</p>;
  }

  if (error) {
    return <p className="px-4 py-6">{error}</p>;
  }

  if (posts.length === 0) {
    return <p className="px-4 py-6 text-muted">No posts yet.</p>;
  }

  return (
    <section>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </section>
  );
}
