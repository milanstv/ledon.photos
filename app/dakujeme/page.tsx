import Link from "next/link";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

type ThankYouPageProps = {
  searchParams: Promise<{
    session_id?: string;
  }>;
};

export default async function ThankYouPage({
  searchParams,
}: ThankYouPageProps) {
  const { session_id } = await searchParams;
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  let paymentIsPaid = false;
  let errorMessage = "";

  if (!session_id) {
    errorMessage = "Chýba identifikátor platby.";
  } else if (!stripeSecretKey) {
    errorMessage = "Stripe nie je správne nastavený.";
  } else {
    try {
      const stripe = new Stripe(stripeSecretKey);
      const session =
        await stripe.checkout.sessions.retrieve(session_id);

      paymentIsPaid = session.payment_status === "paid";

      if (!paymentIsPaid) {
        errorMessage = "Platba ešte nebola potvrdená.";
      }
    } catch (error) {
      console.error("Chyba pri overení platby:", error);
      errorMessage = "Platbu sa nepodarilo overiť.";
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070707] px-6 text-white">
      <section className="w-full max-w-2xl text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-white/40">
          LEDON.
        </p>

        <h1 className="mt-8 text-4xl font-light tracking-[0.08em] md:text-6xl">
          {paymentIsPaid ? "Ďakujeme" : "Platba"}
        </h1>

        {paymentIsPaid && session_id ? (
          <>
            <p className="mx-auto mt-8 max-w-xl text-lg leading-8 text-white/60">
              Platba bola úspešne dokončená.
            </p>

            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-white/40">
              Originálnu fotografiu si môžeš teraz bezpečne
              stiahnuť.
            </p>

            <a
              href={`/api/download?session_id=${encodeURIComponent(
                session_id,
              )}`}
              className="mt-10 inline-block bg-white px-8 py-4 text-xs font-semibold uppercase tracking-[0.25em] text-black transition hover:bg-white/80"
            >
              Stiahnuť originál
            </a>

            <p className="mx-auto mt-6 max-w-lg text-xs leading-6 text-white/25">
              Odkaz na stiahnutie je časovo obmedzený. Po kliknutí
              sa stiahne originál fotografie v plnom rozlíšení.
            </p>
          </>
        ) : (
          <>
            <p className="mx-auto mt-8 max-w-xl text-lg leading-8 text-white/60">
              {errorMessage}
            </p>

            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-white/40">
              Skontroluj stav platby alebo sa vráť späť do galérie.
            </p>
          </>
        )}

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
