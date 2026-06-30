const babaGpGalleries = [
  {
    label: "Baba GP 20.6.2026",
    href: "https://ledon.pixieset.com/pezinskababa/",
    },
  {
    label: "Baba GP 21.6.2026",
    href: "https://ledon.pixieset.com/pezinskababagp/",
  },
  {
    label: "Slovakia ring 27.6.2026",
    href: "https://ledon.pixieset.com/slovakiaring2762026/",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0e0e0e] text-white">
      <header className="fixed left-0 top-0 z-50 flex w-full items-center justify-between px-8 py-7 md:px-10">
        <div className="text-4xl font-bold tracking-tight">LEDON.</div>

        <nav className="hidden gap-10 text-xs font-medium uppercase tracking-[0.35em] md:flex">
          <a href="#babagp">Galérie</a>
          <a href="#contact">Contact</a>
        </nav>
      </header>

      <FullScreenSection
        id="babagp"
        image="/images/babagp.jpg"
        align="right"
        title="GALÉRIE"
        subtitle="Galérie."
        galleries={babaGpGalleries}
      />

      <section
        id="contact"
        className="border-t border-white/25 bg-[#0e0e0e] px-8 py-8 md:px-8"
      >
        <div className="flex flex-col justify-between gap-12 md:flex-row md:items-end">
          <div>
            <h2 className="mb-4 text-3xl font-light">Contact.</h2>
            <p className="text-white/50">Get in touch.</p>
          </div>

          <div className="flex gap-4">
            <a
              href="https://www.instagram.com/ledon.photos"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-white/25 px-8 py-4 text-xs uppercase tracking-[0.3em] text-white/80 transition hover:border-white hover:bg-white hover:text-black"
            >
              Instagram
            </a>

            <a
              href="mailto:info@ledon.photos"
              className="border border-white/25 px-8 py-4 text-xs uppercase tracking-[0.3em] text-white/80 transition hover:border-white hover:bg-white hover:text-black"
            >
              Email
            </a>
          </div>
        </div>
      </section>

      <footer className="flex justify-between border-t border-white/10 bg-[#0e0e0e] px-8 py-8 text-xs text-white/40 md:px-10">
        <span>LEDON.</span>
        <span>© 2026 LEDON.</span>
      </footer>
    </main>
  );
}

function FullScreenSection({
  id,
  image,
  align,
  title,
  subtitle,
  text,
  galleries,
}: {
  id?: string;
  image: string;
  align: "left" | "right";
  title: string;
  subtitle?: string;
  text?: string;
  galleries?: { label: string; href: string }[];
}) {
  return (
    <section id={id} className="relative h-screen overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${image})` }}
      />

      <div className="absolute inset-0 bg-black/5" />

      <div
        className={`relative z-10 flex h-full items-center px-8 md:px-10 ${
          align === "right" ? "justify-end text-right" : "justify-start text-left"
        }`}
      >
        <div className="max-w-xl">
          <h2 className="mb-6 text-5xl font-light tracking-tight md:text-6xl">
            {title}
          </h2>

          {subtitle && (
            <p className="text-lg uppercase tracking-[0.28em] text-white/80 md:text-xl">
              {subtitle}
            </p>
          )}

          {text && <p className="mt-4 text-lg text-white/70 md:text-xl">{text}</p>}

          {galleries && galleries.length > 0 && (
            <div className="mt-10 space-y-3">
              {galleries.map((gallery) => (
                <a
                  key={gallery.label}
                  href={gallery.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs uppercase tracking-[0.35em] text-black/75 transition hover:text-white"
                >
                  View Gallery {gallery.label} →
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}