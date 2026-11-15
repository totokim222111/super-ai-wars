import {describe,it,expect,vi} from 'vitest';
import {readFile} from '../tools/files.mjs';
import {apply,availableActions,effectivePilot,sumAtom,responseOptions,mapAttackCommands,mapForecast} from '@engine/src/core';
import {campaign,intermission,MenuApp,yes} from './v2-campaign-fixtures';
import {CoreCampaign} from '@engine/src/v2/adapter/campaign';
import {ShopScreen} from '@engine/src/v2/menus/shop';
import {PilotScreen} from '@engine/src/v2/menus/pilots';
import {ResultScreen} from '@engine/src/v2/menus/result';
import {Button,MenuList,Tabs} from '@engine/src/v2/kit';
import {Screen} from '@engine/src/v2/screen';
import {loadPack,validatePack} from '@engine/src/v2/pack/load';
import {defeatPoints} from '@engine/src/v2/pack/progression';
import training from '../pack/training.json';
import economy from '../pack/economy.json';
import {readGrowth} from '@engine/src/v2/adapter/training';
import {TrainingSaves} from '@engine/src/v2/adapter/saves';

function grant(model:CoreCampaign,points=300){model.setStoryValue('v2:training',JSON.stringify({pilots:{gpi:{points,stats:{},skills:{}}}}));}
function defeat(model:CoreCampaign,by='gpi'){
  const before=structuredClone(model.session.game!.battle),a=before.units.find(u=>u.id===by)!,d=before.units.find(u=>u.id==='drone-1')!;
  a.x=d.x-1;a.y=d.y;a.acted=false;a.moved=false;a.morale=150;a.en=999;
  a.effects=[{id:'test-hit',source:'test',duration:{unit:'round',remaining:1},hooks:{},atoms:[{type:'hitSet',value:100}]}];
  d.hp=1;d.alive=true;before.outcome=null;
  const command=availableActions(before,by).find(c=>c.type==='attack'&&c.targetId===d.id)!;
  expect(command).toBeDefined();const next=apply(before,command);
  expect(next.events).toContainEqual({type:'unit-defeated',unitId:d.id,by});
  const change={before,after:next.state,command,events:next.events};model.acceptBattle(next.state,[change]);return change;
}
class Parent extends Screen{enter(){}}
const open=(screen:Screen)=>{const app=new MenuApp();app.push(new Parent());app.push(screen);return app;};
const widgets=(s:Screen)=>(s.ui as unknown as {widgets:(Button|Tabs|MenuList)[]}).widgets;
const tap=(app:MenuApp,w:{x:number;y:number;w:number;h:number},fraction=.5)=>{app.top!.input({kind:'pointer',phase:'down',x:w.x+w.w*fraction,y:w.y+w.h/2});app.top!.input({kind:'pointer',phase:'up',x:w.x+w.w*fraction,y:w.y+w.h/2});};

