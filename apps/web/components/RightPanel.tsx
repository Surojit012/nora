"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { FollowButton } from "@/components/FollowButton";

type TrendingItem = { tag: string; count: number };
type TrendingResponse = { last24h: TrendingItem[]; last7d: TrendingItem[] };

type TopCreator = {
  username: string;
  walletAddress: string;
  avatar: string;
  followersCount: number;
};

export function RightPanel() {
  const mountedRef = useRef(false);
  const { account } = useWallet();
  const viewer = account?.address?.toString() ?? "";
  const router = useRouter();
  const [trending, setTrending] = useState<TrendingResponse | null>(null);
  const [creators, setCreators] = useState<TopCreator[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    mountedRef.current = true;
    async function load() {
      try {
        const [trendingRes, creatorsRes] = await Promise.all([
          fetch("/api/hashtags/trending?limit=8", { cache: "no-store" }),
          fetch(`/api/suggestions/top-creators?limit=3&viewer=${encodeURIComponent(viewer)}`, { cache: "no-store" })
        ]);

        if (trendingRes.ok) {
          const data = (await trendingRes.json()) as TrendingResponse;
          if (mountedRef.current) setTrending(data);
        }

        if (creatorsRes.ok) {
          const data = (await creatorsRes.json()) as { creators?: TopCreator[] };
          if (mountedRef.current) setCreators((data.creators ?? []).slice(0, 3));
        }
      } catch {
        // ignore
      }
    }

    void load();
    return () => {
      mountedRef.current = false;
    };
  }, [viewer]);

  const tags = trending?.last24h?.length ? trending.last24h : [];

  return (
    <>
      <form
        className="search-bar"
        onSubmit={(e) => {
          e.preventDefault();
          const value = search.trim();
          if (!value) return;
          router.push(`/search?q=${encodeURIComponent(value)}`);
        }}
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="5" />
          <path d="M14 14l3 3" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          placeholder="Search usernames"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </form>

      <div className="widget">
        <div className="widget-title">Trends for you</div>
        {tags.length === 0 ? (
          <div className="trend-item">
            <div className="trend-cat">No trends</div>
            <div className="trend-name">Post with a hashtag to get started</div>
            <div className="trend-count"> </div>
          </div>
        ) : (
          tags.slice(0, 6).map((item) => (
            <Link key={item.tag} href={`/tag/${encodeURIComponent(item.tag)}`} className="trend-item">
              <div className="trend-cat">Trending</div>
              <div className="trend-name">#{item.tag}</div>
              <div className="trend-count">{formatCount(item.count)} posts</div>
            </Link>
          ))
        )}
      </div>

      <div className="widget">
        <div className="widget-title">Who to follow</div>
        {creators.length === 0 ? (
          <div className="trend-item" style={{ cursor: "default" }}>
            <div className="trend-cat">No creators yet.</div>
            <div className="trend-name">Be the first to publish.</div>
            <div className="trend-count"> </div>
          </div>
        ) : (
          creators.map((c, idx) => (
            <div key={c.walletAddress} className="who-item">
              <Link href={`/profile/${encodeURIComponent(c.username)}`} className="who-link" aria-label={`View ${c.username} profile`}>
                {c.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.avatar}
                    alt={c.username}
                    className="avatar"
                    style={{ width: 38, height: 38, objectFit: "cover" }}
                  />
                ) : (
                  <div className={`avatar ${avatarForIndex(idx)}`} style={{ width: 38, height: 38 }}>
                    {c.username.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="who-info">
                  <div className="who-name">@{c.username}</div>
                  <div className="who-handle">{formatCount(c.followersCount)} followers</div>
                </div>
              </Link>
              <FollowButton targetAddress={c.walletAddress} className="follow-btn" />
            </div>
          ))
        )}
      </div>

      <div className="footer-links">
        <Link href="/settings#terms">Terms</Link>
        <Link href="/settings#privacy">Privacy</Link>
        <Link href="/settings#cookies">Cookies</Link>
        <Link href="/settings#accessibility">Accessibility</Link>
        <Link href="/settings#ads">Ads info</Link>
        <Link href="/settings#more">More</Link>
        <span style={{ color: "var(--subtle)", marginTop: 4, width: "100%" }}>© 2026 nora</span>
      </div>
    </>
  );
}

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function avatarForIndex(idx: number) {
  const classes = ["av-teal", "av-blue", "av-cream", "av-red", "av-gold"];
  return classes[idx % classes.length] ?? "av-gold";
}
