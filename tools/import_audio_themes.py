"""Import the sixteen approved local themes. Run with python -I; never downloads or executes inputs."""
import argparse,hashlib,importlib.util,json,os,re,subprocess,sys
from pathlib import Path
import numpy as np

SAMPLE=Path(__file__).resolve().parents[1]
STUDIO=SAMPLE.parents[1]
ENGINE=Path(os.environ.get('ENGINE_DIR',STUDIO/'engine' if (STUDIO/'engine').is_dir() else SAMPLE/'engine')).resolve()
PACK=Path(os.environ.get('PACK_DIR',SAMPLE/'pack')).resolve()
SLOTS=['battle-intro-jingle','theme-player','theme-gpi','theme-gem','theme-claude','theme-grok','theme-deepseek','theme-sonnet','theme-exaone','theme-rival','screen-upgrade','story-daily','story-mystery','story-resolve','story-memory','theme-qwen']
def read(path):return json.loads(path.read_text(encoding='utf8'))
def write(path,value):path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def author(slot):return 'HydroGene' if slot=='theme-player' else 'Maik Hoffmann (Majadroid)' if slot=='theme-qwen' else '魔王魂'
def license_name(slot):return 'CC0' if slot=='theme-player' else 'CC BY 4.0'
def verify_sources(rows,root):
    if len(rows)!=16 or [r['slot'] for r in rows]!=SLOTS or [r['id'] for r in rows]!=[f'T{i:02}' for i in range(1,17)]:raise ValueError('Unexpected approved theme catalog')
    paths=[]
    for row in rows:
        path=(root/row['file']).resolve()
        if not path.is_relative_to(root) or path.suffix.lower() not in ['.ogg','.mp3'] or not path.is_file():raise ValueError('Unsafe/missing original audio')
        if not re.fullmatch('[0-9a-f]{64}',row['sha256']) or path.stat().st_size!=row['bytes'] or sha(path)!=row['sha256']:raise ValueError('Original hash/size mismatch: '+row['id'])
        if not 0<row['bytes']<50*1024*1024 or not all(str(row[k]).startswith('https://') for k in ['url','page']):raise ValueError('Invalid audio provenance')
        paths.append(path)
    return paths

def append_block(path,body):
    start='<!-- audio-themes-2026-11-13 -->';end='<!-- /audio-themes-2026-11-13 -->'
    text=path.read_text(encoding='utf8');block=start+'\n'+body.rstrip()+'\n'+end
    if start in text:
        before,rest=text.split(start,1);_,after=rest.split(end,1);text=before+block+after
    else:text=text.rstrip()+'\n\n'+block+'\n'
    path.write_text(text,encoding='utf8')

def notices(data):
    rows=[data['bgm'][slot] for slot in SLOTS]
    lines=['## 승인 추가 음악 · 2026-11-13','', '| 곡 | 저작자 | 라이선스·출처 |','|---|---|---|']
    for e in rows:lines.append(f"| {e['title']} | {e['author']} | [{e['license']}]({e['licenseUrl']}) · [원곡]({e['source']}) |")
    lines+=['','音楽：魔王魂','승인 원본을 게임용 MP3(LAME gapless/Xing)로 재인코딩했습니다. 재생 시 RMS 약 0.11을 목표로 gain을 적용합니다. 魔王魂 루프판은 전체 반복 구간을 유지합니다. Determination·ヒーリング16·Samurai Nights는 전체 길이를 유지하고 시작 0.01초/끝 0.75초 페이드를 넣었습니다. 징글은 반복하지 않습니다.','Samurai Nights — Maik Hoffmann (Majadroid), CC BY 4.0. 원곡: https://opengameart.org/content/samurai-nights . 변경: 게임용 MP3 재인코딩, 가장자리 페이드. 제공 페이지의 복수 라이선스 중 사용자 지정 CC BY 4.0을 선택했습니다.','魔王魂 이용 규약: https://maou.audio/rule/ ; CC BY 4.0: https://creativecommons.org/licenses/by/4.0/ ; CC0: https://creativecommons.org/publicdomain/zero/1.0/']
    append_block(PACK/'audio/LICENSES.md','\n'.join(lines))
    path=SAMPLE/'THIRD_PARTY_NOTICES.md';text=path.read_text(encoding='utf8')
    text=text.replace('BGM 11곡과 징글 2곡 (곡명은 `pack/audio/LICENSES.md`)','음악·징글 25곡 (곡명은 `pack/audio/LICENSES.md`)')
    if '| Determination — Anime Style Music |' not in text:text=text.replace('| Boss Battle #2 [Symphonic Metal] | nene | CC0 1.0 |','| Boss Battle #2 [Symphonic Metal] | nene | CC0 1.0 |\n| Determination — Anime Style Music | HydroGene | CC0 1.0 |\n| Samurai Nights | Maik Hoffmann (Majadroid) | CC BY 4.0 |')
    path.write_text(text,encoding='utf8')
    append_block(path,'2026-11-13 추가: 사용자 제공 승인 16곡을 추가했습니다. 魔王魂 14곡은 `音楽：魔王魂` 표기, Determination은 HydroGene(CC0), Samurai Nights는 Maik Hoffmann (Majadroid), CC BY 4.0입니다. 곡별 출처·라이선스 링크·재인코딩/페이드 변경은 `pack/audio/LICENSES.md`와 `pack/audio/pack.json`에 있습니다.')

