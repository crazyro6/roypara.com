export const langs = ["es", "en"] as const;
export type Lang = (typeof langs)[number];

/** Texto traducible. */
export type T = Record<Lang, string>;

export const ui = {
  metaDescription: {
    es: "Roy Para Olivera, desarrollador full-stack en formación en Gran Canaria. Proyectos, formación y contacto.",
    en: "Roy Para Olivera, full-stack developer in training based in Gran Canaria. Projects, education and contact.",
  },
  navLabel: { es: "Secciones e idioma", en: "Sections and language" },
  contactNav: { es: "Contacto", en: "Contact" },
  skip: { es: "Saltar al contenido", en: "Skip to content" },
  switchLang: { es: "Read in English", en: "Leer en español" },
  themeLight: { es: "Cambiar a tema claro", en: "Switch to light theme" },
  themeDark: { es: "Cambiar a tema oscuro", en: "Switch to dark theme" },
  localTime: { es: "hora local", en: "local time" },
  hello: { es: "Hola, soy Roy.", en: "Hi, I'm Roy." },
  writeMe: { es: "Escríbeme", en: "Email me" },
  radarCaption: {
    es: "{n} aviones que captó la antena de mi ventana el {day}, de {from} a {to}.",
    en: "{n} aircraft picked up by the antenna at my window on {day}, {from}–{to}.",
  },
  radarSample: {
    es: "Trayectorias de prueba: solo se ven en local hasta exportar los datos reales.",
    en: "Sample tracks: only shown locally until the real data is exported.",
  },
  radarCount: { es: "{n} aviones", en: "{n} aircraft" },
  radarRange: { es: "alcance {n} km", en: "{n} km range" },
  cvEuropass: { es: "CV Europass", en: "Europass CV" },
  radarAlt: {
    es: "Pantalla de radar con {n} trayectorias de aviones alrededor de mi receptor.",
    en: "Radar screen showing {n} aircraft tracks around my receiver.",
  },
  photoAlt: {
    es: "Roy sonriendo, con una camiseta blanca",
    en: "Roy smiling, wearing a white T-shirt",
  },
  downloadCv: { es: "Descargar CV", en: "CV (Spanish)" },

  projectsTitle: { es: "Proyectos", en: "Projects" },
  projectsIntro: {
    es: "Cosas que he construido porque las quería usar yo mismo.",
    en: "Things I built because I wanted to use them myself.",
  },
  code: { es: "Código", en: "Code" },
  demo: { es: "Demo", en: "Live" },
  moreOnGithub: { es: "Más en GitHub", en: "More on GitHub" },

  activityTitle: { es: "Actividad en GitHub", en: "GitHub activity" },
  contributions: {
    es: "{n} contribuciones en el último año",
    en: "{n} contributions in the last year",
  },
  contributionDay: {
    es: "{n} contribuciones el {date}",
    en: "{n} contributions on {date}",
  },
  less: { es: "Menos", en: "Less" },
  more: { es: "Más", en: "More" },

  pathTitle: { es: "Trayectoria", en: "Background" },
  nowTitle: { es: "Ahora", en: "Now" },
  nowUpdated: { es: "Actualizado en {date}", en: "Updated {date}" },
  photoPending: { es: "Foto pendiente", en: "Photo to come" },
  experienceTitle: { es: "Experiencia", en: "Experience" },
  educationTitle: { es: "Formación", en: "Education" },
  certificationsTitle: { es: "Certificaciones", en: "Certifications" },
  viewCertificate: { es: "Ver certificado", en: "View certificate" },
  stackTitle: { es: "Con qué trabajo", en: "What I work with" },
  languagesTitle: { es: "Idiomas", en: "Languages" },

  contactTitle: { es: "¿Hablamos?", en: "Say hi" },
  contactText: {
    es: "Si tienes unas prácticas, un puesto junior o simplemente quieres comentar algo de lo que has visto aquí, escríbeme o llámame.",
    en: "If you have an internship, a junior role or just want to talk about something you saw here, email or call me.",
  },
  copy: { es: "Copiar", en: "Copy" },
  copied: { es: "Copiado", en: "Copied" },
  copyEmail: { es: "Copiar email", en: "Copy email" },
  copyPhone: { es: "Copiar teléfono", en: "Copy phone number" },

  builtWith: { es: "Hecha a mano con Astro", en: "Handmade with Astro" },
  sourceCode: { es: "Código de esta web", en: "Source" },

  notFoundTitle: { es: "Aquí no hay nada", en: "Nothing here" },
  notFoundText: {
    es: "Esta página se ha salido del radar.",
    en: "This page has dropped off the radar.",
  },
  backHome: { es: "Volver al inicio", en: "Back home" },
} satisfies Record<string, T>;

export function useT(lang: Lang) {
  return {
    t: (key: keyof typeof ui, vars: Record<string, string | number> = {}) =>
      ui[key][lang].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? "")),
    tr: (text: T) => text[lang],
  };
}

export const pathFor = (lang: Lang) => (lang === "es" ? "/" : "/en/");
export const htmlLang = { es: "es-ES", en: "en" } satisfies T;
