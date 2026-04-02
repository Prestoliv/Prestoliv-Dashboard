import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const lastmod = now.toISOString();

  // Static sitemap entries for the top-level marketing/app routes.
  // If you later add dynamic project/query pages, you can extend this list.
  return [
    { url: `${siteUrl}/`, lastModified: lastmod },
    { url: `${siteUrl}/dashboard`, lastModified: lastmod },
    { url: `${siteUrl}/queries`, lastModified: lastmod },
    { url: `${siteUrl}/admin`, lastModified: lastmod },
    { url: `${siteUrl}/login`, lastModified: lastmod },
    { url: `${siteUrl}/at/profile`, lastModified: lastmod },
  ];
}

