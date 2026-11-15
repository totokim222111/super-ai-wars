import {describe,it,expect} from 'vitest';
import {apply,pendingForecast,responseOptions} from '@engine/src/core';
import {CoreMap} from '@engine/src/v2/adapter/map';
import {sawBattle} from './pack-fixture';
import {mockMap} from './fixtures/mock-map';
import {buildSample} from './pack-fixture';
import {MapScreen} from '@engine/src/v2/map/screen';
import {lookup,HeadlessApp} from './v2-map-fixtures';
import {Button} from '@engine/src/v2/kit';
describe('manual enemy response',()=>{
 for(const choice of ['defend','evade','counter'] as const)it(`uses native prediction and applies ${choice}, then resumes the same AI`,()=>{const s=sawBattle(37),g=s.units.find(u=>u.id==='gpi')!,e=s.units.find(u=>u.side==='enemy')!;s.stage.scenario=true;s.units=[g,e];e.x=g.x+2;e.y=g.y;e.ai='hold';const m=new CoreMap(s,lookup,{manualResponse:true});const events=m.endTurn();expect(events.some(e=>e.type==='response')).toBe(true);const before=m.state(),prompt=m.response!()!,c=prompt.choices.find(c=>choice==='counter'?c.id.startsWith('counter:'):c.id===choice)!;expect(c).toBeDefined();const r=responseOptions(before).find(r=>choice===r.type)!;expect(c.forecast.attacker.damage).toBe(Math.round(pendingForecast(before,r).expectedDamage));expect(m.state().rng).toBe(before.rng);const expected=apply(before,{type:'respond',response:r}).state;m.respond(c.id);expect(m.state().units).toEqual(expected.units);expect(m.state().rng).toBe(expected.rng);m.continueTurn();expect(m.turn()).toEqual({team:'ally',number:2});});
 it('opens forecast immediately, selects without committing, denies cancel, and resumes AI only after confirmation',()=>{
  const m=mockMap(buildSample({}),{manualResponse:true});m.wait('gpi',{col:7,row:5});
  const app=new HeadlessApp(),screen=new MapScreen(m,{battle:()=>({animation:'off',speed:10,shake:0})});app.push(screen);screen.present(m.endTurn());app.tick(180);
  const mode=()=> (screen as unknown as {mode:{kind:string;choiceId:string}}).mode;
  const buttons=()=> (screen.ui as unknown as {widgets:Button[]}).widgets.filter(w=>w instanceof Button);
  const tap=(b:Button)=>{for(const phase of ['down','up'] as const)screen.input({kind:'pointer',phase,x:b.x+20,y:b.y+20});};
  const prompt=m.response!()!;expect(prompt).toBeDefined();expect(mode().kind).toBe('responseForecast');
  expect(mode().choiceId).toBe((prompt.choices.find(c=>c.id.startsWith('counter:'))??prompt.choices[0]).id);
  app.action('cancel');expect(mode().kind).toBe('responseForecast');expect(m.response!()).toEqual(prompt);
  tap(buttons().find(b=>b.label==='방어')!);expect(mode().choiceId).toBe('defend');expect(m.response!()).toEqual(prompt);
  tap(buttons().find(b=>b.label==='회피')!);expect(mode().choiceId).toBe('evade');expect(m.response!()).toEqual(prompt);
  tap(buttons().find(b=>b.label==='대응 확정')!);
  for(let i=0;i<12&&m.turn().team==='enemy';i++){app.tick(180);if(mode().kind==='responseForecast')app.action('confirm');}
  app.tick(180);expect(m.response!()).toBeUndefined();expect(m.turn()).toEqual({team:'ally',number:2});
 });
});
