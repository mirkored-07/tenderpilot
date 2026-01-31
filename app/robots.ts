import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = "https://www.trytenderpilot.com";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Block Google from indexing your private dashboard or API
      disallow: ["/app/", "/api/", "/dashboard/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}