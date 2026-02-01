import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://www.trytenderpilot.com";

  // High-value industry pages (Dynamic content / "Honeypots")
  const industryPages = [
    "/tenders/software",
    "/tenders/construction",
    "/tenders/engineering",
  ];

  // Static marketing pages
  const staticPages = [
    "",
    "/how-it-works",
    "/sample",
    "/privacy",
    "/terms",
    "/login", // Login is usually static, though often excluded from sitemaps, keeping it is fine.
  ];

  const now = new Date();

  const industryEntries = industryPages.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: "daily" as const, // Signal to Google these update often
    priority: 0.9,
  }));

  const staticEntries = staticPages.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: route === "" ? 1.0 : 0.7,
  }));

  return [...staticEntries, ...industryEntries];
}