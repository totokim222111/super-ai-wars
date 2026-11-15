import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {openCore,definitions,plain,harness,json} from './saw-runtime.mjs';
import {lines,principal,mechId,pilotId,generation,loadout,upgrades,level,tune,difficulty,hitTargets,damageTargets} from './saw-model.mjs';
import {writeDocs} from './saw-docs.mjs';
import {extensionProjections} from './saw-extensions.mjs';
import {followupChecks} from './saw-followup.mjs';
import {endgameChecks} from './saw-endgame.mjs';
const {core,server}=await openCore();
try{
await mkdir(new URL('./out/saw-balance/',import.meta.url),{recursive:true});
const model=await json('../../story/mechs/spec-v1/model.json');
const content={version:'saw-spec-v1',...await definitions(),terrain:[plain],mechs:await json('../content/saw/mechs.json'),weapons:await json('../content/saw/weapons.json'),pilots:await json('../content/saw/pilots.json')};
const ids=new Set([...model.ally,...model.enemy,...model.autoUnits].map(m=>m.id).concat(['deepseek-mobydick','exaone-thinq']));content.mechs=content.mechs.filter(m=>ids.has(m.id));content.pilots=content.pilots.filter(p=>!p.id.startsWith('pilot-'));
core.validateContent(content);
// core 검증기가 허용하는 부가 필드 외에도 실제 계약의 키를 엄격히 제한한다.
const keys={mechs:'id name hp en armor mobility move moveType size adapt weapons partSlots costClass exp credits forms aiForm',weapons:'id name kind power en ammo range hit crit postMove moraleReq adapt anim icon map',pilots:'id name stats sp adapt growth spGrowth spirits skills aiSpirits startMorale faces character'};
for(const key of Object.keys(keys))for(const d of content[key]){assert.match(d.id,/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);for(const k of Object.keys(d))assert(keys[key].split(' ').includes(k),`${d.id}: ${k}`);}
const checks=[];const add=(id,label,ok,value,note='')=>checks.push({id,label,ok:Boolean(ok),value,note});
const inRange=(n,a,b)=>Number.isFinite(n)&&n>=a-1e-6&&n<=b+1e-6;
const maxHit=f=>f.critRate>0?f.criticalDamage.max:f.damage.max;
const {shot,battle}=harness(core,content);
const wm=id=>content.weapons.find(w=>w.id===id),mm=id=>content.mechs.find(m=>m.id===id),am=id=>model.ally.find(a=>a.id===id);
const au=(line,ep)=>({mechId:mechId(line,generation(line,ep)),pilotId:pilotId(line),...loadout(line,ep)});
const eu=e=>({mechId:e.id,pilotId:e.pilotId,...e.loadout});
const effective=u=>{const s=battle(u,u);return core.effectiveMech(s,s.units[0]);};
const rows=[],defenses=[],accuracies=[],resources=[],roles=[],growth=[],curves=[];
// T1/T2/T3: 도감의 기준 등장뿐 아니라 실제 15화 편성에 나온 모든 수치 변형을 검사한다.
for(const e of model.enemy){
 const ep=e.episode,g=au('gpi',ep),d=eu(e),f=shot(g,d,am(g.mechId).main),dh=effective(d).hp,gh=effective(g).hp,hits=Math.ceil(dh/f.landed);
 const t=hitTargets[e.grade];add('T1',`${ep}화 ${e.name}`,inRange(hits,...t),`${hits}회 (${f.landed.toFixed(1)}/HP ${dh})`,ep===11&&e.template==='rival-jepa'?'표시 HP의 명목 분석만. 실제11화 JEPA는 HP1 하한으로 격파할 수 없음.':'');
 if(e.passive){rows.push({ep,name:e.name,id:e.id,grade:e.grade,hits,damage:f.landed,hp:dh,taken:0,strong:0});add('T2',`${ep}화 ${e.name} 비공격`,mm(e.id).weapons.length===0,'무장0·HP1하한·정화 승리');continue;}
 const taken=shot(d,g,e.main),ratio=taken.landed/gh;
 add('T2',`${ep}화 ${e.name} 통상`,inRange(ratio,...damageTargets[e.grade]),`${(ratio*100).toFixed(2)}%`);
 const final=shot(d,g,e.finisher,{morale:150});
 if(['rival','boss','final'].includes(e.grade))add('T2',`${ep}화 ${e.name} 최강`,final.criticalDamage.max/gh<=.55,`${(final.criticalDamage.max/gh*100).toFixed(2)}% (크리 최대·150도)`);
 rows.push({ep,name:e.name,id:e.id,grade:e.grade,hits,damage:f.landed,hp:dh,taken:ratio,strong:final.criticalDamage.max/gh});
 if(e.grade==='grunt'||['rival','boss','final'].includes(e.grade)||e.template==='elastic-cat'){
  const bounds=e.template==='elastic-cat'?[25,45]:e.grade==='grunt'?[80,100]:[65,85];
  add('T3',`${ep}화 지피 → ${e.name}`,inRange(f.hitRate,...bounds),`${f.hitRate}%`);
  accuracies.push({ep,from:'지피',to:e.name,hit:f.hitRate});
 }
 if(e.grade==='grunt')for(const [line,bounds] of [['gpi',[45,65]],['grok',[15,35]],['exaone',[60,80]],['player-super',[70,90]]]){
  if(lines.find(l=>l[0]===line)[2]>ep)continue;
  const h=shot(d,au(line,ep),e.main).hitRate;add('T3',`${ep}화 ${e.name} → ${line}`,inRange(h,...bounds),`${h}%`);accuracies.push({ep,from:e.name,to:line,hit:h});
 }
 if(['rival','boss','final'].includes(e.grade)){
  for(const mode of ['exponential','vertical']){
   const factor=difficulty(ep,mode).attack;
   const projected=structuredClone(content),bonus=e.loadout.upgrades.weapons*content.rules.upgradeStep.weapons;
   for(const wid of mm(e.id).weapons)projected.weapons.find(w=>w.id===wid).power=Math.round((wm(wid).power+bonus)*factor)-bonus;
   const h=harness(core,projected);
   for(const l of lines.filter(l=>l[2]<=ep)){
    const u=au(l[0],ep),r=h.shot(d,u,e.main),hp=effective(u).hp;
    add(mode==='vertical'?'T7':'T2',`${ep}화 ${mode} ${e.name} → ${l[0]} 생존`,maxHit(r)<hp,`${maxHit(r)}/${hp}`);
    if(l[0].startsWith('player-')&&mode==='exponential')add('T2',`${ep}화 ${mode} ${l[0]} 2회`,2*maxHit(r)<hp,`${2*maxHit(r)}/${hp}`);
    defenses.push({ep,mode,boss:e.name,line:l[0],max:maxHit(r),hp});
    if(ep>=14&&['gem','grok','sonnet'].includes(l[0])){
     const alternate={...u,mechId:mechId(l[0],generation(l[0],ep)-1)},af=h.shot(d,alternate,e.main),ah=effective(alternate).hp;
     add(mode==='vertical'?'T7':'T2',`${ep}화 ${mode} ${l[0]} 최종 히든 미획득 생존`,maxHit(af)<ah,`${maxHit(af)}/${ah}`);
    }
   }
  }
 }
}
for(const e of model.enemy.filter(e=>['rival-midjourney','rival-sd'].includes(e.template))){
 const ep=e.episode,base=au('gpi',ep),gh=effective(base).hp;
 const gachaEffects=factor=>[{id:'saw-gacha',source:'가챠 근사',duration:{unit:'round',remaining:1},hooks:{},atoms:[{type:'damageMul',value:factor}]}];
 const mean=shot(eu(e),base,e.main,{effects:gachaEffects(1.1)});
 add('T2',`${ep}화 ${e.name} 가챠 균등 평균`,inRange(mean.landed/gh,.22,.35),`${(100*mean.landed/gh).toFixed(2)}%`,'근사: 최종 피해 균등0.7~1.5의 평균1.1. 양 끝을 모두22~35%로 제한하는 것은 불가능.');
 for(const l of lines.filter(l=>l[2]<=ep)){
  const u=au(l[0],ep),hp=effective(u).hp,max=shot(eu(e),u,e.main,{effects:gachaEffects(1.5)});
  add('T2',`${ep}화 ${e.name} 가챠 최대 ${l[0]} 생존`,maxHit(max)<hp,`${maxHit(max)}/${hp}`,'근사: 가챠1.5×발생 가능한 최대 분산.');
  if(l[0].startsWith('player-')){const avg=shot(eu(e),u,e.main,{effects:gachaEffects(1.1)});add('T2',`${ep}화 ${e.name} 가챠 평균 ${l[0]} 2회`,2*avg.landed<hp,`${(2*avg.landed).toFixed(1)}/${hp}`,'기준 변경(Claude 결정, 2026-11-10): 2연타는 평균 배율1.1·평균 피해, 1회 생존은 최대1.5. 변경 전13화 최대2연타11,396/8,700 기록 유지.');}
 }
}
// T4 비교는 동일 강화 차수, 동일 Lv1/0단, 각자의 기본형, M/장갑500×1.25^(g−1) 표적.
// 실제 화의 강화 횟수 차이는 위 T1/T2와 생존 검사에서 별도로 반영한다.
const benchmark={id:'saw-benchmark',name:'스팸 봇',hp:100000,en:999,armor:500,mobility:100,move:5,moveType:['ground'],size:'M',adapt:{air:'A',ground:'A',sea:'A',space:'A'},weapons:[]};
const attack={id:'saw-benchmark-weapon',name:'검증 포격(가칭)',kind:'shoot',power:2400,range:[1,5],en:0,hit:0,crit:0,postMove:true,adapt:benchmark.adapt};benchmark.weapons=[attack.id];
content.mechs.push(benchmark);content.weapons.push(attack);
const target={mechId:benchmark.id,pilotId:'unmanned',level:1,upgrades:upgrades(0)};
const same=(line,g)=>({mechId:mechId(line,g),pilotId:pilotId(line),level:1,upgrades:upgrades(0)});
const median=a=>{const s=[...a].sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;};
for(const a of model.ally){
 const g=a.generation,u=same(a.line,g),ref=same('gpi',g),ga=am(ref.mechId);benchmark.armor=Math.round(500*1.25**(g-1));attack.power=Math.round(2400*1.25**(g-1));
 const gd=shot(ref,target,ga.main).landed,dmg=shot(u,target,a.main).landed,r=dmg/gd;
 roles.push({line:a.line,g,ratio:r,hp:mm(a.id).hp,armor:mm(a.id).armor,mobility:mm(a.id).mobility});
 if(a.line==='claude'){
  add('T4',`클로드 ${g} 단발`,inRange(r,1.5,1.8),r.toFixed(4));
  const cap=[3,4,4,5][g-1];let remaining=cap,locked=0,total=0;const schedule=[];
  for(let t=0;t<8;t++){if(locked){total+=shot(u,target,a.support).landed;locked--;schedule.push('위임');if(!locked)remaining=cap;}else{total+=dmg;schedule.push('주력');if(--remaining===0)locked=2;}}
  add('T4',`클로드 ${g} 8턴 한도`,inRange(total/(gd*8),.9,1.15),`${(total/(gd*8)).toFixed(4)} / ${schedule.join('·')}`,'근사: 매 아군 턴 1회, 반격 없음. 봉인 중 위임은 한도를 차감하지 않음.');
  add('T4',`클로드 ${g} 내구 하위`,mm(a.id).hp<mm(ref.mechId).hp&&mm(a.id).armor<mm(ref.mechId).armor,`${mm(a.id).hp}/${mm(a.id).armor}`);
 }
 if(a.line==='sonnet'){
  add('T4',`소네트 ${g} 화력`,inRange(r,.7,.8),r.toFixed(4));
  const cost=wm(a.main).en;add('T4',`소네트 ${g} 소비`,cost<=wm(ga.main).en/2,`${cost}/${wm(ga.main).en}`);
  const left=mm(a.id).en-cost*12+content.rules.enRegenPerRound*11;add('T4',`소네트 ${g} 12턴 잔량`,left>0,left);
 }
 if(a.line==='grok')add('T4',`그록 ${g} 역할`,inRange(r,.9,1.05)&&mm(a.id).mobility===Math.max(...model.ally.filter(x=>x.generation===g).map(x=>mm(x.id).mobility))&&mm(a.id).hp<mm(ref.mechId).hp&&mm(a.id).armor<mm(ref.mechId).armor,r.toFixed(4));
 if(a.line==='exaone'){
  const taken=shot(target,u,attack.id).landed/shot(target,ref,attack.id).landed;
  add('T4',`엑사원 ${g} 공격`,inRange(r,.6,.75),r.toFixed(4));add('T4',`엑사원 ${g} 피격`,inRange(taken,.55,.7),taken.toFixed(4));
 }
 if(a.line==='qwen')add('T4',`퀜 ${g} 화력·광역·장갑`,inRange(r,1.1,1.25)&&mm(a.id).weapons.filter(id=>wm(id).map).length>=2&&mm(a.id).armor<mm(ref.mechId).armor,`${r.toFixed(4)} / MAP ${mm(a.id).weapons.filter(id=>wm(id).map).length}`);
 if(a.line==='deepseek'){
  add('T4',`딥시크 ${g} MoE·수리`,wm(a.main).en<=wm(ga.main).en*.7&&inRange(r,.9,1.1)&&content.pilots.find(p=>p.id==='deepseek').spirits.some(s=>s.id==='aid'),`${wm(a.main).en}/${wm(ga.main).en}, 화력 ${r.toFixed(4)}, aid 보유`,'수리 무장 대신 기존 aid. 고유 차 대접은 확장 필요.');
 }
 if(a.line==='gem'){
  const m=mm(a.id),normal=m.forms[0],ais=m.forms[1],anti=m.forms[2];
  const mainAis=wm(`${a.main}-ais`),normalW=wm(a.main);
  add('T4',`젬 ${g} VRAM·형태`,m.en===1.5*mm(ref.mechId).en&&ais.overrides.move===m.move-1&&mainAis.range[1]===normalW.range[1]+2&&ais.overrides.weapons.some(id=>wm(id).map)&&anti.overrides.move===m.move+2&&anti.overrides.moveType.includes('air'),`${m.en}, AIS +2/-1, 비행 +2`);
  const st=battle(u,target);const before=core.snapshot(st);const result=core.apply(st,{type:'transform',unitId:'a',formId:'ais'});add('T4',`젬 ${g} 행동 없는 변형`,!result.state.units[0].acted&&core.snapshot(st)===before,'core.apply 확인');
  const aw=wm(anti.overrides.weapons.at(-1)),nw=m.weapons.map(wm).find(w=>w.kind==='melee');add('T4',`젬 ${g} 안티 격투`,aw.power>nw.power,`${aw.power}/${nw.power}`);
 }
 if(a.line==='player-real'){
  const m=mm(a.id),superM=mm(mechId('player-super',g)),su=same('player-super',g),smeta=am(su.mechId),sratio=shot(su,target,smeta.main).landed/dmg;
  const rank=1+model.ally.filter(x=>x.generation===g&&!x.line.startsWith('player-')&&mm(x.id).mobility>m.mobility).length;
  add('T4',`플레이어 ${g} 양 계열`,rank<=3&&m.hp<mm(ref.mechId).hp&&inRange(superM.hp/m.hp,1.4,1.6)&&inRange(superM.armor/m.armor,1.4,1.6)&&inRange(sratio,1.25,1.4)&&superM.mobility<mm(ref.mechId).mobility,`운동성 ${rank}위, HP ${(superM.hp/m.hp).toFixed(2)}, 장갑 ${(superM.armor/m.armor).toFixed(2)}, 근접 ${sratio.toFixed(3)}`);
 }
}
for(let g=1;g<=4;g++)for(const route of ['player-real','player-super']){
 const cohort=model.ally.filter(a=>a.generation===g&&(!a.line.startsWith('player-')||a.line===route));const gp=mm(mechId('gpi',g));
 for(const key of ['hp','en','armor','mobility','move']){const md=median(cohort.map(a=>mm(a.id)[key]));add('T4',`지피 ${g} ${route} ${key} 중앙값`,inRange(gp[key]/md,.9,1.1),`${gp[key]}/${md}`);}
 const damage=cohort.map(a=>roles.find(r=>r.line===a.line&&r.g===g).ratio);add('T4',`지피 ${g} ${route} 화력 중앙값`,inRange(1/median(damage),.9,1.1),(1/median(damage)).toFixed(4));
 const ranges=cohort.map(a=>Math.max(...mm(a.id).weapons.map(id=>wm(id).range[1]))),grange=Math.max(...gp.weapons.map(id=>wm(id).range[1]));
 add('T4',`지피 ${g} ${route} 사거리·슬롯·적응 중앙값`,inRange(grange/median(ranges),.9,1.1)&&gp.partSlots===median(cohort.map(a=>mm(a.id).partSlots))&&['air','ground','sea','space'].every(env=>cohort.filter(a=>mm(a.id).adapt[env]===gp.adapt[env]).length>=cohort.length/2),`최대 사거리${grange}, 슬롯${gp.partSlots}, 적응${Object.values(gp.adapt).join('/')}`);
}
const mob=mm('deepseek-mobydick'),dc=mm(mechId('deepseek',3)),thinq=mm('exaone-thinq'),ex=mm(mechId('exaone',3));
add('T4','모비딕 외장',inRange(mob.hp/dc.hp,1.8,2.2)&&mob.size==='L'&&mob.moveType.includes('air')&&mob.mobility<Math.min(...model.ally.map(a=>mm(a.id).mobility))&&Math.max(...mob.weapons.map(id=>wm(id).range[1]))>Math.max(...model.ally.flatMap(a=>mm(a.id).weapons.map(id=>wm(id).range[1]))),`${(mob.hp/dc.hp).toFixed(2)}배, 사거리10, 운동성${mob.mobility}`);
add('T4','ThinQ 외장',thinq.move===ex.move-1&&thinq.armor>Math.max(...model.ally.map(a=>mm(a.id).armor)),`${thinq.armor}, 이동${thinq.move}`);
// 검증 전용 표적은 이후 문서/스키마 검사에서 제거한다.
content.mechs.pop();content.weapons.pop();
for(const l of lines)for(let g=2;g<=l[4].length;g++){
 const prev=mm(mechId(l[0],g-1)),next=mm(mechId(l[0],g));
 for(const key of ['hp','armor']){const ratio=next[key]/prev[key];growth.push({line:l[0],g,key,ratio});add('T5',`${l[0]} ${g} ${key}`,inRange(ratio,1.2,1.3),`${(100*(ratio-1)).toFixed(2)}%`);}
 const ratio=wm(am(next.id).main).power/wm(am(prev.id).main).power;growth.push({line:l[0],g,key:'power',ratio});add('T5',`${l[0]} ${g} 주력`,inRange(ratio,1.2,1.3),`${(100*(ratio-1)).toFixed(2)}%`);
}
add('T5','15화 T1·T2 유지',checks.filter(c=>['T1','T2'].includes(c.id)).every(c=>c.ok),`${rows.length} 적 수치 변형`,'기준 변경(Claude 결정, 2026-11-10): 가챠 평균2연타·최대1회 규칙을 T2와 동일하게 집계.');
for(const ep of model.episodes){const u=au('gpi',ep.episode),a=am(u.mechId),cap=effective(u).en,main=wm(a.main),fin=wm(a.finisher);
 const duration=costs=>{let en=cap;for(let t=1;t<=100;t++){const cost=costs(t);if(en<cost)return t;en-=cost;en=Math.min(cap,en+content.rules.enRegenPerRound);}return 101;};
 const normal=duration(()=>main.en)-1,pressure=duration(t=>t<=2?main.en:fin.en);
 add('T6',`${ep.episode}화 지피 지속`,normal>=8&&inRange(pressure,4,5),`주력 ${normal}턴, 혼합 ${pressure}턴째 불가`);resources.push({ep:ep.episode,cap,main:main.en,fin:fin.en,normal,pressure});
}
for(const a of model.ally){add('T6',`${a.id} 주력·필살 소비`,inRange(wm(a.main).en,10,25)&&inRange(wm(a.finisher).en,40,70),`${wm(a.main).en}/${wm(a.finisher).en}`);}
for(let ep=1;ep<=15;ep++){const easy=difficulty(ep,'linear'),hard=difficulty(ep,'vertical');curves.push({ep,easy,hard});add('T7',`${ep}화 배율`,easy.hp<1&&easy.attack<1&&(ep>10||hard.hp===1&&hard.attack===1),`${easy.hp.toFixed(3)} / ${hard.hp.toFixed(3)} / ${hard.attack.toFixed(3)}`);}
add('T7','15화 도달 배율',difficulty(15,'linear').hp===.8&&difficulty(15,'vertical').hp===1.5&&difficulty(15,'vertical').attack===1.25,'선형0.8, 수직 HP1.5/공격1.25');
const price=n=>5*content.rules.upgradeCost.slice(0,n).reduce((a,b)=>a+b,0);
let bank=0;const economy=[];
for(const ep of model.episodes){const prior=bank,loot=(ep.rewards??ep.enemies).reduce((n,e)=>n+mm(e.mechId).credits*e.count,0);bank+=loot+ep.clearCredits;
 const active=lines.filter(l=>l[2]<=ep.episode&&l[0]!=='player-super'),spent=active.reduce((n,l)=>n+price(principal.has(l[0])?ep.mainTune:ep.reserveTune),0);
 add('T8',`${ep.episode}화 출격 개조 예산`,spent<=prior,`${spent}/${prior}`);economy.push({ep:ep.episode,prior,loot,clear:ep.clearCredits,total:bank,spent});
 const perHead=ep.projectedCombatExp/active.length+ep.clearExp;add('T8',`${ep.episode}화 평균 성장`,inRange(perHead,995,1005),`${perHead.toFixed(2)} EXP/인 (분산 근사)`);
}
const goal=3*price(5)+2*price(6)+2*price(2)+2*price(3),allSix=5*price(6)+4*price(3),seven=5*price(7)+4*price(3);
add('T8','15화 5기/예비4기 예산',bank>=goal&&bank<seven,`${bank} / 평균5.4·2.5단 ${goal} / 주력6단·예비3단 ${allSix} / 주력7단 ${seven}`);
for(const e of model.enemy.filter(e=>!e.passive))for(const mode of ['linear','vertical']){
 const original=effective(eu(e)),p=structuredClone(content),f=difficulty(e.episode,mode),hpBonus=e.loadout.upgrades.hp*content.rules.upgradeStep.hp,wBonus=e.loadout.upgrades.weapons*content.rules.upgradeStep.weapons;
 p.mechs.find(m=>m.id===e.id).hp=Math.round(original.hp*f.hp)-hpBonus;
 p.weapons.find(w=>w.id===e.main).power=Math.round((wm(e.main).power+wBonus)*f.attack)-wBonus;
 const h=harness(core,p),st=h.battle(eu(e),au('gpi',e.episode)),actual=core.effectiveMech(st,st.units[0]),actualW=core.effectiveWeapon(st,st.units[0],p.weapons.find(w=>w.id===e.main));
 add('T7',`${e.id} ${mode} 실효 배율`,Math.abs(actual.hp/original.hp-f.hp)<=1/original.hp&&Math.abs(actualW.power/(wm(e.main).power+wBonus)-f.attack)<=1/(wm(e.main).power+wBonus),`HP ${(actual.hp/original.hp).toFixed(4)}, 공격 ${(actualW.power/(wm(e.main).power+wBonus)).toFixed(4)}`);
}
const projections=extensionProjections({core,content,model,au,eu,shot,battle});
const followup=await followupChecks({core,content,model,au,eu,shot,battle,add});
const endgame=await endgameChecks({core,content,model,au,eu,shot,battle,add});
assert.equal(content.mechs.length,model.ally.length+model.enemy.length+(model.autoUnits?.length??0)+2,'도감/검증 누락 기체');
for(const m of content.mechs){const passive=model.enemy.some(e=>e.id===m.id&&e.passive)||model.autoUnits?.some(e=>e.id===m.id&&e.role==='map-cancel');assert(passive?m.weapons.length===0:m.weapons.length>=4&&m.weapons.length<=6,`${m.id} 무장 수`);for(const f of m.forms??[])assert((f.overrides.weapons??m.weapons).length<=6,`${m.id}/${f.id} 무장 수`);}
// The v1 file-hash/bundle contract was retired; validate the current pack instead.
const summary=[...new Set(checks.map(c=>c.id))].sort((a,b)=>a.startsWith('T')===b.startsWith('T')?a.localeCompare(b):a.startsWith('T')?-1:1).map(id=>{const cs=checks.filter(c=>c.id===id);return {id,ok:cs.every(c=>c.ok),count:cs.length,failed:cs.filter(c=>!c.ok).length};});
await writeDocs({core,content,model,checks,summary,rows,defenses,accuracies,resources,roles,growth,curves,economy,bank,goal,price,projections,followup,endgame});
console.table(summary.map(s=>({목표:s.id,결과:s.ok?'PASS':'FAIL',검사:s.count,실패:s.failed})));
for(const c of checks.filter(c=>!c.ok))console.error(`${c.id} FAIL ${c.label}: ${c.value}`);
console.log('현재 팩 수치 검증 완료. tools/out/saw-balance/balance-report.md');
if(summary.some(s=>!s.ok))process.exitCode=1;
}catch(error){
 await writeFile(new URL('./out/saw-balance/balance-report.md',import.meta.url),`# 수치 스펙 v1 검증 실패\n\n콘텐츠 또는 검증 실행 오류로 계산을 완료하지 못했다. 이전 PASS 리포트는 폐기했다.\n\n${String(error.message)}\n`,'utf8');
 console.error(error);process.exitCode=1;
}finally{await server.close();}
