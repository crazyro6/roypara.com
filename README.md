# roypara.com

Portfolio personal de **Roy Para Olivera**, desarrollador full-stack en formación en Gran Canaria.

Web estática hecha con [Astro](https://astro.build) y CSS sin frameworks, en español (`/`) e inglés (`/en/`), con tema claro/oscuro.

## Desarrollo

Requisitos: Node.js 20+ y pnpm.

```bash
pnpm install
pnpm dev       # http://localhost:4321
pnpm build     # comprueba tipos y genera dist/
pnpm preview   # sirve dist/
```

## Dónde está cada cosa

| Qué | Dónde |
| --- | --- |
| Datos personales, proyectos, formación, stack | `src/data/profile.ts` |
| Textos de la interfaz (ES/EN) | `src/i18n/ui.ts` |
| Colores, tipografía y espaciado | `src/styles/global.css` |
| Secciones | `src/components/` |
| Foto | `src/assets/roy.png` |
| CV, favicon, imagen para redes | `public/` |

**CV Europass:** guarda el PDF como `public/cv-roy-para-europass.pdf`. Al hacer el build, el botón de CV se divide solo en dos (CV normal en español + Europass en inglés). Si quitas el archivo, vuelve a ser un único botón.

**Idioma automático:** quien entra en `/` con un navegador que no tiene el español entre sus idiomas pasa directamente a `/en/`. Si elige idioma con el selector, se recuerda y no se le vuelve a redirigir.

El calendario de contribuciones de GitHub está desactivado por ahora. Para mostrarlo, pon `showGithubCalendar: true` en `src/data/profile.ts`: se genera al hacer el build, y un workflow semanal (`.github/workflows/rebuild.yml`) vuelve a desplegar la web para mantenerlo al día.

## Despliegue

Cloudflare, conectado a este repositorio: cada push a `main` se publica automáticamente.

- Comando de build: `pnpm run build`
- Directorio de salida: `dist`

## Licencia

El código es MIT (ver `LICENSE`). La estructura inicial partió de la plantilla [DarkMinimal](https://github.com/Gothsec/Portfolio) (MIT). Los contenidos personales (textos, foto y CV) no están incluidos en la licencia.
