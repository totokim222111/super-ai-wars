import {it,expect} from 'vitest';
import {testPack as pack} from './pack-fixture';
import {definitions} from '@engine/src/scenario/compile';
import {createBattle} from '@engine/src/core';
import {BattleLinePicker} from '@engine/src/v2/battle/lines';
import approved from '../tools/enemy-weapons-approved.json';
it('all 85 names match literal manuscripts and all 23 special names survive compiled stage/forms',()=>{
 for(const [id,name]of Object.entries(approved.names))expect(pack.rules.weapons.find(w=>w.id===id)?.name,id).toBe(name);
 const battleStages=Object.values(pack.campaign.stages).map(item=>({stage:item.stage,state:createBattle(pack.rules,item.stage,1)}));
 for(const row of approved.specials){const id='zako-special-'+row.family;expect(pack.rules.weapons.find(w=>w.id===id)?.name).toBe(row.name);let seen=false;
  for(const {stage,state:s} of battleStages){for(const u of definitions(stage)){if(!u.mechId.startsWith(row.family+'-episode-'))continue;const m=s.content.mechs.find(m=>m.id===u.mechId)!;expect(m.weapons,id+'/'+m.id).toContain(id);seen=true;}}
  expect(seen,row.family).toBe(true);
 }
});
it('new special weapons fall back to the existing generic attack line without changing the text',()=>{const bank=pack.cast['spam']?.battleLines??Object.values(pack.cast).find(c=>c.name==='스팸 봇')?.battleLines??pack.battleDialogue?.defaults?.enemy;const line=new BattleLinePicker(7).pick(bank,'attack','zako-special-spam-bot');expect(line?.text).toBeTruthy();expect(bank?.attack?.some(v=>v.text===line?.text)).toBe(true);});

it('the sniper variant uses the existing range system with one extra square and finite resources',()=>{const base=pack.rules.weapons.find(w=>w.id==='proxy-episode-9-normal')!,w=pack.rules.weapons.find(w=>w.id==='zako-special-proxy')!;expect(w.range[1]).toBe(base.range[1]+1);expect(w.ammo).toBe(2);expect(w.en).toBe(10);});
