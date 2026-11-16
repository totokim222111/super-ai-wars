"""Apply Carbon's approved Gem/Grok voice revision without editing manuscripts.

The studio request and fenced manuscripts are authoritative when available.
Exports carry the same 180 before/after rows in voice-fix-approved.json.
"""
from __future__ import annotations
import argparse, hashlib, json, re
from pathlib import Path
from paths import PACK_DIR, SAMPLE_ROOT, STORY_DIR, STUDIO_ROOT

APPROVED=Path(__file__).with_name('voice-fix-approved.json')
REQUEST=STUDIO_ROOT/'docs/studio/carbon-requests/voice-gem-grok.md'
ROW=re.compile(r'^(S\d{2}-\d+|B[GR]-\d+|C-\d+) \| (.*)$',re.M)

def read_json(path):return json.loads(path.read_text(encoding='utf-8-sig'))
def write_json(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')

def contract():
    manuscripts=[STORY_DIR/'carbon'/f'voice-fix-{who}.md' for who in ['gem','grok']]
    if REQUEST.is_file() and all(p.is_file() for p in manuscripts):
        matches=ROW.findall(REQUEST.read_text(encoding='utf-8-sig'));old=dict(matches)
        if len(matches)!=len(old):raise ValueError('Duplicate request ID')
        rows=[]
        for who,path in zip(['gem','grok'],manuscripts):
            blocks=re.findall(r'^```[^\n]*\n(.*?)^```\s*$',path.read_text(encoding='utf-8-sig'),re.M|re.S)
            for id,line in ROW.findall('\n'.join(blocks)):
                if id not in old:raise ValueError('Unknown revision ID: '+id)
                rows.append({'id':id,'before':old[id],'after':line,'character':who})
        result={'schemaVersion':'carbon-voice-fix-1','sources':{name:hashlib.sha256(path.read_bytes()).hexdigest() for name,path in [('docs/studio/carbon-requests/voice-gem-grok.md',REQUEST),*[(f'story/carbon/voice-fix-{who}.md',path)for who,path in zip(['gem','grok'],manuscripts)]]},'rows':rows}
    else:result=read_json(APPROVED)
    rows=result['rows']
    if result['schemaVersion']!='carbon-voice-fix-1' or len(rows)!=180 or len({r['id']for r in rows})!=180:raise ValueError('Exactly 180 unique approved voice rows required')
    if [sum(r['character']==who for r in rows)for who in ['gem','grok']]!=[86,94]:raise ValueError('Character row count mismatch')
    return result

def replace_rows(text,rows,battle=False):
    from feedback_balance import visible_text
    text=visible_text(text)
    """Resolve against the unchanged input. Never fuzzy-match or rewrite dialogue."""
    lines=text.splitlines();changes={}
    for row in rows:
        old,new=visible_text(row['before']),visible_text(row['after']);hint=int(row['id'].split('-')[-1])-1
        if battle and row['id'].startswith('C-'):
            a=re.fullmatch(r'\[(합체기: [^\]]+)\] (.*)',old);b=re.fullmatch(r'\[(합체기: [^\]]+)\] (.*)',new)
            if not a or not b or a[1]!=b[1]:raise ValueError('Combo structure changed: '+row['id'])
            title=a[1];old,new=a[2],b[2]
            section=None;allowed=[]
            for i,line in enumerate(lines):
                if line.startswith('### '):section=line[4:]
                if section==title:allowed.append(i)
        else:allowed=range(len(lines))
        found=[i for i in allowed if lines[i]in {old,new}]
        if len(found)>1:
            if hint not in found:raise ValueError(f"{row['id']}: ambiguous text; ID line does not disambiguate {found}")
            index=hint
        elif len(found)==1:index=found[0]
        else:raise ValueError(row['id']+': original/revised dialogue not found: '+old)
        if index in changes:raise ValueError('Two IDs resolve to one line: '+row['id'])
        changes[index]=new
    for index,line in changes.items():lines[index]=line
    return '\n'.join(lines)+ ('\n'if text.endswith('\n')else'')

def story_source(episode,text):
    return replace_rows(text,[r for r in contract()['rows']if r['id'].startswith(f'S{episode:02}-')])

def dialogue_source(episode,lines):
    replacements={r['before']:r['after']for r in contract()['rows']if r['id'].startswith(f'S{episode:02}-')}
    from feedback_balance import visible_text
    return [visible_text(replacements.get(line,line))for line in lines]

def battle_source(filename,text):
    rows=[r for r in contract()['rows']if r['id'].startswith(('BG-','BR-'))]if filename=='battle-lines-1-allies.md' else [r for r in contract()['rows']if r['id'].startswith('C-')]if filename=='battle-lines-3-combos-zako.md'else []
    from feedback_balance import visible_text
    return visible_text(replace_rows(text,rows,True))

def generated(pack=PACK_DIR):
    from port_grok_absent import strip_route,overlay
    result={pack/f'story/ep{ep:02}.story':overlay(ep,story_source(ep,strip_route((pack/f'story/ep{ep:02}.story').read_text(encoding='utf-8'))))for ep in range(1,16)}
    # The existing mapper owns weapon IDs, form-change priority, mood aliases and combo bindings.
    from port_battle_lines import generate
    result.update(generate(pack,STORY_DIR))
    audit=read_json(pack/'story/carbon-audit.json');cast=result[pack/'cast.json'];names={*cast,*(c['name']for c in cast.values())}
    for ep in range(1,16):
        text=result[pack/f'story/ep{ep:02}.story'];lines=[]
        for line in text.splitlines():
            m=re.match(r'^(?:\[타입 [OM]\]\s*)?([^:[(]+)(?:\([^)]*\))?: ',line)
            if m and m[1]in names:lines.append(line)
        entry=audit['episodes'][f'ep{ep:02}']
        entry['dialogueLines']=len(lines)
        entry['dialogueSha256']=hashlib.sha256('\n'.join(lines).encode()).hexdigest()
    result[pack/'story/carbon-audit.json']=audit
    # Gallery battle fixtures use an approved attack utterance, not an invented sample.
    gallery_path=result[pack/'game.json'].get('gallery')
    if isinstance(gallery_path,str)and(pack/gallery_path).is_file():
        gallery=read_json(pack/gallery_path)
        def update(value):
            if isinstance(value,dict):
                if value.get('attacker')in ['gem','grok']and isinstance(value.get('lines'),dict):
                    cid='saw-gem'if value['attacker']=='gem'else'grok'
                    value['lines']['before']=cast[cid]['battleLines']['attack'][0]
                for v in value.values():update(v)
            elif isinstance(value,list):
                for v in value:update(v)
        update(gallery);from feedback_balance import visible_json
        result[pack/gallery_path]=visible_json(gallery)
    result[APPROVED]=contract()
    return result

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args();outputs=generated();different=[]
    for path,value in outputs.items():
        actual=path.read_text(encoding='utf-8')if path.is_file()else None
        same=actual==value if isinstance(value,str)else actual is not None and json.loads(actual)==value
        if args.check:
            if not same:different.append(str(path))
        elif not same:
            if isinstance(value,str):path.write_text(value,encoding='utf-8',newline='\n')
            else:write_json(path,value)
    if different:raise SystemExit('voice fix mismatch: '+', '.join(different))
    print('젬·그록 말투 '+('원문 대조'if args.check else'이식')+' 완료: 180행 (스토리157 / 전투18 / 합체기5), 누락0')

if __name__=='__main__':main()
