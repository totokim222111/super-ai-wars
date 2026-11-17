import {describe,it,expect} from 'vitest';
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {animationArtIssues,animationSprites} from '@engine/src/v2/battle/animation-art';
import {PROP_IDS,ELEMENT_IDS} from '@engine/src/v2/battle/moves/catalog';
import {loadPack,packLookup} from '@engine/src/v2/pack/load';
import {assetPlan} from '@engine/src/v2/pack/asset-plan';
const root=resolve('pack');
describe('illustrated animation pack',()=>{
 it('registers all 176 originals in bounded pages with intact page hashes and credits',async()=>{
  const game=JSON.parse(await readFile(resolve(root,'game.json'),'utf8')),spec=JSON.parse(await readFile(resolve(root,game.animationArt),'utf8'));
  expect(animationArtIssues(spec,game.art.files)).toEqual([]);expect(Object.keys(spec.props).sort()).toEqual([...PROP_IDS].sort());expect(Object.keys(spec.elements).sort()).toEqual([...ELEMENT_IDS].sort());expect(animationSprites(spec)).toHaveLength(176);
  expect(Object.keys(spec.pages).length).toBeGreaterThan(0);let bytes=(await stat(resolve(root,game.animationArt))).size;
  for(const[id,page]of Object.entries(spec.pages)as[string,any][]){expect(page.width).toBeLessThanOrEqual(2048);expect(page.height).toBeLessThanOrEqual(2048);expect(game.art.files[id]).toBe(page.file);const data=await readFile(resolve(root,page.file));expect(createHash('sha256').update(data).digest('hex')).toBe(page.sha256);expect(data.length).toBeLessThanOrEqual(25*1024*1024);bytes+=data.length;}
  expect(bytes).toBeGreaterThan(0);expect(game.credits.some((c:any)=>c.title==='무장 연출 소품·효과')).toBe(true);
  // Packing may not silently overlap unrelated sprites, even though atlas free rectangles overlap.
  const all=animationSprites(spec);for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){const a=all[i][1],b=all[j][1];if(a.art!==b.art)continue;const[x,y,w,h]=a.rect!,[xx,yy,ww,hh]=b.rect!;expect(x+w<=xx||xx+ww<=x||y+h<=yy||yy+hh<=y).toBe(true);}
 });
 it('passes the library through the real battle lookup and preloads every shared page before stage entry',async()=>{
  const p=await loadPack(root,f=>readFile(f,'utf8'));expect(p.errors).toEqual([]);const images={},a=packLookup(p,images).battle.animationArt;expect(a).toBeDefined();expect(a?.imageIds).toHaveLength(Object.keys(p.animationArt!.pages!).length);expect(packLookup(p,images).battle.animationArt).toBe(a);
  for(const g of Object.values(assetPlan(p).stages)){expect(g.optionalImages).toHaveLength(Object.keys(p.animationArt!.pages!).length);for(const id of Object.keys(p.animationArt!.pages!))expect(g.images).toContain(p.game.art.files[id]);}
 });
});
