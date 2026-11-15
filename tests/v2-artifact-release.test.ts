import {engineDir} from '../tools/paths.mjs';
import {beforeAll,describe,it,expect,vi} from 'vitest';
import {readFile} from '../tools/files.mjs';
import {loadPack,type Pack} from '@engine/src/v2/pack/load';
import {terrainCanvas,terrainImages} from '@engine/src/v2/map/terrain';
import {releaseData} from '@engine/tools/release-data';
import {artifactFilesPrune} from '@engine/tools/release-public';
import {mkdtemp,mkdir,writeFile,access,rm} from '../tools/files.mjs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

let pack:Pack;
beforeAll(async()=>{pack=await loadPack('content/packs/saw',p=>readFile(p,'utf8'));});
describe('배포 자료·소품 아틀라스',()=>{
  it('Vite 배포 정리는 임의 팩의 음원 고지를 보존하고 미등록 파일만 제외한다',async()=>{const root=await mkdtemp(join(tmpdir(),'srpg-dist-')),source=await mkdtemp(join(tmpdir(),'srpg-media-'));try{await mkdir(join(source,'audio'));await writeFile(join(source,'audio/pack.json'),'{}');await writeFile(join(source,'audio/LICENSES.md'),'notice');await mkdir(join(root,'packs/fixture/audio'),{recursive:true});await writeFile(join(root,'packs/fixture/audio/unused.txt'),'unused');await artifactFilesPrune(root,new Set(),[{id:'fixture',root:'content/packs/fixture',dir:source,game:{art:{files:{}},audio:{base:'audio/',pack:'audio/pack.json'}}}]);for(const name of ['LICENSE','THIRD_PARTY_NOTICES.md'])expect(await readFile(join(root,name),'utf8')).toBe(await readFile(name,'utf8'));expect(await readFile(join(root,'packs/fixture/audio/LICENSES.md'),'utf8')).toBe('notice');await expect(access(join(root,'packs/fixture/audio/unused.txt'))).rejects.toThrow();}finally{await rm(root,{recursive:true,force:true});await rm(source,{recursive:true,force:true});}});
  it('여섯 무대 소품 66장은 아틀라스 6장만 등록하고 구형 바닥은 제외한다',()=>{
    expect(pack.errors).toEqual([]);expect(pack.warnings).toEqual([]);
    for(const [id,theme]of Object.entries(pack.maps!)){
      const a=theme.propsAtlas!;expect(a).toBeDefined();expect(Object.keys(a.rects)).toHaveLength(11);expect(pack.game.art.files[a.art]).toContain('/props.webp');
      expect(pack.game.art.files['map-'+id+'-ground']).toBeUndefined();
      for(const tile of Object.values(theme.tiles))for(const prop of tile.props??[]){expect(a.rects[prop]).toHaveLength(4);expect(pack.game.art.files[prop]).toBeUndefined();}
    }
  });
  it('아틀라스는 한 번만 미리 받고 지정한 소품 칸만 그린다',()=>{
    const image={naturalWidth:1024,naturalHeight:768}as HTMLImageElement,theme=pack.maps!.museum;
    const images={[theme.propsAtlas!.art]:image},terrain={tiles:[['saw-cache']],theme,images};
    expect(terrainImages(terrain).filter(i=>i===image)).toHaveLength(1);
    const draw=vi.fn(),ctx=new Proxy({drawImage:draw},{get:(t,k)=>k in t?t[k as keyof typeof t]:(()=>undefined)})as unknown as CanvasRenderingContext2D;
    terrainCanvas(terrain,80,(w,h)=>({width:w,height:h,getContext:()=>ctx})as unknown as OffscreenCanvas);
    expect(draw).toHaveBeenCalledWith(image,...theme.propsAtlas!.rects['map-museum-cache'],2,4,76,76);
  });
  it('아틀라스 밖 좌표는 팩 오류이며 단색 경고로 숨기지 않는다',async()=>{
    const bad=await loadPack('content/packs/saw',async p=>{const text=await readFile(p,'utf8');if(p.endsWith('/maps/museum.json')){const t=JSON.parse(text);t.propsAtlas.rects['map-museum-cache']=[1000,0,256,256];return JSON.stringify(t);}return text;});
    expect(bad.errors.some(e=>e.message==='소품 아틀라스 좌표 오류: map-museum-cache')).toBe(true);
  });
  it('구형 이미지 id는 새 원본의 별칭으로 남아 옛 예시와 호환된다',()=>{
    for(const [a,b]of [['icon-omni-luna','mech-gpi-generation-1'],['mech-spam-bot-sd','mech-spam-bot'],['spam-portrait','portrait-spam-bot']])expect(pack.game.art.files[a]).toBe(pack.game.art.files[b]);
  });
  it('JSON 정적 import와 packText는 하나의 묶음·요청 캐시를 공유한다',async()=>{
    const plugin=releaseData(),hooks=plugin as unknown as {configResolved:(c:unknown)=>void;buildStart:(this:unknown)=>Promise<void>;resolveId:(this:unknown,s:string,i:string,o:unknown)=>Promise<string>;load:(id:string)=>string};
    const emitted:{name:string;source:string}[]=[],context={addWatchFile:()=>{},emitFile:(f:{name:string;source:string})=>{emitted.push(f);return String(emitted.length);},resolve:async()=>({id:engineDir.replaceAll('\\','/')+'/content/packs/saw/cast.json'})};
    hooks.configResolved({command:'build'});await hooks.buildStart.call(context);
    expect(emitted).toHaveLength(5+new Set([...pack.game.episodes.map(e=>e.story.split('/').at(-1)),...pack.examples!.map(e=>e.story.split('/').at(-1))]).size);expect(emitted.some(e=>['data-stage-outlines.json','data-rules.json'].includes(e.name))).toBe(false);expect(emitted.every(e=>!e.source.includes('content/archive/'))).toBe(true);expect(emitted.some(e=>e.name==='data-audio.json')).toBe(false);expect(JSON.parse(emitted.find(e=>e.name==='data-asset-index-saw.json')!.source)['content/packs/saw/assets.json'].stages.ep01.files.length).toBeGreaterThan(20);
    const json=await hooks.resolveId.call(context,'../../../content/packs/saw/cast.json','src/v2/gallery/sample.ts',{});
    expect(hooks.load(json)).toContain('await readData("content/packs/saw/cast.json")');
    const data=JSON.parse(emitted.find(e=>e.name==='data-pack.json')!.source);expect(data['content/packs/saw/cast.json']).toEqual(pack.cast);
    const files=await readFile('src/v2/pack/files.ts','utf8');expect(files).not.toContain('import.meta.glob');expect(files).toContain("from 'virtual:release-data'");
  });
});
