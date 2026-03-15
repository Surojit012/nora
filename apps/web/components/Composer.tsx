"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useMutation } from "@tanstack/react-query";
import { createPostAdvanced } from "@/lib/shelbyClient";
import { useQuery } from "@tanstack/react-query";
import { fetchUserByWallet } from "@/lib/identityClient";
import { Avatar } from "@/components/Avatar";

const MAX_CHARS = 280;
const MAX_ATTACHMENTS = 4;

const EMOJIS = ["😀", "😂", "🥲", "😍", "🤝", "🔥", "✅", "🚀", "💡", "🧠", "🎉", "📌", "🫡", "😮‍💨", "🙏", "💯"];

type AttachmentDraft = {
  id: string;
  file: File;
  kind: "image" | "video" | "file";
  previewUrl?: string;
};

export function Composer() {
  const { account, connected } = useWallet();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const attachmentsRef = useRef<AttachmentDraft[]>([]);
  const [content, setContent] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [gifUrl, setGifUrl] = useState("");
  const [location, setLocation] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [pollEnabled, setPollEnabled] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<string | null>(null);
  const progressTimers = useRef<number[]>([]);

  const viewerAddress = account?.address?.toString() ?? "";
  const viewerUserQuery = useQuery({
    queryKey: ["user-by-wallet", viewerAddress],
    queryFn: async () => fetchUserByWallet(viewerAddress),
    enabled: Boolean(viewerAddress),
    staleTime: 30_000
  });

  const createPostMutation = useMutation({
    mutationFn: async (payload: {
      text: string;
      author: string;
      files: File[];
      gifUrl?: string;
      location?: string;
      scheduledAt?: string;
      poll?: { options: string[] };
    }) =>
      createPostAdvanced({
        content: payload.text,
        walletAddress: payload.author,
        files: payload.files,
        gifUrl: payload.gifUrl,
        location: payload.location,
        scheduledAt: payload.scheduledAt,
        poll: payload.poll
      }),
    onSuccess: () => {
      setUploadProgress(100);
      setUploadStage("Done");
      setContent("");
      setAttachments((prev) => {
        for (const a of prev) {
          if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
        }
        return [];
      });
      setGifUrl("");
      setLocation("");
      setScheduledAt("");
      setPollEnabled(false);
      setPollOptions(["", ""]);
      setEmojiOpen(false);
      setValidationError(null);
      window.dispatchEvent(new Event("nora:post-created"));
      window.setTimeout(() => {
        setUploadProgress(0);
        setUploadStage(null);
      }, 1500);
    },
    onError: (error) => {
      setValidationError(error.message);
      setUploadStage("Failed");
      window.setTimeout(() => {
        setUploadProgress(0);
        setUploadStage(null);
      }, 1500);
    }
  });

  useEffect(() => {
    setWalletAddress(account?.address?.toString() ?? "");
  }, [account]);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    return () => {
      // Prevent objectURL leaks if user navigates away.
      for (const a of attachmentsRef.current) {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      }
    };
  }, []);

  useEffect(() => {
    if (!createPostMutation.isPending) {
      progressTimers.current.forEach((t) => window.clearTimeout(t));
      progressTimers.current = [];
      return;
    }

    setUploadProgress(8);
    setUploadStage("Preparing");

    const t1 = window.setTimeout(() => {
      setUploadProgress(35);
      setUploadStage("Registering on-chain");
    }, 600);

    const t2 = window.setTimeout(() => {
      setUploadProgress(65);
      setUploadStage("Uploading to Shelby");
    }, 1600);

    const t3 = window.setTimeout(() => {
      setUploadProgress(85);
      setUploadStage("Finalizing");
    }, 3000);

    progressTimers.current = [t1, t2, t3];
  }, [createPostMutation.isPending]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);

    const trimmed = content.trim();
    const poll = pollEnabled
      ? {
          options: pollOptions.map((o) => o.trim()).filter(Boolean).slice(0, 4)
        }
      : undefined;

    const hasNonText = attachments.length > 0 || !!gifUrl.trim() || (poll ? poll.options.length >= 2 : false);
    if (!trimmed && !hasNonText) return;

    if (!walletAddress) {
      setValidationError("Connect wallet first");
      return;
    }

    if (!connected || !account) {
      setValidationError("Connect wallet first");
      return;
    }

    createPostMutation.mutate({
      text: trimmed,
      author: walletAddress,
      files: attachments.map((a) => a.file),
      gifUrl: gifUrl.trim() || undefined,
      location: location.trim() || undefined,
      scheduledAt: scheduledAt || undefined,
      poll: poll && poll.options.length >= 2 ? poll : undefined
    });
  }

  const isEmpty = useMemo(() => content.trim().length === 0, [content]);
  const canPost = useMemo(() => {
    const pollValid = pollEnabled ? pollOptions.map((o) => o.trim()).filter(Boolean).length >= 2 : false;
    return (
      !createPostMutation.isPending &&
      !!walletAddress &&
      (!isEmpty || attachments.length > 0 || !!gifUrl.trim() || pollValid)
    );
  }, [createPostMutation.isPending, walletAddress, isEmpty, attachments.length, gifUrl, pollEnabled, pollOptions]);

  function wrapSelection(prefix: string, suffix: string) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const before = content.slice(0, start);
    const selected = content.slice(start, end);
    const after = content.slice(end);
    const next = `${before}${prefix}${selected || ""}${suffix}${after}`.slice(0, MAX_CHARS);
    setContent(next);
    requestAnimationFrame(() => {
      const newPos = start + prefix.length + (selected || "").length + suffix.length;
      el.focus();
      el.setSelectionRange(newPos, newPos);
    });
  }

  return (
    <form onSubmit={onSubmit} className="composer">
      <Avatar
        src={viewerUserQuery.data?.avatar || ""}
        alt={viewerUserQuery.data?.username ? `${viewerUserQuery.data.username} avatar` : "avatar"}
        addressHint={walletAddress}
        label={viewerUserQuery.data?.username || walletAddress}
        size={40}
      />

      <div className="composer-input">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(event) => {
            setContent(event.target.value.slice(0, MAX_CHARS));
            if (validationError) setValidationError(null);
            if (!createPostMutation.isPending && createPostMutation.status !== "idle") {
              createPostMutation.reset();
            }
          }}
          placeholder="What's happening?"
          rows={2}
        />

        {gifUrl !== "" ? (
          <div style={{ marginTop: 10 }}>
            <div className="tweet-text" style={{ marginBottom: 6, color: "var(--muted)", fontSize: 12 }}>
              GIF URL
            </div>
            <div className="search-bar" style={{ borderRadius: 12 }}>
              <input
                value={gifUrl}
                onChange={(e) => setGifUrl(e.target.value)}
                placeholder="https://..."
                style={{ fontFamily: "var(--font-mono)" }}
              />
            </div>
          </div>
        ) : null}

        {emojiOpen ? (
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="action-icon-btn"
                style={{ opacity: 1, border: `1px solid var(--border2)`, borderRadius: 10, padding: 8 }}
                onClick={() => setContent((prev) => (prev + emoji).slice(0, MAX_CHARS))}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>{emoji}</span>
              </button>
            ))}
          </div>
        ) : null}

        {attachments.length ? (
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
            {attachments.map((a) => (
              <div key={a.id} className="tweet-image" style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() =>
                    setAttachments((prev) => {
                      const target = prev.find((x) => x.id === a.id);
                      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
                      return prev.filter((x) => x.id !== a.id);
                    })
                  }
                  aria-label="Remove attachment"
                  title="Remove"
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    border: `1px solid var(--border2)`,
                    background: "rgba(17,17,17,0.85)",
                    color: "var(--text)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18" />
                    <path d="M6 6l12 12" />
                  </svg>
                </button>

                {a.kind === "image" && a.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.previewUrl} alt={a.file.name || "Attachment"} />
                ) : a.kind === "video" && a.previewUrl ? (
                  <video src={a.previewUrl} controls preload="metadata" />
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
                    {a.file.name}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : null}

        <div className="composer-actions">
          <label className="action-icon-btn" title="Image">
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              style={{ display: "none" }}
              onChange={(event) => {
                const selected = Array.from(event.target.files ?? []);
                setAttachments((prev) => {
                  const remaining = Math.max(0, MAX_ATTACHMENTS - prev.length);
                  const nextSelected = selected.slice(0, remaining);
                  const drafts: AttachmentDraft[] = nextSelected.map((file) => {
                    const kind: AttachmentDraft["kind"] = file.type.startsWith("image/")
                      ? "image"
                      : file.type.startsWith("video/")
                        ? "video"
                        : "file";
                    const previewUrl = kind === "image" || kind === "video" ? URL.createObjectURL(file) : undefined;
                    return { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, file, kind, previewUrl };
                  });
                  return [...prev, ...drafts];
                });
                if (validationError) setValidationError(null);
                event.currentTarget.value = "";
              }}
            />
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="4" width="16" height="12" rx="2" />
              <circle cx="7" cy="9" r="1.5" />
              <path d="M2 14l4-4 3 3 3-3 4 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </label>

          <button
            type="button"
            className="action-icon-btn"
            title="GIF"
            onClick={() => {
              setGifUrl((prev) => (prev ? "" : "https://"));
              setEmojiOpen(false);
              setValidationError(null);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="5" width="16" height="10" rx="2" />
              <path d="M8 8v4M8 10h2.5M12 8v4" strokeLinecap="round" />
            </svg>
          </button>

          <button
            type="button"
            className="action-icon-btn"
            title="Emoji"
            onClick={() => setEmojiOpen((v) => !v)}
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="10" cy="10" r="7" />
              <circle cx="7.5" cy="8.5" r="0.75" fill="currentColor" />
              <circle cx="12.5" cy="8.5" r="0.75" fill="currentColor" />
              <path d="M7 12.5s1 1.5 3 1.5 3-1.5 3-1.5" strokeLinecap="round" />
            </svg>
          </button>

          <div className="composer-meta">
            {content.length}/{MAX_CHARS}
            {attachments.length ? ` · ${attachments.length}/${MAX_ATTACHMENTS}` : ""}
          </div>

          <button type="submit" className="send-btn" disabled={!canPost}>
            {createPostMutation.isPending ? "Posting..." : "Post"}
          </button>
        </div>

        {createPostMutation.isPending || uploadStage ? (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)" }}>
              <span>{uploadStage ?? "Uploading"}</span>
              <span>{Math.min(100, Math.max(0, uploadProgress))}%</span>
            </div>
            <div
              style={{
                marginTop: 6,
                height: 6,
                borderRadius: 999,
                background: "var(--border2)",
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, Math.max(0, uploadProgress))}%`,
                  background: "var(--gold)",
                  transition: "width 200ms ease"
                }}
              />
            </div>
          </div>
        ) : null}

        {!walletAddress ? (
          <div className="tweet-text" style={{ marginTop: 10, color: "var(--muted)", fontSize: 12 }}>
            Connect wallet first
          </div>
        ) : null}

        {validationError ? (
          <div className="tweet-text" style={{ marginTop: 10, color: "var(--danger)", fontSize: 12 }}>
            {validationError}
          </div>
        ) : null}

        {createPostMutation.isError && !validationError ? (
          <div className="tweet-text" style={{ marginTop: 10, color: "var(--danger)", fontSize: 12 }}>
            {createPostMutation.error.message}
          </div>
        ) : null}

        {createPostMutation.isSuccess && createPostMutation.data ? (
          <div style={{ marginTop: 16, padding: "16px", borderRadius: 12, background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#10b981", fontWeight: 600, fontSize: 14, marginBottom: 12 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              Post successfully published!
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {createPostMutation.data.shelbyExplorerUrl ? (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const targetUrl = createPostMutation.data.shelbyExplorerUrl!;
                      const res = await fetch(`/api/blob/download?url=${encodeURIComponent(targetUrl)}`);
                      if (!res.ok) throw new Error(`Failed to fetch blob (${res.status})`);

                      const contentType = res.headers.get("content-type") ?? "";
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      const fallbackName = `shelby-blob-${Date.now()}`;
                      const extension = contentType.includes("json") ? "json" : contentType.includes("text") ? "txt" : "bin";
                      a.href = url;
                      a.download = `${fallbackName}.${extension}`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    } catch (e) {
                      console.error("Failed to download blob:", e);
                      const directUrl = createPostMutation.data.shelbyExplorerUrl!;
                      window.open(directUrl, "_blank", "noopener,noreferrer");
                      alert("Failed to download blob. Opening in a new tab instead.");
                    }
                  }}
                  className="action-icon-btn"
                  style={{
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 500,
                    border: "1px solid var(--border2)",
                    borderRadius: 16,
                    color: "var(--text)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  View Blob
                </button>
              ) : null}

              {createPostMutation.data.txHash ? (
                <a
                  href={`https://explorer.aptoslabs.com/txn/${createPostMutation.data.txHash}?network=testnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="action-icon-btn"
                  style={{
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 500,
                    border: "1px solid var(--border2)",
                    borderRadius: 16,
                    color: "var(--text)",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  View Transaction
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </form>
  );
}

// Avatar helpers live in <Avatar />.
