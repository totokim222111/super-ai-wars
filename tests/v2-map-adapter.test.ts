import { describe, expect, it } from 'vitest';
import { apply, availableActions, availableWeapons, effectiveMech, forecast, nextAICommand, pathTo, reachable, restore, snapshot, weaponRange } from '@engine/src/core';
import type { BattleEvent, BattleState } from '@engine/src/core';
import type { MapEvent } from '@engine/src/v2/map/model';
import { sawBattle } from './pack-fixture';
import { makeCore, firingMove, origin } from './v2-map-fixtures';
import { m6 } from './core/m6-helpers';
const cell = (p: { x: number; y: number }) => ({ col: p.x, row: p.y });

function project(before: BattleState, raw: BattleEvent[]): string[] {
  const types: string[] = []; let battle = false;
  for (const e of raw) {
    if (!battle && raw.some(e => e.type === 'attack') && ['response', 'support', 'attack', 'map-attack'].includes(e.type)) { types.push('battle'); battle = true; }
    if (e.type === 'move') { if (before.units.find(u => u.id === e.unitId)!.side === 'enemy') types.push('look'); types.push('move'); }
    if (e.type === 'unit-defeated') types.push('defeat');
    if (e.type === 'phase-start') types.push('phase');
    if (e.type === 'outcome') types.push('end');
    if (e.type === 'system' && ['spawn', 'reinforce'].includes(e.action.kind)) types.push(...e.ids.map(() => 'spawn'));
    if (e.type === 'spirit') types.push(...e.targetIds.map(() => 'spirit'));
  }
  const boundary=types.findIndex(t=>t==='phase'||t==='end');types.splice(boundary<0?types.length:boundary,0,'status');
  return types;
}
function assertViews(model: ReturnType<typeof makeCore>, state: BattleState) {
  expect(model.units().map(u => ({ id: u.id, hp: u.hp, en: u.en, cell: u.cell, acted: u.acted, heat: u.heat }))).toEqual(state.units.filter(u => u.alive && !u.removed).map(u => ({ id: u.id, hp: u.hp, en: u.en, cell: cell(u), acted: u.acted, heat: u.morale })));
}

