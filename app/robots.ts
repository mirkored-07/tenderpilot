import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = "https://www.trytenderpilot.com";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep bots out of the actual SaaS application and API
      disallow: ["/app/", "/api/", "/dashboard/", "/auth/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}