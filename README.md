# roypara.com

Portfolio personal de **Roy Para Olivera**, desarrollador full-stack en formación en Gran Canaria.

La web es un [Astro](https://astro.build) estático con CSS sin frameworks, en español (`/`) e inglés (`/en/`) y con tema claro y oscuro. Su elemento central es un **radar 3D en directo**: dibuja los aviones que capta la antena ADS-B que tengo en casa, sobre un mapa de Canarias.

## Cómo es la página

- **Portada:** un cielo oscuro a pantalla completa con el radar. Los aviones aparecen a su altitud real, con estela y una línea hasta el suelo. Se gira arrastrando y, al pulsar un avión, se abre su ficha (foto, ruta, modelo, aerolínea, matrícula, altitud, velocidad y rumbo).
- **Proyectos:** tarjetas con captura. La del Radar ADS-B lleva un mini radar en directo en lugar de una foto.
- **Ahora:** una banda con lo que hago ahora y un panel tipo aeropuerto con los tres aviones más cercanos a la antena.
- **Trayectoria:** una ruta de vuelo que se dibuja al hacer scroll, con un avión y las etapas que se encienden al alcanzarlas.
- **Contacto**, con la misma estética oscura que la portada.
- **Tipografía:** Hanken Grotesk para el texto y B612 (la fuente que Airbus diseñó para las pantallas de cabina) solo para datos.
- **Movimiento:** respeta `prefers-reduced-motion`; sin JavaScript se ve el contenido, sin el radar.

## Cómo funciona el radar en directo

```
antena ADS-B → Raspberry Pi (dump1090) → Cloudflare Tunnel → Worker (/api/*) → navegador
```

- **La Pi** sirve `aircraft.json` y un túnel de Cloudflare (`cloudflared`) lo publica en `radar.roypara.com`. El túnel solo deja pasar esa ruta: el resto de la Pi, incluido `receiver.json`, que trae la posición exacta de la antena, da 404.
- **El Worker** (`worker/`) atiende solo `/api/*`; el resto de la web son archivos estáticos.
  - `/api/aviones`: los aviones ahora mismo, ya convertidos a kilómetros alrededor de un centro aproximado (`src/data/radar.ts`). Se cachea 5 s, así que la Pi recibe como mucho una petición cada 5 s por centro de datos.
  - `/api/estelas`: los últimos 10 minutos de recorrido, para que el radar no empiece vacío.
- **En el navegador** hay un único sondeo compartido (`src/lib/live.ts`) del que se alimentan el radar de la portada, el mini radar y el panel de «Ahora». Entre dos lecturas, los aviones se mueven por su rumbo y velocidad.
- **Si la antena no responde**, el radar queda vacío con un aviso. No hay grabación de respaldo.
- **Fichas:** foto de [Planespotters](https://www.planespotters.net) y datos de [HexDB](https://hexdb.io). Las costas son de [Natural Earth](https://www.naturalearthdata.com) (dominio público).

### Montar la parte de la Pi

1. Instalar `cloudflared` en la Pi y crear un túnel (`cloudflared tunnel create`, `tunnel route dns` hacia `radar.roypara.com`).
2. Configurarlo para exponer solo `aircraft.json`:

   ```yaml
   ingress:
     - hostname: radar.roypara.com
       path: ^/dump1090/data/aircraft\.json$
       service: http://localhost:80
     - service: http_status:404
   ```

3. Ejecutarlo como servicio (`cloudflared service install`).

La ruta `/dump1090/data/aircraft.json` y el nombre del host están en `worker/index.ts`; si tu dump1090 sirve en otro sitio, cámbialos ahí y en la regla del túnel.

## Desarrollo

Requisitos: Node.js 22+ y pnpm.

```bash
pnpm install
pnpm dev       # http://localhost:4321, con /api/* servida por el mismo Worker
pnpm build     # comprueba tipos y genera dist/
pnpm preview   # sirve dist/
node worker/live.test.ts   # comprobaciones de la lógica del Worker
```

En local, `/api/aviones` pide los datos al túnel real. Para probar con otra fuente (otra Pi, un simulador):

```bash
RADAR_ORIGIN=http://<ip-de-la-pi> pnpm dev
```

## Dónde está cada cosa

| Qué | Dónde |
| --- | --- |
| Datos personales, proyectos, formación, stack, «Ahora» | `src/data/profile.ts` |
| Centro, alcance y aeropuerto del radar | `src/data/radar.ts` |
| Textos de la interfaz (ES/EN) | `src/i18n/ui.ts` |
| Colores, tipografía y espaciado | `src/styles/global.css` |
| Secciones | `src/components/` |
| Motor del radar (canvas) | `src/lib/radar.ts` |
| Sondeo compartido, panel de vuelos, fichas | `src/lib/live.ts`, `src/lib/board.ts`, `src/lib/aircraft.ts` |
| API en directo (Worker) | `worker/` |
| Costas de las islas | `src/data/islands.json` |
| Foto | `src/assets/roy.jpg` |
| CV, favicon, imagen para redes (`og.png`) | `public/` |

**Proyectos:** cada uno en `projects`, dentro de `src/data/profile.ts`. Para una captura, guárdala en `src/assets/`, impórtala arriba e indícala en `image`; con `miniRadar: true` se muestra el mini radar en su lugar.

**CV:** hay tres PDF en `public/`: `cv-roy-para.pdf` (CV normal), `cv-roy-para-europass-es.pdf` y `cv-roy-para-europass-en.pdf`. El botón de CV muestra el normal y el enlace Europass, el del idioma de la página.

**Certificaciones:** se editan en `certifications`, en `src/data/profile.ts`. El enlace «Ver certificado» aparece solo si el PDF indicado en `file` existe en `public/`.

**Idioma automático:** quien entra en `/` con un navegador que no tiene el español entre sus idiomas pasa a `/en/`. Si elige idioma con el selector, se recuerda y no se le vuelve a redirigir.

**Imagen para redes:** `public/og.png` (1200×630) es la tarjeta que se ve al compartir el enlace. Está dibujada con la misma estética que la portada y no se actualiza sola. Las plataformas guardan la vista previa en caché; en LinkedIn se fuerza con su Post Inspector.

El calendario de contribuciones de GitHub está desactivado. Para mostrarlo, pon `showGithubCalendar: true` en `src/data/profile.ts`: se genera al hacer el build, y un workflow semanal (`.github/workflows/rebuild.yml`) vuelve a desplegar la web para mantenerlo al día.

## Despliegue

Cloudflare Workers con Workers Builds, conectado a este repositorio: cada push a `main` se publica solo. `wrangler.jsonc` sirve los archivos de `dist/` y ejecuta `worker/index.ts` solo para `/api/*`.

- Comando de build: `pnpm run build`
- Comando de deploy: `npx wrangler deploy`

El plan gratuito de Workers admite 100.000 peticiones al día. Cada visitante con el radar visible hace unas 12 por minuto.

## Licencia

El código es MIT (ver `LICENSE`). El proyecto nació de la plantilla [DarkMinimal](https://github.com/Gothsec/Portfolio) (MIT), de la que ya no queda prácticamente nada. Los contenidos personales (textos, fotos y CV) no están incluidos en la licencia.
