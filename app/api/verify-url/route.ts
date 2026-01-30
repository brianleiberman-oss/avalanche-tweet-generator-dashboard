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

      const response = await fetch(url, {
        method: "HEAD", // Just check if it exists, don't download
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; AvalancheTweetBot/1.0)",
        },
      });

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
