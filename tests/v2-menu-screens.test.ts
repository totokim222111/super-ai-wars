import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from '../tools/files.mjs';
import { UpgradeScreen } from '@engine/src/v2/menus/screens';
import { PartsScreen } from '@engine/src/v2/menus/parts';
import { PilotScreen } from '@engine/src/v2/menus/pilots';
import { ShopScreen } from '@engine/src/v2/menus/shop';
import { SaveScreen } from '@engine/src/v2/menus/saves';
import { SettingsScreen } from '@engine/src/v2/menus/settings';
import { ResultScreen } from '@engine/src/v2/menus/result';
import { CreditsScreen } from '@engine/src/v2/menus/credits';
import { NewGameScreen } from '@engine/src/v2/menus/new-game';
import { MenuList, TextField, Slider, Toggle } from '@engine/src/v2/kit';
import { Screen } from '@engine/src/v2/screen';
import { campaign, intermission, MenuApp, flush, yes } from './v2-campaign-fixtures';
class Parent extends Screen { enter() {} }
function start(screen: Screen) { const app = new MenuApp(), parent = new Parent(); app.push(parent); app.push(screen); return { app, parent }; }

describe('v2 menus with real kit/input/Runner and a headless app', () => {
  it('upgrades with confirmation and returns via cancel', async () => {
    const { model } = await campaign(); intermission(model); const { app, parent } = start(new UpgradeScreen(model)); const money = model.funds();
    app.action('confirm'); app.action('confirm'); yes(app); expect(model.funds()).toBeLessThan(money);
    app.action('cancel'); expect(app.top).toBe(parent);
  });
  it('equips and unequips a part through unit/slot/inventory menus', async () => {
    const { model } = await campaign(); intermission(model); const { app, parent } = start(new PartsScreen(model));
    app.action('confirm'); app.action('confirm');const inv=app.top.ui.focus as MenuList;inv.index=inv.items.findIndex(i=>i.label===model.inventory().find(p=>p.id==='hull')!.name);app.action('confirm'); yes(app);
    expect(model.partUnits()[0].slots[0]?.id).toBe('hull');
    const held=(app.top.ui as unknown as {widgets:MenuList[]}).widgets.find(w=>w instanceof MenuList&&w.items.some(i=>i.label==='해제'))!;held.index=0;app.top.ui.focusOn(held,true);app.action('confirm');yes(app);expect(model.partUnits()[0].slots[0]).toBe(null);
    app.action('cancel'); expect(app.top).toBe(parent);
  });
  it('buys a chosen quantity and supports touch settings controls', async () => {
    const { model } = await campaign(); intermission(model); const { app, parent } = start(new ShopScreen(model));
    const money = model.funds(), item = model.shop()[0]; app.action('confirm'); app.action('right'); app.action('down'); app.action('confirm'); yes(app);
    expect(model.funds()).toBe(money - item.price! * 2); app.action('cancel'); expect(app.top).toBe(parent);
    app.push(new SettingsScreen(model));const slider=(app.top.ui as any).widgets.find((w:any)=>w instanceof Slider&&w.label==='효과음') as Slider;
    app.top.input({ kind: 'pointer', phase: 'down', x:slider.x+slider.w-236,y:slider.y+slider.h/2 }); app.top.input({ kind: 'pointer', phase: 'up', x:slider.x+slider.w-236,y:slider.y+slider.h/2 });
    expect(model.settings().sfx).toBe(9);
    app.action('down');app.action('down');expect(app.top.ui.focus).toBeInstanceOf(Toggle); app.action('confirm'); expect(model.settings().animation).toBe('off');
    app.action('cancel'); expect(app.top).toBe(parent);
  });
  it('saves then loads through confirmation and asynchronous native storage', async () => {
    const { model } = await campaign(); intermission(model); model.session.game = null;
    const { app, parent } = start(new SaveScreen(model, 'save')); app.action('confirm'); yes(app); await flush();
    expect(model.slots().find(s=>s.id!=='suspend'&&s.id!=='auto')!.available).toBe(true); app.action('cancel'); expect(app.top).toBe(parent);
    const money = model.funds(); model.session.campaign.credits = 0;
    app.push(new SaveScreen(model, 'load')); app.action('confirm'); yes(app); await flush(); expect(model.funds()).toBe(money); app.action('cancel'); expect(app.top).toBe(parent);
  });
  it('finishes new game with a Korean name, M and super, and cancels each earlier step', async () => {
    const { model } = await campaign(); let done = false;
    const { app, parent } = start(new NewGameScreen(model, () => { done = true; }));
    expect(app.top.ui.focus).toBeInstanceOf(TextField); (app.top.ui.focus as TextField).accept('한글');
    app.action('down'); app.action('confirm'); app.action('down'); app.action('confirm'); app.action('down'); app.action('confirm'); app.action('confirm'); yes(app);
    expect(done).toBe(true); expect(model.session.campaign.persona).toBe('menhera'); expect(model.session.campaign.player?.name).toBe('한글'); expect(model.session.campaign.flags['player-super']).toBe(true);
    app.action('cancel'); app.action('cancel'); app.action('cancel'); app.action('cancel'); expect(app.top).toBe(parent);
  });
  it('opens pilot and credits pages with cancel, and result with continue', async () => {
    const { model } = await campaign(); intermission(model);
    for (const screen of [new PilotScreen(model), new CreditsScreen(model)]) { const { app, parent } = start(screen); app.action('cancel'); expect(app.top).toBe(parent); }
    let done = false; const { app } = start(new ResultScreen(model, () => { done = true; })); app.tick(90); app.action('confirm'); expect(done).toBe(true);
  });
  it('keeps DOM and input hit testing out of menu/game screens, with standard back controls', () => {
    for (const dir of ['menus', 'game']) for (const name of readdirSync(`src/v2/${dir}`).filter(n => n.endsWith('.ts'))) {
      const source = readFileSync(`src/v2/${dir}/${name}`, 'utf8');
      expect(source).not.toMatch(/addEventListener|document\.|new Button\(['"]뒤로/);
      if (/onBack|onCancel|askTitle/.test(source)) expect(source).toMatch(/menuFrame|setNavigation/);
    }
  });
  it('preserves existing MenuList pagination when many rows are present', () => {
    const app = new MenuApp(), screen = new Parent(); app.push(screen);
    const list = screen.ui.add(new MenuList(Array.from({ length: 20 }, (_, i) => ({ label: String(i) })), () => {}, { w: 400, rows: 4 }));
    expect(list.h).toBe(4*52+20+76); for (let i = 0; i < 7; i++) app.action('down'); expect(list.index).toBe(7);
  });
  it('reflows opt-in dynamic lists when items grow or shrink', () => {
    const app = new MenuApp(), screen = new Parent(); app.push(screen);
    const list = screen.ui.add(new MenuList([], () => {}, { w: 400, rows: 2, dynamic: true }));
    expect(list.h).toBe(2*52+20); list.setItems(Array.from({ length: 5 }, (_, i) => ({ label: String(i) })));
    expect(list.h).toBe(2*52+20+76); list.setItems([{ label: 'one' }]); expect(list.h).toBe(2*52+20);
  });

});
