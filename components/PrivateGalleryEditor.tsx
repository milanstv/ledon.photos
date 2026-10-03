"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Item = { id: string; filename: string; kind: "photo" | "video"; size: number; url: string };
type Detail = { id: string; title: string; customerName: string; status: string; items: Item[]; activatedAt: string | null; expiresAt: string | null; customerPath: string | null; pendingDeletes: { id: string; filename: string }[] };
const button = "border border-white/30 px-5 py-3 text-sm disabled:opacity-40";
function sizeLabel(size: number) { return size >= 1024 ** 3 ? `${(size / 1024 ** 3).toFixed(2)} GB` : `${(size / 1024 ** 2).toFixed(1)} MB`; }

function putPart(url: string, blob: Blob, signal: AbortSignal, progress: (sent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const cleanup = () => signal.removeEventListener("abort", abort);
    xhr.open("PUT", url); xhr.timeout = 10 * 60 * 1000;
    xhr.upload.onprogress = event => progress(event.loaded);
    xhr.onload = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`R2 odmietlo časť súboru (${xhr.status}).`));
    };
    xhr.onerror = () => { cleanup(); reject(new Error("Spojenie s R2 zlyhalo. Skontroluj internet a nastavenie CORS.")); };
    xhr.ontimeout = () => { cleanup(); reject(new Error("Nahrávanie časti trvalo príliš dlho.")); };
    xhr.onabort = () => { cleanup(); reject(new Error("Nahrávanie bolo zastavené.")); };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) { cleanup(); reject(new Error("Nahrávanie bolo zastavené.")); return; }
    xhr.send(blob);
  });
}

