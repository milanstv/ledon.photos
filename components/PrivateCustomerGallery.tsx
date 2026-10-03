"use client";
import { useCallback, useEffect, useRef, useState } from "react";
type Item = { id: string; kind: "photo" | "video"; filename: string; size: number };
type Detail = { title: string; expiresAt: string; items: Item[] };
const button = "border border-white/30 px-4 py-3 text-sm disabled:opacity-40";
function sizeLabel(size: number) { return size >= 1024 ** 3 ? `${(size / 1024 ** 3).toFixed(2)} GB` : `${(size / 1024 ** 2).toFixed(1)} MB`; }
export default function PrivateCustomerGallery({ galleryId }: { galleryId: string }) {
  const token = useRef("");
  const [gallery, setGallery] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [english, setEnglish] = useState(false);
  const [preview, setPreview] = useState<{ item: Item; url: string } | null>(null);
  const api = useCallback(async (action: string, itemId?: string) => {
    const response = await fetch(`/api/private-galleries/${encodeURIComponent(galleryId)}`, {
      method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, itemId, token: token.current }),
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 404) { setGallery(null); setPreview(null); }
      throw new Error(data.error || "Galéria nie je dostupná.");
    }
    return data;
  }, [galleryId]);
  useEffect(() => {
    let current = true;
    async function load() {
      token.current = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
      setPreview(null); setError(""); setLoading(true);
      try { const data = await api("detail"); if (current) setGallery(data); }
      catch (e) { if (current) { setGallery(null); setError(e instanceof Error ? e.message : "Galéria nie je dostupná."); } }
      finally { if (current) setLoading(false); }
    }
    void load(); window.addEventListener("hashchange", load);
    return () => { current = false; window.removeEventListener("hashchange", load); };
  }, [api]);
  useEffect(() => {
    if (!gallery) return;
    const remaining = Date.parse(gallery.expiresAt) - Date.now();
    if (remaining <= 0) { setGallery(null); setPreview(null); setError("Platnosť galérie vypršala."); return; }
    const timer = setTimeout(() => { setGallery(null); setPreview(null); setError("Platnosť galérie vypršala."); }, Math.min(remaining, 2147483647));
    return () => clearTimeout(timer);
  }, [gallery]);
  async function open(item: Item, download: boolean) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const { url } = await api(download ? "download" : "preview", item.id);
      if (download) {
        // The attachment response comes directly from R2; never buffer the video in JS.
        const anchor = document.createElement("a");
        anchor.href = url; anchor.rel = "noreferrer"; anchor.referrerPolicy = "no-referrer";
        document.body.appendChild(anchor); anchor.click(); anchor.remove();
      } else setPreview({ item, url });
    } catch (e) { setError(e instanceof Error ? e.message : "Súbor nie je dostupný."); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-[#080808] px-5 py-8 text-white md:px-10 md:py-12">
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between gap-4"><p className="text-xl tracking-widest">LEDON.</p>
        <button className="text-sm text-white/60" onClick={() => setEnglish(value => !value)}>{english ? "Slovenčina" : "English"}</button>
      </div>
      <h1 className="mt-10 text-3xl font-light md:text-5xl">{gallery?.title || (english ? "Private gallery" : "Súkromná galéria")}</h1>
      {loading && <p className="mt-6 text-white/60">{english ? "Loading…" : "Načítavam…"}</p>}
      {error && <p role="alert" className="mt-6 text-red-300">{english && !gallery ? "This gallery is unavailable. The link is invalid, blocked or expired. Contact LEDON." : error}</p>}
      {gallery && <>
        <p className="mt-5 text-sm leading-6 text-white/60">{english ? "Your photos and videos are already paid for. You can download the originals repeatedly until" : "Fotky a videá sú už zaplatené. Originály môžeš sťahovať opakovane do"}{" "}
          <strong className="text-white">{new Date(gallery.expiresAt).toLocaleString(english ? "en-GB" : "sk-SK", { timeZone: "Europe/Bratislava" })}</strong>{english ? " (Slovakia time)." : " (slovenský čas)."}
        </p>
        <p className="mt-3 text-sm text-white/50">{english ? "This link is private. Anyone you share it with can access this gallery." : "Tento odkaz je súkromný. Každý, komu ho pošleš, môže otvoriť túto galériu."}</p>
        <ul className="mt-8 divide-y divide-white/15">{gallery.items.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 py-5">
          <div className="min-w-0"><p className="break-all">{item.filename}</p><p className="mt-1 text-sm text-white/50">{item.kind === "video" ? "MP4" : english ? "Photo" : "Fotka"} · {sizeLabel(item.size)}</p></div>
          <div className="flex flex-wrap gap-3">
            <button className={button} disabled={busy} onClick={() => open(item, false)}>{item.kind === "video" ? english ? "Play video" : "Prehrať video" : english ? "View photo" : "Otvoriť fotku"}</button>
            <button className={button} disabled={busy} onClick={() => open(item, true)}>{english ? "Download original" : "Stiahnuť originál"}</button>
          </div>
        </li>)}</ul>
      </>}
      {preview && <section className="mt-8 border border-white/20 p-4">
        <div className="mb-4 flex justify-between gap-4"><p className="break-all">{preview.item.filename}</p><button onClick={() => setPreview(null)} className="text-sm text-white/60">{english ? "Close" : "Zavrieť"}</button></div>
        {preview.item.kind === "video" ? <video key={preview.url} src={preview.url} controls preload="metadata" className="max-h-[70vh] w-full" />
          // eslint-disable-next-line @next/next/no-img-element
          : <img src={preview.url} alt={preview.item.filename} referrerPolicy="no-referrer" className="mx-auto max-h-[70vh] max-w-full object-contain" />}
        <p className="mt-3 text-xs text-white/40">{english ? "If the preview stops working, close it and open it again." : "Ak náhľad po čase prestane fungovať, zavri ho a otvor znova."}</p>
      </section>}
    </div>
  </main>;
}
