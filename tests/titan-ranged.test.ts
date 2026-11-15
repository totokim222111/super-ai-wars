import {describe,it,expect} from 'vitest';
import {createBattle,apply,responseOptions,chooseResponse,availableWeapons,weaponProblem} from '@engine/src/core';
import {testPack as pack} from './pack-fixture';

describe('Titan long-range counterattack overlay',()=>{
 for(const [generation,power] of [[1,2000],[2,2500],[3,3100]]){
  const id=`player-super-generation-${generation}-weapon-2`;
  it(`keeps generation ${generation} resources, attributes and presentation explicit`,()=>{
   const w=pack.rules.weapons.find(w=>w.id===id)!;
   expect(w).toMatchObject({power,range:[1,7],ammo:40,en:0,postMove:false,kind:'shoot'});
  });
  it(`offers and recommends generation ${generation} counterfire at every distance 3–7, even after movement`,()=>{
   for(let distance=3;distance<=7;distance++){
    const content=structuredClone(pack.rules),stage=structuredClone(pack.campaign.stages['saw-01'].stage);
    const player=stage.units.find(u=>u.id==='player')!,enemy=stage.units.find(u=>u.side==='enemy')!;
    stage.scenario=false;stage.units=[{...player,mechId:`player-super-generation-${generation}`,x:1,y:5},{...enemy,x:1+distance,y:5}];
    // A harmless fixture attacker isolates range/recommendation from the unchanged low-HP safety policy.
    const mech=content.mechs.find(m=>m.id===enemy.mechId)!;
    const shot={...content.weapons.find(w=>w.kind==='shoot')!,id:'test-incoming',range:[1,7]as[number,number],power:100,en:0,ammo:40,moraleReq:0};
    content.weapons.push(shot);content.mechs.push({...mech,id:'test-incoming-mech',weapons:[shot.id]});stage.units[1].mechId='test-incoming-mech';
    let s=createBattle(content,stage,7),p=s.units.find(u=>u.id===player.id)!;
    p.moved=true;p.acted=true;p.morale=100;
    expect(weaponProblem(s,p,content.weapons.find(w=>w.id===id)!,s.units.find(u=>u.id===enemy.id)!)).toContain('after moving');
    s=apply(s,{type:'endPhase'}).state;
    s=apply(s,{type:'attack',unitId:enemy.id,targetId:player.id,weaponId:shot.id}).state;
    expect(s.pending).not.toBeNull();
    expect(responseOptions(s)).toContainEqual({type:'counter',weaponId:id});
    expect(chooseResponse(s,player.id,enemy.id)).toEqual({type:'counter',weaponId:id});
    expect(availableWeapons(s,player.id,enemy.id,true).some(w=>w.id===id)).toBe(true);
    const result=apply(s,{type:'respond',response:{type:'counter',weaponId:id}}).state;
    expect(result.units.find(u=>u.id===player.id)!.ammo[id]).toBe(39);
   }
  });
 }
});
