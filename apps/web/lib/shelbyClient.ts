"use client";

import { Post } from "@/lib/types";

type ApiError = {
  error?: string;
  details?: string;
};

async function readApiError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as ApiError | null;
  if (!payload) return "Request failed.";
  if (payload.details) return `${payload.error ?? "Request failed."} ${payload.details}`;
  return payload.error ?? "Request failed.";
}

export async function createPost(content: string, walletAddress: string): Promise<Post> {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("Post content is required.");
  }
  if (!walletAddress.trim()) {
    throw new Error("Wallet address is required.");
  }

  const response = await fetch("/api/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: trimmed,
      author: walletAddress
    })
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as Post;
}

export async function createPostWithAttachments(
  content: string,
  walletAddress: string,
  files: File[]
): Promise<Post> {
  const trimmed = content.trim();
  if (!trimmed) throw new Error("Post content is required.");
  if (!walletAddress.trim()) throw new Error("Wallet address is required.");

  const form = new FormData();
  form.append("content", trimmed);
  form.append("author", walletAddress);
  for (const file of files) {
    form.append("files", file);
  }

  const response = await fetch("/api/posts", {
    method: "POST",
    body: form
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as Post;
}

export async function createPostAdvanced(args: {
  content: string;
  walletAddress: string;
  files: File[];
  gifUrl?: string;
  location?: string;
  scheduledAt?: string;
  poll?: { options: string[] };
}): Promise<Post> {
  const trimmed = args.content.trim();
  if (!trimmed && args.files.length === 0 && !args.gifUrl && !args.poll) {
    throw new Error("Post content is required.");
  }
  if (!args.walletAddress.trim()) throw new Error("Wallet address is required.");

  const form = new FormData();
  form.append("content", trimmed);
  form.append("author", args.walletAddress);
  for (const file of args.files) {
    form.append("files", file);
  }
  if (args.gifUrl) form.append("gif_url", args.gifUrl);
  if (args.location) form.append("location", args.location);
  if (args.scheduledAt) form.append("scheduled_at", args.scheduledAt);
  if (args.poll) form.append("poll", JSON.stringify(args.poll));

  const response = await fetch("/api/posts", { method: "POST", body: form });
  if (!response.ok) throw new Error(await readApiError(response));
  return (await response.json()) as Post;
}

export async function fetchPosts(limit = 50): Promise<Post[]> {
  const params = new URLSearchParams();
  if (typeof limit === "number" && Number.isFinite(limit)) {
    params.set("limit", String(limit));
  }

  const url = params.size ? `/api/posts?${params.toString()}` : "/api/posts";
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as Post[];
}

export async function fetchPostsByAuthor(author: string, limit?: number): Promise<Post[]> {
  const params = new URLSearchParams();
  params.set("author", author);
  if (typeof limit === "number" && Number.isFinite(limit)) {
    params.set("limit", String(limit));
  }

  const response = await fetch(`/api/posts?${params.toString()}`, { method: "GET", cache: "no-store" });
  if (!response.ok) throw new Error(await readApiError(response));
  return (await response.json()) as Post[];
}
