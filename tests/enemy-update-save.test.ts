import {it,expect} from 'vitest';
import {testPack as pack} from './pack-fixture';
import {CoreCampaign} from '@engine/src/v2/adapter/campaign';
import {TrainingSaves} from '@engine/src/v2/adapter/saves';
import {packLookup} from '@engine/src/v2/pack/load';
import {makeSave,restoreSave} from '@engine/src/campaign/saves';
import {fingerprint} from '@engine/src/campaign/session';
import {availableActions,apply} from '@engine/src/core';
import {rulesProjection} from '@engine/src/v2/rules/runtime';
it('refreshes release13 enemy definitions while preserving purchased allied upgrades and funds',()=>{
 const old=pack.campaign.saveMigrations!.find(c=>c.preserveUpgrades)!,store={read:async()=>null,replace:async()=>{}},saves=new TrainingSaves(store,old.campaign,old.content);
 const m=new CoreCampaign(old.campaign,old.content,saves,packLookup(pack,{}),undefined,[],pack);m.newGame({name:'검사',preset:0,line:'real'});
 m.session.campaign.credits=12345;for(const c of [m.session.campaign,m.session.stageStart])c.roster[0].upgrades={hp:2,en:1,armor:1,mobility:0,weapons:3};
 const file=makeSave(m.session,old.campaign,100),result=restoreSave(file,pack.campaign,pack.rules);
 expect(result.session.campaign.credits).toBe(12345);expect(result.session.campaign.roster[0].upgrades).toEqual(file.campaign.roster[0].upgrades);expect(result.file.migrationNotice?.refund).toBe(0);
 expect(result.session.game!.battle.units.find(u=>u.side==='enemy')!.upgrades?.hp).toBe(1);expect(()=>restoreSave(result.file,pack.campaign,pack.rules)).not.toThrow();
});

for(const episode of [1,8,15])it(`release13 episode ${episode} save migrates to this release without losing investment`,()=>{
 const old=pack.campaign.saveMigrations!.find(c=>c.preserveUpgrades)!;
 const storage={read:async()=>null,replace:async()=>{}},saves=new TrainingSaves(storage,old.campaign,old.content);
 const m=new CoreCampaign(old.campaign,old.content,saves,packLookup(pack,{}),undefined,[],pack);
 m.newGame({name:'검사',preset:0,line:'real'});
 const id=`saw-${String(episode).padStart(2,'0')}`,stage=old.campaign.stages[id].stage;
 m.session.campaign.node=old.campaign.nodes.findIndex(n=>n.type==='stage'&&n.id===id);
 m.session.campaign.cleared=Array.from({length:episode-1},(_,i)=>`saw-${String(i+1).padStart(2,'0')}`);
 m.session.campaign.roster=structuredClone(stage.units.filter(u=>u.side==='player'));
 m.session.campaign.credits=12345;
 for(const u of m.session.campaign.roster)u.upgrades={hp:2,en:1,armor:1,mobility:0,weapons:3};
 m.setStoryValue('v2:training',JSON.stringify({pilots:{gpi:{points:321,stats:{shoot:1},skills:{}}}}));
 m.session.screen='intermission';m.advance(false);
 const file=makeSave(m.session,old.campaign,100),result=restoreSave(file,pack.campaign,pack.rules),c=result.session.campaign,b=result.session.game!.battle;
 expect(old.from).toContain(file.contentVersion);expect(file.contentVersion).not.toBe(fingerprint(pack.campaign));expect(result.file.contentVersion).toBe(fingerprint(pack.campaign));
 expect(c.credits).toBe(file.campaign.credits);expect(c.roster).toEqual(file.campaign.roster);expect(c.flags).toEqual(file.campaign.flags);expect(c.affection).toEqual(file.campaign.affection);expect(c.parts).toEqual(file.campaign.parts);expect(c.cleared).toEqual(file.campaign.cleared);
 expect(result.file.migrationNotice?.refund).toBe(0);
 for(const u of b.units.filter(u=>u.side==='enemy'))expect(u.upgrades).toEqual({hp:episode,en:episode,armor:Math.floor(episode/2),mobility:Math.floor(episode/2),weapons:Math.floor(episode/2)});
 const actor=b.units.find(u=>u.alive&&u.side==='player'&&!u.acted)!;const projected=rulesProjection(b,actor.id),wait=availableActions(projected,actor.id).find(c=>c.type==='wait')!;
 expect(wait).toBeDefined();expect(()=>apply(projected,wait)).not.toThrow();expect(()=>restoreSave(result.file,pack.campaign,pack.rules)).not.toThrow();
});
