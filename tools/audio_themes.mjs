/** SAW presentation metadata only. Source stories and battle rules are never written. */
import {engineDir,packDir,sampleDir,studioDir} from './paths.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const json=async path=>JSON.parse(await readFile(path,'utf8')),save=(path,data)=>writeFile(path,JSON.stringify(data,null,2)+'\n');
const game=await json(join(packDir,'game.json')),cast=await json(join(packDir,'cast.json')),players=await json(join(packDir,'players.json')),audio=await json(join(packDir,'audio/pack.json'));
const {createServer}=await import(pathToFileURL(join(engineDir,'node_modules/vite/dist/node/index.js')));
const {packSources,readSource}=await import(pathToFileURL(join(engineDir,'tools/pack-sources.ts')));process.env.PACK_DIR=packDir;
const server=await createServer({root:engineDir,configFile:false,optimizeDeps:{noDiscovery:true,entries:[]},server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'silent'});
try{
 const {loadPack}=await server.ssrLoadModule('/src/v2/pack/load.ts'),source=(await packSources())[0],p=await loadPack(source.root,path=>readSource([source],path),undefined,{gallery:false,examples:false});assert.deepEqual(p.errors,[]);
 const expected=structuredClone(game),actors=structuredClone(cast),rules=expected.musicRules,slots=rules.slots;
 const agents={gpi:'theme-gpi','saw-gem':'theme-gem',claude:'theme-claude',grok:'theme-grok',deepseek:'theme-deepseek',sonnet:'theme-sonnet',exaone:'theme-exaone',qwen:'theme-qwen','qwen-axis':'theme-qwen','qwen-yandere':'theme-qwen','qwen-megadere':'theme-qwen'};
 const rivals=['saw-midjourney','saw-sd','llama','muse','mistral','hyperclova-x','glm','kimi','minimax'];
 for(const [id,theme]of Object.entries(agents)){assert(actors[id],id);actors[id].theme=theme;actors[id].themePriority=1;actors[id].enemyTheme='theme-rival';actors[id].enemyThemePriority=60;slots['theme-'+id]=theme;slots['rival-'+id]='theme-rival';}
 for(const preset of players.presets){actors[preset.cast].theme='theme-player';actors[preset.cast].themePriority=1;slots['theme-'+preset.cast]='theme-player';}
 actors['saw-dots'].theme='theme-gpi';actors['saw-dots'].themePriority=1;
 for(const id of rivals){assert(actors[id],id);actors[id].theme='theme-rival';actors[id].themePriority=60;slots['theme-'+id]='theme-rival';}
 for(const [id]of Object.entries(audio.bgm))delete slots[id]; // Physical tracks cannot also alias older placeholders.
 Object.assign(slots,{'battle-opening':'battle-intro-jingle','story-calm':'story-daily','story-comic':'story-daily','story-briefing':'story-daily','story-tense':'story-mystery','story-sad':'story-memory','story-hope':'story-resolve'});
 expected.music.upgrade='screen-upgrade';rules.battleOpening={slot:'battle-intro-jingle',seconds:audio.bgm['battle-intro-jingle'].frames/audio.bgm['battle-intro-jingle'].sampleRate};
 const oldTags=rules.story.sceneTags??{},missing=[],assignments=[];
 const mood=(name,cues,old=[])=>{
  if(/패배|이별|작별|추억|기억/.test(name))return['memory','장면 이름: 회상·상실'];
  if(/승리|합류|화해|결의|출격|결전|각성|엔딩/.test(name))return['resolve','장면 이름: 결의·전진'];
  if(/조우|피코|유물|가면|쇼거스|특이점|전조|폭주|위기|보스|흑막|경고|탐색/.test(name))return['mystery','장면 이름: 정체·위험·탐색'];
  const text=cues.filter(c=>c.do==='say').slice(0,6).map(c=>c.text).join(' ');
  if(/추억|그립|외로|슬프|작별|과거|잊지 않/.test(text))return['memory','첫 대화의 회상·상실 키워드'];
  if(/각오|결의|지켜내|끝내겠|희망|함께 가|출격/.test(text))return['resolve','첫 대화의 결의·희망 키워드'];
  if(/정체|의문|수상|비밀|봉인|유물|암호|흑막/.test(text))return['mystery','첫 대화의 미스터리 키워드'];
  if((old.includes('sad')||old.includes('memory')))return['memory','기존 슬픔 태그'];if((old.includes('hope')||old.includes('resolve')))return['resolve','기존 희망 태그'];if((old.includes('tense')||old.includes('mystery')))return['mystery','기존 긴장 태그'];
  return['daily','일상·정비·기본 장면'];
 };
 const hasMusic=c=>c.do==='music'||c.do==='typed'&&hasMusic(c.cue)||c.do==='choice'&&c.choices.some(ch=>ch.effects.some(hasMusic));
 const sceneTags={};for(const ep of game.episodes)for(const[name,cues]of Object.entries(p.stories[ep.id].scenes)){
  const key=ep.id+':'+name,[tag,reason]=mood(name,cues,oldTags[key]),slot='story-'+tag;sceneTags[key]=[tag];const row={episode:ep.id,scene:name,slot,reason,authored:cues.some(hasMusic)};assignments.push(row);if(!row.authored)missing.push(row);
 }
 rules.story={...rules.story,default:'story-daily',tags:{...rules.story.tags,calm:'story-daily',comic:'story-daily',briefing:'story-daily',tense:'story-mystery',sad:'story-memory',hope:'story-resolve',daily:'story-daily',mystery:'story-mystery',resolve:'story-resolve',memory:'story-memory'},sceneTags};
 const counts=Object.fromEntries(['daily','mystery','resolve','memory'].map(tag=>['story-'+tag,missing.filter(r=>r.slot==='story-'+tag).length]));assert(Object.values(counts).every(n=>n>0));assert.equal(missing.filter(r=>!r.scene.startsWith('__grok_absent_')).length,230);
 if(process.argv.includes('--check')){assert.deepEqual(game.musicRules,expected.musicRules,'musicRules assignments');assert.deepEqual(game.music,expected.music,'screen music');for(const id of Object.keys(actors))for(const key of ['theme','themePriority','enemyTheme','enemyThemePriority'])assert.equal(cast[id][key],actors[id][key],id+'/'+key);console.log(`음악 자리·주인공/에이전트/라이벌·무지시 ${missing.length}장면 배정 대조 완료 `+JSON.stringify(counts));}
 else{
  await save(join(packDir,'game.json'),expected);await save(join(packDir,'cast.json'),actors);
  await save(join(sampleDir,'docs/audio/theme-scenes.json'),{default:'story-daily',counts,assignments:missing});
  const lines=['# 음악 자리와 장면 배정','','기존 13곡과 승인 추가 16곡을 사용한다. 대본의 음악 지시는 아래 기본 배정보다 우선하며 대본 원문은 수정하지 않는다.','','## 승인 추가 16곡','','| 자리 | 곡 | 길이(초) | MP3 크기(KiB) | 루프·가장자리 |','|---|---|---:|---:|---|'];
  const selection=await json(join(sampleDir,'docs/audio/selection.json')),conversion=await json(join(sampleDir,'docs/audio/mp3-conversion.json'));
  for(const [id,row]of Object.entries(selection.bgm).filter(([,r])=>r.approved.startsWith('T'))){const e=audio.bgm[id],file=conversion.find(c=>c.id===id),mode=id==='battle-intro-jingle'?'반복 없음':row.processing.loopSource?'제공 루프판 전체 유지':'전체 곡, 끝 0.75초 페이드';lines.push(`| ${id} | ${e.title} | ${(e.frames/e.sampleRate).toFixed(3)} | ${(file.bytes/1024).toFixed(1)} | ${mode} |`);}
  lines.push('','## 인물·화면 규칙','','주인공 O·M은 theme-player, 닷츠는 지피 기체의 theme-gpi, 퀜의 세 비녀 모드는 theme-qwen이다. 라이벌 9명과 적대 에이전트는 theme-rival(우선순위 60), 그 밖의 보스는 기존 boss(50), 피코 계열은 기존 lastboss(100)를 유지한다. 개조는 screen-upgrade, 전투 시작은 battle-intro-jingle 전체 1.9795초 후 선택 테마로 잇는다. 징글은 연출 끄기·건너뛰기에서 새로 재생하지 않는다.','','## 나머지 자리','','| 자리/별칭 | 현재 곡 |','|---|---|');
  for(const[k,v]of Object.entries(slots))lines.push(`| ${k} | ${v} |`);
  lines.push('',`## 음악 지시 없는 장면 ${missing.length}개 (원래230 + 미합류 분기)`,'','기본은 story-daily다. 장면 이름과 첫 대화의 분위기 키워드로 mystery/resolve/memory를 고른다. 직접 음악 지시가 있는 138장면의 곡은 유지한다. 배정은 game.musicRules.story.sceneTags에 있고 재생 규칙은 공통 엔진을 쓴다.','',...Object.entries(counts).map(([id,n])=>`- ${id}: ${n}장면`),'','| 화 | 장면 | 배정 | 근거 |','|---|---|---|---|',...missing.map(r=>`| ${r.episode} | ${r.scene.replaceAll('|','\\|')} | ${r.slot} | ${r.reason} |`));
  await writeFile(join(studioDir,'docs/studio/audio-slots.md'),lines.join('\n')+'\n');
  console.log('음악 배정 완료 '+JSON.stringify(counts));
 }
}finally{await server.close();}
