import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function isAllowedUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    return url.hostname.endsWith("shelby.xyz");
  } catch {
    return false;
  }
}

function getFilenameFromUrl(value: string): string {
  try {
    const url = new URL(value);
    const last = url.pathname.split("/").filter(Boolean).pop();
    return last ? last : `shelby-blob-${Date.now()}`;
  } catch {
    return `shelby-blob-${Date.now()}`;
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get("url");
    if (!url || !isAllowedUrl(url)) {
      return NextResponse.json({ error: "Invalid or unsupported blob URL." }, { status: 400 });
    }

    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch blob.", details: `status ${res.status}` },
        { status: 502 }
      );
    }

    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    const filename = getFilenameFromUrl(url);
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to download blob.", details: e instanceof Error ? e.message : "Unknown error." },
      { status: 500 }
    );
  }
}
