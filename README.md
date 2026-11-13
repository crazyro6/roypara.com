# roypara.com

Portfolio personal de **Roy Para Olivera**, desarrollador full-stack en formación en Gran Canaria.

La web es un [Astro](https://astro.build) estático con CSS sin frameworks, en español (`/`) e inglés (`/en/`) y con tema claro y oscuro. Su elemento central es un **radar 3D en directo**: dibuja los aviones que capta la antena ADS-B que tengo en casa, sobre un mapa de Canarias.

## Cómo es la página

- **Portada:** un cielo oscuro a pantalla completa con el radar. Los aviones aparecen a su altitud real, con estela y una línea hasta el suelo. Se gira arrastrando y, al pulsar un avión, se abre su ficha (foto, ruta, modelo, aerolínea, matrícula, altitud, velocidad y rumbo).
- **Proyectos:** tarjetas con captura. La del Radar ADS-B lleva un mini radar en directo en lugar de una foto.
- **Radar completo (`/radar/`):** el mapa 3D del proyecto [Radar ADS-B](https://github.com/crazyro6/Fronted-Feeder-FR24), con lista de aviones y fichas detalladas. Se enlaza desde su tarjeta y desde la portada. Es una app React compilada que lee la misma API (`/api/aircraft.json` y `/api/receiver.json`); vive en `public/radar/` y no se edita aquí: se cambia en su repo y se vuelve a compilar con `npm run publicar`.
- **Ahora:** una banda con lo que hago ahora y un panel tipo aeropuerto con los tres aviones más cercanos a la antena.
- **Trayectoria:** una ruta de vuelo que se dibuja al hacer scroll, con un avión y las etapas que se encienden al alcanzarlas.
- **Contacto**, con la misma estética oscura que la portada.
- **Tipografía:** Hanken Grotesk para el texto y B612 (la fuente que Airbus diseñó para las pantallas de cabina) solo para datos.
- **Movimiento:** respeta `prefers-reduced-motion`; sin JavaScript se ve el contenido, sin el radar.

## Cómo funciona el radar en directo

```
antena ADS-B → Raspberry Pi (readsb + tar1090) → Cloudflare Tunnel + Access → Worker (/api/*) → navegador
```

- **La Pi** sirve el `aircraft.json` de tar1090 y un túnel de Cloudflare (`cloudflared`) lo publica en `radar.roypara.com`. El túnel solo deja pasar esa ruta (el resto, incluido `receiver.json`, con la posición exacta de la antena, da 404) y además está cerrado con Cloudflare Access: solo entra quien lleve el token del Worker. Es necesario porque el `aircraft.json` de tar1090 trae la distancia y dirección de cada avión a la antena, y con eso se saca dónde está.
- **El Worker** (`worker/`) atiende solo `/api/*`; el resto de la web son archivos estáticos.
  - `/api/aircraft.json`: los aviones ahora mismo, con el mismo formato y los mismos nombres que el `aircraft.json` de la Pi. Solo se quitan los campos que delatan dónde está la antena (`r_dst`, `r_dir`, `rr_lat`, `rr_lon`); es una lista cerrada, así que un campo nuevo de tar1090 no sale hasta añadirlo en `worker/live.ts`. Se cachea 5 s, así que la Pi recibe como mucho una petición cada 5 s por centro de datos.
  - `/api/receiver.json`: la posición de la antena, pero solo aproximada (`src/data/radar.ts`).
  - `/api/estelas`: los últimos 10 minutos de recorrido, para que el radar no empiece vacío.
- **En el navegador** hay un único sondeo compartido (`src/lib/live.ts`) del que se alimentan el radar de la portada, el mini radar y el panel de «Ahora». Cada avión se convierte a kilómetros alrededor del centro aproximado y, entre dos lecturas, se mueve por su rumbo y velocidad.
- **Si la antena no responde**, el radar queda vacío con un aviso. No hay grabación de respaldo.
- **Fichas:** foto de [Planespotters](https://www.planespotters.net); aerolínea y ruta de [HexDB](https://hexdb.io); matrícula y modelo, de la Pi si tiene la base de datos de aviones y, si no, de HexDB. Las costas son de [Natural Earth](https://www.naturalearthdata.com) (dominio público).

### Montar la parte de la Pi

1. Instalar `cloudflared` en la Pi y crear un túnel (`cloudflared tunnel create`, `tunnel route dns` hacia `radar.roypara.com`).
2. Configurarlo para exponer solo `aircraft.json`:

   ```yaml
   ingress:
     - hostname: radar.roypara.com
       path: ^/adsbx/data/aircraft\.json$
       service: http://localhost:80
     - service: http_status:404
   ```

3. Ejecutarlo como servicio (`cloudflared service install`).
4. **Cerrarlo con Cloudflare Access** (Zero Trust, gratis). Antes de dejar el túnel público, o cualquiera podría leer la distancia a la antena:
   - Access controls → Service credentials: crear un *Service Token* sin caducidad.
   - En el Worker (Settings → Variables and Secrets), dos secretos: `ACCESS_ID` (Client ID) y `ACCESS_SECRET` (Client Secret).
   - Access controls → Applications → Self-hosted, con `radar.roypara.com` y sin ruta; política con acción *Service Auth* e *Include: Service Token*.

   Sin la clave, el túnel responde 403.
5. Opcional, para que matrícula y modelo salgan de la Pi: bajar `aircraft.csv.gz` de [tar1090-db](https://github.com/wiedehopf/tar1090-db/tree/csv) y arrancar el decodificador con `--db-file <ruta> --db-file-lt`. No se actualiza solo.

La ruta `/adsbx/data/aircraft.json` y el nombre del host están en `worker/index.ts`; si tu tar1090 sirve en otro sitio, cámbialos ahí y en la regla del túnel.

## Desarrollo

Requisitos: Node.js 22+ y pnpm.

```bash
pnpm install
pnpm dev       # http://localhost:4321, con /api/* servida por el mismo Worker
pnpm build     # comprueba tipos y genera dist/
pnpm preview   # sirve dist/
node worker/live.test.ts   # comprobaciones de la lógica del Worker
```

En local, `/api/aircraft.json` pide los datos al túnel real, que está cerrado: hace falta la clave en el entorno (`ACCESS_ID` y `ACCESS_SECRET`). Sin ella, o para probar con otra fuente (la Pi en la red local, un simulador), se indica el origen, que va sin clave:

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
| Radar completo (compilado, no editar) | `public/radar/` |
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
