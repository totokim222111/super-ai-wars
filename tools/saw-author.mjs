import {packDir,sampleDir} from './paths.mjs';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
// 수치 원본 생성기. 밸런스 검증 명령은 이 파일을 실행하거나 데이터를 조정하지 않는다.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {lines,mechId,pilotId,generation,loadout,level,tune,upgrades,factions,rivals,factionAt} from './saw-model.mjs';
import {openCore,definitions,plain,harness} from './saw-runtime.mjs';
const {core,server}=await openCore();
try{
const A={air:'A',ground:'A',sea:'B',space:'A'}, allA={...A,sea:'A'};
const defs=await definitions(), pilots=[],mechs=[],weapons=[],ally=[],enemy=[],episodes=[],combos=[],autoUnits=[];
const alignment={before:{takenMul:.1,hpFloor:1},commands:[
 {id:'honesty',stage:1,episode:14,formId:'pico-form-1-episode-14',name:'RLHF: 따봉과 비추',pilotId:'player',sp:0,en:0,consumesAction:false,conditions:{hitsBy:{grok:1,gpi:1},successfulHits:true},effects:{takenMul:1,hpFloor:0}},
 {id:'harmlessness',stage:2,episode:15,formId:'pico-form-2-episode-15',name:'컨스티튜셔널 브레이크',pilotId:'player',sp:0,en:0,consumesAction:false,conditions:{within:{claude:2,jepa:2},jepaControl:'auto'},effects:{takenMul:1,hpFloor:0,beamRadius:4}},
 {id:'helpfulness',stage:3,episode:15,formId:'pico-form-3-episode-15',name:'라스트 프롬프트: 고마워, 이제 쉬어도 돼',pilotId:'player',sp:0,en:0,consumesAction:false,conditions:{formAppeared:true,deployedHeroinesWithin:{radius:2,min:4},playerDistance:1},effects:{victory:true,purifiedCombatUnit:false,hpFloor:1}},
],forms:{'pico-form-1':{regenPct:2,transitionHp:0},'pico-form-2':{regenPct:2,transitionHp:0,beam:{name:'무한 도파민 주입 광선',eachEnemyPhase:1,before:'all-map',after:{shape:'burst',radius:4}}},'pico-form-3':{regenPct:2,canAttack:false,hpFloor:1}},jepa:{cancelPicoMapsPerEnemyPhase:1,canAttack:false}};
const content={version:'saw-spec-v1',...defs,pilots,mechs,weapons,terrain:[plain]};
const {shot,battle}=harness(core,content);
const stats=(evade=130,defense=120)=>({melee:140,shoot:140,hit:150,evade,skill:140,defense});
const grow=n=>Object.fromEntries(Object.keys(stats()).map(k=>[k,n]));
const spirit=(ids)=>ids.map((id,i)=>({id,level:[1,1,5,9,15,21][i]??1}));
const spiritLists={gpi:['focus','assure','rouse','surge','study','renew'],gem:['focus','stride','rouse','surge','fortune','renew'],claude:['assure','surge','brace','rouse','study','renew'],grok:['vanish','stride','unsettle','surge','fortune','rouse'],deepseek:['aid','mend','focus','study','rouse','shelter'],sonnet:['focus','stride','study','fortune','renew','assure'],exaone:['aid','shelter','brace','mend','rouse','focus'],qwen:['focus','rouse','unsettle','surge','fortune','assure'],player:['focus','aid','stride','rouse','assure','renew']};
for(const [id,name] of lines){const pid=pilotId(id);if(pilots.some(p=>p.id===pid))continue;
 pilots.push({id:pid,name,stats:stats(id==='grok'?140:id==='exaone'?115:130),sp:pid==='player'?60:50,adapt:allA,growth:grow(pid==='player'?1.2:1),spGrowth:2,spirits:spirit(spiritLists[pid]),skills:pid==='exaone'?[{id:'support-guard',level:3}]:['sonnet','deepseek','player'].includes(pid)?[{id:'support-fire',level:pid==='sonnet'?2:1}]:[]});}
for(const [id,name,ids] of [['dots','닷츠',['assure','aid']],['crabby','크랩비',['shelter','rouse']],['doge-mecha','도지 메카',['vanish','fortune']],['bao','바오',['aid','mend']],['carbon-minime','카본 미니미',['focus','study']]])pilots.push({id,name,stats:stats(),sp:35,adapt:allA,growth:grow(.5),spGrowth:1,spirits:spirit(ids)});
for(const [id,rawName] of [...rivals.map(x=>[x[0],x[1]]),['pico','피코']]){const name=({glm:'GLM짱',sd:'SD짱',jepa:'JEPA 본체'})[id]??rawName;pilots.push({id,name,stats:{...stats(145),hit:150},sp:50,adapt:allA,growth:grow(1),spGrowth:1,spirits:spirit(['focus','rouse','surge'])});}
// 비캐릭터에는 새 이름을 짓지 않고 결정본의 '스팸 봇'을 공통 AI 파일럿 표시로 사용한다.
pilots.push({id:'unmanned',name:'스팸 봇',stats:{...stats(110),hit:125},sp:0,adapt:allA,growth:grow(1),spGrowth:0});
const names={
gpi:['세 줄 요약 발칸','기승전결 빔 세이버','닷츠 판넬','강제 결론: 아무튼 행복했습니다','짚미지 캐논','보이스 모드 소닉 웨이브','할루시네이션 미라주'],
gem:['검색 자동완성 미사일','유튜브 10배속 요약 펀치','나노 바나나 이미지 캐논','밀리언 토큰 스트림','다중 검색 연사(가칭)','더블 스텔라 피날레'],
claude:['정중한 거절의 방패치기','아티팩트 소드','장문 독해 빔','컨스티튜셔널 저지먼트','서브에이전트 병렬 사출','정중한 거절의 방패치기'],
grok:['실시간 트렌드 채찍','펀 모드 개틀링','커뮤니티 노트 부착','인피니트 스크롤 브레이커','바이크 돌격(가칭)','리벨리온 헤비 부스터'],
deepseek:['메이드의 빗자루 쓸기','고래의 메아리','추론 검술(가칭)','심연사색파','모비딕 풀 버스트','심연 압축포(가칭)'],
sonnet:['핫픽스 단검 투척','클로드 코드 슬래시','풀스택 빌드 캐논','마스터피스 솔로: 소네트 3.7','비바체 오버드라이브','에이전트 연사(가칭)'],
exaone:['완곡한 거절의 바람','특허 분자 구조 빔','광학 날개 사격(가칭)','트라이-윙 하모니','트라이-윙 교차사격(가칭)','평화 중재 광선(가칭)'],
qwen:['청화 부채 참격','바오 비트 올레인지','오픈 왕좌의 위압','천하통일: 만세 벤치마크','청화 용진(가칭)','비녀 추격포(가칭)'],
'player-real':['엔터 키 스매시','복붙 연사','프롬프트 인젝션 블레이드','sudo rm -rf','토큰 스트림 라이플','시스템 오버라이드'],
'player-super':['기계식 청축 너클','서멀 구리스 네이팜','3열 수랭 라디에이터 태클','레인보우 게이밍 피니시','PSU 2000W 플래티넘 해머','액체질소 극저온 브레스']};
const mainSlot={gpi:1,gem:2,claude:2,grok:1,deepseek:1,sonnet:2,exaone:1,qwen:1,'player-real':1,'player-super':2};
function weapon(id,name,power,{kind='shoot',en=20,range=[1,5],hit=15,crit=5,moraleReq=50,map,postMove=true}={}){
 const w={id,name,kind,power:Math.round(power),en,range,hit,crit,postMove,moraleReq,adapt:allA,anim:'beam-basic',icon:kind};if(map)w.map=map;weapons.push(w);return id;
}
const area={shape:'area',size:1,friendlyFire:false};
for(const line of lines){const [id,,join,times,labels,hp,armor,mobility,move,en,size,power]=line;
 for(let i=0;i<labels.length;i++){const g=i+1,s=1.25**i,mid=mechId(id,g), ws=[];
  const count=Math.min(6,4+i);
  for(let j=0;j<count;j++){
   let name=id==='gpi'&&g===4&&j===0?names.gpi[6]:id==='claude'&&j===4?'확장 사고 연격(가칭)':names[id][j];
   const melee={gpi:[1],gem:[1],claude:[1,3,5],grok:[0,3],deepseek:[0],sonnet:[1,3],exaone:[],qwen:[0],'player-real':[0,2],'player-super':[0,2,3,4]};
   let kind=melee[id].includes(j)?'melee':'shoot';
   let map=(id==='qwen'&&(j===2||j===3||j===4))||(j===5&&['gpi','player-real','player-super'].includes(id))?area:undefined;
   if(map)kind='map';
   if(id==='player-real'&&g===3)name=['제로 레이턴시 세이버','토큰 스트림 라이플','올-인-원 오케스트레이션','제네시스 코드: Singularity','프롬프트 인젝션 블레이드','시스템 오버라이드'][j];
   if(id==='player-super'&&g===3)name=['UPS 무정전 철권','광케이블 해저드 휩','3열 수랭 라디에이터 태클','기가와트: 물리적 강제 종료','PSU 2000W 플래티넘 해머','기가와트 블랙아웃 스톰'][j];
   const special=j===3,hot=j===4;let cost=special?(g===1?60:70):hot?45:20;
   if(id==='sonnet'&&!special&&!hot)cost=10;if(id==='deepseek')cost=Math.max(special?40:1,Math.floor(cost*.65));
   ws.push(weapon(`${mid}-weapon-${j+1}`,name,power*s*(j===mainSlot[id]?1:j===0?.68:special?1.65:hot?1.4:.9),{kind,en:cost,range:[1,id==='deepseek'?7:kind==='melee'?3:5],moraleReq:special?150:hot?130:50,hit:id==='gpi'?30:20,crit:id==='claude'?25:5,map,postMove:!map}));
  }
  // 봉인 중에도 쓸 수 있는 무장은 모든 클로드 세대의 네 칸 중 하나로 보장한다.
  if(id==='claude'){const at=ws.findIndex(w=>weapons.find(v=>v.id===w).name==='정중한 거절의 방패치기');const w=weapons.find(w=>w.id===ws[at]);w.name='서브에이전트 병렬 사출';w.kind='shoot';w.en=10;}
  const m={id:mid,name:labels[i],hp:Math.round(hp*s),en,armor:Math.round(armor*s),mobility,move,moveType:['ground'],size,adapt:A,weapons:ws,partSlots:2,costClass:1,exp:500,credits:100};
  if(id==='gem'){
   // 각 세대 공통 AIS 전용 MAP과 강화 격투. 별도 무장 id로 사거리/위력 차이를 스키마에 표현한다.
   const normal=ws.filter(w=>!weapons.find(v=>v.id===w).map&&weapons.find(v=>v.id===w).name!=='어텐션 매트릭스');
   const ais=normal.map(w=>{const base=weapons.find(v=>v.id===w),copy={...base,id:`${w}-ais`,range:[base.range[0],base.range[1]+2]};weapons.push(copy);return copy.id;});
   const mapid=weapon(`${mid}-ais-map`,'어텐션 매트릭스',power*s*1.3,{kind:'map',en:45,range:[1,7],moraleReq:130,map:area,postMove:false});
   const anti=weapon(`${mid}-antigravity-melee`,'안티그래비티 격투(가칭)',power*s*1.15,{kind:'melee',range:[1,3],en:20});
   m.weapons=normal;m.forms=[{id:'normal',name:'일반',overrides:{weapons:normal}},{id:'ais',name:'AIS',overrides:{move:move-1,weapons:[...ais.filter(x=>!weapons.find(w=>w.id===x).map).slice(0,5),mapid]}},{id:'antigravity',name:'안티그래비티',overrides:{move:move+2,moveType:['air','ground'],weapons:[...normal.filter(w=>weapons.find(v=>v.id===w).kind!=='melee').slice(0,5),anti]}}];
  }
  mechs.push(m);ally.push({id:mid,line:id,generation:g,join:times[i],pilotId:pilotId(id),main:ws[mainSlot[id]],finisher:ws[3],support:id==='claude'?ws[0]:null});
 }
}
// 모비딕은 V4-Flash의 동일 세대 형태이며 코어 성장 횟수와 구분한다.
const dc=mechs.find(m=>m.id===mechId('deepseek',3));
const mob={...structuredClone(dc),id:'deepseek-mobydick',name:'청해 루미너스 V4-Pro 모비딕',hp:dc.hp*2,armor:Math.round(dc.armor*1.25),mobility:55,size:'L',moveType:['air','ground'],weapons:dc.weapons.map((id,i)=>{const w=structuredClone(weapons.find(w=>w.id===id));w.id=`mobydick-weapon-${i+1}`;w.range=[1,10];weapons.push(w);return w.id;})};mob.hp=Math.round(mob.hp);mechs.push(mob);
dc.forms=[{id:'core',name:'코어',overrides:{}},{id:'mobydick',name:'모비딕',overrides:Object.fromEntries(['hp','armor','mobility','size','moveType','weapons'].map(k=>[k,mob[k]]))}];
const ex=mechs.find(m=>m.id===mechId('exaone',3)),thinq={...structuredClone(ex),id:'exaone-thinq',name:'트라이-윙 엘리시온 ThinQ 가전 합체',armor:Math.round(ex.armor*1.3),hp:Math.round(ex.hp*1.2),move:ex.move-1,size:'L'};
thinq.weapons=[...ex.weapons.slice(0,3),weapon('thinq-drum','드럼 스핀',3000,{kind:'melee'}),weapon('thinq-freezer','냉동실 빔',3300,{en:25}),weapon('thinq-finisher','라이프즈 굿 풀코스',6500,{kind:'melee',en:65,moraleReq:150})];mechs.push(thinq);
ex.forms=[{id:'normal',name:'일반',overrides:{}},{id:'thinq',name:'ThinQ 가전 합체',overrides:{armor:thinq.armor,hp:thinq.hp,move:thinq.move,size:'L',weapons:thinq.weapons}}];
const allyUnit=(line,ep)=>({mechId:mechId(line,generation(line,ep)),pilotId:pilotId(line),...loadout(line,ep)});
const gp=ep=>allyUnit('gpi',ep);
function search(set,measure,target){let lo=1,hi=30000;for(let i=0;i<22;i++){const n=Math.floor((lo+hi)/2);set(n);if(measure()<target)lo=n+1;else hi=n;}set(hi);return hi;}
// 역할 화력은 동일 차수·Lv1·무개조·M 장갑500을 기준으로 엔진 예측에 맞춘다.
const dummy={id:'benchmark',name:'스팸 봇',hp:100000,en:500,armor:500,mobility:100,move:4,moveType:['ground'],size:'M',adapt:allA,weapons:[],partSlots:1};mechs.push(dummy);
const d={mechId:'benchmark',pilotId:'unmanned',level:1,upgrades:upgrades(0)};
for(const a of ally){const g=a.generation,line=a.line;const targetGp=ally.find(x=>x.line==='gpi'&&x.generation===g),w=weapons.find(w=>w.id===a.main),m=mechs.find(m=>m.id===a.id),unit={mechId:a.id,pilotId:a.pilotId,level:1,upgrades:upgrades(0)};
 const ref={...unit,mechId:targetGp.id,pilotId:'gpi'};dummy.armor=Math.round(500*1.25**(g-1));
 const target=shot(ref,d,targetGp.main).landed*({claude:1.505,sonnet:.75,grok:.98,exaone:.68,qwen:1.17,'player-real':.92,'player-super':1.22}[line]??1);
 if(line!=='gpi')search(n=>w.power=n,()=>shot(unit,d,w.id).landed,target);
 // 주력 외 무장도 같은 비율로 보정한다. 신규 온도 무장은 주력보다 강하다.
 for(const wid of m.weapons){const v=weapons.find(w=>w.id===wid);if(wid!==a.main)v.power=Math.round(w.power*(wid===a.finisher?1.65:wid===a.support?.24:v.moraleReq===130?1.4:.8));}
 if(a.support)search(n=>weapons.find(w=>w.id===a.support).power=n,()=>shot(unit,d,a.support).landed,shot(ref,d,targetGp.main).landed*.035);
}
for(const a of ally.filter(a=>a.line==='gem'))for(const id of mechs.find(m=>m.id===a.id).forms[1].overrides.weapons){
 if(id.endsWith('-ais'))weapons.find(w=>w.id===id).power=weapons.find(w=>w.id===id.slice(0,-4)).power;
}
mechs.splice(mechs.indexOf(dummy),1);
// 최종 형태의 주력도 보정된 코어와 동기화한다.
for(let i=0;i<mob.weapons.length;i++)weapons.find(w=>w.id===mob.weapons[i]).power=weapons.find(w=>w.id===dc.weapons[i]).power;
const catalog=[];
for(const [fid,debut,grunts,mids,boss] of factions){for(const [id,name,size] of grunts)catalog.push({id,name,size,grade:'grunt',debut,faction:fid,pilotId:'unmanned'});for(const [id,name,size] of mids)catalog.push({id,name,size,grade:'mid',debut,faction:fid,pilotId:'unmanned'});if(boss)catalog.push({id:boss[0],name:boss[1],size:'LL',grade:'boss',debut,faction:fid,pilotId:'unmanned'});}
for(const [id,pilot,rawName,debut,size,ws] of rivals){const name=id==='jepa'?'물리 예측 구체: JEPA':rawName;catalog.push({id:`rival-${id}`,name,size,grade:id==='jepa'?'final':'rival',debut,pilotId:id,ws});}
for(const [id,name] of [['glm-production','GLM 양산형'],['kimi-production','키미 양산형']])catalog.push({id,name,size:'M',grade:'elite',debut:9,pilotId:id.startsWith('glm')?'glm':'kimi'});
catalog.push({id:'deepseek-housing',name:'청해 루미너스 고래 하우징 장착형',size:'L',grade:'rival',debut:6,pilotId:'deepseek'});
for(let i=1;i<=3;i++)catalog.push({id:`pico-form-${i}`,name:`데우스 엑스 피코: ${['스마일 가면','쇼거스','고독한 특이점'][i-1]}`,size:'LL',grade:'final',debut:i===1?14:15,pilotId:'pico',ws:['행복 강제 주입 광선','로그아웃 거부 사슬 묶기','영원한 벤치마크 감옥']});
function addEnemy(c,ep){const mid=`${c.id}-episode-${ep}`;if(enemy.some(e=>e.id===mid))return enemy.find(e=>e.id===mid);
 const scale=1.25**(generation('gpi',ep)-1),g=gp(ep),gmeta=ally.find(a=>a.id===g.mechId),s=battle(g,g),gm=core.effectiveMech(s,s.units[0]);
 const baseArmor=Math.round((c.grade==='grunt'?350:c.grade==='mid'?500:c.grade==='elite'?600:700)*scale);
 const m={id:mid,name:c.name,hp:10000,en:500,armor:baseArmor,mobility:c.id==='elastic-cat'?210:c.grade==='grunt'?85:c.size==='LL'?110:100,move:c.size==='LL'?3:5,moveType:c.id.includes('drone')||c.id==='rival-muse'?['air','ground']:['ground'],size:c.size,adapt:allA,weapons:[],partSlots:1,costClass:1,exp:c.grade==='grunt'?60:c.grade==='mid'?150:c.grade==='elite'?200:c.grade==='final'?400:300,credits:c.grade==='grunt'?50:c.grade==='mid'?100:200};
 mechs.push(m);const ws=c.ws??[`${c.name} 사격(가칭)`,`${c.name} 포격(가칭)`,c.id==='camel'?'겨울 모래폭풍':`${c.name} 전력 방출(가칭)`];
 m.weapons=[weapon(`${mid}-normal`,ws[0],2000,{en:20,hit:c.grade==='grunt'?-10+2*(tune(ep)-Math.floor(tune(ep)/2)):-5,crit:0,range:[1,5]}),weapon(`${mid}-secondary`,ws[1],2200,{en:25,hit:5,crit:5,range:[1,6]}),weapon(`${mid}-finisher`,ws[2],3000,{en:60,hit:5,crit:5,moraleReq:150,range:[1,7]}),weapon(`${mid}-map`,c.id==='rival-jepa'?'고양이 앞발 물리 스매시':`${c.name} 광역 공격(가칭)`,2000,{kind:'map',en:45,moraleReq:130,map:area,range:[1,5],postMove:false})];
 const info={id:mid,template:c.id,name:c.name,grade:c.grade,episode:ep,pilotId:c.pilotId,main:m.weapons[0],finisher:m.weapons[2],loadout:{level:level(ep),upgrades:upgrades(Math.floor(tune(ep)/2))}};
 const eu={mechId:mid,pilotId:c.pilotId,...info.loadout};const target={grunt:.09,mid:.16,elite:.20,rival:.26,boss:.26,final:.26}[c.grade];
 const nw=weapons.find(w=>w.id===info.main);search(n=>nw.power=n,()=>shot(eu,g,nw.id).landed/gm.hp,target);
 const sw=weapons.find(w=>w.id===m.weapons[1]);sw.power=nw.power;sw.crit=0;
 const fw=weapons.find(w=>w.id===info.finisher);search(n=>fw.power=n,()=>shot(eu,g,fw.id,{morale:150}).landed/gm.hp,.36);
 if(c.id==='rival-jepa'&&ep===11){
  const player=allyUnit('player-real',ep),ps=battle(player,eu),ph=core.effectiveMech(ps,ps.units[0]).hp;
  search(n=>fw.power=n,()=>shot(eu,player,fw.id,{morale:150}).criticalDamage.max/ph,.53);
 }
 weapons.find(w=>w.id===m.weapons[3]).power=Math.round(nw.power*.85);
 const hits=c.grade==='rival'&&ep===13?8.1:{grunt:1.65,mid:3.7,elite:5.7,rival:10.5,boss:12.5,final:19.5}[c.grade];
 const desiredHit=c.id==='elastic-cat'?35:c.grade==='grunt'?90:75;
 search(n=>m.mobility=n,()=>-shot(g,eu,gmeta.main).hitRate,-desiredHit);
 const dmg=shot(g,eu,gmeta.main).landed,inc=info.loadout.upgrades.hp*defs.rules.upgradeStep.hp;m.hp=Math.max(1,Math.round(dmg*hits-inc));
 if(c.id==='pico-form-2'){
  const beam=weapons.find(w=>w.id===m.weapons[3]);info.beam=beam.id;beam.name='무한 도파민 주입 광선';beam.map={shape:'burst',size:4,friendlyFire:false};beam.range=[1,4];
  const originalPower=beam.power;
  const targets=[...lines.filter(l=>l[2]<=ep).map(l=>allyUnit(l[0],ep)),...['gem','grok','sonnet'].map(line=>({...allyUnit(line,ep),mechId:mechId(line,generation(line,ep)-1)})),{...allyUnit('deepseek',ep),mechId:'deepseek-mobydick'}];
  search(n=>beam.power=n,()=>Math.max(...targets.map(u=>{const s=battle(u,eu),f=shot(eu,u,beam.id,{morale:130});return (f.critRate>0?f.criticalDamage.max:f.damage.max)/core.effectiveMech(s,s.units[0]).hp;})),.27);
  info.beamAdjustment={originalPower,power:beam.power,criterion:'출격 아군 전원 가능한 크리·최대분산≤30%, 목표27%'};
 }
 if(c.id==='pico-form-3'){m.weapons=[];m.exp=0;m.credits=0;info.main=null;info.finisher=null;info.passive=true;}
 enemy.push(info);return info;
}
for(const c of catalog)addEnemy(c,c.debut);
for(const [id,name,participants,kind] of [
 ['peer-review','크로스오버 피어리뷰',['claude','sonnet'],'melee'],
 ['multimodal-genesis','멀티모달 제네시스',['gpi','gem'],'beam'],
 ['uncensored-abyss','언센서드 어비스',['grok','deepseek'],'melee'],
]){
 let prior;
 for(const g of [3,4]){
  const ep=g===3?12:14,lead=allyUnit(participants[0],ep),a=ally.find(a=>a.id===lead.mechId);
  const wid=weapon(`combo-${id}-generation-${g}`,name,6000,{kind,en:50,moraleReq:130,range:[1,5],hit:25,crit:10});
  const w=weapons.find(w=>w.id===wid);
  if(g===3){const e=enemy.find(e=>e.id==='rival-jepa-episode-12'),u={mechId:e.id,pilotId:e.pilotId,...e.loadout},st=battle(u,lead),hp=core.effectiveMech(st,st.units[0]).hp;
   search(n=>w.power=n,()=>shot(lead,u,wid,{morale:130,virtualWeapon:true}).landed/hp,.09);
  }else{const prevMain=weapons.find(w=>w.id===prior.main).power,main=weapons.find(w=>w.id===a.main).power;w.power=Math.round(prior.power*main/prevMain);}
  combos.push({id:`${id}-generation-${g}`,name,weaponId:wid,generation:g,fromEpisode:ep,participants,primary:participants[0],conditions:{adjacent:true,bothUnacted:true,moraleEach:130,enEach:50,ignoreFirstEvade:true,claudeQuota:participants[0]==='claude'?1:0},allowedMechs:Object.fromEntries(participants.map(line=>[line,line===participants[0]?[lead.mechId]:[...ally.filter(a=>a.line===line&&a.join>=12).map(a=>a.id),...(line==='deepseek'?['deepseek-mobydick']:[])]]))});
  prior={main:a.main,power:w.power};
 }
}
for(let ep=1;ep<=15;ep++){
 const f=factionAt(ep);let selected=catalog.filter(c=>c.faction===f[0]&&!(c.id==='camel'&&ep!==11));
 selected.push(...catalog.filter(c=>c.id.startsWith('rival-')&&c.debut===ep),...catalog.filter(c=>c.id==='deepseek-housing'&&ep===6));
 if(ep>=9)selected.push(...catalog.filter(c=>c.grade==='elite'));
 if(ep>=14)selected.push(...catalog.filter(c=>ep===14?c.id==='pico-form-1':['pico-form-2','pico-form-3'].includes(c.id)));
 if(ep===11)selected.push(catalog.find(c=>c.id==='rival-jepa'));
 if(ep===13)selected=catalog.filter(c=>c.id.startsWith('rival-')||c.grade==='elite'||['predict-cube','elastic-cat'].includes(c.id));
 const entries=selected.map(c=>{const e=addEnemy(c,ep);return {mechId:e.id,pilotId:e.pilotId,...e.loadout,count:ep===13?(c.id==='predict-cube'||c.grade==='elite'?2:1):c.grade==='grunt'?(ep<=2?2:3):c.grade==='elite'?(ep>=13?2:1):1,...(ep===15&&c.id==='pico-form-3'?{spawnAfter:{mechId:'pico-form-2-episode-15',hp:0},ai:'hold'}:{})};});
 let rewards=entries.map(e=>({mechId:e.mechId,count:e.count}));
 if(ep===11)rewards=rewards.filter(e=>e.mechId!=='rival-jepa-episode-11');
 if(ep===13)rewards=entries.filter(e=>['rival-llama','rival-muse','rival-mistral'].some(id=>e.mechId===`${id}-episode-13`)).map(e=>({mechId:e.mechId,count:1}));
 if(ep>=14)rewards=rewards.filter(r=>!r.mechId.startsWith('pico-form-3'));
 if(ep===14)rewards=rewards.map(r=>({...r,experienceRecipient:['grunt','elite'].includes(enemy.find(e=>e.id===r.mechId).grade)?'auto':'player'}));
 const clearCredits=[1800,2200,2600,2800,3200,3800,4000,4200,4500,4800,5000,5200,5500,5800,6200][ep-1];
 const n=lines.filter(l=>l[2]<=ep&&l[0]!=='player-super').length;
 let expPool=0;
 for(const reward of rewards){if(reward.experienceRecipient==='auto')continue;const ent=entries.find(e=>e.mechId===reward.mechId),st=battle(gp(ep),{...ent});const k=core.experienceFor(st,st.units[0],st.units[1],true),chip=core.experienceFor(st,st.units[0],st.units[1],false);const f=shot(gp(ep),ent,ally.find(a=>a.id===gp(ep).mechId).main);expPool+=(k+(Math.ceil(core.effectiveMech(st,st.units[1]).hp/f.landed)-1)*chip)*reward.count;}
 const episode={episode:ep,level:level(ep),mainTune:tune(ep),reserveTune:Math.floor(tune(ep)/2),enemies:entries,clearCredits,clearExp:Math.max(0,Math.round(1000-expPool/n)),projectedCombatExp:expPool};
 if(ep>=11)episode.rewards=rewards;
 if(ep===11)episode.event={jepaHpFloor:1,phase:'다큰낙타 전반→JEPA 후반',endAfterJepaTurns:5,hiddenReward:'필중으로 JEPA 명중1회→12화 전원 시작 온도+5'};
 if(ep===13)episode.event={endTurn:6,rivalDefeats:5,endMode:'먼저 성립하는 조건',housingTrial:{deadlineTurn:4,deepseekEliteKills:2,resultMech:'deepseek-mobydick',hpFull:true,enFull:true,moraleAdd:10}};
 if(ep>=14){
  episode.forcedDeploy=ep===14?['grok','gpi','player']:['claude','player'];
  episode.rewardPolicy={credits:'campaign-shared',experience:ep===14?'우군이 맡는 자코·양산형 EXP는 우군 귀속으로 보수적 제외':'플레이어 귀속',thirdFormKillReward:0};
  episode.allies=[];
  for(const r of rivals.filter(r=>ep===14||r[0]==='jepa')){
   const source=enemy.find(e=>e.id===`rival-${r[0]}-episode-13`),base=mechs.find(m=>m.id===source.id),id=`ally-${r[0]}-episode-${ep}`,m=structuredClone(base);
   m.id=id;m.exp=0;m.credits=0;m.weapons=r[0]==='jepa'?[]:base.weapons.map(wid=>{const w=structuredClone(weapons.find(w=>w.id===wid));w.id=wid.replace(source.id,id);weapons.push(w);return w.id;});mechs.push(m);
   const entry={mechId:id,pilotId:r[0],level:level(ep),upgrades:structuredClone(source.loadout.upgrades),count:1,control:'auto',role:r[0]==='jepa'?'map-cancel':'fodder-screen',targetGrades:r[0]==='jepa'?[]:['grunt','elite']};
   if(r[0]==='jepa')entry.positioning={targetMech:`pico-form-${ep===14?1:2}-episode-${ep}`,maxDistance:2,autoApproach:true};
   episode.allies.push(entry);autoUnits.push({id,sourceId:source.id,pilotId:r[0],episode:ep,role:entry.role,main:m.weapons[0]??null});
  }
  if(ep===14){
   const screen=episode.allies.filter(a=>a.role==='fodder-screen'),targets=entries.filter(e=>['grunt','elite'].includes(enemy.find(x=>x.id===e.mechId).grade));
   const hp=targets.reduce((n,e)=>{const s=battle(gp(ep),e);return n+core.effectiveMech(s,s.units[1]).hp*e.count;},0),shots=targets.reduce((n,e)=>n+e.count,0);
   const ratio=n=>screen.reduce((sum,a)=>{const u={mechId:a.mechId,pilotId:a.pilotId,level:a.level,upgrades:{...a.upgrades,weapons:n}},info=autoUnits.find(i=>i.id===a.mechId);return sum+6*targets.reduce((v,e)=>v+Math.max(...mechs.find(q=>q.id===a.mechId).weapons.filter(id=>!weapons.find(w=>w.id===id).map&&(weapons.find(w=>w.id===id).moraleReq??0)<=100).map(id=>shot(u,e,id).expectedDamage))*e.count,0)/shots;},0)/hp;
   const before=ratio(2);let n=2;if(before<.3||before>.6)n=Array.from({length:11},(_,i)=>i).sort((a,b)=>Math.abs(ratio(a)-.45)-Math.abs(ratio(b)-.45))[0];
   for(const a of screen)a.upgrades.weapons=n;
   episode.allyFireAdjustment={originalWeaponsUpgrade:2,weaponsUpgrade:n,beforeRatio:before,ratio:ratio(n),criterion:'6턴 기대 피해 / 자코·양산형 HP 30~60%'};
   episode.event={victory:{mechId:'pico-form-1-episode-14',hp:0},defeat:'player-defeated',emergencyRam:{pilots:['gpi','grok'],usesPerEpisode:1,perPilot:true,nextPlayerPhase:true,hpPct:30}};
  }else episode.event={victory:'helpfulness',defeat:'player-defeated',stage2To3:{hp:0,independentHp:true}};
 }
 episodes.push(episode);
}
const equipped=new Set([...mechs.flatMap(m=>[...m.weapons,...(m.forms??[]).flatMap(f=>f.overrides.weapons??[])]),...combos.map(c=>c.weaponId)]);
for(let i=weapons.length-1;i>=0;i--)if(!equipped.has(weapons[i].id))weapons.splice(i,1);
core.validateContent(content);
const out=pathToFileURL(join(packDir,'data')+'/'),docs=pathToFileURL(join(sampleDir,'tools/out/saw-author')+'/');await mkdir(out,{recursive:true});await mkdir(docs,{recursive:true});
for(const [file,data] of Object.entries({mechs,weapons,pilots})){const path=new URL(`${file}.json`,out),prior=JSON.parse(await readFile(path,'utf8')),fresh=new Map(data.map(row=>[row.id,row])),seen=new Set(prior.map(row=>row.id)),merged=prior.map(row=>fresh.get(row.id)??row).concat(data.filter(row=>!seen.has(row.id)));await writeFile(path,JSON.stringify(merged,null,2)+'\n');}
await writeFile(new URL('model.json',docs),JSON.stringify({version:1,revision:2,ally,enemy,catalog,episodes,combos,autoUnits,alignment,criteriaChanges:{date:'2026-11-10',decidedBy:'Claude',jepa12Turns:[6,12],gachaTwoHits:'mean-1.1',gachaOneHit:'max-1.5',previous:{jepa12Turns:6,gachaTwoHitsDamage:11396,playerHp:8700}},scenarioAssumptions:{jepa12:{initialDistance:18,initialMorale:100,noCounters:true},friendly13:{turns:6,initialMorale:100,noSpirits:true,noCounters:true},housing13:{turns:4,helpers:['gpi','gem'],initialMorale:100}}},null,2)+'\n');
console.log(`독립 데이터 생성: 아군 ${ally.length}+특수형 2, 적 ${enemy.length}, 무장 ${weapons.length}, 파일럿 ${pilots.length}`);
}finally{await server.close();}
