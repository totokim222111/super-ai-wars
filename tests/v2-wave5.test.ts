import {beforeAll,describe,it,expect} from 'vitest';
import {readFile} from '../tools/files.mjs';
import {createBattle,effectiveMech,effectivePilot,snapshot,restore} from '@engine/src/core';
import {loadPack,packLookup,packUnit,validatePack,type Pack} from '@engine/src/v2/pack/load';
import {applyRules,prepareRules,ruleCommand} from '@engine/src/v2/rules/runtime';
import {CoreMap} from '@engine/src/v2/adapter/map';
import {CreditsScreen} from '@engine/src/v2/menus/credits';
import {MenuApp,campaign} from './v2-campaign-fixtures';

let pack:Pack;
beforeAll(async()=>{pack=await loadPack('content/packs/saw',p=>readFile(p,'utf8'));});
describe('물결5 표시 자료 연결',()=>{
 it('모든 신규 삽화 명령과 배경이 실제 파일을 가리키며 자코 12명은 두 칸 전용 초상을 쓴다',()=>{
  expect(pack.errors).toEqual([]);expect(pack.warnings).toEqual([]);
  const cgs=new Set<string>();
  for(const story of Object.values(pack.stories))for(const cue of Object.values(story.scenes).flat())if(cue.do==='cg'){expect(pack.game.art.files[cue.image]).toBeDefined();cgs.add(cue.image);}
  expect([...cgs].filter(id=>id!=='cg-gpi-entrance')).toHaveLength(28);
  const carbon=Object.entries(pack.cast).filter(([id])=>id.startsWith('carbon-'));expect(carbon).toHaveLength(12);
  for(const [id,c]of carbon){expect(c.bust).toBe('portrait-'+id);expect(c.temporary).toBeUndefined();expect(c.moodSheet?.order).toEqual(['default','hit']);}
 });
 it('젬 실루엣과 퀜 카드·컷인이 폼 변경 및 저장 복원 뒤 같은 모드를 표시한다',()=>{
  const images=Object.fromEntries(Object.keys(pack.game.art.files).map(id=>[id,{id}as unknown as HTMLImageElement]));
  const lookup=packLookup(pack,images),stage=pack.campaign.stages['saw-07'].stage;
  let state=prepareRules(createBattle(pack.rules,stage,17));
  for(const [unitId,modes,assets]of [
   ['gem',['플래시','프로','울트라'],['nano','pro','ultra']],
   ['qwen',['악의축','얀데레','메가데레'],['axis','yandere','megadere']],
  ]as const){
   // Hidden recruits are definitions in this stage. Include the real stage definition for review.
   if(!state.units.some(u=>u.id===unitId)){
    const def=stage.definitions?.find(u=>u.id===unitId)!;expect(def).toBeDefined();
    const copy={...structuredClone(stage),units:[...stage.units,def]};state=prepareRules(createBattle(pack.rules,copy,17));
   }
   for(let i=0;i<modes.length;i++){
    state=applyRules(state,ruleCommand({kind:'form',id:unitId,form:modes[i]})).state;
    state=restore(pack.rules,state.stage,snapshot(state));
    const u=state.units.find(u=>u.id===unitId)!,m=effectiveMech(state,u),p=effectivePilot(state,u);
    const view=new CoreMap(state,lookup).units().find(v=>v.id===unitId)!;
    if(unitId==='gem'){
     expect(lookup.battle.mech(m,u).image).toBe(images['mech-gem-'+assets[i]]);
     expect(Object.keys(packUnit(pack,u.mechId,u.side,u.formId).anchors!)).toHaveLength(5);
    }else{
     expect(lookup.battle.pilot(p,u).portrait?.faces?.default).toBe(images['bust-qwen-'+assets[i]]);
     expect(view.portrait?.faces?.default).toBe(images['bust-qwen-'+assets[i]]);
    }
   }
  }
 });
 it('잘못된 전술 폼 그림·인물·기준점도 팩 오류로 보고한다',()=>{
  const bad=structuredClone(pack);bad.errors=[];bad.warnings=[];
  bad.units['gem-generation-1'].tacticalForms={bad:{art:'absent',pilotCast:'absent',anchors:{core:[2,-1]}}};
  validatePack(bad);for(const term of ['없는 전술 폼 그림','없는 전술 폼 인물','전술 폼 기준점 범위'])expect(bad.errors.some(e=>e.message.includes(term))).toBe(true);
 });
 it('크레딧 메뉴에 CC BY 링크와 변경 사실을 한 행에 함께 표시한다',async()=>{
  const app=new MenuApp(),model=(await campaign()).model;
  Object.assign(app.sound,{credits:()=>[{kind:'bgm',id:'test',title:'곡',author:'魔王魂',credit:'音楽：魔王魂',license:'CC BY 4.0',source:'https://maou.audio/',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',modifications:'게임용 OGG 144kbps 재인코딩'}]});
  app.push(new CreditsScreen(model));app.tick(30);
  const list=(app.top!.ui as unknown as {widgets:{items?:{label:string;description?:string}[]}[]}).widgets.find(w=>w.items?.some(i=>i.label.includes('creativecommons')))!;
  expect(list.items).toContainEqual(expect.objectContaining({label:'https://creativecommons.org/licenses/by/4.0/',description:'게임용 OGG 144kbps 재인코딩'}));
 });
});
