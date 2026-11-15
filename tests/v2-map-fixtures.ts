import { expect } from 'vitest';
import type { BattleState } from '@engine/src/core';
import { CoreMap, type MapLookup } from '@engine/src/v2/adapter/map';
import { sawBattle } from './pack-fixture';
import { buildSample } from './pack-fixture';
import { mockMap } from './fixtures/mock-map';
import type { Cell, MapModel } from '@engine/src/v2/map/model';
import type { App, Screen } from '@engine/src/v2/screen';
import type { Action } from '@engine/src/v2/input';

export const lookup: MapLookup = {
  battle: { mech: () => ({ height: 400, faces: 'left' }), pilot: () => ({ portrait: { faces: {}, crop: { x: 0, y: 0, w: 1, h: 1 } } }), weapon: () => ({ anim: { template: 'rapid-fire', rows: 1, shots: 1 } }), side: u => u.side === 'enemy' ? 'enemy' : 'ally' },
  unit: () => ({}), spirit: d => ({ name: d.name, kind: 'focus' }),
};
export const makeCore = (state: BattleState = sawBattle(39)) => new CoreMap(state, lookup);
export const makeMock = () => mockMap(buildSample({}));
export const origin = (model: MapModel, id: string): Cell => model.units().find(u => u.id === id)!.cell;
export function firingMove(model: MapModel, id = 'gpi') {
  const start = origin(model, id);
  const at = model.reach(id).find(at => (at.col !== start.col || at.row !== start.row) && model.targets(id, at).length);
  expect(at, '이동 후 공격 가능한 칸').toBeDefined();
  const target = model.targets(id, at!)[0], weapon = model.weapons(id, at!, target).find(w => w.usable)!;
  expect(weapon).toBeDefined();
  return { at: at!, target, weapon };
}
/** 실제 Screen/Runner/Ui를 쓰되 App의 캔버스·입력 연결만 가짜로 한다. */
export class HeadlessApp {
  readonly sound = { play() {}, music() {} };
  readonly stack: Screen[] = [];
  get top(): Screen { return this.stack[this.stack.length - 1]; }
  push(screen: Screen): void { screen.app = this as unknown as App; this.stack.push(screen); screen.enter(); }
  pop(): void { this.stack.pop(); this.top?.resume(); }
  tick(frames = 1): void { for (let i = 0; i < frames; i++) this.top?.update(1 / 60); }
  action(action: Action): void { this.top.input({ kind: 'action', action }); }
  until(done: () => boolean, frames = 12000): void { for (let i = 0; i < frames && !done(); i++) this.tick(); expect(done()).toBe(true); }
  chooseCell(at: Cell): void {
    const board = this.top.ui.focus;
    expect(board && 'cursor' in board).toBe(true);
    const cursor = (board as unknown as { cursor: Cell }).cursor;
    for (let i = cursor.col; i < at.col; i++) this.action('right');
    for (let i = cursor.col; i > at.col; i--) this.action('left');
    const row = (board as unknown as { cursor: Cell }).cursor.row;
    for (let i = row; i < at.row; i++) this.action('down');
    for (let i = row; i > at.row; i--) this.action('up');
    this.action('confirm');
  }
}
