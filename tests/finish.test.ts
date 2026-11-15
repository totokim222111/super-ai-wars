import { describe, expect, it, vi, afterEach } from 'vitest';
import { AtomicStorage, LocalBytes } from '@engine/src/platform/storage';
import type { ByteStore } from '@engine/src/platform/storage';
import { Saves, makeSave, migrate, restoreSave, SLOT_IDS,SAVE_VERSION } from '@engine/src/campaign/saves';
import { campaignContent as data } from './pack-fixture';
import { content } from './pack-fixture';
import { enterNode, titleSession, serialize, SAVE_KEY } from '@engine/src/campaign/session';
import { snapshot } from '@engine/src/core';
import { transition } from '@engine/src/game/controller';
import { defaultSettings, loadSettings, normalizeSettings, storeSettings, textRate } from '@engine/src/platform/settings';

function memory() {
  const values=new Map<string,string>();let fail='';
  return {values,getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{if(key===fail||fail==='*')throw new Error('quota');values.set(key,value);},removeItem:(key:string)=>{values.delete(key);},fail:(key:string)=>{fail=key;}};
}
function bytes(): ByteStore & {values:Map<string,string>} {const values=new Map<string,string>();return {values,read:async k=>values.get(k)??null,replace:async(k,v)=>{values.set(k,v);}};}
const session=()=>enterNode(titleSession(),data,content);
const file=()=>makeSave(session(),data,61000,'2026-11-09T00:00:00.000Z');
afterEach(()=>vi.unstubAllGlobals());
describe('M8 atomic storage',()=>{
  it('stages then replaces one localStorage value and removes pending bytes',async()=>{const m=memory(),s=new LocalBytes(m);await s.replace('auto','old');expect(await s.read('auto')).toBe('old');expect(m.values.size).toBe(1);await s.replace('auto','new');expect(await s.read('auto')).toBe('new');});
  it.each(['srpg:default:slot:auto:pending','srpg:default:slot:auto'])('preserves committed local bytes when %s fails',async key=>{const m=memory(),s=new LocalBytes(m);await s.replace('auto','old');m.fail(key);await expect(s.replace('auto','new')).rejects.toThrow('quota');expect(await s.read('auto')).toBe('old');});
  it('falls back on primary failure, and selects newest bytes after primary recovery',async()=>{const primary=bytes(),fallback=bytes();let fail=false;const p={read:primary.read,replace:async(k:string,v:string)=>{if(fail)throw new Error('idb');await primary.replace(k,v);}};const s=new AtomicStorage(p,fallback);await s.replace('auto','A');expect(s.backend).toBe('IndexedDB');fail=true;await s.replace('auto','B');expect(s.backend).toBe('localStorage');expect(await s.read('auto')).toBe('B');fail=false;await s.replace('auto','C');expect(await new AtomicStorage(primary,fallback).read('auto')).toBe('C');});
  it('keeps previous bytes when both backends reject the write',async()=>{const previous=bytes();await previous.replace('auto','old');const fail:ByteStore={read:previous.read,replace:async()=>{throw new Error('quota');}};const s=new AtomicStorage(fail,fail);await expect(s.replace('auto','new')).rejects.toThrow();expect(await s.read('auto')).toBe('old');});
  it('serializes concurrent writes in invocation order',async()=>{const s=new AtomicStorage(null,bytes());await Promise.all([s.replace('auto','1'),s.replace('auto','2'),s.replace('auto','3')]);expect(await s.read('auto')).toBe('3');});
});
describe('M8 save versions and slots',()=>{
  it.each(SLOT_IDS)('writes, reads and overwrites slot %s',async id=>{const saves=new Saves(bytes(),data,content);await saves.init();await saves.write(id,file());expect((await saves.load(id)).file.playTimeMs).toBe(61000);const next=file();next.playTimeMs=123000;await saves.write(id,next);expect((await saves.load(id)).file.playTimeMs).toBe(123000);expect(saves.slots.find(s=>s.id===id)?.status).toBe('ok');});
  it('exports and imports all five slots without losing state',async()=>{const a=new Saves(bytes(),data,content);for(const id of SLOT_IDS)await a.write(id,file());const b=new Saves(bytes(),data,content);for(const entry of b.importFile(await a.export()))await b.write(entry.id,entry.file);expect(await b.export()).toBe(await a.export());});
  it('isolates corrupt and future version slots from valid slots',async()=>{const storage=bytes(),s=new Saves(storage,data,content);await s.write('auto',file());await storage.replace('1','{bad');await storage.replace('2',JSON.stringify({...file(),saveVersion:999}));await s.refresh();expect(s.slots.map(x=>x.status)).toEqual(['empty','ok','unreadable','unreadable','empty']);expect(s.latest()?.id).toBe('auto');});
  it('accepts only the current public save version and rejects invalid source versions',()=>{const f=file();expect(migrate(f)).toEqual(f);expect(f.saveVersion).toBe(SAVE_VERSION);for(const saveVersion of [-1,0,1,4,5,7,1.2])expect(()=>migrate({...f,saveVersion})).toThrow();});
  it('rejects wrong content version, malformed dates, times and invalid campaign state',()=>{for(const patch of [{contentVersion:0},{savedAt:'bad'},{playTimeMs:-1},{campaign:{...file().campaign,credits:-1}}])expect(()=>restoreSave({...file(),...patch},data,content)).toThrow();});
  it.each([{cursor:null},{cursor:{x:-1,y:0}},{path:null},{selected:'missing'},{menuIndex:-1},{clips:[{duration:80,event:{type:'move',unitId:'gem',path:[]}}]},{commands:[{type:'unknown'}]}])('isolates malformed controller data %j before attachment',patch=>{const f=file();Object.assign(f.battle!,patch);expect(()=>restoreSave(f,data,content)).toThrow();});
  it('derives card metadata from validated state',()=>{const f=file();f.summary={stage:'forged',credits:999};expect(restoreSave(f,data,content).file.summary.stage).toBe(data.stages['trial-escort'].stage.name);expect(restoreSave(f,data,content).file.summary.credits).toBe(0);});
  it('keeps the data stage name at intermission and includes unsettled combat credits once',()=>{const s=session();s.screen='intermission';s.campaign.node=1;s.campaign.credits=100;s.campaign.battleCredits=20;s.game!.battle.credits=50;const f=makeSave(s,data,1000);expect(f.summary.stage).toBe(data.stages['trial-escort'].stage.name);expect(f.summary.turn).toBeUndefined();expect(f.summary.credits).toBe(130);});
  it('chooses the newest readable automatic or suspended slot, ignoring manual cards',async()=>{const s=new Saves(bytes(),data,content);await s.write('auto',file());await s.write('suspend',{...file(),savedAt:'2026-11-09T01:00:00Z'});await s.write('1',{...file(),savedAt:'2026-11-10T00:00:00Z'});expect(s.latest()?.id).toBe('suspend');});
  it('does not migrate or modify a legacy local key',async()=>{const old=memory(),storage=bytes();old.setItem(SAVE_KEY,serialize(session(),data));const s=new Saves(storage,data,content);await s.init();expect(s.latest()).toBeUndefined();expect(old.getItem(SAVE_KEY)).not.toBeNull();expect(storage.values.size).toBe(0);});
  it('rejects another pack before writing any imported slots',async()=>{const a=new Saves(bytes(),data,content);await a.write('1',file());const other=new Saves(bytes(),{...data,id:'other'},content);const awaitable=await a.export();expect(()=>other.importFile(awaitable)).toThrow();});
  it('rejects malformed import envelopes and any corrupt slot before writes',()=>{const s=new Saves(bytes(),data,content);for(const json of ['{}','null',JSON.stringify({format:'super-ai-wars-slots-1',slots:{'1':'broken'}}),JSON.stringify({format:'super-ai-wars-slots-1',slots:{unexpected:null}})])expect(()=>s.importFile(json)).toThrow();});
  it('resumes a suspended scenario with exactly the same commands, RNG and later state',async()=>{
    const s=session();s.game=transition(s.game!,{type:'tick',ms:500});s.campaign=s.game.scenario!.campaign;
    const saves=new Saves(bytes(),data,content);await saves.write('suspend',makeSave(s,data,120000));const restored=(await saves.load('suspend')).session;
    let a=s.game!,b=restored.game!;
    for(let n=0;n<140;n++){
      const event=a.mode==='scenario'?{type:'tap' as const,cell:a.cursor}:{type:'tick' as const,ms:10000};a=transition(a,event);b=transition(b,event);
    }
    expect(snapshot(a.battle)).toBe(snapshot(b.battle));expect(a.commands).toEqual(b.commands);expect(a.scenario!.runner).toEqual(b.scenario!.runner);
  });
});
describe('M8 complete settings',()=>{
  it('migrates legacy settings and validates all values',()=>{expect(normalizeSettings({sound:false,animation:'allies'})).toMatchObject({volume:0,sound:false,animation:'allies',grid:true});expect(normalizeSettings({volume:99,textSpeed:'broken' as never})).toEqual(defaultSettings);});
  it('persists every setting without touching save keys',()=>{const m=memory();vi.stubGlobal('localStorage',m);const s={...defaultSettings,volume:3,textSpeed:'instant' as const,autoResponse:true,grid:false,threat:true,fastEnemy:true};storeSettings(s);expect(loadSettings()).toEqual(s);expect(m.values.size).toBe(1);});
  it('applies text speed while leaving core state and RNG unchanged',()=>{const s=session();let g=transition(s.game!,{type:'tick',ms:500});const frozen=snapshot(g.battle);g.textMs=textRate('instant');g=transition(g,{type:'tick',ms:16});expect(g.scenario!.runner.waiting!.visible).toBe(Array.from(g.scenario!.runner.waiting!.command.args.at(-1)!).length);expect(snapshot(g.battle)).toBe(frozen);});
});
