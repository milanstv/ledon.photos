import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client,getOriginalsBucket } from "@/lib/r2";
import { PhotoGalleryError,photoGalleryPrefix,requirePhotoGallery,savePhotoGallery } from "@/lib/photo-galleries";
import { photoMediaKey } from "@/lib/photo-previews";
import { acquirePhotoOperation,releasePhotoOperation } from "@/lib/photo-operations";
export async function deletePhoto(galleryId:string,itemId:string) {
  const keys=[photoMediaKey(galleryId,itemId,"original"),photoMediaKey(galleryId,itemId,"preview"),photoMediaKey(galleryId,itemId,"social"),`${photoGalleryPrefix(galleryId)}uploads/${itemId}.json`];
  const initial=await requirePhotoGallery(galleryId);
  if(initial.gallery.status!=="draft")throw new PhotoGalleryError("Mazanie je povolené iba v koncepte.",409);
  const original=initial.gallery.items.find(i=>i.id===itemId);
  if(!original)throw new PhotoGalleryError("Fotografia sa nenašla.",404);
  if(original.originalKey!==keys[0] || (original.previewKey && original.previewKey!==keys[1]) || (original.socialKey && original.socialKey!==keys[2]))throw new PhotoGalleryError("Neočekávaná cesta súborov. Mazanie sa nespustilo.");
  if(original.status==="deleted")return {ok:true};
  const operationId=await acquirePhotoOperation(galleryId,itemId,"delete");
  try {
    for(const Key of keys)await getR2Client().send(new DeleteObjectCommand({Bucket:getOriginalsBucket(),Key}));
    for(let n=0;n<5;n++) {
      const record=await requirePhotoGallery(galleryId);
      const item=record.gallery.items.find(i=>i.id===itemId);
      if(!item || item.operation?.id!==operationId)throw new PhotoGalleryError("Stav mazania sa zmenil.",409);
      item.status="deleted";item.previewKey=null;item.socialKey=null;
      if(record.gallery.coverItemId===itemId)record.gallery.coverItemId=null;
      record.gallery.updatedAt=new Date().toISOString();
      try{await savePhotoGallery(record.gallery,record.etag);return {ok:true};}
      catch(e){if(!(e instanceof PhotoGalleryError)||e.status!==409||n===4)throw e;}
    }
    throw new PhotoGalleryError("Mazanie sa nepodarilo dokončiť.",409);
  } finally {await releasePhotoOperation(galleryId,itemId,operationId);}
}
