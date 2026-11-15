import {engineDir,packDir,sampleDir,storyDir} from './paths.mjs';
import {join} from 'node:path';
/** Workshop-only source contract check; never called by engine build/test. */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const json=async name=>JSON.parse(await readFile(name,'utf8'));
const model=await json(join(storyDir,'mechs/spec-v1/model.json'));
const extensions=await readFile(join(storyDir,'mechs/spec-v1/extensions.md'),'utf8');
const keys={mechs:'id name hp en armor mobility move moveType size adapt weapons partSlots costClass exp credits forms aiForm enRecovery subPilots cheerHp devices hpRecovery pilotOverrides allyStats',weapons:'id name kind power en ammo range hit crit postMove moraleReq adapt anim icon map finisher fixedPower special',pilots:'id name stats sp adapt growth spGrowth spirits skills aiSpirits startMorale faces character hostProgress statCurves'};
const data={};
for(const [name,allowed]of Object.entries(keys)){
 const rows=data[name]=await json(join(packDir,`data/${name}.json`));
 assert(rows.length&&new Set(rows.map(r=>r.id)).size===rows.length,'SAW 수치 id 오류: '+name);
 for(const row of rows){assert.match(row.id,/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);for(const key of Object.keys(row))assert(allowed.split(' ').includes(key),`${name}/${row.id}: 미구현 필드 ${key}`);}
}
const expected=[...model.ally,...model.enemy,...model.autoUnits];
for(const unit of expected){assert(data.mechs.some(m=>m.id===unit.id),'원본 기체 누락: '+unit.id);if(unit.pilotId)assert(data.pilots.some(p=>p.id===unit.pilotId),'원본 파일럿 누락: '+unit.pilotId);for(const weapon of [unit.main,unit.finisher,unit.support].filter(Boolean))assert(data.weapons.some(w=>w.id===weapon),'원본 무장 누락: '+weapon);}
assert(extensions.includes('|'),'SAW 확장 계약 없음');
console.log(execFileSync(process.execPath,[join(engineDir,'tools/pack_check.mjs')],{encoding:'utf8',cwd:engineDir,env:{...process.env,PACK_DIR:packDir}}).trim());
console.log(execFileSync('python',['-X','utf8',join(sampleDir,'tools/port_carbon.py'),'--check'],{encoding:'utf8'}).trim());
const audit={counts:Object.fromEntries(Object.entries(data).map(([name,rows])=>[name,rows.length])),sourceUnits:expected.length,extensions:extensions.split('\n').filter(l=>l.startsWith('| ')).length};
await mkdir('tools/out/split',{recursive:true});await writeFile('tools/out/split/saw-check.json',JSON.stringify(audit,null,2)+'\n');
console.log('SAW 원본 수치·허용 필드·대본 계약 확인');
