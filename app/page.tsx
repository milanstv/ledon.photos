const selectedWork = [
  "/images/placeholder-1.jpg",
  "/images/placeholder-2.jpg",
  "/images/placeholder-3.jpg",
  "/images/placeholder-4.jpg",
  "/images/placeholder-5.jpg",
  "/images/placeholder-6.jpg",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0e0e0e] text-white">
      <header className="fixed left-0 top-0 z-50 flex w-full items-center justify-between px-10 py-8">
        <div className="text-3xl font-bold tracking-tight">LEDON.</div>

        <nav className="hidden gap-10 text-xs font-medium uppercase tracking-[0.3em] md:flex">
          <a href="#gallery">Gallery</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </nav>
      </header>

      <section className="relative flex h-screen items-center overflow-hidden">
        <div className="absolute inset-0 bg-[url('/images/hero.jpg')] bg-cover bg-center opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-transparent" />

        <div className="relative z-10 px-10">
          <h1 className="mb-8 text-6xl font-bold tracking-[0.18em] md:text-8xl">
            LEDON.
          </h1>

          <p className="space-y-2 text-lg uppercase tracking-[0.35em] text-white/80">
            <span className="block">Motorcycles.</span>
            <span className="block">Motorsport.</span>
            <span className="block">Details.</span>
          </p>
        </div>
      </section>

      <section id="gallery">
        <CategoryBanner
          title="Motorcycles."
          text="A collection of motorcycles captured on roads, mountain passes and tracks."
          image="/images/motorcycles.jpg"
        />

        <CategoryBanner
          title="Motorsport."
          text="Speed, precision and racing moments captured through the lens."
          image="/images/motorsport.jpg"
        />

        <CategoryBanner
          title="Details."
          text="The small details that define every motorcycle."
          image="/images/details.jpg"
        />
      </section>

      <section className="px-10 py-20">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-light">Selected Work.</h2>
          <a className="text-xs uppercase tracking-[0.3em] text-white/60" href="#">
            View all gallery →
          </a>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {selectedWork.map((src) => (
            <div
              key={src}
              className="aspect-[4/3] bg-cover bg-center"
              style={{ backgroundImage: `url(${src})` }}
            />
          ))}
        </div>
      </section>

      <section
        id="about"
        className="grid border-t border-white/10 md:grid-cols-2"
      >
        <div className="min-h-[320px] bg-[url('/images/about.jpg')] bg-cover bg-center opacity-70" />

        <div className="flex items-center px-10 py-20">
          <div>
            <h2 className="mb-6 text-4xl font-light">LEDON.</h2>
            <p className="max-w-md text-white/70">
              LEDON. is a motorcycle photography project focused on machines,
              motion and details. Based in Slovakia.
            </p>
          </div>
        </div>
      </section>

      <section
        id="contact"
        className="border-t border-white/10 px-10 py-20"
      >
        <h2 className="mb-8 text-3xl font-light">Contact.</h2>

        <div className="flex gap-6">
          <a
            href="https://www.instagram.com/ledon.photos"
            target="_blank"
            className="border border-white/30 px-8 py-4 text-xs uppercase tracking-[0.3em]"
          >
            Instagram
          </a>

          <a
            href="mailto:info@ledon.photos"
            className="border border-white/30 px-8 py-4 text-xs uppercase tracking-[0.3em]"
          >
            Email
          </a>
        </div>
      </section>

      <footer className="flex justify-between border-t border-white/10 px-10 py-8 text-xs text-white/40">
        <span>LEDON.</span>
        <span>© 2026 LEDON. All rights reserved.</span>
      </footer>
    </main>
  );
}

function CategoryBanner({
  title,
  text,
  image,
}: {
  title: string;
  text: string;
  image: string;
}) {
  return (
    <section className="grid min-h-[420px] border-t border-white/10 md:grid-cols-2">
      <div className="relative min-h-[320px] overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center transition duration-700 hover:scale-105"
          style={{ backgroundImage: `url(${image})` }}
        />
        <div className="absolute inset-0 bg-black/30" />
      </div>

      <div className="flex items-center bg-[#111111] px-10 py-20">
        <div>
          <h2 className="mb-6 text-5xl font-light">{title}</h2>
          <p className="mb-10 max-w-sm text-white/60">{text}</p>
          <a className="text-xs uppercase tracking-[0.3em] text-white/70" href="#">
            View Gallery →
          </a>
        </div>
      </div>
    </section>
  );
}