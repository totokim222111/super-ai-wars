import {engineDir,engineURL,storyURL,packDir} from './paths.mjs';
import {join} from 'node:path';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from './engine-api.mjs';
export const root=engineDir;
export const json=async p=>JSON.parse(await readFile(p.startsWith('../../story/')?new URL(p.slice('../../story/'.length),storyURL):p.startsWith('../content/saw/')?join(packDir,'data',p.slice('../content/saw/'.length)):p.startsWith('../content/rules/')?new URL(p.slice(3),engineURL):p.startsWith('../content/')?join(packDir,'data',p.slice('../content/'.length)):new URL(p,import.meta.url),'utf8'));
export async function openCore(){
  const server=await createServer({root,configFile:false,optimizeDeps:{noDiscovery:true,entries:[]},server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});
  return {core:await server.ssrLoadModule('/src/core/index.ts'),server};
}
export const plain={id:'saw-plain',name:'평지',env:'ground',moveCost:{ground:1,air:1,sea:null,space:null},hitMod:0,damageMod:0};
export async function definitions(){return {rules:await json('../content/rules/default.json'),spirits:await json('../content/spirits.json'),skills:await json('../content/skills.json'),tagEffects:await json('../content/tagEffects.json')};}
export function harness(core,content){
  function battle(a,d){
    const units=[{...a,id:'a',x:1,y:1,side:'player'},{...d,id:'d',x:2,y:1,side:'enemy'}];
    const stage={id:'saw-balance',map:{w:16,h:3,tiles:Array.from({length:3},()=>Array(16).fill(plain.id))},units};
    const s=core.createBattle(content,stage,1);
    for(const u of s.units)u.morale=100; // createBattle의 첫 라운드 +1을 기준 온도로 정규화.
    return s;
  }
  function shot(a,d,weaponId,options={}){
    const s=battle(a,d);s.units[0].morale=options.morale??100;
    if(options.virtualWeapon){
      s.content=structuredClone(content);
      s.content.mechs.find(m=>m.id===a.mechId).weapons.push(weaponId);
    }
    if(options.form)s.units[0].formId=options.form;
    if(options.defenderForm)s.units[1].formId=options.defenderForm;
    if(options.effects)s.units[0].effects=options.effects;
    if(options.defenderEffects)s.units[1].effects=options.defenderEffects;
    const w=content.weapons.find(w=>w.id===weaponId);
    s.units[1].x=1+Math.max(1,w.range[0]);
    let f;
    if(w.map)f=core.mapForecast(s,'a',weaponId,{x:s.units[1].x,y:1},'right').targets.find(t=>t.unitId==='d');
    else f=core.attackForecast(s,'a','d',weaponId,options.response);
    if(!f)throw new Error(`예측 대상 누락: ${weaponId}`);
    // 엔진이 반환한 일반/크리 범위를 명중 조건부로 집계한다(전투 공식 재구현 아님).
    const landed=(f.damage.min+f.damage.max)/2*(1-f.critRate/100)+(f.criticalDamage.min+f.criticalDamage.max)/2*f.critRate/100;
    return {...f,landed,state:s};
  }
  return {battle,shot};
}