export default function PrivateGalleryEditor({ galleryId }: { galleryId: string }) {
  const [gallery, setGallery] = useState<Detail | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [operating, setOperating] = useState(false);
  const [customerLink, setCustomerLink] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [progress, setProgress] = useState("");
  const [percent, setPercent] = useState(0);
  const [preview, setPreview] = useState<Item | null>(null);
  const controller = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const endpoint = `/api/admin/private-galleries/${encodeURIComponent(galleryId)}`;
  const reload = useCallback(async () => {
    const response = await fetch(endpoint, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Galéria sa nedá načítať.");
    setGallery(data);
    setCustomerLink(data.customerPath ? window.location.origin + data.customerPath : "");
    return data as Detail;
  }, [endpoint]);
  useEffect(() => {
    reload().catch(e => setError(e instanceof Error ? e.message : "Chyba načítania."));
    return () => controller.current?.abort();
  }, [reload]);
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  async function api(body: Record<string, unknown>, signal?: AbortSignal) {
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Operácia zlyhala.");
    return data;
  }
  async function upload() {
    if (busy || !files.length) return;
    // Validate the entire selection before starting the first upload.
    const invalid = files.find(file => !/\.(jpe?g|png|mp4)$/i.test(file.name) || file.size < 1 || file.size > 10 * 1024 ** 3);
    if (invalid) { setError(`Súbor „${invalid.name}“ nie je podporovaný. Vyber JPG, PNG alebo MP4 do 10 GB.`); return; }
    const aborter = new AbortController(); controller.current = aborter;
    setBusy(true); setError(""); setNotice(""); setPreview(null);
    let saved = 0;
    let activeId: string | undefined;
    let completing = false;
    try {
      for (const file of files) {
        activeId = undefined; completing = false;
        setProgress(`${saved + 1}/${files.length}: ${file.name}`); setPercent(0);
        const session = await api({ action: "start", filename: file.name, size: file.size }, aborter.signal);
        activeId = session.itemId;
        for (let partNumber = 1; partNumber <= session.partCount; partNumber++) {
          const offset = (partNumber - 1) * session.partSize;
          const chunk = file.slice(offset, Math.min(offset + session.partSize, file.size));
          for (let attempt = 0; ; attempt++) {
            try {
              const { url } = await api({ action: "part", itemId: activeId, partNumber }, aborter.signal);
              await putPart(url, chunk, aborter.signal, sent => setPercent(Math.min(99, Math.round((offset + sent) / file.size * 100))));
              break;
            } catch (e) { if (aborter.signal.aborted || attempt >= 2) throw e; }
          }
        }
        completing = true;
        setProgress(`Overujem súbor: ${file.name}`);
        // Completion can be safely retried using the same item ID.
        for (let attempt = 0; ; attempt++) {
          try { await api({ action: "complete", itemId: activeId }); break; }
          catch (e) { if (attempt >= 2) throw e; }
        }
        saved++; activeId = undefined; completing = false; setPercent(100);
        await reload();
        if (aborter.signal.aborted) throw new Error("Nahrávanie bolo zastavené.");
      }
      setFiles([]); if (input.current) input.current.value = "";
      setNotice(`Hotovo. Nahraté súbory: ${saved}. Súbory sú uložené v galérii.`);
    } catch (e) {
      if (activeId && !completing) await api({ action: "abort", itemId: activeId }).catch(() => {});
      // Remove successful files from the selection; never re-upload them on retry.
      setFiles(previous => previous.slice(saved));
      setError(`${e instanceof Error ? e.message : "Nahrávanie zlyhalo."} Uložené súbory: ${saved}.${completing ? " Dokončenie posledného súboru má neistý výsledok. Obnov galériu a skontroluj zoznam pred ďalším nahrávaním." : ""}`);
      await reload().catch(() => {});
    } finally { setBusy(false); controller.current = null; setProgress(""); }
  }
  async function action(operation: string, itemId?: string) {
    if (busy || operating || !gallery) return;
    const messages: Record<string, string> = {
      activate: "Sprístupniť galériu zákazníkovi? Pri prvom sprístupnení začne platnosť 14 dní. Pri opätovnom sprístupnení sa vytvorí nový zákaznícky odkaz.",
      block: "Zablokovať zákaznícky prístup? Starý zákaznícky odkaz prestane fungovať. Už vydané odkazy k súborom môžu fungovať ešte najviac 5 minút; začaté sťahovanie môže pokračovať.",
      extend: "Predĺžiť platnosť o 14 dní? Ak už vypršala, nových 14 dní začne teraz.",
      "delete-item": "Natrvalo zmazať tento súbor zo súkromnej galérie aj jeho kópiu v R2? Lokálny súbor na tvojom disku zostane zachovaný.",
    };
    let confirmation: string | null = null;
    if (operation === "delete-gallery") {
      if (gallery.status !== "deleting") {
        confirmation = window.prompt(`Natrvalo zmazať celú súkromnú galériu a všetky jej kópie v R2? Lokálne originály a verejné galérie zostanú zachované. Zákaznícky prístup sa zruší a mazanie už nemožno odvolať.\n\nNa potvrdenie napíš presný názov:\n${gallery.title}`);
        if (confirmation === null) return;
        if (confirmation !== gallery.title) { setError("Názov sa nezhoduje. Galéria sa nezmazala."); return; }
      }
    } else if (!window.confirm(messages[operation] || "Potvrdiť operáciu?")) return;
    setOperating(true); setError(""); setNotice(""); setPreview(null);
    let changed = false;
    try {
      const result = await api({ action: operation, itemId, expectedExpiresAt: gallery.expiresAt, confirmation });
      changed = true;
      await reload();
      setNotice(operation === "delete-gallery" ? result.done
        ? "Súkromná galéria a jej súbory v R2 sú vymazané."
        : "Prístup je zrušený. Časť súborov sa vymazala; použi Dokončiť zmazanie galérie."
        : operation === "activate" ? "Galéria je sprístupnená. Skopíruj zákaznícky odkaz."
        : operation === "block" ? "Zákaznícky prístup je zablokovaný. Súbory môžeš upravovať."
        : operation === "extend" ? "Platnosť bola predĺžená o 14 dní."
        : "Súbor bol vymazaný zo súkromnej galérie a R2.");
    } catch (e) {
      setError(changed ? "Zmena je uložená, ale zoznam sa nepodarilo obnoviť. Obnov stránku."
        : e instanceof Error ? e.message : "Operácia sa nepodarila.");
      await reload().catch(() => {});
    } finally { setOperating(false); }
  }
  async function copyLink() {
    if (!customerLink) return;
    try { await navigator.clipboard.writeText(customerLink); setNotice("Zákaznícky odkaz je skopírovaný."); }
    catch { setNotice("Označ zákaznícky odkaz v poli a skopíruj ho pomocou Cmd+C."); }
  }
  async function open(itemId: string) {
    setError("");
    try {
      const fresh = await reload();
      const item = fresh.items.find(item => item.id === itemId);
      if (!item) throw new Error("Súbor sa nenašiel.");
      setPreview(item);
    } catch (e) { setError(e instanceof Error ? e.message : "Náhľad sa nedá otvoriť."); }
  }
  return <main className="min-h-screen bg-[#080808] px-5 py-8 text-white md:px-10 md:py-12">
    <div className="mx-auto max-w-6xl">
      <nav className="mb-8 text-sm text-white/60"><Link href="/admin/private-galleries" prefetch={false} onClick={e => { if (busy || operating) e.preventDefault(); }}>← Súkromné galérie</Link></nav>
      <p className="text-xs uppercase tracking-[0.3em] text-white/40">LEDON. ADMIN</p>
      <h1 className="mt-4 text-3xl font-light md:text-5xl">{gallery?.title || "Súkromná galéria"}</h1>
      {gallery && <p className="mt-4 text-white/60">Zákazník: {gallery.customerName} · {gallery.status === "draft" ? "Koncept" : gallery.status === "blocked" ? "Zablokovaná" : gallery.status === "active" && gallery.expiresAt && Date.parse(gallery.expiresAt) <= Date.now() ? "Platnosť vypršala" : gallery.status === "active" ? "Sprístupnená" : gallery.status === "deleting" ? "Prebieha mazanie" : gallery.status === "deleted" ? "Vymazaná" : gallery.status}</p>}
      <p className="mt-4 text-sm leading-6 text-white/60">{gallery?.status === "deleted" ? "Galéria a jej súbory boli vymazané. Zákaznícky odkaz už nefunguje."
        : gallery?.status === "deleting" ? "Zákaznícky prístup je zrušený. Dokonči mazanie súborov v R2 pomocou tlačidla nižšie."
        : gallery?.status === "draft"
        ? "Nahraj fotky JPG/PNG alebo videá MP4. Zákazník zatiaľ nemá prístup a 14-dňová platnosť ešte nezačala."
        : "Pred zmenou súborov galériu zablokuj. Po kontrole ju znova sprístupni a pošli zákazníkovi nový odkaz."}</p>
      {gallery?.expiresAt && <p className="mt-4 text-sm text-white/70">Platnosť do: {new Date(gallery.expiresAt).toLocaleString("sk-SK", { timeZone: "Europe/Bratislava" })}</p>}
      {gallery && <section className="mt-6 border border-white/20 p-5">
        <div className="flex flex-wrap gap-3">
          {(gallery.status === "draft" || gallery.status === "blocked") && <button className={button} disabled={busy || operating || !gallery.items.length || gallery.pendingDeletes.length > 0} onClick={() => action("activate")}>Sprístupniť zákazníkovi</button>}
          {gallery.status === "active" && <button className={button} disabled={busy || operating} onClick={() => action("block")}>Zablokovať prístup</button>}
          {gallery.activatedAt && gallery.status !== "deleting" && gallery.status !== "deleted" && <button className={button} disabled={busy || operating} onClick={() => action("extend")}>Predĺžiť o 14 dní</button>}
        </div>
        {customerLink && <div className="mt-5">
          <label className="text-sm">Zákaznícky odkaz<input readOnly value={customerLink} onFocus={e => e.target.select()} className="mt-2 w-full border border-white/25 bg-black p-3 text-xs text-white" /></label>
          <div className="mt-3 flex flex-wrap gap-3"><button className={button} disabled={busy || operating} onClick={copyLink}>Kopírovať odkaz</button>
            <a className={button} href={customerLink} target="_blank" rel="noreferrer">Otvoriť zákaznícku galériu</a></div>
          <p className="mt-3 text-xs text-white/50">Odkaz poskytuje prístup ku všetkým súborom. Posielaj ho iba danému zákazníkovi.</p>
        </div>}
      </section>}
      {error && <p role="alert" className="mt-5 text-red-300">{error}</p>}
      {notice && <p role="status" className="mt-5 text-green-300">{notice}</p>}
      {(gallery?.status === "draft" || gallery?.status === "blocked") && <section className="mt-8 border border-white/20 p-5">
        <label className="block text-sm">Vybrať fotky a videá
          <input ref={input} type="file" multiple accept=".jpg,.jpeg,.png,.mp4" disabled={busy || operating}
            onChange={e => { setFiles(Array.from(e.target.files || [])); setError(""); setNotice(""); }}
            className="mt-3 block w-full text-sm file:mr-4 file:border file:border-white/30 file:bg-black file:px-4 file:py-2 file:text-white" />
        </label>
        <p className="my-4 text-sm text-white/50">Vybrané súbory: {files.length}{files.length > 0 ? ` · ${sizeLabel(files.reduce((total, file) => total + file.size, 0))}` : ""}</p>
        <div className="flex flex-wrap gap-3">
          <button className={button} disabled={busy || operating || !files.length} onClick={upload}>{busy ? "Nahrávam…" : "Nahrať vybrané súbory"}</button>
          {busy && <button className={button} onClick={() => controller.current?.abort()}>Zastaviť nahrávanie</button>}
        </div>
        {busy && <div role="status" className="mt-4"><p className="mb-2 break-all text-sm">{progress} · {percent}%</p><progress max={100} value={percent} className="w-full" /></div>}
      </section>}
      <div className="mt-8 flex items-center justify-between gap-4"><h2 className="text-xl">Súbory ({gallery?.items.length || 0})</h2>
        <button className={button} disabled={busy || operating} onClick={() => { setPreview(null); reload().catch(e => setError(e.message)); }}>Obnoviť zoznam</button>
      </div>
      <ul className="mt-4 divide-y divide-white/15">{gallery?.items.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="min-w-0"><p className="break-all">{item.filename}</p><p className="text-sm text-white/50">{item.kind === "video" ? "Video MP4" : "Fotka"} · {sizeLabel(item.size)}</p></div>
        <div className="flex flex-wrap gap-3"><button className={button} disabled={busy || operating} onClick={() => open(item.id)}>{item.kind === "video" ? "Prehrať video" : "Otvoriť fotku"}</button>
          {(gallery.status === "draft" || gallery.status === "blocked") && <button className={`${button} text-red-300`} disabled={busy || operating} onClick={() => action("delete-item", item.id)}>Zmazať súbor</button>}
        </div>
      </li>)}</ul>
      {gallery && gallery.pendingDeletes.length > 0 && <section className="mt-6 border border-red-300/40 p-4">
        <p className="text-red-300">Tieto súbory už nie sú v galérii, ale treba dokončiť vymazanie ich kópií v R2:</p>
        {gallery.pendingDeletes.map(item => <div key={item.id} className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="break-all text-sm">{item.filename}</p><button className={button} disabled={busy || operating} onClick={() => action("delete-item", item.id)}>Dokončiť zmazanie</button></div>)}
      </section>}
      {gallery && !gallery.items.length && gallery.status !== "deleting" && gallery.status !== "deleted" && <p className="mt-5 text-white/50">Galéria zatiaľ neobsahuje súbory.</p>}
      {gallery && gallery.status !== "deleted" && <section className="mt-8 border border-red-300/30 p-5">
        <p className="mb-4 text-sm text-white/60">Zmazanie je nevratné. Odstráni iba túto súkromnú galériu a jej kópie v R2.</p>
        <button className={`${button} text-red-300`} disabled={busy || operating} onClick={() => action("delete-gallery")}>
          {operating ? "Prebieha operácia…" : gallery.status === "deleting" ? "Dokončiť zmazanie galérie" : "Zmazať celú galériu"}
        </button>
      </section>}
      {preview && <section className="mt-8 border border-white/20 p-4">
        <div className="mb-4 flex justify-between gap-4"><p className="break-all">{preview.filename}</p><button className="text-sm text-white/60" onClick={() => setPreview(null)}>Zavrieť</button></div>
        {preview.kind === "video" ? <video key={preview.url} src={preview.url} controls preload="metadata" className="max-h-[70vh] w-full" />
          // Private signed originals are used only in the authenticated admin preview.
          // eslint-disable-next-line @next/next/no-img-element
          : <img src={preview.url} alt={preview.filename} referrerPolicy="no-referrer" className="mx-auto max-h-[70vh] max-w-full object-contain" />}
        <p className="mt-3 text-xs text-white/40">Ak náhľad po čase prestane fungovať, zavri ho a otvor znova.</p>
      </section>}
    </div>
  </main>;
}
