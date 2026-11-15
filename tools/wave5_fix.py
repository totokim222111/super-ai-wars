import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0,str(_Path(__file__).resolve().parent))
from paths import SAMPLE_ROOT, STUDIO_ROOT, ENGINE_DIR, PACK_DIR, STORY_DIR, SOURCE_DIR, ART_SOURCE_DIR, AUDIO_SOURCE_DIR
"""Reviewed Wave 5 corrections. Built-in generation only; keep every original attempt."""
import argparse,hashlib,shutil,subprocess
from pathlib import Path
from PIL import Image,ImageOps
from art_ingest import ROOT,read_json,write_json,ingest,inspect_art,check
from wave5_finish import clean,encode,sheet
WAVE=ART_SOURCE_DIR / 'wave5';OUT=ROOT/'tools/out/wave5/fix';PACK=PACK_DIR
SCENES={
 'claude-liberation':'Keep Claude and her exact own mecha with golden FOUNTAIN-PEN OPUS CANNON, glasses-adjusting gesture, extended open hand, breaking golden geometrical seal, and heroic warm afternoon library plaza. REMOVE the entire wooden cafe tabletop across the foreground. Replace it with the continuous real library PLAZA: perspective stone paving, stone steps, scattered golden seal shards, architecture and her lower costume continuing naturally to the bottom edge. Full scene all the way to every edge. No cafe furniture, no wood stripe, no separate horizontal strip.',
 'sisters-reconcile':'Keep adult Claude emerging from exact mecha hatch on left and adult Sonnet standing on research BALCONY on right, their exact faces, clothes, eye contact and offered hands, warm emotional sunset. REMOVE foreground wooden tabletop and cafe props. The lower area is now continuous hatch armor at left and stone balcony paving, natural skirts and perspective railings at right. The entire scene continues to the bottom edge; no foreground bar, horizontal band or cafe table.',
 'exaone-crescent':'Exaone is an ADULT TWENTY-YEAR-OLD MAN. Preserve his exact plum hair, three-wing hairpin, white/plum costume, crescent smiling eyes, BOTH natural hands covering mouth in surprise, bright exaggerated comedy. Remove all cafe tables, cups, tabletop and cafe seating. He stands in the sunny headquarters ROOFTOP GARDEN. Continue his jacket and scarf naturally to bottom edge, with garden path and planters at sides. The environment and character fill the ENTIRE scene, no repeated wood stripe or foreground band.',
 'ending-qwen-paperboat':'Keep adult Qwen exact lavender hair, hairpins, blue-white porcelain dress, teddy bear, shy smile turning back, and releasing blank paper boat into lake at golden sunset. Remove the entire straight wooden tabletop/bar crossing foreground. Recompose at lakeside stone steps beside a pavilion: real lake WATER and ripples continue to bottom-right edge, natural stone step and draping dress extend to bottom-left edge. A small teddy sits safely on stone ledge beside her. No cafe furniture. Natural oblique shoreline, no horizontal template band. First-person viewer POV, no viewer face/body.',
 'ending-pico-farewell':'Keep Pico EXACT small white teardrop guide shell, emerald smiling screen, speech-bubble halo, pixel wings, mitten hand waving, and glowing BLUE rounded EXIT button with ONLY door icon. REPLACE the entire tea-room/cafe environment, windows, sofa, tea props and foreground table with an OPEN-AIR SUNSET SERVER CITY RETURN GATE. Pico floats above a continuous paved city walkway with server towers and distant golden sky behind. Ground perspective continues to bottom edge, no table, no wood, no interior, no repeated band. No player face/body, no note/paper, no text.',
 'ending-claude-rest':'Keep adult Claude exact hair, star ribbon, costume, peacefully dozing toward viewer shoulder just OUTSIDE frame. Glasses removed and resting on open book on her lap. Remove the entire wooden cafe tabletop stripe AND background tea table, cups, pots. Recompose on a real GARDEN BENCH beside library: open book, relaxed natural hand, draped skirt and bench seat continue to bottom edge, foliage and stone garden path at side. Warm dappled afternoon light, intimate first-person seated POV, no viewer face/body. Book has only faint abstract ink strokes, no letters. No separate horizontal foreground band.',
 'qwen-axis':'Change ONLY facial expression/head angle: chin slightly raised, eyes looking DOWN toward viewer with confident superior attitude, an arrogant CLOSED-MOUTH asymmetric smirk with only ONE corner raised. NOT open-mouth laughter, no fangs, no yandere shadow. Keep exact original face identity, hair, ornaments, outfit, bear, hands, body pose, canvas framing and transparent alpha. Keep RED hairpin light and subtle red aura. Face anatomy coherent.',
 'qwen-yandere':'Change ONLY expression: eyes under a soft cool SHADOW, noticeably SMALL pupils, intense lovingly fixed gaze and CLOSED lips in a small sweet but unsettling smile. NO open mouth, NO fangs, NO laughing. Keep exact original face identity, hair, ornaments, outfit, bear, hands, body pose, canvas framing and transparent alpha. PINK and PURPLE hairpin glow and aura. Distinct from an arrogant smirk: warmly possessive and eerie, no gore.',
 'talk-rooftop-garden-night':'Lighting/time edit ONLY of the supplied existing DAY rooftop garden: the SAME exact architecture, bench at left, glass railings, pergola/wisteria, planters and blossom tree at right, same camera and framing. NIGHT with deep navy star-filled sky, softly lit garden lamps, gentle moonlight and glowing server-city windows. Cozy quiet garden, no fireworks. NO figures, robots or silhouettes. Bottom third dark simple paving for dialogue; calm central background. Preserve the original DAY image separately.'}
