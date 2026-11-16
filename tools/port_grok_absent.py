"""Carbon's no-recruit branch. Original manuscripts stay read-only."""
import argparse,hashlib,json,re
from pathlib import Path
from paths import PACK_DIR,STORY_DIR
APPROVED=Path(__file__).with_name('grok-absent-approved.json')
MARK='// grok-absent generated branches'
GUARD='[조건] 그록합류 != 1 -> __grok_absent_'
def contract():
 d=json.loads(APPROVED.read_text(encoding='utf-8'));p=STORY_DIR/'carbon/grok-absent-route.md'
 if p.is_file():
  block=re.findall(r'^```[^\n]*\n(.*?)^```',p.read_text(encoding='utf-8'),re.M|re.S)[0].rstrip('\n')
  if hashlib.sha256(block.encode()).hexdigest()!='a0ea030942993d9be7513b2a217295e35756d0b674f2953d0b2b7bd6ca9c8563':raise ValueError('Carbon source hash mismatch')
  if dict(re.findall(r'^(S\d+-\d+) \| (.*)$',block,re.M))!=d['rows']:raise ValueError('Carbon rows mismatch')
 return d
def strip_route(text):
 return '\n'.join(l for l in text.split(MARK)[0].splitlines()if not l.startswith(GUARD)).rstrip()+'\n'
def scenes(text):
 result={};prefix=[];current=None
 for line in text.splitlines():
  if line.startswith('@ '):current=line[2:];result[current]=[]
  elif current is None:prefix.append(line)
  else:result[current].append(line)
 return prefix,result
