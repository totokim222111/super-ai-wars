import {it,expect} from 'vitest';
import {testPack as pack} from './pack-fixture';
import {createBattle,effectiveMech,effectiveWeapon,effectivePilot,actionLimit} from '@engine/src/core';
import {configOf} from '@engine/src/v2/rules/config';
import {behaviorOf} from '@engine/src/core/ai-patterns';
import approved from '../tools/balance-v2-approved.json';
it('every episode enemy and reinforcement uses the approved per-stat cap',()=>{
 for(let n=1;n<=15;n++){const stage=pack.campaign.stages[`saw-${String(n).padStart(2,'0')}`].stage,defs=[...stage.units,...stage.definitions??[],...Object.values(stage.waves??{}).flat(),...configOf(stage).transitions?.flatMap(t=>t.spawns)??[]];
  const policy=approved.enemyUpgrades.policy,levels={hp:n-(n>=8?policy.lateHpEnReduction:0),en:n-(n>=8?policy.lateHpEnReduction:0),armor:Math.floor(n/policy.armorMobilityDivisor),mobility:Math.floor(n/policy.armorMobilityDivisor),weapons:Math.floor(n/policy.weaponDivisor)};
  for(const u of defs.filter(u=>u.side==='enemy'))expect(u.upgrades,`${n}/${u.id}`).toEqual(levels);
  const s=createBattle(pack.rules,stage,1),u=s.units.find(u=>u.side==='enemy')!;expect(behaviorOf(s,u)).toBeDefined();const m=s.content.mechs.find(m=>m.id===u.mechId)!,base={...m,...m.forms?.[0]?.overrides},w=s.content.weapons.find(w=>w.id===base.weapons[0])!;expect(effectiveMech(s,u).hp).toBe(base.hp+levels.hp*300);expect(effectiveWeapon(s,u,w).power).toBe(w.fixedPower?w.power:Math.round(w.power*(1+levels.weapons*.1)));
 }
});

// No campaign/sim is played: inspect fresh sorties and serialized state only.
import {deployment} from '@engine/src/campaign/session';
import {newCampaign} from '@engine/src/campaign/state';
import {CoreCampaign} from '@engine/src/v2/adapter/campaign';
import {TrainingSaves} from '@engine/src/v2/adapter/saves';
import {packLookup} from '@engine/src/v2/pack/load';
for(const [cycle,n,level]of [[1,1,1],[1,5,5],[1,8,8],[1,15,15],[2,1,16],[2,15,30],[3,1,31]])it(`SAW cycle ${cycle} episode ${n}: effective enemy level ${level}`,async()=>{
 const campaign=newCampaign();campaign.cycle=cycle;
 const stage=deployment(pack.campaign.stages[`saw-${String(n).padStart(2,'0')}`].stage,campaign,pack.rules),b=createBattle(pack.rules,stage,1);
 for(const u of b.units.filter(u=>u.side==='enemy'))expect(u.upgrades).toEqual({hp:level,en:level,armor:Math.floor(level/2),mobility:Math.floor(level/2),weapons:Math.floor(level/2)});
 const bytes=new Map<string,string>(),saves=new TrainingSaves({read:async k=>bytes.get(k)??null,replace:async(k,v)=>{bytes.set(k,v);}},pack.campaign,pack.rules,pack.training),m=new CoreCampaign(pack.campaign,pack.rules,saves,packLookup(pack,{}),undefined,[],pack);
 m.newGame({name:'검사',preset:0,line:'real'});m.session.campaign.cycle=cycle;m.session.campaign.node=pack.campaign.nodes.findIndex(row=>row.type==='stage'&&row.id===stage.id);m.advance(false);await m.save('auto');await m.load('auto');expect(m.session.campaign.cycle).toBe(cycle);expect(m.session.game!.battle.stage.enemyUpgradeLevel).toBe(level);
});
it('SAW retry keeps only experience and funds',()=>expect(pack.rules.rules.retryOnDefeat).toEqual({keep:['exp','credits']}));

