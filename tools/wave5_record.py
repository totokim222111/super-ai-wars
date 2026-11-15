import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0,str(_Path(__file__).resolve().parent))
from paths import SAMPLE_ROOT, STUDIO_ROOT, ENGINE_DIR, PACK_DIR, STORY_DIR, SOURCE_DIR, ART_SOURCE_DIR, AUDIO_SOURCE_DIR
"""Copy built-in imagegen output into Wave 5; keep an append-only attempt journal."""
import argparse, hashlib, shutil
from pathlib import Path
from art_ingest import ROOT, read_json, write_json
WAVE=ART_SOURCE_DIR / 'wave5'
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('key');parser.add_argument('source');parser.add_argument('--prompt');parser.add_argument('--refs',nargs='*');args=parser.parse_args()
    job=next(j for j in read_json(WAVE/'jobs.json')['jobs']if j['key']==args.key)
    log=WAVE/'generation-log.json';data=read_json(log)if log.exists()else {'generator':'built-in image_gen','assets':{}}
    attempts=data['assets'].setdefault(args.key,[]);n=len(attempts)+1;assert n<=4
    dest=WAVE/'raw'/f'{args.key}-a{n}.png';shutil.copy2(args.source,dest)
    from PIL import Image
    with Image.open(dest)as image:canvas=image.size;mode=image.mode
    attempts.append({'attempt':n,'raw':dest.relative_to(WAVE).as_posix(),'toolSource':args.source,'promptFile':args.prompt or job['promptFile'],'references':args.refs or job['references'],'canvas':canvas,'mode':mode,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'review':'pending'})
    write_json(log,data);print(dest)
