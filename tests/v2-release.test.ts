import {describe,it,expect,beforeAll,vi} from 'vitest';
import {Sound} from '@engine/src/v2/sound';
import {readFile} from '../tools/files.mjs';
import {loadPack,validatePack,type Pack} from '@engine/src/v2/pack/load';
import {packUsage} from '@engine/src/v2/pack/usage';
import {CoreCampaign} from '@engine/src/v2/adapter/campaign';
import {GameFlow} from '@engine/src/v2/game/flow';
import {campaign,MenuApp} from './v2-campaign-fixtures';
import {NewGameScreen} from '@engine/src/v2/menus/new-game';
import type {App} from '@engine/src/v2/screen';
import {fingerprint} from '@engine/src/campaign/session';
let pack:Pack;beforeAll(async()=>{pack=await loadPack('content/packs/saw',p=>readFile(p,'utf8'));});
describe('공개 전 팩·첫 화면 계약',()=>{
  it('미사용 호환 id는 남기며 실제 사용 항목의 경고를 숨기지 않는다',()=>{
    expect(pack.errors).toEqual([]);expect(pack.warnings).toEqual([]);
    expect(pack.rules.mechs.some(m=>m.id==='trial-boss')).toBe(true);expect(pack.cast.gem).toBeDefined();expect(packUsage(pack).cast.has('gpi')).toBe(true);
    const bad=structuredClone(pack);bad.errors=[];bad.warnings=[];bad.game.compatibility!.units!['gpi-generation-1']='잘못된 제외';delete bad.units['gpi-generation-1'].anchors;validatePack(bad);
    expect(bad.errors.some(e=>e.message==='사용 중인 호환 항목: gpi-generation-1')).toBe(true);expect(bad.warnings.some(e=>e.message==='기준점 없음: gpi-generation-1')).toBe(true);
  });
  it('미사용 인물이라도 대본이 다시 쓰면 호환 제외를 거부한다',()=>{
    const bad=structuredClone(pack);bad.errors=[];bad.warnings=[];bad.stories.ep01.scenes.시험=[{do:'say',who:'rival',text:'시험'}];validatePack(bad);
    expect(bad.errors.some(e=>e.message==='사용 중인 호환 항목: rival')).toBe(true);expect(bad.warnings.some(e=>e.kind==='인물 그림'&&e.message.includes('rival'))).toBe(true);
  });
  it('음성 전용은 그림을 요구하지 않지만 등장 지시는 거부한다',()=>{
    const bad=structuredClone(pack);bad.errors=[];bad.warnings=[];bad.stories.ep01.scenes.시험=[{do:'enter',who:'system',side:'left'}];bad.stories.ep01.locations.push({scene:'시험',index:0,line:10});validatePack(bad);
    expect(bad.errors.some(e=>e.message==='음성 전용 인물은 등장할 수 없습니다.')).toBe(true);
    expect(bad.warnings.some(e=>e.message.includes('system'))).toBe(false);
  });
  it('자코 초상은 실제 두 표정만 검사하고 시험 무기도 연출을 갖는다',()=>{
    const bad=structuredClone(pack);bad.errors=[];bad.warnings=[];const c=bad.cast['saw-shrimp'];c.moods={};c.moodSheet!.order=['default'];validatePack(bad);
    expect(bad.warnings.filter(e=>e.kind==='표정'&&e.message.startsWith('saw-shrimp:')).map(e=>e.message)).toEqual(['saw-shrimp: 없는 표정 hit']);
    for(const id of ['blade','rifle','beam','cannon','burst','trial-map'])expect(pack.weapons[id].anim.template).toBeTruthy();
  });
  it('게임 시작은 진열장 예시 없이 이미지 조회만으로 같은 새 게임 화면을 연다',async()=>{
    const {model}=await campaign(),app=new MenuApp(),flow=new GameFlow(app as unknown as App,model,{images:{}},undefined,pack);expect(model).toBeInstanceOf(CoreCampaign);flow.openTitle('새 게임');expect(app.top).toBeInstanceOf(NewGameScreen);
  });
  it('첫 진입에 큰 규칙·예시 자료를 정적 import하지 않는다',async()=>{
    const entry=await readFile('src/v2/boot.ts','utf8'),home=await readFile('src/v2/gallery/home.ts','utf8'),files=await readFile('src/v2/pack/files.ts','utf8');
    expect(entry).not.toMatch(/^import\s+\{.*(?:currentPack|startGame|buildSample).*from/gm);expect(home).not.toMatch(/^import\s+\{.*openGallery.*from/gm);expect(files).not.toContain("query: '?raw'");
  });
  it('장면 본문을 늦춰도 규칙·배치·프로그램·저장 지문은 같다',async()=>{
    const outlined=await loadPack('content/packs/saw',async path=>path.endsWith('.story')&&!path.includes('/samples/')?JSON.parse(await readFile(path+'.outline.json','utf8')).text:readFile(path,'utf8'));
    expect(outlined.errors).toEqual([]);expect(outlined.campaign).toEqual(pack.campaign);expect(fingerprint(outlined.campaign)).toBe(fingerprint(pack.campaign));expect(outlined.stories.ep02.locations).toHaveLength(0);expect(Object.keys(outlined.stories.ep02.scenes)).toEqual(Object.keys(pack.stories.ep02.scenes));
  });
  it('게임용 팩 준비는 진열장 견본·예시 파일을 받지 않는다',async()=>{
    const requested:string[]=[];const p=await loadPack('content/packs/saw',path=>{requested.push(path);return readFile(path,'utf8');},undefined,{examples:false,gallery:false});
    expect(p.errors).toEqual([]);expect(p.examples).toEqual([]);expect(requested.some(path=>path.includes('/samples/')||path.endsWith('/gallery.json'))).toBe(false);expect(fingerprint(p.campaign)).toBe(fingerprint(pack.campaign));
  });
  it('소리 크레딧의 준비는 비동기 팩 읽기가 끝날 때까지 기다린다',async()=>{
    let fail!:(error:Error)=>void;vi.stubGlobal('fetch',()=>new Promise((_resolve,reject)=>{fail=reject;}));
    try{const sound=new Sound(),task=sound.loadPack('/audio/');let ready=false;const wait=sound.ready().then(()=>{ready=true;});await Promise.resolve();expect(ready).toBe(false);fail(new Error('없는 선택 팩'));await task;await wait;expect(ready).toBe(true);}finally{vi.unstubAllGlobals();}
  });
});
