import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0,str(_Path(__file__).resolve().parent))
from paths import SAMPLE_ROOT, STUDIO_ROOT, ENGINE_DIR, PACK_DIR, STORY_DIR, SOURCE_DIR, ART_SOURCE_DIR, AUDIO_SOURCE_DIR, system_font
"""검수 표·파형·출처 문서를 쓴다. 출처 문서 앞부분은 바꾸지 않는다. python -I로 실행."""
import hashlib
import json
import subprocess
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont

ROOT = SAMPLE_ROOT


def main():
    rows=json.loads((AUDIO_SOURCE_DIR / 'sources.json').read_text(encoding='utf-8'));r=json.loads((AUDIO_SOURCE_DIR / 'selection.json').read_text(encoding='utf-8'));pack=json.loads((PACK_DIR / 'audio' / 'pack.json').read_text(encoding='utf-8'))
    text='\n\n## 받은 결과\n\n2026-11-11, 승인 S1~S4·M1~M13만 수신했다. 목록 밖 음원은 받지 않았다. 원본은 `audio-src/downloads/{kenney,opengameart,maou}/`에 두고 저장소에서 제외했다. ZIP은 경로 탈출·절대 경로·심볼릭 링크를 거부하고 오디오·텍스트만 추출했다. 받은 실행 파일·스크립트는 실행하지 않았고 Python 작업은 모두 `-I`로 실행했다.\n\n'
    text+='| 승인 | 받은 파일(바이트) | 라이선스 재확인 | 공식 페이지 |\n|---|---|---|---|\n'
    for row in rows:
        files=' / '.join(Path(d['file']).name+f" ({d['bytes']:,})" for d in row['downloads'])
        proof='압축 내부 License.txt: CC0' if row['source']=='kenney' else '항목 페이지 License(s): CC0' if row['source']=='opengameart' else '[공식 규약](https://maou.audio/rule/): CC BY 4.0'
        text+=f"| {row['id']} | {files} | {proof} | [{row['name']}]({row['page']}) |\n"
    text+='\nKenney의 세 License.txt를 실제로 읽었다. OpenGameArt M2도 컬렉션이 아닌 해당 항목 페이지의 CC0 표시를 확인했다. 魔王魂은 규약의 CC BY 4.0 경로를 사용하고 `author: "魔王魂"`, `credit: "音楽：魔王魂"`을 기록했다. 재인코딩 사실은 pack의 modifications와 아래 이용 기록에 남겼다. 별도 소재 모음으로 배포하지 않으며 원곡을 학습·작곡 시스템에 쓰지 않는다. 로그인·결제·약관 동의 창은 필요 없었다. 처음의 직접 요청 403은 공식 다운로드 링크/곡 페이지 Referer를 사용해 해결했다.\n\n'
    text+='### 효과음 선별\n\n청취한 결과가 아니다. 이름, 무음 제거 후 길이, 10ms 구간 RMS, 감쇠, FFT 에너지로 선별했다. 시작/끝 비는 각 구간 RMS를 최대 구간 RMS로 나눈 값이다. 저/고 대역은 각각 300Hz 미만/3kHz 초과 에너지 비율이다. 입력은 최대 1.95초로 제한하고 가장자리 페이드 후 OGG로 저장했으며, 표의 gain을 재생 때 곱한다.\n\n'
    text+='| 엔진 이름 | 승인·원본 | 초 | gain | 시작/끝 RMS 비 | 중심 Hz · 저/고 비율 | 고른 이유 |\n|---|---|---:|---:|---|---|---|\n'
    for id,m in r['sfx'].items():
        a=m['after'];text+=f"| `{id}` | {m['approved']} `{Path(m['original']).name}` | {a['seconds']:.3f} | {m['gain']} | {a['attack10ms']:.2f}/{a['tailRmsRatio']:.2f} | {a['centroidHz']} · {a['lowBelow300']:.0%}/{a['highAbove3000']:.0%} | {m['reason']} |\n"
    text+='\n파형 모음은 `tools/out/audio/sfx-waveforms.png`, 수치와 자른 위치는 `audio-src/selection.json`이다. 서보·변형은 승인된 Kenney 기계음으로 채웠으며 별도 Freesound 파일은 받지 않았다.\n\n### 곡 연결\n\n| 엔진 이름 | 승인·곡 | 도입/반복 시작(초) | 반복 끝(초) | 재생 |\n|---|---|---:|---:|---|\n'
    for id,m in r['bgm'].items():
        e=pack['bgm'][id];text+=f"| `{id}` | {m['approved']} {e['title']} | {e['loopStart']:.6f} | {e['loopEnd']:.6f} | {'구간 반복' if e['loop'] else '1회'} |\n"
    text+=f"\nM1은 승인된 intro({r['bgm']['battle']['partSeconds'][0]:.9f}초)+loop({r['bgm']['battle']['partSeconds'][1]:.9f}초)를 PCM으로 연결한 `battle MP3` 한 파일이다. 별도 full MP3는 받지 않았다. M2는 공식 페이지의 파일명 반전 안내와 실측 길이를 함께 확인해 `_loop.wav`({r['bgm']['boss']['partSeconds'][0]:.9f}초)를 도입으로, `_opening.wav`({r['bgm']['boss']['partSeconds'][1]:.9f}초)를 반복으로 연결했다. 두 파일 사이에 침묵을 삽입하지 않았다. 魔王魂은 페이지에서 제공하는 ogg 루프판을 우선했고, 별도 루프판이 없는 map/tension/sad는 원곡 전체를 반복한다. 징글 두 곡은 한 번만 재생한다.\n"
    text+=f"\n곡은 스테레오 44.1kHz MP3 LAME VBR/gapless, 효과음은 모노 44.1kHz MP3 LAME VBR/gapless다. 공개 팩에는 선별한 **33개 음원, {r['bytes']:,}바이트({r['bytes']/1048576:.2f}MiB)**만 넣었다. ZIP/전체 묶음은 공개 audio 폴더에 넣지 않았다.\n\n### 엔진 연결과 확인\n\n게임 music에 13개 이름을 연결했다. 적 맵 페이즈는 enemy-phase, 적의 코어 LL 등급/보스 태그는 boss, 피코 형태는 lastboss, 결과는 victory/gameover다. 화면을 걷으면 아래 화면의 현재 곡을 복원한다. 없는 대본 음악은 팩 경고만 남기고 재생 중인 곡을 유지한다.\n\n1화 도입 map, 2화 미술관 도입 tension, 두 인터미션 안내 intermission, 티타임 comedy 지시를 추가했다. 대사 글은 바꾸지 않았다. 소리 진열장은 효과음 20개·곡 13개와 쪽 넘김 크레딧을 표시한다.\n\n못 받은 항목: 없음. 실제 청취는 할 수 없었다. 사용자가 각 효과음의 어울림·대사 글자음의 피로도·음악 대비 타격음 크기·M1/M2 및 루프판 경계의 이음매를 귀로 확인해야 한다.\n"
    document=ROOT/'docs/v2-sound-sources.md';before=document.read_bytes();marker=b'## '+ '받은 결과'.encode()
    if marker not in before:
        (AUDIO_SOURCE_DIR / 'document-before.sha256').write_text(hashlib.sha256(before).hexdigest()+'\n',encoding='ascii');document.write_bytes(before+text.encode('utf-8'))
    else:print('받은 결과 절은 이미 있어 보존함')
    licenses='# SAW 소리 팩 출처\n\n'+('\n'.join(f"- **{e['title']}** — {e['author']}; {e['license']}; {e['source']}" for e in pack['bgm'].values()))+'\n\n효과음: Kenney Interface/Sci-fi/Impact Sounds(CC0), Juhani Junkala / SubspaceAudio 512 Sounds(CC0). 항목별 원본은 audio-src/selection.json.\n\n音楽：魔王魂\n魔王魂原曲をゲーム用OGGに再エンコード（変更：本プロジェクト、2026-11-11）。\nCC BY 4.0: https://creativecommons.org/licenses/by/4.0/\n利用規約: https://maou.audio/rule/\n\nCC0: https://creativecommons.org/publicdomain/zero/1.0/\nKenneyの3配布ZIP内 License.txtを確認。OpenGameArt M1/M2/S4の各素材ページでCC0を確認。\n'
    (PACK_DIR / 'audio' / 'LICENSES.md').write_text(licenses,encoding='utf-8')
    out=ROOT/'tools/out/audio';out.mkdir(parents=True,exist_ok=True);font=ImageFont.truetype(system_font(),15);image=Image.new('RGB',(2000,1000),'#080d20');d=ImageDraw.Draw(image)
    for i,(id,m) in enumerate(r['sfx'].items()):
        x=i%4*500;y=i//4*200;data=subprocess.check_output(['ffmpeg','-v','error','-i',str(PACK_DIR / 'audio' / pack['sfx'][id]['file']),'-f','f32le','-ac','1','pipe:1']);samples=np.frombuffer(data,dtype='<f4');groups=np.array_split(samples,460)
        d.text((x+12,y+8),f"{id}  {m['after']['seconds']:.3f}s  gain {m['gain']}",fill='white',font=font);d.line((x+15,y+105,x+480,y+105),fill='#485572')
        for j,g in enumerate(groups):
            if len(g):d.line((x+18+j,y+105-float(max(g))*68,x+18+j,y+105-float(min(g))*68),fill='#71d9ec')
    image.save(out/'sfx-waveforms.png');print('출처 부록·라이선스·파형 저장')


if __name__=='__main__':main()