describe('팩의 경제·육성 자료',()=>{
 it('saw 자료가 읽히고 형식 오류는 파일·줄·고치는 법을 돌려준다',async()=>{
  const p=await loadPack('content/packs/saw',p=>readFile(p,'utf8'));expect(p.errors).toEqual([]);expect(p.economy?.income['saw-01']).toEqual({defeat:2640,clear:7920,rosterClear:{}});expect(p.training?.rewards.grunt).toBe(10);
  p.economy!.items.missing={price:-1,fromEpisode:0};p.training!.stats.melee!.costs=[10,9];p.training!.skills.missing={costs:[10],fromEpisode:1};p.training!.skills.renewal.costs=[10,20];p.errors=[];validatePack(p);
  expect(p.errors.map(e=>e.message)).toEqual(expect.arrayContaining(['없는 플러그인: missing','가격·진열 화는 양의 정수여야 합니다.','육성 능력치 형식 오류: melee','없는 기술: missing','코어가 지원하지 않는 기술 단계입니다.']));
  expect(p.errors.every(e=>e.file.endsWith('.json')&&e.line>0&&e.fix)).toBe(true);
 });
 it('구체적인 경제 자료를 잘못된 형으로 바꿔도 검사기가 예외를 던지지 않는다',async()=>{
  const p=await loadPack('content/packs/saw',p=>readFile(p,'utf8'));Object.assign(p.economy!,{items:null,income:[],sellRatio:2,maxQuantity:0});Object.assign(p.training!,{rewards:null,classification:null,stats:null,skills:[]});p.errors=[];expect(()=>validatePack(p)).not.toThrow();expect(p.errors.length).toBeGreaterThanOrEqual(8);
 });
 it('등급·네임드 차등과 무보상 이벤트 기체를 구분한다',async()=>{
  const {model}=await campaign(),state=model.session.game!.battle,u=structuredClone(state.units.find(u=>u.id==='drone-1')!);
  expect(defeatPoints(training,state,u)).toBe(10);u.tags=['midboss'];expect(defeatPoints(training,state,u)).toBe(25);u.tags=['boss'];expect(defeatPoints(training,state,u)).toBe(60);u.pilotId='midjourney';expect(defeatPoints(training,state,u)).toBe(45);
  const empty=structuredClone(state);const mech=empty.content.mechs.find(m=>m.id===u.mechId)!;mech.credits=0;mech.exp=0;expect(defeatPoints(training,empty,u)).toBe(0);
 });
});
describe('플러그인 거래와 RLHF 저장',()=>{
 it('한 화 수입으로 기본 품목 2~3개를 사고 상위 품목은 단계적으로 열린다',async()=>{const {model}=await campaign();intermission(model);model.session.campaign.credits=2400;const initial=model.shop();expect(initial.some(p=>p.id==='booster')).toBe(false);expect(model.buy('hull',2)).toBe(true);expect(model.funds()).toBe(600);expect(model.buy('hull',1)).toBe(false);model.session.campaign.cleared=['saw-01','saw-02','saw-03'];expect(model.shop().find(p=>p.id==='booster')?.price).toBe(2400);});
 it('구매·반값 판매가 원자적이고 장착품·초과 수량·다른 페이즈를 거부한다',async()=>{
  const {model}=await campaign();intermission(model);const initial=model.funds();expect(model.buy('hull',2)).toBe(true);expect(model.sell('hull',2)).toBe(true);expect(model.funds()).toBe(initial-900);
  expect(model.equip('gpi',0,'hull')).toBe(true);expect(model.sell('hull',1)).toBe(false);
  const before=structuredClone(model.session);for(const count of [0,-1,1.5,100,NaN]){expect(model.sell('battery',count)).toBe(false);expect(model.buy('hull',count)).toBe(false);}expect(model.sell('missing',1)).toBe(false);expect(model.session).toEqual(before);model.session.screen='battle';expect(model.sell('battery',1)).toBe(false);expect(model.buy('hull',1)).toBe(false);
 });
 it('실제 코어 격파를 막타 파일럿에 지급하고 재처리·저장 후 재처리해도 중복하지 않는다',async()=>{
  const {model}=await campaign();const c=defeat(model);expect(model.training('gpi')?.points).toBe(10);expect(model.training('player')?.points).toBe(0);expect(model.result().training).toEqual([{pilotId:'gpi',name:'지피',amount:10}]);
  model.acceptBattle(c.after,[c]);expect(model.training('gpi')?.points).toBe(10);await model.save('1');await model.load('1');model.acceptBattle(c.after,[c]);expect(model.training('gpi')?.points).toBe(10);
 });
 it('실제 적 공격의 반격 격파도 방어한 파일럿에게 적립한다',async()=>{
  const {model}=await campaign(),before=structuredClone(model.session.game!.battle),a=before.units.find(u=>u.id==='drone-1')!,d=before.units.find(u=>u.id==='gpi')!;before.phase='enemy';before.options.autoResponse=false;a.x=d.x+1;a.y=d.y;a.hp=1;d.morale=150;d.effects=[{id:'sure',source:'test',duration:{unit:'round',remaining:1},hooks:{},atoms:[{type:'hitSet',value:100}]}];
  const attack=availableActions(before,a.id).find(c=>c.type==='attack'&&c.targetId===d.id)!,first=apply(before,attack),response=responseOptions(first.state).find(r=>r.type==='counter')!;expect(response).toBeDefined();const command={type:'respond' as const,response},last=apply(first.state,command);expect(last.events).toContainEqual({type:'unit-defeated',unitId:a.id,by:d.id});model.acceptBattle(last.state,[{before,after:first.state,command:attack,events:first.events},{before:first.state,after:last.state,command,events:last.events}]);expect(model.training('gpi')?.points).toBe(10);
 });
 it('실제 MAP 격파의 모든 표적에 보상을 지급한다',async()=>{
  const {model}=await campaign(),before=structuredClone(model.session.game!.battle),a=before.units.find(u=>u.id==='gpi')!,d=before.units.find(u=>u.id==='drone-1')!;a.mechId='gpi-generation-3';a.x=d.x-1;a.y=d.y;a.en=999;a.morale=150;a.effects=[{id:'sure',source:'test',duration:{unit:'round',remaining:1},hooks:{},atoms:[{type:'hitSet',value:100}]}];d.hp=1;
  const command=mapAttackCommands(before,a.id).find(c=>mapForecast(before,c.unitId,c.weaponId,c.point,c.direction).targets.some(t=>t.unitId===d.id))!;expect(command).toBeDefined();const result=apply(before,command);expect(result.events).toContainEqual({type:'unit-defeated',unitId:d.id,by:a.id});model.acceptBattle(result.state,[{before,after:result.state,command,events:result.events}]);expect(model.training('gpi')!.points).toBeGreaterThanOrEqual(10);
 });
 it('원호 공격자가 막타를 내면 본 공격자 대신 그 파일럿에게 지급한다',async()=>{
  const {model}=await campaign(),before=structuredClone(model.session.game!.battle),a=before.units.find(u=>u.id==='gpi')!,h=before.units.find(u=>u.id==='player')!,d=before.units.find(u=>u.id==='drone-1')!;a.x=d.x-1;a.y=d.y;h.x=d.x-2;h.y=d.y;d.hp=1;a.morale=h.morale=150;
  for(const [u,value]of [[a,0],[h,100]]as const)u.effects=[{id:'hit',source:'test',duration:{unit:'round',remaining:1},hooks:{},atoms:[{type:'hitSet',value}]}];
  before.content.pilots.find(p=>p.id===h.pilotId)!.skills=[{id:'support-fire',level:1}];
  const base=availableActions(before,a.id).find(c=>c.type==='attack'&&c.targetId===d.id)!;expect(base.type).toBe('attack');if(base.type!=='attack')throw new Error('공격 없음');const command={...base,supportAttackerId:h.id},result=apply(before,command);expect(result.events).toContainEqual({type:'unit-defeated',unitId:d.id,by:h.id});model.acceptBattle(result.state,[{before,after:result.state,command,events:result.events}]);expect(model.training('player')?.points).toBe(10);expect(model.training('gpi')?.points).toBe(0);
 });
 it('능력치 비용이 오르고 배운 기술을 코어가 실제로 적용한다. 원본은 그대로다',async()=>{
  const {model}=await campaign();intermission(model);grant(model);const original=structuredClone(model.content),old=model.training('gpi')!.stats[0];expect(model.train('gpi',old.id)).toBe(true);expect(model.training('gpi')!.stats[0]).toMatchObject({value:old.value+1,cost:12});expect(model.training('gpi')!.points).toBe(290);
  const skill=model.training('gpi')!.skills.find(s=>s.id==='support-fire')!;expect(skill.level).toBe(0);expect(model.learn('gpi',skill.id)).toBe(true);expect(model.training('gpi')!.points).toBe(230);
  model.session.game=null;model.session.campaign.node=1;model.advance();const state=model.session.game!.battle,u=state.units.find(u=>u.id==='gpi')!;
  expect(sumAtom(state,u,'supportAttack')).toBe(1);const baseline=effectivePilot({...state,content:model.content},u);expect(effectivePilot(state,u).stats.melee).toBe(baseline.stats.melee+1);expect(model.content).toEqual(original);
  await model.save('2');await model.load('2');expect(effectivePilot(model.session.game!.battle,u).stats.melee).toBe(baseline.stats.melee+1);expect(model.training('gpi')?.points).toBe(230);
 });
 it('돈과 RLHF를 섞지 않고 미보유·최대 단계·잘못된 항목을 거부한다',async()=>{
  const {model}=await campaign();intermission(model);const before=structuredClone(model.session);expect(model.train('gpi','melee')).toBe(false);expect(model.learn('gpi','support-fire')).toBe(false);expect(model.session).toEqual(before);grant(model,9999);
  for(let i=0;i<training.stats.melee.costs.length;i++)expect(model.train('gpi','melee')).toBe(true);expect(model.train('gpi','melee')).toBe(false);
  while(model.training('gpi')!.skills.find(s=>s.id==='support-guard')!.cost!==undefined)expect(model.learn('gpi','support-guard')).toBe(true);expect(model.learn('gpi','support-guard')).toBe(false);
  expect(model.train('missing','hit')).toBe(false);expect(model.train('gpi','reaction')).toBe(false);expect(model.learn('gpi','missing')).toBe(false);expect(model.funds()).toBe(48000);
 });
 it('기존 대본의 클리어 지급분을 포함해 팩 수입으로 보충하며 재정산하지 않는다',async()=>{
  const {model}=await campaign();const game=model.session.game!;game.battle.outcome='victory';game.mode='outcome';model.session.campaign.credits+=1000;model.finish();expect(model.result().credits).toBe(economy.income['saw-01'].clear);const funds=model.funds();model.finish();expect(model.funds()).toBe(funds);await model.save('1');await model.load('1');expect(model.result().credits).toBe(economy.income['saw-01'].clear);
 });
 it('육성·거래 결과를 인터미션에서 저장하고 불러온 뒤 다음 화에도 보존한다',async()=>{
  const {model}=await campaign();intermission(model);grant(model);expect(model.buy('hull',1)).toBe(true);expect(model.sell('battery',1)).toBe(true);expect(model.train('gpi','shoot')).toBe(true);expect(model.learn('gpi','support-fire')).toBe(true);model.session.game=null;const before=structuredClone(model.session);await model.save('3');await model.load('3');expect(model.session).toEqual(before);
  model.session.campaign.node=1;model.advance();expect(model.training('gpi')?.points).toBe(230);expect(sumAtom(model.session.game!.battle,model.session.game!.battle.units.find(u=>u.id==='gpi')!,'supportAttack')).toBe(1);
 });
 it('배운 의지의 온도 상한을 검증 전에 적용하고 앱을 다시 열어도 슬롯을 읽는다',async()=>{
  const {model,bytes}=await campaign();intermission(model);model.session.campaign.cleared=['saw-01','saw-02','saw-03'];grant(model);expect(model.learn('gpi','resolve')).toBe(true);model.session.campaign.cleared=['saw-01'];model.session.game=null;model.session.campaign.node=1;model.advance();model.session.game!.battle.units.find(u=>u.id==='gpi')!.morale=170;
  await model.save('1');const saves=new TrainingSaves(bytes,model.data,model.content,training);await saves.init();expect(saves.slots.find(s=>s.id==='1')?.status).toBe('ok');const restored=await saves.load('1');expect(restored.session.game!.battle.units.find(u=>u.id==='gpi')!.morale).toBe(170);expect(sumAtom(restored.session.game!.battle,restored.session.game!.battle.units.find(u=>u.id==='gpi')!,'moraleCapAdd')).toBe(20);
  const bundle=await saves.export();expect(saves.importFile(bundle).find(s=>s.id==='1')).toBeDefined();await model.load('1');expect(model.training('gpi')?.points).toBe(180);
 });
});
describe('터치 메뉴',()=>{
 it('구매·판매·잔액 애니메이션·돈 부족 알림과 취소를 부품으로 조작한다',async()=>{
  const {model}=await campaign();intermission(model);const app=open(new ShopScreen(model)),screen=app.top!,initial=model.funds();app.action('confirm');const buy=widgets(screen).find(w=>w instanceof Button&&w.label==='구매')!;tap(app,buy);yes(app);expect(model.funds()).toBe(initial-900);
  const tabs=widgets(screen).find(w=>w instanceof Tabs)!;tap(app,tabs,.75);const sell=widgets(screen).find(w=>w instanceof Button&&w.label==='판매')!;tap(app,sell);app.action('cancel');expect(model.funds()).toBe(initial-900);tap(app,sell);yes(app);expect(model.funds()).toBe(initial-450);
  model.session.campaign.credits=0;tap(app,tabs,.25);const play=vi.spyOn(app.sound,'play');tap(app,buy);expect(play).toHaveBeenCalledWith('deny',1);app.action('cancel');expect(app.top).toBeInstanceOf(Parent);
 });
 it('육성 미리보기 취소 후 확정·기술 습득을 터치로 끝낸다',async()=>{
  const {model}=await campaign();intermission(model);grant(model);const app=open(new PilotScreen(model)),s=app.top!;const list=widgets(s).filter(w=>w instanceof MenuList)[0]as MenuList;list.index=1;list.act('confirm'); // gpi는 두 번째 파일럿
  app.action('cancel');expect(app.top).toBeInstanceOf(Parent);
  app.push(new PilotScreen(model));const screen=app.top!,pilots=widgets(screen).find(w=>w instanceof MenuList)as MenuList;pilots.index=1;pilots.act('down');pilots.act('up');pilots.act('confirm');
  const tabs=widgets(screen).filter(w=>w instanceof Tabs)as Tabs[];tap(app,tabs[0],.75);let plus=widgets(screen).find(w=>w instanceof Button&&w.label==='+')!;tap(app,plus);app.action('cancel');expect(model.training('gpi')?.points).toBe(300);plus=widgets(screen).find(w=>w instanceof Button&&w.label==='+')!;tap(app,plus);yes(app);expect(model.training('gpi')?.points).toBe(290);
  tap(app,tabs[1],.75);const skills=widgets(screen).filter(w=>w instanceof MenuList)[1]as MenuList;skills.act('confirm');yes(app);expect(model.training('gpi')?.points).toBe(230);
 });
 it('결과 화면에 파일럿별 포인트가 굴러 올라간다',async()=>{const {model}=await campaign();defeat(model);const app=open(new ResultScreen(model,()=>{})),list=widgets(app.top!).find(w=>w instanceof MenuList)as MenuList;expect(list.items[0].value).toContain('+0');app.tick(90);expect(list.items[0].value).toContain('+10');expect(readGrowth(model.storyValue('v2:training')).pilots.gpi.points).toBe(10);});
});
