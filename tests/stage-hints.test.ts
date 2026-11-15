import {describe,it,expect,beforeAll} from 'vitest';
import {loadPack,packLookup,type Pack} from '@engine/src/v2/pack/load';
import {activeHints,hintOrder} from '@engine/src/v2/map/hints';
import {StoryEvents} from '@engine/src/v2/story/events';
import {CoreMap} from '@engine/src/v2/adapter/map';
import {readFile} from '../tools/files.mjs';
import {MemoryStore} from './v2-campaign-fixtures';
import {CoreCampaign} from '@engine/src/v2/adapter/campaign';
import {TrainingSaves} from '@engine/src/v2/adapter/saves';
let pack:Pack;beforeAll(async()=>{pack=await loadPack('content/packs/saw',p=>readFile(p,'utf8'));});
describe('SAW visible region policy',()=>{
 it('guides episode one to the pending victory boss then the ruins, using labels only',()=>{const hints=hintOrder(pack.stageScripts!['ep01']?.hints??pack.stageScripts![pack.game.episodes[0].stage].hints??[],pack.game.mapHints);expect(hints.map(h=>h.id)).toEqual(['victory:shrimp','relic']);expect(hints.map(h=>h.name)).toEqual(['새우 예수 골렘','폐건물']);});
 it('marks exploration rewards and ordinary recruitment, leaving deliberate hidden recruitment and global contact checks hidden',()=>{const h=(ep:number)=>pack.stageScripts![pack.game.episodes[ep-1].stage].hints??[];expect(h(2).filter(h=>h.kind!=='victory').map(h=>h.id)).toEqual(['gacha-good','gacha-bad','library']);expect(h(3).filter(h=>h.id.startsWith('guard-'))).toHaveLength(4);expect(h(4).filter(h=>h.kind!=='victory').map(h=>h.id)).toEqual(['toll','booth']);expect(h(7).filter(h=>h.kind!=='victory').map(h=>h.id)).toEqual(['lab']);expect(h(8).every(h=>!h.id.startsWith('researcher-'))).toBe(true);expect(h(12).every(h=>h.kind==='victory')).toBe(true);expect(h(15).map(h=>h.id)).toEqual(['victory:pico']);});
 it('removes a region marker after the real scenario fires and keeps that state across save/load',async()=>{const bytes=new MemoryStore(),saves=new TrainingSaves(bytes,pack.campaign,pack.rules,pack.training);await saves.init();const model=new CoreCampaign(pack.campaign,pack.rules,saves,packLookup(pack,{}),bytes,[],pack);model.newGame({name:'검사',preset:0,line:pack.players.lines[0].id});model.advance(false);const ep=pack.game.episodes[0],events=new StoryEvents(pack,model,ep.id);const boot=events.process();model.acceptBattle(boot.state,boot.changes);const map=new CoreMap(boot.state,{...model.lookup,afterCommand:c=>events.process(c),onChange:(s,c)=>model.acceptBattle(s,c)});
  // Deploy into a reachable adjacent tile using the existing scenario move, then enter normally.
  map.execute({type:'system',unitId:'',action:{kind:'move',ids:['player'],x:12,y:1}});map.execute({type:'move',unitId:'player',x:13,y:1});
  expect(model.storyValue('v2:hint-fired:ep01:사건 구시대의 유물')).toBe(true);await model.save('1');await model.load('1');const seen=(scene:string)=>!!model.storyValue('v2:hint-fired:ep01:'+scene);const hs=pack.stageScripts![ep.stage].hints??[];expect(activeHints(hs,seen,()=>false,1,()=>true).some(h=>h.id==='relic')).toBe(false);
 });
});
