import { randomUUID } from "node:crypto";
import { PhotoGalleryError,requirePhotoGallery,savePhotoGallery } from "@/lib/photo-galleries";
export async function acquirePhotoOperation(galleryId:string,itemId:string,kind:"preview"|"delete") {
  const operationId=randomUUID();
  for(let n=0;n<5;n++) {
    const record=await requirePhotoGallery(galleryId);
    if(record.gallery.status!=="draft") throw new PhotoGalleryError("Operácia je povolená iba v koncepte.",409);
    const item=record.gallery.items.find(i=>i.id===itemId);
    if(!item || item.status==="deleted") throw new PhotoGalleryError("Fotografia sa nenašla.",404);
    if(item.operation) throw new PhotoGalleryError("Fotografia sa práve spracúva. Po dokončení skús znova. Ak bola operácia prerušená, treba najprv skontrolovať jej stav.",409);
    if(kind==="preview" && item.status==="deleting") throw new PhotoGalleryError("Fotografia čaká na dokončenie mazania.",409);
    item.operation={id:operationId,kind,startedAt:new Date().toISOString()};
    if(kind==="delete") {item.status="deleting";if(record.gallery.coverItemId===itemId)record.gallery.coverItemId=null;}
    record.gallery.updatedAt=new Date().toISOString();
    try {await savePhotoGallery(record.gallery,record.etag);return operationId;}
    catch(e){if(!(e instanceof PhotoGalleryError)||e.status!==409||n===4)throw e;}
  }
  throw new PhotoGalleryError("Fotografiu sa nepodarilo zamknúť.",409);
}
export async function releasePhotoOperation(galleryId:string,itemId:string,operationId:string) {
  for(let n=0;n<5;n++) {
    const record=await requirePhotoGallery(galleryId);
    const item=record.gallery.items.find(i=>i.id===itemId);
    if(!item || item.operation?.id!==operationId)return;
    delete item.operation;record.gallery.updatedAt=new Date().toISOString();
    try{await savePhotoGallery(record.gallery,record.etag);return;}
    catch(e){if(!(e instanceof PhotoGalleryError)||e.status!==409||n===4)throw e;}
  }
}
