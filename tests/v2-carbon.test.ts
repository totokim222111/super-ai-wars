import {memoryStoryState} from './pack-fixture';
import {beforeAll,describe,expect,it} from 'vitest';
import {readFile} from '../tools/files.mjs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {loadPack,packLookup,type Pack} from '@engine/src/v2/pack/load';
import {condition,parseStory} from '@engine/src/v2/story/parse';
import {highestAffection,PackStoryScreen,storyChoices,storyText,testCondition} from '@engine/src/v2/story/play';
import {StoryEvents} from '@engine/src/v2/story/events';
import {CoreCampaign} from '@engine/src/v2/adapter/campaign';
import {CoreMap} from '@engine/src/v2/adapter/map';
import {TrainingSaves} from '@engine/src/v2/adapter/saves';
import {MemoryStore,MenuApp} from './v2-campaign-fixtures';
import {availableActions} from '@engine/src/core';
import {GameFlow} from '@engine/src/v2/game/flow';
import {MapScreen} from '@engine/src/v2/map/screen';
import {ResultScreen} from '@engine/src/v2/menus/result';
import type {App} from '@engine/src/v2/screen';

let pack:Pack;
beforeAll(async()=>{pack=await loadPack('content/packs/saw',p=>readFile(p,'utf8'));expect(pack.errors).toEqual([]);});
function stage(id:string,round=1){
 const bytes=new MemoryStore(),lookup=packLookup(pack,{}),saves=new TrainingSaves(bytes,pack.campaign,pack.rules,pack.training);
 const model=new CoreCampaign(pack.campaign,pack.rules,saves,lookup,bytes,[],pack);model.newGame({name:'가나다',preset:0,line:'real'});
 model.session.campaign.node=pack.campaign.nodes.findIndex(n=>n.type==='stage'&&n.id===id);model.advance(false);
 model.session.game!.battle.stage.scenario=true;model.session.game!.battle.round=round;
 const ep=pack.game.episodes.find(e=>e.stage===id)!.id,events=new StoryEvents(pack,model,ep),boot=events.process();model.acceptBattle(boot.state,boot.changes);
 const map=new CoreMap(model.session.game!.battle,{...lookup,afterCommand:c=>events.process(c),onChange:(s,c)=>model.acceptBattle(s,c)});
 return {model,map,events,bytes,ep};
}
describe('카본 기반과 대본 보존',()=>{
 it('지정 판본·60턴 패치를 원문에서 재현하며 생성 결과에 임의 대사를 섞지 않는다',async()=>{
  expect(execFileSync('python',['-X','utf8','tools/port_carbon.py','--check'],{encoding:'utf8'})).toContain('검증 완료');
  const audit=JSON.parse(await readFile('content/packs/saw/story/carbon-audit.json','utf8'));
  const source=await readFile('../story/carbon/carbon-raw.md','utf8');expect(createHash('sha256').update(source).digest('hex')).toBe(audit.sourceSha256);
  const names=new Set([...Object.keys(pack.cast),...Object.values(pack.cast).map(c=>c.name)]);
  for(const ep of pack.game.episodes){const raw=await readFile('content/packs/saw/'+ep.story,'utf8');
   const lines=raw.split(/\r?\n/).filter(l=>{const m=/^(?:\[타입 [OM]\]\s*)?([^:[(]+)(?:\([^)]*\))?: /.exec(l);return !!m&&names.has(m[1]);});
   expect(lines).toHaveLength(audit.episodes[ep.id].dialogueLines);expect(createHash('sha256').update(lines.join('\n')).digest('hex')).toBe(audit.episodes[ep.id].dialogueSha256);
   expect(lines.join('\n')).not.toMatch(/프롬프터|히로인/);
  }
 });
 it('플레이어 이름을 대사·로그·선택지에 표시하고 원문 큐는 보존한다',()=>{
  const state={...memoryStoryState('O'),playerName:()=> '가나다'},source='@ 시작\ngpi: {유저이름}님, {유저이름}!\n[선택]\n- {유저이름}으로 불러 { [변수] n = 1 } -> 끝\n- [타입 O] O 전용 -> 끝\n- [타입 M] M 전용 -> 끝\n@ 끝\n[끝]';
  const story=parseStory(source);expect(story.issues).toEqual([]);const c=story.scenes.시작.find(c=>c.do==='choice')!;expect(c.do).toBe('choice');if(c.do!=='choice')return;
  expect(storyChoices(c.choices,state).map(c=>c.text)).toEqual(['가나다으로 불러','O 전용']);
  expect(storyChoices(c.choices,{...state,type:()=> 'M'}).map(c=>c.text)).toEqual(['가나다으로 불러','M 전용']);
  const app=new MenuApp(),screen=new PackStoryScreen(story,'시작',{gpi:{name:'지피짱',height:0,color:'#fff'}},{},state,()=>{});app.push(screen);app.tick(20);
  expect(screen.playback.log).toEqual(['지피짱: 가나다님, 가나다!']);expect(story.scenes.시작[0]).toMatchObject({text:'{유저이름}님, {유저이름}!'});
  expect(storyText('{유저이름}',memoryStoryState())).toBe('유저');
 });
 it('동점은 고정 순서로 한 명만 고르고, 미합류 히든의 높은 점수는 제외한다',()=>{
  const s=memoryStoryState('O',pack.game.story?.affection);expect(highestAffection(s)).toBe('gpi');s.affection('gem',20);s.affection('gpi',20);expect(highestAffection(s)).toBe('gpi');
  for(const [id,flag]of [['sonnet','소네트합류'],['exaone','엑사원합류조건'],['qwen','퀜내기성공']]){
   s.affection(id,100);expect(highestAffection(s)).toBe('gpi');s.set(flag,1);expect(highestAffection(s)).toBe(id);s.set(flag,false);
  }
  s.set('퀜내기성공',true);expect(testCondition(condition('최고호감 == qwen')!,s)).toBe(true);
  const parsed=parseStory('@ 시작\n[조건] 최고호감 == 젬짱 -> 끝\n@ 끝\n[끝]','test',{cast:pack.cast,affectionAliases:pack.game.story?.affectionAliases});expect(parsed.issues).toEqual([]);expect(parsed.scenes.시작[0]).toMatchObject({test:{subject:'highest-affection',value:'gem'}});
 });
 it('이름·호감·히든 합류 변수는 기존 저장을 거쳐 판정에 전달된다',async()=>{
  const {model,events}=stage('saw-01');model.storyAffection('qwen',100);expect(highestAffection(events.state)).toBe('gpi');model.setStoryValue('퀜내기성공',1);await model.save('1');model.setStoryValue('퀜내기성공',false);await model.load('1');
  const reloaded=new StoryEvents(pack,model,'ep01');expect(reloaded.state.playerName?.()).toBe('가나다');expect(highestAffection(reloaded.intermissionState())).toBe('qwen');
 });
 it('1화 증원 전에는 끝나지 않고, 5화 분열 3기도 실제 등장 전에는 격파로 세지 않는다',()=>{
  for(const id of ['saw-01','saw-05']){const {map}=stage(id);const s=map.state();for(const u of s.units.filter(u=>u.side==='enemy'))expect(u.alive).toBe(true);expect(s.outcome).toBeNull();expect(Object.keys(s.stage.waves??{})).not.toHaveLength(0);}
  expect(pack.stageScripts!['saw-05'].facts.filter(f=>f.kind==='defeated').map(f=>f.unit)).toEqual(['alpaca','vicuna','koala']);
 });
 it('클로드는 보호 대상으로 시작하며 합류 후 조종되고 절전 철수는 격추 패배로 세지 않는다',()=>{
  const {model,map}=stage('saw-03');expect(map.state().units.find(u=>u.id==='claude')?.side).toBe('neutral');expect(availableActions(map.state(),'claude')).toEqual([]);
  map.execute({type:'system',unitId:'',action:{kind:'move',ids:['player'],x:4,y:5}});expect(String(model.storyValue('v2:pending:ep03'))).toContain('가드레일의 의미');
  map.execute({type:'system',unitId:'',action:{kind:'join',ids:['claude']}});expect(availableActions(map.state(),'claude').length).toBeGreaterThan(0);
  map.execute({type:'system',unitId:'',action:{kind:'retreat',ids:['claude']}});expect(map.state().outcome).toBeNull();
 });
 it.each([5,6])('가속 레인 뒤 톨게이트는 생존한 그록과 실제 도달·보상을 판정한다 (진입 %i턴)',round=>{
  const {model,map}=stage('saw-04',round),before=model.funds();map.execute({type:'system',unitId:'',action:{kind:'move',ids:['player'],x:14,y:5}});
  expect(String(model.storyValue('v2:pending:ep04')).includes('톨게이트 내기 승리')).toBe(true);expect(model.funds()-before).toBe(600);
 });
 it('격파된 그록에게는 톨게이트 내기 보상을 주지 않는다',()=>{
  const {model,map}=stage('saw-04'),before=model.funds();map.execute({type:'system',unitId:'',action:{kind:'retreat',ids:['grok']}});map.execute({type:'system',unitId:'',action:{kind:'move',ids:['player'],x:14,y:5}});expect(model.funds()).toBe(before);expect(String(model.storyValue('v2:pending:ep04'))).not.toContain('톨게이트 내기 승리');
 });
 it('마지막 적 그록의 합류가 승리 조건을 만족하면 대본 뒤 결과 화면까지 진행한다',()=>{
  const {model,map}=stage('saw-04');map.execute({type:'system',unitId:'',action:{kind:'retreat',ids:map.state().units.filter(u=>u.side==='enemy'&&u.id!=='grok').map(u=>u.id)}});
  model.setStoryValue('v2:story:ep04:도입',true);model.setStoryValue('v2:sortie:ep04',true);
  const app=new MenuApp(),flow=new GameFlow(app as unknown as App,model,{images:{}},undefined,pack);flow.show();expect(app.top).toBeInstanceOf(MapScreen);
  const screen=app.top as MapScreen;screen.present(flow.map!.execute({type:'system',unitId:'',action:{kind:'move',ids:['player'],x:14,y:5}}));
  for(let n=0;n<2400&&!(app.top instanceof ResultScreen);n++){app.tick(20);if(flow.playback?.active)flow.playback.taps.press();const current=app.top as unknown as {playback?:{active:boolean;taps:{press():void}}};if(current.playback?.active)current.playback.taps.press();}
  expect(app.top).toBeInstanceOf(ResultScreen);expect(model.storyValue('그록합류')).toBe(1);expect(model.result().won).toBe(true);
 });
});
