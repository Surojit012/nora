"use client";

import Link from "next/link";
import { useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Post } from "@/lib/types";
import type { Comment as PostComment, InteractionSummary } from "@/lib/interactions";
import { fetchUserByWallet } from "@/lib/identityClient";
import { Avatar } from "@/components/Avatar";

type PostCardProps = {
  post: Post;
  mode?: "feed" | "detail";
  initialInteractions?: InteractionSummary;
};

function shortenAddress(value: string) {
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

// Avatar helpers live in <Avatar />.

function formatRelativeTime(value: string) {
  const ms = Date.now() - Date.parse(value);
  if (!Number.isFinite(ms)) return "";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function renderEntities(text: string) {
  // Minimal mention/hashtag styling to match the demo.
  const parts = text.split(/(\#[a-zA-Z0-9_]+|\@[a-zA-Z0-9_]+)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("#")) {
      const tag = part.slice(1);
      return (
        <Link
          key={`${idx}-${part}`}
          href={`/tag/${encodeURIComponent(tag)}`}
          className="hashtag"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          {part}
        </Link>
      );
    }
    if (part.startsWith("@")) {
      return (
        <span key={`${idx}-${part}`} className="mention">
          {part}
        </span>
      );
    }
    return <span key={`${idx}-${part}`}>{part}</span>;
  });
}

export function PostCard({ post, mode = "feed", initialInteractions }: PostCardProps) {
  const { account, connected } = useWallet();
  const queryClient = useQueryClient();
  const [pollError, setPollError] = useState<string | null>(null);
  const [interactionError, setInteractionError] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);

  const pollOptionsCount = post.poll?.options?.length ?? 0;
  const voterAddress = account?.address?.toString() ?? "";
  const pollEndsAt = post.poll?.endsAt ? Date.parse(post.poll.endsAt) : NaN;
  const pollClosed = Number.isFinite(pollEndsAt) ? Date.now() > pollEndsAt : false;

  const pollQuery = useQuery({
    queryKey: ["poll", post.id, voterAddress],
    enabled: pollOptionsCount >= 2,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("postId", post.id);
      params.set("options", String(pollOptionsCount));
      if (voterAddress) params.set("voter", voterAddress);
      const res = await fetch(`/api/polls?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string; details?: string } | null;
        throw new Error(
          payload?.details ? `${payload.error ?? "Poll failed."} ${payload.details}` : payload?.error ?? "Poll failed."
        );
      }
      return (await res.json()) as { counts: number[]; total: number; myVote?: number };
    }
  });

  const pollVoteMutation = useMutation({
    mutationFn: async (optionIndex: number) => {
      const res = await fetch("/api/polls/vote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          postId: post.id,
          voter: voterAddress,
          optionIndex,
          options: pollOptionsCount
        })
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string; details?: string } | null;
        throw new Error(
          payload?.details ? `${payload.error ?? "Vote failed."} ${payload.details}` : payload?.error ?? "Vote failed."
        );
      }
      return true;
    },
    onSuccess: () => {
      setPollError(null);
      void queryClient.invalidateQueries({ queryKey: ["poll", post.id] });
      void queryClient.invalidateQueries({ queryKey: ["poll", post.id, voterAddress] });
    },
    onError: (err) => {
      setPollError(err instanceof Error ? err.message : "Vote failed.");
    }
  });

  const pollCounts = pollQuery.data?.counts ?? new Array(pollOptionsCount).fill(0);
  const pollTotal = pollQuery.data?.total ?? 0;
  const myVote = pollQuery.data?.myVote;
  const showResults = typeof myVote === "number" || pollClosed;

  const interactionQuery = useQuery({
    queryKey: ["interactions", post.id, voterAddress],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("postIds", post.id);
      if (voterAddress) params.set("viewer", voterAddress);
      const res = await fetch(`/api/interactions?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string; details?: string } | null;
        throw new Error(
          payload?.details
            ? `${payload.error ?? "Interactions failed."} ${payload.details}`
            : payload?.error ?? "Interactions failed."
        );
      }
      const data = (await res.json()) as { items: Record<string, InteractionSummary> };
      return (
        data.items[post.id] ?? { likes: 0, reposts: 0, comments: 0, viewerLiked: false, viewerReposted: false }
      );
    },
    initialData: initialInteractions,
    staleTime: 5_000
  });

  const toggleLikeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/interactions/like", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postId: post.id, viewer: voterAddress })
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string; details?: string } | null;
        throw new Error(payload?.details ? `${payload.error ?? "Like failed."} ${payload.details}` : payload?.error ?? "Like failed.");
      }
      return (await res.json()) as { liked: boolean };
    },
    onSuccess: () => {
      setInteractionError(null);
      void interactionQuery.refetch();
    },
    onError: (err) => setInteractionError(err instanceof Error ? err.message : "Like failed.")
  });

  const toggleRepostMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/interactions/repost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postId: post.id, viewer: voterAddress })
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string; details?: string } | null;
        throw new Error(
          payload?.details ? `${payload.error ?? "Repost failed."} ${payload.details}` : payload?.error ?? "Repost failed."
        );
      }
      return (await res.json()) as { reposted: boolean };
    },
    onSuccess: () => {
      setInteractionError(null);
      void interactionQuery.refetch();
    },
    onError: (err) => setInteractionError(err instanceof Error ? err.message : "Repost failed.")
  });

  const commentsQuery = useQuery({
    queryKey: ["comments", post.id],
    enabled: mode === "detail",
    queryFn: async () => {
      const res = await fetch(`/api/comments?postId=${encodeURIComponent(post.id)}&limit=30`, { cache: "no-store" });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string; details?: string } | null;
        throw new Error(
          payload?.details ? `${payload.error ?? "Comments failed."} ${payload.details}` : payload?.error ?? "Comments failed."
        );
      }
      return (await res.json()) as { comments: PostComment[] };
    },
    staleTime: 5_000
  });

  const createCommentMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postId: post.id, author: voterAddress, content: commentDraft })
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string; details?: string } | null;
        throw new Error(
          payload?.details ? `${payload.error ?? "Comment failed."} ${payload.details}` : payload?.error ?? "Comment failed."
        );
      }
      return (await res.json()) as { comment: PostComment };
    },
    onSuccess: () => {
      setCommentError(null);
      setCommentDraft("");
      void commentsQuery.refetch();
      void interactionQuery.refetch();
    },
    onError: (err) => setCommentError(err instanceof Error ? err.message : "Comment failed.")
  });

  const interactions =
    interactionQuery.data ??
    ({
      likes: 0,
      reposts: 0,
      comments: 0,
      bookmarks: 0,
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false
    } as InteractionSummary & { viewerBookmarked?: boolean });
  const viewerBookmarked = Boolean((interactions as unknown as { viewerBookmarked?: boolean }).viewerBookmarked);

  const Wrapper: React.ElementType = mode === "feed" ? Link : "article";
  const wrapperProps =
    mode === "feed"
      ? { href: `/post/${encodeURIComponent(post.id)}`, className: "tweet" }
      : { className: "tweet", style: { cursor: "default" } as React.CSSProperties };

  const media = post.attachments?.[0];

  const authorUserQuery = useQuery({
    queryKey: ["user-by-wallet", post.author],
    queryFn: async () => fetchUserByWallet(post.author),
    enabled: Boolean(post.author),
    staleTime: 60_000
  });

  const authorUsername = authorUserQuery.data?.username ?? "";
  const authorAvatar = authorUserQuery.data?.avatar ?? "";

  const toggleBookmarkMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/interactions/bookmark", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postId: post.id, viewer: voterAddress })
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string; details?: string } | null;
        throw new Error(
          payload?.details ? `${payload.error ?? "Bookmark failed."} ${payload.details}` : payload?.error ?? "Bookmark failed."
        );
      }
      return (await res.json()) as { bookmarked: boolean };
    },
    onSuccess: () => {
      setInteractionError(null);
      void interactionQuery.refetch();
    },
    onError: (err) => setInteractionError(err instanceof Error ? err.message : "Bookmark failed.")
  });

  return (
    <>
      <Wrapper {...wrapperProps}>
        <Link 
          href={`/profile/${encodeURIComponent(authorUsername || post.author)}`} 
          onClick={(e: React.MouseEvent) => e.stopPropagation()} 
          style={{ display: 'flex', zIndex: 10, position: 'relative' }}
        >
          <Avatar
            src={authorAvatar}
            alt={authorUsername ? `${authorUsername} avatar` : "avatar"}
            addressHint={post.author}
            label={authorUsername || post.author}
            size={36}
          />
        </Link>
        <div className="tweet-body">
          <div className="tweet-header">
            <Link 
              href={`/profile/${encodeURIComponent(authorUsername || post.author)}`} 
              className="tweet-name" 
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              style={{ position: 'relative', zIndex: 10 }}
            >
              {authorUsername ? authorUsername : shortenAddress(post.author)}
            </Link>
            <span className="tweet-handle">{authorUsername ? `@${authorUsername}` : "@wallet"}</span>
            <span className="tweet-dot">·</span>
            <span className="tweet-time" title={formatTimestamp(post.createdAt)}>
              {formatRelativeTime(post.createdAt)}
            </span>
          </div>

          <div className="tweet-text">{renderEntities(post.text)}</div>

          {media ? (
            <div className="tweet-image" onClick={(e) => e.stopPropagation()}>
              {media.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={media.url} alt="attachment" loading="lazy" />
              ) : media.kind === "video" ? (
                <video controls preload="metadata">
                  <source src={media.url} type={media.mimeType} />
                </video>
              ) : (
                <div
                  style={{
                    height: 180,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--subtle)"
                  }}
                >
                  <a href={media.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                    {media.blobName}
                  </a>
                </div>
              )}
            </div>
          ) : null}

          {post.poll?.options?.length ? (
            <div
              onClick={(e) => e.preventDefault()}
              style={{
                marginBottom: 10,
                border: "1px solid var(--border)",
                borderRadius: 12,
                overflow: "hidden"
              }}
            >
              {post.poll.options.map((opt, idx) => {
                const count = pollCounts[idx] ?? 0;
                const pct = pollTotal > 0 ? Math.round((count / pollTotal) * 100) : 0;
                const selected = typeof myVote === "number" && myVote === idx;
                const disabled = pollClosed || pollVoteMutation.isPending || (showResults && typeof myVote === "number");

                return (
                  <button
                    key={`${idx}-${opt}`}
                    type="button"
                    disabled={disabled && !selected}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPollError(null);
                      if (!connected || !voterAddress) {
                        setPollError("Connect wallet first");
                        return;
                      }
                      if (pollClosed) {
                        setPollError("Poll is closed");
                        return;
                      }
                      pollVoteMutation.mutate(idx);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      background: "transparent",
                      border: "none",
                      borderTop: idx === 0 ? "none" : "1px solid var(--border)",
                      color: "var(--text)",
                      cursor: disabled && !selected ? "not-allowed" : "pointer",
                      opacity: disabled && !selected ? 0.7 : 1,
                      position: "relative"
                    }}
                  >
                    {showResults ? (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          width: `${pollTotal ? pct : 0}%`,
                          background: "var(--card)",
                          zIndex: 0
                        }}
                      />
                    ) : null}
                    <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between" }}>
                      <span>{opt}</span>
                      {showResults ? (
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
                          {pct}% {pollTotal ? `(${count})` : ""}
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
              <div style={{ padding: "8px 12px", borderTop: "1px solid var(--border)", color: "var(--muted)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
                  {pollQuery.isLoading ? "Loading poll…" : showResults ? `${pollTotal} votes` : "Tap to vote"}
                </span>
                {pollError ? (
                  <span style={{ marginLeft: 10, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--danger)" }}>
                    {pollError}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="tweet-actions" onClick={(e) => e.preventDefault()}>
            <button
              type="button"
              className="action reply"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (mode === "feed") {
                  window.location.href = `/post/${encodeURIComponent(post.id)}#comments`;
                } else {
                  const el = document.getElementById(`comments-${post.id}`);
                  if (el) el.scrollIntoView({ block: "start" });
                }
              }}
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path
                  d="M2 5a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H6l-4 4V5z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {formatCount(interactions.comments)}
            </button>

            <button
              type="button"
              className={`action retweet${interactions.viewerReposted ? " liked" : ""}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setInteractionError(null);
                if (!connected || !voterAddress) {
                  setInteractionError("Connect wallet first");
                  return;
                }
                toggleRepostMutation.mutate();
              }}
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path
                  d="M4 8V6a2 2 0 012-2h8l-2-2M16 12v2a2 2 0 01-2 2H6l2 2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {formatCount(interactions.reposts)}
            </button>

            <button
              type="button"
              className={`action like${interactions.viewerLiked ? " liked" : ""}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setInteractionError(null);
                if (!connected || !voterAddress) {
                  setInteractionError("Connect wallet first");
                  return;
                }
                toggleLikeMutation.mutate();
              }}
            >
              <svg
                viewBox="0 0 20 20"
                fill={interactions.viewerLiked ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {formatCount(interactions.likes)}
            </button>

            <button
              type="button"
              className={`action bookmark${viewerBookmarked ? " bookmarked" : ""}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setInteractionError(null);
                if (!connected || !voterAddress) {
                  setInteractionError("Connect wallet first");
                  return;
                }
                toggleBookmarkMutation.mutate();
              }}
              aria-label="Bookmark"
            >
              <svg viewBox="0 0 20 20" fill={viewerBookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
                <path
                  d="M6 3.5h8A1.5 1.5 0 0 1 15.5 5v13l-5.5-3-5.5 3V5A1.5 1.5 0 0 1 6 3.5Z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <button
              type="button"
              className="action share"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                  void navigator.clipboard.writeText(`${window.location.origin}/post/${encodeURIComponent(post.id)}`);
                } catch {
                  // ignore
                }
              }}
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path
                  d="M4 12v1a3 3 0 006 0v-1M8 3v8M5 6l3-3 3 3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          {interactionError ? (
            <div className="tweet-text" style={{ marginTop: 10, color: "var(--danger)", fontSize: 12 }}>
              {interactionError}
            </div>
          ) : null}
        </div>
      </Wrapper>

      {mode === "detail" ? (
        <div id={`comments-${post.id}`} style={{ borderBottom: "1px solid var(--border)", padding: "14px 16px" }}>
          <div className="tweet-header" style={{ marginBottom: 8 }}>
            <span className="tweet-name">Comments</span>
            <span className="tweet-handle">{formatCount(interactions.comments)}</span>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <Avatar
              src={""}
              alt="avatar"
              addressHint={voterAddress}
              label={voterAddress}
              size={36}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <textarea
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value.slice(0, 280))}
                placeholder={connected ? "Write a comment…" : "Connect wallet to comment"}
                disabled={!connected}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: `1px solid var(--border2)`,
                  borderRadius: 12,
                  padding: "10px 12px",
                  color: "var(--text)",
                  resize: "none",
                  outline: "none",
                  minHeight: 44
                }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
                  {commentDraft.length}/280
                </span>
                {commentError ? (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--danger)" }}>
                    {commentError}
                  </span>
                ) : null}
                <div style={{ flex: 1 }} />
                <button
                  type="button"
                  className="send-btn"
                  disabled={!connected || createCommentMutation.isPending || !commentDraft.trim()}
                  onClick={() => {
                    setCommentError(null);
                    if (!connected || !voterAddress) {
                      setCommentError("Connect wallet first");
                      return;
                    }
                    if (!commentDraft.trim()) return;
                    createCommentMutation.mutate();
                  }}
                >
                  {createCommentMutation.isPending ? "Posting..." : "Post"}
                </button>
              </div>
            </div>
          </div>

          {commentsQuery.isLoading ? (
            <div className="tweet-text" style={{ marginTop: 12, color: "var(--muted)", fontSize: 12 }}>
              Loading comments…
            </div>
          ) : null}
          {commentsQuery.isError ? (
            <div className="tweet-text" style={{ marginTop: 12, color: "var(--danger)", fontSize: 12 }}>
              {(commentsQuery.error as Error)?.message ?? "Comments failed."}
            </div>
          ) : null}

          {commentsQuery.data?.comments?.length ? (
            <div style={{ marginTop: 12 }}>
              {commentsQuery.data.comments.map((c) => (
                <div key={c.id} style={{ padding: "12px 0", borderTop: "1px solid var(--border)" }}>
                  <div className="tweet-header">
                    <Link 
                      href={`/profile/${encodeURIComponent(c.author)}`} 
                      className="tweet-name"
                    >
                      {shortenAddress(c.author)}
                    </Link>
                    <span className="tweet-dot">·</span>
                    <span className="tweet-time">{formatRelativeTime(c.createdAt)}</span>
                  </div>
                  <div className="tweet-text">{c.content}</div>
                </div>
              ))}
            </div>
          ) : !commentsQuery.isLoading && !commentsQuery.isError ? (
            <div className="tweet-text" style={{ marginTop: 12, color: "var(--muted)", fontSize: 12 }}>
              No comments yet.
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
