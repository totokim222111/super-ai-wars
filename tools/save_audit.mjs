/** Validation replay, not a balance judgment. Every checkpoint uses the real writer/loader. */
import {strict as assert} from 'node:assert';
import {mkdir,writeFile} from 'node:fs/promises';
export function createSaveAudit(model,pack,{makeSave,TrainingSaves},directory,{checkpointsOnly=false}={}){
 const rows=new Map(),failures=[],pending=[];let ordinal=0;
 const capture=(label,session=model.session)=>{
  const stage=session.game?.battle.stage.id??session.screen;
  const row=rows.get(stage)??{stage,checks:0,passed:0,failed:0,commands:{},events:{}};rows.set(stage,row);row.checks++;
  const kind=label.split(':')[0],type=label.split(':')[1];if(kind==='command')row.commands[type]=(row.commands[type]??0)+1;if(kind==='event')row.events[type]=(row.events[type]??0)+1;
  const index=++ordinal;let file;
  const operation=(async()=>{
   file=makeSave(session,model.data,0,'2026-11-15T00:00:00.000Z');
   const values=new Map(),storage={read:async id=>values.get(id)??null,replace:async(id,bytes)=>{values.set(id,bytes);}};
   const saves=new TrainingSaves(storage,model.data,model.content,pack.training);
   await saves.write('suspend',file);
   const loaded=await saves.load('suspend');
   assert.deepEqual(makeSave(loaded.session,model.data,0,file.savedAt),file,'save/load must preserve the canonical complete session');
   row.passed++;
  })().catch(error=>{row.failed++;const item={stage,label,index,error:String(error),lastCommand:file?.battle?.commands?.at(-1)};if(!failures.some(f=>f.stage===stage&&f.error===item.error)){failures.push(item);if(file)pending.push(mkdir(directory,{recursive:true}).then(()=>writeFile(directory+'/failure-'+stage+'.json',JSON.stringify({item,file},null,2))));}});
  pending.push(operation);
 };
 const accept=model.acceptBattle.bind(model);if(!checkpointsOnly)model.acceptBattle=(state,changes)=>{
  accept(state,changes);
  const g=model.session.game;
  for(const c of changes){
   const session={...model.session,game:{...g,battle:c.after,mode:c.after.pending?'response':c.after.outcome?'outcome':'idle',selected:null,target:null,weapon:null,before:null,clips:[]}};
   capture('command:'+c.command.type,session);
   for(const e of c.events)capture('event:'+e.type,session);
  }
  if(!changes.length)capture('state',model.session);
 };
 const flush=async()=>{while(pending.length)await Promise.all(pending.splice(0));};
 const finish=async()=>{await flush();await mkdir(directory,{recursive:true});const report={checks:ordinal,rows:[...rows.values()],failures};await writeFile(directory+'/save-audit.json',JSON.stringify(report,null,2)+'\n');return report;};
 return{capture,flush,finish};
}
