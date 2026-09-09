import fs from 'node:fs/promises';
// Render the editable DW vector. Pass the path to an available sharp runtime
// when regenerating assets; the game build uses the committed PNGs.
const {default:sharp}=await import(process.argv[2] || 'sharp');
const svg=await fs.readFile('public/icons/dontwork.svg');
for(const [name,size]of [['icon-192',192],['icon-512',512],['maskable-512',512],['apple-touch-icon',180]]) {
 const icon=name==='maskable-512'
  ? await sharp(svg).resize(384,384).extend({top:64,bottom:64,left:64,right:64,background:'#10160f'}).png().toBuffer()
  : await sharp(svg).resize(size,size).png().toBuffer();
 for(const suffix of ['', '-v2', '-dw'])await fs.writeFile(`public/icons/${name}${suffix}.png`,icon);
}
for(const name of ['apple-touch-icon.png','apple-touch-icon-precomposed.png'])await fs.copyFile('public/icons/apple-touch-icon-dw.png','public/'+name);
