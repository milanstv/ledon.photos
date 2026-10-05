"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { SlideshowGallerySummary } from "@/lib/slideshow-types";

export default function SlideshowGalleriesAdmin() {
  const [galleries, setGalleries] = useState<SlideshowGallerySummary[]>([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/slideshow-galleries", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Zoznam sa nepodarilo načítať.");
      setGalleries(data.galleries);
    } catch (e) { setError(e instanceof Error ? e.message : "Chyba načítania."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/slideshow-galleries", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, date }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Galériu sa nepodarilo vytvoriť.");
      setTitle("");
      setMessage("Galéria je vytvorená ako koncept a nie je viditeľná zákazníkom.");
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Chyba vytvorenia."); }
    finally { submitting.current = false; setBusy(false); }
  }

  return <main className="min-h-screen bg-black px-6 py-10 text-white md:px-12">
    <nav className="mb-8 flex flex-wrap gap-6 text-sm text-white/70">
      <Link href="/admin/orders">Objednávky</Link>
      <Link href="/admin/private-galleries">Súkromné galérie</Link>
      <Link href="/">Web</Link>
    </nav>
    <h1 className="text-3xl font-light">Slideshow galérie</h1>
    <p className="mt-3 text-sm text-white/60">Samostatné galérie slideshow zostavených z fotografií.</p>
    <form onSubmit={create} className="mt-8 max-w-xl space-y-5 border border-white/20 p-6">
      <h2 className="text-xl">Nová galéria</h2>
      <label className="block">Názov galérie
        <input required maxLength={160} value={title} disabled={busy}
          onChange={e => setTitle(e.target.value)}
          placeholder="Pezinská Baba – Slideshow"
          className="mt-2 block w-full border border-white/30 bg-black p-3" />
      </label>
      <label className="block">Dátum fotenia
        <input required type="date" value={date} disabled={busy}
          onChange={e => setDate(e.target.value)}
          className="mt-2 block w-full border border-white/30 bg-black p-3 [color-scheme:dark]" />
      </label>
      <button disabled={busy} className="border border-white/50 px-5 py-3 disabled:opacity-40">
        {busy ? "Vytváram…" : "Vytvoriť galériu"}
      </button>
    </form>
    {error && <p role="alert" className="mt-5 text-red-400">{error}</p>}
    {message && <p role="status" className="mt-5 text-green-400">{message}</p>}
    <section className="mt-10 max-w-4xl">
      <div className="flex items-center justify-between gap-5">
        <h2 className="text-xl">Galérie ({galleries.length})</h2>
        <button disabled={loading || busy} onClick={() => { setError(""); void refresh(); }}
          className="border border-white/30 px-4 py-2 disabled:opacity-40">Obnoviť zoznam</button>
      </div>
      {loading ? <p className="mt-5 text-white/60">Načítavam…</p> : galleries.length === 0 ?
        <p className="mt-5 text-white/60">Zatiaľ nemáš žiadne slideshow galérie.</p> :
        <ul className="mt-5 divide-y divide-white/20 border-y border-white/20">
          {galleries.map(g => <li key={g.id} className="py-5">
            <h3><Link href={`/admin/slideshow-galleries/${g.id}`} className="underline underline-offset-4 hover:text-white/70">{g.title}</Link></h3>
            <p className="mt-2 text-sm text-white/60">
              {new Intl.DateTimeFormat("sk-SK", { timeZone: "Europe/Bratislava" }).format(new Date(`${g.date}T12:00:00Z`))}
              {" · "}{g.status === "draft" ? "Koncept" : g.status === "published" ? "Zverejnená" : "Skrytá"}
              {" · "}Slideshow: {g.count}
            </p>
          </li>)}
        </ul>}
    </section>
  </main>;
}
