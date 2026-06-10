export default function Home() {
  return (
    <main className="min-h-screen bg-[#0e0e0e] text-white">
      <header className="fixed left-0 top-0 z-50 flex w-full items-center justify-between px-8 py-7 md:px-10">
        <div className="text-3xl font-bold tracking-tight">LEDON.</div>

        <nav className="hidden gap-10 text-xs font-medium uppercase tracking-[0.35em] md:flex">
          <a href="#gallery">Gallery</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </nav>
      </header>

      <section className="relative h-screen overflow-hidden">
        <div className="absolute inset-0 bg-[url('/images/hero.jpg')] bg-cover bg-center opacity-85" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/20 to-black/10" />
      </section>

      <section id="gallery">
        <CategoryBanner title="Motorcycles." image="/images/motorcycles.jpg" />

        <CategoryBanner title="Motorsport." image="/images/motorsport.jpg" />

        <CategoryBanner title="Details." image="/images/details.jpg" />
      </section>

      <section
        id="about"
        className="grid border-t border-white/10 md:grid-cols-2"
      >
        <div className="min-h-[320px] bg-[url('/images/about.jpg')] bg-cover bg-center opacity-75" />

        <div className="flex items-center px-8 py-20 md:px-10">
          <div>
            <h2 className="mb-8 text-4xl font-light tracking-tight">LEDON.</h2>

            <p className="text-xl text-white/75">Motorcycle Photography.</p>
            <p className="mt-3 text-xl text-white/75">Based in Slovakia.</p>
          </div>
        </div>
      </section>

      <section id="contact" className="border-t border-white/10 px-8 py-20 md:px-10">
        <h2 className="mb-10 text-3xl font-light">Contact.</h2>

        <div className="flex flex-wrap gap-6">
          <a
            href="https://www.instagram.com/ledon.photos"
            target="_blank"
            className="border border-white/30 px-8 py-4 text-xs uppercase tracking-[0.3em] transition hover:border-white hover:bg-white hover:text-black"
          >
            Instagram
          </a>

          <a
            href="mailto:info@ledon.photos"
            className="border border-white/30 px-8 py-4 text-xs uppercase tracking-[0.3em] transition hover:border-white hover:bg-white hover:text-black"
          >
            Email
          </a>
        </div>
      </section>

      <footer className="flex justify-between border-t border-white/10 px-8 py-8 text-xs text-white/40 md:px-10">
        <span>LEDON.</span>
        <span>© 2026 LEDON.</span>
      </footer>
    </main>
  );
}

function CategoryBanner({
  title,
  image,
}: {
  title: string;
  image: string;
}) {
  return (
    <section className="grid min-h-[460px] border-t border-white/10 md:grid-cols-2">
      <div className="relative min-h-[360px] overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-80 transition duration-700 hover:scale-105"
          style={{ backgroundImage: `url(${image})` }}
        />
        <div className="absolute inset-0 bg-black/20" />
      </div>

      <div className="flex items-center bg-[#111111] px-8 py-20 md:px-10">
        <div>
          <h2 className="mb-10 text-5xl font-light tracking-tight">{title}</h2>

          <a
            className="text-xs uppercase tracking-[0.3em] text-white/70 transition hover:text-white"
            href="#"
          >
            View Gallery →
          </a>
        </div>
      </div>
    </section>
  );
}