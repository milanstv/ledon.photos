"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { isPrivateGalleryExpired, type PrivateGallery } from "@/lib/media-types";

function statusLabel(gallery: PrivateGallery) {
  if (gallery.status === "active" && isPrivateGalleryExpired(gallery)) return "Platnosť vypršala";
  const labels = {
    draft: "Koncept", active: "Sprístupnená", blocked: "Zablokovaná",
    deleting: "Prebieha mazanie", deleted: "Vymazaná",
  };
  return labels[gallery.status];
}

export default function PrivateGalleriesAdmin() {
  const [galleries, setGalleries] = useState<PrivateGallery[]>([]);
  const [title, setTitle] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const reload = useCallback(async () => {
    const response = await fetch("/api/admin/private-galleries", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Galérie sa nepodarilo načítať.");
    if (!Array.isArray(data.galleries)) throw new Error("Neplatná odpoveď servera.");
    setGalleries(data.galleries);
  }, []);

  useEffect(() => {
    reload().catch(e => setError(e instanceof Error ? e.message : "Chyba načítania."))
      .finally(() => setLoading(false));
  }, [reload]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError(""); setNotice("");
    let created = false;
    try {
      const response = await fetch("/api/admin/private-galleries", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, customerName }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Koncept sa nepodarilo vytvoriť.");
      created = true;
      setTitle(""); setCustomerName("");
      setNotice("Koncept je vytvorený. Zákazník k nemu zatiaľ nemá prístup.");
      await reload();
    } catch (e) {
      setError(created
        ? "Koncept bol uložený, ale zoznam sa nepodarilo obnoviť. Obnov stránku."
        : e instanceof Error ? e.message : "Chyba vytvárania konceptu.");
    } finally { setSaving(false); }
  }

  return (
    <main className="min-h-screen bg-[#080808] px-5 py-8 text-white md:px-10 md:py-12">
      <div className="mx-auto max-w-6xl">
        <nav className="mb-8 flex gap-6 text-sm text-white/60">
          <Link href="/admin/orders" prefetch={false}>Objednávky</Link>
          <Link href="/">Web</Link>
        </nav>
        <p className="text-xs uppercase tracking-[0.3em] text-white/40">LEDON. ADMIN</p>
        <h1 className="mt-4 text-4xl font-light md:text-5xl">Súkromné galérie</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-white/60">
          Galérie pre zákazníkov, ktorí už zaplatili. Najprv vytvor koncept.
          Platnosť 14 dní začne až po sprístupnení zákazníkovi.
          Po skončení platnosti sa prístup zruší. Súbory následne vymaže automatické čistenie;
          veľké galérie môže mazať postupne.
        </p>
        <form onSubmit={create} className="mt-9 grid gap-4 border border-white/20 p-6 md:grid-cols-2">
          <label className="text-sm">Názov galérie
            <input required maxLength={160} value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Napríklad: Individuálne fotenie – Peter"
              className="mt-2 w-full border border-white/25 bg-black p-3 text-white" />
          </label>
          <label className="text-sm">Zákazník
            <input required maxLength={120} value={customerName} onChange={e => setCustomerName(e.target.value)}
              placeholder="Meno zákazníka"
              className="mt-2 w-full border border-white/25 bg-black p-3 text-white" />
          </label>
          <button disabled={saving} className="border border-white/30 px-5 py-3 text-sm disabled:opacity-40 md:col-span-2">
            {saving ? "Vytváram koncept…" : "Vytvoriť koncept"}
          </button>
        </form>
        {error && <p role="alert" className="mt-5 text-sm text-red-300">{error}</p>}
        {notice && <p role="status" className="mt-5 text-sm text-green-300">{notice}</p>}
        {loading ? <p className="mt-8 text-white/50">Načítavam galérie…</p> : (
          <div className="mt-8 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-white/50"><tr>
                <th className="p-3">Galéria</th><th className="p-3">Zákazník</th>
                <th className="p-3">Stav</th><th className="p-3">Súbory</th><th className="p-3">Platnosť do</th>
              </tr></thead>
              <tbody>{galleries.map(gallery => <tr key={gallery.id} className="border-t border-white/15">
                <td className="p-3"><Link href={`/admin/private-galleries/${gallery.id}`} prefetch={false} className="underline underline-offset-4">{gallery.title}</Link></td><td className="p-3">{gallery.customerName}</td>
                <td className="p-3">{statusLabel(gallery)}</td><td className="p-3">{gallery.items.length}</td>
                <td className="p-3">{gallery.expiresAt
                  ? new Date(gallery.expiresAt).toLocaleString("sk-SK", { timeZone: "Europe/Bratislava" })
                  : "Zatiaľ nezačala"}</td>
              </tr>)}</tbody>
            </table>
            {!galleries.length && !error && <p className="mt-5 text-white/50">Zatiaľ nemáš žiadne súkromné galérie.</p>}
          </div>
        )}
      </div>
    </main>
  );
}
