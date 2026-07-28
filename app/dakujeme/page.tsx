import Link from "next/link";

type ThankYouPageProps = {
  searchParams: Promise<{
    session_id?: string;
  }>;
};

export default async function ThankYouPage({
  searchParams,
}: ThankYouPageProps) {
  const { session_id } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070707] px-6 text-white">
      <section className="w-full max-w-2xl text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-white/40">
          LEDON.
        </p>

        <h1 className="mt-8 text-4xl font-light tracking-[0.08em] md:text-6xl">
          Ďakujeme
        </h1>

        <p className="mx-auto mt-8 max-w-xl text-lg leading-8 text-white/60">
          Platba bola úspešne dokončená.
        </p>

        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-white/40">
          Bezpečné stiahnutie originálu pripojíme v ďalšom kroku.
        </p>

        {session_id ? (
          <p className="mt-6 break-all text-xs text-white/20">
            Platba: {session_id}
          </p>
        ) : null}

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
