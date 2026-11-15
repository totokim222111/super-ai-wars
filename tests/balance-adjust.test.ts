import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {testPack as pack} from './pack-fixture';
import {createBattle} from '@engine/src/core';
import {prepareRules,applyRules,rulesProjection,setRuleVariable,ruleCommand,runtime,nextRulesAI,comboProblem} from '@engine/src/v2/rules/runtime';
import {configOf} from '@engine/src/v2/rules/config';
const contract=JSON.parse(readFileSync(new URL('../tools/balance-v2-approved.json',import.meta.url),'utf8'));
const battle=(n:number)=>prepareRules(createBattle(pack.rules,pack.campaign.stages[`saw-${String(n).padStart(2,'0')}`].stage,1,{autoResponse:true}));
describe('bounded release adjustments',()=>{
 it('applies every declared HP only in its stage, including armed/form aliases',()=>{for(const row of contract.adjustments.bossHp){const s=battle(row.episode),id=contract.proposal.compiledMechAliases[row.id]??row.id;expect(s.content.mechs.find(m=>m.id===id)!.hp).toBe(row.hp.value);}});
 it('changes only HP when adding a canonical override for a generated form',()=>{const s=battle(14),id=contract.proposal.compiledMechAliases['v2-forms-saw-14-pico-shell'];expect(s.content.mechs.find(m=>m.id===id)!.mobility).toBe(contract.proposal.mechs.find((m:any)=>m.id===id).base.mobility);});
 it('keeps the episode14 grunt curve when the same model is a mini-boss in13',()=>{const b=battle(14);expect(b.content.mechs.find(m=>m.id==='like-drone-episode-14')!.hp).toBe(contract.proposal.enemyStageCurves['14']['like-drone-episode-14'].base.hp);});
 it('strips provisional display names without colliding within a mech',()=>{for(const w of pack.rules.weapons)expect(w.name).not.toMatch(/\(가칭\)/);for(const m of JSON.parse(readFileSync(new URL('../pack/data/mechs.json',import.meta.url),'utf8'))){const names=m.weapons.map(id=>pack.rules.weapons.find(w=>w.id===id)!.name);expect(new Set(names).size).toBe(names.length);}});
 it('copies a combination as a weapon without requiring the original ally participants to act again',()=>{let s=battle(10);const co=configOf(s.stage).combos.find(c=>c.id==='user-gpi')!;Object.assign(s.units.find(u=>u.id==='player')!,{x:3,y:5,morale:150});Object.assign(s.units.find(u=>u.id==='gpi')!,{x:4,y:5,morale:150});Object.assign(s.units.find(u=>u.id==='minimax')!,{x:5,y:5});setRuleVariable(s,co.flag,30);expect(comboProblem(s,co)).toBeUndefined();s=applyRules(s,{type:'attack',unitId:co.lead,targetId:'minimax',weaponId:co.virtual}).state;s=applyRules(s,{type:'endPhase'}).state;expect(runtime(s).copies.minimax.weapon).toBe(co.virtual);Object.assign(s.units.find(u=>u.id==='minimax')!,{morale:150});const before=s.units.filter(u=>u.id==='gpi'||u.id==='player').map(u=>[u.id,u.actionsSpent,u.en]);const result=applyRules(s,{type:'attack',unitId:'minimax',targetId:'gpi',weaponId:co.virtual});expect(result.events.some(e=>e.type==='attack'&&e.attackerId==='minimax')).toBe(true);for(const [id,spent]of before)expect(result.state.units.find(u=>u.id===id)!.actionsSpent).toBe(spent);});
});
