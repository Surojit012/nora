import { NextResponse } from "next/server";
import { listShelbyPosts } from "@/lib/shelbyServer";
import { extractHashtags } from "@/lib/hashtags";
import { Post } from "@/lib/types";

type RouteContext = { params: { tag: string } };

function error(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const tag = String(context.params.tag ?? "").trim().toLowerCase().replace(/^#/, "");
    if (!tag) return error(400, "Tag is required.");

    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit") ?? 20)));

    const scan = Math.max(200, limit * 20);
    const posts = await listShelbyPosts({ limit: scan });
    const filtered = posts.filter((post) => {
      const tags = extractHashtags(post.text ?? "")
        .map((t) => t.trim().replace(/^#/, "").toLowerCase())
        .filter(Boolean);
      return tags.includes(tag);
    });

    return NextResponse.json(filtered.slice(0, limit));
  } catch (e) {
    return error(500, e instanceof Error ? e.message : "Failed to fetch hashtag feed.");
  }
}
