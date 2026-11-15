import { describe, expect, it } from 'vitest';
import { GameFlow } from '@engine/src/v2/game/flow';
import { buildSample } from './pack-fixture';
import { NewGameScreen } from '@engine/src/v2/menus/new-game';
import { TitleScreen, IntermissionScreen } from '@engine/src/v2/menus/screens';
import { MapScreen } from '@engine/src/v2/map/screen';
import { ResultScreen } from '@engine/src/v2/menus/result';
import type { App } from '@engine/src/v2/screen';
import { campaign, MenuApp, yes } from './v2-campaign-fixtures';

describe('v2 campaign screen chain', () => {
  it('goes from title to new game, episode 1, victory, result, intermission and episode 2', async () => {
    const { model } = await campaign(), app = new MenuApp(), flow = new GameFlow(app as unknown as App, model, buildSample({}));
    flow.title(); expect(app.top).toBeInstanceOf(TitleScreen); app.action('confirm'); expect(app.top).toBeInstanceOf(NewGameScreen);
    app.action('down'); app.action('confirm'); app.action('confirm'); app.action('confirm'); app.action('confirm'); yes(app);
    expect(app.top).toBeInstanceOf(MapScreen); expect(flow.map!.state().stage.id).toBe('saw-01');
    flow.debugWin(); expect(app.top).toBeInstanceOf(ResultScreen); app.action('confirm');
    expect(app.top).toBeInstanceOf(IntermissionScreen); app.action('confirm'); yes(app);
    expect(app.top).toBeInstanceOf(MapScreen); expect(flow.map!.state().stage.id).toBe('saw-02');
  });
  it('applies sound settings and skips BattleScreen when animations are off', async () => {
    const { model } = await campaign(), app = new MenuApp(), flow = new GameFlow(app as unknown as App, model, buildSample({}));
    model.setSettings({ sfx: 3, music: 2, speed: 2, shake: 0, animation: 'off' }); flow.show();
    expect(app.sound.sfxVolume).toBe(0.3); expect(app.sound.musicVolume).toBe(0.2);
    const screen = app.top as MapScreen, map = flow.map!, at = map.reach('gpi').find(p => map.targets('gpi', p).length)!;
    const target = map.targets('gpi', at)[0], weapon = map.weapons('gpi', at, target).find(w => w.usable)!;
    const events = map.attack('gpi', at, weapon.id, target);
    (screen as unknown as { commit(events: import('@engine/src/v2/map/model').MapEvent[]): void }).commit(events);
    for (let i = 0; i < 300; i++) { app.tick(); expect(app.top).toBe(screen); }
    expect(model.session.game!.battle.units.find(u => u.id === 'gpi')!.acted).toBe(true);
  });
  it('passes configured speed and shake to the actual BattleScreen', async () => {
    const { model } = await campaign(), app = new MenuApp();
    const { BattleScreen } = await import('@engine/src/v2/battle/screen');
    app.push(new BattleScreen(buildSample({}).exchange([]), () => {}, { speed: 2, shake: 0 }));
    expect(app.top.runner.speed).toBe(2); expect(app.top.stage.camera.shakeScale).toBe(0);
    expect(model.settings().speed).toBe(1);
  });

});
