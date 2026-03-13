"use client";

import { PublicUser } from "@/lib/identity";

async function readError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error ?? "Request failed.";
}

export async function fetchUserByWallet(walletAddress: string): Promise<PublicUser> {
  const trimmed = walletAddress.trim();
  if (!trimmed) throw new Error("Wallet address is required.");

  const response = await fetch(`/user/by-wallet?wallet_address=${encodeURIComponent(trimmed)}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as PublicUser;
}

export async function updateUserProfile({
  walletAddress,
  bio,
  avatar,
  cover
}: {
  walletAddress: string;
  bio?: string;
  avatar?: string;
  cover?: string;
}): Promise<PublicUser> {
  const trimmed = walletAddress.trim();
  if (!trimmed) throw new Error("Wallet address is required.");

  const response = await fetch("/user/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wallet_address: trimmed,
      ...(bio !== undefined ? { bio } : {}),
      ...(avatar !== undefined ? { avatar } : {}),
      ...(cover !== undefined ? { cover } : {})
    })
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as PublicUser;
}

export async function uploadAvatar({
  walletAddress,
  file
}: {
  walletAddress: string;
  file: File;
}): Promise<{ url: string; path: string }> {
  const trimmed = walletAddress.trim();
  if (!trimmed) throw new Error("Wallet address is required.");

  const form = new FormData();
  form.append("wallet_address", trimmed);
  form.append("file", file);

  const response = await fetch("/api/avatar", {
    method: "POST",
    body: form
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as { url: string; path: string };
}

export async function uploadCover({
  walletAddress,
  file
}: {
  walletAddress: string;
  file: File;
}): Promise<{ url: string; path: string }> {
  const trimmed = walletAddress.trim();
  if (!trimmed) throw new Error("Wallet address is required.");

  const form = new FormData();
  form.append("wallet_address", trimmed);
  form.append("file", file);

  const response = await fetch("/api/cover", {
    method: "POST",
    body: form
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as { url: string; path: string };
}
