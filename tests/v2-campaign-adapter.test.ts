import { describe, expect, it } from 'vitest';
import { previewUpgrade, upgradeMech, equipPart, unequipPart } from '@engine/src/campaign/intermission';
import { makeSave, restoreSave, SAVE_VERSION } from '@engine/src/campaign/saves';
import oldV4 from './fixtures/m9-2-save-v4.json';
import {storageKey} from '@engine/src/platform/storage';
import { normalizeSettings, settingsKey } from '@engine/src/platform/settings';
import { campaign, intermission } from './v2-campaign-fixtures';

describe('v2 campaign adapter', () => {
  it('projects and purchases exactly the native upgrade result', async () => {
    const { model } = await campaign(); intermission(model);
    const p = previewUpgrade(model.session, model.content, 'gpi', 'hp'), expected = upgradeMech(model.session, model.content, 'gpi', 'hp');
    expect(model.upgradeUnits().find(u => u.id === 'gpi')!.stats[0]).toMatchObject({ level: p.from, cost: p.cost, value: p.before.hp, next: p.after.hp });
    expect(model.upgrade('gpi', 'hp')).toBe(true); expect(model.session).toEqual(expected);
    model.session.campaign.credits = 0; const before = structuredClone(model.session); expect(model.upgrade('gpi', 'hp')).toBe(false); expect(model.session).toEqual(before);
  });
  it('uses native part inventory exchange including unequip', async () => {
    const { model } = await campaign(); intermission(model);
    let expected = equipPart(model.session, model.content, 'gpi', 0, 'hull');
    expect(model.equip('gpi', 0, 'hull')).toBe(true); expect(model.session).toEqual(expected);
    expected = unequipPart(model.session, model.content, 'gpi', 0); expect(model.equip('gpi', 0, null)).toBe(true); expect(model.session).toEqual(expected);
  });
  it('validates the explicitly separate v2 shop transaction; no native shop exists', async () => {
    const { model } = await campaign(); intermission(model); const item = model.shop()[0], money = model.funds(), count = item.owned;
    expect(model.buy(item.id, 2)).toBe(true); expect(model.funds()).toBe(money - item.price! * 2); expect(model.inventory().find(p => p.id === item.id)!.owned).toBe(count + 2);
    const before = structuredClone(model.session);
    for (const n of [-1, 0, 0.5, 100, NaN]) expect(model.buy(item.id, n)).toBe(false);
    expect(model.buy('missing', 1)).toBe(false); expect(model.session).toEqual(before);
  });
  it('rejects the old v4 fixture and writes only the current format',async()=>{const {model,bytes,saves}=await campaign();expect(()=>restoreSave(oldV4,model.data,model.content)).toThrow('저장 버전');const raw=JSON.stringify(oldV4);await bytes.replace('1',raw);await saves.refresh();expect(saves.slots.find(s=>s.id==='1')?.status).toBe('unreadable');await expect(model.load('1')).rejects.toThrow();expect(await bytes.read('1')).toBe(raw);await model.save('2');expect(JSON.parse((await bytes.read('2'))!).saveVersion).toBe(SAVE_VERSION);});
  it('round-trips both new battle and intermission saves with native validation', async () => {
    const { model } = await campaign(); let before = structuredClone(model.session);
    await model.save('1'); await model.load('1'); expect(makeSave(model.session, model.data, 0, '2026-11-10T00:00:00Z')).toEqual(makeSave(before, model.data, 0, '2026-11-10T00:00:00Z'));
    intermission(model); model.session.game = null; before = structuredClone(model.session);
    await model.save('2'); await model.load('2'); expect(model.session).toEqual(before);
  });
  it('preserves old settings and persists new controls separately', async () => {
    const { model, bytes } = await campaign(); bytes.setItem(settingsKey(model.data.id), JSON.stringify({ volume: 3, grid: false, textSpeed: 'fast', animation: 'allies' }));
    model.setSettings({ sfx: 4, music: 2, speed: 3, animation: 'off', shake: 0 });
    const old = normalizeSettings(JSON.parse(bytes.getItem(settingsKey(model.data.id))!));
    expect(old).toMatchObject({ volume: 4, grid: false, textSpeed: 'fast', animation: 'off' });
    expect(model.settings()).toEqual({ cinematic:true, sfx: 4, music: 2, speed: 3, animation: 'off', shake: 0 });
    model.setSettings({...model.settings(),cinematic:false});
    expect(model.settings().cinematic).toBe(false);
    expect(bytes.getItem(storageKey(model.data.id,'settings'))).toContain('\"cinematic\":false');
  });
});
