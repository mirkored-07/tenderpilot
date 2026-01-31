import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  // We hardcode this to ensure Google sees the real domain, not "localhost"
  const baseUrl = "https://www.trytenderpilot.com";

  const routes = [
    "",                   // Homepage
    "/how-it-works",      // Feature page
    "/sample",            // Sample output
    "/tenders/software",  // <--- YOUR NEW PAGE (Crucial!)
    "/privacy",
    "/terms",
  ];

  const now = new Date();

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "/tenders/software" ? "daily" : "weekly",
    priority: route === "" ? 1 : 0.8,
  }));
}