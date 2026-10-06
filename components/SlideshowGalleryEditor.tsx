"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Item = { id: string; title: string; filename: string; priceCents: number; durationSeconds: number; previewUrl: string; posterUrl: string };
type Gallery = { id: string; title: string; date: string; status: string; pendingDeletion?: { kind: "gallery" | "item"; itemId?: string }; items: Item[] };
type Role = "original" | "preview" | "poster";
const roles: Role[] = ["original", "preview", "poster"];
const labels = { original: "Originál", preview: "Náhľad", poster: "Úvodný obrázok" };
const money = (cents: number) => new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(cents / 100);

async function duration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    const timer = window.setTimeout(() => finish(new Error("Nepodarilo sa načítať dĺžku originálu.")), 20000);
    function finish(error?: Error) {
      clearTimeout(timer);
      const value = video.duration;
      video.removeAttribute("src"); video.load(); URL.revokeObjectURL(url);
      if (error) reject(error);
      else if (!Number.isFinite(value) || value <= 0) reject(new Error("Originál nemá platnú dĺžku."));
      else resolve(value);
    }
    video.onloadedmetadata = () => finish();
    video.onerror = () => finish(new Error("Originál sa nedá načítať. Vyber platný MP4."));
    video.preload = "metadata"; video.src = url;
  });
}
function put(url: string, blob: Blob, progress: (bytes: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url); xhr.timeout = 300000;
    xhr.upload.onprogress = event => progress(event.loaded);
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Nahrávanie súboru zlyhalo."));
    xhr.onerror = xhr.ontimeout = () => reject(new Error("Spojenie pri nahrávaní sa prerušilo."));
    xhr.send(blob);
  });
}
async function retry<T>(operation: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await operation(); } catch (error) { last = error; }
  }
  throw last;
}