def check():
    data=read(PACK/'audio/pack.json');selection=read(SAMPLE/'docs/audio/selection.json');sources={r['id']:r for r in read(SAMPLE/'docs/audio/sources.json')};conversion={r['id']:r for r in read(SAMPLE/'docs/audio/mp3-conversion.json')}
    for i,slot in enumerate(SLOTS,1):
        e=data['bgm'][slot];r=selection['bgm'][slot];source=sources[f'T{i:02}'];file=(PACK/'audio'/e['file']).resolve()
        assert file.is_relative_to(PACK/'audio') and file.suffix=='.mp3' and sha(file)==conversion[slot]['sha256'],slot
        assert e['author']==author(slot) and e['license']==license_name(slot) and source['licenseConfirmed'] and r['approved']==f'T{i:02}',slot
        assert e['loop']==(i!=1) and abs(e['loopEnd']-e['frames']/e['sampleRate'])<1e-8 and .01<=e['gain']<=10,slot
        assert r['gain']==e['gain'] and len(r['originals'])==1 and source['downloads'][0]['sha256']==conversion[slot]['originalSha256'][0],slot
        if i in [2,15,16]:assert r['processing']=={'fadeIn':.01,'fadeOut':.75},slot
        elif i!=1:assert r['processing']=={'loopSource':True},slot
        for notice in [PACK/'audio/LICENSES.md',SAMPLE/'THIRD_PARTY_NOTICES.md']:
            text=notice.read_text(encoding='utf8');assert e['author'] in text
    print('승인 추가 음악 16곡 · MP3 해시·길이·루프·크레딧 대조 완료')

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--sources',type=Path);parser.add_argument('--source-root',type=Path,default=Path(os.environ.get('AUDIO_SOURCE_DIR',STUDIO/'docs/studio/production/audio-src')));parser.add_argument('--check',action='store_true');args=parser.parse_args()
    if args.check:check();return
    root=args.source_root.resolve();rows=read(args.sources or root/'sources-themes-2026-11-13.json');paths=verify_sources(rows,root)
    spec=importlib.util.spec_from_file_location('engine_audio_encoder',ENGINE/'tools/reencode_audio.py');encoder=importlib.util.module_from_spec(spec);spec.loader.exec_module(encoder)
    data=read(PACK/'audio/pack.json');data['name']=f'SAW 승인 소리 팩 (음악·징글 29곡 / 효과음 {len(data["sfx"])}개)';selection=read(SAMPLE/'docs/audio/selection.json');sources=read(SAMPLE/'docs/audio/sources.json');sources=[r for r in sources if r['id'] not in [f'T{i:02}'for i in range(1,17)]]
    for row,path in zip(rows,paths):
        slot=row['slot'];samples=encoder.read_pcm(path,2);processing=({'fadeIn':.01,'fadeOut':.75} if slot in ['theme-player','theme-qwen','story-memory'] else {} if slot=='battle-intro-jingle' else {'loopSource':True});samples=encoder.prepare_music(samples,processing);rms=float(np.sqrt(np.mean(samples.astype(np.float64)**2)));peak=float(np.max(abs(samples)))
        if not .1<len(samples)/44100<600 or not np.isfinite(rms) or rms<=0:raise ValueError('Invalid audio signal: '+slot)
        gain=round(min(.11/rms,.8/max(peak,1e-9)),6);title='Determination — Anime Style Music' if slot=='theme-player' else 'Samurai Nights' if slot=='theme-qwen' else row['name'].removeprefix('魔王魂 ');license=license_name(slot);url='https://creativecommons.org/publicdomain/zero/1.0/' if license=='CC0' else 'https://creativecommons.org/licenses/by/4.0/'
        relative='audio-src/'+row['file'];selection['bgm'][slot]={'approved':row['id'],'originals':[relative],'partSeconds':[len(samples)/44100],'gain':gain,'before':{'seconds':len(samples)/44100,'rms':rms,'peak':peak},'processing':processing,'volumeTarget':{'rms':.11,'peakLimit':.8},'license':license}
        selection['licenses'][row['id']]={'page':row['page'],'license':license,'confirmed':True,'confirmedBy':'사용자 승인 및 제공 출처 기록 (2026-11-13)'}
        data['bgm'][slot]={'file':data['bgm'].get(slot,{}).get('file','bgm/'+slot+'.pending.mp3'),'gain':gain,'title':title,'author':author(slot),'license':license,'source':row['page'],'licenseUrl':url,'loop':slot!='battle-intro-jingle','loopStart':0,'loopEnd':len(samples)/44100,'credit':'音楽：魔王魂' if author(slot)=='魔王魂' else author(slot)}
        sources.append({'id':row['id'],'slot':slot,'source':'user-provided approved original','page':row['page'],'name':title,'urls':[row['url']],'license':license,'licenseConfirmed':True,'licenseChoice':'사용자 지정 CC BY 4.0' if slot=='theme-qwen' else '사용자 승인 출처 기록','downloads':[{'file':relative,'url':row['url'],'bytes':row['bytes'],'sha256':row['sha256'],'extracted':slot=='theme-qwen'}]})
    write(PACK/'audio/pack.json',data);write(SAMPLE/'docs/audio/selection.json',selection);write(SAMPLE/'docs/audio/sources.json',sources)
    subprocess.run([sys.executable,'-I',str(ENGINE/'tools/reencode_audio.py'),'--pack',str(PACK),'--selection',str(SAMPLE/'docs/audio/selection.json'),'--source-root',str(root),'--report',str(SAMPLE/'docs/audio/mp3-conversion.json'),'--only',*SLOTS],check=True)
    data=read(PACK/'audio/pack.json');notices(data);check()

if __name__=='__main__':main()
