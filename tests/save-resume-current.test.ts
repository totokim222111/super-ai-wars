import{describe,it,expect,vi}from'vitest';
import{testPack as pack}from'./pack-fixture';
import{CoreCampaign}from'@engine/src/v2/adapter/campaign';
import{TrainingSaves}from'@engine/src/v2/adapter/saves';
import{CoreMap}from'@engine/src/v2/adapter/map';
import{packLookup}from'@engine/src/v2/pack/load';
import{makeSave}from'@engine/src/campaign/saves';
import{nextRulesAI}from'@engine/src/v2/rules/runtime';
import{validCommandShape}from'@engine/src/core/command-contract';
import{snapshot}from'@engine/src/core';
function setup(){const values=new Map<string,string>(),store={read:async(k:string)=>values.get(k)??null,replace:async(k:string,v:string)=>{values.set(k,v)}},saves=new TrainingSaves(store,pack.campaign,pack.rules,pack.training),lookup=packLookup(pack,{}),model=new CoreCampaign(pack.campaign,pack.rules,saves,lookup,undefined,[],pack);model.newGame({name:'검사',preset:0,line:'super'});model.advance(false);return{values,saves,lookup,model};}
describe('current public save validation',()=>{
 it('roundtrips episode 1 Shrimp Jesus healing through the real save writer',async()=>{const{model,saves,lookup}=setup(),s=model.session.game!.battle;s.stage.scenario=true;s.phase='enemy';const map=new CoreMap(s,{...lookup,onChange:(s,c)=>model.acceptBattle(s,c)}),def=[...s.stage.units,...s.stage.definitions??[],...Object.values(s.stage.waves??{}).flat()].find(u=>u.id==='shrimp')!;map.execute({type:'system',unitId:'',action:{kind:'spawn',units:[def]}});await model.save('suspend');const hurt=map.state();hurt.units.find(u=>u.id==='shrimp')!.hp--;const healed=new CoreMap(hurt,{...lookup,onChange:(s,c)=>model.acceptBattle(s,c)});healed.execute({type:'weaponSkill',unitId:'shrimp',weaponId:'zako-special-shrimp-jesus'});await model.save('suspend');const loaded=(await saves.load('suspend')).session;expect(loaded.game!.commands.at(-1)?.type).toBe('weaponSkill');expect(snapshot(loaded.game!.battle)).toBe(snapshot(model.session.game!.battle));});
 it('silently defers failed automatic writes, preserves old bytes and retries fresh state at the next safe point',async()=>{const{model,values}=setup(),warning=vi.spyOn(console,'warn').mockImplementation(()=>{});try{await model.autoSave();const old=values.get('auto');model.session.game!.commands.push({type:'unknown'}as never);await expect(model.autoSave()).resolves.toBeUndefined();expect(values.get('auto')).toBe(old);expect(warning).toHaveBeenCalledOnce();model.session.game!.commands.pop();model.session.campaign.credits+=17;await model.autoSave();expect(JSON.parse(values.get('auto')!).campaign.credits).toBe(model.session.campaign.credits);expect(values.get('auto')).not.toBe(old);}finally{warning.mockRestore();}});
 it('gives a clear manual error and refuses malformed known commands too',async()=>{const{model,values}=setup(),warning=vi.spyOn(console,'warn').mockImplementation(()=>{});try{model.session.game!.commands.push({type:'weaponSkill',unitId:'shrimp',weaponId:9}as never);await expect(model.save('1')).rejects.toThrow('저장하지 못했습니다');expect(values.has('1')).toBe(false);for(const command of[{type:'unknown'},{type:'move',unitId:'x',x:NaN,y:0},{type:'respond',response:{type:'counter'}},{type:'__proto__'}])expect(validCommandShape(command)).toBe(false);}finally{warning.mockRestore();}});
 for(const ep of pack.game.episodes)it(`${ep.id}: automatically advances actual commands and roundtrips each command/event snapshot`,async()=>{
  const{model,saves,lookup}=setup();model.session.campaign.node=pack.campaign.nodes.findIndex(n=>n.type==='stage'&&n.id===ep.stage);model.advance(false);model.session.game!.battle.stage.scenario=true;model.session.game!.battle.options.autoResponse=true;let checks=0;
  const map=new CoreMap(model.session.game!.battle,{...lookup,onChange:(s,c)=>model.acceptBattle(s,c)});
  for(let n=0;n<4&&!map.state().outcome;n++){const command=nextRulesAI(map.state());if(!command)break;const events=map.execute(command);for(const label of['command',...events.map(e=>e.type)]){const file=makeSave(model.session,model.data,0,'2026-11-15T00:00:00.000Z');await saves.write('suspend',file);const loaded=(await saves.load('suspend')).session;expect(makeSave(loaded,model.data,0,file.savedAt),label).toEqual(file);checks++;}}
  expect(checks).toBeGreaterThan(0);
 },30000);
});
