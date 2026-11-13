// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// En local no hay Cloudflare: este plugin sirve /api/* con el mismo código del
// Worker. Para probar con la Pi:  RADAR_ORIGIN=http://<ip-de-la-pi> pnpm dev
function radarApi() {
  return {
    name: "radar-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next();
        const worker = (await server.ssrLoadModule("/worker/index.ts")).default;
        const env = {
          ...process.env, // RADAR_ORIGIN, o ACCESS_ID y ACCESS_SECRET para leer del túnel real
          ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
        };
        const out = await worker.fetch(new Request(new URL(req.url, "http://localhost"), { method: req.method }), env, { waitUntil() {} });
        res.statusCode = out.status;
        out.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(Buffer.from(await out.arrayBuffer()));
      });
    },
  };
}

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
  vite: { plugins: [radarApi()] },
});
