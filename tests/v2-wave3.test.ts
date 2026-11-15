import {readFile,stat} from '../tools/files.mjs';
import {beforeAll,describe,it,expect} from 'vitest';
import {loadPack,packLookup,packUnit,packActors,type Pack} from '@engine/src/v2/pack/load';
import {castPortrait} from '@engine/src/v2/pack/load';
let pack:Pack;
type Bindings={units:Record<string,string[]>;cast:Record<string,string>;recolor:Record<string,{from:string;hue:number;sat:number;light:number}>};
let bindings:Bindings;
beforeAll(async()=>{pack=await loadPack('content/packs/saw',p=>readFile(p,'utf8'));bindings=JSON.parse(await readFile('art-src/wave3/bindings.json','utf8'));});
describe('물결3 적 세력 그림 연결',()=>{
  it('uses the same height table for every registered unit, including earlier waves',()=>{const heights={SS:280,S:305,M:335,L:420,LL:540};for(const m of pack.rules.mechs){const u=pack.units[m.id];if(u?.art)expect(u.height,m.id).toBe(heights[m.size]);}});
  it('47장 기체가 같은 기체의 모든 에피소드 75개 항목에 연결된다',async()=>{
    expect(pack.errors).toEqual([]);expect(Object.keys(bindings.units)).toHaveLength(47);expect(Object.values(bindings.units).flat()).toHaveLength(75);
    for(const [base,ids]of Object.entries(bindings.units)){
      const expected=pack.rules.mechs.filter(m=>m.id.startsWith(base+'-episode-')).map(m=>m.id);
      expect(ids).toEqual(expected);
      for(const id of ids){const u=pack.units[id];expect(u.art).toBe('mech-'+base);expect(u.icon).toBeUndefined();expect(u.temporary).toBeUndefined();expect(u.height).toBe(({SS:280,S:305,M:335,L:420,LL:540})[pack.rules.mechs.find(m=>m.id===id)!.size]);expect(Object.keys(u.anchors!)).toHaveLength(5);for(const point of Object.values(u.anchors!))expect(point.every(x=>x>=0&&x<=1)).toBe(true);}
      expect((await stat('public'+pack.game.art.files['mech-'+base])).size).toBeGreaterThan(0);
    }
  });
  it('46종 자코의 두 칸 묶음과 대본/전투 인물 id를 공유한다',async()=>{
    expect(Object.keys(bindings.cast)).toHaveLength(46);
    expect(bindings.cast['spam-bot']).toBe('spam');expect(bindings.cast['shrimp-jesus']).toBe('saw-shrimp');expect(bindings.cast.inpainting).toBe('saw-inpainting');
    for(const [base,id]of Object.entries(bindings.cast)){
      const c=pack.cast[id];expect(c.bust).toBe('portrait-'+base);expect(c.moodSheet).toEqual({art:'portrait-'+base+'-moods',cols:2,rows:1,rect:[0,0,1,1],order:['default','hit']});expect(c.moods.default).toBeUndefined();expect(c.moods.hit).toBeUndefined();expect(c.temporary).toBeUndefined();
      for(const art of [c.bust!,c.moodSheet!.art])expect((await stat('public'+pack.game.art.files[art])).size).toBeGreaterThan(0);
      for(const uid of bindings.units[base])expect(pack.units[uid].pilotCast).toBe(id);
    }
    expect(pack.units['deepseek-housing-episode-6'].pilotCast).toBe('deepseek');
  });
  it('공용 unmanned 파일럿도 기체별 기본/피격 초상을 맵·전투·Director에 넘긴다',()=>{
    for(const [base,id]of Object.entries(bindings.cast)){
      const c=pack.cast[id],basic={id:base} as unknown as HTMLImageElement,sheet={id:base+'-moods'} as unknown as HTMLImageElement,images={[c.bust!]:basic,[c.moodSheet!.art]:sheet};
      const lookup=packLookup(pack,images),u={mechId:bindings.units[base][0],side:'enemy'} as never,p=lookup.battle.pilot({id:'unmanned'} as never,u).portrait;
      expect(p).toEqual(castPortrait(c,images));expect(lookup.battle.pilot({id:'unmanned'} as never,u).pilot).toBe(c.name);expect(p.faces.default).toBe(basic);expect(p.moodSheet?.image).toBe(sheet);expect(packActors(pack,images)[id].moodSheet?.image).toBe(sheet);
    }
  });
  it('LL 맵 말은 원본 안의 머리/상체 영역을 쓰고 전투 키는 540이다',()=>{
    for(const ids of Object.values(bindings.units))for(const id of ids){const u=pack.units[id];if(u.height!==540)continue;expect(u.iconCrop).toHaveLength(4);const [x,y,w,h]=u.iconCrop!;expect(x+w).toBeLessThanOrEqual(1);expect(y+h).toBeLessThanOrEqual(1);const image={} as HTMLImageElement,lookup=packLookup(pack,{[u.art!]:image});expect(lookup.unit({id} as never,{side:'enemy'} as never)).toEqual({icon:image,iconFit:true,iconCrop:u.iconCrop});}
  });
  it('파생 라마 두 포크는 다른 색이지만 형태·기준점을 공유한다',()=>{
    expect(Object.keys(bindings.recolor)).toHaveLength(2);const colors=Object.values(bindings.recolor);expect(colors[0].hue).not.toBe(colors[1].hue);
    for(const [id,tint]of Object.entries(bindings.recolor)){const u=pack.units[id];expect(u.recolor).toEqual(tint);expect(tint.from).toBe('mech-derived-llama');expect(packUnit(pack,id,'enemy').art).toBe('@recolor:'+id);expect(u.anchors).toEqual(pack.units['derived-llama-episode-5'].anchors);}
  });
  it('시험 안내를 전투 대사로 만들지 않고 원래 인물 대사는 유지한다',async()=>{
    expect(packLookup(pack,{}).battle.lines).toBeUndefined();
    const source=await readFile('content/packs/saw/gallery.json','utf8');expect(source).toContain('서론은 생략합니다.');expect(source).not.toContain('전투 수치는 실제 규칙입니다.');
  });
});
