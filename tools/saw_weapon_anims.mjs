import {packDir,sampleDir} from './paths.mjs';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
// 수치 파일은 읽기만 한다. 같은 입력은 언제나 같은 배정을 만든다.
import { readFile, writeFile,mkdir } from './files.mjs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const HEROINE_LINES = ['gpi', 'gem', 'claude', 'grok', 'deepseek', 'sonnet', 'exaone', 'qwen'];
const templates = ['slash-combo', 'rapid-fire', 'beam', 'missile-salvo', 'heavy-shot', 'punch-rush', 'charge-ram', 'funnel', 'artillery', 'spread-shot', 'word-slam', 'finisher'];
const colors = ['#7fe9f7', '#ffb454', '#c799ff', '#ff68ad', '#8cffe3', '#ffe275'];
const hash = text => Array.from(text).reduce((n, c) => (n * 31 + c.codePointAt(0)) >>> 0, 7);
const short = name => name.replace(/\(가칭\)/g, '').replace(/[^가-힣A-Za-z0-9 ]/g, '').trim();
const label = name => Array.from(short(name)).slice(0, 6).join('') || '반려';

export function assignAnimations(weapons, mechs) {
  const byId = new Map(weapons.map(w => [w.id, w])), owners = new Map(), final = new Set();
  const used = new Map(mechs.map(m => [m.id, new Set()]));
  for (const m of mechs) {
    for (const id of m.weapons) { if (!owners.has(id)) owners.set(id, []); owners.get(id).push(m.id); }
    if (HEROINE_LINES.some(line => m.id.startsWith(line + '-generation-'))) {
      const strongest = m.weapons.map(id => byId.get(id)).sort((a, b) => b.power - a.power || (b.en ?? 0) - (a.en ?? 0) || a.id.localeCompare(b.id, 'en'))[0];
      final.add(strongest.id);
    }
  }
  const result = {}, counts = Object.fromEntries(templates.map(t => [t, 0]));
  // 히로인의 최강 무기를 먼저 예약해서 다른 무기가 finisher 자리를 차지하지 않게 한다.
  const order = [...weapons].sort((a, b) => Number(final.has(b.id)) - Number(final.has(a.id)) || a.id.localeCompare(b.id, 'en'));
  for (const w of order) {
    const n = w.name, h = hash(w.id), owner = owners.get(w.id) ?? [];
    const score = Object.fromEntries(templates.map((t, i) => [t, (hash(w.id + t) % 100) / 100 - counts[t] * 0.075 + ((h + i) % 7) * 0.08]));
    const add = (t, points) => { score[t] += points; };
    if (w.kind === 'melee') for (const t of ['slash-combo', 'punch-rush', 'charge-ram']) add(t, 4);
    else for (const t of ['rapid-fire', 'beam', 'missile-salvo', 'heavy-shot', 'funnel', 'artillery', 'spread-shot']) add(t, 2);
    if (w.kind === 'beam') add('beam', 6);
    if (w.kind === 'missile') add('missile-salvo', 6);
    if (w.kind === 'map') for (const t of ['artillery', 'spread-shot', 'missile-salvo']) add(t, 2.5);
    if (w.power >= 3500) { add('heavy-shot', 1); add('beam', 1); }
    if (/검|소드|세이버|참격|칼|채찍/.test(n)) add('slash-combo', 7);
    if (/펀치|주먹|권법|타격|해머/.test(n)) add('punch-rush', 7);
    if (/돌진|충돌|러시|박치기|밀어/.test(n)) add('charge-ram', 7);
    if (/판넬|펀넬|비트|에이전트|드론|스웜/.test(n)) add('funnel', 6);
    if (/미사일|로켓|발사/.test(n)) add('missile-salvo', 6);
    if (/빔|레이저|광선/.test(n)) add('beam', 5);
    if (/발칸|개틀링|연사|연발|총/.test(n)) add('rapid-fire', 5);
    if (/폭격|포격|낙하|위성|업무/.test(n)) add('artillery', 5);
    if (/산탄|살포|확산|분산|영역/.test(n)) add('spread-shot', 4);
    if (/대포|캐논|압축|레일건/.test(n)) add('heavy-shot', 5);
    if (/반려|약관|동의|오류|환각|거절|결론|알림|구독|검열|드립|무료|댓글|추천|사과|논문|케이크/.test(n)) add('word-slam', 5);
    if (/finisher/.test(w.id) && w.power >= 3000) add('finisher', 2.5);
    const available = templates.filter(t => owner.every(id => !used.get(id).has(t)));
    const template = final.has(w.id) ? 'finisher' : available.sort((a, b) => score[b] - score[a] || templates.indexOf(a) - templates.indexOf(b))[0];
    if (!template || owner.some(id => used.get(id).has(template))) throw new Error('같은 기체의 틀 중복: ' + w.id);
    owner.forEach(id => used.get(id).add(template)); counts[template]++;
    const color = colors[h % colors.length], words = short(n).split(/\s+/).filter(Boolean).map(s => Array.from(s).slice(0, 3).join(''));
    const strength = Math.min(1, w.power / 6000);
    const values = {
      'slash-combo': { hits: 3, words: /기승전결/.test(n) ? ['기', '승', '전'] : words.slice(0, 3), finisher: true, finisherWord: /기승전결/.test(n) ? '결' : words.at(-1) ?? '' },
      'rapid-fire': { rows: 3, shots: 4, labels: /세 줄/.test(n) ? ['1.', '2.', '3.'] : words.slice(0, 3) },
      beam: { width: Math.round(30 + strength * 38), ticks: 4, charge: 0.55 },
      'missile-salvo': { count: 4 + h % 3 },
      'heavy-shot': { size: Math.round(20 + strength * 18), charge: 0.65 },
      'punch-rush': { hits: 4, words: words.slice(0, 4) },
      'charge-ram': { charge: 0.85 }, funnel: { count: 4 + h % 3 }, artillery: { count: 2 + h % 2 },
      'spread-shot': { count: 5 + h % 3, spread: 160 + h % 80 },
      'word-slam': { text: label(n), size: 180 }, finisher: { hits: 3, width: Math.round(95 + strength * 35), text: label(n) },
    }[template];
    result[w.id] = { template, color, ...values };
  }
  return Object.fromEntries(weapons.map(w => [w.id, result[w.id]]));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = pathToFileURL(join(packDir,'data')+'/');
  const [weapons, mechs] = await Promise.all(['weapons', 'mechs'].map(async name => JSON.parse(await readFile(new URL(name + '.json', root), 'utf8'))));
  const anims = assignAnimations(weapons, mechs);
  await mkdir(join(sampleDir,'tools/out'),{recursive:true});await writeFile(join(sampleDir,'tools/out/weapon-anims.json'), JSON.stringify(anims, null, 2) + '\n');
  console.log(JSON.stringify(Object.fromEntries(templates.map(t => [t, Object.values(anims).filter(a => a.template === t).length])), null, 2));
}
