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
    <main className="min-h-screen bg-[#070707] text-white">
      <header className="fixed left-0 top-0 z-50 flex w-full items-center justify-between px-6 py-6 md:px-10">
        <div className="text-2xl font-bold tracking-[0.12em] md:text-4xl">
          LEDON.
        </div>

        <nav className="hidden gap-12 text-xs font-medium uppercase tracking-[0.45em] text-white/90 md:flex">
          <a href="#babagp" className="transition hover:text-white/60">
            Galérie
          </a>
          <a href="#contact" className="transition hover:text-white/60">
            Contact
          </a>
        </nav>
      </header>

      <section id="babagp" className="relative min-h-screen overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center md:bg-[center_40%]"
          style={{ backgroundImage: "url('/images/babagp.jpg')" }}
        />

        <div className="absolute inset-0 bg-black/65 md:bg-black/45" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-black/15" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070707] via-transparent to-black/20" />

        <div className="relative z-10 flex min-h-screen items-end px-6 pb-16 pt-32 md:items-center md:px-14 md:pb-0">
          <div className="w-full max-w-2xl">
            <h1 className="mb-5 text-5xl font-light uppercase tracking-[0.18em] md:text-7xl">
              Galérie
            </h1>

            <p className="mb-8 text-base font-light tracking-[0.35em] text-white/75 md:text-2xl">
              Galérie.
            </p>

            <div className="mb-10 h-px w-16 bg-white/70" />

            <div className="w-full max-w-xl">
              {babaGpGalleries.map((gallery) => (
                <a
                  key={gallery.label}
                  href={gallery.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between border-t border-white/25 py-5 text-[11px] font-medium uppercase tracking-[0.28em] text-white/90 transition hover:border-white hover:text-white md:text-xs md:tracking-[0.35em]"
                >
                  <span>View Gallery {gallery.label}</span>
                  <span className="ml-4 transition group-hover:translate-x-1">
                    →
                  </span>
                </a>
              ))}

              <div className="border-t border-white/25" />
            </div>
          </div>
        </div>
      </section>

      <section
        id="contact"
        className="border-t border-white/20 bg-[#070707] px-6 py-12 md:px-14 md:py-14"
      >
        <div className="flex flex-col justify-between gap-10 md:flex-row md:items-end">
          <div>
            <h2 className="mb-4 text-3xl font-light tracking-wide md:text-4xl">
              Contact.
            </h2>
            <p className="text-white/50">Get in touch.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <a
              href="https://www.instagram.com/ledon.photos"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-white/35 px-10 py-5 text-center text-xs uppercase tracking-[0.35em] text-white/90 transition hover:border-white hover:bg-white hover:text-black"
            >
              Instagram
            </a>

            <a
              href="mailto:info@ledon.photos"
              className="border border-white/35 px-10 py-5 text-center text-xs uppercase tracking-[0.35em] text-white/90 transition hover:border-white hover:bg-white hover:text-black"
            >
              Email
            </a>
          </div>
        </div>
      </section>

      <footer className="flex justify-between border-t border-white/10 bg-[#070707] px-6 py-8 text-xs uppercase tracking-[0.25em] text-white/45 md:px-14">
        <span>LEDON.</span>
        <span>© 2026 LEDON.</span>
      </footer>
    </main>
  );
}