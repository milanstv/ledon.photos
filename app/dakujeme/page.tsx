import Link from "next/link";

export default function ThankYouPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070707] px-6 text-white">
      <section className="w-full max-w-2xl text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-white/40">
          LEDON.
        </p>

        <h1 className="mt-8 text-4xl font-light tracking-[0.08em] md:text-6xl">
          Ďakujeme za nákup
        </h1>

        <p className="mx-auto mt-8 max-w-xl leading-8 text-white/60">
          Platba bola úspešne dokončená.
          Bezpečné stiahnutie originálu pripojíme v ďalšom kroku.
        </p>

        <Link
          href="/"
          className="mt-10 inline-block border border-white/20 px-8 py-4 text-xs uppercase tracking-[0.25em] transition hover:bg-white hover:text-black"
        >
          Späť na galérie
        </Link>
      </section>
    </main>
  );
}