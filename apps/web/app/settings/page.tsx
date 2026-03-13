"use client";

import { AppShell } from "@/components/AppShell";
import { WalletButton } from "@/components/WalletButton";
import {
  getExploreLayoutPreference,
  getExploreModePreference,
  setExploreLayoutPreference,
  setExploreModePreference
} from "@/lib/preferences";
import { applyThemePreference, getThemePreference, setThemePreference, type ThemePreference } from "@/lib/theme";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type HealthShelby = {
  signerAddress: string;
  network: string;
  checks: { metadata: { ok: boolean; error: string }; rpc: { ok: boolean; error: string } };
};

export default function SettingsPage() {
  const { connected, account } = useWallet();
  const viewer = account?.address?.toString() ?? "";
  const queryClient = useQueryClient();
  const mountedRef = useRef(false);

  const [username, setUsername] = useState<string>("");
  const [identityError, setIdentityError] = useState<string>("");

  const [exploreLayout, setExploreLayout] = useState<"feed" | "media">(() => getExploreLayoutPreference());
  const [exploreMode, setExploreMode] = useState<"for_you" | "trending" | "latest">(() => getExploreModePreference());
  const [theme, setTheme] = useState<ThemePreference>(() => getThemePreference());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Ensure settings reflect the actual applied theme.
    applyThemePreference(theme);
  }, [theme]);

  useEffect(() => {
    setExploreLayoutPreference(exploreLayout);
  }, [exploreLayout]);

  useEffect(() => {
    setExploreModePreference(exploreMode);
  }, [exploreMode]);

  useEffect(() => {
    async function loadIdentity() {
      if (!connected || !viewer) {
        setUsername("");
        setIdentityError("");
        return;
      }
      try {
        const res = await fetch(`/user/by-wallet?wallet_address=${encodeURIComponent(viewer)}`, { cache: "no-store" });
        if (!res.ok) {
          setUsername("");
          setIdentityError(res.status === 404 ? "No profile found for this wallet." : "Failed to load profile.");
          return;
        }
        const user = (await res.json()) as { username?: string };
        if (!mountedRef.current) return;
        setUsername(String(user.username ?? ""));
        setIdentityError("");
      } catch (e) {
        if (!mountedRef.current) return;
        setUsername("");
        setIdentityError(e instanceof Error ? e.message : "Failed to load profile.");
      }
    }
    void loadIdentity();
  }, [connected, viewer]);

  const shelbyHealth = useQuery({
    queryKey: ["health", "shelby"],
    queryFn: async () => {
      const res = await fetch("/api/health/shelby", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as HealthShelby | { error?: string; details?: string } | null;
      if (!res.ok) {
        const msg =
          data && "error" in data
            ? `${data.error ?? "Shelby health failed."}${data.details ? ` ${data.details}` : ""}`
            : "Shelby health failed.";
        throw new Error(msg);
      }
      return data as HealthShelby;
    },
    staleTime: 10_000
  });

  const supabaseHealth = useQuery({
    queryKey: ["health", "supabase"],
    queryFn: async () => {
      const res = await fetch("/api/health/supabase", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; details?: string } | null;
      if (!res.ok) throw new Error(data?.details ?? data?.error ?? "Supabase health failed.");
      return data ?? { ok: true };
    },
    staleTime: 10_000
  });

  const clearCache = useMutation({
    mutationFn: async () => {
      queryClient.clear();
      return true;
    }
  });

  const profileHref = useMemo(() => {
    if (!connected) return "/profile";
    if (username) return `/profile/${encodeURIComponent(username)}`;
    return "/onboarding";
  }, [connected, username]);

  return (
    <AppShell>
      <div className="feed-header">
        <div className="tab-bar">
          <div className="tab active">Settings</div>
        </div>
      </div>

      <div style={{ padding: "16px" }}>
        <div className="widget" style={{ marginBottom: 16 }}>
          <div className="widget-title">Account</div>
          <div className="trend-item" style={{ cursor: "default" }}>
            <div className="trend-cat">Wallet connection is your identity.</div>
            <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <WalletButton />
              <Link href={profileHref} className="follow-btn" style={{ borderRadius: 20, padding: "7px 16px" }}>
                {username ? "Open Profile" : connected ? "Create Profile" : "Profile"}
              </Link>
            </div>
            <div style={{ marginTop: 10, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
              {connected ? viewer : "Not connected."}
            </div>
            {identityError ? (
              <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--danger)" }}>
                {identityError}
              </div>
            ) : null}
          </div>
        </div>

        <div className="widget" style={{ marginBottom: 16 }}>
          <div className="widget-title">Appearance</div>
          <div className="trend-item" style={{ cursor: "default" }}>
            <div className="trend-cat">Switch between Shelby Dark and Shelby Light.</div>
            <div className="search-bar" style={{ marginTop: 10, borderRadius: 12 }}>
              <select
                value={theme}
                onChange={(e) => {
                  const next = (e.target.value === "light" ? "light" : "dark") as ThemePreference;
                  setTheme(next);
                  setThemePreference(next);
                }}
              >
                <option value="dark">Dark (default)</option>
                <option value="light">Light</option>
              </select>
            </div>
            <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
              Stored locally as nora.theme
            </div>
          </div>
        </div>

        <div className="widget" style={{ marginBottom: 16 }}>
          <div className="widget-title">Explore Preferences</div>
          <div className="trend-item" style={{ cursor: "default" }}>
            <div className="trend-cat">Controls the default Explore experience.</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <div>
                <div className="trend-cat">Default tab</div>
                <div className="search-bar" style={{ marginTop: 6, borderRadius: 12 }}>
                  <select value={exploreMode} onChange={(e) => setExploreMode(e.target.value as never)}>
                    <option value="for_you">For you</option>
                    <option value="trending">Trending</option>
                    <option value="latest">Latest</option>
                  </select>
                </div>
              </div>
              <div>
                <div className="trend-cat">Default layout</div>
                <div className="search-bar" style={{ marginTop: 6, borderRadius: 12 }}>
                  <select value={exploreLayout} onChange={(e) => setExploreLayout(e.target.value as never)}>
                    <option value="feed">Feed</option>
                    <option value="media">Media grid</option>
                  </select>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
              Preferences are stored locally in your browser.
            </div>
          </div>
        </div>

        <div className="widget" style={{ marginBottom: 16 }}>
          <div className="widget-title">System Status</div>
          <div className="trend-item" style={{ cursor: "default" }}>
            <div className="trend-cat">Quick health checks for Shelby + Supabase.</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
                <div className="trend-cat">Shelby</div>
                {shelbyHealth.isLoading ? (
                  <div className="trend-count" style={{ marginTop: 6 }}>
                    Checking…
                  </div>
                ) : null}
                {shelbyHealth.isError ? (
                  <div className="trend-count" style={{ marginTop: 6, color: "var(--danger)" }}>
                    {(shelbyHealth.error as Error).message}
                  </div>
                ) : null}
                {shelbyHealth.data ? (
                  <div style={{ marginTop: 8 }}>
                    <div className="trend-count">Network: {shelbyHealth.data.network}</div>
                    <div className="trend-count">
                      Metadata:{" "}
                      <span style={{ color: shelbyHealth.data.checks.metadata.ok ? "var(--success)" : "var(--danger)" }}>
                        {shelbyHealth.data.checks.metadata.ok ? "OK" : "Error"}
                      </span>
                    </div>
                    <div className="trend-count">
                      RPC:{" "}
                      <span style={{ color: shelbyHealth.data.checks.rpc.ok ? "var(--success)" : "var(--danger)" }}>
                        {shelbyHealth.data.checks.rpc.ok ? "OK" : "Error"}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>

              <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
                <div className="trend-cat">Supabase</div>
                {supabaseHealth.isLoading ? (
                  <div className="trend-count" style={{ marginTop: 6 }}>
                    Checking…
                  </div>
                ) : null}
                {supabaseHealth.isError ? (
                  <div className="trend-count" style={{ marginTop: 6, color: "var(--danger)" }}>
                    {(supabaseHealth.error as Error).message}
                  </div>
                ) : null}
                {supabaseHealth.data ? (
                  <div className="trend-count" style={{ marginTop: 8 }}>
                    Status:{" "}
                    <span style={{ color: supabaseHealth.data.ok ? "var(--success)" : "var(--danger)" }}>
                      {supabaseHealth.data.ok ? "OK" : "Error"}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                className="follow-btn"
                onClick={() => {
                  void shelbyHealth.refetch();
                  void supabaseHealth.refetch();
                }}
              >
                Recheck
              </button>
              <Link href="/api/debug/blobs" className="follow-btn">
                Debug blobs
              </Link>
            </div>
          </div>
        </div>

        <div className="widget" style={{ marginBottom: 16 }}>
          <div className="widget-title">Developer</div>
          <div className="trend-item" style={{ cursor: "default" }}>
            <div className="trend-cat">Client cache and troubleshooting tools.</div>
            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <button type="button" className="follow-btn" onClick={() => clearCache.mutate()}>
                Clear client cache
              </button>
            </div>
          </div>
        </div>

        <div className="widget" style={{ marginBottom: 16 }}>
          <div className="widget-title">Privacy</div>
          <div className="trend-item" style={{ cursor: "default" }}>
            <div className="trend-cat">Wallet address is visible on your posts and interactions.</div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
