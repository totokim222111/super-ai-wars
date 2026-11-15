import {harness} from './saw-runtime.mjs';
import {mechId,loadout} from './saw-model.mjs';
// 미구현 트리거/카운터는 이 명시적 모델에서만 계산한다. 피해 계산은 core 예측을 호출한다.
export function extensionProjections({core,content:c,model:m,au,eu,shot,battle}){
 const out=[],row=(name,value,note)=>out.push({name,value,note}),mm=id=>c.mechs.find(x=>x.id===id),wm=id=>c.weapons.find(x=>x.id===id),am=id=>m.ally.find(x=>x.id===id);
 const ep=15,g=au('gpi',ep),e=m.enemy.find(x=>x.id==='pico-form-2-episode-15'),d=eu(e),main=am(g.mechId).main;
 const effect=atoms=>[{id:'saw-approximation',source:'수치 근사',duration:{unit:'round',remaining:1},lifetime:'turn',hooks:{},atoms}];
 const base=shot(g,d,main),hp=core.effectiveMech(battle(d,g),battle(d,g).units[0]).hp;
 row('프롬프트 캐싱',`주력 ${wm(main).en}→${Math.floor(wm(main).en*.8)}, 필살 ${wm(am(g.mechId).finisher).en}→${Math.floor(wm(am(g.mechId).finisher).en*.8)}`,'봉인2턴, 인접1칸만, 소비×0.8 내림·최소1. 다른 MoE와 중첩 시 최대40% 절감.');
 for(const id of ['dots','crabby','doge-mecha','bao','carbon-minime']){const p=c.pilots.find(x=>x.id===id),s=c.spirits.find(s=>s.id===p.spirits[0].id);row(`파밀리어 ${p.name}`,`Lv1 SP${p.sp}, ${s.id} ${Math.floor(p.sp/s.sp)}회 후 잔량${p.sp%s.sp}`,'서브 자신의 풀에서만 차감. 주 파일럿 SP와 합치지 않는다.');}
 for(let gen=1;gen<=4;gen++){const u={mechId:mechId('gpi',gen),pilotId:'gpi',level:1},a=am(u.mechId),w=mm(a.id).weapons.find(id=>wm(id).name==='닷츠 판넬');row(`닷츠 판넬 ${gen}세대`,`${[3,4,5,6][gen-1]}점 / 피코 대상 명중 피해 ${shot(u,d,w).landed.toFixed(1)}`,'점 수는 연출. 엔진은 한 발만 판정하며 위력/소비를 점 수만큼 중복 적용하지 않는다. 적응은 공육해우A.');}
 const q=au('qwen',15),qa=am(q.mechId),qb=shot(q,d,qa.main);
 const mode=({same=0,adjacent=false,hit=false})=>same>=2?'얀데레':adjacent?'메가데레':hit?'악의축':'기본';
 for(const [name,ctx,atoms] of [['기본',{},[{type:'hitAdd',value:5}]],['악의축',{hit:true},[{type:'damageMul',value:1.15},{type:'critSet',value:20}]],['얀데레',{same:2,adjacent:true},[{type:'damageMul',value:1.25},{type:'hitAdd',value:15}]],['메가데레',{adjacent:true,hit:true},[]]]){const f=shot(q,d,qa.main,{effects:effect(atoms)});row(`퀜 자동 ${mode(ctx)}`,`피해${f.landed.toFixed(1)} / 명중${f.hitRate}%`,`${name}: 동일 적2회 조건 우선→플레이어 인접→피격→출격. 얀데레는 지목 적 외 공격 금지. 메가데레 피격 온도+8·턴 EN+8. 악의축 장갑−15%.`);}
 row('젬 3형태',`행동 미소모 core.apply 검사 / 회복 ${c.rules.enRegenPerRound}→${2*c.rules.enRegenPerRound}`,'변형은 이미 구현(라운드1회). 최대 EN1.5는 기본치 기준; 동일 +15 개조 후 비율은 낮아진다.');
 const aura=shot(g,d,main,{effects:effect([{type:'hitAdd',value:5}])});row('플레이어 지휘 오라',`명중${base.hitRate}→${aura.hitRate}%, 인접 EN+4`,'명중/회피+5%p, 중복 오라 비누적, 플레이어 생존/인접 시만.');
 const chosen=real=>mechId(real?'player-real':'player-super',1);row('시작 선택·플레이어 패배',`${chosen(true)} / ${chosen(false)}; player HP=0 ⇒ 패배 ${[false,true].some(dead=>dead)}`,'시작 플래그 단일 선택. 주인공 격파 이벤트에서 승리보다 패배 판정 우선.');
 const gr=au('grok',15),gra=am(gr.mechId),un=shot(gr,d,gra.main,{effects:effect([{type:'damageMul',value:1.15},{type:'critSet',value:20},{type:'hitAdd',value:-10}])});row('그록 언힌지드',`기본${shot(gr,d,gra.main).landed.toFixed(1)}→${un.landed.toFixed(1)}, 명중${un.hitRate}%`,'HP50% 이하 자동, 피해+15%·크리+15%p·명중−10%p(표는 기본5→20%).');
 const nc=structuredClone(c);nc.mechs.find(x=>x.id===e.id).armor=Math.round(mm(e.id).armor*.85);row('커뮤니티 노트',`장갑${mm(e.id).armor}→${nc.mechs.find(x=>x.id===e.id).armor}, 후속 피해${harness(core,nc).shot(g,d,main).landed.toFixed(1)}`,'명중 후1턴 장갑−15%, 비누적. 도발은2칸 내 적1기 다음 AI1회 우선 대상으로 설정, 사거리 밖이면 평상 AI.');
 const ex=au('exaone',15),normal=shot(d,ex,e.main),guard=shot(d,ex,e.main,{response:{type:'defend'},defenderEffects:effect([{type:'takenMul',value:.75}])});row('엑사원 원호방어',`일반 피격${normal.landed.toFixed(1)}→방어 원호${guard.landed.toFixed(1)}`,'기존 원호3회+방어 응답×0.5에 추가×0.75 제안. 반경2 상태1개 치료, 자신 정신계 면역.');
 const statusHit=shot(g,d,main,{effects:effect([{type:'hitAdd',value:-15}])});
 row('상태5종',`할루시네이션 명중${base.hitRate}→${statusHit.hitRate}; 지속피해 ${Math.floor(mm(g.mechId).hp*.05)}/턴(개조 전 예시)`,'할루시네이션 명중−15·2턴 / 검열 무장1개2턴 / 무한 루프 이동0·1턴 / 오염 HP5%·2턴 / 오버클럭 피해+10%·종료 HP5%·2턴.');
 const llama=m.enemy.find(x=>x.template==='rival-llama'),lm=mm(llama.id);row('라마 분열',`파생3기×${Math.round(lm.hp*.08)}HP=추가${3*Math.round(lm.hp*.08)}HP; 완료 판정 ${[true,true,true].every(Boolean)}`,'본체 격파 후 다음 player 종료까지3기 모두 격파. 실패하면 파생 잔존기 회복, 본체 재생성 없음.');
 const muse=m.enemy.find(x=>x.template==='rival-muse'),mc=mm(muse.id).en;row('뮤즈 완전 회복',`${mc}−60→${mc-60}→턴 시작${mc}`,'추가 회복 아님. 최대치로 설정하므로 자원 말리기 불가능.');
 const copy=shot(g,d,main,{effects:effect([{type:'damageMul',value:1.1}])});row('미니맥스 특능 복사',`공격 보정 상한10%: ${base.landed.toFixed(1)}→${copy.landed.toFixed(1)}→다음턴${base.landed.toFixed(1)}`,'마지막 피격자의 복사 허용 특능1개, 1턴, 피해감소 상한20%, SP·형태·한도·정렬은 복사 제외.');
 const ki=m.enemy.find(x=>x.template==='kimi-production'&&x.episode===15);for(let n=1;n<=4;n++){const f=shot(eu(ki),g,ki.main,{effects:effect([{type:'damageMul',value:1+Math.min(3,n-1)*.03}])});row(`키미 군집 ${n}기`,`통상 피해${f.landed.toFixed(1)}`,'자기 제외 생존 키미당+3%, 최대+9%. 본체 식별 플래그는 격파 조건 별도.');}
 const je=m.enemy.find(x=>x.id==='rival-jepa-episode-12'),jg=au('gpi',12),ja=am(jg.mechId),jf=shot(jg,eu(je),ja.main),sure=shot(jg,eu(je),ja.main,{effects:effect([{type:'hitSet',value:100}])});row('JEPA 첫 공격 확정 회피',`첫 일반0 / 다음${jf.expectedDamage.toFixed(1)} 기대 / 첫 필중${sure.expectedDamage.toFixed(1)}`,'firstAttack && !sureHit && !ignoreFirstEvade 조건. 합체기도 통과, 태그는 model.json에만 둔다. 기존 evadeAll은 hitSet보다 우선하므로 전용 트리거 필요.');
 const regen=Math.floor(hp*.02),net=base.landed*4-regen;row('피코 정렬·회복',`2형태 턴 회복${regen}, 4기 순피해${net.toFixed(1)} / 3형태 공격0`,'정렬 전 피해10%·HP1. 1/2형태는 정렬 후 HP0 전환, 3형태는2% 회복·영구 HP1 하한·조건부 정화.');
 const ga=m.enemy.find(x=>x.template==='rival-midjourney'),gu=au('gpi',ga.episode),gam=mm(gu.mechId).hp+loadout('gpi',ga.episode).upgrades.hp*c.rules.upgradeStep.hp;
 for(const factor of [.7,1,1.5]){const f=shot(eu(ga),gu,ga.main,{effects:effect([{type:'damageMul',value:factor}])});row(`가챠 피해×${factor}`,`${f.landed.toFixed(1)} / 지피 HP ${(100*f.landed/gam).toFixed(2)}%`,'결정적 난수의 최종 피해 배율. 전 범위 T2(22~35%)와는 수학적 충돌: 1.5/0.7 > 35/22.');}
 const ca=m.enemy.find(x=>x.template==='camel'),cg=au('gpi',ca.episode),cam=am(cg.mechId);row('다큰낙타 온도',`100→85→105; 주력 피해 ${[100,85,105].map(morale=>shot(cg,eu(ca),cam.main,{morale}).landed.toFixed(1)).join('→')}`,'등장−15·격파+20, 범위50~150. 130 해금 직전에는 15도 감소로 일시 봉인됨.');
 const sealed=new Set([am(g.mechId).finisher]),allowed=(weapon,turn)=>turn>2||!sealed.has(weapon);row('8화 규제 딱지',`필살 사용 허용 턴1/2/3: ${[1,2,3].map(t=>allowed(am(g.mechId).finisher,t)).join('/')}`,'규제 구역에서 실효 발사 VRAM40 이상 또는 MAP 사용 시 발사 정상 처리 후 해당 무장2턴 봉인.');
 const unlock=(turn,kills)=>turn<=4&&kills>=2;row('기가원펑의 시험',`4턴2격파 ${unlock(4,2)} / 4턴1격파 ${unlock(4,1)} / 5턴2격파 ${unlock(5,2)}`,'13화 GLM·키미 양산형2기 딥시크 막타. 즉시 모비딕 환장·HP/VRAM 전회복·온도+10.');
 return out;
}