def overlay(ep,text):
 if ep<4:return text
 if MARK in text:return text
 d=contract();
 if ep==4:text=re.sub(r'(지역 toll[^\n]*진입)(?! 생존)',r'\1 생존 grok',text)
 lines=text.splitlines();idxscene={};cur=''
 for i,line in enumerate(lines):
  if line.startswith('@ '):cur=line[2:]
  idxscene[i]=cur
 changed=set();skip=set();replacements={};fallback={};remove_always=set()
 for item in d['items']:
  if item.get('episode')!=ep or 'ranges'not in item:continue
  action=item['action']
  if action=='remove-deploy':continue
  for r in item['ranges']:
   before=r['before'];found=[i for i in range(len(lines)-len(before)+1)if lines[i:i+len(before)]==before]
   if len(found)>1 and r['start']-1 in found:found=[r['start']-1]
   if len(found)!=1:
    if item['id']=='GA04-02'and not any(l=='[합류] grok'for l in lines):continue
    raise ValueError(item['id']+': ambiguous/missing original range '+str(found))
   indexes=range(found[0],found[0]+len(before))
   if item['id']=='GA04-02':remove_always.update(indexes);continue
   changed.update(idxscene[i]for i in indexes)
   if action in ['skip-range','skip-line']:skip.update(indexes)
   if action=='skip-scene':
    target='인터미션_마무리4'if ep==4 else '숙소_로그아웃발각'if ep==10 else '인터미션_마무리14'if ep==14 else '엔딩_오픈'if '엔딩'in item['scene']else '최종_로그아웃'
    for i in indexes:fallback[idxscene[i]]=target
   if item['id']=='GA04-03':skip.update(i for i in indexes if not any(lines[i]==row['before']for row in item['replacements']))
  for row in item['replacements']:
   found=[i for i,l in enumerate(lines)if l==row['before']]
   if len(found)!=1:raise ValueError(row['id']+': original not unique')
   replacements[found[0]]=row['after'].replace('나노 모드','플래시 모드')
 # These exits only existed to make room for the absent member.
 for epn,nums in [(5,[263,271]),(11,[254]),(13,[235])]:
  if ep==epn:skip.update(n-1 for n in nums)
 prefix,main=scenes('\n'.join(l for i,l in enumerate(lines)if i not in remove_always))
 # Conditional fixed deployments, including old-save inherited rosters.
 for i,l in enumerate(main.get('규칙',[])):
  if ep>=5 and l.startswith('아군:'):
   main['규칙'][i]=re.sub(r'( / grok = [^/]+?)(?= / |$)',lambda m:m[1]if '조건 그록합류'in m[1]else m[1].rstrip()+' 조건 그록합류',l)
 absent={};seen={}
 for i,l in enumerate(lines):
  name=idxscene[i]
  if name not in changed or l.startswith('@ '):continue
  if name in fallback:absent[name]=['[이동] '+fallback[name]];continue
  dest=absent.setdefault(name,[])
  if i in skip or i in remove_always:continue
  if i in replacements:l=replacements[i]
  elif '그록'in l and not l.startswith('//'):
   if l.startswith('- '):l=re.sub(r';?\s*\[호감\] 그록짱 \+\d+;?\s*',lambda m:'; 'if m[0].startswith(';')and m[0].rstrip().endswith(';')else' ',l).replace('{ ;','{ ').replace('; }',' }')
   else:continue
  if not l or l.startswith('//'):dest.append(l);continue
  # Explicitly stage replacement speakers, preserving the two-person composition.
  match=re.match(r'^(?:\[타입 [OM]\]\s*)?([^[(]+)\([^)]*\):',l)
  if match:
   who=match[1];state=seen.setdefault(name,{})
   if who not in state:
    side='오른쪽'if '왼쪽'in state.values()else'왼쪽';old=next((w for w,s in state.items()if s==side),None)
    if old:dest.append('[퇴장] '+old);del state[old]
    dest.append('[등장] '+who+' '+side);state[who]=side
  enter=re.match(r'^\[등장\] (.+) (왼쪽|오른쪽)',l)
  if enter:
   state=seen.setdefault(name,{});state.update({enter[1]:enter[2]})
  if l.startswith('[퇴장] '):seen.setdefault(name,{}).pop(l[5:],None)
  dest.append(l)
 if ep==4:
  absent['인터미션_마무리4']=['[암전]','[배경] bg-hangar','[밝아짐]','[장소] 아군 본부 · 제2 메카닉 정비 구역']+absent['인터미션_마무리4']
  # No repeated welcome/teasing after the two authored bridge sentences.
  absent['승리']=[l for l in absent['승리']if not(l.startswith('[퇴장] ')and '그록'in l)]
 output=prefix[:]
 for name,body in main.items():
  output+=['@ '+name]
  if name in absent:output.append(GUARD+name)
  output+=body
 output+=['',MARK]
 for name,body in absent.items():output+=['','@ __grok_absent_'+name,*body]
 return '\n'.join(output).rstrip()+'\n'
def main():
 a=argparse.ArgumentParser();a.add_argument('--check',action='store_true');args=a.parse_args();d=contract();hashes={}
 from port_carbon import generate,RAW
 raw=RAW.read_text(encoding='utf-8')if RAW.is_file()else None;wrong=[]
 for ep in range(4,16):
  p=PACK_DIR/f'story/ep{ep:02}.story'
  expected=generate(raw,ep)[0]if raw is not None else p.read_text(encoding='utf-8')
  hashes[p.name]=hashlib.sha256(expected.encode()).hexdigest()
  if raw is None and hashes[p.name]!=d.get('compiledSha256',{}).get(p.name):raise ValueError('compiled route hash mismatch: '+p.name)
  p=PACK_DIR/f'story/ep{ep:02}.story'
  
  if args.check:
   if p.read_text(encoding='utf-8')!=expected:wrong.append(str(p))
  else:p.write_text(expected,encoding='utf-8')
 if not args.check:
  d['compiledSha256']=hashes;APPROVED.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 if wrong:raise SystemExit('Grok absent mismatch: '+', '.join(wrong))
 print('그록 미합류 원문 대조 완료: S60/B16/X12, 카본38행, 플래시2곳')
if __name__=='__main__':main()
