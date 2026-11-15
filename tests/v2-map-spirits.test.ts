import {campaign} from './v2-campaign-fixtures';
import {describe,it,expect} from 'vitest';
import {apply,spiritProblem} from '@engine/src/core';
import {CoreMap} from '@engine/src/v2/adapter/map';
import {sawBattle} from './pack-fixture';
import {mockMap} from './fixtures/mock-map';
import {buildSample} from './pack-fixture';
import {MapScreen} from '@engine/src/v2/map/screen';
import {lookup,HeadlessApp} from './v2-map-fixtures';
import {MenuList} from '@engine/src/v2/kit';
describe('targeted spirits',()=>{
 it.each([0,1])('teaches scan at level one to player preset %s and the partner, at the minimum existing SP cost',async preset=>{const {model}=await campaign();model.newGame({name:'테스터',preset,line:'real'});model.advance(false);const m=new CoreMap(model.session.game!.battle,lookup);for(const id of ['player','gpi'])expect(m.spirits(id)).toContainEqual(expect.objectContaining({id:'scan',cost:10,usable:true}));expect(Math.min(...m.state().content.spirits!.filter(s=>s.id!=='scan'&&s.spPct===undefined).map(s=>s.sp))).toBe(10);});
 it.each([false,true])('uses the configured after-action policy %s, then matches native target/apply results',allow=>{const s=sawBattle(31),g=s.units.find(u=>u.id==='gpi')!;const def=s.content.spirits!.find(d=>d.target==='ally')!;s.content.pilots.find(p=>p.id===g.pilotId)!.spirits=[{id:def.id,level:1}];g.sp=999;g.acted=true;s.content.options={spiritAfterAction:allow};let m=new CoreMap(s,lookup);if(!allow){expect(m.spiritTargets(g.id,def.id)).toEqual([]);expect(()=>m.cast(g.id,def.id,g.id)).toThrow();expect(m.commands(g.id,{col:g.x,row:g.y}).filter(c=>!c.disabled).map(c=>c.id)).toEqual(['inspect']);g.acted=false;m=new CoreMap(s,lookup);}expect(m.commands(g.id,{col:g.x,row:g.y}).find(c=>c.id==='spirit')?.disabled).toBe(false);expect(m.spiritTargets(g.id,def.id)).toEqual(s.units.filter(u=>!spiritProblem(s,g.id,def.id,u.id)).map(u=>u.id));const id=m.spiritTargets(g.id,def.id).find(id=>id!==g.id)!;const expected=apply(s,{type:'spirit',unitId:g.id,spiritId:def.id,targetId:id}).state;expect(m.cast(g.id,def.id,id)).toContainEqual(expect.objectContaining({type:'spirit',unitId:id}));expect(m.state().units).toEqual(expected.units);});
 it('returns one step to the spirit list and can cast by touch',()=>{const m=mockMap(buildSample({})),app=new HeadlessApp(),screen=new MapScreen(m);app.push(screen);app.chooseCell({col:4,row:5});app.action('confirm');app.tick(10);app.action('down');app.action('confirm');const list=screen.ui.focus as MenuList;for(let i=0;i<list.items.length-1;i++)app.action('down');app.action('confirm');expect((screen as unknown as {mode:{kind:string}}).mode.kind).toBe('spiritTarget');app.action('cancel');expect(screen.ui.focus).toBeInstanceOf(MenuList);for(let i=0;i<(screen.ui.focus as MenuList).items.length-1;i++)app.action('down');app.action('confirm');app.chooseCell({col:3,row:6});app.tick(200);expect((screen as unknown as {mode:{kind:string}}).mode.kind).toBe('command');});
});