BASE='Use case: precise-object-edit. One polished high resolution FULL COLOR 2D anime game illustration matching the supplied reference assets exactly. No words, letters, numbers, captions, watermark, logos or readable writing. All people are ADULTS. Preserve exact existing identities, hair colors, accessories and clothes. Clear face and anatomically correct hands. '

def prepare():
 OUT.mkdir(parents=True,exist_ok=True);(OUT/'before').mkdir(exist_ok=True)
 jobs=read_json(WAVE/'jobs.json');bykey={j['key']:j for j in jobs['jobs']};log=read_json(WAVE/'generation-log.json');tasks=[]
 for key,scene in SCENES.items():
  kind='bg'if key.startswith('talk-')else'bust'if key.startswith('qwen-')else'cg'
  target='public/v2/art/'+kind+'/'+('talk-rooftop-garden'if kind=='bg'else key)+'.webp'
  if key not in bykey:
   j={'key':key,'kind':kind,'references':[target],'transparent':False};jobs['jobs'].append(j)
  else:j=bykey[key]
  n=len(log['assets'].get(key,[]))+1;assert n<=4
  references=[target]+[r for r in j['references']if 'char-'in r or 'mechs-'in r][:4]
  prompt=BASE+('Transparent portrait 1024x1536 RGBA. No background or ground. 'if kind=='bust'else'One full-bleed landscape16:9 scene, target1600x900. ')+scene
  if kind=='cg':prompt+=' No reserved dialogue zone. Compose a complete natural scene from top to bottom, including meaningful lower foreground. Do not copy any old foreground table or template strip.'
  rel=f'prompts/{key}-a{n}.txt';(WAVE/rel).write_text(prompt+'\n',encoding='utf8')
  j['promptFile']=rel;j['prompt']=prompt
  tasks.append({'key':key,'kind':kind,'prompt':prompt,'promptFile':rel,'references':references,'transparent':kind=='bust'})
  backup=OUT/'before'/Path(target).name
  if not backup.exists():shutil.copy2(ROOT/target,backup)
 write_json(WAVE/'jobs.json',jobs);write_json(WAVE/'fix-jobs.json',tasks)
 baseline=OUT/'baseline.json'
 if not baseline.exists():
  m=read_json(WAVE/'manifest.json');paths=[ROOT/o['file']for a in m['assets']for o in a['outputs']]+[ROOT/n for n in ['LICENSE','THIRD_PARTY_NOTICES.md','content/packs/saw/story/carbon-audit.json']]
  write_json(baseline,{p.relative_to(ROOT).as_posix():hashlib.sha256(p.read_bytes()).hexdigest()for p in paths})
 print('Prepared 9 correction prompts; originals and license hashes saved.')

