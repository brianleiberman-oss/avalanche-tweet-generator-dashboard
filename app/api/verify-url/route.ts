import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { url } = (await request.json()) as { url: string };

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json({
        url,
        status: "broken",
        error: "Invalid URL format",
      });
    }

    // Check if URL is reachable
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      // Try HEAD first, fall back to GET if blocked
      let response = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      // If HEAD is forbidden, try GET
      if (response.status === 403 || response.status === 405) {
        response = await fetch(url, {
          method: "GET",
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
        });
      }

      clearTimeout(timeoutId);

      if (response.ok) {
        return NextResponse.json({
          url,
          status: "verified",
          httpStatus: response.status,
          verifiedAt: new Date().toISOString(),
        });
      } else if (response.status === 404) {
        return NextResponse.json({
          url,
          status: "broken",
          httpStatus: response.status,
          error: "Page not found (404)",
        });
      } else if (response.status === 403) {
        // Site blocks automated access - mark as needs manual verification
        return NextResponse.json({
          url,
          status: "unverified",
          httpStatus: response.status,
          error: "Site blocks automated checks - verify manually",
        });
      } else {
        return NextResponse.json({
          url,
          status: "unverified",
          httpStatus: response.status,
          error: `HTTP ${response.status}`,
        });
      }
    } catch (fetchError) {
      const error = fetchError as Error;
      return NextResponse.json({
        url,
        status: "broken",
        error: error.name === "AbortError" ? "Request timeout" : error.message,
      });
    }
  } catch (error) {
    console.error("Error verifying URL:", error);
    return NextResponse.json(
      { error: "Failed to verify URL" },
      { status: 500 }
    );
  }
}
