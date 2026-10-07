"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./PhotoGalleriesAdmin.module.css";
type Detail = { id: string; title: string; date: string; priceCents: number; status: string;
  items: { id: string; filename: string; sourceFilename: string; customerNumber: number; size: number; status: string }[] };
type Job = { id: string; file: File; state: "waiting" | "uploading" | "done" | "error"; progress: number; error: string };
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
function uuid() {
  const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = Array.from(b, v => v.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
export default function PhotoGalleryEditor({ galleryId }: { galleryId: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const running = useRef(false);
  const mounted = useRef(true);
  const stop = useRef(false);
  const xhr = useRef<XMLHttpRequest | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const api = `/api/admin/photo-galleries/${galleryId}`;
  const refresh = useCallback(async () => {
    const response = await fetch(api, { cache: "no-store" }); const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Galériu sa nepodarilo načítať.");
    if (mounted.current) setDetail(data);
  }, [api]);
  useEffect(() => {
    mounted.current = true;
    void refresh().catch(e => setError(e.message)).finally(() => setLoading(false));
    return () => { mounted.current = false; stop.current = true; xhr.current?.abort(); };
  }, [refresh]);
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);
  async function action(body: Record<string, unknown>) {
    const response = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || "Prenos sa nepodaril."); return data;
  }
  function update(id: string, patch: Partial<Job>) { if (mounted.current) setJobs(list => list.map(j => j.id === id ? { ...j, ...patch } : j)); }
  function choose(files: FileList | null) {
    if (!files || running.current) return;
    setError("");
    const selected = Array.from(files);
    if (selected.some(f => !/\.jpe?g$/i.test(f.name) || f.size < 1 || f.size > 64 * 1024 * 1024)) {
      setError("Vyber iba JPG alebo JPEG do 64 MB za súbor. Výber sa nepridal."); return;
    }
    setJobs(old => {
      const known = new Set(old.map(j => `${j.file.name}:${j.file.size}:${j.file.lastModified}`));
      const saved = new Set(detail?.items.map(i => `${i.sourceFilename}:${i.size}`));
      const added: Job[] = [];
      for (const file of selected) {
        const k = `${file.name}:${file.size}:${file.lastModified}`;
        if (known.has(k) || saved.has(`${file.name}:${file.size}`)) continue;
        known.add(k); added.push({ id: uuid(), file, state: "waiting", progress: 0, error: "" });
      }
      return [...old, ...added];
    });
  }
  function put(url: string, part: Blob, progress: (loaded: number) => void) {
    return new Promise<void>((resolve, reject) => {
      const request = new XMLHttpRequest(); xhr.current = request;
      request.open("PUT", url); request.timeout = 180000;
      request.upload.onprogress = e => progress(e.loaded);
      request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(`R2 odmietlo prenos (HTTP ${request.status}).`));
      request.onerror = () => reject(new Error("Prenos do R2 zlyhal. Skontroluj pripojenie a skús opakovanie."));
      request.ontimeout = () => reject(new Error("Prenos trval príliš dlho. Skús opakovanie."));
      request.onabort = () => reject(new Error("Prenos bol prerušený.")); request.send(part);
    });
  }
  async function upload(retry: boolean) {
    if (running.current) return;
    const pending = jobs.filter(j => j.state === "waiting" || (retry && j.state === "error"));
    if (!pending.length) return;
    running.current = true; stop.current = false; setBusy(true); setError("");
    try {
      for (const job of pending) {
        if (stop.current || !mounted.current) break;
        update(job.id, { state: "uploading", progress: 0, error: "" });
        try {
          const s = await action({ action: "start", itemId: job.id, filename: job.file.name, size: job.file.size });
          if (!s.saved && !s.completed) {
            for (let n = 1; n <= s.partCount; n++) {
              const offset = (n - 1) * s.partSize;
              const part = job.file.slice(offset, Math.min(job.file.size, offset + s.partSize));
              const signed = await action({ action: "part", itemId: job.id, partNumber: n });
              if (!mounted.current) throw new Error("Prenos bol prerušený.");
              await put(signed.url, part, loaded => update(job.id, { progress: Math.min(99, Math.round((offset + loaded) / job.file.size * 100)) }));
            }
          }
          if (!s.saved) await action({ action: "complete", itemId: job.id });
          update(job.id, { state: "done", progress: 100 });
        } catch (e) { update(job.id, { state: "error", error: e instanceof Error ? e.message : "Chyba prenosu." }); }
      }
      if (mounted.current) await refresh();
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "Chyba načítania."); }
    finally { running.current = false; if (mounted.current) setBusy(false); }
  }
  return <main className={styles.admin}><aside className={styles.sidebar}><Link href="/" className={styles.brand}>LEDON.PHOTOS</Link>
    <nav aria-label="Administrácia"><Link href="/admin/orders">Objednávky</Link><Link href="/admin/photo-galleries" aria-current="page">Fotogalérie</Link>
      <Link href="/admin/slideshow-galleries">Slideshow</Link><Link href="/admin/private-galleries">Súkromné galérie</Link></nav></aside>
    <div className={styles.content}><Link href="/admin/photo-galleries">← Zoznam fotogalérií</Link><h1>{detail?.title ?? "Fotogaléria"}</h1>
      {loading && <p>Načítavam…</p>}{error && <p role="alert" className={styles.error}>{error}</p>}
      {detail && <><p className={styles.subtitle}>{detail.date} · {(detail.priceCents / 100).toFixed(2)} € / fotka · {detail.status === "draft" ? "Neverejný koncept" : detail.status}</p>
        <section className={styles.panel}><h2>Nahrať originály</h2><p className={styles.help}>Vyber upravené JPG v plnom rozlíšení bez vodoznaku. Najviac 64 MB za fotografiu. Originály sa ukladajú do súkromného R2.</p>
          <input ref={fileInput} type="file" accept="image/jpeg,.jpg,.jpeg" multiple style={{ display: "none" }}
            disabled={busy || detail.status !== "draft"} aria-label="Vybrať fotografie"
            onChange={e => { choose(e.target.files); e.target.value = ""; }} />
          <button type="button" disabled={busy || detail.status !== "draft"} onClick={() => fileInput.current?.click()}>Vybrať fotografie</button>
          <p className={styles.help}>Vo fronte: {jobs.filter(j => j.state === "waiting").length} čakajúcich · {jobs.filter(j => j.state === "done").length} uložených · {jobs.filter(j => j.state === "error").length} neúspešných</p>
          <div className={styles.uploadActions}><button type="button" className={styles.primary} disabled={busy || detail.status !== "draft" || !jobs.some(j => j.state === "waiting")} onClick={() => void upload(false)}>Nahrať vybrané fotografie</button>
            <button type="button" disabled={busy || !jobs.some(j => j.state === "error")} onClick={() => void upload(true)}>Zopakovať neúspešné</button>
            {busy && <button type="button" onClick={() => { stop.current = true; }}>Pozastaviť po aktuálnej fotke</button>}</div>
          <p className={styles.help}>Počas nahrávania nechaj túto stránku otvorenú. Opakovanie používa rovnaké ID súboru, aby nevytvorilo druhú položku. Po zatvorení stránky bude potrebné nedokončené súbory vybrať znova.</p>
          {jobs.length > 0 && <ul className={styles.uploadList}>{jobs.map(j => <li key={j.id}><div><strong>{j.file.name}</strong> · {mb(j.file.size)}
            <span>{j.state === "done" ? "Uložená" : j.state === "uploading" ? `Nahrávam ${j.progress} %` : j.state === "error" ? "Chyba" : "Čaká"}</span></div>
            {j.state === "uploading" && <progress max={100} value={j.progress} aria-label={`Nahrávanie ${j.file.name}`} />}
            {j.error && <p className={styles.error}>{j.error}</p>}</li>)}</ul>}
        </section><section className={styles.panel}><div className={styles.sectionHead}><h2>Uložené originály ({detail.items.length})</h2>
          <button type="button" disabled={busy} onClick={() => { setError(""); void refresh().catch(e => setError(e.message)); }}>Obnoviť zoznam</button></div>
          {detail.items.length === 0 ? <p className={styles.help}>Zatiaľ tu nie sú fotografie.</p> : <ul className={styles.uploadList}>{detail.items.map(i => <li key={i.id}><strong>#{i.customerNumber} · {i.filename}</strong><p className={styles.help}>{i.sourceFilename} · {mb(i.size)} · Originál uložený</p></li>)}</ul>}
          <p className={styles.help}>Náhľady s vodoznakom, verzie pre sociálne siete a publikovanie doplníme v ďalšej časti. Táto galéria sa zatiaľ na verejnom webe nezobrazuje.</p>
        </section></>}
    </div></main>;
}
