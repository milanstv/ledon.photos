import {NextRequest,NextResponse} from "next/server";
import {PhotoGalleryError} from "@/lib/photo-galleries";
import {readPhotoPreview} from "@/lib/photo-previews";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest,context:{params:Promise<{galleryId:string;itemId:string}>}) {
  const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"};
  try {
    const {galleryId,itemId}=await context.params;
    const kind=request.nextUrl.searchParams.get("kind")==="social"?"social":"preview";
    const media=await readPhotoPreview(galleryId,itemId,kind);
    return new NextResponse(new Uint8Array(media.bytes),{headers:{...headers,"Content-Type":"image/jpeg",...(kind==="social"?{"Content-Disposition":`attachment; filename="social-${media.filename.replace(/[^a-zA-Z0-9_.-]/g,"-")}"`}:{})}});
  }catch(e){return NextResponse.json({error:e instanceof PhotoGalleryError?e.message:"Náhľad sa nepodarilo načítať."},{status:e instanceof PhotoGalleryError?e.status:500,headers});}
}
