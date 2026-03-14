"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type UserResult = {
  username: string;
  avatar: string | null;
  bio: string | null;
  created_at: string;
};

export function SearchResults() {
  const params = useSearchParams();
  const q = (params.get("q") ?? "").trim();
  const mountedRef = useRef(false);
  const [users, setUsers] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    async function run() {
      if (!q) {
        setUsers([]);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/search/users?q=${encodeURIComponent(q)}&limit=15`, { cache: "no-store" });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string; details?: string } | null;
          throw new Error(payload?.details ? `${payload.error ?? "Search failed."} ${payload.details}` : payload?.error ?? "Search failed.");
        }
        const data = (await res.json()) as { users: UserResult[] };
        if (mountedRef.current) setUsers(data.users ?? []);
      } catch (e) {
        if (mountedRef.current) setError(e instanceof Error ? e.message : "Search failed.");
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }

    void run();
  }, [q]);

  return (
    <>
      <div className="feed-header">
        <div className="tab-bar">
          <div className="tab active">Search</div>
        </div>
      </div>

      {!q ? (
        <div className="tweet" style={{ cursor: "default" }}>
          <div className="avatar av-cream">..</div>
          <div className="tweet-body">
            <div className="tweet-header">
              <span className="tweet-name">Search</span>
              <span className="tweet-handle">users</span>
            </div>
            <div className="tweet-text">Type a username in the search bar.</div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="tweet" style={{ cursor: "default" }}>
          <div className="avatar av-cream">..</div>
          <div className="tweet-body">
            <div className="tweet-header">
              <span className="tweet-name">Searching</span>
              <span className="tweet-handle">@{q}</span>
            </div>
            <div className="tweet-text">Looking up users…</div>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="tweet" style={{ cursor: "default" }}>
          <div className="avatar av-red">!!</div>
          <div className="tweet-body">
            <div className="tweet-header">
              <span className="tweet-name">Error</span>
              <span className="tweet-handle">search</span>
            </div>
            <div className="tweet-text" style={{ color: "var(--danger)" }}>{error}</div>
          </div>
        </div>
      ) : null}

      {!loading && !error && q && users.length === 0 ? (
        <div className="tweet" style={{ cursor: "default" }}>
          <div className="avatar av-cream">..</div>
          <div className="tweet-body">
            <div className="tweet-header">
              <span className="tweet-name">No users</span>
              <span className="tweet-handle">@{q}</span>
            </div>
            <div className="tweet-text">No usernames match this query.</div>
          </div>
        </div>
      ) : null}

      {!loading && !error
        ? users.map((user) => (
            <Link key={user.username} href={`/profile/${encodeURIComponent(user.username)}`} className="tweet">
              {user.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar} alt={user.username} className="avatar" />
              ) : (
                <div className="avatar av-gold">{user.username.slice(0, 2).toUpperCase()}</div>
              )}
              <div className="tweet-body">
                <div className="tweet-header">
                  <span className="tweet-name">@{user.username}</span>
                  <span className="tweet-handle">user</span>
                </div>
                <div className="tweet-text">{user.bio || "No bio yet."}</div>
              </div>
            </Link>
          ))
        : null}
    </>
  );
}
