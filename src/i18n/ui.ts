export const langs = ["es", "en"] as const;
export type Lang = (typeof langs)[number];

/** Texto traducible. */
export type T = Record<Lang, string>;

export const ui = {
  metaDescription: {
    es: "Roy Para Olivera, desarrollador full-stack en formación en Gran Canaria. Proyectos, formación y contacto.",
    en: "Roy Para Olivera, full-stack developer in training based in Gran Canaria. Projects, education and contact.",
  },
  skip: { es: "Saltar al contenido", en: "Skip to content" },
  switchLang: { es: "Read in English", en: "Leer en español" },
  themeLight: { es: "Cambiar a tema claro", en: "Switch to light theme" },
  themeDark: { es: "Cambiar a tema oscuro", en: "Switch to dark theme" },
  localTime: { es: "hora local", en: "local time" },
  photoAlt: {
    es: "Roy sonriendo, con una camiseta blanca",
    en: "Roy smiling, wearing a white T-shirt",
  },
  downloadCv: { es: "Descargar CV", en: "Download CV" },
  cvLangNote: { es: "PDF", en: "PDF, in Spanish" },
  cvGroup: { es: "Descargar currículum", en: "Download résumé" },
  cvStandardNote: { es: "", en: "Spanish" },
  cvEuropassNote: { es: "", en: "English" },

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

  experienceTitle: { es: "Experiencia", en: "Experience" },
  educationTitle: { es: "Formación", en: "Education" },
  stackTitle: { es: "Con qué trabajo", en: "What I work with" },
  languagesTitle: { es: "Idiomas", en: "Languages" },

  contactTitle: { es: "Hablemos", en: "Let's talk" },
  contactText: {
    es: "Si buscas a alguien con ganas de aprender y de construir cosas útiles, escríbeme o llámame.",
    en: "If you're looking for someone eager to learn and to build useful things, drop me a line or give me a call.",
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
