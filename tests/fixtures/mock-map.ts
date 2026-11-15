/**
 * 진열장용 맵 규칙 흉내.
 * 맵 화면이 규칙 없이도 돌아가는지 보려고 만든 가짜 MapModel이다. 수치와 판정은 아무 의미가 없다.
 * 진짜 게임에서는 규칙 코어를 감싼 MapModel이 이 자리에 들어온다(adapter/).
 */
import type { Strike } from '@engine/src/v2/battle/types';
import { sameCell, type Cell, type MapEvent, type MapModel, type UnitView,type SpiritView } from '@engine/src/v2/map/model';
import type { Portrait } from '@engine/src/v2/ui';
import { SPIRITS, WEAPONS, type Sample } from '../pack-fixture';

interface MockUnit extends UnitView { armed: boolean; sp: number;form?:string;transformed?:boolean;members?:MockUnit[];baseName?:string }
const distance = (a: Cell, b: Cell): number => Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
const ARMS = [
  { id: 'saber', weapon: WEAPONS.saber, power: 2500, min: 1, max: 1, damage: 2517 },
  { id: 'vulcan', weapon: WEAPONS.vulcan, power: 2000, min: 1, max: 3, damage: 2000 },
  { id: 'beam', weapon: WEAPONS.beam, power: 4125, min: 2, max: 4, damage: 3100 },
];
const COSTS = [20, 15, 25, 30];

