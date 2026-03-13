import { NextRequest, NextResponse } from "next/server";
import { createShelbyPost, listShelbyPosts } from "@/lib/shelbyServer";

const MAX_POST_LENGTH = 280;
const MAX_ATTACHMENTS = 4;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25MB
const MAX_GIF_BYTES = 10 * 1024 * 1024; // 10MB

export const runtime = "nodejs";

function toErrorResponse(status: number, error: string, details?: string) {
  return NextResponse.json(
    {
      error,
      ...(details ? { details } : {})
    },
    { status }
  );
}

export async function GET(request: NextRequest) {
  try {
    const author = request.nextUrl.searchParams.get("author") ?? undefined;
    const limitRaw = request.nextUrl.searchParams.get("limit");
    const limit = limitRaw ? Number(limitRaw) : undefined;
    const posts = await listShelbyPosts({
      ...(author ? { author } : {}),
      ...(typeof limit === "number" && Number.isFinite(limit) ? { limit } : {})
    });
    return NextResponse.json(posts);
  } catch (error) {
    const details =
      error instanceof Error ? error.message : "Shelby read failed. Check server Shelby configuration.";

    console.error("[GET /api/posts] Shelby error:", error);

    return toErrorResponse(500, "Failed to fetch posts.", details);
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    let content = "";
    let author = "";
    let location: string | undefined;
    let scheduledAt: number | undefined;
    let poll:
      | {
          options: string[];
          endsAt?: number;
        }
      | undefined;
    let attachments:
      | {
          blobName: string;
          mimeType: string;
          size: number;
          data: Uint8Array;
        }[]
      | undefined;
    let gifUrl: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      content = String(form.get("content") ?? "").trim();
      author = String(form.get("author") ?? "").trim();
      location = String(form.get("location") ?? "").trim() || undefined;
      gifUrl = String(form.get("gif_url") ?? "").trim() || undefined;
      const scheduledRaw = String(form.get("scheduled_at") ?? "").trim();
      if (scheduledRaw) {
        const parsed = Date.parse(scheduledRaw);
        if (!Number.isNaN(parsed)) scheduledAt = parsed;
      }
      const pollRaw = String(form.get("poll") ?? "").trim();
      if (pollRaw) {
        try {
          const parsed = JSON.parse(pollRaw) as { options?: unknown; endsAt?: unknown };
          if (Array.isArray(parsed.options)) {
            const options = parsed.options.map((o) => String(o).trim()).filter(Boolean).slice(0, 4);
            poll = options.length >= 2 ? { options } : undefined;
          }
        } catch {
          // ignore invalid poll
        }
      }

      const files = form.getAll("files").filter((v): v is File => v instanceof File);
      if (files.length > MAX_ATTACHMENTS) {
        return toErrorResponse(400, `Max ${MAX_ATTACHMENTS} attachments.`);
      }

      const now = Date.now();
      attachments = await Promise.all(
        files.map(async (file) => {
          if (file.size > MAX_ATTACHMENT_BYTES) {
            throw new Error(`Attachment too large (max ${MAX_ATTACHMENT_BYTES} bytes).`);
          }
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 64) || "file";
          const blobName = `nora/media/${now}-${crypto.randomUUID()}-${safeName}`;
          const bytes = new Uint8Array(await file.arrayBuffer());
          return {
            blobName,
            mimeType: file.type || "application/octet-stream",
            size: file.size,
            data: bytes
          };
        })
      );
    } else {
      const body = await request.json();
      content = String(body?.content ?? "").trim();
      author = String(body?.author ?? "").trim();
      location = typeof body?.location === "string" ? body.location.trim() : undefined;
      gifUrl = typeof body?.gifUrl === "string" ? body.gifUrl.trim() : undefined;
      if (typeof body?.scheduledAt === "string") {
        const parsed = Date.parse(body.scheduledAt);
        if (!Number.isNaN(parsed)) scheduledAt = parsed;
      }
      if (body?.poll && Array.isArray(body.poll.options)) {
        const options = body.poll.options.map((o: unknown) => String(o).trim()).filter(Boolean).slice(0, 4);
        poll = options.length >= 2 ? { options } : undefined;
      }
    }

    if (content.length > MAX_POST_LENGTH) {
      return toErrorResponse(400, "Content must be 280 characters or less.");
    }
    if (!author) {
      return toErrorResponse(400, "Author is required.");
    }

    // If text is empty, require at least one non-text feature.
    const hasNonText = !!(attachments?.length || gifUrl || poll);
    if (!content && !hasNonText) {
      return toErrorResponse(400, "Content is required.");
    }

    if (gifUrl) {
      const res = await fetch(gifUrl);
      if (!res.ok) {
        return toErrorResponse(400, "Failed to fetch GIF URL.");
      }
      const mimeType = res.headers.get("content-type") ?? "application/octet-stream";
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength > MAX_GIF_BYTES) {
        return toErrorResponse(400, `GIF too large (max ${MAX_GIF_BYTES} bytes).`);
      }
      const now = Date.now();
      const blobName = `nora/media/${now}-${crypto.randomUUID()}-gif`;
      attachments = [
        ...(attachments ?? []),
        { blobName, mimeType, size: buf.byteLength, data: buf }
      ].slice(0, MAX_ATTACHMENTS);
    }

    const post = await createShelbyPost({
      content,
      author,
      ...(attachments ? { attachments } : {}),
      ...(location ? { location } : {}),
      ...(scheduledAt ? { scheduledAt } : {}),
      ...(poll ? { poll } : {})
    });
    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    const details =
      error instanceof Error ? error.message : "Shelby upload failed. Check server env/signer config.";

    console.error("[POST /api/posts] Shelby error:", error);

    return toErrorResponse(500, "Failed to create post.", details);
  }
}
