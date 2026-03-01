import { NextRequest, NextResponse } from "next/server";

const AVATAR_BASE_URL = "https://api.dicebear.com/9.x/pixel-art/svg";

export async function GET(req: NextRequest) {
  const seed = req.nextUrl.searchParams.get("seed") || "anon";
  const remoteUrl = `${AVATAR_BASE_URL}?seed=${encodeURIComponent(seed)}`;

  const upstream = await fetch(remoteUrl, {
    headers: {
      Accept: "image/svg+xml",
    },
  });

  const svg = await upstream.text();

  return new NextResponse(svg, {
    status: upstream.status,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
