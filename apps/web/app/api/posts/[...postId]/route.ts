import { NextRequest, NextResponse } from "next/server";
import { fetchShelbyPostById } from "@/lib/shelbyServer";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, context: { params: { postId: string[] } }) {
  const parts = context.params.postId ?? [];
  const id = parts.join("/");

  const post = await fetchShelbyPostById(id);
  if (!post) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }
  return NextResponse.json(post);
}

