"use client";

import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

type FollowButtonProps = {
  targetAddress: string;
  onFollowSuccess?: (data: { following: boolean; followersCount?: number }) => void;
  className?: string;
  disabled?: boolean;
};

export function FollowButton({ targetAddress, onFollowSuccess, className, disabled }: FollowButtonProps) {
  const { account, signMessage } = useWallet();
  const viewer = account?.address?.toString() ?? "";
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const followStateQuery = useQuery({
    queryKey: ["follow-state", viewer, targetAddress],
    queryFn: async () => {
      if (!viewer || !targetAddress) return { following: false };
      const params = new URLSearchParams();
      params.set("follower", viewer);
      params.set("following", targetAddress);
      const res = await fetch(`/api/follow?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Follow state query failed.");
      }
      return (await res.json()) as { following: boolean };
    },
    enabled: Boolean(viewer && targetAddress),
    staleTime: 10_000,
  });

  const toggleFollowMutation = useMutation({
    mutationFn: async () => {
      if (!viewer || !targetAddress || !account?.publicKey) throw new Error("Connect wallet first.");
      
      const isCurrentlyFollowing = followStateQuery.data?.following;
      const method = isCurrentlyFollowing ? "DELETE" : "POST";
      const message = `${isCurrentlyFollowing ? "Unfollow" : "Follow"} ${targetAddress}`;

      // Retrieve signature for backend verification
      const prompt = await signMessage({
        message,
        nonce: Date.now().toString(),
      });

      if (!prompt || !prompt.signature) {
        throw new Error("Signature rejected");
      }

      // Format headers suitable for Ed25519 processing
      const headers = new Headers({
        "content-type": "application/json",
        "x-aptos-pubkey": account.publicKey.toString(),
        "x-aptos-signature": typeof prompt.signature === "string" ? prompt.signature : Buffer.from(prompt.signature as any).toString("hex"),
        "x-aptos-message": prompt.fullMessage,
      });

      const res = await fetch("/api/follow", {
        method,
        headers,
        body: JSON.stringify({ following: targetAddress }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string; details?: string } | null;
        throw new Error(payload?.details ? `${payload.error ?? "Follow failed."} ${payload.details}` : payload?.error ?? "Follow failed.");
      }
      return (await res.json()) as { following: boolean; followersCount?: number };
    },
    onSuccess: (data) => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["follow-state", viewer, targetAddress] });
      if (onFollowSuccess) {
        onFollowSuccess(data);
      }
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Follow failed."),
  });

  const isFollowing = followStateQuery.data?.following ?? false;
  const isPending = toggleFollowMutation.isPending || followStateQuery.isLoading;

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleFollowMutation.mutate();
        }}
        disabled={disabled || isPending || !viewer}
        className={
          className ??
          "rounded-[20px] border border-border bg-transparent px-4 py-2 text-xs font-medium uppercase tracking-[0.04em] text-foreground transition-colors duration-150 ease-out hover:bg-card disabled:cursor-not-allowed disabled:opacity-50"
        }
      >
        {isPending ? "…" : isFollowing ? "Following" : "Follow"}
      </button>
      {error && <span className="mt-1 text-[10px] text-red-500">{error}</span>}
    </div>
  );
}
