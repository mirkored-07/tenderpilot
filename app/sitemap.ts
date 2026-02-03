import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://www.trytenderpilot.com";

  // 1. DEFINE YOUR LANGUAGES (Matches your folder structure)
  const languages = ["en", "de", "it", "es", "fr"];

  // 2. DEFINE YOUR ROUTES
  // These are the paths relative to the language folder
  const routes = [
    "", // This represents /en, /de, /it (the homepage for that language)
    "/how-it-works",
    "/sample",
    "/tenders/software",
    "/tenders/construction",
    "/tenders/engineering",
    "/privacy",
    "/terms",
    ];

  const now = new Date();
  const sitemapEntries: MetadataRoute.Sitemap = [];

  // 3. GENERATE ALL COMBINATIONS
  languages.forEach((lang) => {
    routes.forEach((route) => {
      // Create the full URL: https://site.com + /de + /how-it-works
      const fullUrl = `${baseUrl}/${lang}${route}`;
      
      sitemapEntries.push({
        url: fullUrl,
        lastModified: now,
        // Daily for industry pages, Monthly for static pages
        changeFrequency: route.startsWith("/tenders") ? "daily" : "monthly",
        // Homepage is 1.0, others 0.8 or 0.7
        priority: route === "" ? 1.0 : route.startsWith("/tenders") ? 0.9 : 0.7,
      });
    });
  });

  return sitemapEntries;
}