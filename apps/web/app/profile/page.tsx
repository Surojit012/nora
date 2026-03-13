"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { AppShell } from "@/components/AppShell";
import { PostCard } from "@/components/PostCard";
import { fetchPostsByAuthor } from "@/lib/shelbyClient";
import { Post } from "@/lib/types";
import { fetchUserByWallet, updateUserProfile, uploadAvatar, uploadCover } from "@/lib/identityClient";
import { PublicUser } from "@/lib/identity";
import Link from "next/link";

function shortenAddress(value?: string) {
  if (!value) return "Not connected";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatMemberSince(value?: string) {
  if (!value) return "Today";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

export default function ProfilePage() {
  const { connected, account } = useWallet();
  const address = account?.address?.toString();
  const mountedRef = useRef(false);
  const [userProfile, setUserProfile] = useState<PublicUser | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [tab, setTab] = useState<"posts" | "replies">("posts");
  const [replies, setReplies] = useState<{ id: string; postId: string; content: string; createdAt: string }[]>([]);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [repliesError, setRepliesError] = useState<string | null>(null);

  const myPosts = posts;

  const joinedAt = useMemo(() => userProfile?.created_at, [userProfile?.created_at]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    async function loadProfilePosts() {
      if (!connected || !address || !mountedRef.current) {
        setPosts([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await fetchPostsByAuthor(address, 100);
        if (mountedRef.current) {
          setPosts(data);
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : "Failed to load profile posts.");
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    }

    void loadProfilePosts();
  }, [connected, address]);

  useEffect(() => {
    async function loadUserProfile() {
      if (!connected || !address || !mountedRef.current) {
        setUserProfile(null);
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);
      try {
        const user = await fetchUserByWallet(address);
        if (mountedRef.current) {
          setUserProfile(user);
          setBioDraft(user.bio);
        }
      } catch (err) {
        if (mountedRef.current) {
          setUserProfile(null);
        }
      } finally {
        if (mountedRef.current) {
          setProfileLoading(false);
        }
      }
    }

    void loadUserProfile();
  }, [connected, address]);

  useEffect(() => {
    async function loadReplies() {
      if (!connected || !address || !mountedRef.current) {
        setReplies([]);
        setRepliesLoading(false);
        setRepliesError(null);
        return;
      }
      if (tab !== "replies") return;

      setRepliesLoading(true);
      setRepliesError(null);

      try {
        const res = await fetch(`/api/replies?author=${encodeURIComponent(address)}&limit=50`, { cache: "no-store" });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string; details?: string } | null;
          throw new Error(payload?.details ? `${payload.error ?? "Failed."} ${payload.details}` : payload?.error ?? "Failed to load replies.");
        }
        const data = (await res.json()) as { replies: { id: string; postId: string; content: string; createdAt: string }[] };
        if (mountedRef.current) setReplies(data.replies ?? []);
      } catch (e) {
        if (mountedRef.current) setRepliesError(e instanceof Error ? e.message : "Failed to load replies.");
      } finally {
        if (mountedRef.current) setRepliesLoading(false);
      }
    }

    void loadReplies();
  }, [tab, connected, address]);

  return (
    <AppShell>
	      <section className="space-y-4">
            <div className="overflow-hidden rounded-lg border border-border bg-surface">
              <div className="relative h-40 w-full border-b border-border bg-card">
                {userProfile?.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={userProfile.cover} alt="Cover" className="h-full w-full object-cover" />
                ) : null}

                <div className="absolute -bottom-10 left-5 z-10 h-20 w-20 rounded-full border border-border bg-surface p-1">
                  <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-card text-sm font-medium">
                    {userProfile?.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={userProfile.avatar} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
	                      <span>{address ? address.slice(2, 4).toUpperCase() : "??"}</span>
	                    )}
	                  </div>
	                </div>
	              </div>

	              <div className="p-5 pt-14">
	                <div className="flex items-start justify-between gap-4">
	                  <div className="min-w-0">
                    <h1 className="truncate text-xl font-medium tracking-[-0.02em]">
                      {userProfile?.username ? `@${userProfile.username}` : "Profile"}
                    </h1>
	                    <p className="mt-1 font-mono text-sm text-muted">{shortenAddress(address)}</p>
	                    {userProfile ? (
	                      <p className="mt-1 text-sm text-muted">{userProfile.bio || "No bio yet."}</p>
	                    ) : profileLoading ? (
	                      <p className="mt-1 text-sm text-muted">Loading profile…</p>
	                    ) : connected ? (
	                      <p className="mt-1 text-sm text-muted">No profile yet. Create one from Settings.</p>
	                    ) : null}
	                  </div>

	                <button
	                  type="button"
	                  onClick={() => {
                    if (address) {
                      void navigator.clipboard.writeText(address);
                    }
                  }}
                  disabled={!address}
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-xs transition-colors duration-150 ease-out hover:bg-card disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Copy Address
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (!connected || !address) return;
                    setIsEditing((prev) => !prev);
                      if (!isEditing) {
                        setBioDraft(userProfile?.bio ?? "");
                        setAvatarFile(null);
                        setCoverFile(null);
                        setEditError(null);
                      }
                  }}
                  disabled={!connected || !address}
                  className="rounded-lg border border-border bg-surface px-3 py-1 text-xs transition-colors duration-150 ease-out hover:bg-card disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isEditing ? "Cancel" : "Edit Profile"}
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs text-muted">Posts</p>
                  <p className="mt-1 text-base font-medium">{myPosts.length}</p>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs text-muted">Followers</p>
                  <p className="mt-1 text-base font-medium">{userProfile?.followers ?? 0}</p>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs text-muted">Joined</p>
                  <p className="mt-1 text-sm font-medium">{formatMemberSince(joinedAt)}</p>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs text-muted">Wallet</p>
                  <p className="mt-1 font-mono text-xs">{shortenAddress(address)}</p>
                </div>
              </div>

              {isEditing ? (
                <form
                  className="mt-4 space-y-3 rounded-xl border border-border p-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!address) return;

                    setIsSaving(true);
                    setEditError(null);

                    const avatarUpload = avatarFile
                      ? uploadAvatar({ walletAddress: address, file: avatarFile }).then((res) => res.url)
                      : Promise.resolve(undefined);

                    const coverUpload = coverFile
                      ? uploadCover({ walletAddress: address, file: coverFile }).then((res) => res.url)
                      : Promise.resolve(undefined);

                    Promise.all([avatarUpload, coverUpload])
                      .then(([avatarUrl, coverUrl]) =>
                        updateUserProfile({
                          walletAddress: address,
                          bio: bioDraft,
                          ...(avatarUrl ? { avatar: avatarUrl } : {}),
                          ...(coverUrl ? { cover: coverUrl } : {})
                        })
                      )
                      .then((user) => {
                        setUserProfile(user);
                        setIsEditing(false);
                      })
                      .catch((err) => {
                        setEditError(err instanceof Error ? err.message : "Failed to update profile.");
                      })
                      .finally(() => {
                        setIsSaving(false);
                      });
                  }}
                >
                  <div className="space-y-1 text-xs text-muted">
                    <label>
                      Bio
                      <textarea
                        value={bioDraft}
                        onChange={(event) => setBioDraft(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-border bg-background px-2 py-1 text-sm outline-none focus:border-foreground/30"
                      />
                    </label>
                  </div>
                  <div className="space-y-1 text-xs text-muted">
                    <label>
                      Avatar
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          setAvatarFile(file);
                        }}
                        className="mt-1 w-full rounded-xl border border-border bg-background px-2 py-1 text-sm outline-none focus:border-foreground/30"
                      />
                    </label>
                    <p className="text-[11px] text-muted">PNG/JPG/WebP/GIF, max 2MB.</p>
                  </div>
                  <div className="space-y-1 text-xs text-muted">
                    <label>
                      Cover image
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          setCoverFile(file);
                        }}
                        className="mt-1 w-full rounded-xl border border-border bg-background px-2 py-1 text-sm outline-none focus:border-foreground/30"
                      />
                    </label>
                    <p className="text-[11px] text-muted">PNG/JPG/WebP/GIF, max 5MB.</p>
                  </div>
                  {editError ? <p className="text-xs text-red-600">{editError}</p> : null}
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full rounded-[20px] bg-accent px-4 py-2 text-xs font-medium uppercase tracking-[0.04em] text-background transition-colors duration-150 ease-out hover:bg-cta disabled:opacity-50"
                  >
                    {isSaving ? "Saving…" : "Save profile"}
                  </button>
                </form>
              ) : null}
            </div>
          </div>

        <div className="rounded-lg border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-[0.04em] text-muted">Timeline</h2>
            {userProfile?.username ? (
              <Link
                href={`/profile/${encodeURIComponent(userProfile.username)}`}
                className="text-xs text-muted underline underline-offset-2"
              >
                View public profile
              </Link>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted">Switch between posts and replies.</p>
          <p className="mt-2 break-all font-mono text-xs text-muted">{address ?? "-"}</p>
          <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setTab("posts")}
              className={[
                "px-3 py-2 text-sm",
                tab === "posts" ? "font-medium text-foreground" : "text-muted hover:text-foreground"
              ].join(" ")}
            >
              Posts
            </button>
            <button
              type="button"
              onClick={() => setTab("replies")}
              className={[
                "px-3 py-2 text-sm border-l border-border",
                tab === "replies" ? "font-medium text-foreground" : "text-muted hover:text-foreground"
              ].join(" ")}
            >
              Replies
            </button>
          </div>
        </div>

        {!connected ? (
          <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">
            Connect wallet to view your profile timeline.
          </p>
        ) : null}

        {loading ? (
          <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">Loading profile...</p>
        ) : null}

        {error ? <p className="rounded-lg border border-border bg-surface p-4 text-sm">{error}</p> : null}

        {tab === "posts" && !loading && !error && connected && myPosts.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">
            No posts yet.
          </p>
        ) : null}

        {tab === "posts" && !loading && !error && connected
          ? myPosts.map((post) => <PostCard key={post.id} post={post} />)
          : null}

        {tab === "replies" && repliesLoading ? (
          <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">Loading replies…</p>
        ) : null}
        {tab === "replies" && repliesError ? (
          <p className="rounded-lg border border-border bg-surface p-4 text-sm">{repliesError}</p>
        ) : null}
        {tab === "replies" && !repliesLoading && !repliesError && replies.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">No replies yet.</p>
        ) : null}
        {tab === "replies" && !repliesLoading && !repliesError
          ? replies.map((reply) => (
              <div key={reply.id} className="rounded-lg border border-border bg-surface p-4">
                <p className="text-xs text-muted">
                  Replying to{" "}
                  <Link
                    className="underline underline-offset-2"
                    href={`/post/${reply.postId}#comments`}
                  >
                    post
                  </Link>
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{reply.content}</p>
                <p className="mt-2 font-mono text-xs text-muted">{formatMemberSince(reply.createdAt)}</p>
              </div>
            ))
          : null}
      </section>
    </AppShell>
  );
}
