"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { WalletButton } from "@/components/WalletButton";
import { uploadAvatar } from "@/lib/identityClient";

type SignupResponse = {
  username: string;
};

export default function OnboardingPage() {
  const router = useRouter();
  const { connected, account } = useWallet();
  const walletAddress = account?.address?.toString() ?? "";

  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return connected && walletAddress.length > 0 && username.trim().length > 0 && !submitting;
  }, [connected, walletAddress, username, submitting]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          bio: bio.trim(),
          avatar: "",
          cover: "",
          wallet_address: walletAddress
        })
      });

      const payload = (await response.json().catch(() => null)) as
        | SignupResponse
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload && "error" in payload ? payload.error ?? "Signup failed." : "Signup failed.");
      }

      const created = payload as SignupResponse;
      if (avatarFile) {
        const uploaded = await uploadAvatar({ walletAddress, file: avatarFile });
        await fetch("/user/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet_address: walletAddress, avatar: uploaded.url })
        });
      }
      router.replace(`/profile/${created.username}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px" }}>
      <div className="feed-header" style={{ position: "sticky", top: 0 }}>
        <div className="tab-bar">
          <div className="tab active">Create profile</div>
        </div>
      </div>

      <div style={{ paddingTop: 16 }}>
        <div className="widget">
          <div className="widget-title">Profile</div>
          <div className="trend-item" style={{ cursor: "default" }}>
            <div className="trend-cat">Set your username, bio, and avatar for nora.</div>

            <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
                Wallet: {walletAddress || "Not connected"}
              </div>
              <WalletButton />
            </div>

            <form onSubmit={onSubmit} style={{ marginTop: 14, display: "grid", gap: 12 }}>
              <div>
                <div className="trend-cat">Username</div>
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="surojit"
                  className="field"
                  maxLength={24}
                />
              </div>

              <div>
                <div className="trend-cat">Bio</div>
                <textarea
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder="Builder on Shelby + Aptos"
                  className="field field-textarea"
                  maxLength={160}
                />
              </div>

              <div>
                <div className="trend-cat">Avatar</div>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setAvatarFile(file);
                  }}
                  className="field field-file"
                />
                <div className="trend-count">PNG/JPG/WebP/GIF, max 2MB.</div>
              </div>

              {!connected ? (
                <div className="trend-count" style={{ color: "var(--danger)" }}>
                  Connect wallet first.
                </div>
              ) : null}
              {error ? (
                <div className="trend-count" style={{ color: "var(--danger)" }}>
                  {error}
                </div>
              ) : null}

              <button type="submit" disabled={!canSubmit} className="btn-primary" style={{ width: "fit-content" }}>
                {submitting ? "Creating..." : "Create Profile"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
