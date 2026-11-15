import oldAnimations from './fixtures/shipped-weapon-anims.json';
import oldAnchors from '../pack/art/anchors.json';
import { readFile } from '../tools/files.mjs';
import { describe, it, expect, beforeAll } from 'vitest';
import { loadPack, packLookup, packActors, validatePack, type Pack } from '@engine/src/v2/pack/load';
import { content } from './pack-fixture';
import { sawLookup } from './pack-fixture';
import { buildSample } from './pack-fixture';
let pack: Pack;
beforeAll(async () => { pack = await loadPack('content/packs/saw', p => readFile(p, 'utf8')); });
describe('v2 content pack', () => {
    it('reads SAW without errors and preserves the original rules/save identity', () => { expect(pack.errors).toEqual([]); for (const key of ['mechs', 'pilots', 'weapons'] as const) for (const item of content[key]) expect(pack.rules[key]).toContainEqual(item); expect('legacyCampaign'in pack).toBe(false);expect(Object.keys(pack.campaign.stages)).toHaveLength(15); expect(Object.keys(pack.weapons).length).toBeGreaterThanOrEqual(700); });
    it('reproduces existing unit images, anchors and weapon templates', () => { const images = Object.fromEntries(Object.keys(pack.game.art.files).map(id => [id, { id } as unknown as HTMLImageElement])); const sample = buildSample(images), old = sawLookup(sample), lookup = packLookup(pack, images); const b = pack.campaign.stages['saw-01'].stage; for (const u of b.units) {
        const m = pack.rules.mechs.find(m => m.id === u.mechId)!;
        expect(lookup.unit(m, u as never)).toEqual(old.unit(m, u as never));
        expect(lookup.battle.mech(m, u as never)).toEqual(old.battle.mech(m, u as never));
    } for (const w of pack.rules.weapons.filter(w => pack.weapons[w.id]&&!w.id.startsWith('v2-combo-')))
        expect(lookup.battle.weapon(w, {} as never)).toEqual(old.battle.weapon(w, {} as never)); expect(packActors(pack, images).gpi.faces?.default).toBe(images[pack.cast.gpi.bust!]); for (const [id, w] of Object.entries(pack.weapons))
        if (id in oldAnimations) expect(w.anim).toEqual((oldAnimations as Record<string, unknown>)[id]); for (const [id, art] of [['clickbait-drone-episode-1', 'mech-clickbait-sd']]) {
        const old = (oldAnchors as Record<string, Record<string, unknown>>)[art];
        expect(pack.units[id].anchors).toEqual(Object.fromEntries(Object.entries(old).filter(([, v]) => Array.isArray(v))));
    } expect(pack.units['player-real-generation-1'].art).toBe('mech-player-real-generation-1');expect(pack.units['player-real-generation-1'].temporary).toBeUndefined(); });
    it('warns about missing moods at the exact appended source lines',async()=>{const original=await readFile('content/packs/saw/story/ep01.story','utf8'),start=original.split('\n').length;const p=await loadPack('content/packs/saw',async path=>path.endsWith('cast.json')?JSON.stringify((c=>{delete c.gpi.moodSheet;c.gpi.moods={};delete c.gpi.battleLines;return c;})(JSON.parse(await readFile(path,'utf8')))):path.endsWith('game.json')?JSON.stringify((g=>{delete g.battleDialogue;return g;})(JSON.parse(await readFile(path,'utf8')))):path.endsWith('ep01.story')?original+'\n@ 표정 검사\n[타입 O] [등장] gpi 왼쪽 angry\n[타입 M] gpi(sad): 안녕':readFile(path,'utf8'));expect(p.errors).toEqual([]);expect(p.warnings.filter(w=>w.kind==='사용 표정'&&w.file.endsWith('ep01.story')&&w.line>start).map(w=>w.line)).toEqual([start+2,start+3]);});
    it('reports exact files and fields for broken ids, parameters and anchor bounds', () => { const bad = structuredClone(pack); bad.errors = []; bad.warnings = []; bad.units.missing = { art: 'no-image', anchors: { core: [1.2, -.1] } }; bad.weapons.missing = { anim: { template: 'beam', width: 'wrong' } as never }; validatePack(bad); expect(bad.errors.map(e => e.message)).toEqual(expect.arrayContaining([expect.stringContaining('없는 기체 id: missing'), expect.stringContaining('기준점 범위 오류'), expect.stringContaining('없는 그림 id'), expect.stringContaining('없는 무기 id'), expect.stringContaining('틀 값 오류')])); expect(bad.errors.every(e => e.file.endsWith('.json') && e.line > 0 && e.fix)).toBe(true); });
    it('reports missing art, anchors, each standard mood and animations independently', () => { const bad = structuredClone(pack); bad.errors = []; bad.warnings = []; bad.cast.gpi.moods = {}; delete bad.cast.gpi.moodSheet; delete bad.cast.gpi.bust;delete bad.units['gpi-generation-1'].art;delete bad.units['gpi-generation-1'].anchors; delete bad.weapons['gpi-generation-1-weapon-1']; validatePack(bad); expect(bad.warnings.filter(w => w.kind === '표정' && w.message.startsWith('gpi:'))).toHaveLength(10); for (const kind of ['기체 그림', '인물 그림', '기준점', '무기 연출'])
        expect(bad.warnings.some(w => w.kind === kind)).toBe(true); });
});
