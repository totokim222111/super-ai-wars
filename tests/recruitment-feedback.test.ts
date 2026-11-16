import {describe,it,expect} from 'vitest';
import {testPack as pack} from './pack-fixture';
import {CoreCampaign} from '@engine/src/v2/adapter/campaign';
import {CoreMap} from '@engine/src/v2/adapter/map';
import {StoryEvents} from '@engine/src/v2/story/events';
import {effectiveMech,snapshot,restore} from '@engine/src/core';
import {Saves} from '@engine/src/campaign/saves';
import {MemoryStore} from './v2-campaign-fixtures';
import {lookup} from './v2-map-fixtures';
async function start(n:number){const bytes=new MemoryStore(),saves=new Saves(bytes,pack.campaign,pack.rules);await saves.init();const m=new CoreCampaign(pack.campaign,pack.rules,saves,lookup,bytes,[],pack);m.newGame({name:'검수',preset:0,line:pack.players.lines[0].id});m.session.campaign.node=pack.campaign.nodes.findIndex(v=>v.type==='stage'&&v.id===`saw-${String(n).padStart(2,'0')}`);m.advance(false);return m;}
describe('approved recruitment and clear training',()=>{
 it('keeps scripted retreat action bookkeeping consistent for saves before the toll event',async()=>{const m=await start(4),map=new CoreMap(m.session.game!.battle,{...lookup,onChange:(s,c)=>m.acceptBattle(s,c)});map.execute({type:'system',unitId:'',action:{kind:'retreat',ids:['grok']}});await m.save('suspend');await m.load('suspend');const u=m.session.game!.battle.units.find(u=>u.id==='grok')!;expect(u.acted).toBe(true);expect(u.actionsRemaining).toBe(0);});
 it('has per-image landmarks for every visible cast member, with a smaller Sonnet',()=>{for(const c of Object.values(pack.cast))if(c.height>0&&c.bust){expect(c.framingByArt?.[c.bust]).toBeDefined();}expect(pack.cast.sonnet.framing!.relativeHeight).toBe(.85);});
 it('offers no Grok persuasion and the toll scene joins once, preserves HP ratio and grants exactly 600',async()=>{
  const m=await start(4),b=m.session.game!.battle,a=b.units.find(u=>u.id==='player')!,g=b.units.find(u=>u.id==='grok')!;
  g.hp=Math.round(effectiveMech(b,g).hp*.5);const ratio=g.hp/effectiveMech(b,g).hp,before=m.funds(),aff=m.storyAffection('grok'),events=new StoryEvents(pack,m,'ep04');let joins=0;
  const boot=events.process();m.acceptBattle(boot.state,boot.changes);
  const map=new CoreMap(m.session.game!.battle,{...lookup,persuadeTargets:()=>[],afterCommand:c=>events.process(c),onChange:(s,c)=>{for(const change of c)if(change.before.units.find(u=>u.id==='grok')?.side!=='player'&&change.after.units.find(u=>u.id==='grok')?.side==='player')joins++;m.acceptBattle(s,c);}});
  expect(pack.game.recruitment?.['saw-04']?.every(r=>!r.persuader&&!r.affection)).toBe(true);
  expect(map.commands(a.id,{col:a.x,row:a.y}).some(c=>c.id==='persuade')).toBe(false);
  map.execute({type:'system',unitId:'',action:{kind:'move',ids:['player'],x:14,y:5}});
  const pending=JSON.parse(String(m.storyValue('v2:pending:ep04')));expect(pending.filter((s:string)=>s==='사건 톨게이트 내기 승리')).toHaveLength(1);
  const scene=pack.stories.ep04.scenes['사건 톨게이트 내기 승리'];
  for(let cue of scene){if(cue.do==='typed'){if(cue.type!==events.state.type())continue;cue=cue.cue;}if(cue.do==='variable')events.state.set(cue.name,cue.value);if(cue.do==='map'&&cue.action==='합류')map.execute({type:'system',unitId:'',action:{kind:'join',ids:[cue.unit!]}});}
  map.execute({type:'system',unitId:'',action:{kind:'move',ids:['player'],x:13,y:5}});map.execute({type:'system',unitId:'',action:{kind:'move',ids:['player'],x:14,y:5}});
  const s=map.state(),ally=s.units.find(u=>u.id==='grok')!,mech=effectiveMech(s,ally);expect(joins).toBe(1);expect(m.funds()-before).toBe(600);expect(m.storyValue('그록내기승리')).toBe(1);expect(m.storyValue('그록합류')).toBe(1);
  expect(ally.side).toBe('player');expect(ally.recruited).toBe(true);expect(mech.hp).toBe(pack.rules.mechs.find(x=>x.id===ally.mechId)!.hp);expect(ally.hp/mech.hp).toBeCloseTo(ratio,3);expect(ally.upgrades?.hp).toBe(0);expect(m.upgradeUnits().some(u=>u.id==='grok')).toBe(true);expect(m.storyAffection('grok')).toBe(aff);expect(restore(s.content,s.stage,snapshot(s)).units.find(u=>u.id===ally.id)?.recruited).toBe(true);
 });
 it.each([3,4])('registers the new ally immediately after episode %i, grants every joined pilot 100 exactly once, and preserves that save',async n=>{
  const m=await start(n),id=n===3?'claude':'grok',aff=m.storyAffection(id);if(n===4){m.storyRecruit('grok');m.setStoryValue('그록합류',1);}m.session.game!.battle.outcome='victory';m.session.game!.mode='outcome';m.finish();expect(m.upgradeUnits().some(u=>u.id===id)).toBe(true);expect(m.partUnits().some(u=>u.id===id)).toBe(true);const earned=m.result().training!;expect(earned.some(p=>p.pilotId===id&&p.clear===100)).toBe(true);expect(earned.every(p=>p.amount>=100&&p.clear===100)).toBe(true);expect(m.storyAffection(id)).toBe(aff);m.finish();expect(m.result().training).toEqual(earned);await m.save('1');await m.load('1');expect(m.result().training).toEqual(earned);
 });
});
