import {describe,it,expect}from'vitest';
import{readFileSync}from'node:fs';
import{execFileSync}from'node:child_process';
import weapons from'../pack/data/weapons.json';
import mechs from'../pack/data/mechs.json';
import sidecar from'../pack/weapons.json';
import studioPlan from'../tools/anim-plan-approved.json';
import palette from'../tools/anim-colors-approved.json';
import{approved,applyPlan,assignmentIssues}from'../tools/apply_anim_plan.mjs';
import{sequenceIssues,sequenceSeconds,type SequenceAnim}from'@engine/src/v2/battle/moves/catalog';
import{TEMPLATES}from'@engine/src/v2/battle/templates';
describe('approved composable weapon presentations',()=>{
 it('replaces historical distribution snapshots with the complete authored name contract',()=>{
  expect(approved).toEqual(studioPlan);expect(approved.plans).toHaveLength(385);expect(approved.newProps).toHaveLength(17);expect(applyPlan(weapons,sidecar)).toEqual(sidecar);
  const names=new Map(approved.plans.map((p:{name:string})=>[p.name,p]));
  for(const w of weapons){const p=names.get(w.name)as{skip?:string;moves:unknown;element:string;closer:string};expect(p,w.id).toBeDefined();const row=sidecar[w.id as keyof typeof sidecar];expect(TEMPLATES[row.anim.template]).toBeDefined();if(p.skip==='support')continue;
   expect(row.anim).toMatchObject({template:'sequence',moves:p.moves,element:p.element,closer:p.closer,color:palette[w.id as keyof typeof palette]});expect(sequenceIssues(row.anim),w.id).toEqual([]);expect(sequenceSeconds(row.anim as unknown as SequenceAnim)).toBeLessThanOrEqual(p.closer==='none'?4:8);if(w.finisher)expect('cutin'in row&&row.cutin,w.id).toBe(true);
  }
 });
 it('keeps same-name choreography equal across generations and ranks visual tiers by power',()=>{
  for(const name of new Set(weapons.map(w=>w.name))){const rows=weapons.filter(w=>w.name===name).sort((a,b)=>a.power-b.power),animations=rows.map(w=>sidecar[w.id as keyof typeof sidecar].anim);if(animations[0].template!=='sequence')continue;const cores=animations.map(a=>{const{tier,color,...core}=a as unknown as SequenceAnim;void tier;void color;return core;});expect(cores.every(a=>JSON.stringify(a)===JSON.stringify(cores[0])),name).toBe(true);for(let i=1;i<animations.length;i++)expect((animations[i]as unknown as SequenceAnim).tier).toBeGreaterThanOrEqual((animations[i-1]as unknown as SequenceAnim).tier);}
 });
 it('reports the six plan-induced collisions, with no silent reassignment',()=>{
  const actual=assignmentIssues(weapons,mechs);expect(actual).toHaveLength(6);expect(actual.map((i:{mech:string;kind:string;key:string})=>[i.mech,i.kind,i.key])).toEqual(JSON.parse(readFileSync(new URL('./fixtures/approved-anim-collisions.json',import.meta.url),'utf8')));
 });
 it('is idempotent and its check does not change numeric content',()=>{
  const before=JSON.stringify(weapons);expect(applyPlan(weapons,applyPlan(weapons,sidecar))).toEqual(sidecar);expect(JSON.stringify(weapons)).toBe(before);expect(execFileSync(process.execPath,['tools/apply_anim_plan.mjs','--check'],{cwd:new URL('..',import.meta.url),encoding:'utf8'})).toContain('786 weapons');
 });
});
