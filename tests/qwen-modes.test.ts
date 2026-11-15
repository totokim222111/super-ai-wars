import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {testPack as pack} from './pack-fixture';
import {packLookup} from '@engine/src/v2/pack/load';
import {BattleLinePicker} from '@engine/src/v2/battle/lines';
import {createBattle,effectiveMech} from '@engine/src/core';
import {prepareRules,applyRules,ruleCommand} from '@engine/src/v2/rules/runtime';
import {CoreMap} from '@engine/src/v2/adapter/map';
const original=JSON.parse(readFileSync(new URL('../tools/qwen-modes-approved.json',import.meta.url),'utf8'));
const modes={'메가데레':'megadere','얀데레':'yandere','악의축':'axis'};
describe('Carbon Qwen mode slots and exact speech',()=>{
 for(const [name,mode]of Object.entries(modes))it(name+' has precisely two ordered authored roles, with priority speech on both weapons',()=>{
  for(const gen of[1,2,3]){const m=pack.rules.mechs.find(m=>m.id===`qwen-${mode}-generation-${gen}`)!;expect(m.weapons).toHaveLength(2);const w=m.weapons.map(id=>pack.rules.weapons.find(w=>w.id===id)!);expect(w.map(w=>w.name)).toEqual(original.weapons.filter((r:any)=>r.mode===name).map((r:any)=>r.name));
   if(mode==='megadere'){expect(w[0].special?.kind).toBe('restore');expect(w[1].power).toBeGreaterThan(0);}
   if(mode==='yandere'){expect(w[0].kind).toBe('melee');expect(w[1].finisher).toBe(true);}
   if(mode==='axis'){expect(w[0]).toMatchObject({kind:'shoot',postMove:true});expect(w[1].special).toMatchObject({kind:'status',target:'self'});}
   for(const id of m.weapons){expect(pack.weapons[id].lineSource).toBe(id);for(const cast of['qwen','qwen-axis','qwen-yandere','qwen-megadere'])expect(new BattleLinePicker(7).pick(pack.cast[cast].battleLines,'finisher',id,undefined,{form:name})).toEqual(original.lines[name]);}
  }
 });
 it.each(['메가데레','악의축'])('%s support command emits its exact mode speech and applies the effect',name=>{
  const stage=structuredClone(pack.campaign.stages['saw-12'].stage),def=[...stage.units,...stage.definitions??[]].find(u=>u.id==='qwen')!;stage.units=[...stage.units.filter(u=>u.id!=='qwen'),def];let s=prepareRules(createBattle(pack.rules,stage,7));s=applyRules(s,ruleCommand({kind:'form',id:'qwen',form:name})).state;const q=s.units.find(u=>u.id==='qwen')!,target=s.units.find(u=>u.id==='player')!;target.x=q.x+1;target.y=q.y;target.hp-=100;const w=effectiveMech(s,q).weapons[name==='메가데레'?0:1],model=new CoreMap(s,packLookup(pack,{})),events=model.weaponSkill(q.id,{col:q.x,row:q.y},w);expect(events.find(e=>e.type==='speech')).toMatchObject({text:original.lines[name].text,mood:original.lines[name].mood});if(name==='메가데레')expect(model.state().units.find(u=>u.id===target.id)!.hp).toBeGreaterThan(target.hp);else expect(model.state().units.find(u=>u.id==='qwen')!.effects.some(e=>e.definitionId===w)).toBe(true);
 });
});
