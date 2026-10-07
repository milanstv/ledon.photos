"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { PhotoGallerySummary } from "@/lib/photo-gallery-types";
import styles from "./PhotoGalleriesAdmin.module.css";

function priceInCents(value: string) {
  const match = value.trim().replace(",", ".").match(/^(\d{1,5})(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error("Zadaj cenu v eurách, napríklad 5,00.");
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (cents < 1 || cents > 1000000) throw new Error("Cena musí byť od 0,01 € do 10 000 €.");
  return cents;
}
export default function PhotoGalleriesAdmin() {
  const [galleries, setGalleries] = useState<PhotoGallerySummary[]>([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [price, setPrice] = useState("5,00");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/photo-galleries", { cache: "no-store" });
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
    submitting.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const priceCents = priceInCents(price);
      const response = await fetch("/api/admin/photo-galleries", { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, date, priceCents }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Galériu sa nepodarilo vytvoriť.");
      setTitle(""); setMessage("Galéria je uložená ako koncept. Zákazníci ju ešte nevidia.");
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Chyba vytvorenia."); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <main className={styles.admin}>
    <aside className={styles.sidebar}><Link href="/" className={styles.brand}>LEDON.PHOTOS</Link><nav aria-label="Administrácia">
      <Link href="/admin/orders">Objednávky</Link><Link href="/admin/photo-galleries" aria-current="page">Fotogalérie</Link>
      <Link href="/admin/slideshow-galleries">Slideshow</Link><Link href="/admin/private-galleries">Súkromné galérie</Link>
    </nav></aside>
    <div className={styles.content}><h1>Správa fotogalérií</h1>
      <p className={styles.subtitle}>Nové galérie vytvorené cez admin. Existujúce galérie na webe zostávajú zachované.</p>
      <ol className={styles.steps}><li><b>1</b> Vytvoriť galériu</li><li><b>2</b> Nahrať originály</li><li><b>3</b> Vytvoriť náhľady</li><li><b>4</b> Skontrolovať a publikovať</li></ol>
      <form onSubmit={create} className={styles.panel}><h2>Nová fotogaléria</h2><div className={styles.fields}>
        <label>Názov galérie<input required maxLength={160} value={title} disabled={busy} placeholder="Pezinská Baba" onChange={e=>setTitle(e.target.value)} /></label>
        <label>Dátum fotenia<input required type="date" value={date} disabled={busy} onChange={e=>setDate(e.target.value)} /></label>
        <label>Cena za fotku (€)<input required inputMode="decimal" maxLength={8} value={price} disabled={busy} onChange={e=>setPrice(e.target.value)} /></label>
      </div><button className={styles.primary} disabled={busy}>{busy ? "Vytváram…" : "Vytvoriť galériu"}</button>
      <p className={styles.help}>Galéria bude uložená ako neverejný koncept.</p></form>
      {error && <p role="alert" className={styles.error}>{error}</p>}{message && <p role="status" className={styles.success}>{message}</p>}
      <section className={styles.panel}><div className={styles.sectionHead}><h2>Nové galérie ({galleries.length})</h2><button type="button" disabled={loading||busy} onClick={()=>{setError("");void refresh();}}>Obnoviť zoznam</button></div>
        {loading ? <p className={styles.help}>Načítavam…</p> : galleries.length===0 ? <p className={styles.help}>Zatiaľ tu nemáš žiadnu novú fotogalériu.</p> :
          <ul className={styles.list}>{galleries.map(g=><li key={g.id}><div><h3>{g.title}</h3><p>{new Intl.DateTimeFormat("sk-SK",{timeZone:"Europe/Bratislava"}).format(new Date(`${g.date}T12:00:00Z`))} · {new Intl.NumberFormat("sk-SK",{style:"currency",currency:"EUR"}).format(g.priceCents/100)} / fotka</p></div>
            <div className={styles.status}><span>{g.status==="draft" ? "Koncept — neverejná" : g.status==="published" ? "Zverejnená" : "Skrytá"}</span><small>{g.count} fotografií · {g.readyCount} pripravených</small></div>
          </li>)}</ul>}
      </section>
      <p className={styles.help}>Prvá časť: vytvorenie a zoznam konceptov. Nahrávanie, náhľady a publikovanie doplníme v ďalšej časti.</p>
    </div>
  </main>;
}
