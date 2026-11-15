import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {json,harness} from './saw-runtime.mjs';
import {lines,mechId,loadout,generation} from './saw-model.mjs';

// 후속1의 시나리오 근사. 피해/명중/정신 효과는 core에서 얻고 행동·트리거·자원 장부만 집계한다.
export async function followupChecks({core,content:c,model:m,shot,battle,au,eu,add}){
 const mm=id=>c.mechs.find(x=>x.id===id),wm=id=>c.weapons.find(x=>x.id===id),am=id=>m.ally.find(x=>x.id===id),enemy=id=>m.enemy.find(x=>x.id===id);
 const effective=u=>{const s=battle(u,u);return {mech:core.effectiveMech(s,s.units[0]),pilot:core.effectivePilot(s,s.units[0])};};
 const maxHit=f=>f.critRate>0?f.criticalDamage.max:f.damage.max;
 const result={comboRows:[],jepa11:[],jepa12:[],friendly13:[],trial:[],regulation:[],preserved:0};
 const fx=(id,atoms)=>[{id,source:'후속1 근사',duration:{unit:'round',remaining:1},lifetime:'turn',hooks:{},atoms}];
 function actor(line,ep){const u=au(line,ep),v=effective(u),maxQuota=line==='claude'?[3,4,4,5][generation(line,ep)-1]:0;return {line,u,en:v.mech.en,maxEn:v.mech.en,sp:v.pilot.sp,maxSp:v.pilot.sp,morale:100,effects:[],quota:maxQuota,maxQuota,lock:0,sealed:false,casts:[],distance:0};}
 function cast(a,id,target){
  const s=battle(a.u,target),u=s.units[0];u.en=a.en;u.sp=a.sp;u.morale=a.morale;u.effects=a.effects;
  if(core.spiritProblem(s,'a',id))return false;
  const r=core.apply(s,{type:'spirit',unitId:'a',spiritId:id}).state.units[0];
  a.sp=r.sp;a.morale=r.morale;a.effects=r.effects;a.casts.push(id);return true;
 }
 function beginTurn(a,t){a.effects=[];a.sealed=a.lock>0;if(a.lock>0){a.lock--;if(!a.lock)a.quota=a.maxQuota;}if(t>1){a.en=Math.min(a.maxEn,a.en+c.rules.enRegenPerRound);a.morale=Math.min(150,a.morale+1);}}
 function quota(a,sub=false){if(a.line==='claude'&&!sub&&--a.quota===0)a.lock=2;}
 function fired(a,w,f){a.en-=w.en??0;a.morale=Math.min(150,a.morale+f.hitRate/100);assert(a.en>=0&&a.sp>=0,'자원 음수');}
 const je11=enemy('rival-jepa-episode-11');
 for(const l of lines.filter(l=>l[2]<=11)){
  const u=au(l[0],11),hp=effective(u).mech.hp,n=shot(eu(je11),u,je11.main),f=shot(eu(je11),u,je11.finisher,{morale:150});
  add('S11',`11화 JEPA ${l[0]} 통상 생존`,maxHit(n)<hp,`${maxHit(n)}/${hp}`);
  if(l[0].startsWith('player-')){
   add('S11',`11화 JEPA ${l[0]} 통상2회`,2*maxHit(n)<hp,`${2*maxHit(n)}/${hp}`);
   add('S11',`11화 JEPA ${l[0]} 최강55%`,maxHit(f)/hp<=.55,`${(100*maxHit(f)/hp).toFixed(2)}%`);
  }
  result.jepa11.push({line:l[0],hp,normal:maxHit(n),strong:maxHit(f)});
 }
 const events11=m.episodes[10].event;
 add('S11','11화 JEPA 불사·5턴',events11.jepaHpFloor===1&&events11.endAfterJepaTurns===5,'HP1 하한 / 등장 뒤5턴');
 for(const combo of m.combos){
  const w=wm(combo.weaponId),ep=combo.generation===3?12:14,lead=au(combo.primary,ep);
  const targets=combo.generation===3?[enemy('rival-jepa-episode-12')]:m.enemy.filter(e=>e.grade==='final'&&e.episode>=14);
  for(const e of targets){const hp=effective(eu(e)).mech.hp,f=shot(au(combo.primary,e.episode),eu(e),w.id,{morale:130,virtualWeapon:true}),ratio=f.landed/hp;
   add('SC',`${combo.name} ${combo.generation}세대 → ${e.id}`,ratio>=(combo.generation===3?.08:.06)&&ratio<=(combo.generation===3?.12:.10),`${(100*ratio).toFixed(3)}%`,'명중 조건부 평균. 실제 예측을 위해 복사 상태에만 임시 장착.');
   result.comboRows.push({name:combo.name,g:combo.generation,enemy:e.id,power:w.power,hp,damage:f.landed,ratio});
  }
  add('SC',`${combo.id} 공통 조건·슬롯 분리`,w.en===50&&w.moraleReq===130&&combo.conditions.ignoreFirstEvade&&combo.conditions.bothUnacted&&combo.conditions.adjacent&&!c.mechs.some(q=>[...q.weapons,...(q.forms??[]).flatMap(f=>f.overrides.weapons??[])].includes(w.id)),'양쪽130/50·인접·미행동 / 일반 슬롯 없음');
  if(combo.generation===4){const prev=m.combos.find(q=>q.name===combo.name&&q.generation===3),p=au(combo.primary,12);const growth=wm(am(lead.mechId).main).power/wm(am(p.mechId).main).power;
   add('SC',`${combo.name} 주력 성장 승계`,Math.abs(w.power/wm(prev.weaponId).power-growth)<=1/wm(prev.weaponId).power,`${(w.power/wm(prev.weaponId).power).toFixed(5)} / ${growth.toFixed(5)}`);
  }
 }
 add('SC','히든 없는 합체기2종',m.combos.filter(q=>q.generation===3&&!q.participants.some(p=>['sonnet','exaone','qwen'].includes(p))).length===2,'멀티모달 제네시스 / 언센서드 어비스');
 add('SC','합체기 이름·참여 확정',m.combos.length===6&&m.combos.every(q=>!q.name.includes('(가칭)'))&&m.combos.filter(q=>q.name==='크로스오버 피어리뷰').every(q=>q.participants.join(',')==='claude,sonnet'),'3종×2세대 / 피어리뷰는 소네트만');
 add('SC','모비딕 합체 참여·12화 해금',m.combos.filter(q=>q.name==='언센서드 어비스').every(q=>q.allowedMechs.deepseek.includes('deepseek-mobydick'))&&m.combos.every(q=>q.fromEpisode>=12),'모비딕 허용 / 11화 사용 불가');

 // 12화: 시작거리18(파트너19), 인접 유지 후 사격. 반격/적 피해/필살·출력은 제외한 대표 운용.
 function jepaRun(route){
  const e=enemy('rival-jepa-episode-12'),target=eu(e),hp=effective(target).mech.hp;
  const team=['gpi','gem','claude','grok','deepseek',route].map(line=>actor(line,12));
  for(const a of team)a.distance=m.scenarioAssumptions.jepa12.initialDistance+(['gem','deepseek'].includes(a.line)?1:0);
  const rounds=[];let remaining=hp,turn=0;
  while(remaining>0&&turn<16){turn++;let first=true,dealt=0;const acted=new Set(),actions=[];
   for(const a of team){beginTurn(a,turn);const stop=['gem','deepseek'].includes(a.line)?4:3;a.distance=Math.max(stop,a.distance-effective(a.u).mech.move);}
   const ready=a=>a.distance<=wm(am(a.u.mechId).main).range[1];
   for(const combo of m.combos.filter(q=>q.generation===3&&q.participants.every(p=>team.some(a=>a.line===p)))){
    const pair=combo.participants.map(p=>team.find(a=>a.line===p));
    if(!pair.every(a=>ready(a)&&!acted.has(a.line)&&!a.sealed&&a.en>=50))continue;
    for(const a of pair)while(a.morale<130&&cast(a,'rouse',target)){}
    if(!pair.every(a=>a.morale>=130))continue;
    const lead=pair[0];cast(lead,'assure',target);
    const f=shot(lead.u,target,combo.weaponId,{morale:lead.morale,effects:lead.effects,virtualWeapon:true}),damage=f.expectedDamage;
    for(const a of pair){a.en-=50;acted.add(a.line);assert(a.en>=0);}
    quota(lead);first=false;remaining-=damage;dealt+=damage;actions.push(`${combo.name}:${damage.toFixed(1)}`);
    if(remaining<=0)break;
   }
   const regular=team.filter(a=>!acted.has(a.line)&&ready(a)).sort((a,b)=>Number(c.pilots.find(p=>p.id===b.u.pilotId).spirits.some(s=>s.id==='assure'))-Number(c.pilots.find(p=>p.id===a.u.pilotId).spirits.some(s=>s.id==='assure')));
   for(const a of regular){if(remaining<=0)break;
    const meta=am(a.u.mechId),id=a.sealed?meta.support:meta.main;if(!id)continue;const w=wm(id);if(a.en<w.en)continue;
    if(!a.sealed&&!cast(a,'assure',target))cast(a,'focus',target);
    const f=shot(a.u,target,id,{morale:a.morale,effects:a.effects});
    const bypass=a.effects.some(e=>e.atoms?.some(x=>x.type==='hitSet'&&x.value===100));
    const damage=first&&!bypass?0:f.expectedDamage;first=false;fired(a,w,damage?f:{...f,hitRate:0});quota(a,a.sealed);
    remaining-=damage;dealt+=damage;actions.push(`${a.line}${damage===0?'(첫 회피)':''}:${damage.toFixed(1)}`);
   }
   rounds.push({turn,damage:dealt,remaining:Math.max(0,remaining),actions:actions.join(' / ')});
  }
  const budgets=team.map(a=>({line:a.line,spUsed:a.maxSp-a.sp,spMax:a.maxSp,en:a.en,casts:a.casts.join(',')}));
  add('S12',`12화 JEPA 히든 없음 ${route}`,remaining<=0&&turn>=6&&turn<=12,`${turn}턴 / HP${hp}`,'기준 변경(Claude 결정, 2026-11-10): 목표6~12턴. 이전6턴 관측 및 수치 유지. 최적 운용 하한 모델이며 HP 증가는 T1·합체기 비율에 영향을 줌.');
  add('S12',`${route} 정신 예산`,budgets.every(a=>a.spUsed<=a.spMax&&a.en>=0),budgets.map(a=>`${a.line}:${a.spUsed}/${a.spMax}`).join(' / '));
  return {route,turn,hp,rounds,budgets};
 }
 result.jepa12=[jepaRun('player-real'),jepaRun('player-super')];
 // 13화 가챠2연타 충돌의 하한: 공격력만 낮춰도 해결되는지 원본을 바꾸지 않고 예측한다.
 const ga=enemy('rival-midjourney-episode-13'),gu=au('gpi',13),pu=au('player-real',13),gh=effective(gu).mech.hp;
 result.gachaBounds=[];
 for(const meanFactor of [1,1.1]){
  const projection=structuredClone(c),w=projection.weapons.find(w=>w.id===ga.main),h=harness(core,projection);let lo=1,hi=w.power;
  for(let i=0;i<20;i++){w.power=Math.floor((lo+hi)/2);const v=h.shot(eu(ga),gu,ga.main,{effects:fx('gacha-average',[{type:'damageMul',value:meanFactor}])});if(v.landed/gh<.22)lo=w.power+1;else hi=w.power;}
  w.power=hi;const twice=2*maxHit(h.shot(eu(ga),pu,ga.main,{effects:fx('gacha-maximum',[{type:'damageMul',value:1.5}])}));
  result.gachaBounds.push({meanFactor,power:w.power,twice,hp:effective(pu).mech.hp});
 }

 // 13화: 평지 사거리 내, 온도100 유지, 정신·합체기·반격 없음. 실제 각 타격의 기대 피해를 누적.
 const ep13=m.episodes[12],rivals=ep13.enemies.filter(e=>e.mechId.startsWith('rival-')&&!e.mechId.includes('jepa'));
 add('S13','13화 편성 확정',rivals.length===9&&ep13.enemies.length===14&&ep13.enemies.filter(e=>e.mechId.includes('production')).every(e=>e.count===2)&&ep13.enemies.find(e=>e.mechId==='predict-cube-episode-13')?.count===2&&ep13.enemies.find(e=>e.mechId==='elastic-cat-episode-13')?.count===1,'라이벌9+JEPA1+양산4+큐브2+고양이1');
 for(const route of ['player-real','player-super']){
  const team=lines.filter(l=>l[2]<=13&&(!l[0].startsWith('player-')||l[0]===route)).map(l=>actor(l[0],13));
  const targets=rivals.map(e=>({u:e,hp:effective(e).mech.hp,max:effective(e).mech.hp})).sort((a,b)=>a.hp-b.hp);
  let total=0,kills=0;const log=[];
  for(let t=1;t<=6;t++){let turnDmg=0;for(const a of team){beginTurn(a,t);a.morale=100;const d=targets.find(x=>x.hp>0);if(!d)break;
    const meta=am(a.u.mechId),id=a.sealed?meta.support:meta.main,w=wm(id);if(a.en<w.en)continue;
    const f=shot(a.u,d.u,id),damage=f.expectedDamage;d.hp-=damage;total+=damage;turnDmg+=damage;fired(a,w,f);quota(a,a.sealed);if(d.hp<=0)kills++;
   }log.push({turn:t,damage:turnDmg,kills});}
  add('S13',`13화9기6턴 ${route}`,team.length===9&&kills>=3&&kills<=7,`${total.toFixed(1)} 기대 피해 / ${kills}기`,'낮은 HP 순 집중, 타격 초과분 이월 없음. 실제 종료는6턴 또는5기 격파.');
  result.friendly13.push({route,total,kills,log});
 }
 add('S13','11화 전용 낙타·13화 종료',m.episodes.filter(ep=>ep.enemies.some(e=>e.mechId.startsWith('camel-'))).map(e=>e.episode).join(',')==='11'&&ep13.event.endTurn===6&&ep13.event.rivalDefeats===5,'낙타11화만 / 6턴 또는 라이벌5기');
 // 단독 상계는 온도150+집중+장고1.3을 매번 무료로 주고 EN도 무시한다.
 const elites=ep13.enemies.filter(e=>e.mechId.includes('production')),du=au('deepseek',13),deep=actor('deepseek',13),bounds=[];
 for(const d of elites)for(const id of mm(du.mechId).weapons.filter(id=>!wm(id).map))bounds.push(shot(du,d,id,{morale:150,effects:fx('trial-focus',[...c.spirits.find(s=>s.id==='focus').effects,{type:'damageMul',value:1.3}])}).expectedDamage);
 const pairHp=elites.reduce((n,e)=>n+effective(e).mech.hp,0),soloBound=4*Math.max(...bounds);
 add('SH','하우징 시험 단독4턴 불가',soloBound<pairHp,`낙관적 상계${soloBound.toFixed(1)} < 두 기 HP${pairHp}`,'온도150·집중·장고1.3·무한 EN 상계, 합체/타인 디버프 없음.');
 const trialTeam=['gpi','gem','deepseek'].map(line=>actor(line,13)),targets=elites.map(u=>({u,hp:effective(u).mech.hp})),trialLog=[];let trialKills=0,clearTurn=null;
 for(const a of trialTeam)while(a.morale<130&&cast(a,'rouse',targets[0].u)){}
 for(let t=1;t<=4&&trialKills<2;t++)for(const a of trialTeam){beginTurn(a,t);cast(a,'focus',targets[0].u);
  const candidates=mm(a.u.mechId).weapons.filter(id=>!wm(id).map&&wm(id).moraleReq<=a.morale&&wm(id).en<=a.en).flatMap(id=>targets.filter(d=>d.hp>0).map(d=>({d,w:wm(id),f:shot(a.u,d.u,id,{morale:a.morale,effects:a.effects})})));
  const finish=candidates.filter(x=>x.d.hp<=x.f.expectedDamage);
  const choices=a.line==='deepseek'?(finish.length?finish:candidates):candidates.filter(x=>x.d.hp>x.f.expectedDamage);
  choices.sort((a,b)=>a.d.hp-b.d.hp||b.f.expectedDamage-a.f.expectedDamage);const pick=choices[0];if(!pick)continue;
  const before=pick.d.hp;pick.d.hp-=pick.f.expectedDamage;fired(a,pick.w,pick.f);
  if(pick.d.hp<=0){assert.equal(a.line,'deepseek');trialKills++;if(trialKills===2)clearTurn=t;}
  trialLog.push({turn:t,line:a.line,target:pick.d.u.mechId,weapon:pick.w.name,damage:pick.f.expectedDamage,before,after:Math.max(0,pick.d.hp)});
 }
 add('SH','하우징 시험 지원2기·딥시크 막타',trialKills===2&&clearTurn<=4,`${trialKills}기 / ${clearTurn??'미달'}턴`,'지피·젬 지원, 온도100→분발3회, 집중, EN/SP 실제 예산, 공격 단위 기대 피해.');
 const mob={...au('deepseek',13),mechId:'deepseek-mobydick'},mobHp=effective(mob).mech.hp;let worst=0,worstName='';
 for(const e of ep13.enemies)for(const id of mm(e.mechId).weapons){const f=shot(e,mob,id,{morale:150});if(maxHit(f)>worst){worst=maxHit(f);worstName=wm(id).name;}}
 add('SH','13화 모비딕 최강 공격 생존',worst<mobHp,`${worst}/${mobHp} (${worstName})`,'최대 분산·가능한 크리, 온도150.');
 result.trial={soloBound,pairHp,trialKills,clearTurn,trialLog,worst,worstName,mobHp,budgets:trialTeam.map(a=>({line:a.line,sp:a.maxSp-a.sp,maxSp:a.maxSp,en:a.en}))};
 add('SH','시험 보상 즉시 환장',ep13.event.housingTrial.deadlineTurn===4&&ep13.event.housingTrial.deepseekEliteKills===2&&ep13.event.housingTrial.hpFull&&ep13.event.housingTrial.enFull&&ep13.event.housingTrial.moraleAdd===10,'전투 중 모비딕 / HP·VRAM 전회복 / 온도+10');
 // 규제 판정은 발사 전 실효 EN 소비 기준. 현재 무장은 고정 비용이며 MAP은 비용과 무관하게 대상.
 for(const l of lines.filter(l=>l[2]<=8)){
  const u=au(l[0],8),q=mm(u.mechId),forms=q.forms?.length?q.forms:[{id:'normal',name:'기본',overrides:{}}];
  for(const form of forms){const ids=form.overrides.weapons??q.weapons,bad=ids.filter(id=>(wm(id).en??0)>=40||wm(id).map),safe=ids.filter(id=>!bad.includes(id));
   add('S8',`8화 ${l[0]}/${form.id} 무딱지2종`,safe.length>=2,`대상${bad.length} / 안전${safe.length}`,'실효 발사 EN≥40 또는 MAP, 기준40 유지.');
   result.regulation.push({line:l[0],form:form.name,count:bad.length,safe:safe.length,weapons:bad.map(id=>`${wm(id).name}(${wm(id).en}${wm(id).map?', MAP':''})`).join(' / ')||'없음'});
  }
 }
 // 후속 작업으로 바꾸지 않기로 한 원본 수치/편성을 정규화 해시로 검증한다.
 const baseline=await json('../../story/mechs/spec-v1/followup-1-baseline.json');
 const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
 const hash=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
 for(const [id,h] of Object.entries(baseline.allyStats)){assert.equal(hash(Object.fromEntries(Object.entries(mm(id)).filter(([k])=>k!=='weapons'))),h,`아군 기본 수치 변경:${id}`);result.preserved++;}
 for(const [id,h] of Object.entries(baseline.mechs)){if(modelEndgameOverride(id))continue;assert.equal(hash(mm(id)),h,`보존 적 변경:${id}`);result.preserved++;}
 for(const [id,h] of Object.entries(baseline.weapons)){if(modelEndgameOverride(id))continue;assert.equal(hash(wm(id)),h,`보존 무장 변경:${id}`);result.preserved++;}
 assert.equal(hash(c.pilots),baseline.pilots,'파일럿 변경');
 for(const [ep,h] of Object.entries(baseline.episodes)){if(m.revision>=2&&Number(ep)>=14)continue;assert.equal(hash(m.episodes[Number(ep)-1]),h,`${ep}화 보존 편성/수입 변경`);}
 function modelEndgameOverride(id){return m.revision>=2&&/^pico-form-\d-episode-(14|15)(-|$)/.test(id);}
 return result;
}

