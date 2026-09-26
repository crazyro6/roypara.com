// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://roypara.com",
  output: "static",
  trailingSlash: "ignore",
  i18n: {
    locales: ["es", "en"],
    defaultLocale: "es",
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    sitemap({
      i18n: { defaultLocale: "es", locales: { es: "es-ES", en: "en" } },
    }),
  ],
  build: { inlineStylesheets: "always" },
  vite: {
    resolve: { alias: { "@": "/src" } },
  },
});
