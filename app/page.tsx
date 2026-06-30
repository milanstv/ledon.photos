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
      <header className="fixed left-0 top-0 z-50 flex w-full items-center justify-between px-5 py-5 md:px-10 md:py-7">
        <div className="text-2xl font-bold tracking-tight md:text-4xl">
          LEDON.
        </div>

        <nav className="flex gap-5 text-[10px] font-medium uppercase tracking-[0.22em] md:gap-10 md:text-xs md:tracking-[0.35em]">
          <a href="#babagp">Galérie</a>
          <a href="#contact">Contact</a>
        </nav>
      </header>

      <section id="babagp" className="relative min-h-screen overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/babagp.jpg')" }}
        />

        <div className="absolute inset-0 bg-black/35 md:bg-black/10" />

        <div className="relative z-10 flex min-h-screen items-end px-5 pb-20 pt-28 text-left md:items-center md:justify-end md:px-10 md:pb-0 md:text-right">
          <div className="w-full max-w-xl">
            <h1 className="mb-5 text-5xl font-light tracking-tight md:text-6xl">
              GALÉRIE
            </h1>

            <p className="text-sm uppercase tracking-[0.25em] text-white/80 md:text-xl md:tracking-[0.28em]">
              Galérie.
            </p>

            <div className="mt-10 space-y-4">
              {babaGpGalleries.map((gallery) => (
                <a
                  key={gallery.label}
                  href={gallery.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs uppercase tracking-[0.23em] text-white/85 transition hover:text-white md:tracking-[0.4em]"
                >
                  View Gallery {gallery.label} →
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id="contact"
        className="border-t border-white/25 bg-[#0e0e0e] px-5 py-8 md:px-10"
      >
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div>
            <h2 className="mb-4 text-3xl font-light">Contact.</h2>
            <p className="text-white/50">Get in touch.</p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row">
            <a
              href="https://www.instagram.com/ledon.photos"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-white/25 px-6 py-4 text-center text-xs uppercase tracking-[0.25em] text-white/80 transition hover:border-white hover:bg-white hover:text-black md:px-8 md:tracking-[0.3em]"
            >
              Instagram
            </a>

            <a
              href="mailto:info@ledon.photos"
              className="border border-white/25 px-6 py-4 text-center text-xs uppercase tracking-[0.25em] text-white/80 transition hover:border-white hover:bg-white hover:text-black md:px-8 md:tracking-[0.3em]"
            >
              Email
            </a>
          </div>
        </div>
      </section>

      <footer className="flex justify-between border-t border-white/10 bg-[#0e0e0e] px-5 py-8 text-xs text-white/40 md:px-10">
        <span>LEDON.</span>
        <span>© 2026 LEDON.</span>
      </footer>
    </main>
  );
}