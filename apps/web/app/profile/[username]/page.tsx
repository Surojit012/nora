"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { AppShell } from "@/components/AppShell";
import { PostCard } from "@/components/PostCard";
import { fetchPostsByAuthor } from "@/lib/shelbyClient";
import { Post } from "@/lib/types";
import { updateUserProfile, uploadAvatar, uploadCover } from "@/lib/identityClient";
import { PublicUser } from "@/lib/identity";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FollowButton } from "@/components/FollowButton";

type ProfileUser = PublicUser;

type ProfilePageProps = {
  params: {
    username: string;
  };
};

function shortenAddress(value?: string) {
  if (!value) return "-";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

function normalize(value?: string) {
  return (value ?? "").toLowerCase();
}

export default function PublicProfilePage({ params }: ProfilePageProps) {
  const { account } = useWallet();
  const walletAddress = account?.address?.toString() ?? "";
  const viewer = walletAddress;
  const mountedRef = useRef(false);
  const queryClient = useQueryClient();
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  const username = params.username;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    async function loadProfile() {
      if (!mountedRef.current) return;
      setLoading(true);
      setError(null);

      try {
        const userRes = await fetch(`/user/${username}`, { cache: "no-store" });

        if (!userRes.ok) {
          throw new Error(userRes.status === 404 ? "User not found." : "Failed to load profile.");
        }

        const userData = (await userRes.json()) as ProfileUser;
        const postsData = userData.wallet_address ? await fetchPostsByAuthor(userData.wallet_address, 100) : [];

        if (!mountedRef.current) return;
        setUser(userData);
        setBioDraft(userData.bio ?? "");
        setPosts(postsData);
      } catch (err) {
        if (!mountedRef.current) return;
        setError(err instanceof Error ? err.message : "Failed to load profile.");
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    }

    void loadProfile();
  }, [username]);

  const userPosts = useMemo(() => posts, [posts]);

  const canEdit = useMemo(() => {
    if (!user || !user.wallet_address || !walletAddress) return false;
    return normalize(user.wallet_address) === normalize(walletAddress);
  }, [user, walletAddress]);



  useEffect(() => {
    async function loadReplies() {
      if (!mountedRef.current) return;
      if (!user?.wallet_address) {
        setReplies([]);
        setRepliesLoading(false);
        setRepliesError(null);
        return;
      }
      if (tab !== "replies") return;

      setRepliesLoading(true);
      setRepliesError(null);

      try {
        const res = await fetch(`/api/replies?author=${encodeURIComponent(user.wallet_address)}&limit=50`, { cache: "no-store" });
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
  }, [tab, user?.wallet_address]);

  return (
    <AppShell>
      <section className="space-y-4">
        {loading ? (
          <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">Loading profile...</p>
        ) : null}

        {error ? <p className="rounded-lg border border-border bg-surface p-4 text-sm">{error}</p> : null}

        {!loading && !error && user ? (
	          <>
            <div className="overflow-hidden rounded-lg border border-border bg-surface">
	              <div className="relative h-40 w-full border-b border-border bg-card">
	                {user.cover ? (
	                  // eslint-disable-next-line @next/next/no-img-element
	                  <img src={user.cover} alt="Cover" className="h-full w-full object-cover" />
	                ) : null}

	                <div className="absolute -bottom-10 left-5 z-10 h-20 w-20 rounded-full border border-border bg-surface p-1">
	                  {user.avatar ? (
	                    // eslint-disable-next-line @next/next/no-img-element
	                    <img src={user.avatar} alt={`${user.username} avatar`} className="h-full w-full rounded-full object-cover" />
	                  ) : (
	                    <div className="flex h-full w-full items-center justify-center rounded-full bg-card text-lg font-medium">
	                      {user.username.slice(0, 2).toUpperCase()}
	                    </div>
	                  )}
	                </div>
	              </div>

	              <div className="p-5 pt-14">
                <div className="flex items-start justify-between gap-4">
	                  <div className="min-w-0">
	                    <h1 className="truncate text-xl font-medium tracking-[-0.02em] text-foreground">@{user.username}</h1>
	                    <p className="mt-1 text-sm text-muted">{user.bio || "No bio yet."}</p>
	                  </div>

                  <div className="flex items-center gap-2">
                    {!canEdit && viewer && user?.wallet_address ? (
                      <FollowButton
                        targetAddress={user.wallet_address}
                        onFollowSuccess={(data) => {
                          if (typeof data.followersCount === "number") {
                            setUser((prev) => (prev ? { ...prev, followers: data.followersCount ?? prev.followers } : prev));
                          }
                        }}
                      />
                    ) : null}

                    <Link href="/" className="rounded-lg border border-border bg-surface px-3 py-2 text-xs transition-colors duration-150 ease-out hover:bg-card">
                      Back
                    </Link>
                  </div>
                </div>

              {canEdit ? (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing((prev) => !prev);
                      setEditError(null);
                      if (!isEditing) {
                        setBioDraft(user.bio ?? "");
                        setAvatarFile(null);
                        setCoverFile(null);
                      }
                    }}
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-sm transition-colors duration-150 ease-out hover:bg-card"
                  >
                    {isEditing ? "Cancel" : "Edit Profile"}
                  </button>
                </div>
              ) : null}

              {canEdit && isEditing ? (
                <form
                  className="mt-3 space-y-3 rounded-xl border border-border p-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!walletAddress) return;
                    setIsSaving(true);
                    setEditError(null);

                    const maybeUpload = avatarFile
                      ? uploadAvatar({ walletAddress, file: avatarFile }).then((res) => res.url)
                      : Promise.resolve(undefined);
                    const maybeCover = coverFile
                      ? uploadCover({ walletAddress, file: coverFile }).then((res) => res.url)
                      : Promise.resolve(undefined);

                    Promise.all([maybeUpload, maybeCover])
                      .then(([uploadedUrl, uploadedCover]) =>
                        updateUserProfile({
                          walletAddress,
                          bio: bioDraft,
                          ...(uploadedUrl ? { avatar: uploadedUrl } : {}),
                          ...(uploadedCover ? { cover: uploadedCover } : {})
                        })
                      )
                      .then((updated) => {
                        setUser((prev) =>
                          prev
                            ? {
                                ...prev,
                                bio: updated.bio,
                                avatar: updated.avatar,
                                cover: updated.cover
                              }
                            : prev
                        );
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
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-muted">Bio</span>
                    <textarea
                      value={bioDraft}
                      onChange={(event) => setBioDraft(event.target.value)}
                      className="min-h-[88px] w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
                      maxLength={160}
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-muted">Avatar</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setAvatarFile(file);
                      }}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
                    />
                  </label>
                  <p className="text-[11px] text-muted">PNG/JPG/WebP/GIF, max 2MB.</p>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-muted">Cover image</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setCoverFile(file);
                      }}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
                    />
                  </label>
                  <p className="text-[11px] text-muted">PNG/JPG/WebP/GIF, max 5MB.</p>

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

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs text-muted">Posts</p>
                  <p className="mt-1 text-base font-medium">{userPosts.length}</p>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs text-muted">Followers</p>
                  <p className="mt-1 text-base font-medium">{user.followers}</p>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs text-muted">Joined</p>
                  <p className="mt-1 text-sm font-medium">{formatDate(user.created_at)}</p>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs text-muted">Wallet</p>
                  <p className="mt-1 font-mono text-xs">{shortenAddress(user.wallet_address)}</p>
                </div>
              </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-border">
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

            {tab === "posts" ? (
              userPosts.length === 0 ? (
                <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">
                  No posts yet.
                </p>
              ) : (
                userPosts.map((post) => <PostCard key={post.id} post={post} />)
              )
            ) : null}

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
                      <Link className="underline underline-offset-2" href={`/post/${reply.postId}#comments`}>
                        post
                      </Link>
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{reply.content}</p>
                    <p className="mt-2 font-mono text-xs text-muted">{formatDate(reply.createdAt)}</p>
                  </div>
                ))
              : null}
          </>
        ) : null}
      </section>
    </AppShell>
  );
}
