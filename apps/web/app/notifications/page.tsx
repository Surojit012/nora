"use client";

import { AppShell } from "@/components/AppShell";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { SkeletonWidget } from "@/components/Skeletons";

type NotificationItem = {
  id: string;
  type: "like" | "follow" | "mention";
  actor: string;
  createdAt: string;
  postId?: string;
  metadata?: Record<string, unknown>;
  actorUser?: { username: string; avatar: string };
};

function shorten(value: string) {
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function icon(type: NotificationItem["type"]) {
  if (type === "like") return "M12 21s-7-4.4-9.3-8.1C.5 10.1 2 7.5 5 7.1c1.7-.2 3.1.7 4 1.8.9-1.1 2.3-2 4-1.8 3 .4 4.5 3 2.3 5.8C19 16.6 12 21 12 21Z";
  if (type === "follow") return "M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2";
  return "M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z";
}

function label(type: NotificationItem["type"], meta?: Record<string, unknown>) {
  if (type === "like") return "liked your post";
  if (type === "follow") return "followed you";
  const username = typeof meta?.username === "string" ? meta.username : "";
  return username ? `mentioned you (@${username})` : "mentioned you";
}

export default function NotificationsPage() {
  const { account, connected } = useWallet();
  const viewer = account?.address?.toString() ?? "";

  const query = useQuery({
    queryKey: ["notifications", viewer],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("viewer", viewer);
      params.set("limit", "50");
      const res = await fetch(`/api/notifications?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string; details?: string } | null;
        throw new Error(payload?.details ? `${payload.error ?? "Failed."} ${payload.details}` : payload?.error ?? "Failed.");
      }
      const data = (await res.json()) as { items: NotificationItem[] };
      return data.items ?? [];
    },
    enabled: Boolean(connected && viewer),
    staleTime: 5_000
  });

  const items = query.data ?? [];

  return (
    <AppShell>
      <div className="feed-header">
        <div className="tab-bar">
          <div className="tab active">Notifications</div>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {!connected ? (
          <div className="widget">
            <div className="widget-title">Connect wallet</div>
            <div className="trend-item" style={{ cursor: "default" }}>
              <div className="trend-cat">Connect wallet to see notifications.</div>
            </div>
          </div>
        ) : null}

        {query.isLoading ? (
          <SkeletonWidget rows={5} />
        ) : null}

        {query.isError ? (
          <div className="widget">
            <div className="widget-title">Error</div>
            <div className="trend-item" style={{ cursor: "default" }}>
              <div className="trend-cat" style={{ color: "var(--danger)" }}>
                {(query.error as Error).message}
              </div>
            </div>
          </div>
        ) : null}

        {connected && !query.isLoading && !query.isError && items.length === 0 ? (
          <div className="widget">
            <div className="widget-title">All caught up</div>
            <div className="trend-item" style={{ cursor: "default" }}>
              <div className="trend-cat">No notifications yet.</div>
            </div>
          </div>
        ) : null}

        {connected && !query.isLoading && !query.isError && items.length > 0 ? (
          <div className="widget">
            <div className="widget-title">Recent</div>
            {items.map((n) => {
              const actorLabel = n.actorUser?.username ? `@${n.actorUser.username}` : shorten(n.actor);
              const href =
                n.type === "like" || n.type === "mention"
                  ? n.postId
                    ? `/post/${n.postId}`
                    : null
                  : null;

              const Row: React.ElementType = href ? Link : "div";
              const rowProps = href ? { href } : {};

              return (
                <Row key={n.id} className="trend-item" {...rowProps}>
                  <div className="trend-cat" style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <svg
                        viewBox="0 0 24 24"
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d={icon(n.type)} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <Link 
                        href={`/profile/${encodeURIComponent(n.actorUser?.username || n.actor)}`} 
                        style={{ fontFamily: "var(--font-mono)", position: "relative", zIndex: 10 }}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        className="hover:underline"
                      >
                        {actorLabel}
                      </Link>
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)" }}>{formatTime(n.createdAt)}</span>
                  </div>
                  <div className="trend-name">{label(n.type, n.metadata)}</div>
                  {href ? <div className="trend-count">View</div> : <div className="trend-count"> </div>}
                </Row>
              );
            })}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
