import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://www.trytenderpilot.com";

  // Grouped for easier logic management
  const honeyPotPages = [
    "/tenders/software",
    "/tenders/construction",
    "/tenders/engineering",
  ];

  const staticPages = [
    "",
    "/how-it-works",
    "/sample",
    "/privacy",
    "/terms",
  ];

  const now = new Date();

  const honeyPotEntries = honeyPotPages.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: "daily" as const, // Tell Google these lists update often
    priority: 0.9, // Higher priority than static pages
  }));

  const staticEntries = staticPages.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: route === "" ? 1 : 0.7,
  }));

  return [...staticEntries, ...honeyPotEntries];
}