import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {json} from './saw-runtime.mjs';
import {lines,mechId} from './saw-model.mjs';

// 맵/조건 트리거와 자원 장부의 명시적 근사. 전투 피해와 정신 효과는 실제 core만 계산한다.
export async function endgameChecks({core,content:c,model:m,au,eu,shot,battle,add}){
 const mm=id=>c.mechs.find(x=>x.id===id),wm=id=>c.weapons.find(x=>x.id===id),em=id=>m.enemy.find(x=>x.id===id),am=id=>m.ally.find(x=>x.id===id);
 const clean=u=>({mechId:u.mechId,pilotId:u.pilotId,level:u.level,upgrades:u.upgrades});
 const effective=u=>{const s=battle(clean(u),clean(u));return {mech:core.effectiveMech(s,s.units[0]),pilot:core.effectivePilot(s,s.units[0])};};
 const fx=(id,atoms)=>[{id,source:'종장 근사',duration:{unit:'round',remaining:1},lifetime:'turn',hooks:{},atoms}];
 const maxHit=f=>f.critRate>0?f.criticalDamage.max:f.damage.max;
 const out={survival14:[],kills:[],beam15:[],claude15:null,autoFire:null,healing3:null,preserved:0};
 const noHidden=(line,ep,mob=false)=>{
  const u=au(line,ep);if(['gem','grok'].includes(line))u.mechId=mechId(line,3);
  if(line==='deepseek'&&mob)u.mechId='deepseek-mobydick';return u;
 };
 const ep14=m.episodes[13],ep15=m.episodes[14],p1=em('pico-form-1-episode-14'),p2=em('pico-form-2-episode-15'),p3=em('pico-form-3-episode-15');
 add('S14','14화 형태·강제 출격·우군',ep14.enemies.filter(e=>e.mechId.startsWith('pico-form-')).map(e=>e.mechId).join()==='pico-form-1-episode-14'&&ep14.forcedDeploy.join(',')==='grok,gpi,player'&&ep14.allies.length===10,'1형태 / 그록·지피·플레이어 / 자동 우군9+JEPA');
 add('S15','15화 형태·우군·전환',ep15.enemies.filter(e=>e.mechId.startsWith('pico-form-')).map(e=>e.mechId).join(',')==='pico-form-2-episode-15,pico-form-3-episode-15'&&ep15.allies.length===1&&ep15.allies[0].pilotId==='jepa'&&ep15.forcedDeploy.join(',')==='claude,player'&&ep15.event.stage2To3.hp===0,'2형태 HP0→독립3형태 / JEPA만 / 클로드·플레이어');
 for(const route of ['player-real','player-super'])for(const line of ['gpi','grok',route]){
  const u=noHidden(line,14),hp=effective(u).mech.hp,n=shot(eu(p1),u,p1.main),map=mm(p1.id).weapons.find(id=>wm(id).map),rawMap=shot(eu(p1),u,map,{morale:130});
  let left=hp;const history=[];
  for(let t=1;t<=3;t++){const cancelledMaps=1;left-=n.expectedDamage;history.push({turn:t,hp:left,cancelledMaps});}
  add('S14',`${route} ${line} 정렬 전3턴`,left>0,`${left.toFixed(1)}/${hp}, MAP3회 무효`,'각 강제 기체가 단일 공격에3회 집중 노출된 독립 최악 표적 가정. 평균 피해, 정신/수리/복귀 미사용.');
  out.survival14.push({route,line,hp,normal:n.expectedDamage,rawMap:rawMap.expectedDamage,remaining:left});
 }
 // 한 페이즈에서 첫 MAP만 막고, 다음 페이즈에 무효권이 다시 생기는지 확인한다.
 let phase=null,used=0;const cancel=(round,kind)=>{if(phase!==round){phase=round;used=0;}if(kind==='map'&&used<m.alignment.jepa.cancelPicoMapsPerEnemyPhase){used++;return true;}return false;};
 const cancelled=[1,2,3].map(t=>{assert.equal(cancel(t,'single'),false);return [cancel(t,'map'),cancel(t,'map')];});
 add('SA','JEPA 첫 MAP만 무효',cancelled.every(r=>r[0]&&!r[1])&&m.alignment.jepa.cancelPicoMapsPerEnemyPhase===1&&m.autoUnits.filter(a=>a.role==='map-cancel').every(a=>mm(a.id).weapons.length===0),'매 적 턴 [첫 MAP=0, 둘째 MAP=정상], JEPA 무장0');
 const ram=ep14.event.emergencyRam,ramHp=line=>Math.floor(effective(noHidden(line,14)).mech.hp*.3);
 add('S14','비상 RAM1회 복귀',ram.usesPerEpisode===1&&ram.perPilot&&ram.nextPlayerPhase&&ram.hpPct===30&&ram.pilots.join(',')==='gpi,grok',`다음 아군 턴 지피${ramHp('gpi')}/그록${ramHp('grok')} HP, 각1회`);
 const ramUses={gpi:0,grok:0},revive=(line,phase)=>ram.pilots.includes(line)&&phase==='next-player'&&ramUses[line]<ram.usesPerEpisode?(ramUses[line]++,ramHp(line)):0;
 add('S14','비상 RAM 시점·중복 금지',revive('gpi','enemy')===0&&revive('gpi','next-player')===ramHp('gpi')&&revive('gpi','next-player')===0&&revive('grok','next-player')===ramHp('grok')&&revive('player','next-player')===0,'다음 아군 턴에만·각1회·플레이어 제외');

 const eligible=ep14.enemies.filter(e=>['grunt','elite'].includes(em(e.mechId).grade));
 const totalHp=eligible.reduce((n,e)=>n+effective(e).mech.hp*e.count,0),count=eligible.reduce((n,e)=>n+e.count,0);
 const autoRows=ep14.allies.filter(a=>a.role==='fodder-screen').map(a=>{
  const ids=mm(a.mechId).weapons.filter(id=>!wm(id).map&&(wm(id).moraleReq??0)<=100),mean=eligible.reduce((n,e)=>n+Math.max(...ids.map(id=>shot(clean(a),clean(e),id).expectedDamage))*e.count,0)/count;
  const cost=Math.max(...ids.map(id=>wm(id).en??0)),cap=effective(a).mech.en;let en=cap,turns=0;for(let t=0;t<6;t++){if(en<cost)break;en=Math.min(cap,en-cost+c.rules.enRegenPerRound);turns++;}
  return {name:mm(a.mechId).name,id:a.mechId,level:a.level,upgrade:a.upgrades.weapons,turns,damage:mean*turns};
 });
 const autoDamage=autoRows.reduce((n,r)=>n+r.damage,0),ratio=autoDamage/totalHp;
 add('S14','우군9기6턴 화력',ratio>=.3&&ratio<=.6,`${autoDamage.toFixed(1)}/${totalHp} = ${(100*ratio).toFixed(2)}%`,'온도100에서 표적별 최선 무장, 자코·양산형 수량 가중 평균. 중보스/피코·정신·원호·특능 배율 제외.');
 add('S14','우군 단독 승리 금지',ep14.allies.filter(a=>a.role==='fodder-screen').every(a=>a.control==='auto'&&a.level===27&&a.targetGrades.join(',')==='grunt,elite')&&ep14.event.victory.mechId===p1.id&&m.alignment.commands[0].pilotId==='player','우군은 자코·양산형만, 플레이어 정렬 전 피코 HP1 하한');
 out.autoFire={damage:autoDamage,hp:totalHp,ratio,rows:autoRows,adjustment:ep14.allyFireAdjustment};

 // 정렬 후 공격 용량: 히든 없는5인+플레이어. 각 구간은 최대 자원에서 시작하는 독립 근사다.
 function profile(ep,route,mob){
  const target=eu(ep===14?p1:p2),hp=effective(target).mech.hp,regen=Math.floor(hp*.02);
  const team=['gpi','gem','claude','grok','deepseek',route].map(line=>{
   const u=noHidden(line,ep,mob),v=effective(u),meta=am(u.mechId)??am('deepseek-generation-3'),base=mm(meta.id),q=line==='claude'?5:0;
   return {line,u,meta,main:u.mechId==='deepseek-mobydick'?mm(u.mechId).weapons[base.weapons.indexOf(meta.main)]:meta.main,en:v.mech.en,maxEn:v.mech.en,sp:v.pilot.sp,maxSp:v.pilot.sp,morale:100,effects:[],quota:q,maxQuota:q,lock:0,sealed:false,casts:[]};
  });
  function cast(a,id){const s=battle(a.u,target),u=s.units[0];u.en=a.en;u.sp=a.sp;u.morale=a.morale;u.effects=a.effects;if(core.spiritProblem(s,'a',id))return false;const r=core.apply(s,{type:'spirit',unitId:'a',spiritId:id}).state.units[0];a.sp=r.sp;a.morale=r.morale;a.effects=r.effects;a.casts.push(id);return true;}
  function quota(a,sub){if(a.line==='claude'&&!sub&&--a.quota===0)a.lock=2;}
  const history=[];let left=hp,t=0;
  while(left>0&&t<15){t++;const acted=new Set();let damage=0;
   for(const a of team){a.effects=[];a.sealed=a.lock>0;if(a.lock>0&&--a.lock===0)a.quota=a.maxQuota;if(t>1){a.en=Math.min(a.maxEn,a.en+c.rules.enRegenPerRound);a.morale=Math.min(150,a.morale+1);}}
   for(const combo of m.combos.filter(q=>q.fromEpisode<=ep&&q.participants.every(p=>team.some(a=>a.line===p))&&q.allowedMechs[q.primary].includes(team.find(a=>a.line===q.primary).u.mechId))){
    const pair=combo.participants.map(p=>team.find(a=>a.line===p));if(!pair.every(a=>!acted.has(a.line)&&!a.sealed&&a.en>=50))continue;
    for(const a of pair)while(a.morale<130&&cast(a,'rouse')){}
    if(!pair.every(a=>a.morale>=130))continue;cast(pair[0],'assure');
    const f=shot(pair[0].u,target,combo.weaponId,{morale:pair[0].morale,effects:pair[0].effects,virtualWeapon:true});left-=f.expectedDamage;damage+=f.expectedDamage;
    for(const a of pair){a.en-=50;acted.add(a.line);}quota(pair[0],false);if(left<=0)break;
   }
   for(const a of team.filter(a=>!acted.has(a.line))){if(left<=0)break;const id=a.sealed?a.meta.support:a.main;if(!id||a.en<(wm(id).en??0))continue;
    if(!a.sealed&&!cast(a,'assure'))cast(a,'focus');
    const f=shot(a.u,target,id,{morale:a.morale,effects:a.effects});left-=f.expectedDamage;damage+=f.expectedDamage;a.en-=wm(id).en??0;a.morale=Math.min(150,a.morale+f.hitRate/100);quota(a,a.sealed);
   }
   const healing=left>0?Math.min(regen,hp-left):0;left+=healing;history.push({turn:t,damage,healing,left:Math.max(0,left)});
   assert(team.every(a=>a.en>=0&&a.sp>=0),'종장 자원 음수');
  }
  add(ep===14?'S14':'S15',`${ep}화 ${route}/${mob?'모비딕':'V4-Flash'} 정렬 후 격파`,left<=0&&t>=4&&t<=7,`${t}턴 / HP${hp}`,'사거리 내 독립 공격 장부, 시작100·최대 EN/SP, 첫2형태 기존 회복2%, 합체기·정신·클로드 한도·기본 회복8. 접근/피격/우군 화력 미산입.');
  out.kills.push({ep,route,mob,turns:t,hp,regen,history,budgets:team.map(a=>({line:a.line,used:a.maxSp-a.sp,max:a.maxSp,en:a.en}))});
 }
 for(const ep of [14,15])for(const route of ['player-real','player-super'])for(const mob of [false,true])profile(ep,route,mob);

 // 광선은 JEPA의 취소를 빼고 원래 한 발을 평가하여 위력 기준이 공허해지지 않게 한다.
 const beamTargets=[...lines.map(l=>({line:l[0],u:au(l[0],15)})),...['gem','grok','sonnet'].map(line=>({line:`${line}(최종 미해금)`,u:{...au(line,15),mechId:mechId(line,line==='sonnet'?2:3)}})),{line:'deepseek(모비딕)',u:{...au('deepseek',15),mechId:'deepseek-mobydick'}}];
 for(const {line,u} of beamTargets){const hp=effective(u).mech.hp,f=shot(eu(p2),u,p2.beam,{morale:130}),damage=maxHit(f),ratio=damage/hp;
  add('S15',`정렬 전 광선 ${line}`,ratio<=.3&&hp-3*damage>0,`${(100*ratio).toFixed(2)}%, 3회 후${(hp-3*damage).toFixed(1)}/${hp}`,'정신/방어/JEPA 취소 없이 가능한 크리·최대 분산. 저세대·모비딕 포함.');out.beam15.push({line,hp,damage,mean:f.landed,ratio,left:hp-3*damage});
 }
 const cl=au('claude',15),clHp=effective(cl).mech.hp,strong=shot(eu(p2),cl,p2.finisher,{morale:150});
 add('S15','페이블2칸 내 단일 최강 생존',cl.mechId==='claude-generation-4'&&maxHit(strong)<clHp,`${maxHit(strong)}/${clHp}`,'온도150·가능한 크리·최대 분산·방어/정신 없음.');out.claude15={hp:clHp,damage:maxHit(strong)};
 const thirdHp=effective(eu(p3)).mech.hp,s3=battle(au('gpi',15),eu(p3));
 add('SA','3형태 데이터상 비공격',mm(p3.id).weapons.length===0&&core.availableWeapons(s3,'d').length===0&&m.alignment.forms['pico-form-3'].hpFloor===1,'무장0·공격 후보0·영구 HP1 하한');
 out.healing3={hp:thirdHp,perTurn:Math.floor(thirdHp*.02)};
 add('SA','3형태 회복2%',m.alignment.forms['pico-form-3'].regenPct===2,`${out.healing3.perTurn}/${thirdHp} 매 턴`);
 alignmentChecks();
 function alignmentChecks(){
  const commands=m.alignment.commands,dist=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y),pico={x:6,y:6};
  const context={player:true,sp:0,en:0,acted:true,form:commands[0].formId,hits:{gpi:1,grok:0},units:[{id:'claude',x:5,y:6,alive:true,deployed:true},{id:'jepa',x:6,y:8,alive:true,deployed:true,control:'auto'}]};
  const can=(cmd,ctx)=>ctx.player&&ctx.form===cmd.formId&&(cmd.stage===1?['gpi','grok'].every(p=>ctx.hits[p]>=1):cmd.stage===2?['claude','jepa'].every(p=>ctx.units.some(u=>u.id===p&&u.alive&&u.deployed&&dist(u,pico)<=2)):[...new Set(ctx.units.filter(u=>u.alive&&u.deployed&&['gpi','gem','claude','grok','deepseek','sonnet','exaone','qwen'].includes(u.id)&&dist(u,pico)<=2).map(u=>u.id))].length>=4&&dist(ctx.playerPosition,pico)===1);
  add('SA','솔직함 명중 조건',!can(commands[0],context)&&can(commands[0],{...context,hits:{gpi:1,grok:1}}),'그록·지피 각각 명중1회, 한쪽 누락/미스는 불가');
  const harmless={...context,form:commands[1].formId};
  add('SA','무해함 거리 조건',can(commands[1],harmless)&&!can(commands[1],{...harmless,units:harmless.units.map(u=>u.id==='jepa'?{...u,y:9}:u)})&&commands[1].effects.beamRadius===4&&ep15.allies[0].positioning.autoApproach&&ep15.allies[0].positioning.maxDistance===2,'클로드/우군 JEPA 모두2칸 / JEPA 자동 접근 / 광선 all-map→반경4');
  const useful={...context,form:commands[2].formId,playerPosition:{x:6,y:5},hp:thirdHp,units:['gpi','gem','claude','grok'].map((id,i)=>({id,...[{x:4,y:6},{x:5,y:5},{x:6,y:4},{x:7,y:5}][i],alive:true,deployed:true}))};
  add('SA','유익함4기·인접·HP 무관',can(commands[2],useful)&&can(commands[2],{...useful,hp:1})&&!can(commands[2],{...useful,units:useful.units.slice(0,3)})&&!can(commands[2],{...useful,playerPosition:{x:6,y:4}})&&commands[2].effects.victory,'4히로인/2칸·플레이어 인접, 최대HP/HP1 모두 정화');
  add('SA','정렬 커맨드 무료·행동 미소모',commands.length===3&&commands.every(cmd=>cmd.pilotId==='player'&&cmd.sp===0&&cmd.en===0&&!cmd.consumesAction)&&can(commands[2],useful),'SP0·EN0·이미 행동한 플레이어도 조건 충족 시 사용');
  const u=au('gpi',14),f=shot(u,eu(p1),am(u.mechId).main),reduced=shot(u,eu(p1),am(u.mechId).main,{defenderEffects:fx('alignment-seal',[{type:'takenMul',value:.1}])});
  add('SA','정렬 전10%·HP1 하한',Math.abs(reduced.landed/f.landed-.1)<.001&&Math.max(1,100-1000)===1&&m.alignment.before.hpFloor===1,`${f.landed.toFixed(1)}→${reduced.landed.toFixed(1)}, HP1 유지`,'피해10%는 core 원소 예측, HP 하한/승리는 명시적 트리거 모델.');
 }
 const b=await json('../../story/mechs/spec-v1/followup-2-baseline.json');
 const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
 const hash=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
 for(const [id,h] of Object.entries(b.mechs)){assert.equal(hash(mm(id)),h,`후속2 보존 기체:${id}`);out.preserved++;}
 for(const [id,h] of Object.entries(b.weapons)){assert.equal(hash(wm(id)),h,`후속2 보존 무장:${id}`);out.preserved++;}
 assert.equal(hash(c.pilots),b.pilots);assert.equal(hash(m.combos),b.combos);
 for(const [ep,h] of Object.entries(b.episodes))assert.equal(hash(m.episodes[Number(ep)-1]),h,`1~13화 변경:${ep}`);
 for(const [ep,h] of Object.entries(b.endgameFodder))assert.equal(hash(m.episodes[Number(ep)-1].enemies.filter(e=>!e.mechId.startsWith('pico-form-'))),h,`${ep}화 군단 수치/수 변경`);
 return out;
}

