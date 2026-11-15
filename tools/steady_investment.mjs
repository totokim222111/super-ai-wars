/** Spend only earned campaign credits/points; never grant money, levels or parts. */
export function investSteadily(model) {
 const before=model.funds(),purchases=[],training=[];
 const weight={weapons:2,hp:1,armor:1,mobility:1,en:.6};
 for(let n=0;n<5000;n++){
  const candidates=model.upgradeUnits().flatMap(u=>u.stats.filter(s=>s.level<s.max&&s.cost>0&&s.cost<=model.funds()).map(s=>({unit:u.id,...s,priority:s.level/weight[s.id]}))).sort((a,b)=>a.priority-b.priority||a.cost-b.cost||a.unit.localeCompare(b.unit));
  const next=candidates.find(c=>model.upgrade(c.unit,c.id));if(!next)break;
  purchases.push({unit:next.unit,stat:next.id,from:next.level,cost:next.cost});
 }
 // Earned learning points are separate from credits. Reach the action threshold,
 // then balance accuracy, damage and survival rather than leave points unused.
 for(const u of model.session.campaign.roster){
  for(let n=0;n<1000;n++){
   const info=model.training(u.id);if(!info)break;
   const stats=info.stats.filter(s=>s.cost!==undefined&&s.cost<=info.points);
   stats.sort((a,b)=>(a.id==='skill'&&a.value<130?-1000:a.cost)-(b.id==='skill'&&b.value<130?-1000:b.cost)||a.id.localeCompare(b.id));
   const next=stats.find(s=>model.train(u.id,s.id));if(!next)break;
   training.push({unit:u.id,stat:next.id,cost:next.cost});
  }
 }
 // Equip existing rewards only; do not buy parts or add inventory.
 for(const u of model.session.campaign.roster){const slots=model.content.mechs.find(m=>m.id===u.mechId)?.partSlots??0;
  for(let slot=0;slot<slots;slot++){if(u.parts?.[slot])continue;const part=model.session.campaign.parts[0];if(part)model.equip(u.id,slot,part);}
 }
 return {before,spent:before-model.funds(),remaining:model.funds(),purchases,training};
}
