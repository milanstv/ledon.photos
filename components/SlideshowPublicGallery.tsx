"use client";
import Link from "next/link";
import CartLink from "@/components/CartLink";
import { useCart } from "@/components/CartProvider";
import { useEffect, useRef, useState } from "react";
type Item = { id: string; title: string; priceCents: number; durationSeconds: number; previewUrl: string; posterUrl: string };
type Gallery = { id: string; title: string; date: string; items: Item[] };
function Preview({ item, gallery, active, activate, en }: { gallery: Gallery; item: Item; active: boolean; activate: (id: string | null) => void; en: boolean }) {
  const { addItem, isInCart } = useCart();
  const slug = `slideshow-${gallery.id}`;
  const inCart = isInCart(slug, item.id);
  const video = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const element = video.current; if (!element) return;
    if (active) { element.muted = true; element.play().catch(() => { setFailed(true); activate(null); }); }
    else { element.pause(); element.currentTime = 0; }
  }, [active, activate]);
  return <article className="overflow-hidden rounded-xl border border-white/20">
    <button type="button" className="relative block aspect-video w-full bg-black" aria-label={en ? `Preview ${item.title}` : `Náhľad ${item.title}`} aria-pressed={active}
      onPointerEnter={e => { if (e.pointerType === "mouse") { setFailed(false); activate(item.id); } }}
      onPointerLeave={e => { if (e.pointerType === "mouse") activate(null); }}
      onClick={e => { if (e.detail === 0 || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) { setFailed(false); activate(active ? null : item.id); } }}>
      <video ref={video} muted playsInline loop preload="none" src={item.previewUrl} poster={item.posterUrl}
        className="h-full w-full object-contain" onError={() => { setFailed(true); activate(null); }} />
      {!active && <span className="absolute bottom-3 right-3 rounded bg-black/70 px-3 py-1 text-sm">▶ {en ? "Preview" : "Náhľad"}</span>}
    </button>
    <div className="p-4"><h2 className="font-semibold">{item.title}</h2><p className="mt-2 text-white/70">{new Intl.NumberFormat(en ? "en-IE" : "sk-SK", { style: "currency", currency: "EUR" }).format(item.priceCents / 100)} · {item.durationSeconds.toFixed(1)} s</p>
      <button type="button" disabled={inCart} className="mt-4 w-full rounded bg-white px-4 py-3 font-semibold text-black disabled:bg-white/30"
        onClick={() => addItem({ gallerySlug: slug, galleryTitle: gallery.title, photoId: item.id, mediaTitle: item.title, photoSrc: item.posterUrl, price: item.priceCents / 100 })}>
        {inCart ? (en ? "In cart" : "V košíku") : (en ? "Add to cart" : "Pridať do košíka")}
      </button>
      {failed && <p role="status" className="mt-2 text-sm text-red-200">{en ? "Preview could not play. Refresh the page and try again." : "Náhľad sa nepodarilo prehrať. Obnov stránku a skús znova."}</p>}
    </div>
  </article>;
}
export default function SlideshowPublicGallery({ gallery, language }: { gallery: Gallery; language: "sk" | "en" }) {
  const en = language === "en";
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => { const hide = () => { if (document.hidden) setActive(null); }; document.addEventListener("visibilitychange", hide); return () => document.removeEventListener("visibilitychange", hide); }, []);
  return <main className="min-h-screen w-full bg-black text-white"><div className="mx-auto max-w-6xl px-5 py-10">
    <nav className="flex flex-wrap justify-between gap-5"><CartLink language={language} /><Link href={en ? "/en/slideshow" : "/slideshow"} className="underline">← Slideshow</Link><Link href={en ? `/slideshow/${gallery.id}` : `/en/slideshow/${gallery.id}`} className="underline">{en ? "Slovenčina" : "English"}</Link></nav>
    <h1 className="mt-8 text-3xl font-semibold">{gallery.title}</h1>
    <p className="mt-2 text-white/60">{new Intl.DateTimeFormat(en ? "en-GB" : "sk-SK").format(new Date(`${gallery.date}T12:00:00Z`))}</p>
    <p className="mt-5 text-white/70">{en ? "Hover over a slideshow to preview it. On mobile, tap to play or stop." : "Pre náhľad podrž kurzor nad slideshow. Na mobile ťuknutím spustíš alebo zastavíš prehrávanie."}</p>
    <p className="mt-2 text-sm text-white/60">{en ? "After payment is confirmed, you receive a download link to the original MP4 with sound, if present in the original." : "Po potvrdení platby dostaneš odkaz na stiahnutie originálu MP4 so zvukom, ak ho originál obsahuje."}</p>
    <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{gallery.items.map(item => <Preview key={item.id} item={item} gallery={gallery} active={active === item.id} activate={setActive} en={en} />)}</div>
  </div></main>;
}
