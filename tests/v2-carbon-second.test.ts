import {chooseAICommand} from '@engine/src/core';
import {aiProjection} from '@engine/src/v2/story/stage-core';
import {memoryStoryState} from './pack-fixture';
import {beforeAll,describe,expect,it} from 'vitest';
import {readFile} from '../tools/files.mjs';
import {loadPack,packLookup,type Pack} from '@engine/src/v2/pack/load';
import {storyChoices,storyText,testCondition,type StoryState} from '@engine/src/v2/story/play';
import type {Story} from '@engine/src/v2/story/parse';
import type {Cue} from '@engine/src/v2/director';
import {CoreCampaign} from '@engine/src/v2/adapter/campaign';
import {CoreMap} from '@engine/src/v2/adapter/map';
import {TrainingSaves} from '@engine/src/v2/adapter/saves';
import {StoryEvents} from '@engine/src/v2/story/events';
import {MemoryStore} from './v2-campaign-fixtures';
import {stageAI} from '@engine/src/v2/story/stage-ai';
import {apply,type BattleState} from '@engine/src/core';

let pack:Pack;beforeAll(async()=>{pack=await loadPack('content/packs/saw',p=>readFile(p,'utf8'));expect(pack.errors).toEqual([]);});
function at(id:string){const bytes=new MemoryStore(),lookup=packLookup(pack,{}),saves=new TrainingSaves(bytes,pack.campaign,pack.rules,pack.training),model=new CoreCampaign(pack.campaign,pack.rules,saves,lookup,bytes,[],pack);model.newGame({name:'테스터',preset:0,line:'real'});model.session.campaign.node=pack.campaign.nodes.findIndex(n=>n.type==='stage'&&n.id===id);model.advance(false);model.session.game!.battle.stage.scenario=true;return {model,bytes,lookup};}
function memory():StoryState{const base=memoryStoryState();return {...base,playerName:()=> '테스터',affection:(id,a)=>base.affection(id.replace(/^saw-/,''),a)};}
function walk(story:Story,state:StoryState,scene:string,choose=0){
 const visited:string[]=[],said:{who:string;text:string}[]=[];
 const effect=(c:Cue)=>{if(c.do==='variable')state.set(c.name,c.value);if(c.do==='affection')state.affection(c.who,c.amount);if(c.do==='recruit')state.recruit?.(c.unit);};
 for(let budget=0;budget<100;budget++){
  visited.push(scene);let jump:string|undefined;
  for(let c of story.scenes[scene]??[]){if(c.do==='typed'){if(c.type!==state.type())continue;c=c.cue;}
   if(c.do==='end')return {visited,said};if(c.do==='say')said.push({who:c.who,text:storyText(c.text,state)});
   if(c.do==='jump')jump=c.scene;if(c.do==='condition'&&testCondition(c.test,state))jump=c.scene;
   if(c.do==='choice'){const ch=storyChoices(c.choices,state)[choose];ch.effects.forEach(effect);jump=ch.target;}
   effect(c);if(jump)break;
  }
  if(!jump)return {visited,said};scene=jump;
 }
 throw Error('대본 분기 루프');
}
describe('카본 2차의 합류·분기 계약',()=>{
 it('6화부터 최종 15화까지 등록하고 16화와 원고의 대화 안내 문구는 넣지 않는다',()=>{
  expect(pack.game.episodes.map(e=>e.id)).toEqual(Array.from({length:15},(_,i)=>`ep${String(i+1).padStart(2,'0')}`));
  expect(pack.campaign.nodes.at(-1)).toEqual({type:'stage',id:'saw-15'});expect(pack.campaign.stages['saw-16']).toBeUndefined();
  for(const s of Object.values(pack.stories))expect(JSON.stringify(s.scenes)).not.toMatch(/다음.*말씀해 주시면|content_copy|expand_less/);
 });
 it('합류 등록 전에는 히든이 없고, 현재 전장에는 추가하지 않으며 다음 화·저장에 이어진다',async()=>{
  for(const [id,from,next] of [['qwen','saw-06','saw-07'],['sonnet','saw-07','saw-08'],['exaone','saw-08','saw-09']]){
   const {model}=at(from),before=model.session.game!.battle.units.map(u=>u.id);
   model.storyRecruit(id);model.storyRecruit(id);expect(model.session.campaign.roster.filter(u=>u.id===id)).toHaveLength(1);expect(model.session.game!.battle.units.map(u=>u.id)).toEqual(before);
   await model.save('1');await model.load('1');model.session.campaign.node=pack.campaign.nodes.findIndex(n=>n.type==='stage'&&n.id===next);model.advance(false);
   expect(model.session.game!.battle.units.find(u=>u.id===id)?.side).toBe('player');await model.save('2');await model.load('2');expect(model.session.game!.battle.units.some(u=>u.id===id)).toBe(true);
   const none=at(next).model;expect(none.session.game!.battle.units.some(u=>u.id===id)).toBe(false);
  }
 });
 it('6화의 기존 2세대 기체로 바뀌어도 성장·개조와 플레이어 계열은 저장을 거쳐 유지된다',async()=>{
  for(const line of ['real','super']){
   const {model}=at('saw-05');if(line==='super'){delete model.session.campaign.flags['player-real'];model.session.campaign.flags['player-super']=true;model.session.campaign.player!.line='super';}
   const pilot=model.session.campaign.roster.find(u=>u.id==='gpi')!;pilot.level=9;pilot.exp=123;pilot.upgrades={hp:1,en:0,armor:2,mobility:0,weapons:2};
   model.session.campaign.node=pack.campaign.nodes.findIndex(n=>n.type==='stage'&&n.id==='saw-06');model.advance(false);
   expect(model.session.game!.battle.units.find(u=>u.id==='gpi')).toMatchObject({mechId:'gpi-generation-2',level:11,exp:123,upgrades:pilot.upgrades});expect(model.session.game!.battle.units.find(u=>u.id==='player')?.mechId).toBe(`player-${line}-generation-2`);
   await model.save('1');await model.load('1');expect(model.session.game!.battle.units.find(u=>u.id==='gpi')).toMatchObject({mechId:'gpi-generation-2',level:11,exp:123,upgrades:pilot.upgrades});
  }
 });
 it('퀜은 딥시크보다 먼저 격파했을 때만 내기 성공이며 동시 격파는 성공으로 세지 않는다',()=>{
  for(const alive of [true,false]){
   const s=memory();s.set('생존 deepseek-rival',alive);s.set('격파진영 qwen-rival','player');walk(pack.stories.ep06,s,'격파 qwen-rival');expect(s.get('퀜내기성공')===1).toBe(alive);
   const recruited:string[]=[];s.recruit=id=>recruited.push(id);walk(pack.stories.ep06,s,'승리');expect(recruited.includes('qwen')).toBe(alive);expect(recruited).toContain('deepseek');
  }
  const raw=JSON.stringify(pack.stories.ep06.scenes);for(const word of ['악의축','얀데레','메가데레'])expect(raw).toContain(word);expect(raw).not.toContain('원거리 추론 모드');
 });
 it('적·제3세력이 퀜을 대신 격파하면 내기 합류가 열리지 않는다',()=>{for(const side of ['enemy','third']){const s=memory();s.set('생존 deepseek-rival',true);s.set('격파진영 qwen-rival',side);walk(pack.stories.ep06,s,'격파 qwen-rival');expect(s.get('퀜내기성공')).not.toBe(1);}});
 it('퀜 격파 뒤 딥시크가 쓰러지고 저장해도 먼저 발생한 격파 장면은 당시 생존 사실로 분기한다',async()=>{
  const {model}=at('saw-06'),events=new StoryEvents(pack,model,'ep06');const boot=events.process();model.acceptBattle(boot.state,boot.changes);
  const definition=pack.stageScripts!['saw-06'].stage.waves!['qwen-rival'][0];
  let state=apply(model.session.game!.battle,{type:'system',unitId:'',action:{kind:'spawn',units:[definition]}}).state;
  const defeat=(id:string)=>{const before=state;state=structuredClone(state);Object.assign(state.units.find(u=>u.id===id)!,{alive:false,hp:0});const processed=events.process({before,after:state,command:{type:'wait',unitId:'player'},events:[{type:'unit-defeated',unitId:id,by:'gpi'}]});state=processed.state as BattleState;model.acceptBattle(state,processed.changes);};
  defeat('qwen-rival');defeat('deepseek-rival');await model.save('1');await model.load('1');
  const reloaded=new StoryEvents(pack,model,'ep06');reloaded.activateScene('격파 qwen-rival');expect(reloaded.state.get('생존 deepseek-rival')).toBe(true);walk(pack.stories.ep06,reloaded.state,'격파 qwen-rival');expect(model.storyValue('퀜내기성공')).toBe(1);
 });
 it('엑사원은 환영 선택과 생존 둘 다 필요하고, 미합류 티타임에서도 거울 복선은 이어진다',()=>{
  for(const accepted of [0,1])for(const alive of [true,false]){
   const s=memory(),recruited:string[]=[];s.recruit=id=>recruited.push(id);s.set('엑사원합류조건',accepted);s.set('생존 exaone-npc',alive);walk(pack.stories.ep08,s,'승리');
   expect(recruited.includes('exaone')).toBe(accepted===1&&alive);const tea=walk(pack.stories.ep08,s,'인터미션');expect(tea.visited).toContain('인터미션_마무리8');expect(tea.said.some(x=>x.who==='glm')).toBe(true);
   expect(tea.said.some(x=>x.who==='exaone')).toBe(accepted===1&&alive);
  }
 });
 it('소네트 미합류 경로도 피코의 로그아웃 버튼 이동과 다음 화 예고를 보여 준다',()=>{
  const s=memory(),out=walk(pack.stories.ep07,s,'인터미션');expect(out.said.some(x=>x.who==='sonnet')).toBe(false);expect(out.said.some(x=>x.text.includes('깊숙한 서랍'))).toBe(true);expect(out.visited).toContain('인터미션_마무리7');
 });
 it('수프 드론은 연구소로 이동하고 진입하면 즉시 패배한다',()=>{
  const {model,lookup}=at('saw-07'),ep=new StoryEvents(pack,model,'ep07');const boot=ep.process();model.acceptBattle(boot.state,boot.changes);
  const map=new CoreMap(model.session.game!.battle,{...lookup,afterCommand:c=>ep.process(c),onChange:(s,c)=>model.acceptBattle(s,c)});map.execute({type:'endPhase'});const cmd=stageAI(pack.stageScripts!['saw-07'],map.state(),chooseAICommand(aiProjection(map.state()),'soup-1'));expect(cmd.type).toBe('move');
  map.execute({type:'system',unitId:'',action:{kind:'move',ids:['soup-1'],x:8,y:2}});expect(map.state().outcome).toBe('defeat');
 });
 for(const [id,flag]of [['gpi',''],['gem',''],['claude',''],['grok',''],['deepseek',''],['sonnet','소네트합류'],['exaone','엑사원합류조건'],['qwen','퀜내기성공']])for(const high of [false,true])for(const type of ['O','M'] as const){
  it(`10화 옥상 ${id} ${high?'이름':'애칭'} ${type} 분기는 정확히 한 명 뒤 공통 숙소로 간다`,()=>{
   const s=memory();s.type=()=>type;s.affection(id,high?30:1);if(flag)s.set(flag,1);const out=walk(pack.stories.ep10,s,'인터미션');
   const rooftops=out.visited.filter(n=>/^옥상_(지피|젬|클로드|그록|딥시크|소네트|엑사원|퀜)$/.test(n));expect(rooftops).toHaveLength(1);expect(out.visited.filter(n=>n==='숙소_로그아웃발각')).toHaveLength(1);
   const own=out.said.filter(x=>x.who.replace(/^saw-/,'')===id);expect(own.some(x=>x.text.includes('테스터'))).toBe(high);expect(out.said.some(x=>x.text.includes('로그아웃')&&x.who==='saw-pico')).toBe(false);expect(out.said.some(x=>x.who==='saw-pico'&&x.text.includes('영원히 즐겁게'))).toBe(true);
  });
 }
 it('8화 외형 낭독 세 줄은 편집했지만 오타쿠8의 안테나 발견은 보존한다',async()=>{
  const s=await readFile('content/packs/saw/story/ep08.story','utf8');expect(s).toContain('야 거기 예쁜 아가씨!');expect(s).not.toContain('그렇게 곱상한 얼굴로');expect(s).not.toContain('잠깐만, 자두빛 단발에');expect(s).toContain('연산 안테나 역할도 겸하는 파츠지?');
  expect(JSON.stringify(pack.stories.ep10.scenes)).toContain('같이 합선 나며 맞춘 우리 호흡이 훨씬 세거든!');expect(JSON.stringify(pack.stories.ep10.scenes)).not.toContain('세상엔 완벽한 하나의 정답 같은 건 없어.');
 });
});
