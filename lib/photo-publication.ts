import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { PhotoGalleryError,requirePhotoGallery,savePhotoGallery } from "@/lib/photo-galleries";
import { photoMediaKey } from "@/lib/photo-previews";
import { getR2Client,getOriginalsBucket } from "@/lib/r2";
export async function publishPhotoGallery(id:string) {
  const r=await requirePhotoGallery(id),g=r.gallery;
  if(g.status==="published")return {ok:true};
  if(g.status!=="draft" || g.deletionPending)throw new PhotoGalleryError("Publikovať možno iba koncept.",409);
  if(g.activeUploads?.length || g.items.some(i=>i.operation || i.status==="deleting"))throw new PhotoGalleryError("Najprv dokonči nahrávanie, náhľady a mazanie.",409);
  const items=g.items.filter(i=>i.status!=="deleted");
  if(!items.length || items.some(i=>i.status!=="ready"))throw new PhotoGalleryError("Všetky fotografie musia mať pripravené náhľady.",409);
  if(![200,400,500].includes(g.priceCents))throw new PhotoGalleryError("Existujúci predaj fotografií podporuje cenu 2 €, 4 € alebo 5 €.",409);
  const cover=items.find(i=>i.id===g.coverItemId);if(!cover)throw new PhotoGalleryError("Najprv vyber titulnú fotografiu.");
  for(const i of items)if(i.originalKey!==photoMediaKey(id,i.id,"original") || i.previewKey!==photoMediaKey(id,i.id,"preview") || i.socialKey!==photoMediaKey(id,i.id,"social"))throw new PhotoGalleryError("Neplatné cesty fotografie.");
  // Ready metadata is written only after both previews. Verify the cover is available.
  for(const Key of [cover.originalKey,cover.previewKey!])await getR2Client().send(new HeadObjectCommand({Bucket:getOriginalsBucket(),Key}));
  g.status="published";g.updatedAt=new Date().toISOString();await savePhotoGallery(g,r.etag);
  return {ok:true};
}
export async function hidePhotoGallery(id:string) {
  const r=await requirePhotoGallery(id);
  if(r.gallery.status!=="published")throw new PhotoGalleryError("Skryť možno iba publikovanú galériu.",409);
  r.gallery.status="archived";r.gallery.updatedAt=new Date().toISOString();await savePhotoGallery(r.gallery,r.etag);return {ok:true};
}
