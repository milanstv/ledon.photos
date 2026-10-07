import { galleries as oldGalleries,getGallery as oldGallery,type Gallery } from "@/data/galleries";
import { listPhotoGalleries,readPhotoGallery,photoGalleryPrefix } from "@/lib/photo-galleries";
import type { PhotoGalleryRecord } from "@/lib/photo-gallery-types";
import { photoMediaKey } from "@/lib/photo-previews";
export function photoGalleryId(slug:string) {
  if(!slug.startsWith("photos-"))return null;
  const id=slug.slice(7);photoGalleryPrefix(id);return id;
}
export function publicPhotoGallery(g:PhotoGalleryRecord):Gallery {
  const photos=g.items.filter(i=>i.status==="ready").map(i=>{
    if(i.originalKey!==photoMediaKey(g.id,i.id,"original") || i.previewKey!==photoMediaKey(g.id,i.id,"preview") || i.socialKey!==photoMediaKey(g.id,i.id,"social"))throw new Error("Neplatné cesty fotografie.");
    return {id:i.id,customerNumber:i.customerNumber,filename:i.filename,takenAt:i.takenAt,src:`/api/photo-galleries/${g.id}/media/${i.id}`,alt:`${g.title} – fotografia č. ${i.customerNumber}`};
  });
  // Cover selection changes the first public thumbnail while preserving customer numbers.
  photos.sort((a,b)=>a.id===g.coverItemId?-1:b.id===g.coverItemId?1:a.customerNumber-b.customerNumber);
  return {slug:g.slug,title:g.title,date:g.date.split("-").reverse().map(Number).join(". ")+".",price:g.priceCents/100,photos};
}
export async function getGallery(slug:string):Promise<Gallery|null> {
  let id:string|null;try{id=photoGalleryId(slug);}catch{return null;}
  if(!id)return oldGallery(slug)??null;
  const r=await readPhotoGallery(id);
  if(!r || r.gallery.status!=="published" || r.gallery.deletionPending)return null;
  return publicPhotoGallery(r.gallery);
}
export async function getPhoto(slug:string,photoId:string) {
  const gallery=await getGallery(slug);if(!gallery)return null;
  const n=gallery.photos.findIndex(p=>p.id===photoId);if(n<0)return null;
  return {gallery,photo:gallery.photos[n],previousPhoto:gallery.photos[n-1]??null,nextPhoto:gallery.photos[n+1]??null};
}
export async function allPublicPhotoGalleries() {
  const summaries=await listPhotoGalleries();
  const extra:Gallery[]=[];
  for(const s of summaries)if(s.status==="published"){const g=await getGallery(s.slug);if(g)extra.push(g);}
  const date=(g:Gallery)=>g.slug.match(/^\d{4}-\d{2}-\d{2}/)?.[0]??g.date.replace(/\.$/,"").split(".").map(s=>s.trim()).reverse().map(s=>s.padStart(2,"0")).join("-");
  return [...oldGalleries,...extra].sort((a,b)=>date(b).localeCompare(date(a)));
}
