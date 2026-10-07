import { NextResponse } from "next/server";
import { readPhotoGallery } from "@/lib/photo-galleries";
import { readPhotoPreview } from "@/lib/photo-previews";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(_request:Request,context:{params:Promise<{galleryId:string;itemId:string}>}) {
  const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
  try {
    const {galleryId,itemId}=await context.params,r=await readPhotoGallery(galleryId);
    if(!r || r.gallery.status!=="published" || r.gallery.deletionPending)return new NextResponse(null,{status:404,headers});
    const media=await readPhotoPreview(galleryId,itemId,"preview");
    return new NextResponse(new Uint8Array(media.bytes),{headers:{...headers,"Content-Type":"image/jpeg"}});
  }catch{return new NextResponse(null,{status:404,headers});}
}
