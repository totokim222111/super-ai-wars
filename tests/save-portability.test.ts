import{it,expect}from'vitest';import{readFileSync}from'node:fs';
import{testPack as pack}from'./pack-fixture';
import{CoreCampaign}from'@engine/src/v2/adapter/campaign';import{TrainingSaves}from'@engine/src/v2/adapter/saves';import{packLookup}from'@engine/src/v2/pack/load';
import{restoreSave,makeSave}from'@engine/src/campaign/saves';import{fingerprint}from'@engine/src/campaign/session';import{encodeSaveCode,decodeSaveCode}from'@engine/src/campaign/save-code';import{SessionBytes}from'@engine/src/platform/storage';
const old=()=>JSON.parse(readFileSync(new URL('./fixtures/save-public-before-portable.json',import.meta.url),'utf8'));
it('reproduces the previous release fingerprint and restarts exactly stage eight once',async()=>{
 const f=old();expect(f.contentVersion).toBe(2181514167);expect(f.contentVersion).not.toBe(fingerprint(pack.campaign));const map=new Map([['1',JSON.stringify(f)]]),saves=new TrainingSaves({read:async k=>map.get(k)??null,replace:async(k,v)=>{map.set(k,v);}},pack.campaign,pack.rules,pack.training);
 await saves.init();expect(saves.slots.find(s=>s.id==='1')?.status).toBe('ok');const first=await saves.load('1');expect(first.session.game).toBeNull();expect(first.session.screen).toBe('intermission');expect(pack.campaign.nodes[first.session.campaign.retryNode!]).toEqual({type:'stage',id:'saw-08'});expect(first.session.campaign.cleared).toEqual(f.stageStart.cleared);expect(first.file.migrationNotice?.restartedStage).toBe(true);expect((await saves.load('1')).file.migrationNotice).toBeUndefined();
});
it('maps campaign IDs across node changes and retains investments, training, flags and NG+ cycle',()=>{
 const f=old();delete f.battle;delete f.scenario;f.screen='intermission';f.progress={stage:'saw-08'};f.campaign.cycle=2;f.campaign.credits=34567;f.campaign.affection={gpi:42};f.campaign.flags.special=true;f.campaign.roster[0].upgrades={hp:10,en:5,armor:2,mobility:1,weapons:3};f.campaign.roster[0].level=25;f.campaign.roster[0].exp=17;
 const result=restoreSave(f,pack.campaign,pack.rules);expect(result.session.campaign).toMatchObject({cycle:2,credits:34567,affection:{gpi:42},flags:{special:true}});expect(result.session.campaign.roster[0]).toMatchObject({level:25,exp:17,upgrades:f.campaign.roster[0].upgrades});expect(restoreSave(result.file,pack.campaign,pack.rules).session).toEqual(result.session);
});
it('drops missing IDs, refunds obsolete upgrades and rejects corrupt/foreign saves',()=>{
 const f=old();delete f.battle;f.screen='intermission';f.campaign.roster.push({...structuredClone(f.campaign.roster[0]),id:'removed-unit',upgrades:{hp:2,en:0,armor:0,mobility:0,weapons:0}});f.campaign.parts.push('deleted-part');const result=restoreSave(f,pack.campaign,pack.rules);expect(result.session.campaign.roster.some(u=>u.id==='removed-unit')).toBe(false);expect(result.file.migrationNotice!.refund).toBeGreaterThan(0);expect(result.session.campaign.parts).not.toContain('deleted-part');
 for(const mutate of [(x:any)=>x.packId='foreign',(x:any)=>x.campaign.credits=-1,(x:any)=>x.campaign.roster.push(x.campaign.roster[0]),(x:any)=>x.saveVersion=99,(x:any)=>x.battle.battle='{}']){const bad=old();mutate(bad);expect(()=>restoreSave(bad,pack.campaign,pack.rules)).toThrow();}
});
it('backs up and imports validated slots even with a memory-only store',async()=>{
 const bytes=new SessionBytes({read:async()=>{throw Error('blocked')},replace:async()=>{throw Error('blocked')}});const saves=new TrainingSaves(bytes,pack.campaign,pack.rules,pack.training),model=new CoreCampaign(pack.campaign,pack.rules,saves,packLookup(pack,{}),undefined,[],pack);model.newGame({name:'저장검사',preset:0,line:'super'});
 await bytes.probe();const before=makeSave(model.session,pack.campaign,0);await saves.write('1',before);const code=await model.saveCode();expect(JSON.parse(decodeSaveCode(code)).format).toBe('saw:slots:2');await model.importSaveCode(code);expect((await saves.load('1')).session.campaign).toEqual(model.session.campaign);const current=makeSave(model.session,pack.campaign,0),restored=restoreSave(current,pack.campaign,pack.rules);expect(makeSave(restored.session,pack.campaign,0,current.savedAt)).toEqual(current);
 const other=JSON.parse(decodeSaveCode(code));other.format='other:slots:2';await expect(model.importSaveCode(encodeSaveCode(JSON.stringify(other)))).rejects.toThrow();
});
