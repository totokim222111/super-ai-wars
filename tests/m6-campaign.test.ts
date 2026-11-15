import {describe,it,expect} from 'vitest';
import {newCampaign} from '@engine/src/campaign/state';
import {previewUpgrade,upgradeMech,equipPart,unequipPart,partPreview,selectFullUpgradeBonus,swapPilots,emptyUpgrades,fullUpgradeEligible} from '@engine/src/campaign/intermission';
import {persistBattle,persistentUnit} from '@engine/src/campaign/progress';
import {enterNode,titleSession,serialize,deserialize,deployment} from '@engine/src/campaign/session';
import {campaignContent} from './pack-fixture';
import {content} from './pack-fixture';
import {apply,createBattle,effectiveMech,effectiveWeapon,validateContent,validateStage,restore,snapshot,availableActions,forecast} from '@engine/src/core';
import {m6,attach} from './core/m6-helpers';
import {deepFreeze} from './core/helpers';
function setup(){const b=m6(),c=newCampaign();c.credits=100000;c.parts=['hull','repair-kit','sea-kit'];c.roster=b.units.filter(u=>u.side==='player').map(persistentUnit);return {b,ctx:{screen:'intermission',campaign:c}};}
describe('M6 intermission APIs and persistence',()=>{
  it.each(['hp','en','armor','mobility','weapons'] as const)('previews and applies %s upgrades with costClass and immutable input',key=>{
    const {b,ctx}=setup(),before=JSON.stringify(ctx),p=previewUpgrade(deepFreeze(ctx),b.content,'p1',key,2);expect(p).toMatchObject({allowed:true,cost:600,from:0,to:2});expect(JSON.stringify(ctx)).toBe(before);
    const result=upgradeMech(ctx,b.content,'p1',key,2);expect(result.campaign.credits).toBe(99400);expect(result.campaign.roster[0].upgrades?.[key]).toBe(2);
    if(key==='weapons')expect(p.after.weaponPower.blade-p.before.weaponPower.blade).toBe(200);else expect(p.after[key]-p.before[key]).toBe(b.content.rules.upgradeStep[key]*2);
  });
  it('rejects caps, invalid steps, poor funds and non-intermission mutations',()=>{
    const {b,ctx}=setup();ctx.campaign.roster[0].upgrades={...emptyUpgrades(),hp:10};expect(previewUpgrade(ctx,b.content,'p1','hp').reason).toContain('cap');expect(()=>upgradeMech(ctx,b.content,'p1','en',11)).toThrow('cap');ctx.campaign.credits=0;expect(()=>upgradeMech(ctx,b.content,'p1','en')).toThrow('credits');ctx.screen='battle';expect(()=>equipPart(ctx,b.content,'p1',0,'hull')).toThrow('intermission');expect(()=>upgradeMech(ctx,b.content,'p1','en')).toThrow('intermission');
  });
  it('selects one full upgrade bonus only when all five categories reach threshold',()=>{
    const {b,ctx}=setup();expect(()=>selectFullUpgradeBonus(ctx,b.content,'p1','sp-bonus')).toThrow('unavailable');ctx.campaign.roster[0].upgrades={hp:5,en:5,armor:5,mobility:5,weapons:4};expect(fullUpgradeEligible(ctx.campaign.roster[0],b.content)).toBe(false);
    const upgraded=upgradeMech(ctx,b.content,'p1','weapons'),p=previewUpgrade(ctx,b.content,'p1','weapons');expect(p.bonusAvailable).toBe(true);const selected=selectFullUpgradeBonus(upgraded,b.content,'p1','sp-bonus');expect(selected.campaign.roster[0].fullUpgradeBonus).toBe('sp-bonus');expect(()=>selectFullUpgradeBonus(selected,b.content,'p1','range-bonus')).toThrow('unavailable');
    const stage=structuredClone(b.stage);stage.units[0]={...stage.units[0],...selected.campaign.roster[0]};const deployed=createBattle(b.content,stage,1);expect(deployed.units[0].sp).toBe(220);expect(effectiveMech(deployed,deployed.units[0]).hp).toBe(b.content.mechs[0].hp+1500);expect(effectiveWeapon(deployed,deployed.units[0],b.content.weapons[0]).power).toBe(b.content.weapons[0].power+500);
  });
  it.each(['mobility-bonus','air-bonus','sea-bonus','range-bonus','sp-bonus'])('projects full upgrade bonus %s from data',id=>{
    const {b,ctx}=setup();ctx.campaign.roster[0].upgrades={hp:5,en:5,armor:5,mobility:5,weapons:5};const next=selectFullUpgradeBonus(ctx,b.content,'p1',id);
    const stage=deployment(b.stage,next.campaign,b.content),state=createBattle(b.content,stage,1),u=state.units[0],m=effectiveMech(state,u);
    if(id==='mobility-bonus')expect(m.move).toBe(b.content.mechs[0].move+1);
    if(id==='air-bonus')expect(m.adapt.air).toBe('S');if(id==='sea-bonus')expect(m.adapt.sea).toBe('S');
    if(id==='range-bonus')expect(effectiveWeapon(state,u,state.content.weapons[0]).range[1]).toBe(state.content.weapons[0].range[1]+1);
    if(id==='sp-bonus')expect(u.sp).toBe(220);
  });
  it('equips, replaces and removes owned parts with a pure stat preview',()=>{
    const {b,ctx}=setup();const p=partPreview(deepFreeze(ctx),b.content,'p1',0,'hull');expect(p.after.hp-p.before.hp).toBe(1000);let next=equipPart(ctx,b.content,'p1',0,'hull');expect(next.campaign.parts).toEqual(['repair-kit','sea-kit']);next=equipPart(next,b.content,'p1',0,'sea-kit');expect(next.campaign.parts).toEqual(['repair-kit','hull']);next=unequipPart(next,b.content,'p1',0);expect(next.campaign.parts).toEqual(['repair-kit','hull','sea-kit']);expect(next.campaign.roster[0].parts?.[0]).toBeNull();expect(ctx.campaign.roster[0].parts).toBeUndefined();
    expect(()=>equipPart(ctx,b.content,'p1',4,'hull')).toThrow('slot');expect(()=>equipPart(ctx,b.content,'p1',0,'battery')).toThrow('owned');
  });
  it('keeps upgrades, parts and full bonus on the mech when pilots exchange seats',()=>{
    const {ctx}=setup();ctx.campaign.roster[0].upgrades={hp:5,en:5,armor:5,mobility:5,weapons:5};ctx.campaign.roster[0].parts=['hull'];ctx.campaign.roster[0].fullUpgradeBonus='range-bonus';ctx.campaign.roster[0].level=9;ctx.campaign.roster[0].exp=77;ctx.campaign.roster[1].level=2;
    const next=swapPilots(ctx,'p1','p2');expect(next.campaign.roster[0]).toMatchObject({pilotId:'pilot-2',level:2,parts:['hull'],fullUpgradeBonus:'range-bonus',upgrades:ctx.campaign.roster[0].upgrades});expect(next.campaign.roster[1]).toMatchObject({pilotId:'pilot-1',level:9,exp:77});
  });
  it('persists pilot growth, loadout and battle funds once, excluding spent consumable state',()=>{
    const {b,ctx}=setup();b.units[0].level=4;b.units[0].exp=85;b.units[0].usedItems=[0];b.units[0].parts=['repair-kit'];b.units[0].upgrades={...emptyUpgrades(),hp:2};b.credits=700;
    const c=persistBattle(ctx.campaign,b),again=persistBattle(c,b);expect(c.credits).toBe(100700);expect(again).toEqual(c);expect(c.roster[0]).toMatchObject({level:4,exp:85,parts:['repair-kit'],upgrades:{hp:2}});expect(c.roster[0]).not.toHaveProperty('usedItems');
    const next=deployment(b.stage,c,b.content),state=createBattle(b.content,next,1);expect(state.units[0]).toMatchObject({level:4,exp:85});expect(state.units[0].usedItems).toBeUndefined();
  });
  it('saves and resumes grown battle/intermission roster and rejects corrupt loadout',()=>{
    const s=enterNode(titleSession(),campaignContent,content);const gem=s.game!.battle.units.find(u=>u.id==='gem')!;gem.level=5;gem.exp=99;s.campaign=persistBattle(s.campaign,s.game!.battle);s.game!.scenario!.campaign=s.campaign;
    const loaded=deserialize(serialize(s,campaignContent),campaignContent,content);expect(loaded.game!.battle.units.find(u=>u.id==='gem')).toMatchObject({level:5,exp:99});expect(loaded.campaign.roster.find(u=>u.id==='gem')).toMatchObject({level:5,exp:99});
    const bad=JSON.parse(serialize(s,campaignContent));bad.session.campaign.roster[0].upgrades={hp:999,en:0,armor:0,mobility:0,weapons:0};expect(()=>deserialize(JSON.stringify(bad),campaignContent,content)).toThrow('upgrades');
  });
  it('retains original component machines and pilot progress when saving a combined roster',()=>{
    const {b,ctx}=setup();b.content.combinations=[{id:'link',parts:['mech-a','mech-b'],result:'mech-c'}];const combined=apply(b,{type:'combine',unitId:'p1',combinationId:'link'}).state;combined.units[0].level=4;
    const c=persistBattle(ctx.campaign,combined);expect(c.roster.map(u=>u.mechId)).toEqual(['mech-a','mech-b']);expect(c.roster[0].level).toBe(4);
  });
});
describe('M6 authoring validation and read-only APIs',()=>{
  it.each(['spirit-reference','skill-level','part-slots','map-shape','form-weapon','combination','atom','upgrade-table'])('rejects malformed %s',kind=>{
    const s=m6(),c=s.content;
    if(kind==='spirit-reference')c.pilots[0].spirits![0].id='missing';if(kind==='skill-level')c.pilots[0].skills=[{id:'support-fire',level:99}];if(kind==='part-slots')c.mechs[0].partSlots=5;
    if(kind==='map-shape')c.weapons[0].map={shape:'bad',size:1,friendlyFire:false} as unknown as NonNullable<typeof c.weapons[0]['map']>;
    if(kind==='form-weapon')c.mechs[0].forms=[{id:'bad',name:'Bad',overrides:{weapons:['missing']}}];if(kind==='combination')c.combinations=[{id:'bad',parts:['mech-a','missing'],result:'mech-c'}];if(kind==='atom')c.spirits![0].effects=[{type:'damageMul',value:NaN}];if(kind==='upgrade-table')c.rules.upgradeCost=[];
    expect(()=>validateContent(c)).toThrow();
  });
  it('rejects bad stage loadouts, used slots, forms, pending support and combination snapshots',()=>{
    const s=m6();s.stage.units[0].upgrades={...emptyUpgrades(),hp:11};expect(()=>validateStage(s.stage,s.content)).toThrow();delete s.stage.units[0].upgrades;
    for(const key of ['usedItems','formId','combined']) {const raw=JSON.parse(snapshot(s));if(key==='usedItems'){raw.battle.units[0].parts=['hull'];raw.battle.units[0].usedItems=[0];}if(key==='formId')raw.battle.units[0].formId='bad';if(key==='combined')raw.battle.units[0].combined={combinationId:'bad',members:[]};expect(()=>restore(s.content,s.stage,JSON.stringify(raw))).toThrow();}
  });
  it('queries abilities after acting and selected support forecasts without RNG',()=>{
    const s=m6(c=>{c.pilots[1].skills=[{id:'support-guard',level:1}];});s.units[0].acted=true;s.units[0].level=3;attach(s,0,[{type:'hitAdd',value:5}]);const before=snapshot(s);const actions=availableActions(deepFreeze(s),'p1');expect(actions.some(c=>c.type==='spirit'&&c.spiritId==='renew')).toBe(true);expect(actions.some(c=>c.type==='move'||c.type==='attack')).toBe(false);expect(snapshot(s)).toBe(before);
    const f=forecast(s,'e1','p1','rifle',{type:'defend'},{supportDefenderId:'p2'});expect(f.selectedSupportDefense?.unitId).toBe('p2');expect(f.counter).toBeNull();expect(snapshot(s)).toBe(before);
  });

});
