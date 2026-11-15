import type {MenuList} from '@engine/src/v2/kit';
import { describe, expect, it } from 'vitest';
import { MapScreen } from '@engine/src/v2/map/screen';
import { BattleScreen } from '@engine/src/v2/battle/screen';
import { ConfirmScreen } from '@engine/src/v2/dialogs';
import type { MapModel, Cell } from '@engine/src/v2/map/model';
import type { Board } from '@engine/src/v2/map/board';
import { HeadlessApp, makeCore, makeMock, origin, firingMove } from './v2-map-fixtures';
const mode = (screen: MapScreen) => (screen as unknown as { mode: { kind: string } }).mode.kind;
const board = (screen: MapScreen) => (screen as unknown as { board: Board }).board;
const setup = (model: MapModel) => {
  const app = new HeadlessApp(), screen = new MapScreen(model); app.push(screen); app.tick(100);
  return { app, screen, model };
};
function command(app: HeadlessApp, screen: MapScreen, model: MapModel, at: Cell) {
  app.chooseCell(origin(model, 'gpi')); expect(mode(screen)).toBe('move');
  app.chooseCell(at); app.until(() => mode(screen) === 'command');
}
function toForecast(app: HeadlessApp, screen: MapScreen, model: MapModel) {
  const firing = firingMove(model);
  command(app, screen, model, firing.at);
  app.action('confirm'); expect(mode(screen)).toBe('target');
  app.action('confirm'); expect(mode(screen)).toBe('weapon');
  const weapons = model.weapons('gpi', firing.at, firing.target), index = weapons.findIndex(w => w.id === firing.weapon.id);
  for (let i = 0; i < index; i++) app.action('down');
  app.action('confirm'); expect(mode(screen)).toBe('forecast');
  return firing;
}

describe.each([['mockMap', makeMock], ['actual SAW rules', makeCore]] as const)('MapScreen without DOM: %s', (_name, make) => {
  it('그림 준비 중 받은 사건은 enter 뒤에 재생한다',()=>{
    const app=new HeadlessApp(),screen=new MapScreen(make(),{phaseMusic:t=>t==='enemy'?'enemy-phase':'map'});
    expect(()=>screen.present([{type:'phase',team:'enemy',turn:1}])).not.toThrow();
    app.push(screen);app.tick(200);expect(screen.music).toBe('enemy-phase');expect(mode(screen)).toBe('idle');
  });
  it('selects unit → destination → command → target → weapon → forecast and pushes the real BattleScreen', () => {
    const { app, screen, model } = setup(make()); toForecast(app, screen, model);
    app.action('confirm'); app.until(() => app.top instanceof BattleScreen);
    expect(app.top).toBeInstanceOf(BattleScreen);
    app.until(() => app.top === screen && mode(screen) === 'idle');
    expect(model.units().find(u => u.id === 'gpi')!.acted).toBe(true);
  });
  it('cancels each step and returns the uncommitted unit to its original cell', () => {
    const { app, screen, model } = setup(make()), original = structuredClone(model.units()), from = origin(model, 'gpi');
    toForecast(app, screen, model);
    for (const next of ['weapon', 'target', 'command', 'move', 'idle']) { app.action('cancel'); expect(mode(screen)).toBe(next); }
    expect(model.units()).toEqual(original);
    const feet = board(screen).feet('gpi'), center = board(screen).center(from);
    expect(feet).toEqual({ x: center.x, y: center.y + 34 });
  });
  it('returns from spirits to commands and from the map menu to idle', () => {
    const { app, screen, model } = setup(make());
    command(app, screen, model, origin(model, 'gpi'));
    app.action('down'); app.action('confirm'); expect(mode(screen)).toBe('spirit');
    app.action('cancel'); expect(mode(screen)).toBe('command');
    app.action('cancel'); app.action('cancel'); expect(mode(screen)).toBe('idle');
    app.chooseCell({ col: 0, row: 0 }); expect(mode(screen)).toBe('menu');
    app.action('cancel'); expect(mode(screen)).toBe('idle');
  });
  it('waits, then completes an enemy phase and returns to player turn 2', () => {
    const { app, screen, model } = setup(make());
    command(app, screen, model, origin(model, 'gpi'));
    app.action('down'); app.action('down'); app.action('confirm');
    app.until(() => app.top === screen && mode(screen) === 'idle');
    expect(model.units().find(u => u.id === 'gpi')!.acted).toBe(true);
    app.chooseCell({ col: 0, row: 0 }); const menu=screen.ui.focus as MenuList;menu.index=menu.items.findIndex(i=>i.label==='턴 종료');app.action('confirm');
    expect(app.top).toBeInstanceOf(ConfirmScreen);
    app.action('left'); app.action('confirm');
    app.until(() => app.top === screen && mode(screen) === 'idle');
    expect(model.turn()).toEqual({ team: 'ally', number: 2 });
    expect(model.units().filter(u => u.team === 'ally').every(u => !u.acted)).toBe(true);
  });
});
