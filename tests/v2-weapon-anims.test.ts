import { describe, expect, it } from 'vitest';
import { readFileSync } from '../tools/files.mjs';
import { execFileSync } from 'node:child_process';
import allWeapons from '../pack/data/weapons.json';
import allMechs from '../pack/data/mechs.json';
import assignments from './fixtures/weapon-anims.json';
import { TEMPLATES } from '@engine/src/v2/battle/templates';
import type { WeaponAnim } from '@engine/src/v2/battle/types';

const anims: Record<string, WeaponAnim> = assignments;
const weapons=allWeapons.filter(w=>w.id in anims),mechs=allMechs.map(m=>({...m,weapons:m.weapons.filter(id=>id in anims)})).filter(m=>m.weapons.length);
const arrays = new Set(['words', 'labels']), strings = new Set(['color', 'text', 'finisherWord']);
const headers = Object.fromEntries(Object.keys(TEMPLATES).map(name => {
  const header = readFileSync(new URL(`../src/v2/battle/templates/${name}.ts`, import.meta.url), 'utf8').split('*/')[0].split(' * 값')[1];
  return [name, [...header.matchAll(/^ \*   (\w+)\s/gm)].map(m => m[1])];
}));

describe('SAW animation sidecar', () => {
  it('assigns every weapon once with registered templates and parameter types documented in headers', () => {
    expect(Object.keys(anims).sort()).toEqual(weapons.map(w => w.id).sort()); expect(weapons).toHaveLength(700);
    for (const w of weapons) {
      const a = anims[w.id]; expect(TEMPLATES[a.template], w.id).toBeDefined();
      for (const [key, value] of Object.entries(a)) {
        if (key === 'template') continue;
        expect(headers[a.template], `${w.id}.${key}`).toContain(key);
        if (arrays.has(key)) { expect(Array.isArray(value)).toBe(true); expect((value as unknown[]).every(v => typeof v === 'string')).toBe(true); }
        else if (strings.has(key)) expect(typeof value).toBe('string');
        else if (key === 'finisher') expect(typeof value).toBe('boolean');
        else { expect(typeof value).toBe('number'); expect(Number.isFinite(value)).toBe(true); expect(value as number).toBeGreaterThan(0); }
      }
    }
  });
  it('uses different templates within every mech, including shared weapons', () => {
    for (const m of mechs) expect(new Set(m.weapons.map(id => anims[id].template)).size, m.id).toBe(m.weapons.length);
  });
  it('gives each heroine form its strongest weapon a finisher', () => {
    const heroines = /^(gpi|gem|claude|grok|deepseek|sonnet|exaone|qwen)-generation-/;
    for (const m of mechs.filter(m => heroines.test(m.id))) {
      const max = Math.max(...m.weapons.map(id => weapons.find(w => w.id === id)!.power));
      expect(m.weapons.some(id => weapons.find(w => w.id === id)!.power === max && anims[id].template === 'finisher'), m.id).toBe(true);
    }
  });
  it('uses every template without concentrating most weapons in one, and gives puns actual lettering', () => {
    for (const t of Object.keys(TEMPLATES)) {
      const count = Object.values(anims).filter(a => a.template === t).length;
      expect(count).toBeGreaterThan(0); expect(count).toBeLessThan(140);
    }
    expect(anims['gpi-generation-1-weapon-1']).toMatchObject({ template: 'rapid-fire', labels: ['1.', '2.', '3.'] });
    expect(anims['gpi-generation-1-weapon-2']).toMatchObject({ template: 'slash-combo', words: ['기', '승', '전'], finisherWord: '결' });
    expect(Object.values(anims).filter(a => a.template === 'word-slam').every(a => typeof a.text === 'string' && a.text.length > 0)).toBe(true);
  });
  it('new utility weapons have registered presentation templates without replacing the historical 700',()=>{const current=JSON.parse(readFileSync('content/packs/saw/weapons.json','utf8'));for(const w of allWeapons.filter(w=>w.id.startsWith('zako-special-')))expect(TEMPLATES[current[w.id].anim.template]).toBeDefined();});
  // Preserve authored animation parameters while numeric balance overlays change power.
  it('reproduces the entire file without writing or changing numeric content', () => {
    const generated = execFileSync(process.execPath, ['--input-type=module', '-e',
      "import {assignAnimations} from './tools/saw_weapon_anims.mjs'; import {readFileSync} from './tools/files.mjs'; const read=n=>JSON.parse(readFileSync('content/packs/saw/data/'+n+'.json','utf8'));const anims=JSON.parse(readFileSync('tests/fixtures/weapon-anims.json','utf8'));const proposal=JSON.parse(readFileSync('tools/balance-v2-approved.json','utf8')).proposal,baseline=new Map(proposal.weapons.map(w=>[w.id,w.new]));const renamed=JSON.parse(readFileSync('tools/enemy-weapons-approved.json','utf8')).index;const weapons=read('weapons').filter(w=>w.id in anims).map(w=>({...w,...baseline.get(w.id),name:renamed[w.id]?.currentName??w.name})),mechs=read('mechs').map(m=>({...m,weapons:m.weapons.filter(id=>id in anims)})).filter(m=>m.weapons.length); process.stdout.write(JSON.stringify(assignAnimations(weapons,mechs)));"], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
    expect(JSON.parse(generated)).toEqual(assignments);
  });
});
