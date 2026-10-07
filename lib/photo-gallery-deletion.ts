import { AbortMultipartUploadCommand,DeleteObjectsCommand,ListMultipartUploadsCommand,ListObjectsV2Command,DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client,getOriginalsBucket } from "@/lib/r2";
import { PhotoGalleryError,photoGalleryPrefix,readPhotoGallery,requirePhotoGallery,savePhotoGallery } from "@/lib/photo-galleries";
// Each request removes one bounded batch; metadata remains until cleanup is verified.
export async function deletePhotoGallery(id:string,title:unknown) {
  const Prefix=photoGalleryPrefix(id),Bucket=getOriginalsBucket(),client=getR2Client();
  const first=await readPhotoGallery(id);
  if(!first) return {ok:true,done:true};
  if(title!==first.gallery.title)throw new PhotoGalleryError("Pre potvrdenie napíš presný názov galérie.");
  let claimed=false;
  for(let n=0;n<5;n++) {
    const r=await requirePhotoGallery(id);
    if(title!==r.gallery.title)throw new PhotoGalleryError("Názov galérie sa zmenil.",409);
    if(r.gallery.deletionPending){claimed=true;break;}
    if(r.gallery.status!=="draft")throw new PhotoGalleryError("Úplné mazanie je zatiaľ povolené iba pre koncept.",409);
    if(r.gallery.activeUploads?.length || r.gallery.items.some(i=>i.operation))throw new PhotoGalleryError("Prebieha nahrávanie alebo spracovanie. Počkaj na dokončenie. Pri prerušenom spracovaní treba skontrolovať stav.",409);
    r.gallery.status="archived";r.gallery.deletionPending=true;r.gallery.updatedAt=new Date().toISOString();
    try{await savePhotoGallery(r.gallery,r.etag);claimed=true;break;}catch(e){if(!(e instanceof PhotoGalleryError)||e.status!==409||n===4)throw e;}
  }
  if(!claimed)throw new PhotoGalleryError("Galériu sa nepodarilo zamknúť.",409);
  const uploads=await client.send(new ListMultipartUploadsCommand({Bucket,Prefix,MaxUploads:100}));
  for(const u of uploads.Uploads??[]) {
    if(!u.Key?.startsWith(Prefix)||!u.UploadId)throw new Error("Neplatná cesta nahrávania.");
    try{await client.send(new AbortMultipartUploadCommand({Bucket,Key:u.Key,UploadId:u.UploadId}));}
    catch(e){if((e as {name?:string}).name!=="NoSuchUpload")throw e;}
  }
  if(uploads.Uploads?.length || uploads.IsTruncated)return {ok:true,done:false};
  const metadata=Prefix+"gallery.json";
  const page=await client.send(new ListObjectsV2Command({Bucket,Prefix,MaxKeys:101}));
  const objects=(page.Contents??[]).filter(o=>o.Key!==metadata);
  if(objects.length) {
    const Keys=objects.map(o=>{if(!o.Key?.startsWith(Prefix))throw new Error("Neplatná cesta súboru.");return {Key:o.Key};});
    const result=await client.send(new DeleteObjectsCommand({Bucket,Delete:{Objects:Keys,Quiet:true}}));
    if(result.Errors?.length)throw new Error("R2 nevymazalo všetky súbory. Zopakuj dokončenie mazania.");
    return {ok:true,done:false};
  }
  if(page.IsTruncated)throw new Error("Neúplný zoznam súborov.");
  await client.send(new DeleteObjectCommand({Bucket,Key:metadata}));
  return {ok:true,done:true};
}
