# Product

## Register

brand

## Users
Recruiters, tech leads and internship coordinators, mostly in Spain (Canary Islands) but also remote/international. They arrive from LinkedIn, a job application or the CV, usually on a laptop during work hours, and skim for under a minute: who is this, what has he built, how do I contact him.

## Product Purpose
Personal portfolio of Roy Para Olivera, a junior full-stack developer in training (DAM student). It exists to land a first internship or junior role. Success = a recruiter understands his profile in seconds, opens a project, and emails him or downloads the CV.

## Brand Personality
Cercano, preciso, tranquilo (approachable, precise, calm). First-person, plain-spoken copy; no buzzwords, no exaggeration of seniority. Quiet confidence from real projects built out of curiosity (ADS-B radar, live game telemetry).

## Anti-references
- Unmodified templates with just a name and photo swapped in (e.g. DarkMinimal, the template this started from).
- Portfolios loaded with animations, parallax, glitch/particle effects, loud gradients and many colours.
- Logo walls and marquee carousels of tech logos; skill bars with percentages.
References he likes: walterteng.com (single column, text-first, personal touches) and victoreke.com (GitHub calendar, clean timeline, light/dark).

## Design Principles
1. Content first: every element must help a recruiter decide in under a minute.
2. Honest junior: show real work and learning; never inflate.
3. Personal through details, not decoration: the hero is a LIVE 3D radar of the aircraft Roy's own ADS-B antenna picks up right now (Raspberry Pi → Cloudflare Tunnel → Worker /api/aviones → canvas); click a plane for its card (HexDB + Planespotters). If the antenna is unreachable the radar shows empty with an honest notice, never a recording. Copy is first person, like a note; Gran Canaria is context, not the headline.
4. One living scene, everything else calm: the hero canvas (src/lib/radar.ts) draws the aircraft at their real altitude over the islands with fading trails, tilts in on load, drifts slowly, rotates by drag and follows the pointer a little. Nothing else on the page loops. Reduced motion: no animation, redrawn only when new data arrives.
5. Bilingual and accessible by default.

## Visual system
Light page with depth (soft shadows, white cards on a faintly tinted ground); the radar "sky" (flat deep night blue, thin white lines, amber aircraft, fine grain; no glow gradients) is full-bleed and bookends the page: the hero at the top and the contact + footer band at the bottom, the same in light and dark themes. Sections put the title in a left column and content on the right; projects are cards with the photo on top. Hanken Grotesk for all text; B612 (Airbus cockpit font) only for data such as dates, callsigns, coordinates and stacks. No status pills, no monospace.

## Accessibility & Inclusion
WCAG 2.2 AA: text contrast ≥4.5:1 in both themes, visible focus, skip link, semantic landmarks, full keyboard use, `prefers-reduced-motion` respected, `lang` set per page and on inline language switches.
