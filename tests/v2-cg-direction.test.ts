import {beforeAll,describe,it,expect,vi} from 'vitest';
import {readFile} from '../tools/files.mjs';
import {loadPack,type Pack} from '@engine/src/v2/pack/load';
import {Director,Taps,type Cue,type CgTone} from '@engine/src/v2/director';
import {Stage} from '@engine/src/v2/stage';
import {Runner} from '@engine/src/v2/flow';
import {parseStory} from '@engine/src/v2/story/parse';
let pack:Pack;
beforeAll(async()=>{pack=await loadPack('content/packs/saw',p=>readFile(p,'utf8'));});
const image={naturalWidth:1600,naturalHeight:900}as HTMLImageElement;
function play(cue:Extract<Cue,{do:'cg'}>){
 const stage=new Stage(),runner=new Runner(),taps=new Taps(),sound={play:vi.fn()};
 const director=new Director({stage,runner,sound:sound as never},{},{[cue.image]:image},taps);
 runner.run(director.perform(cue));
 const step=(n=1)=>{for(let i=0;i<n;i++)runner.update(1/60);};
 return {stage,runner,taps,sound,step};
}
function drawn(stage:Stage){
 const texts:string[]=[];const ctx=new Proxy({fillText:(s:string)=>texts.push(s),strokeText:()=>{},measureText:(s:string)=>({width:s.length*18}),createLinearGradient:()=>({addColorStop:()=>{}})}, {get:(t,k)=>k in t?t[k as keyof typeof t]:(()=>{})})as unknown as CanvasRenderingContext2D;
 stage.ui.nodes.forEach(n=>n.draw(ctx));return texts;
}
describe('삽화의 제목·톤 계약',()=>{
 it('실제 29곳 모두 위시리스트 제목만 카드에 쓰고 설명문은 그리지 않는다',async()=>{
  const wishlist=await readFile('docs/v2-cg-wishlist.md','utf8');const titles=[...wishlist.matchAll(/\*\*(.+?)\*\*/g)].map(m=>m[1]);
  const cues=Object.values(pack.stories).flatMap(s=>Object.values(s.scenes).flat()).filter((c):c is Extract<Cue,{do:'cg'}>=>c.do==='cg');expect(cues).toHaveLength(29);
  const counts:Record<string,number>={};
  for(const c of cues){
   expect(c.description).toBeTruthy();expect(c.sub).toBe(c.image==='cg-gpi-entrance'?'지피짱 등장':titles.find(t=>t===c.sub));expect(c.sub).not.toBe(c.description);
   const p=play(c);p.step(180);const text=drawn(p.stage);expect(text).toContain(c.name);expect(text).toContain(c.sub);expect(text).not.toContain(c.description);counts[c.tone!]=(counts[c.tone!]??0)+1;
  }
  expect(counts).toEqual({'강림':11,'개그':4,'섬뜩':2,'감성':12});
 });
 it.each(['강림','개그','섬뜩','감성']as CgTone[])('%s은 다른 효과·음향을 쓰고 닫은 뒤 노드를 남기지 않는다',tone=>{
  const p=play({do:'cg',image:'cg',name:'이름',sub:'제목',tone,description:'절대 표시하지 않을 장면 설명'});
  p.step(12);const shaking=p.stage.camera.shake;
  p.step(180);const calls=p.sound.play.mock.calls.map(c=>c[0]);
  if(tone==='강림'){expect(calls).toEqual(['heavy','slash']);expect(p.stage.ui.nodes.length).toBeGreaterThan(1);}
  else{
   expect(calls).toEqual(tone==='개그'?['confirm']:tone==='섬뜩'?['cg-cold']:[]);
   expect(p.stage.fx.nodes).toHaveLength(0);expect(p.stage.ui.nodes.some(n=>(n as unknown as {state?:{imageId?:string}}).state?.imageId==='cg')).toBe(true);
   if(tone==='개그')expect(shaking).toBeLessThanOrEqual(1.5);else expect(shaking).toBe(0);
  }
  expect(drawn(p.stage)).not.toContain('절대 표시하지 않을 장면 설명');p.taps.press();p.step(120);expect(p.stage.fx.nodes).toHaveLength(0);expect(p.stage.ui.nodes).toHaveLength(0);
 });
 it('설명은 별도 데이터로 읽고 알 수 없는 톤은 오류로 보고한다',()=>{
  const s=parseStory('# 검사\n@ 시작\n[삽화] cg | 이름 | 제목 | 감성 | 보관할 설명');expect(s.issues).toEqual([]);expect(s.scenes.시작[0]).toMatchObject({sub:'제목',tone:'감성',description:'보관할 설명'});
  expect(parseStory('# 검사\n@ 시작\n[삽화] cg | 이름 | 제목 | 오타').issues[0].message).toContain('삽화 톤 오류');
 });
 it('8화는 밤 정원을 쓰고 낮 정원도 등록 상태로 남긴다',()=>{
  expect(pack.stories.ep08.scenes.인터미션).toContainEqual({do:'bg',image:'bg-rooftop-garden-night'});expect(pack.game.art.files['bg-rooftop-garden']).toBeDefined();expect(pack.game.art.files['bg-rooftop-garden-night']).toBeDefined();
 });
});