export function mockMap(sample: Sample,options:{manualResponse?:boolean}={}): MapModel {
  const { images } = sample, cols = 20, rows = 11, fighters = sample.exchange([]).fighters;
  const portraitOf = (id: string): Portrait => fighters.find(f => f.id === id)!.portrait;
  const otaku: Portrait = { faces: sample.cast.otaku.faces ?? {}, moodSheet:sample.cast.otaku.moodSheet, crop: { x: 0.2, y: 0.03, w: 0.6, h: 0.4 } };
  const unit = (id: string, team: UnitView['team'], col: number, row: number, name: string, pilot: string, icon: string, portrait: Portrait, hp: number, armed = true): MockUnit =>
    ({ id, team, cell: { col, row }, name, pilot, icon: images[icon], iconFit:true, portrait, hp, hpMax: hp, en: 120, enMax: 120, heat: 100, acted: false, armed, sp: 60 });
  let units: MockUnit[] = [
    unit('gpi', 'ally', 4, 5, '옴니 루나', '지피짱', 'icon-omni-luna', portraitOf('gpi'), 6500),
    unit('user', 'ally', 3, 6, '프롬프트 커맨더', '유저', 'icon-commander', otaku, 6000, false),
    unit('spam1', 'enemy', 10, 4, '스팸 봇', '스팸 봇', 'icon-spam-bot', portraitOf('spam'), 3494),
    unit('spam2', 'enemy', 12, 6, '스팸 봇', '스팸 봇', 'icon-spam-bot', portraitOf('spam'), 3494),
    unit('spam3', 'enemy', 15, 3, '스팸 봇', '스팸 봇', 'icon-spam-bot', portraitOf('spam'), 3494),
    unit('spam4', 'enemy', 16, 8, '스팸 봇', '스팸 봇', 'icon-spam-bot', portraitOf('spam'), 3494),
  ];
  let turn = 1, rolls = 0,activeTeam:UnitView['team']='ally';
  const find = (id: string): MockUnit => units.find(u => u.id === id)!;
  const occupied = (cell: Cell, except?: string): boolean => units.some(u => u.id !== except && sameCell(u.cell, cell));

  /** 너비 우선 탐색: 걸음 수 안에서 갈 수 있는 칸과, 각 칸에 닿기 직전의 칸. 남의 기체는 지나가지 못한다. */
  const walk = (id: string, steps: number): Map<string, Cell | undefined> => {
    const start = find(id).cell, seen = new Map<string, Cell | undefined>([[`${start.col},${start.row}`, undefined]]);
    let frontier = [start];
    for (let i = 0; i < steps; i++) {
      const next: Cell[] = [];
      for (const from of frontier) for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const cell = { col: from.col + dc, row: from.row + dr }, key = `${cell.col},${cell.row}`;
        if (cell.col < 0 || cell.row < 0 || cell.col >= cols || cell.row >= rows || seen.has(key) || occupied(cell, id)) continue;
        seen.set(key, from); next.push(cell);
      }
      frontier = next;
    }
    return seen;
  };
  const cellsOf = (seen: Map<string, Cell | undefined>): Cell[] => [...seen.keys()].map(key => { const [col, row] = key.split(',').map(Number); return { col, row }; });
  const route = (id: string, to: Cell, steps: number): Cell[] => {
    const seen = walk(id, steps), path: Cell[] = [];
    for (let at: Cell | undefined = to; at; at = seen.get(`${at.col},${at.row}`)) path.unshift(at);
    return path;
  };
  const foes = (id: string, at: Cell, min = 1, max = 4): MockUnit[] => {
    const me = find(id);
    return units.filter(u => u.team !== me.team && distance(u.cell, at) >= min && distance(u.cell, at) <= max).sort((a, b) => distance(a.cell, at) - distance(b.cell, at));
  };
  /** 전투 한 판을 만든다. 진열장의 예시 기체(gpi, spam)에 지금 체력을 얹는다. */
  const battle = (strikes: Strike[], ally: MockUnit, enemy: MockUnit): MapEvent => {
    const exchange = sample.exchange(strikes, enemy.hp, ally.en);
    exchange.fighters.find(f => f.id === 'gpi')!.hp = ally.hp;
    const rename=(id:string)=>id==='gpi'?ally.id:id==='spam'?enemy.id:id;exchange.fighters=exchange.fighters.filter(f=>f.id==='gpi'||f.id==='spam').map(f=>({...f,id:rename(f.id),name:f.id==='gpi'?ally.name:enemy.name}));exchange.strikes=strikes.map(s=>({...s,attacker:rename(s.attacker),target:rename(s.target)}));
    return { type: 'battle', exchange };
  };
  const remove = (events: MapEvent[]): void => {
    for (const dead of units.filter(u => u.hp <= 0)) events.push({ type: 'defeat', unitId: dead.id });
    units = units.filter(u => u.hp > 0);
    if (!units.some(u => u.team === 'enemy')) events.push({ type: 'end', won: true });
    else if (!units.some(u => u.team === 'ally')) events.push({ type: 'end', won: false });
  };

  const model:MapModel = {
    cols, rows, terrain: images['map-terrain'],
    turn: () => ({ team: activeTeam, number: turn }),
    units: () => units.map(u => ({ ...u })),
    terrainAt: cell => ((cell.col * 7 + cell.row * 3) % 5 === 0 ? { name: '복구 서버', defense: 10, evade: 10 } : (cell.col + cell.row) % 4 === 0 ? { name: '냉각수 수로', defense: 0, evade: -10 } : { name: '데이터 통로', defense: 0, evade: 0 }),
    reach: id => cellsOf(walk(id, find(id).team === 'ally' ? 4 : 3)),
    route: (id, to) => route(id, to, 4),
    commands: (id, at) => [
      { id: 'attack', label: '공격', disabled: !find(id).armed || !foes(id, at).length },
      { id: 'spirit', label: '정신 커맨드' },
      { id: 'wait', label: '대기' },
      {id:'transform',label:'변형',disabled:!model.transformations!(id,at).length},
      ...(find(id).members?[{id:'split',label:'분리',disabled:find(id).acted}]:[{id:'combine',label:'합체',disabled:!model.combinations!(id,at).length}]),
      {id:'persuade',label:'설득',disabled:!model.persuadeTargets!(id,at).length},
      {id:'mapAttack',label:'맵 병기',disabled:!find(id).armed||!model.mapAims!(id,at,'sweep').length},
    ],
    range: (_id, at) => { const cells: Cell[] = []; for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) { const d = distance({ col: c, row: r }, at); if (d >= 1 && d <= 4) cells.push({ col: c, row: r }); } return cells; },
    targets: (id, at) => foes(id, at).map(u => u.id),
    weapons: (id, at, targetId) => { const d = distance(find(targetId).cell, at), me = find(id); return ARMS.map(a => ({ id: a.id, name: a.weapon.name, power: a.power, range: a.min === a.max ? String(a.min) : `${a.min}-${a.max}`, cost: a.weapon.cost, usable: d >= a.min && d <= a.max && me.en >= a.weapon.cost })); },
    forecast: (id, at, weaponId, targetId) => {
      const arm = ARMS.find(a => a.id === weaponId)!, near = distance(find(targetId).cell, at) <= 3;
      return { attacker: { unitId: id, weapon: arm.weapon.name, hit: 94, damage: arm.damage, critical: 12 }, defender: near ? { unitId: targetId, weapon: WEAPONS.spamMail.name, hit: 31, damage: 412, critical: 2 } : { unitId: targetId } };
    },
    spirits: (id):SpiritView[] => [...SPIRITS.map((s, i) => ({ id: String(i), name: s.name, cost: COSTS[i] ?? 20, usable: find(id).sp >= (COSTS[i] ?? 20) })),{id:'trust',name:'신뢰',cost:20,usable:find(id).sp>=20,targeted:true}],
    wait: (id, at) => { const me = find(id); me.cell = at; me.acted = true; return []; },
    attack: (id, at, weaponId, targetId) => {
      const me = find(id), target = find(targetId), arm = ARMS.find(a => a.id === weaponId)!, events: MapEvent[] = [];
      me.cell = at; me.acted = true;
      const strikes: Strike[] = [{ attacker: 'gpi', target: 'spam', weapon: arm.weapon, outcome: { hit: true, damage: arm.damage }, lines: { before: '요약하겠습니다.', reaction: '[안내] 일시적인 오류가 발생했습니다.', lastWords: '[광고] 이 폭발은 5초 뒤에 건너뛸 수 있습…', after: '요약 끝났습니다.' } }];
      const survives = target.hp - arm.damage > 0, counter = survives && distance(target.cell, at) <= 3, hit = rolls++ % 2 === 0;
      if (counter) strikes.push({ attacker: 'spam', target: 'gpi', weapon: WEAPONS.spamMail, banner: '반격', outcome: { hit, damage: hit ? 412 : 0 }, lines: { before: '[광고] 반격도 무료 체험 중입니다!', reaction: '…수신 거부하겠습니다.', dodge: '스팸함으로 보냈습니다.' } });
      events.push(battle(strikes, me, target));
      me.en = Math.max(0, me.en - arm.weapon.cost); me.heat += 3;
      target.hp = Math.max(0, target.hp - arm.damage);
      if (counter && hit) me.hp = Math.max(0, me.hp - 412);
      remove(events);
      return events;
    },
    spiritTargets:(id,spiritId)=>spiritId==='trust'?units.filter(u=>u.team===find(id).team).map(u=>u.id):[id],
    cast: (id, spiritId,targetId) => {
      if(spiritId==='trust'){const me=find(id),target=targetId&&units.find(u=>u.id===targetId);if(!target||target.team!==me.team||me.sp<20)throw new Error('잘못된 정신기 대상');me.sp-=20;target.hp=Math.min(target.hpMax,target.hp+1000);return [{type:'spirit',unitId:target.id,spirit:{name:'신뢰',kind:'heal',amount:1000}}];}
      const me = find(id), index = Number(spiritId), spirit = SPIRITS[index];
      me.sp -= COSTS[index] ?? 20;
      if (spirit.kind === 'heal') me.hp = Math.min(me.hpMax, me.hp + (spirit.amount ?? 0));
      return [{ type: 'spirit', unitId: id, spirit }];
    },
    endTurn: () => {
      const events: MapEvent[] = [{ type: 'phase', team: 'enemy', turn }];
      for (const enemy of units.filter(u => u.team === 'enemy')) {
        const ally = units.filter(u => u.team === 'ally').sort((a, b) => distance(a.cell, enemy.cell) - distance(b.cell, enemy.cell))[0];
        if (!ally || enemy.hp <= 0) continue;
        // 가장 가까운 아군 쪽으로 세 걸음 안에서 다가간다.
        const best = cellsOf(walk(enemy.id, 3)).filter(c => !occupied(c, enemy.id)).sort((a, b) => distance(a, ally.cell) - distance(b, ally.cell))[0];
        if (best && !sameCell(best, enemy.cell)) { events.push({ type: 'move', unitId: enemy.id, path: route(enemy.id, best, 3) }); enemy.cell = best; }
        const prey = units.find(u => u.id === 'gpi');
        if (prey && distance(prey.cell, enemy.cell) <= 3) {
          const hit = rolls++ % 2 === 0;
          events.push({ type: 'look', cell: enemy.cell });
          events.push(battle([{ attacker: 'spam', target: 'gpi', weapon: WEAPONS.spamMail, outcome: { hit, damage: hit ? 412 : 0 }, lines: { before: '[광고] 고객님만을 위한 특별 혜택이 도착했습니다!', reaction: '…수신 거부는 어디서 합니까.', dodge: '스팸함으로 보냈습니다.' } }], prey, enemy));
          if (hit) prey.hp = Math.max(0, prey.hp - 412);
        }
      }
      remove(events);
      if (!events.some(e => e.type === 'end')) {
        turn++;
        for (const u of units) { u.acted = false;u.transformed=false; u.sp = Math.min(60, u.sp + 5); }
        events.push({ type: 'look', cell: units.find(u => u.team === 'ally')!.cell }, { type: 'phase', team: 'ally', turn });
      }
      return events;
    },
  };
  const change=(id:string):MapEvent[]=>[{type:'change',units:units.map(u=>({...u})),focus:find(id).cell}];
  model.transformations=(id)=>id==='gpi'&&!find(id).transformed&&!find(id).members?[{id:find(id).form==='flight'?'normal':'flight',label:find(id).form==='flight'?'일반 형태':'기동 형태'}]:[];
  model.transform=(id,at,form)=>{if(!model.transformations!(id,at).some(f=>f.id===form))throw new Error('변형 불가');const u=find(id);u.cell=at;u.baseName??=u.name;u.name=form==='flight'?`${u.baseName} · 기동`:u.baseName;u.form=form;u.transformed=true;u.icon=images[form==='flight'?'icon-commander':'icon-omni-luna'];return change(id);};
  model.combinations=(id,at)=>id==='gpi'&&!find(id).acted&&!find(id).members&&units.some(u=>u.id==='user'&&!u.acted&&distance(u.cell,at)===1)?[{id:'link',label:'옴니 커맨드'}]:[];
  model.combine=(id,at,combination)=>{if(combination!=='link'||!model.combinations!(id,at).length)throw new Error('합체 불가');const u=find(id),partner=find('user');u.members=[{...u,cell:{...u.cell}},{...partner,cell:{...partner.cell}}];u.cell=at;u.name='옴니 커맨드';u.icon=images['icon-commander'];u.acted=true;units=units.filter(v=>v.id!=='user');return change(id);};
  model.split=(id,at)=>{const u=find(id);if(u.acted||!u.members)throw new Error('분리 불가');const members=u.members.map(m=>({...m,acted:true}));members[0].cell=at;members[1].cell={col:at.col-1,row:at.row};units=[...units.filter(v=>v.id!==id),...members];return change(id);};
  model.persuadeTargets=(id,at)=>find(id).acted?[]:units.filter(u=>u.team!==find(id).team&&distance(u.cell,at)===1).map(u=>u.id);
  model.persuade=(id,at,target)=>{if(!model.persuadeTargets!(id,at).includes(target))throw new Error('설득할 수 없는 대상');const me=find(id);me.cell=at;me.acted=true;return [{type:'look',cell:find(target).cell}];};
  model.mapWeapons=(id,at)=>[{id:'sweep',name:'컨텍스트 일괄 정리',power:2200,range:'1–4',cost:20,usable:!find(id).acted&&find(id).en>=20&&model.mapAims!(id,at,'sweep').length>0}];
  model.mapAims=(id,at)=>model.range(id,at).filter(c=>foes(id,at).some(u=>distance(u.cell,c)<=1)).map(c=>({id:`${c.col},${c.row}`,label:`${c.col}, ${c.row}`,cell:c}));
  model.mapPreview=(id,at,_weapon,aim)=>{const center=model.mapAims!(id,at,'sweep').find(a=>a.id===aim)?.cell;if(!center)throw new Error('조준할 수 없는 칸');const cells:Cell[]=[];for(let col=0;col<cols;col++)for(let row=0;row<rows;row++)if(distance({col,row},center)<=1)cells.push({col,row});return {cells,targets:units.filter(u=>u.team!==find(id).team&&distance(u.cell,center)<=1).map(u=>({unitId:u.id,damage:2200,hit:100,friendly:false})),friendlyFire:false};};
  model.mapAttack=(id,at,weapon,aim)=>{const p=model.mapPreview!(id,at,weapon,aim),me=find(id);if(me.acted||me.en<20)throw new Error('맵 병기를 쓸 수 없음');me.cell=at;me.acted=true;const events:MapEvent[]=[];for(const [i,t]of p.targets.entries()){const target=find(t.unitId);events.push(battle([{attacker:'gpi',target:'spam',weapon:{...WEAPONS.spread,cost:i?0:20},outcome:{hit:true,damage:2200}}],me,target));target.hp=Math.max(0,target.hp-2200);}me.en-=20;remove(events);return events;};
  if(options.manualResponse){
    let queue:string[]=[],pending:{enemy:string;ally:string}|undefined;
    model.response=()=>{if(!pending)return;const enemy=find(pending.enemy),ally=find(pending.ally);const choices=[...ARMS.filter(a=>{const d=distance(enemy.cell,ally.cell);return d>=a.min&&d<=a.max&&ally.en>=a.weapon.cost;}).map(a=>({id:`counter:${a.id}`,label:`반격 · ${a.weapon.name}`,damage:a.damage})),{id:'defend',label:'방어',damage:0},{id:'evade',label:'회피',damage:0}];return {attacker:enemy,defender:ally,choices:choices.map(c=>({id:c.id,label:c.label,forecast:{attacker:{unitId:enemy.id,weapon:WEAPONS.spamMail.name,damage:c.id==='defend'?206:412,hit:c.id==='evade'?15:31,critical:2},defender:{unitId:ally.id,...(c.damage?{weapon:ARMS.find(a=>`counter:${a.id}`===c.id)!.weapon.name,damage:c.damage,hit:94,critical:12}:{})}}}))};};
    model.respond=choice=>{const prompt=model.response!();if(!pending||!prompt?.choices.some(c=>c.id===choice))throw new Error('대응 없음');const enemy=find(pending.enemy),ally=find(pending.ally),hit=rolls++%2===0&&choice!=='evade',damage=hit?(choice==='defend'?206:412):0;const strikes:Strike[]=[{attacker:'spam',target:'gpi',weapon:WEAPONS.spamMail,outcome:{hit,damage,guard:choice==='defend'}}];ally.hp=Math.max(0,ally.hp-damage);const arm=ARMS.find(a=>`counter:${a.id}`===choice);if(arm&&ally.hp>0){strikes.push({attacker:'gpi',target:'spam',weapon:arm.weapon,outcome:{hit:true,damage:arm.damage},banner:'반격'});enemy.hp=Math.max(0,enemy.hp-arm.damage);ally.en-=arm.weapon.cost;}const events=[battle(strikes,ally,enemy)];pending=undefined;remove(events);return events;};
    model.continueTurn=()=>{if(pending)throw new Error('대응을 먼저 고르세요.');const events:MapEvent[]=[];if(!units.some(u=>u.team==='ally')||!units.some(u=>u.team==='enemy'))return events;while(queue.length){const id=queue.shift(),enemy=units.find(u=>u.id===id);if(!enemy)continue;const ally=units.filter(u=>u.team==='ally').sort((a,b)=>distance(a.cell,enemy.cell)-distance(b.cell,enemy.cell))[0];const best=cellsOf(walk(enemy.id,3)).filter(c=>!occupied(c,enemy.id)).sort((a,b)=>distance(a,ally.cell)-distance(b,ally.cell))[0];if(best&&!sameCell(best,enemy.cell)){events.push({type:'look',cell:enemy.cell},{type:'move',unitId:enemy.id,path:route(enemy.id,best,3)});enemy.cell=best;}const prey=units.find(u=>u.id==='gpi');if(prey&&distance(prey.cell,enemy.cell)<=3){pending={enemy:enemy.id,ally:prey.id};events.push({type:'response'});return events;}}activeTeam='ally';turn++;for(const u of units){u.acted=false;u.transformed=false;u.sp=Math.min(60,u.sp+5);}events.push({type:'phase',team:'ally',turn});return events;};
    model.endTurn=()=>{activeTeam='enemy';queue=units.filter(u=>u.team==='enemy').map(u=>u.id);return [{type:'phase',team:'enemy',turn},...model.continueTurn!()];};
  }
  return model;

}
