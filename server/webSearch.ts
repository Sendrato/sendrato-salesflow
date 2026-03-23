import { getSetting, SETTING_KEYS } from "./settingsDb";

interface TavilyResult {
  title: string;
  url: string;
  content: string;
}

export async function tavilySearch(
  query: string,
  options?: { maxResults?: number }
): Promise<{ results: TavilyResult[]; message?: string }> {
  const apiKey = await getSetting(SETTING_KEYS.TAVILY_API_KEY);

  if (!apiKey) {
    return {
      results: [],
      message:
        "Web search is not configured. Ask your admin to add a Tavily API key in Settings.",
    };
  }

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: options?.maxResults ?? 5,
        include_answer: false,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[Tavily] API error:", res.status, text);
      return {
        results: [],
        message: `Web search failed (${res.status}). Check your Tavily API key.`,
      };
    }

    const data = (await res.json()) as {
      results: { title: string; url: string; content: string }[];
    };

    return {
      results: (data.results ?? []).map(r => ({
        title: r.title,
        url: r.url,
        content: r.content,
      })),
    };
  } catch (err) {
    console.error("[Tavily] Search error:", err);
    return {
      results: [],
      message: "Web search failed due to a network error.",
    };
  }
}
