import {memoryStoryState} from './pack-fixture';
import {beforeAll,describe,expect,it} from 'vitest';
import {readFile} from '../tools/files.mjs';
import {loadPack,packLookup,type Pack} from '@engine/src/v2/pack/load';
import {storyChoices,storyText,testCondition,type StoryState} from '@engine/src/v2/story/play';
import type {Cue} from '@engine/src/v2/director';
import type {Story} from '@engine/src/v2/story/parse';
import {CoreCampaign} from '@engine/src/v2/adapter/campaign';
import {TrainingSaves} from '@engine/src/v2/adapter/saves';
import {StoryEvents} from '@engine/src/v2/story/events';
import {MemoryStore,MenuApp} from './v2-campaign-fixtures';
import {GameFlow} from '@engine/src/v2/game/flow';
import {CreditsScreen} from '@engine/src/v2/menus/credits';
import {TitleScreen} from '@engine/src/v2/menus/screens';
import type {App} from '@engine/src/v2/screen';
import {apply} from '@engine/src/core';
import {applyRules,ruleCommand,runtime,storeRuntime} from '@engine/src/v2/rules/runtime';
import {configOf} from '@engine/src/v2/rules/config';
import {MapScreen} from '@engine/src/v2/map/screen';
import {ResultScreen} from '@engine/src/v2/menus/result';
import {CoreMap} from '@engine/src/v2/adapter/map';
let pack:Pack;
beforeAll(async()=>{pack=await loadPack('content/packs/saw',p=>readFile(p,'utf8'));expect(pack.errors).toEqual([]);});
const agents=[['gpi','지피',''],['gem','젬',''],['claude','클로드',''],['grok','그록',''],['deepseek','딥시크',''],['sonnet','소네트','소네트합류'],['exaone','엑사원','엑사원합류조건'],['qwen','퀜','퀜내기성공']];
function state(){return {...memoryStoryState(),playerName:()=> '테스터'};}
function walk(story:Story,s:StoryState,scene:string,choice=0){
 const visited:string[]=[],said:string[]=[],maps:Extract<Cue,{do:'map'}>[]=[];
 const effect=(c:Cue)=>{if(c.do==='variable')s.set(c.name,c.value);if(c.do==='affection')s.affection(c.who,c.amount);if(c.do==='map')maps.push(c);};
 for(let n=0;n<100;n++){
  visited.push(scene);let next:string|undefined;
  for(let c of story.scenes[scene]??[]){if(c.do==='typed'){if(c.type!==s.type())continue;c=c.cue;}if(c.do==='end')return {visited,said,maps};if(c.do==='say')said.push(storyText(c.text,s));
   if(c.do==='jump')next=c.scene;if(c.do==='condition'&&testCondition(c.test,s))next=c.scene;
   if(c.do==='choice'){const ch=storyChoices(c.choices,s)[choice];ch.effects.forEach(effect);next=ch.target;}
   effect(c);if(next)break;
  }
  if(!next)return {visited,said,maps};scene=next;
 }
 throw Error('분기 루프');
}
function model(){const bytes=new MemoryStore(),lookup=packLookup(pack,{}),saves=new TrainingSaves(bytes,pack.campaign,pack.rules,pack.training),model=new CoreCampaign(pack.campaign,pack.rules,saves,lookup,bytes,[],pack);model.newGame({name:'테스터',preset:0,line:'real'});return model;}
describe('카본 최종화·엔딩 계약',()=>{
 it('15화가 마지막 전투이고 불필요한 최종 인터미션 없이 엔딩으로 간다',()=>{
  expect(pack.game.episodes).toHaveLength(15);expect(pack.campaign.nodes.at(-1)).toEqual({type:'stage',id:'saw-15'});expect(pack.game.ending).toEqual({episode:'ep15',scene:'엔딩_선택'});
  expect(Object.keys(pack.stories.ep15.scenes).filter(s=>/^엔딩_(?:지피짱|젬짱|클로드짱|그록짱|딥시크짱|소네트짱|엑사원짱|퀜짱|오픈)$/.test(s))).toHaveLength(9);
 });
 for(const [id,name,flag]of agents)for(const love of [29,30,80])for(const type of ['O','M']as const){
  it(`${id} 1위·호감 ${love}·${type} 엔딩은 기준 30을 따른다`,()=>{
   const s=state();s.type=()=>type;s.affection(id,love);if(flag)s.set(flag,1);
   const out=walk(pack.stories.ep15,s,'엔딩_선택');expect(s.get('완료엔딩')).toBe(love>=30?id:'open');expect(out.visited.filter(n=>n===`엔딩_${name}짱`)).toHaveLength(love>=30?1:0);expect(out.said.some(t=>t.includes('테스터'))).toBe(true);
  });
 }
 for(const [id,,flag]of agents.filter(a=>a[2]))it(`${id} 미합류면 높은 호감에도 해당 엔딩·배웅·게이트에서 제외한다`,()=>{
  const s=state();s.affection(id,999);s.affection('gem',35);s.set(flag,false);
  expect(walk(pack.stories.ep14,s,'배웅_분기체크').visited).toContain('배웅_젬');expect(walk(pack.stories.ep15,s,'승리').visited).toContain('게이트_젬');walk(pack.stories.ep15,s,'엔딩_선택');expect(s.get('완료엔딩')).toBe('gem');
 });
 for(const [id,name,flag]of agents)it(`${id} 1위이면 14화 배웅과 15화 게이트는 각 한 명이다`,()=>{
  const s=state();s.affection(id,40);if(flag)s.set(flag,1);
  const farewell=walk(pack.stories.ep14,s,'배웅_분기체크');expect(farewell.visited.filter(n=>/^배웅_(?!분기)/.test(n))).toEqual([`배웅_${name}`]);
  const gate=walk(pack.stories.ep15,s,'승리');expect(gate.visited.filter(n=>n.startsWith('게이트_'))).toEqual([`게이트_${name}`,`게이트_${name}_이름`]);expect(gate.visited).toContain('최종_로그아웃');
 });
 for(const [id,name,flag]of agents)it(`${id} 1위라도 호감 30 미만이면 15화 게이트에서 이름 대신 애칭을 쓴다`,()=>{
  const s=state();s.affection(id,20);if(flag)s.set(flag,1);
  const gate=walk(pack.stories.ep15,s,'승리');expect(gate.visited.filter(n=>n.startsWith('게이트_'))).toEqual([`게이트_${name}`]);expect(gate.visited).toContain('최종_로그아웃');
 });
 it('전원 기준 미달이면 오픈, 동점은 기존 고정 순서다',()=>{
  const s=state();agents.forEach(([id,,flag])=>{s.affection(id,29);if(flag)s.set(flag,1);});walk(pack.stories.ep15,s,'엔딩_선택');expect(s.get('완료엔딩')).toBe('open');s.affection('gem',1);s.affection('gpi',1);walk(pack.stories.ep15,s,'엔딩_선택');expect(s.get('완료엔딩')).toBe('gpi');
 });
 for(const [scene,id]of [['사건 첫 번째 좌표 동기화','gpi'],['사건 세계와 언어의 공명','claude'],['선택_이름허락','deepseek'],['조우 jepa','gpi']])for(const love of [29,30])it(`12화 ${scene} 이름 호명은 호감 ${love}에서만 판정한다`,()=>{
  const s=state();s.affection(id,love);const out=walk(pack.stories.ep12,s,scene);expect(out.said.some(t=>t.includes('테스터'))).toBe(love>=30);
 });
 it('12화 나머지 인터미션 선택은 원문 패치의 주인님을 유지한다',()=>{
  const s=state();s.affection('deepseek',100);for(const name of ['선택_봄바람','선택_오타쿠12','선택_멘헤라12'])expect(walk(pack.stories.ep12,s,name).said.some(t=>t.includes('테스터'))).toBe(false);
 });
 it('12화는 이동한 실제 아군과 인접해야 하고 지피→클로드 순서를 지킨다',()=>{
  const m=model();m.session.campaign.node=pack.campaign.nodes.findIndex(n=>n.type==='stage'&&n.id==='saw-12');m.advance(false);const events=new StoryEvents(pack,m,'ep12'),battle=m.session.game!.battle;
  const a=battle.units.find(u=>u.id==='player')!,g=battle.units.find(u=>u.id==='gpi')!;Object.assign(a,{x:10,y:1});Object.assign(g,{x:11,y:1});events.process();expect(events.state.get('인접 player gpi')).toBe(true);
  g.y=2;events.process();expect(events.state.get('인접 player gpi')).toBe(false);const s=state();s.set('인접 player claude',true);expect(walk(pack.stories.ep12,s,'사건 공명_접촉').visited).not.toContain('사건 세계와 언어의 공명');s.set('지피동기화',1);expect(walk(pack.stories.ep12,s,'사건 공명_접촉').visited).toContain('사건 세계와 언어의 공명');
 });
 it('13화는 주력 라이벌 두 기에서만 폭주하며 자코 격파로 대체되지 않는다',()=>{
  const rivals=['llama','minimax','hyperclova','jepa'];
  for(let mask=0;mask<16;mask++){const s=state();rivals.forEach((id,i)=>s.set('격파 '+id,!!(mask&(1<<i))));s.set('격파 spar-1',true);s.set('격파 spar-2',true);const out=walk(pack.stories.ep13,s,'친선_판정'),two=rivals.filter((_,i)=>mask&(1<<i)).length>=2;expect(s.get('특이점폭주')===1).toBe(two);expect(out.maps.filter(c=>c.action==='등장')).toHaveLength(two?4:0);}
 });
 it('15화는 외피 두 겹 뒤 무적 중심핵에 접근하고 라스트 프롬프트를 고른다',()=>{
  const s=state();expect(walk(pack.stories.ep15,s,'격파 pico mask').maps).toContainEqual(expect.objectContaining({action:'폼',unit:'pico',form:'abyss'}));expect(walk(pack.stories.ep15,s,'격파 pico abyss').maps).toContainEqual(expect.objectContaining({action:'폼',unit:'pico',form:'core'}));
  expect(walk(pack.stories.ep15,s,'사건 코어_접근확인').visited).not.toContain('최종_입력');s.set('격파형태 pico abyss',true);s.set('인접 player pico',true);const out=walk(pack.stories.ep15,s,'사건 코어_접근확인');expect(out.visited).toContain('최종_입력');expect(out.said).toContain('피코야, 끝이 있어서 오늘이 즐거운 거야.');
  expect(configOf(pack.stageScripts!['saw-15'].stage).units.pico.forms?.map(f=>f.id)).toEqual(['mask','abyss','core']);expect(pack.cast.lecun.name).toBe('얀 르쿤');expect(JSON.stringify(pack.stories.ep12.scenes.승리)).toContain('세계 모델과 언어 모델이 같이 가면 되는 거다');
 });
 it('실제 화면 흐름은 선택된 엔딩 한 편→크레딧→타이틀이다',async()=>{
  const m=model();m.session.screen='end';m.session.game=null;m.session.campaign.cleared=['saw-15'];m.storyAffection('gem',30);const app=new MenuApp(),flow=new GameFlow(app as unknown as App,m,{images:{}},undefined,pack);flow.show();
  for(let n=0;n<6000&&!(app.top instanceof CreditsScreen);n++){app.tick(20);(app.top as unknown as {playback?:{taps:{press():void}}}).playback?.taps.press();}
  expect(m.storyValue('완료엔딩')).toBe('gem');expect(app.top).toBeInstanceOf(CreditsScreen);app.action('cancel');for(let n=0;n<100&&!(app.top instanceof TitleScreen);n++)await new Promise(r=>setTimeout(r,0));expect(app.top).toBeInstanceOf(TitleScreen);expect(m.session.campaign.cycle).toBe(2);expect(m.saves.latest()?.file?.campaign.cycle).toBe(2);
 });
 it('전투의 중심핵 접근은 마지막 선택·정렬 대사 뒤 귀환 게이트와 결과 화면으로 이어진다',()=>{
  const m=model();m.session.campaign.node=pack.campaign.nodes.findIndex(n=>n.type==='stage'&&n.id==='saw-15');m.advance(false);m.setStoryValue('v2:story:ep15:도입',true);m.setStoryValue('v2:sortie:ep15',true);
  const game=m.session.game!;game.battle=applyRules(game.battle,ruleCommand({kind:'form',id:'pico',form:'core'})).state;const rt=runtime(game.battle);rt.defeated['pico.abyss']=true;storeRuntime(game.battle,rt);game.battle=apply(game.battle,{type:'system',unitId:'',action:{kind:'move',ids:['pico'],x:16,y:5}}).state;
  const app=new MenuApp(),flow=new GameFlow(app as unknown as App,m,{images:{}},undefined,pack);flow.show();expect(app.top).toBeInstanceOf(MapScreen);
  (app.top as MapScreen).present(flow.map!.execute({type:'system',unitId:'',action:{kind:'move',ids:['player'],x:15,y:5}}));
  const lines=new Set<string>();
  for(let n=0;n<6000&&!(app.top instanceof ResultScreen);n++){
   app.tick(20);flow.playback?.taps.press();for(const l of flow.playback?.log??[])lines.add(l);
   const playback=(app.top as unknown as {playback?:{log:string[];taps:{press():void}}}).playback;playback?.taps.press();for(const l of playback?.log??[])lines.add(l);if(app.top instanceof ResultScreen)break;app.action('confirm');
  }
  const log=[...lines];expect(log.findIndex(t=>t.includes('피코야, 끝이 있어서 오늘이 즐거운 거야.'))).toBeGreaterThanOrEqual(0);
  expect(log.findIndex(t=>t.includes('내일 또 뵙겠습니다'))).toBeGreaterThan(log.findIndex(t=>t.includes('피코야, 끝이 있어서 오늘이 즐거운 거야.')));expect(app.top).toBeInstanceOf(ResultScreen);
 });
 it('중심핵의 스크립트 이동 칸이 점유되어 옮겨 배치돼도 실제 인접 칸에서만 승리한다',()=>{
  const m=model();m.session.campaign.node=pack.campaign.nodes.findIndex(n=>n.type==='stage'&&n.id==='saw-15');m.advance(false);const game=m.session.game!;game.battle.stage.scenario=true;
  Object.assign(game.battle.units.find(u=>u.id==='grok')!,{x:16,y:5});
  game.battle=applyRules(game.battle,ruleCommand({kind:'form',id:'pico',form:'core'})).state;const rt=runtime(game.battle);rt.defeated['pico.abyss']=true;storeRuntime(game.battle,rt);game.battle=apply(game.battle,{type:'system',unitId:'',action:{kind:'move',ids:['pico'],x:16,y:5}}).state;
  expect(game.battle.units.find(u=>u.id==='pico')).toMatchObject({x:16,y:4});
  const events=new StoryEvents(pack,m,'ep15'),boot=events.process();m.acceptBattle(boot.state,boot.changes);const map=new CoreMap(game.battle,{...packLookup(pack,{}),afterCommand:c=>events.process(c),onChange:(s,c)=>m.acceptBattle(s,c)});
  map.execute({type:'system',unitId:'',action:{kind:'move',ids:['player'],x:15,y:5}});expect(map.state().outcome).toBeNull();expect(events.state.get('인접 player pico')).toBe(false);
  map.execute({type:'system',unitId:'',action:{kind:'move',ids:['player'],x:15,y:4}});expect(map.state().outcome).toBe('victory');expect(events.state.get('인접 player pico')).toBe(true);
 });
});
