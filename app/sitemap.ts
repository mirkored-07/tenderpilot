import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://www.trytenderpilot.com";

  // Locales that exist as folders: /en /de /it /fr /es
  const locales = ["en", "de", "it", "fr", "es"] as const;

  // Only the pages that truly exist under each locale folder
  // (/en, /en/how-it-works, /en/sample, etc.)
  const localizedRoutes = ["", "/how-it-works", "/sample"] as const;

  // Global (non-localized) pages that exist once
  const globalRoutes = [
    "/privacy",
    "/terms",
    "/tenders/software",
    "/tenders/construction",
    "/tenders/engineering",
  ] as const;

  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  // Localized marketing pages
  for (const locale of locales) {
    for (const route of localizedRoutes) {
      const url = `${baseUrl}/${locale}${route}`;

      entries.push({
        url,
        lastModified: now,
        changeFrequency: "monthly",
        priority: route === "" ? 1.0 : 0.8,
      });
    }
  }
		// EN-only page (intentionally not duplicated across locales)
		entries.push({
		  url: `${baseUrl}/en/ai-go-no-go-decisions`,
		  lastModified: now,
		  changeFrequency: "monthly",
		  priority: 0.8,
		});

  // Global pages (only once — NOT duplicated per locale)
  for (const route of globalRoutes) {
    const url = `${baseUrl}${route}`;

    entries.push({
      url,
      lastModified: now,
      changeFrequency: route.startsWith("/tenders") ? "monthly" : "yearly",
      priority: route.startsWith("/tenders") ? 0.6 : 0.3,
    });
  }

  return entries;
}
