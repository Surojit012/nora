"use client";

import Link from "next/link";
import type { Post } from "@/lib/types";
import type { InteractionSummary } from "@/lib/interactions";

function shorten(value: string) {
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function pickMedia(post: Post) {
  const att = (post.attachments ?? []).find((a) => a.kind === "image" || a.kind === "video");
  if (!att) return null;
  return att;
}

function MosaicItem({
  post,
  interactions,
}: {
  post: Post;
  interactions: InteractionSummary | undefined;
}) {
  const media = pickMedia(post);
  if (!media) return null;

  return (
    <Link
      href={`/post/${post.id}`}
      className="mosaic-item"
    >
      {media.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media.url} alt="Attachment" loading="lazy" />
      ) : (
        <video
          src={media.url}
          preload="metadata"
          muted
          playsInline
        />
      )}

      <div style={{ position: "absolute", left: 10, top: 10, display: "flex", gap: 8, alignItems: "center" }}>
        <span className="chip">{media.kind === "image" ? "Image" : "Video"}</span>
        {typeof interactions?.likes === "number" && interactions.likes > 0 ? (
          <span className="chip">{interactions.likes} likes</span>
        ) : null}
      </div>

      <div style={{ position: "absolute", left: 10, right: 10, bottom: 10 }}>
        <div className="chip" style={{ width: "100%", justifyContent: "space-between" }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shorten(post.author)}</span>
          <span style={{ color: "var(--muted)" }}> </span>
        </div>
      </div>
    </Link>
  );
}

export function ExploreMediaGrid({
  posts,
  interactions
}: {
  posts: Post[];
  interactions: Record<string, InteractionSummary>;
}) {
  const mediaPosts = posts.filter((p) => (p.attachments ?? []).some((a) => a.kind === "image" || a.kind === "video"));

  if (mediaPosts.length === 0) {
    return (
      <div className="tweet" style={{ cursor: "default" }}>
        <div className="avatar av-cream">..</div>
        <div className="tweet-body">
          <div className="tweet-header">
            <span className="tweet-name">No media</span>
            <span className="tweet-handle">yet</span>
          </div>
          <div className="tweet-text">No media posts yet.</div>
        </div>
      </div>
    );
  }

  return <div className="mosaic">{mediaPosts.map((post) => <MosaicItem key={post.id} post={post} interactions={interactions[post.id]} />)}</div>;
}
