/** 시드별 실제 캠페인 결과를 합쳐 경로별 전체 균형 기준을 검사한다. */
import {readFile,writeFile,mkdir} from './files.mjs';
import assert from 'node:assert/strict';
const args=process.argv.slice(2),arg=(n,d)=>{const i=args.indexOf('--'+n);return i<0?d:args[i+1];};
const root=arg('root','tools/out/mechanics'),pack=arg('pack','saw');assert.match(pack,/^[\w-]+$/);
const game=JSON.parse(await readFile(`content/packs/${pack}/game.json`,'utf8')),ids=game.episodes.map(e=>e.id),modes=arg('hidden','both')==='both'?['joined','none']:[arg('hidden')];
let total=0;
for(const mode of modes){
 const rows=[],endings=[];
 for(const seed of [1,7,19]){const dir=`${root}/${mode}-seed-${seed}`;const part=JSON.parse(await readFile(`${dir}/simulation.json`,'utf8')),ends=JSON.parse(await readFile(`${dir}/simulation-endings.json`,'utf8'));assert.equal(part.length,ids.length*4);assert.ok(part.every(r=>r.seed===seed&&r.hidden===mode));rows.push(...part);endings.push(...ends);}
 assert.equal(new Set(rows.map(r=>[r.episode,r.seed,r.line,r.type].join('/'))).size,ids.length*12);assert.ok(rows.every(r=>ids.includes(r.episode)&&[1,7,19].includes(r.seed)&&['real','super'].includes(r.line)&&['O','M'].includes(r.type)&&r.outcome==='victory'));
 assert.equal(endings.length,12);assert.equal(new Set(endings.map(r=>[r.seed,r.line,r.type].join('/'))).size,12);assert.ok(endings.every(e=>e.hidden===mode&&e.credits&&e.title&&e.ending));
 const summary=Object.fromEntries(ids.map(id=>{const xs=rows.filter(r=>r.episode===id),v={count:xs.length,mean:xs.reduce((n,r)=>n+r.turn,0)/xs.length,min:Math.min(...xs.map(r=>r.turn)),max:Math.max(...xs.map(r=>r.turn))};assert.equal(xs.length,12);assert.ok(v.mean>=5&&v.mean<=12&&v.max<=15,`${mode}/${id}: ${JSON.stringify(v)}`);return[id,v];}));
 const out=`${root}/final-${mode}`;await mkdir(out,{recursive:true});for(const[file,value]of [['simulation.json',rows],['simulation-endings.json',endings],['simulation-summary.json',summary]])await writeFile(`${out}/${file}`,JSON.stringify(value,null,2)+'\n');
 total+=rows.length;console.log(`${mode}: ${rows.length}전투, 12캠페인, 각 화 평균5~12·최대15, 엔딩→크레딧→타이틀 통과`);
}
console.log(`PASS: ${total}전투 통합 행렬`);