it('numeric adjustment buys all machines ten levels without changing any upgrade price',()=>{
 const a=approved.numericAdjustments,old=approved.proposal.rules.upgrade,r=pack.rules.rules;
 expect(r.upgradeCost).toEqual(old.otherStepPrices);expect(r.upgradeLimits!.weapons!.costs).toEqual(old.ngPlusStepPrices);
 const cost=4*r.upgradeCost.reduce((a,b)=>a+b,0)+r.upgradeLimits!.weapons!.costs.slice(0,10).reduce((a,b)=>a+b,0);expect(cost).toBe(48310);
 for(const row of Object.values(a.calculation.routes)){expect(row.required).toBe(row.units.length*cost);expect(row.afterRequired/row.required).toBeGreaterThanOrEqual(.9);expect(row.afterRequired/row.required).toBeLessThanOrEqual(1);expect(row.afterAll/row.required).toBeGreaterThanOrEqual(1);expect(row.afterAll/row.required).toBeLessThanOrEqual(1.3);
  let required=0,all=0;for(const ep of row.episodes){const id=`saw-${String(ep.episode).padStart(2,'0')}`,s=createBattle(pack.rules,pack.campaign.stages[id].stage,1),defs=[...s.stage.units,...s.stage.definitions??[],...Object.values(s.stage.waves??{}).flat()],credits=(ids:string[])=>ids.reduce((n,id)=>{const u=defs.find(u=>u.id===id)!;return n+(s.content.mechs.find(m=>m.id===u.mechId)!.credits??0);},0);
   expect(credits(ep.requiredIds)).toBe(ep.after.defeatRequired);expect(credits(ep.fullClearIds)).toBe(ep.after.defeatAll);required+=ep.after.clear+credits(ep.requiredIds);all+=ep.after.clear+credits(ep.fullClearIds);
  }expect(required).toBe(row.afterRequired);expect(all).toBe(row.afterAll);
 }
});
it('all first-cycle enemy pilots use the declared matching-stat ratios, including forms and scripted reinforcements',()=>{
 for(let n=1;n<=15;n++){const id=`saw-${String(n).padStart(2,'0')}`,s=createBattle(pack.rules,pack.campaign.stages[id].stage,1),scale=s.stage.enemyPilotScaling!,defs=[...s.stage.units,...s.stage.definitions??[],...Object.values(s.stage.waves??{}).flat()];
  for(const def of defs.filter(u=>u.side==='enemy')){const u={...def,effects:[],level:Math.max(1,Math.round(scale.baseline.level*scale.units[def.id].ratio))}as any,p=effectivePilot(s,u),target=scale.units[def.id];for(const key of Object.keys(scale.baseline.stats)as (keyof typeof p.stats)[])expect(p.stats[key]).toBe(Math.round(scale.baseline.stats[key]*target.ratio));if(target.actionCap===1)expect(actionLimit(s,u)).toBe(1);}
 }
});
it('NG+ stats follow carried levels/training and coexist with cycle upgrades after save/load',async()=>{
 const bytes=new Map<string,string>(),saves=new TrainingSaves({read:async k=>bytes.get(k)??null,replace:async(k,v)=>{bytes.set(k,v);}},pack.campaign,pack.rules,pack.training),m=new CoreCampaign(pack.campaign,pack.rules,saves,packLookup(pack,{}),undefined,[],pack);
 m.newGame({name:'검사',preset:0,line:'super'});m.session.campaign.cycle=2;for(const u of m.session.campaign.roster)u.level=40;m.setStoryValue('v2:training',JSON.stringify({pilots:{player:{points:0,stats:{shoot:3,skill:2},skills:{}}}}));m.advance(false);const b=m.session.game!.battle,base=b.stage.enemyPilotScaling!.baseline;expect(base.level).toBe(40);const ally=b.units.filter(u=>u.side==='player'),avg=ally.reduce((n,u)=>n+effectivePilot(b,u).stats.shoot,0)/ally.length;expect(base.stats.shoot).toBe(avg);
 for(const u of b.units.filter(u=>u.side==='enemy')){expect(u.upgrades).toMatchObject({hp:16,weapons:8});const target=b.stage.enemyPilotScaling!.units[u.id];expect(effectivePilot(b,u).stats.skill).toBe(Math.round(base.stats.skill*target.ratio));if(target.actionCap===1)expect(actionLimit(b,u)).toBe(1);}
 await m.save('auto');await m.load('auto');expect(m.session.game!.battle.stage.enemyPilotScaling!.baseline).toEqual(base);expect(m.session.campaign.cycle).toBe(2);
});
