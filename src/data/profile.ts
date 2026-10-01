// Todo el contenido personal del portfolio vive aquí.
// Los textos traducibles van como { es, en }; el resto es igual en ambos idiomas.

import type { T } from "@/i18n/ui";

export const profile = {
  name: "Roy Para Olivera",
  shortName: "Roy Para",
  role: {
    es: "Desarrollador full-stack en formación",
    en: "Full-stack developer in training",
  } satisfies T,
  location: "Vecindario, Gran Canaria",
  // Se muestran junto a la hora local, un guiño al radar ADS-B.
  coordinates: "27°50′N 15°26′W",
  timeZone: "Atlantic/Canary",
  // null oculta el indicador de estado.
  status: {
    es: "Abierto a prácticas y primer empleo",
    en: "Open to internships and junior roles",
  } satisfies T | null,
  bio: [
    {
      es: "Soy Roy, estudiante de Desarrollo de Aplicaciones Multiplataforma en Gran Canaria. Me gusta construir herramientas que convierten datos en algo que se entiende de un vistazo: desde un radar de aviones casero con una Raspberry Pi hasta un panel en vivo para Rocket League.",
      en: "I'm Roy, a Multiplatform Application Development student based in Gran Canaria. I like building tools that turn raw data into something you can read at a glance, from a home-built aircraft radar running on a Raspberry Pi to a live dashboard for Rocket League.",
    },
    {
      es: "Programo sobre todo en Java y JavaScript, y estoy buscando mi primera oportunidad en un equipo donde seguir creciendo como desarrollador full-stack.",
      en: "I mostly write Java and JavaScript, and I'm looking for my first role on a team where I can keep growing as a full-stack developer.",
    },
  ] satisfies T[],
  email: "roypara@icloud.com",
  // Teléfono en la sección de contacto; null lo oculta.
  phone: "+34 611 146 257" as string | null,
  // PDF de la carpeta public/. Cada uno solo aparece en el botón si su
  // archivo existe; el Europass enlazado es el del idioma de la página.
  cv: {
    // CV normal, en español.
    standard: "/cv-roy-para.pdf",
    europass: {
      es: "/cv-roy-para-europass-es.pdf",
      en: "/cv-roy-para-europass-en.pdf",
    } satisfies T,
  },
  links: {
    github: "https://github.com/crazyro6",
    linkedin: "https://www.linkedin.com/in/roy-para/",
  },
  githubUser: "crazyro6",
  // Calendario de contribuciones de GitHub. Cambia a true para mostrarlo.
  showGithubCalendar: false,
  // Enlace al código de esta web en el footer; null lo oculta.
  sourceRepo: "https://github.com/crazyro6/roypara.com" as string | null,
};

export type Project = {
  name: string;
  year: string;
  description: T;
  stack: string[];
  repo?: string;
  demo?: string;
};

export const projects: Project[] = [
  {
    name: "Rocket League Live Dashboard",
    year: "2026",
    description: {
      es: "Panel en tiempo real que lee la Stats API local del juego: marcador, rangos y MMR de cada jugador, historial de la sesión y un feed de eventos. Se instala como PWA y arranca sola con Windows.",
      en: "Real-time dashboard fed by the game's local Stats API: live scoreboard, every player's rank and MMR, session history and an event feed. Installs as a PWA and starts with Windows.",
    },
    stack: ["React", "Vite", "Node.js", "PWA"],
    repo: "https://github.com/crazyro6/Rocket-League-Live-Dashboard",
  },
  {
    name: "Radar ADS-B",
    year: "2026",
    description: {
      es: "Interfaz para mi propio receptor ADS-B (Raspberry Pi + RTL-SDR). Lee en vivo los datos de dump1090 y los cruza con HexDB y Planespotters para mostrar matrícula, ruta y foto de cada avión que pasa sobre la isla.",
      en: "Front end for my own ADS-B receiver (Raspberry Pi + RTL-SDR). It reads dump1090's live feed and cross-references HexDB and Planespotters to show the registration, route and photo of every aircraft flying over the island.",
    },
    stack: ["React", "Vite", "CSS Grid", "Raspberry Pi"],
    repo: "https://github.com/crazyro6/Fronted-Feeder-FR24",
  },
];

export type TimelineItem = {
  title: T;
  place: string;
  placeUrl?: string;
  period: T;
  note: T;
};

export const experience: TimelineItem[] = [
  {
    title: { es: "Desarrollador web en prácticas", en: "Web developer intern" },
    place: "Fraemma · Telde",
    period: { es: "may — jun 2026", en: "May — Jun 2026" },
    note: {
      es: "Prácticas del ciclo de DAM. Participé en la migración y el desarrollo posterior de un ERP/CRM privado con PHP y Laravel.",
      en: "Work placement within the DAM programme. I took part in migrating a private ERP/CRM and then building on it with PHP and Laravel.",
    },
  },
];

export const education: TimelineItem[] = [
  {
    title: {
      es: "CFGS Desarrollo de Aplicaciones Multiplataforma",
      en: "Higher VET Diploma in Multiplatform App Development",
    },
    place: "IES Lomo de la Herradura",
    period: { es: "2025 — actualidad", en: "2025 — present" },
    note: {
      es: "Programación, bases de datos, entornos de desarrollo y lenguajes de marcas.",
      en: "Programming, databases, development environments and markup languages.",
    },
  },
  {
    title: {
      es: "Bachillerato Tecnológico",
      en: "Baccalaureate, Science & Technology track",
    },
    place: "Colegio Heidelberg",
    period: { es: "2022 — 2024", en: "2022 — 2024" },
    note: {
      es: "La base de física y matemáticas que hay detrás del software.",
      en: "The physics and maths foundations behind software.",
    },
  },
];

export const stack: { group: T; items: string[] }[] = [
  {
    group: { es: "Lenguajes", en: "Programming" },
    items: ["Java", "JavaScript", "PHP", "Kotlin", "Python", "SQL", "HTML", "CSS"],
  },
  {
    group: { es: "Frontend", en: "Front end" },
    items: ["React", "Vite", "Bootstrap", "CSS Grid / Flexbox"],
  },
  {
    group: { es: "Backend y datos", en: "Back end & data" },
    items: ["Node.js", "Laravel", "PostgreSQL", "MySQL", "MongoDB"],
  },
  {
    group: { es: "Herramientas", en: "Tools" },
    items: ["Git", "IntelliJ IDEA", "VS Code", "Android Studio", "NetBeans", "AWS", "Raspberry Pi"],
  },
];

export const languages: { name: T; level: T }[] = [
  { name: { es: "Español", en: "Spanish" }, level: { es: "Nativo", en: "Native" } },
  { name: { es: "Inglés", en: "English" }, level: { es: "C1 · Cambridge", en: "C1 · Cambridge" } },
  { name: { es: "Alemán", en: "German" }, level: { es: "B1 · Goethe-Institut", en: "B1 · Goethe-Institut" } },
];
