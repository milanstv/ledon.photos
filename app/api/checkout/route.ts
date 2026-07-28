import { NextResponse } from "next/server";
import Stripe from "stripe";

import { getGallery } from "@/data/galleries";

export const runtime = "nodejs";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error("Chýba STRIPE_SECRET_KEY v .env.local");
}

const stripe = new Stripe(stripeSecretKey);

type CheckoutRequest = {
  gallerySlug?: string;
  photoId?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CheckoutRequest;

    if (!body.gallerySlug || !body.photoId) {
      return NextResponse.json(
        { error: "Chýba galéria alebo fotografia." },
        { status: 400 },
      );
    }

    const gallery = getGallery(body.gallerySlug);

    if (!gallery) {
      return NextResponse.json(
        { error: "Galéria neexistuje." },
        { status: 404 },
      );
    }

    const photo = gallery.photos.find(
      (galleryPhoto) => galleryPhoto.id === body.photoId,
    );

    if (!photo) {
      return NextResponse.json(
        { error: "Fotografia neexistuje." },
        { status: 404 },
      );
    }

    const origin = new URL(request.url).origin;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",

      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: Math.round(gallery.price * 100),

            product_data: {
              name: `Fotografia ${photo.id}`,
              description: `${gallery.title} – originál v plnom rozlíšení`,
              images: [photo.src],
            },
          },
        },
      ],

      metadata: {
        gallerySlug: gallery.slug,
        photoId: photo.id,
      },

      success_url:
        `${origin}/dakujeme?session_id={CHECKOUT_SESSION_ID}`,

      cancel_url:
        `${origin}/galleries/${gallery.slug}/${photo.id}`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe nevytvoril platobnú adresu." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      url: session.url,
    });
  } catch (error) {
    console.error("Stripe Checkout chyba:", error);

    return NextResponse.json(
      { error: "Platbu sa nepodarilo pripraviť." },
      { status: 500 },
    );
  }
}