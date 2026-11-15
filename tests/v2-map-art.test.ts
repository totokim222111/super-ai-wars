import {describe,it,expect} from 'vitest';
import {execFileSync} from 'node:child_process';
import {readFile} from '../tools/files.mjs';
import {buildingPlan,terrainDemoTiles,terrainCanvas,terrainImages,type MapTerrain} from '@engine/src/v2/map/terrain';
import {loadPack,packLookup} from '@engine/src/v2/pack/load';
import {parseStory} from '@engine/src/v2/story/parse';
import {compileStage} from '@engine/src/v2/story/stage';
import {createBattle} from '@engine/src/core';
import {themePreviewPack} from '@engine/src/v2/gallery/stage-preview';
import {CoreMap} from '@engine/src/v2/adapter/map';

describe('맵 그림과 건물 계약',()=>{
  it('불규칙한 벽 덩어리를 겹침·누락·통로 침범 없이 결정적으로 나눈다',()=>{
    const tiles=terrainDemoTiles({'.':'saw-plain','#':'saw-wall','=':'saw-road','~':'saw-water',C:'saw-cache','^':'saw-cover'}),pieces=buildingPlan(tiles,'saw-wall'),covered=new Set<string>();
    for(const p of pieces)for(let y=p.y;y<p.y+p.h;y++)for(let x=p.x;x<p.x+p.w;x++){
      expect(tiles[y][x]).toBe('saw-wall');expect(covered.has(`${x},${y}`)).toBe(false);covered.add(`${x},${y}`);
    }
    expect(covered.size).toBe(tiles.flat().filter(t=>t==='saw-wall').length);expect(buildingPlan(tiles,'saw-wall')).toEqual(pieces);
    expect(new Set(pieces.map(p=>`${p.w}x${p.h}`))).toEqual(new Set(['1x1','2x1','2x2','3x2']));
    expect(buildingPlan([['saw-water','saw-plain']])).toEqual([]);
  });
  it('L자와 안쪽 구멍의 통행 칸은 건물로 채우지 않는다',()=>{
    const w='saw-wall',p='saw-plain',tiles=[[w,w,w],[w,p,w],[w,w,w]];
    expect(buildingPlan(tiles,'saw-wall').reduce((n,p)=>n+p.w*p.h,0)).toBe(8);
  });
  it('덧칠 그림만 미리 받고 정확한 판 크기로 한 번 굽는다',()=>{
    const image={naturalWidth:1440,naturalHeight:960}as HTMLImageElement,calls:unknown[][]=[];
    const ctx={drawImage:(...args:unknown[])=>calls.push(args)};
    const terrain:MapTerrain={tiles:[['saw-plain','saw-cache']],theme:{ground:'ground',color:'#123',tiles:{}},images:{paint:image},painted:'paint'};
    expect(terrainImages(terrain)).toEqual([image]);
    const canvas=terrainCanvas(terrain,80,(w,h)=>({width:w,height:h,getContext:()=>ctx})as unknown as HTMLCanvasElement);
    expect(calls).toEqual([[image,0,0,160,80]]);expect(canvas?.width).toBe(160);
  });
  it('그림 줄은 코어 stage/program을 바꾸지 않고 조회에만 남는다',async()=>{
    const pack=await loadPack('content/packs/saw',async p=>{const text=await readFile(p,'utf8');return p.endsWith('ep01.story')?text.replace('@ 맵','맵 그림: map-datacenter-ep01\n\n@ 맵'):text;});expect(pack.errors).toEqual([]);
    const c=pack.stageScripts!['saw-01'],story=pack.stories.ep01;
    const noArt={...story.stage!,rules:story.stage!.rules.filter(r=>!r.text.startsWith('맵 그림:'))};
    const other=compileStage(noArt,{id:c.stage.id,name:c.stage.name??'제1화',content:pack.rules,roster:[],scenes:story.scenes,cast:pack.cast,units:pack.units},story.file);
    expect(other.issues).toEqual([]);const plain=await loadPack('content/packs/saw',async p=>{const t=await readFile(p,'utf8');return p.endsWith('ep01.story')?t.replace(/^맵 그림:.*\n/gm,''):t;});expect(plain.stageScripts!['saw-01'].stage).toEqual(c.stage);expect(other.program).toEqual(c.program);expect(c.mapArt).toBe('map-datacenter-ep01');
    const state=createBattle(pack.rules,c.stage,7),lookup=packLookup(pack,{});expect(lookup.terrainFor!(state)?.painted).toBe(c.mapArt);
    const artwork={naturalWidth:1440,naturalHeight:960}as HTMLImageElement,fallback={naturalWidth:1600,naturalHeight:900}as HTMLImageElement;
    const rendered=new CoreMap(state,packLookup(pack,{[c.mapArt!]:artwork,[pack.game.fallbacks.terrain]:fallback}));
    expect(rendered.images()).toContain(artwork);expect(rendered.images()).not.toContain(fallback);
    const preview=themePreviewPack(pack,'museum');expect(preview.stageScripts!['terrain-museum'].mapArt).toBeUndefined();expect(preview.errors).toEqual([]);
  });
  it('없는 맵 그림 id를 줄 번호와 수정 안내로 거부한다',async()=>{
    const file='content/packs/saw/story/ep01.story';const pack=await loadPack('content/packs/saw',async p=>{const text=await readFile(p,'utf8');return p===file?text.replace('@ 맵','맵 그림: missing-paint\n\n@ 맵'):text;});
    const error=pack.errors.find(e=>e.message.includes('없는 맵 그림'));expect(error?.file).toBe(file);expect(error?.line).toBeGreaterThan(1);expect(error?.fix).toContain('art.files');
    expect(parseStory('@ 규칙\n맵 그림: good-map\n@ 맵\n.\n').issues).toEqual([]);
  });
  it('정렬 검사에서 물/벽을 지운 그림과 통로의 물을 검출한다',()=>{
    expect(execFileSync('python',['-I','-X','utf8','tools/map_paint.py','self-test'],{encoding:'utf8'})).toContain('PASS');
  });
});
