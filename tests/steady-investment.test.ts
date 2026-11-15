import {it,expect} from 'vitest';
// @ts-ignore Plain Node sim helper, also used by the actual campaign driver.
import {investSteadily} from '../tools/steady_investment.mjs';
it('spends only available funds/learning points and equips only owned parts',()=>{
 let funds=55,points=12;const levels={weapons:0,hp:0},parts=['owned'];
 const model={funds:()=>funds,content:{mechs:[{id:'mech',partSlots:1}]},session:{campaign:{roster:[{id:'unit',mechId:'mech'}],parts}},
 upgradeUnits:()=>[{id:'unit',stats:Object.entries(levels).map(([id,level])=>({id,level,max:5,cost:20}))}],
 upgrade:(_u:string,k:keyof typeof levels)=>{if(funds<20)return false;funds-=20;levels[k]++;return true;},
 training:()=>({points,stats:[{id:'skill',value:120,cost:10}]}),train:()=>{if(points<10)return false;points-=10;return true;},
 equip:(_u:string,_slot:number,id:string)=>{expect(parts).toContain(id);parts.splice(parts.indexOf(id),1);return true;}};
 const result=investSteadily(model);expect(result.spent).toBe(40);expect(funds).toBe(15);expect(points).toBe(2);expect(result.training).toHaveLength(1);expect(parts).toEqual([]);
});
