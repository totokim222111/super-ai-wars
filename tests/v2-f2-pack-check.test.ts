import {it,expect} from 'vitest';
import {readFile} from '../tools/files.mjs';
import {loadPack,validatePack} from '@engine/src/v2/pack/load';
it('warns for missing objectives and rejects incorrect form references and anchors',async()=>{const p=await loadPack('content/packs/saw',path=>readFile(path,'utf8'));expect(p.errors).toEqual([]);p.errors=[];p.warnings=[];delete p.game.episodes[0].objectives;p.units['gpi-generation-1'].forms={missing:{icon:'missing',anchors:{core:[-1,2]}}};validatePack(p);expect(p.warnings.some(w=>w.kind==='작전 목표'&&w.file.endsWith('game.json'))).toBe(true);expect(p.errors.map(e=>e.message)).toEqual(expect.arrayContaining([expect.stringContaining('없는 변형 형태'),expect.stringContaining('없는 형태 그림'),expect.stringContaining('형태 기준점 범위 오류')]));});
