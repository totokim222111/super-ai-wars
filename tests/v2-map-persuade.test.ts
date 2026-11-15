import {describe,it,expect} from 'vitest';
import {apply} from '@engine/src/core';
import {CoreMap} from '@engine/src/v2/adapter/map';
import {sawBattle} from './pack-fixture';
import {lookup,HeadlessApp} from './v2-map-fixtures';
import {mockMap} from './fixtures/mock-map';
import {buildSample} from './pack-fixture';
import {MapScreen} from '@engine/src/v2/map/screen';
import {ConfirmScreen} from '@engine/src/v2/dialogs';
import {yes} from './v2-campaign-fixtures';
import type {MenuList} from '@engine/src/v2/kit';
describe('persuasion',()=>{
 it('respects native scenario candidates and native apply without inventing recruitment',()=>{const s=sawBattle(3),g=s.units.find(u=>u.id==='gpi')!,target=s.units.find(u=>u.side==='enemy')!;target.x=g.x+1;target.y=g.y;const m=new CoreMap(s,{...lookup,persuadeTargets:()=>[target.id]});const at={col:g.x,row:g.y};expect(m.persuadeTargets(g.id,at)).toEqual([target.id]);const expected=apply(s,{type:'persuade',unitId:g.id,targetId:target.id}).state;m.persuade(g.id,at,target.id);expect(m.state().units).toEqual(expected.units);expect(m.state().units.find(u=>u.id===target.id)!.side).toBe('enemy');});
 it('cancels the target step and only spends the action after confirmation',()=>{const m=mockMap(buildSample({}));m.wait('gpi',{col:7,row:5});m.endTurn();const app=new HeadlessApp(),screen=new MapScreen(m);app.push(screen);app.chooseCell({col:7,row:5});app.action('confirm');app.tick(20);const list=screen.ui.focus as MenuList,index=list.items.findIndex(i=>i.label==='설득');for(let i=0;i<index;i++)app.action('down');app.action('confirm');expect((screen as unknown as {mode:{kind:string}}).mode.kind).toBe('persuadeTarget');app.action('cancel');for(let i=0;i<index;i++)app.action('down');app.action('confirm');app.action('confirm');expect(app.top).toBeInstanceOf(ConfirmScreen);expect(m.units().find(u=>u.id==='gpi')!.acted).toBe(false);yes(app);app.tick(50);expect(m.units().find(u=>u.id==='gpi')!.acted).toBe(true);});
});
