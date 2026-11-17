import {readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {engineDir,packDir,studioDir} from './paths.mjs';
const here=new URL('.',import.meta.url),read=n=>JSON.parse(readFileSync(new URL(n,here),'utf8'));
export const approved=read('anim-plan-approved.json'),colors=read('anim-colors-approved.json');
const planName=w=>w.id.startsWith('v2-combo-')?w.name.replace(/^합체기 · /,''):w.name;
export function applyPlan(weapons,presentation,plan=approved,palette=colors){
 const byName=new Map(plan.plans.map(p=>[p.name,p])),powers=new Map();
 for(const w of weapons){const name=planName(w),a=powers.get(name)??[];if(!a.includes(w.power))a.push(w.power);powers.set(name,a.sort((a,b)=>a-b));}
 const sidecar=structuredClone(presentation),missing=[];
 for(const w of weapons){const p=byName.get(planName(w));if(!p){missing.push({id:w.id,name:w.name});continue;}if(p.skip==='support')continue;
  const row=sidecar[w.id]??{},levels=powers.get(planName(w)),rank=levels.indexOf(w.power),tier=levels.length===1?1:1+Math.round(2*rank/(levels.length-1));
  sidecar[w.id]={...row,anim:{template:'sequence',moves:structuredClone(p.moves),element:p.element,closer:p.closer,tier,color:palette[w.id]??row.anim?.color??'#ffd23f'}};
  if(w.finisher||row.cutin||row.anim?.template==='finisher')sidecar[w.id].cutin=true;
 }
 if(missing.length)throw Error('unassigned weapon names: '+JSON.stringify(missing));return sidecar;
}
/** Report plan-induced collisions without changing the approved artistic assignment. */
export function assignmentIssues(weapons,mechs,plan=approved){
 const wm=new Map(weapons.map(w=>[w.id,w])),pm=new Map(plan.plans.map(p=>[p.name,p])),issues=[];
 const check=(id,ids)=>{const rows=ids.map(id=>({id,w:wm.get(id)})).filter(r=>r.w).map(r=>({...r,p:pm.get(r.w.name)})).filter(r=>r.p?.moves?.length);
  for(const kind of ['first','pair']){const groups=new Map();for(const r of rows){const m=r.p.moves[0],key=m.move+(kind==='pair'?':'+(m.prop??''):''),g=groups.get(key)??[];g.push(r.id);groups.set(key,g);}for(const[key,ids]of groups)if(ids.length>1)issues.push({mech:id,kind,key,weapons:ids,names:ids.map(id=>wm.get(id).name)});}};
 for(const m of mechs){check(m.id,m.weapons);for(const f of m.forms??[])if(f.weapons)check(m.id+'/'+f.id,f.weapons);}
 return issues;
}
async function main(){
 if(process.argv.includes('--stdin')){const {weapons,sidecar}=JSON.parse(readFileSync(0,'utf8'));process.stdout.write(JSON.stringify(applyPlan(weapons,sidecar)));return;}
 const source=join(studioDir,'docs/studio/beta-audit/weapon-anim-plan.json');
 // The source is optional in a public sample; the committed snapshot is its authority there.
 try{const original=JSON.parse(readFileSync(source,'utf8'));if(JSON.stringify(original)!==JSON.stringify(approved))throw Error('approved animation plan differs from studio source');}catch(e){if(e.code!=='ENOENT')throw e;}
 const data=JSON.parse(readFileSync(join(packDir,'data/weapons.json'),'utf8')),old=JSON.parse(readFileSync(join(packDir,'weapons.json'),'utf8')),next=applyPlan(data,old);
 const {sequenceIssues}=await import(pathToFileURL(join(engineDir,'src/v2/battle/moves/catalog.ts')));
 for(const[id,w]of Object.entries(next))if(w.anim.template==='sequence'){const errors=sequenceIssues(w.anim);if(errors.length)throw Error(id+': '+errors.join('; '));}
 if(process.argv.includes('--check')){if(JSON.stringify(next)!==JSON.stringify(old))throw Error('animation assignment mismatch; run node tools/apply_anim_plan.mjs');}
 else writeFileSync(join(packDir,'weapons.json'),JSON.stringify(next,null,2)+'\n');
 const issues=assignmentIssues(data,JSON.parse(readFileSync(join(packDir,'data/mechs.json'),'utf8')));
 console.log(`animation plan ${process.argv.includes('--check')?'check':'apply'}: ${data.length} weapons, ${approved.plans.length} names, ${issues.length} approved-plan collisions (reported, unchanged)`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();
