import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = "https://www.trytenderpilot.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Keep bots out of the actual SaaS application and API
        disallow: ["/app/", "/api/", "/dashboard/", "/auth/"],
      },
      // Explicitly whitelist major AI and LLM crawlers to ensure Generative Engine Optimization (GEO)
      {
        userAgent: [
          "GPTBot",
          "ChatGPT-User",
          "Google-Extended",
          "ClaudeBot",
          "Claude-Web",
          "Anthropic-ai",
          "PerplexityBot",
          "Applebot-Extended",
          "Cohere-ai",
          "Omgili",
          "Omgilibot",
          "CCBot",
        ],
        allow: "/",
        disallow: ["/app/", "/api/", "/dashboard/", "/auth/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}