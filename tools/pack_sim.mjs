import {packSources,readSource} from './pack-source.mjs';
/** 실제 v2 팩·캠페인·사건·대본을 읽는 헤드리스 캠페인 드라이버. */
import {readFile,writeFile,mkdir} from './files.mjs';
import {createServer} from './engine-api.mjs';
import {investSteadily} from './steady_investment.mjs';
import {createSaveAudit} from './save_audit.mjs';
const args=process.argv.slice(2),arg=(name,fallback)=>{const i=args.indexOf('--'+name);return i<0?fallback:args[i+1];};
const sources=await packSources(arg('pack')),source=sources[0];
const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,entries:[]},server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'silent'});
try{
 const [core,{loadPack,packLookup},{CoreCampaign},{CoreMap},{StoryEvents},{testCondition,storyChoices},{TrainingSaves},{aiProjection}]=await Promise.all([
  '/src/core/index.ts','/src/v2/pack/load.ts','/src/v2/adapter/campaign.ts','/src/v2/adapter/map.ts','/src/v2/story/events.ts','/src/v2/story/play.ts','/src/v2/adapter/saves.ts','/src/v2/story/stage-core.ts'
 ].map(p=>server.ssrLoadModule(p)));
 const {nextRulesAI,ruleCommand,phase,rulesForecast,faction,runtime}=await server.ssrLoadModule('/src/v2/rules/runtime.ts');
 const pack=await loadPack(source.root,p=>readSource(sources,p),undefined,{examples:false,gallery:false});if(pack.errors.length)throw Error(JSON.stringify(pack.errors));
 const variant=arg('ai-variant','all');if(variant!=='all'){const policy=pack.rules.rules.ai.resources;for(const [name,key]of [['response','enemyResponse'],['mix','nearOptimal'],['burst','burst'],['position','positionPlan']])if(variant!==name)delete policy[key];}
 const [{GameFlow},{CreditsScreen},{TitleScreen}]=await Promise.all(['/src/v2/game/flow.ts','/src/v2/menus/credits.ts','/src/v2/menus/screens.ts'].map(p=>server.ssrLoadModule(p)));
 const profile=arg('profile','basic');if(!['basic','steady','minimum','optimized'].includes(profile))throw Error('Unknown profile');
 const rows=[],completions=[],out=arg('out','tools/out/carbon');await mkdir(out,{recursive:true});const approved=JSON.parse(await readFile('tools/balance-v2-approved.json','utf8')).proposal;
 const persist=async()=>{await writeFile(out+'/simulation.json',JSON.stringify(rows,null,2)+'\n');await writeFile(out+'/simulation-endings.json',JSON.stringify(completions,null,2)+'\n');};
 class EndingApp{stack=[];sound={sfxVolume:.8,musicVolume:.6,play(){},music(){},credits:()=>[]};get top(){return this.stack.at(-1);}push(s){s.app=this;this.stack.push(s);s.enter();}pop(){this.stack.pop();this.top?.resume();}}
 const modes=arg('hidden','joined')==='both'?['joined','none']:[arg('hidden','joined')];
 const seeds=args.includes('--batch')?[1,7,19]:[Number(arg('seed',1))];
 for(const mode of modes)for(const seed of seeds)for(const line of (arg('line','both')==='both'?['real','super']:[arg('line')]))for(const type of (arg('type','both')==='both'?['O','M']:[arg('type')])){
  const values=new Map(),bytes={read:async k=>values.get(k)??null,replace:async(k,v)=>{values.set(k,v);}};
  const saves=new TrainingSaves(bytes,pack.campaign,pack.rules,pack.training),lookup=packLookup(pack,{});
  const model=new CoreCampaign(pack.campaign,pack.rules,saves,lookup,undefined,[],pack);model.newGame({name:'검사',preset:type==='O'?0:1,line});model.session.seed=seed;model.advance(false);
  const audit=args.includes('--audit-saves')?createSaveAudit(model,pack,{TrainingSaves,...await server.ssrLoadModule('/src/campaign/saves.ts')},out):undefined;
  audit?.capture('start');
  if(args.includes('--resume')||arg('resume-file'))model.session=JSON.parse(await readFile(arg('resume-file',`tools/out/mechanics/checkpoint-${mode}-${seed}-${line}-${type}.json`),'utf8'));
  if(arg('resume-save')){await bytes.replace('1',await readFile(arg('resume-save'),'utf8'));await model.load('1');}
  if(args.includes('--refresh-stage')){model.session.screen='intermission';model.advance(false);}
  if(profile==='steady'){model.session.screen='intermission';console.log(JSON.stringify({investment:'initial',...investSteadily(model)}));model.advance(false);}
  if(profile==='minimum'||profile==='optimized'){
   const episode=Number(arg('from',1)),plan=approved.economyPlans[mode+':'+profile][episode-1];
   // Isolated representative-stage fixture: same story progress, declared profile loadouts.
   // This is not a claim that its previous campaign earnings were re-simulated.
   for(const u of model.session.campaign.roster){u.upgrades=structuredClone(plan.loadouts[u.id]??{hp:0,en:0,armor:0,mobility:0,weapons:0});u.parts=structuredClone(profile==='optimized'?(plan.parts[u.id]??[]).slice(-(pack.rules.mechs.find(m=>m.id===u.mechId)?.partSlots??2)):[]);delete u.fullUpgradeBonus;}
   model.session.screen='intermission';
   if(profile==='optimized')for(const id of ['player','gpi'])for(let n=0;n<(episode>=9?2:episode>=7?1:0);n++)model.train(id,'skill');
   model.session.screen='intermission';model.advance(false);
  }
  if(model.session.game)model.session.game.battle.content.rules.ai=structuredClone(pack.rules.rules.ai);
  const policyProjection=state=>{const q=aiProjection(state);if(profile!=='minimum')return q;return {...q,content:{...q.content,mechs:q.content.mechs.map(m=>({...m,weapons:m.weapons.filter(id=>!id.startsWith('v2-combo-')),forms:m.forms?.map(f=>({...f,overrides:{...f.overrides,...(f.overrides.weapons?{weapons:f.overrides.weapons.filter(id=>!id.startsWith('v2-combo-'))}:{})}}))}))}};};
  let map,events;
  const play=(episode,scene)=>{
   const story=pack.stories[episode];if(!story.scenes[scene])return;
   events.activateScene(scene);let current=scene,budget=10000;
   const effect=c=>{
    if(c.do==='variable')events.state.set(c.name,c.value);
    if(c.do==='recruit')events.state.recruit?.(c.unit);
    if(c.do==='affection')events.state.affection(c.who,c.amount);
    if(c.do==='map'&&c.action==='통행')map.execute(ruleCommand({kind:'passage',rect:c.rect,blocked:c.blocked}));
    if(c.do==='map'&&c.unit){
     if(c.action==='배리어')map.execute(ruleCommand({kind:'barrier',id:c.unit,value:c.barrier}));
     if(c.action==='폼')map.execute(ruleCommand({kind:'form',id:c.unit,form:c.form}));
     if(c.action==='소진')map.execute(ruleCommand({kind:'exhaust',id:c.unit}));
     if(c.action==='등장'&&c.cell&&!map.state().units.some(u=>u.id===c.unit)){const stage=map.state().stage,definition=[...stage.units,...(stage.definitions??[]),...Object.values(stage.waves??{}).flat()].find(u=>u.id===c.unit);if(!definition)throw Error('등장 정의 없음 '+c.unit);map.execute({type:'system',unitId:'',action:{kind:'spawn',units:[{...definition,x:c.cell[0],y:c.cell[1]}]}});}
     if(c.action==='합류')map.execute({type:'system',unitId:'',action:{kind:'join',ids:[c.unit]}});
     if(c.action==='이동'&&c.cell)map.execute({type:'system',unitId:'',action:{kind:'move',ids:[c.unit],x:c.cell[0],y:c.cell[1]}});
     if(c.action==='퇴장')map.execute({type:'system',unitId:'',action:{kind:'retreat',ids:[c.unit]}});
    }
   };
   while(budget-->0){let jump,ended=false;
    for(let c of story.scenes[current]){
     if(c.do==='typed'){if(c.type!==events.state.type())continue;c=c.cue;}
     if(c.do==='end'){ended=true;break;}
     if(c.do==='jump')jump=c.scene;
     if(c.do==='condition'&&testCondition(c.test,events.state))jump=c.scene;
     if(c.do==='choice'){const options=storyChoices(c.choices,events.state);const choice=options[episode==='ep08'&&current==='조우 exaone-npc'&&mode==='none'?1:0];if(!choice)throw Error('empty choice');choice.effects.forEach(effect);jump=choice.target;}
     effect(c);audit?.capture('story:'+c.do);if(jump)break;
    }
    if(ended||!jump)break;current=jump;
   }
   if(budget<=0)throw Error('대본 루프');events.finishScene(scene);model.setStoryValue(`v2:story:${episode}:${scene}`,true);
  };
  const pending=episode=>{for(let n=0;n<100;n++){const key=`v2:pending:${episode}`,q=JSON.parse(String(model.storyValue(key)||'[]'));if(!q.length)return;const scene=q.shift();model.setStoryValue(key,JSON.stringify(q));play(episode,scene);}throw Error('대본 큐 루프');};
  const episodes=pack.game.episodes.slice(Number(arg('from',1))-1,Number(arg('through',pack.game.episodes.length))),retries=new Map();
  for(let episodeIndex=0;episodeIndex<episodes.length;episodeIndex++){const ep=episodes[episodeIndex];
   const game=model.session.game;if(!game||game.battle.stage.id!==ep.stage)throw Error('진행 순서 오류 '+ep.id);
   game.battle.stage.scenario=true;game.battle.options.autoResponse=true;
   events=new StoryEvents(pack,model,ep.id);const boot=events.process();model.acceptBattle(boot.state,boot.changes);
   map=new CoreMap(game.battle,{...lookup,variable:n=>n.startsWith('affection:')?model.storyAffection(n.slice(10)):model.storyValue(n),afterCommand:c=>events.process(c),onChange:(s,c)=>model.acceptBattle(s,c)});
   const measurements={shots:[],kills:[],spirits:[],devices:[],doubleActions:[],finisherUnlock:{},damageTaken:0,purchases:[]};const attackCounts=new Map();let exchangeId=0;
   const mechanics={combos:0,forms:0,barriers:0,copies:0,copyShots:0,thirdAttacksEnemy:0,enemyAttacksThird:0};
   const process=events.process.bind(events);events.process=change=>{const volley=++exchangeId;const remainingHp=new Map(change?.before.units.map(u=>[u.id,u.hp])??[]);if(change)for(const e of change.events){if(e.type==='spirit')measurements.spirits.push({...e,round:change.before.round});if(e.type==='device')measurements.devices.push({...e,round:change.before.round});if(e.type==='attack'){const a=change.before.units.find(u=>u.id===e.attackerId),d=change.before.units.find(u=>u.id===e.targetId),w=change.before.content.weapons.find(w=>w.id===e.weaponId);if(d&&faction(d)==='player')measurements.damageTaken+=e.hpDamage;if(a&&d&&faction(a)==='player'){const key=d.id+':'+(d.formId??'');attackCounts.set(key,(attackCounts.get(key)??0)+1);const alias=approved.compiledMechAliases[d.mechId]??d.mechId,curve=approved.enemyStageCurves[Number(ep.id.slice(2))]?.[d.mechId]??approved.enemyStageCurves[Number(ep.id.slice(2))]?.[alias],base=approved.mechs.find(m=>m.id===alias);measurements.shots.push({round:change.before.round,volley:change.command.type==='mapAttack'?volley:undefined,map:!!w?.map,targetForm:d.formId,targetSide:faction(d),morale:a.morale,moved:a.moved,enBefore:a.en,attacker:a.id,mech:a.mechId,pilot:a.pilotId,weapon:e.weaponId,name:w?.name,finisher:!!w?.finisher,freeOrAmmo:!(w?.en),target:d.id,grade:curve?.grade??base?.grade??'unknown',hit:e.hit,damage:e.hpDamage,counter:e.counter});const hp=remainingHp.get(d.id)??d.hp;remainingHp.set(d.id,Math.max(0,hp-e.hpDamage));if(hp>0&&e.hpDamage>=hp)measurements.kills.push({target:d.id,form:d.formId,attacks:attackCounts.get(key),grade:curve?.grade??base?.grade??'unknown'});}}if(e.combo)mechanics.combos++;if(e.barrier)mechanics.barriers++;if(e.type==='v2-form')mechanics.forms++;if(e.type==='v2-notice'&&e.text.startsWith('무기 복사'))mechanics.copies++;if(e.type==='attack'){const a=change.before.units.find(u=>u.id===e.attackerId),d=change.before.units.find(u=>u.id===e.targetId);if(a&&runtime(change.before).copies[a.id]?.weapon===e.weaponId&&!e.counter)mechanics.copyShots++;if(a&&d&&faction(a)==='third'&&faction(d)==='enemy')mechanics.thirdAttacksEnemy++;if(a&&d&&faction(a)==='enemy'&&faction(d)==='third')mechanics.enemyAttacksThird++;}}return process(change);};
   const deployed=map.state().units.filter(u=>u.side==='player').map(u=>u.id);
   for(const [unit,join]of [['qwen',7],['sonnet',8],['exaone',9]]){const registered=model.session.campaign.roster.some(u=>u.id===unit);if(deployed.includes(unit)!==(registered&&Number(ep.id.slice(2))>=join))throw Error(ep.id+' 조건부 편성 오류 '+unit);}
   play(ep.id,'도입');play(ep.id,'출격');pending(ep.id);
   const seen=new Set(),recovering=new Set();let commands=0,lastTrace;
   for(;commands<4000&&!map.state().outcome;commands++){
    await audit?.flush();
    const state=map.state();if(args.includes('--trace')&&lastTrace!==state.round+state.phase){lastTrace=state.round+state.phase;console.log('TRACE '+JSON.stringify({episode:ep.id,round:state.round,phase:phase(state),rules:runtime(state),units:state.units.filter(u=>u.alive).map(u=>({id:u.id,hp:u.hp,en:u.en,sp:u.sp,acted:u.acted,moved:u.moved,x:u.x,y:u.y,parts:u.parts,used:u.usedItems}))}));}const turnLimit=profile==='minimum'&&ep.id==='ep10'?80:40;if(state.round>turnLimit){await writeFile(out+'/failed-state.json',JSON.stringify({episode:ep.id,state,session:model.session}));throw Error(`${ep.id} ${turnLimit}턴 드라이버 관측 한도 초과`);}
    for(const u of state.units.filter(u=>u.alive&&u.side==='player')){const fins=core.effectiveMech(state,u).weapons.map(id=>state.content.weapons.find(w=>w.id===id)).filter(w=>w?.finisher);if(fins.some(w=>u.morale>=(w.moraleReq??0))&&!measurements.finisherUnlock[u.id])measurements.finisherUnlock[u.id]={round:state.round,energyReady:fins.some(w=>u.en>=(w.en??0)),inference:core.effectivePilot(state,u).stats.skill,rouseBefore:measurements.spirits.filter(x=>x.unitId===u.id&&x.spiritId==='rouse').map(x=>x.round)};if((u.actionsSpent??0)>0&&!u.acted&&!measurements.doubleActions.some(v=>v.id===u.id&&v.round===state.round))measurements.doubleActions.push({id:u.id,round:state.round,inference:core.effectivePilot(state,u).stats.skill,level:u.level,extra:u.extraActionsUsed});}
    // The final objective is contact, not more damage. Clear a legal approach tile if escorts occupy all four sides.
    if(ep.id==='ep15'&&state.phase==='player'){const goal=state.units.find(u=>u.id==='pico'&&u.formId==='core'&&u.alive),lead=state.units.find(u=>u.id==='player'&&u.alive&&!u.acted);if(goal&&lead){const neighbors=[[goal.x-1,goal.y],[goal.x+1,goal.y],[goal.x,goal.y-1],[goal.x,goal.y+1]].map(([x,y])=>({x,y})).filter(p=>p.x>=0&&p.y>=0&&p.x<state.stage.map.w&&p.y<state.stage.map.h),empty=neighbors.filter(p=>!state.units.some(u=>u.alive&&u.x===p.x&&u.y===p.y));if(!empty.length){const blockers=neighbors.map(p=>state.units.find(u=>u.alive&&u.x===p.x&&u.y===p.y)).filter(u=>u?.side==='player'&&!u.acted&&!u.moved);let yielded=false;for(const u of blockers){const cell=core.reachable(policyProjection(state),u.id).filter(p=>Math.abs(p.x-goal.x)+Math.abs(p.y-goal.y)>1).sort((a,b)=>a.cost-b.cost)[0];if(cell){map.execute({type:'move',unitId:u.id,x:cell.x,y:cell.y});map.execute({type:'wait',unitId:u.id});pending(ep.id);yielded=true;break;}}if(yielded)continue;}else if(!lead.moved){const cells=core.reachable(policyProjection(state),lead.id).filter(p=>p.x!==lead.x||p.y!==lead.y).sort((a,b)=>Math.min(...empty.map(p=>Math.abs(p.x-a.x)+Math.abs(p.y-a.y)))-Math.min(...empty.map(p=>Math.abs(p.x-b.x)+Math.abs(p.y-b.y)))||a.cost-b.cost);if(cells[0]){map.execute({type:'move',unitId:lead.id,x:cells[0].x,y:cells[0].y});pending(ep.id);continue;}}}}
    // Minimum profile protects the mandatory survivor from the copier's burst; no stat edits.
    if(profile==='minimum'&&ep.id==='ep10'&&state.phase==='player'){const lead=state.units.find(u=>u.id==='player'&&u.alive&&!u.acted),boss=state.units.find(u=>u.id==='minimax'&&u.alive);if(lead&&boss&&boss.hp>Math.max(...core.effectiveMech(state,lead).weapons.map(id=>core.effectiveWeapon(state,lead,state.content.weapons.find(w=>w.id===id)).power))){const threats=state.units.filter(u=>u.alive&&faction(u)==='enemy'),gap=p=>Math.min(...threats.map(u=>Math.abs(u.x-p.x)+Math.abs(u.y-p.y)));const far=lead.moved?undefined:core.reachable(policyProjection(state),lead.id).sort((a,b)=>gap(b)-gap(a)||a.cost-b.cost)[0];map.execute(far&&gap(far)>gap(lead)?{type:'move',unitId:lead.id,x:far.x,y:far.y}:{type:'wait',unitId:lead.id});pending(ep.id);continue;}}
    // Use an available support caster before acting; post-action spirits may be disabled.
    if(profile!=='minimum'&&state.phase==='player'){const repair=state.units.filter(u=>u.alive&&u.side==='player'&&u.hp/core.effectiveMech(state,u).hp<.55).flatMap(u=>(u.parts??[]).flatMap((id,slot)=>id==='repair-kit'&&!u.usedItems?.includes(slot)?[{unitId:u.id,slot}]:[]))[0];if(repair){map.execute({type:'useItem',...repair});pending(ep.id);continue;}const hurt=state.units.filter(u=>u.alive&&u.side==='player'&&u.hp/core.effectiveMech(state,u).hp<.65).sort((a,b)=>a.hp/core.effectiveMech(state,a).hp-b.hp/core.effectiveMech(state,b).hp)[0];const healer=hurt&&state.units.filter(u=>u.alive&&u.side==='player').sort((a,b)=>Number(a.id==='player')-Number(b.id==='player')).find(u=>!core.spiritProblem(state,u.id,'aid',hurt.id));if(hurt&&healer){map.execute({type:'spirit',unitId:healer.id,spiritId:'aid',targetId:hurt.id});pending(ep.id);continue;}}
    if(profile==='optimized'&&state.phase==='player'){
     const cast=state.units.filter(u=>u.alive&&u.side==='player'&&!u.acted).flatMap(u=>{const fins=core.effectiveMech(state,u).weapons.map(id=>state.content.weapons.find(w=>w.id===id)).filter(w=>w?.finisher),need=Math.min(...fins.map(w=>w.moraleReq??0)),can=id=>!seen.has(`${state.round}:${u.id}:${id}`)&&!core.spiritProblem(state,u.id,id);const id=ep.id==='ep10'&&['player','gpi'].includes(u.id)&&can('shelter')?'shelter':state.round<=3&&u.morale<need&&can('rouse')?'rouse':can('trial-awaken')&&u.sp>=Math.ceil(core.effectivePilot(state,u).sp/2)+20?'trial-awaken':undefined;return id?[{type:'spirit',unitId:u.id,spiritId:id}]:[];})[0];if(cast){seen.add(`${state.round}:${cast.unitId}:${cast.spiritId}`);map.execute(cast);pending(ep.id);continue;}
    }
    let command;if(profile==='minimum'&&state.phase==='player'&&!['ep12','ep14'].includes(ep.id)){const actor=state.units.filter(u=>u.alive&&!u.acted&&faction(u)==='player').sort((a,b)=>(a.actionsSpent??0)-(b.actionsSpent??0)||a.id.localeCompare(b.id))[0];command=actor?core.chooseAICommand(policyProjection(state),actor.id):{type:'endPhase'};}else command=nextRulesAI(state);if(!command)throw Error('AI 명령 없음');
    if(['ep02','ep06','ep13'].includes(ep.id)&&state.phase==='player'&&['move','attack','wait'].includes(command.type)&&'unitId'in command){const order=ep.id==='ep02'?['slime-1','midjourney','sd']:ep.id==='ep13'?['spar-1','spar-2','llama','minimax','hyperclova','jepa','dopamine-1','dopamine-2','dopamine-3']:mode==='joined'?['whale-1','whale-2','qwen-rival','deepseek-rival']:['whale-1','whale-2','deepseek-rival'];const focus=order.find(id=>state.units.some(u=>u.id===id&&u.alive));if(focus)command=core.chooseAICommand({...policyProjection(state),units:policyProjection(state).units.map(u=>u.side==='enemy'&&u.id!==focus?{...u,side:'neutral'}:u)},command.unitId);}
    if(ep.id==='ep03'&&state.phase==='player'&&(profile==='minimum'?['gpi','gem','claude',...(model.storyValue('클로드합류')===1?['player']:[])]:['gpi','gem']).includes(command.unitId)&&['move','attack','wait'].includes(command.type)&&state.units.some(u=>u.id==='leader'&&u.alive))command=core.chooseAICommand({...policyProjection(state),content:{...policyProjection(state).content,rules:{...state.content.rules,ai:{...state.content.rules.ai,resources:{...state.content.rules.ai.resources,nearOptimal:state.round>=6?0:state.content.rules.ai.resources.nearOptimal}}}},units:policyProjection(state).units.map(u=>u.side==='enemy'&&u.id!=='leader'?{...u,side:'neutral'}:u)},command.unitId);
    if(ep.id==='ep07'&&state.phase==='player'&&['move','attack','wait'].includes(command.type)&&'unitId'in command){const urgent=state.units.filter(u=>u.alive&&u.id.startsWith('soup-')).sort((a,b)=>Math.abs(a.x-8)+Math.abs(a.y-2)-Math.abs(b.x-8)-Math.abs(b.y-2));if(urgent[0])command=core.chooseAICommand({...policyProjection(state),units:policyProjection(state).units.map(u=>u.side==='enemy'&&u.id!==urgent[0].id?{...u,side:'neutral'}:u)},command.unitId);}
    const unit='unitId'in command?state.units.find(u=>u.id===command.unitId):undefined;
    if(state.phase==='player'&&unit&&['move','attack','wait'].includes(command.type)){
     let target;
     if(ep.id==='ep11'&&unit.id==='player'){map.execute({type:'wait',unitId:unit.id});pending(ep.id);continue;}
   if(ep.id==='ep12'&&((unit.id==='gpi'&&model.storyValue('지피동기화')!==1)||(unit.id==='claude'&&model.storyValue('세계언어공명')!==1))){map.execute({type:'wait',unitId:unit.id});pending(ep.id);continue;}
     const ratio=unit.hp/core.effectiveMech(state,unit).hp;
     const finishing=ep.id==='ep15'&&unit.id==='player'&&state.units.some(u=>u.id==='pico'&&u.formId==='core'&&u.alive);
     if(profile==='minimum'&&ep.id==='ep10'&&core.environmentOf(state,unit)!=='ground')recovering.delete(unit.id);
     if(finishing)recovering.delete(unit.id);else if(ratio<.6&&!(profile==='minimum'&&ep.id==='ep10'&&core.environmentOf(state,unit)!=='ground'))recovering.add(unit.id);if(ratio>.8)recovering.delete(unit.id);
     if(recovering.has(unit.id)&&unit.moved&&state.stage.map.tiles.some(row=>row.includes('saw-cache'))){map.execute({type:'wait',unitId:unit.id});pending(ep.id);continue;}
     if(recovering.has(unit.id)&&!unit.moved){const enemies=state.units.filter(u=>u.side==='enemy'&&u.alive&&pack.stageScripts?.[state.stage.id]?.ai[u.id]?.kind!=='defend');const caches=state.stage.map.tiles.flatMap((r,y)=>r.flatMap((t,x)=>t==='saw-cache'&&(!state.units.some(u=>u.alive&&u.id!==unit.id&&u.x===x&&u.y===y))?[{x,y}]:[])).sort((a,b)=>(Math.abs(a.x-unit.x)+Math.abs(a.y-unit.y)+Math.max(0,5-Math.min(...enemies.map(e=>Math.abs(e.x-a.x)+Math.abs(e.y-a.y))))*3)-(Math.abs(b.x-unit.x)+Math.abs(b.y-unit.y)+Math.max(0,5-Math.min(...enemies.map(e=>Math.abs(e.x-b.x)+Math.abs(e.y-b.y))))*3));if(caches.length){target=caches[0];if(unit.x===target.x&&unit.y===target.y){map.execute({type:'wait',unitId:unit.id});pending(ep.id);continue;}}}
     if(!target&&ep.id==='ep07'&&unit.id==='claude'&&!unit.moved&&!unit.acted){target=mode==='joined'?{x:7,y:2}:{x:4,y:8};if(unit.x===target.x&&unit.y===target.y){map.execute({type:'wait',unitId:unit.id});pending(ep.id);continue;}}
     if(!target&&unit.id==='player'&&!unit.moved&&!unit.acted){
      if(ep.id==='ep12'&&model.storyValue('지피동기화')!==1)target={x:4,y:4};
      else if(ep.id==='ep12'&&model.storyValue('세계언어공명')!==1)target={x:7,y:6};
      if(ep.id==='ep15'){const center=state.units.find(u=>u.id==='pico'&&u.formId==='core'&&u.alive);if(center){target=[[center.x-1,center.y],[center.x+1,center.y],[center.x,center.y-1],[center.x,center.y+1]].filter(([x,y])=>x>=0&&y>=0&&x<state.stage.map.w&&y<state.stage.map.h&&!state.units.some(v=>v.alive&&v.x===x&&v.y===y)).map(([x,y])=>({x,y})).sort((a,b)=>Math.abs(a.x-unit.x)+Math.abs(a.y-unit.y)-Math.abs(b.x-unit.x)-Math.abs(b.y-unit.y)||a.y-b.y||a.x-b.x)[0];}}
   if(ep.id==='ep03'&&model.storyValue('클로드합류')!==1)target={x:4,y:5};
      if(ep.id==='ep08')target=!model.storyValue('v2:story:ep08:사건 친절한 막내')?{x:4,y:5}:mode==='none'?{x:3,y:5}:undefined;
      if(target&&unit.x===target.x&&unit.y===target.y){map.execute({type:'wait',unitId:unit.id});pending(ep.id);continue;}
      if(ep.id==='ep04'&&state.round<=5&&model.storyValue('그록합류')!==1&&state.units.some(u=>u.id==='grok'&&u.alive))target={x:14,y:5};
     }
     
     if(target){const tiles=map.reach(unit.id).filter(p=>p.col!==unit.x||p.row!==unit.y).sort((a,b)=>Math.abs(a.col-target.x)+Math.abs(a.row-target.y)-Math.abs(b.col-target.x)-Math.abs(b.row-target.y)||a.row-b.row||a.col-b.col);if(tiles.length)command={type:'move',unitId:unit.id,x:tiles[0].col,y:tiles[0].row};}
     else if(profile!=='minimum'&&command.type==='attack'){
      const key=`${state.round}:${unit.id}`;
      const targetUnit=state.units.find(u=>u.id===command.targetId),targetAlias=approved.compiledMechAliases[targetUnit.mechId]??targetUnit.mechId,targetGrade=(approved.enemyStageCurves[Number(ep.id.slice(2))]?.[targetAlias]??approved.mechs.find(m=>m.id===targetAlias))?.grade,boss=['mid','boss'].includes(targetGrade),can=id=>!core.spiritProblem(state,unit.id,id),hit=rulesForecast(state,unit.id,command.targetId,command.weaponId).hitRate,boost=boss&&hit<85&&can('assure')?'assure':boss&&hit<85&&can('focus')?'focus':boss&&can('surge')?'surge':boss&&unit.morale<Math.min(...core.effectiveMech(state,unit).weapons.map(id=>state.content.weapons.find(w=>w.id===id)).filter(w=>w?.finisher).map(w=>w.moraleReq??0))&&can('rouse')?'rouse':undefined;
      const spirit=boost?state.content.spirits.find(s=>s.id===boost):state.content.spirits?.find(s=>s.target==='self'&&!core.spiritProblem(state,unit.id,s.id));
      if(spirit&&!seen.has(key)){seen.add(key);command={type:'spirit',unitId:unit.id,spiritId:spirit.id};}
      else {const support=command.weaponId.startsWith('v2-combo')?undefined:core.supportAttackCandidates(policyProjection(state),unit.id,command.targetId)[0];if(support)command={...command,supportAttackerId:support.unitId};}
     }
    }
    
    if(lookup.aiCommand&&(['basic','steady'].includes(profile)||!('unitId'in command)||faction(state.units.find(u=>u.id===command.unitId))!=='player'))command=lookup.aiCommand(state,command);
    map.execute(command);pending(ep.id);
   }
   const state=map.state(),row={profile,aiVariant:variant,episode:ep.id,seed,line,type,hidden:mode,mechanics,measurements,outcome:state.outcome,turn:state.round,commands,deployed,finalUnits:state.units.map(u=>({id:u.id,side:faction(u),alive:u.alive,level:u.level,exp:u.exp,hp:u.hp,en:u.en,inference:core.effectivePilot(state,u).stats.skill,supportExperience:u.supportExperience,deviceUses:u.deviceUses})),allies:state.units.filter(u=>u.side==='player'&&u.alive).map(u=>u.id),joined:{claude:model.storyValue('클로드합류'),grok:model.storyValue('그록합류'),qwen:model.storyValue('퀜내기성공'),sonnet:model.storyValue('소네트합류'),exaone:model.storyValue('엑사원합류조건')},rng:state.rng};rows.push(row);await persist();console.log(JSON.stringify(row));
   if(audit){await audit.finish();}
   if(state.outcome==='defeat'&&model.canRetry()){
    model.finish();await model.retry();const attempt=(retries.get(ep.id)??0)+1;retries.set(ep.id,attempt);
    if(attempt>Number(arg('max-retries',10)))throw Error('재도전 한도 '+ep.id);
    if(profile==='steady'||profile==='optimized')console.log(JSON.stringify({retry:ep.id,attempt,...investSteadily(model)}));
    if(profile==='basic'){
     const plan=approved.economyPlans[mode+':basic']?.[Number(ep.id.slice(2))-1];
     if(plan){for(const [id,loadout]of Object.entries(plan.loadouts)){const unit=model.session.campaign.roster.find(u=>u.id===id);if(unit)for(const [key,value]of Object.entries(loadout))while((model.session.campaign.roster.find(u=>u.id===id).upgrades?.[key]??0)<value){if(!model.upgrade(id,key))break;}}
      for(const [id,parts]of Object.entries(plan.parts))if(model.session.campaign.roster.some(u=>u.id===id))for(const [slot,part]of parts.entries())if(!model.equip(id,slot,part)&&model.buy(part,1))model.equip(id,slot,part);
     }
    }
    await model.save('auto');model.advance();episodeIndex--;continue;
   }
   if(state.outcome!=='victory')throw Error(`${ep.id} 클리어 실패: ${line}/${type}/${seed}`);
   if(ep.id==='ep06'&&(!mechanics.thirdAttacksEnemy||!mechanics.enemyAttacksThird))throw Error('6화 진영 간 실제 교전 누락');
   if(ep.id==='ep10'&&!mechanics.copyShots)throw Error('10화 복사 무장 선공 누락');
   if(ep.id==='ep12'&&!mechanics.combos)throw Error('12화 합체기 누락');
   if(ep.id==='ep03'&&model.storyValue('클로드합류')!==1)throw Error('클로드 각성 누락');
   play(ep.id,'승리');
   for(const [episode,flag]of [['ep06','퀜내기성공'],['ep07','소네트합류'],['ep08','엑사원합류조건']])if(ep.id===episode&&(model.storyValue(flag)===1)!==(mode==='joined'))throw Error(ep.id+' 히든 '+mode+' 경로 불일치 '+flag);
   game.mode='outcome';model.finish();model.advance();play(ep.id,'인터미션');
   if(model.session.screen==='intermission'&&profile==='steady')console.log(JSON.stringify({investment:ep.id,...investSteadily(model)}));
   if(model.session.screen==='intermission'&&profile==='basic'){
    const plan=approved.economyPlans[mode+':basic']?.[Number(ep.id.slice(2))];
    if(plan){const before=model.funds();for(const [id,loadout]of Object.entries(plan.loadouts)){const unit=model.session.campaign.roster.find(u=>u.id===id);if(!unit)continue;for(const [key,value]of Object.entries(loadout))for(let n=unit.upgrades?.[key]??0;n<value;n++){if(!model.upgrade(id,key))throw Error(`개조 구매 실패 ${ep.id}/${id}/${key}/${n} (자금 ${model.funds()})`);}}
      for(const [id,parts]of Object.entries(plan.parts)){if(!model.session.campaign.roster.some(u=>u.id===id))continue;for(const [slot,part]of parts.entries()){if(!model.equip(id,slot,part)){if(!model.buy(part,1)||!model.equip(id,slot,part))throw Error('파츠 구매/장착 실패 '+part);}}}
      console.log(JSON.stringify({intermission:ep.id,profile:'basic',earned:before,spent:before-model.funds(),remaining:model.funds()}));
    }
   }
   if(model.session.screen!=='end')model.advance();
   if(args.includes('--checkpoint')){await mkdir('tools/out/mechanics',{recursive:true});await writeFile(`tools/out/mechanics/checkpoint-${mode}-${seed}-${line}-${type}.json`,JSON.stringify(model.session));await writeFile(out+'/checkpoint-after-'+ep.id+'.json',JSON.stringify(model.session));}
  }
  if(Number(arg('through',pack.game.episodes.length))>=pack.game.episodes.length&&pack.game.ending){play(pack.game.ending.episode,pack.game.ending.scene);if(!model.storyValue('완료엔딩'))throw Error('엔딩 누락');const app=new EndingApp(),flow=new GameFlow(app,model,{images:{}},undefined,pack);flow.show();if(!(app.top instanceof CreditsScreen))throw Error('엔딩 뒤 크레딧 누락');const ending=model.storyValue('완료엔딩');app.top.input({kind:'action',action:'cancel'});for(let n=0;n<100&&!(app.top instanceof TitleScreen);n++)await new Promise(r=>setImmediate(r));if(!(app.top instanceof TitleScreen)||(model.session.campaign.cycle??1)!==2)throw Error('크레딧 뒤 타이틀 누락');const completion={ending,seed,line,type,hidden:mode,credits:true,title:true};completions.push(completion);console.log(JSON.stringify(completion));}
  if(Number(arg('through',pack.game.episodes.length))>=pack.game.episodes.length&&(pack.game.ending?model.session.campaign.cycle!==2:model.session.screen!=='end'))throw Error('마지막 화 뒤 종료되지 않음');
  if(audit){const report=await audit.finish();if(report.failures.length)throw Error('저장 왕복 검사 실패 '+report.failures.length);}
 }
 await mkdir(out,{recursive:true});await writeFile(out+'/simulation-endings.json',JSON.stringify(completions,null,2)+'\n');await writeFile(out+'/simulation.json',JSON.stringify(rows,null,2)+'\n');
 const summary=Object.fromEntries(pack.game.episodes.map(e=>{const xs=rows.filter(r=>r.episode===e.id);return [e.id,{count:xs.length,mean:xs.reduce((n,r)=>n+r.turn,0)/Math.max(1,xs.length),min:Math.min(...xs.map(r=>r.turn)),max:Math.max(...xs.map(r=>r.turn))}];}));await writeFile(out+'/simulation-summary.json',JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
 const slow=modes.flatMap(mode=>pack.game.episodes.flatMap(e=>{const xs=rows.filter(r=>r.hidden===mode&&r.episode===e.id);if(!xs.length)return [];const mean=xs.reduce((n,r)=>n+r.turn,0)/xs.length,max=Math.max(...xs.map(r=>r.turn));return max>15||args.includes('--batch')&&(mean<5||mean>12)?[`${mode}/${e.id} ${mean.toFixed(2)} (최대 ${max})`]:[];}));if(slow.length)console.warn('목표 턴 범위 이탈: '+slow.join(', '));
 console.log(`${rows.length}개 전투 클리어, ${Number(arg('through',pack.game.episodes.length))>=pack.game.episodes.length?'등록된 마지막 화 뒤 안전 종료 확인':'선택 범위 검증 완료'}`);
}finally{await server.close();}
