import { describe,it,expect } from 'vitest';
import {ObjectivesScreen} from '@engine/src/v2/map/objectives';
import {HeadlessApp,makeMock} from './v2-map-fixtures';
import {MapScreen} from '@engine/src/v2/map/screen';
const goals={win:['적 전멸'],lose:['플레이어 또는 지피짱 격추']};
describe('operation objectives card',()=>{
 for(const action of ['confirm','cancel','touch'] as const)it(`opens and fades out by ${action}`,()=>{const app=new HeadlessApp();let done=false;app.push(new ObjectivesScreen(goals,()=>{done=true;app.pop();}));app.tick(20);const card=app.top;expect(card.stage.ui.nodes[0].alpha).toBeCloseTo(.55);if(action==='touch')card.input({kind:'pointer',phase:'up',x:640,y:360});else app.action(action);app.tick(12);expect(done).toBe(true);});
 it('waits after sortie, shows the card before the first phase, and reopens from the system menu',()=>{const app=new HeadlessApp(),screen=new MapScreen(makeMock(),{objectives:goals,opening:true});app.push(screen);screen.present([{type:'objectives'},{type:'phase',team:'ally',turn:1}]);app.tick(2);expect(app.top).toBeInstanceOf(ObjectivesScreen);app.tick(20);app.action('confirm');app.tick(90);expect(app.top).toBe(screen);app.chooseCell({col:5,row:4});expect((screen.ui.focus as {items?:{label:string}[]}).items?.some(i=>i.label==='작전 목표')).toBe(true);app.action('confirm');app.tick(2);expect(app.top).toBeInstanceOf(ObjectivesScreen);});
});