export function endgameReport(f,m,table){
 const n=x=>Number(x.toFixed(2));let s='\n## 후속 수정2: 14·15화와 정렬\n\n';
 s+='14화는 스마일 가면만,15화는 쇼거스 HP0 뒤 독립 HP의 고독한 특이점 등장이다. 정화된 요정은 유닛으로 만들지 않았다. 정렬 전 피해10%·HP1 하한, 플레이어 전용3커맨드는 SP/EN0·행동 미소모다. 3형태는 무장0·공격 불가·영구 HP1 하한이며 정화 커맨드가 승리다.\n\n';
 s+='### 14화 정렬 전3턴\n\n피코의 단일 공격이 각 강제 기체에3회 집중된 독립 사례를 검사했다. 첫 MAP은 매 적 턴 JEPA가 무효화한다. 피해는 실제 expectedDamage, 반격/정신/수리/비상 RAM의 도움 없이 생존해야 통과한다. 일반기 피해는 포함하지 않는다.\n\n';
 s+=table(['계열','강제 기체','최대 HP','단일 공격 기대 피해','취소 전 MAP 기대 피해','3턴 후 HP'],f.survival14.map(r=>[r.route,r.line,r.hp,n(r.normal),n(r.rawMap),n(r.remaining)]));
 s+='\n### 정렬 후1·2형태 격파\n\n히든 없는5인+플레이어: 지피 아스트라·젬 아르곤·클로드 페이블·그록4.20 헤비·딥시크·플레이어 최종기. 딥시크만 V4-Flash/모비딕 두 분기를 각각 검사한다. 각 정렬 후 구간은 사거리 내·최대 EN/SP·온도100에서 시작하는 독립 화력 모델이다. 분발/필중/집중은 실제 습득·SP 비용을 사용하며 합체기 양쪽 EN50/행동, 기본 회복8, 클로드5칸/봉인2턴을 집계한다. 피격/치료/접근 시간은 미산입, 우군은 피코를 공격하지 않는다. 1·2형태 회복은 현행2%를 유지한다.\n\n';
 s+=table(['화','플레이어','딥시크','피코 HP','회복/턴','격파 턴'],f.kills.map(r=>[r.ep,r.route,r.mob?'모비딕':'V4-Flash',r.hp,r.regen,r.turns]));
 for(const r of f.kills){s+=`\n${r.ep}화 ${r.route}/${r.mob?'모비딕':'V4-Flash'} 자원 장부:\n\n`+table(['기체','SP사용/최대','마지막 EN'],r.budgets.map(a=>[a.line,`${a.used}/${a.max}`,a.en]));s+='\n'+table(['턴','기대 피해','회복','남은 HP'],r.history.map(t=>[t.turn,n(t.damage),t.healing,n(t.left)]));}
 s+='\n### 우군9기의6턴 화력\n\n13화 수치의 별도 복사본을14화 레벨27로 올리고 자동 제어한다. 표적은 자코·양산형만, 온도100에서 각 표적에 쓸 수 있는 최선 무장을 실제 예측으로 고르고 그 개수로 가중한 평균 피해를6회 합산한다. 중보스/피코·정신·원호·가챠 등 추가 특능 배율은 제외한다. 과잉 피해/이동/적 피해를 빼기 전의 화력 용량 근사다. 최대 EN에서6발을 실제 소비할 수 있는지도 확인한다.\n\n';
 s+=table(['우군','레벨','무기 개조','발사 수','6턴 기대 피해'],f.autoFire.rows.map(r=>[`${r.name} / ${r.id}`,r.level,r.upgrade,r.turns,n(r.damage)]));
 s+=`\n합계 **${n(f.autoFire.damage)} / 적 자코·양산형 HP ${f.autoFire.hp} = ${(100*f.autoFire.ratio).toFixed(2)}%**. 무기 개조 ${f.autoFire.adjustment.originalWeaponsUpgrade}→${f.autoFire.adjustment.weaponsUpgrade}단. 플레이어 조작은 불가하고 표적 필터가 피코를 제외하며, 플레이어 정렬 없이는 HP1 하한도 풀리지 않는다.\n\n`;
 s+='### 15화 광선·클로드 생존\n\n무한 도파민 주입 광선은 매 적 턴1회, 정렬 전 맵 전체·정렬 후 피코 중심 맨해튼 반경4. JEPA의 취소가 없는 상황을 따로 검사했다. 온도130·발생 가능한 크리/최대 분산, 방어/정신 없음. 최대 피해3연속에도 생존한다. 최종 미해금 저세대와 모비딕도 포함한다.\n\n';
 s+=table(['아군','HP','명중 평균','가능한 최대 피해','최대 HP 비율','최대3연속 후 HP'],f.beam15.map(r=>[r.line,r.hp,n(r.mean),r.damage,`${(100*r.ratio).toFixed(2)}%`,n(r.left)]));
 s+=`\n페이블이2칸 내에서 받는 단일 최강 공격: 가능한 크리·최대 분산 **${f.claude15.damage}/${f.claude15.hp}**, 생존.\n\n`;
 s+='### 고독한 특이점\n\n'+table(['최대 HP','매 턴 회복','무장','HP 하한','승리'],[[f.healing3.hp,f.healing3.perTurn,'0',1,'출격 히로인4기/2칸+플레이어 인접, HP 무관 무료 커맨드']]);
 s+='\n숨은 조건은 문서에만 기록한다: **3형태에 한 번도 피해를 주지 않고 정화**. 보상은 미정이며 모델에 보상 트리거를 추가하지 않았다.\n\n';
 s+=`후속2 보존 기체/무장 ${f.preserved}개의 정규화 해시 일치. 아군·파일럿·합체기·1~13화 수치/편성은 바꾸지 않았으며14·15화 군단 수도 유지했다. 새 우군 복사본과15화 광선 조정은 별도다.\n\n`;
 return s;
}