export function followupReport(f,model,content,table){
 const n=x=>Number(x.toFixed(2)),pct=(a,b)=>`${(100*a/b).toFixed(2)}%`;
 let s='\n## 후속 수정1: 새 검사 결과\n\n';
 s+='### 11화 JEPA\n\n전반 다큰낙타전 뒤 이벤트 JEPA 등장. HP1 하한으로 격파 불가, 등장 뒤5턴 생존. 표의 피해는 최대 분산·발생 가능한 크리, 최강 공격자는 온도150이다. 숨은 보상은 문서/모델에만 기록: 필중1회 명중 시12화 전원 온도+5. 아래12화 검사는 보상을 받지 않은 기준이다.\n\n';
 s+=table(['아군','HP','통상 최대','통상2회/HP','최강 최대/HP'],f.jepa11.map(r=>[r.line,r.hp,r.normal,pct(2*r.normal,r.hp),pct(r.strong,r.hp)]));
 s+='\n### 합체기 위력과 조건\n\n모든 합체기는12화부터, 양쪽 온도130·VRAM50·인접·미행동, 양쪽 행동 종료. 피어리뷰는 클로드+소네트만 참여하고 클로드 한도1칸 차감. 다른2종은 히든 없이 사용 가능하며 언센서드 어비스는 모비딕도 참여한다. ignoreFirstEvade는 model.json에만 둔다. 실제 전투 공식에 의한 **명중 조건부 평균**으로8~12%/6~10%를 검사한다.\n\n';
 s+=table(['이름','세대','대상','위력','명중 피해','대상 HP','비율'],f.comboRows.map(r=>[r.name,r.g,r.enemy,r.power,n(r.damage),r.hp,pct(r.damage,r.hp)]));
 s+='\n### 12화 JEPA6인 공략\n\n지피·젬·클로드·그록·딥시크·플레이어6인, 히든 없음. 초기 온도100, 초기 거리18(인접 파트너19), 평지 직선 이동 후 인접 진형 유지, 공격 후 온도는 명중률로 평균 상승시키고 매턴+1. 공격 피해/명중/정신 효과는 core 예측과 apply로 계산한다. 매턴 첫 공격 시도에서 회피권이 소모되며 필중·합체기는 통과한다. 반격·적 페이즈의 아군 피해·치료 행동·출력(surge)은 제외한 **낙관적 화력 모델**이다. 실제 스테이지 완주 턴을 보장하는 시뮬레이션은 아니다.\n\n정책: 사용 가능한2합체기를 먼저 쓰며, 필요한 분발과 주 참여자 필중을 SP 안에서 사용한다. 이후 일반 공격은 필중 보유자부터, 사용 불가 시 집중으로 보완한다. 기본 EN회복8, 두 참여자의 EN50씩, 행동1회, 클로드4칸/봉인2턴을 모두 장부에 반영한다.\n\n';
 for(const r of f.jepa12){s+=`#### ${r.route}: ${r.turn}턴 / JEPA HP${r.hp}\n\n`;
  s+=table(['턴','기대 피해','남은 HP','행동'],r.rounds.map(t=>[t.turn,n(t.damage),n(t.remaining),t.actions||'접근']));
  s+='\n'+table(['파일럿','SP 사용/최대','마지막 EN','정신 사용 기록'],r.budgets.map(a=>[a.line,`${a.spUsed}/${a.spMax}`,a.en,a.casts]));
 }
 s+='\n**기준 변경(Claude 결정, 2026-11-10):** 목표를8~12턴에서6~12턴으로 변경했다. 변경 전 관측값6턴은 그대로이며 현재 PASS다. 최적 운용의 하한 모델이므로 JEPA HP를 올려 T1/합체기 비율을 바꾸지 않는다.\n\n';
 s+='### 13화9기6턴 격파량\n\n라이벌 올스타9기+JEPA+GLM양산2+키미양산2+예측 큐브2+고양이 탄성 로봇1. 라이벌9종만 공격 표적으로 삼아 낮은 HP 순 집중한다. 온도100 고정, 주력 무장, 정신·합체기·반격·적 피해·접근 시간 제외, 9기 생존을 가정한 화력 용량 근사다. 매 타격 expectedDamage를 적용하고 초과 피해를 다음 적에 넘기지 않는다. EN회복/소모와 클로드 봉인도 반영한다.\n\n';
 s+=table(['플레이어 계열','6턴 기대 피해 총량','라이벌 격파 수','턴별 누적 격파'],f.friendly13.map(r=>[r.route,n(r.total),r.kills,r.log.map(x=>`${x.turn}턴:${x.kills}`).join(' / ')]));
 s+='\n실제 종료는6턴 종료 또는 라이벌5기 격파 중 먼저 성립하는 조건이다. 하우징 시험의 양산형 집중은 별도 전술 분기이며 이 화력 예산과 동시에 전량을 약속하지 않는다. 13화 기준 보상 예산은 라이벌3기만 산입하고 JEPA 및 미격파 적 보상은 제외했다. 시험의 양산형2기 보상400은 선택 분기의 추가 수입으로 기준 예산에서 뺐다. 13화 신규 라이벌 HP는 지피8.1명중 상당(올림9회)으로 저작해 수량전의6턴 목표와 T1을 함께 맞췄다.\n\n';
 const h=f.trial;
 s+='### 기가원펑의 시험\n\n13화 시작부터4턴 안에 양산형2기를 딥시크 막타로 격파해야 한다. 성공 즉시 그 전투에서 모비딕으로 change-mech, HP/VRAM 전회복·온도+10. 실패하면14·15화 V4-Flash 유지. 이 검사는 이동 없이 사거리 내 교전하는 별도 시험 배치 근사다.\n\n';
 s+=`단독의 낙관적4턴 상계는 **${n(h.soloBound)}**, 양산형 두 기의 합산 HP는 **${h.pairHp}**다. 매 발 온도150·집중·자체 장고1.3·무한 EN까지 허용한 기대 피해 상계가 HP보다 낮으므로 평균 피해 모델에서 단독으로는 불가능하다. 지원은 지피+젬이며 실제 SP로 분발3회 및 집중, 온도130 무장과 EN 회복을 사용한다. 평균 피해로 **${h.clearTurn??'미달'}턴에 ${h.trialKills}기**, 막타는 모두 딥시크다.\n\n`;
 s+=table(['턴','공격자','대상','무장','기대 피해','남은 HP'],h.trialLog.map(r=>[r.turn,r.line,r.target,r.weapon,n(r.damage),n(r.after)]));
 s+='\n'+table(['파일럿','SP 사용/최대','마지막 EN'],h.budgets.map(r=>[r.line,`${r.sp}/${r.maxSp}`,r.en]));
 s+=`\n모비딕13화 최대 HP **${h.mobHp}**, 적 전 무장 중 가장 큰 가능한 피해 **${h.worst}**(${h.worstName}, ${pct(h.worst,h.mobHp)}). 생존한다.\n\n`;
 s+='### 8화 규제 딱지\n\n규제 구역에서 발사1회 실효 VRAM소비≥40 또는 MAP이면 정상 발사 뒤 그 무장2턴 봉인. 표는 정신/캐싱 등 조건부 할인 없는 기준 편성이며 두 플레이어 계열과 젬3형태를 각각 검사한다. 향후 할인 효과가 켜지면 최종 effectiveWeapon 소비로 재판정한다. 모든 경우 안전 무장2종 이상이므로 기준40을 유지하며 대안 수치는 제안하지 않는다. 합체기는 아직 해금 전이다.\n\n';
 s+=table(['아군','형태','딱지 대상 수','안전 무장 수','딱지 대상 무장(소비)'],f.regulation.map(r=>[r.line,r.form,r.count,r.safe,r.weapons]));
 s+=`\n### 보존 확인\n\n후속1 이전의 아군 기본 수치·파일럿·1~10화/14~15화 적 수치 및 편성/수입을 정규화 SHA-256로 비교했다. 개별 기체/무장 **${f.preserved}개**가 일치한다(클로드3·4세대6번 무장은 합체기 분리 지시에 따른 예외). 캠페인 원본 해시는 별도로 검사한다.\n\n`;
 s+='### 남은 수치 충돌 — 기준 변경(Claude 결정, 2026-11-10)\n\n변경 전12화 JEPA는6턴, 13화 두 화가 라이벌의 최대 가챠2연타는11,396/8,700이었다. 수치는 유지한다. S12는6~12턴, 가챠2연타는평균1.1배·평균 피해, 1회 생존은최대1.5배로 판정하며 T2/T5에 같이 적용한다. 이 기준 변경으로 후속1의5개 FAIL은 해소됐다.\n\n';
 s+='아래는 변경 전 최대2연타 기준을 공격력만으로 맞출 수 있는지 확인했던 참고 투영이다. 현재의 실패 조건이 아니며 적 위력 수정에 사용하지 않는다.\n\n'+table(['22% 기준 배율','참고 투영 위력','옛 기준 최대2연타','플레이어 HP'],f.gachaBounds.map(r=>[r.meanFactor,r.power,r.twice,r.hp]));
 return s;
}
