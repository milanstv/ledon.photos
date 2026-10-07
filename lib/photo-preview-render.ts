import sharp from "sharp";
import { readFile } from "node:fs/promises";
import path from "node:path";
async function logo(name: string, width: number, height: number, opacity: number) {
  const source = await readFile(path.join(process.cwd(), "public/images", name));
  const { data, info } = await sharp(source).resize({ width: Math.max(1,width), height: Math.max(1,height), fit: "inside", withoutEnlargement: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i=3;i<data.length;i+=4) data[i]=Math.round(data[i]*opacity);
  return { input: await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer(), width:info.width,height:info.height };
}
export async function renderPhotoPreviews(original: Buffer) {
  const {data,info}=await sharp(original,{limitInputPixels:100000000,failOn:"error"}).rotate().resize({width:2000,height:2000,fit:"inside",withoutEnlargement:true}).toBuffer({resolveWithObject:true});
  const w=info.width,h=info.height,margin=Math.min(Math.round(w*.025),Math.floor((Math.min(w,h)-1)/2));
  const center=await logo("LD-center.png",Math.round(w*.78),h,.30);
  const corner=await logo("LEDON-logo-white-transparent.png",Math.round(w*.08),h-2*margin,1);
  const overlay={input:corner.input,left:Math.max(0,w-corner.width-margin),top:Math.max(0,h-corner.height-margin)};
  const preview=await sharp(data).composite([{input:center.input,gravity:"center"},overlay]).jpeg({quality:82,mozjpeg:true}).toBuffer();
  const socialCenter=await logo("LD-center.png",Math.round(w*.78),h,.15);
  const social=await sharp(data).composite([{input:socialCenter.input,gravity:"center"},overlay]).jpeg({quality:90,mozjpeg:true}).toBuffer();
  return {preview,social,width:w,height:h};
}
