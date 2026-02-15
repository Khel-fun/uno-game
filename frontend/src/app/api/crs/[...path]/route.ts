import { NextRequest, NextResponse } from 'next/server';

/**
 * CRS Proxy Route
 * Proxies requests to crs.aztec.network to avoid CORS issues
 * caused by Cross-Origin-Embedder-Policy: require-corp header.
 * 
 * bb.js internally fetches CRS data from https://crs.aztec.network/...
 * but that CDN doesn't send CORP headers, so with COEP: require-corp
 * the browser blocks the request. This proxy fetches server-side.
 */

const CRS_UPSTREAM = 'https://crs.aztec.network';

// Cache CRS data in memory (CRS is immutable, safe to cache indefinitely)
const crsCache = new Map<string, { data: ArrayBuffer; contentType: string }>();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const crsPath = '/' + path.join('/');
  const upstreamUrl = `${CRS_UPSTREAM}${crsPath}`;

  // Check memory cache first
  const cached = crsCache.get(crsPath);
  if (cached) {
    return new NextResponse(cached.data, {
      status: 200,
      headers: {
        'Content-Type': cached.contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Cross-Origin-Resource-Policy': 'same-origin',
      },
    });
  }

  try {
    console.log(`[CRS Proxy] Fetching: ${upstreamUrl}`);
    
    // Handle range requests (bb.js fetches CRS data in chunks)
    const headers: HeadersInit = {};
    const rangeHeader = request.headers.get('range');
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    const response = await fetch(upstreamUrl, {
      headers,
      // No timeout — CRS files can be large
    });

    if (!response.ok && response.status !== 206) {
      console.error(`[CRS Proxy] Upstream error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `CRS upstream returned ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    // Cache in memory (only non-range full responses)
    if (!rangeHeader && response.status === 200) {
      crsCache.set(crsPath, { data, contentType });
    }

    const responseHeaders: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Cross-Origin-Resource-Policy': 'same-origin',
    };

    // Forward content-range header for partial responses
    const contentRange = response.headers.get('content-range');
    if (contentRange) {
      responseHeaders['Content-Range'] = contentRange;
    }

    console.log(`[CRS Proxy] Served: ${crsPath} (${data.byteLength} bytes)`);

    return new NextResponse(data, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`[CRS Proxy] Error fetching ${upstreamUrl}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch CRS data' },
      { status: 502 }
    );
  }
}