describe('SAW actual-core MapModel', () => {
  it('uses core movement costs, routes, flying and occupied cells without mutating input', () => {
    const state = sawBattle(31), original = snapshot(state), model = makeCore(state);
    for (const u of state.units) {
      expect(model.reach(u.id)).toEqual(reachable(state, u.id).map(cell));
      for (const p of reachable(state, u.id).slice(0, 10)) expect(model.route(u.id, cell(p))).toEqual(pathTo(state, u.id, p)!.map(cell));
    }
    expect(snapshot(state)).toBe(original);
    const flying = m6((c, stage) => {
      c.mechs[0].moveType = ['air']; c.terrain[0].moveCost.ground = 4;
      stage.map.tiles[2][2] = c.terrain[0].id;
    });
    expect(makeCore(flying).reach('p1')).toEqual(reachable(flying, 'p1').map(cell));
    expect(makeCore(flying).route('p1', { col: 3, row: 2 })).toEqual([]); // enemy occupies it
  });
  it('uses the actual moved state for commands, weapon conditions, coverage and forecast', () => {
    const state = sawBattle(39), model = makeCore(state), { at, target, weapon } = firingMove(model);
    const moved = apply(state, { type: 'move', unitId: 'gpi', x: at.col, y: at.row }).state;
    const actions = availableActions(moved, 'gpi');
    expect(model.targets('gpi', at)).toEqual([...new Set(actions.filter(c => c.type === 'attack').map(c => c.targetId))]);
    expect(model.weapons('gpi', at, target).filter(w => w.usable).map(w => w.id)).toEqual(availableWeapons(moved, 'gpi', target).map(w => w.id));
    const coverage = new Set(availableWeapons(moved, 'gpi').filter(w => !w.map).flatMap(w => weaponRange(moved, 'gpi', w.id).map(p => `${p.x},${p.y}`)));
    expect(new Set(model.range('gpi', at).map(c => `${c.col},${c.row}`))).toEqual(coverage);
    const f = forecast(moved, 'gpi', target, weapon.id), view = model.forecast('gpi', at, weapon.id, target);
    expect(view.attacker).toMatchObject({ hit: f.hitRate, critical: f.critRate, damage: Math.round(f.expectedDamage) });
    const response = f.response;
    expect(view.defender.weapon).toBe(response.type === 'counter' ? state.content.weapons.find(w => w.id === response.weaponId)!.name : undefined);
    expect(model.save()).toBe(snapshot(state));
  });
  it('disables non-P weapons after moving and rejects invalid commits transactionally', () => {
    const state = sawBattle(39); state.content.weapons.find(w => w.id === 'gpi-generation-1-weapon-1')!.postMove = false;
    const model = makeCore(state), { at, target } = firingMove(model), saved = model.save();
    expect(model.weapons('gpi', at, target).find(w => w.id === 'gpi-generation-1-weapon-1')!.usable).toBe(false);
    expect(() => model.attack('gpi', at, 'gpi-generation-1-weapon-1', target)).toThrow('non-P');
    expect(model.save()).toBe(saved);
  });
  it('plays several actual turns in core event order and matches HP, positions and action completion', () => {
    let state = sawBattle(77); const model = makeCore(state);
    const replay = new Map(model.units().map(u => [u.id, { hp: u.hp, cell: u.cell, acted: u.acted }]));
    function events(events: MapEvent[]) {
      for (const e of events) {
        if (e.type === 'move') replay.get(e.unitId)!.cell = e.path.at(-1)!;
        if (e.type === 'spawn') replay.set(e.unit.id, { hp: e.unit.hp, cell: e.unit.cell, acted: e.unit.acted });
        if (e.type === 'defeat') replay.delete(e.unitId);
        if (e.type === 'battle') for (const s of e.exchange.strikes) {
          if (!s.banner) replay.get(s.attacker)!.acted = true;
          if (s.outcome.hit) replay.get(s.cover ?? s.target)!.hp -= s.outcome.damage;
        }
        if (e.type === 'phase' && e.team === 'ally') for (const u of replay.values()) u.acted = false;
      }
    }
    for (let turn = 0; turn < 3 && !state.outcome; turn++) {
      const { at, target, weapon } = firingMove(model);
      const moved = apply(state, { type: 'move', unitId: 'gpi', x: at.col, y: at.row });
      const attacked = apply(moved.state, { type: 'attack', unitId: 'gpi', targetId: target, weaponId: weapon.id });
      const own = model.attack('gpi', at, weapon.id, target);
      expect(own.map(e => e.type)).toEqual([...project(state, moved.events), ...project(moved.state, attacked.events)]);
      state = attacked.state; events(own); assertViews(model, state);
      let r = apply(state, { type: 'endPhase' }), expected = project(state, r.events); state = r.state;
      while (!state.outcome && (state.phase === 'enemy' || state.pending)) {
        const cmd = nextAICommand(state)!; r = apply(state, cmd); expected.push(...project(state, r.events)); state = r.state;
      }
      const enemy = model.endTurn(); expect(enemy.map(e => e.type)).toEqual(expected); events(enemy); assertViews(model, state);
      for (const e of enemy) if (e.type === 'move') {
        const index = enemy.indexOf(e); expect(enemy[index - 1]).toEqual({ type: 'look', cell: e.path[0] });
      }
      // phase/recover/heat/EN do not all have MapEvent fields; final units are authoritative.
      expect([...replay].map(([id, u]) => ({ id, hp: u.hp, cell: u.cell })).sort((a,b) => a.id.localeCompare(b.id)))
        .toEqual(model.units().map(u => ({ id: u.id, hp: u.hp, cell: u.cell })).sort((a,b) => a.id.localeCompare(b.id)));
    }
    expect(model.turn()).toEqual({ team: 'ally', number: 4 });
  }, 30000);
  it('is reproducible for the same seed and after core snapshot/restore', () => {
    const a = makeCore(sawBattle(37)), b = makeCore(sawBattle(37));
    const { at, target, weapon } = firingMove(a);
    expect(a.attack('gpi', at, weapon.id, target)).toEqual(b.attack('gpi', at, weapon.id, target));
    const s = a.state(), restored = makeCore(restore(s.content, s.stage, a.save()));
    expect(a.endTurn()).toEqual(b.endTurn());
    expect(a.save()).toBe(b.save());
    expect(restored.endTurn()).toEqual(makeCore(restore(s.content, s.stage, snapshot(s))).endTurn());
    expect(restored.save()).toBe(a.save());
  }, 30000);
  it('calls core wait/cast and exposes consumable items as executable commands', () => {
    const s = m6(c => { c.mechs[0].forms = [{ id: 'base', name: 'base', overrides: {} }, { id: 'other', name: 'other', overrides: { move: 7 } }]; });
    s.units[0].parts = ['repair-kit']; const model = makeCore(s), at = origin(model, 'p1');
    const commands = model.commands('p1', at);
    expect(commands.find(c=>c.id==='transform')).toBeDefined();expect(model.transformations('p1',at)).toEqual([{id:'other',label:'other'}]);
    expect(commands.find(c => c.id === 'item:0')).toBeDefined();expect(commands.find(c=>c.id==='item:0')?.disabled).not.toBe(true);const itemModel=makeCore(s);expect(itemModel.item('p1',at,0).some(e=>e.type==='notice'||e.type==='spirit')).toBe(false);expect(itemModel.state().units[0].usedItems).toEqual([0]);
    const spirit = model.spirits('p1').find(s => s.usable)!;
    const cast = apply(s, { type: 'spirit', unitId: 'p1', spiritId: spirit.id });
    expect(model.cast('p1', spirit.id).some(e => e.type === 'spirit')).toBe(true); assertViews(model, cast.state);
    expect(model.units().find(u => u.id === 'p1')!.acted).toBe(false);
    const wait = apply(cast.state, { type: 'wait', unitId: 'p1' }); model.wait('p1', at); assertViews(model, wait.state);
  });
  it('emits look before actual enemy AI movement and matches its entire command sequence', () => {
    const initial = m6(), model = makeCore(initial); let state = apply(initial, { type: 'endPhase' }).state;
    while (!state.outcome && (state.phase === 'enemy' || state.pending)) state = apply(state, nextAICommand(state)!).state;
    const events = model.endTurn(), moves = events.filter(e => e.type === 'move');
    expect(moves.length).toBeGreaterThan(0);
    for (const e of moves) expect(events[events.indexOf(e) - 1]).toEqual({ type: 'look', cell: e.path[0] });
    expect(model.save()).toBe(snapshot(state));
  });
  it('places battle before defeat and end; removes the killed unit from views', () => {
    const state = m6(); state.stage.scenario = false;
    state.units.filter(u => u.side === 'enemy' && u.id !== 'e1').forEach(u => { u.alive = false; u.hp = 0; });
    state.units.find(u => u.id === 'e1')!.hp = 1;
    state.units[0].effects.push({ id: 'sure', source: 'test', duration: { unit: 'use', remaining: 1 }, hooks: { modifyHit: { op: 'set', value: 100, role: 'attacker' } } });
    const model = makeCore(state), events = model.attack('p1', { col: 1, row: 2 }, 'blade', 'e1');
    expect(events.map(e => e.type)).toEqual(['battle', 'defeat', 'status', 'end']);
    expect(model.units().some(u => u.id === 'e1')).toBe(false);
  });
  it('translates system reinforcement, forced movement and end, including exact initial reinforcement HP', () => {
    const model = makeCore(), s = model.state(), def = { ...s.stage.units[2], id: 'extra' };
    const events = model.execute({ type: 'system', unitId: '', action: { kind: 'reinforce', units: [def] } });
    expect(events[0]).toMatchObject({ type: 'spawn', unit: { id: 'extra', hp: effectiveMech(model.state(), model.state().units.at(-1)!).hp } });
    expect(model.execute({ type: 'system', unitId: '', action: { kind: 'move', ids: ['extra'], x: 9, y: 8 } }).map(e => e.type)).toEqual(['look', 'move', 'status']);
    const end=model.execute({ type: 'system', unitId: '', action: { kind: 'win' } });expect(end.map(e=>e.type)).toEqual(['status','end']);expect(end.at(-1)).toEqual({type:'end',won:true});
  });
});