export default function SlideshowGalleryEditor({ galleryId }: { galleryId: string }) {
  const router = useRouter();
  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false); const busyRef = useRef(false);
  const [progress, setProgress] = useState(0); const [uploadLabel, setUploadLabel] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const endpoint = `/api/admin/slideshow-galleries/${galleryId}`;
  const load = useCallback(async () => {
    const response = await fetch(endpoint, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Galériu sa nepodarilo načítať.");
    setGallery(data as Gallery); return data as Gallery;
  }, [endpoint]);
  useEffect(() => { load().catch(e => setError(e.message)); }, [load]);
  async function action(body: Record<string, unknown>) {
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Akciu sa nepodarilo dokončiť.");
    return data;
  }
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(""); setMessage(""); setProgress(0);
    let itemId: string | undefined;
    try {
      const data = new FormData(event.currentTarget);
      const price = String(data.get("price") || "").trim().replace(",", ".");
      if (!/^\d{1,5}(\.\d{1,2})?$/.test(price)) throw new Error("Zadaj cenu s najviac dvoma desatinnými miestami.");
      const [whole, decimal = ""] = price.split(".");
      const priceCents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
      if (priceCents < 1 || priceCents > 1000000) throw new Error("Cena musí byť od 0,01 € do 10 000 €.");
      const files = {} as Record<Role, File>;
      for (const role of roles) {
        const file = data.get(role);
        const limit = role === "original" ? 10 * 1024 ** 3 : role === "preview" ? 2 * 1024 ** 3 : 10 * 1024 ** 2;
        if (!(file instanceof File) || !file.size || file.size > limit || !(role === "poster" ? /\.jpe?g$/i : /\.mp4$/i).test(file.name)) {
          throw new Error("Vyber originál MP4 do 10 GB, náhľad MP4 do 2 GB a obrázok JPG do 10 MB.");
        }
        files[role] = file;
      }
      setUploadLabel("Kontrolujem originál…");
      const durationSeconds = await duration(files.original);
      const started = await action({ action: "upload-start", filename: files.original.name, priceCents, durationSeconds,
        sizes: Object.fromEntries(roles.map(role => [role, files[role].size])) });
      itemId = started.itemId;
      const partSize = started.partSize as number;
      if (!itemId || !Number.isSafeInteger(partSize) || partSize < 1) throw new Error("Neplatná odpoveď pri začatí nahrávania.");
      const total = roles.reduce((sum, role) => sum + files[role].size, 0);
      let completed = 0;
      for (const role of roles) {
        const file = files[role]; setUploadLabel(`Nahrávam: ${labels[role]}`);
        for (let offset = 0, partNumber = 1; offset < file.size; offset += partSize, partNumber++) {
          const blob = file.slice(offset, Math.min(offset + partSize, file.size));
          await retry(async () => {
            const signed = await action({ action: "upload-part", itemId, role, partNumber });
            await put(signed.url, blob, bytes => setProgress(Math.min(99, Math.floor((completed + bytes) / total * 100))));
          });
          completed += blob.size;
        }
        await retry(() => action({ action: "upload-complete", itemId, role }));
      }
      setUploadLabel("Ukladám slideshow…");
      await retry(() => action({ action: "upload-finish", itemId }));
      setProgress(100); formRef.current?.reset();
      setMessage("Slideshow je uložené. Galéria zatiaľ zostáva skrytá.");
      await load();
    } catch (e) {
      let saved = false;
      if (itemId) {
        try { saved = (await load()).items.some(item => item.id === itemId); } catch {}
        if (!saved) { try { await action({ action: "upload-abort", itemId }); } catch {} }
      }
      if (saved) { formRef.current?.reset(); setMessage("Slideshow je uložené. Galéria zatiaľ zostáva skrytá."); }
      else setError(e instanceof Error ? e.message : "Nahrávanie zlyhalo.");
    } finally { busyRef.current = false; setBusy(false); setUploadLabel(""); }
  }
  async function visibility() {
    if (!gallery || busyRef.current) return;
    const publish = gallery.status !== "published";
    if (publish && !window.confirm("Zverejniť celú galériu? Náhľady a obrázky budú dostupné každému s odkazom. Originály zostanú súkromné.")) return;
    busyRef.current = true; setBusy(true); setError(""); setMessage("");
    try {
      await action({ action: "visibility", status: publish ? "published" : "archived" });
      await load(); setMessage(publish ? "Galéria je zverejnená." : "Galéria je skrytá. Už načítaný náhľad môže ešte chvíľu fungovať.");
    } catch (e) { setError(e instanceof Error ? e.message : "Zmena stavu zlyhala."); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function remove(item?: Item) {
    if (!gallery || busyRef.current) return;
    const name = item ? item.title : gallery.title;
    const answer = window.prompt(`Natrvalo zmazať ${item ? "klip" : "celú galériu"} „${name}“ aj súbory z R2?

Originály, náhľady a obrázky sa vymažú. Staré platené odkazy prestanú fungovať. Rozpracované nahrávanie sa zruší. Túto akciu nemožno vrátiť.

Na potvrdenie napíš presný názov: ${name}`);
    if (answer === null) return;
    if (answer !== name) { setError("Názov nesúhlasí. Nič sa nevymazalo."); return; }
    busyRef.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const result = await action({ action: item ? "delete-item" : "delete-gallery", itemId: item?.id, confirmation: answer });
      if (result.done && !item) { router.replace("/admin/slideshow-galleries"); return; }
      await load();
      setMessage(result.done ? `Klip ${name} aj jeho súbory z R2 sú vymazané.` : "Mazanie pokračuje. Použi Dokončiť mazanie.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mazanie zlyhalo.");
      try { await load(); } catch {}
    } finally { busyRef.current = false; setBusy(false); }
  }
  const input = "mt-2 w-full rounded-lg border border-white/20 bg-white/5 p-3";
  return <main className="min-h-screen w-full bg-black text-white"><div className="mx-auto max-w-5xl px-5 py-10">
    <Link href="/admin/slideshow-galleries" className="underline">← Slideshow galérie</Link>
    <h1 className="mt-6 text-3xl font-semibold">{gallery?.title || "Slideshow"}</h1>
    {gallery && <p className="mt-2 text-white/70">{gallery.date} · {gallery.items.length} slideshow · {gallery.status === "draft" ? "Koncept" : gallery.status === "archived" ? "Skrytá" : "Zverejnená"}</p>}
    {gallery && <div className="mt-5 flex flex-wrap gap-4">
      <button disabled={busy || !!gallery.pendingDeletion || !gallery.items.length} onClick={visibility} className="rounded-lg border border-white/30 px-4 py-2 disabled:opacity-40">{gallery.status === "published" ? "Skryť galériu" : "Zverejniť galériu"}</button>
      <button disabled={busy || gallery.status === "published" || (!!gallery.pendingDeletion && gallery.pendingDeletion.kind !== "gallery")} onClick={() => remove()} className="rounded-lg border border-red-400/50 px-4 py-2 text-red-200 disabled:opacity-40">{gallery.pendingDeletion?.kind === "gallery" ? "Dokončiť mazanie galérie" : "Zmazať celú galériu"}</button>
      {gallery.status === "published" && <Link href={`/slideshow/${gallery.id}`} target="_blank" rel="noreferrer" className="rounded-lg border border-white/30 px-4 py-2">Otvoriť zákaznícky náhľad ↗</Link>}
    </div>}
    {gallery?.status === "published" && <p className="mt-4 text-sm text-white/60">Pred mazaním galériu najprv skry.</p>}
    {gallery?.pendingDeletion && <p role="status" className="mt-4 rounded-lg bg-amber-500/15 p-4 text-amber-200">Mazanie nie je dokončené. Galéria zostáva skrytá a nahrávanie aj zverejnenie sú zablokované. Použi tlačidlo Dokončiť mazanie.</p>}
    {error && <p role="alert" className="mt-5 rounded-lg bg-red-500/15 p-4 text-red-200">{error}</p>}
    {message && <p role="status" className="mt-5 rounded-lg bg-green-500/15 p-4 text-green-200">{message}</p>}
    {gallery && gallery.status !== "published" && !gallery.pendingDeletion && <form ref={formRef} onSubmit={upload} className="mt-8 rounded-xl border border-white/15 p-5">
      <h2 className="text-xl font-semibold">Pridať slideshow</h2>
      <fieldset disabled={busy} className="mt-5 grid gap-5 sm:grid-cols-2">
        <p className="text-sm text-white/70">Názov Klip001, Klip002… sa pridelí automaticky po dokončení nahrávania.</p>
        <label>Cena v €<input name="price" required inputMode="decimal" className={input} placeholder="Zadaj cenu" /></label>
        <label className="sm:col-span-2">Originál MP4 s plnou kvalitou a zvukom<input name="original" required type="file" accept="video/mp4,.mp4" className={input} /></label>
        <label className="sm:col-span-2">Celý náhľad MP4 v nižšej kvalite bez zvuku<input name="preview" required type="file" accept="video/mp4,.mp4" className={input} /></label>
        <label className="sm:col-span-2">Úvodný obrázok JPG<input name="poster" required type="file" accept="image/jpeg,.jpg,.jpeg" className={input} /></label>
        <button className="rounded-lg bg-white px-5 py-3 font-semibold text-black sm:col-span-2">{busy ? `${uploadLabel} ${progress}%` : "Nahrať slideshow"}</button>
      </fieldset>
      {busy && <p className="mt-3 text-sm text-white/70">Nechaj túto stránku otvorenú do dokončenia nahrávania.</p>}
    </form>}
    {gallery && <section className="mt-8">
      <div className="flex items-center justify-between gap-4"><h2 className="text-xl font-semibold">Uložené slideshow</h2><button disabled={busy} onClick={() => load().catch(e => setError(e.message))} className="rounded-lg border border-white/20 px-4 py-2">Obnoviť náhľady</button></div>
      {!gallery.items.length && <p className="mt-4 text-white/60">Galéria zatiaľ neobsahuje žiadne slideshow.</p>}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">{gallery.items.map(item => <article key={item.id} className="overflow-hidden rounded-xl border border-white/15">
        <video controls muted playsInline preload="none" poster={item.posterUrl} src={item.previewUrl} className="aspect-video w-full bg-black object-contain" />
        <div className="p-4"><h3 className="font-semibold">{item.title}</h3><p className="mt-1 text-white/70">{money(item.priceCents)} · {item.durationSeconds.toFixed(1)} s</p><p className="mt-1 break-all text-sm text-white/50">{item.filename}</p>
          <button disabled={busy || gallery.status === "published" || (!!gallery.pendingDeletion && (gallery.pendingDeletion.kind !== "item" || gallery.pendingDeletion.itemId !== item.id))} onClick={() => remove(item)} className="mt-4 rounded-lg border border-red-400/50 px-4 py-2 text-red-200 disabled:opacity-40">{gallery.pendingDeletion?.kind === "item" && gallery.pendingDeletion.itemId === item.id ? "Dokončiť mazanie klipu" : "Zmazať klip"}</button>
        </div>
      </article>)}</div>
    </section>}
  </div></main>;
}