def finish():
 tasks=read_json(WAVE/'fix-jobs.json');log=read_json(WAVE/'generation-log.json');manifest=read_json(WAVE/'manifest.json');entries=[]
 game=read_json(PACK/'game.json');gallery=read_json(PACK/game['gallery']);report=[]
 for j in tasks:
  key=j['key'];kind=j['kind'];a=log['assets'][key][-1];assert a['promptFile']==j['promptFile'],key
  image=Image.open(WAVE/a['raw'])
  image=ImageOps.fit(image.convert('RGB'),(1600,900),Image.Resampling.LANCZOS)if kind!='bust'else ImageOps.pad(clean(image),(1024,1536),Image.Resampling.LANCZOS,color=(0,0,0,0))
  source=f'{kind}/{key}.png';(WAVE/kind).mkdir(exist_ok=True);image.save(WAVE/source)
  entry={'id':key.removeprefix('talk-'),'kind':kind,'source':source};entries.append(entry)
 write_json(WAVE/'fix-manifest.json',{'wave':5,'revision':'review corrections','assets':entries})
 ingest(WAVE,manifest_name='fix-manifest.json',register=False,replace=True,out=OUT)
 for j,entry in zip(tasks,entries):
  key=j['key'];kind=j['kind'];artid={'bg':'bg-','cg':'cg-','bust':'bust-'}[kind]+entry['id'];path=ROOT/f'public/v2/art/{kind}/{key}.webp'
  q=encode(Image.open(WAVE/entry['source']),path,280 if kind=='bust' else 350 if kind=='bg' else 400)
  info,warnings=check(Image.open(path),kind);assert not warnings,(key,warnings)
  game['art']['files'][artid]='/'+path.relative_to(ROOT/'public').as_posix()
  if artid not in gallery['art']:gallery['art'].append(artid)
  output={'file':path.relative_to(ROOT).as_posix(),'bytes':path.stat().st_size,'quality':q,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
  report.append({'id':artid,**output,**info,'warnings':warnings})
  old=next((a for a in manifest['assets']if a['id']==entry['id']and a['kind']==kind),None)
  if old:old.update(source=entry['source'],outputs=[output],revision='review corrections')
  else:manifest['assets'].append({**entry,'outputs':[output],'revision':'review corrections'})
  history=log['assets'][key]
  for a in history[:-1]:
   if a['review']=='accepted':a.update(review='superseded',reason='User review correction: foreground staging or expression.')
  history[-1].update(review='accepted',promptSha256=hashlib.sha256((WAVE/history[-1]['promptFile']).read_bytes()).hexdigest())
  gen=next((g for g in manifest['generations']if g['key']==key),None)
  data={'key':key,'attempts':len(history),'history':history,'output':entry['source'],'revision':'review corrections','visualReview':{'identity':True,'noTextOrLogos':True,'anatomy':True,'fullScene':kind=='cg'}}
  if gen:gen.update(data)
  else:manifest['generations'].append(data)
 write_json(WAVE/'generation-log.json',log);write_json(WAVE/'manifest.json',manifest)
 write_json(PACK/'game.json',game);write_json(PACK/game['gallery'],gallery)
 cast=read_json(PACK/'cast.json');write_json(PACK/game['art']['metadata'],inspect_art({'files':game['art']['files'],'sheets':{c['moodSheet']['art']:c['moodSheet']for c in cast.values()if c.get('moodSheet')}}))
 write_json(OUT/'art-report.json',report)
 sheet([(j['key'],ROOT/f'public/v2/art/cg/{j["key"]}.webp')for j in tasks if j['kind']=='cg'],'fix/cg-sheet.png',3,(700,440))
 sheet([(k,ROOT/f'public/v2/art/bust/{k}.webp')for k in ['qwen','qwen-axis','qwen-yandere','qwen-megadere']],'fix/qwen-sheet.png',4,(500,790))
 for rel in ['game.json',game['gallery'],game['art']['metadata']]:
  p=PACK/rel;original=subprocess.check_output(['git','show','HEAD:engine/content/packs/saw/'+rel],cwd=ROOT)
  if b'\r\n'in original:p.write_bytes(p.read_bytes().replace(b'\r\n',b'\n').replace(b'\n',b'\r\n'))
 print('Registered 9 corrections; final geometry/capacity warnings 0.')

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('action',choices=['prepare','finish']);a=p.parse_args();globals()[a.action]()
