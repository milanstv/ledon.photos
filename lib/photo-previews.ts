import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getOriginalsBucket,getR2Client } from "@/lib/r2";
import { PhotoGalleryError,photoGalleryPrefix,requirePhotoGallery,savePhotoGallery } from "@/lib/photo-galleries";

import { acquirePhotoOperation,releasePhotoOperation } from "@/lib/photo-operations";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function photoMediaKey(galleryId:string,itemId:string,kind:"original"|"preview"|"social") {
  if(!UUID.test(itemId)) throw new PhotoGalleryError("Neplatné ID fotografie.");
  return `${photoGalleryPrefix(galleryId)}files/${itemId}/${kind}.jpg`;
}
export async function createPhotoPreviews(galleryId:string,itemId:string) {
  photoMediaKey(galleryId,itemId,"original");
  const operationId=await acquirePhotoOperation(galleryId,itemId,"preview");
  try {return await renderAndStorePhotoPreviews(galleryId,itemId,operationId);}
  finally {await releasePhotoOperation(galleryId,itemId,operationId);}
}
async function renderAndStorePhotoPreviews(galleryId:string,itemId:string,operationId:string) {
  const initial=await requirePhotoGallery(galleryId);
  if(initial.gallery.status!=="draft") throw new PhotoGalleryError("Náhľady možno vytvárať iba v koncepte.",409);
  const item=initial.gallery.items.find(i=>i.id===itemId);
  if(!item) throw new PhotoGalleryError("Fotografia sa nenašla.",404);
  const originalKey=photoMediaKey(galleryId,itemId,"original"),previewKey=photoMediaKey(galleryId,itemId,"preview"),socialKey=photoMediaKey(galleryId,itemId,"social");
  if(item.originalKey!==originalKey) throw new PhotoGalleryError("Neplatná cesta originálu.");
  const client=getR2Client(),Bucket=getOriginalsBucket();
  const response=await client.send(new GetObjectCommand({Bucket,Key:originalKey}));
  if(!response.Body || !response.ContentLength || response.ContentLength>64*1024*1024 || response.ContentLength!==item.size) throw new PhotoGalleryError("Originál má neočakávanú veľkosť.");
  const bytes=Buffer.from(await response.Body.transformToByteArray());
  if(bytes.length!==item.size) throw new PhotoGalleryError("Originál je neúplný.");
  const { renderPhotoPreviews } = await import("@/lib/photo-preview-render");
  const rendered=await renderPhotoPreviews(bytes);
  for(const [Key,Body] of [[previewKey,rendered.preview],[socialKey,rendered.social]] as const) {
    await client.send(new PutObjectCommand({Bucket,Key,Body,ContentType:"image/jpeg",CacheControl:"private, no-store"}));
  }
  for(let n=0;n<5;n++) {
    const record=await requirePhotoGallery(galleryId);
    if(record.gallery.status!=="draft") throw new PhotoGalleryError("Stav galérie sa zmenil.",409);
    const current=record.gallery.items.find(i=>i.id===itemId);
    if(!current || current.operation?.id!==operationId || current.status==="deleting" || current.status==="deleted" || current.originalKey!==originalKey) throw new PhotoGalleryError("Fotografia sa zmenila.",409);
    current.previewKey=previewKey;current.socialKey=socialKey;current.status="ready";
    record.gallery.updatedAt=new Date().toISOString();
    try {await savePhotoGallery(record.gallery,record.etag);return {ok:true};}
    catch(e){if(!(e instanceof PhotoGalleryError)||e.status!==409||n===4) throw e;}
  }
  throw new PhotoGalleryError("Galériu sa nepodarilo uložiť.",409);
}
export async function readPhotoPreview(galleryId:string,itemId:string,kind:"preview"|"social") {
  const key=photoMediaKey(galleryId,itemId,kind);
  const {gallery}=await requirePhotoGallery(galleryId);
  const item=gallery.items.find(i=>i.id===itemId);
  if(!item || item.status!=="ready" || (kind==="preview"?item.previewKey:item.socialKey)!==key) throw new PhotoGalleryError("Náhľad ešte nie je pripravený.",404);
  const response=await getR2Client().send(new GetObjectCommand({Bucket:getOriginalsBucket(),Key:key}));
  if(!response.Body || !response.ContentLength || response.ContentLength>10*1024*1024) throw new PhotoGalleryError("Náhľad sa nepodarilo načítať.",404);
  return {bytes:Buffer.from(await response.Body.transformToByteArray()),filename:item.filename};
}
