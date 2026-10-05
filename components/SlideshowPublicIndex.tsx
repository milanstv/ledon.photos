import Link from "next/link";
import { publishedSlideshowGalleries } from "@/lib/slideshow-public";
export default async function SlideshowPublicIndex({ language }: { language: "sk" | "en" }) {
  const en = language === "en", base = en ? "/en" : "";
  const galleries = await publishedSlideshowGalleries();
  return <main className="mx-auto max-w-5xl px-5 py-10 text-white">
    <nav className="flex justify-between"><Link href={base || "/"} className="underline">← {en ? "Home" : "Úvod"}</Link><Link href={en ? "/slideshow" : "/en/slideshow"} className="underline">{en ? "Slovenčina" : "English"}</Link></nav>
    <h1 className="mt-8 text-3xl font-semibold">Slideshow</h1>
    <p className="mt-3 text-white/70">{en ? "Stories in motion, assembled from photographs." : "Príbehy v pohybe zostavené z fotografií."}</p>
    {!galleries.length && <p className="mt-8 text-white/60">{en ? "No galleries published yet." : "Zatiaľ nie sú zverejnené žiadne galérie."}</p>}
    <div className="mt-8 grid gap-5 sm:grid-cols-2">{galleries.map(g => <Link key={g.id} href={`${base}/slideshow/${g.id}`} className="rounded-xl border border-white/20 p-6 hover:bg-white/5"><h2 className="text-xl">{g.title}</h2><p className="mt-3 text-white/60">{new Intl.DateTimeFormat(en ? "en-GB" : "sk-SK").format(new Date(`${g.date}T12:00:00Z`))} · {g.count} slideshow</p></Link>)}</div>
  </main>;
}
