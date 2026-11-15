import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0,str(_Path(__file__).resolve().parent))
from paths import SAMPLE_ROOT, STUDIO_ROOT, ENGINE_DIR, PACK_DIR, STORY_DIR, SOURCE_DIR, ART_SOURCE_DIR, AUDIO_SOURCE_DIR
"""승인된 S1~S4/M1~M13만 공식 페이지에서 받는다. python -I로 실행한다."""
import argparse
import hashlib
import json
import re
import stat
import urllib.parse
import urllib.request
import zipfile
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath

ROOT = SAMPLE_ROOT
BASE=AUDIO_SOURCE_DIR / 'downloads'
APPROVED=[
 ('S1','kenney','https://kenney.nl/assets/interface-sounds','interface-sounds'),
 ('S2','kenney','https://kenney.nl/assets/sci-fi-sounds','sci-fi-sounds'),
 ('S3','kenney','https://kenney.nl/assets/impact-sounds','impact-sounds'),
 ('S4','opengameart','https://opengameart.org/content/512-sound-effects-8-bit-style','retro'),
 ('M1','opengameart','https://opengameart.org/content/jrpg-epic-rock-battle-theme-1','battle'),
 ('M2','opengameart','https://opengameart.org/node/84428','boss'),
 *[(f'M{i}','maou','https://maou.audio/'+page+'/',name) for i,page,name in [
 (3,'bgm_neorock82','title'),(4,'bgm_cyber43','map'),(5,'bgm_neorock75','enemy-phase'),
 (6,'bgm_neorock80','lastboss'),(7,'bgm_cyber36','intermission'),(8,'bgm_cyber41','comedy'),
 (9,'bgm_neorock83','tension'),(10,'bgm_piano24','sad'),(11,'bgm_neorock74','hope'),
 (12,'game_jingle03','victory'),(13,'game_jingle08','gameover')]],
]


class Links(HTMLParser):
    def __init__(self):super().__init__();self.links=[]
    def handle_starttag(self,tag,attrs):
        if tag=='a':
            href=dict(attrs).get('href')
            if href:self.links.append(href)


def get(url,referer=None):
    request=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36',**({'Referer':referer} if referer else {})})
    with urllib.request.urlopen(request,timeout=90) as response:
        if urllib.parse.urlparse(response.url).hostname not in ('kenney.nl','opengameart.org','maou.audio','maou.audio','www.maou.audio'):
            raise ValueError('출처 밖 리디렉션: '+response.url)
        return response.read(),response.headers.get('Content-Type',''),response.url


def save(data,path):path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)


def discover():
    BASE.mkdir(parents=True,exist_ok=True)
    for source in ('kenney','opengameart','maou'):
        folder=BASE/source
        if not folder.exists():folder.mkdir()
    rows=[]
    for ident,source,page,name in APPROVED:
        row={'id':ident,'source':source,'page':page,'name':name,'urls':[]}
        try:
            data,kind,final=get(page);save(data,BASE/source/'pages'/f'{ident}.html');html=data.decode('utf-8','replace')
            parser=Links();parser.feed(html);links=list(dict.fromkeys(urllib.parse.urljoin(page,x) for x in parser.links))
            if source=='kenney':
                selected=[x for x in links if x.endswith('.zip') and 'kenney_'+name in x]
                if not selected:
                    token=re.search(r"data-download-id=['\"]([0-9a-f]+)['\"]",html).group(1)
                    response,_,_=get('https://kenney.nl/download-link/'+token)
                    selected=[json.loads(response)['url']]
                    row['downloadLinkEndpoint']='https://kenney.nl/download-link/'+token
            elif ident=='S4':selected=[x for x in links if '/sites/default/files/' in x and x.lower().endswith('.zip')]
            elif ident=='M1':selected=[x for x in links if x.endswith(('jrpg_battle_intro.mp3','jrpg_battle_loop.mp3'))]
            elif ident=='M2':selected=[x for x in links if '/sites/default/files/' in x and x.lower().endswith('.zip')]
            else:
                oggs=[x for x in links if urllib.parse.urlparse(x).path.lower().endswith('.ogg')]
                loops=[x for x in oggs if 'loop' in x.lower()];selected=(loops or oggs)[:1]
            row.update(urls=selected,pageSha256=hashlib.sha256(data).hexdigest(),licenseConfirmed=('Creative Commons Zero' in html or 'publicdomain/zero' in html or 'CC0' in html) if source!='maou' else False)
            if not selected:row['error']='공식 페이지에서 대상 파일 링크를 찾지 못함'
        except Exception as e:row['error']=str(e)
        rows.append(row);print(ident,row.get('error',row['urls']),flush=True)
    data,_,_=get('https://maou.audio/rule/');save(data,BASE/'maou/pages/rule.html')
    rule=data.decode('utf-8','replace');confirmed='creativecommons.org/licenses/by/4.0' in rule
    for row in rows:
        if row['source']=='maou':row['licenseConfirmed']=confirmed;row['licensePage']='https://maou.audio/rule/'
    (BASE.parent/'sources.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


def extract(path,destination):
    skipped=[]
    with zipfile.ZipFile(path) as archive:
        if len(archive.infolist())>5000 or sum(i.file_size for i in archive.infolist())>256*1024*1024:raise ValueError('압축 크기 제한 초과')
        for entry in archive.infolist():
            relative=PurePosixPath(entry.filename.replace('\\','/'))
            if relative.is_absolute() or '..' in relative.parts or any(':' in x for x in relative.parts):raise ValueError('경로 탈출: '+entry.filename)
            target=(destination/Path(*relative.parts)).resolve()
            if not target.is_relative_to(destination.resolve()):raise ValueError('경로 탈출')
            if stat.S_ISLNK(entry.external_attr>>16):raise ValueError('심볼릭 링크 거부')
            if entry.is_dir():continue
            if target.suffix.lower() not in ('.wav','.ogg','.mp3','.txt','.md'):
                skipped.append(entry.filename);continue
            save(archive.read(entry),target)
    return skipped


def download():
    rows=json.loads((BASE.parent/'sources.json').read_text(encoding='utf-8'))
    assert [(r['id'],r['page']) for r in rows]==[(a[0],a[2]) for a in APPROVED]
    for row in rows:
        if row.get('downloads'):continue
        if row.get('error') or not row['licenseConfirmed']:print('건너뜀',row['id'],row.get('error','라이선스 확인 안 됨'));continue
        results=[]
        for url in row['urls']:
            if not urllib.parse.urlparse(url).hostname in ('kenney.nl','opengameart.org','maou.audio'):raise ValueError('출처 밖 링크')
            try:
                data,kind,final=get(url,row['page'])
                if 'html' in kind:raise ValueError('파일 대신 HTML/로그인 페이지 응답')
                name=urllib.parse.unquote(urllib.parse.urlparse(url).path.rsplit('/',1)[-1]);path=BASE/row['source']/row['id']/name
                if path.exists():raise ValueError('기존 다운로드 보호: '+str(path))
                save(data,path)
                result={'file':path.relative_to(ROOT).as_posix(),'url':url,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
                if path.suffix.lower()=='.zip':result['skippedEntries']=extract(path,path.parent/'data')
                results.append(result);print(row['id'],len(data),name,flush=True)
            except Exception as e:row['downloadError']=str(e);print(row['id'],str(e),flush=True)
        row['downloads']=results
        if results:row.pop('downloadError',None)
    (BASE.parent/'sources.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--discover',action='store_true');parser.add_argument('--download',action='store_true');args=parser.parse_args()
    if args.discover:discover()
    if args.download:download()
