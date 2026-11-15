"""SAW configuration for the engine's generic image importer."""
import sys,importlib.util,os
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from paths import ENGINE_DIR,PACK_DIR,SAMPLE_ROOT
spec=importlib.util.spec_from_file_location('srpg_art_ingest',ENGINE_DIR/'tools/art_ingest.py');core=importlib.util.module_from_spec(spec);spec.loader.exec_module(core)
for key in dir(core):
    if not key.startswith('_'):globals()[key]=getattr(core,key)
ROOT=SAMPLE_ROOT
def ingest(wave,**kwargs):
    kwargs.setdefault('root',SAMPLE_ROOT);kwargs.setdefault('pack',PACK_DIR);kwargs.setdefault('out',SAMPLE_ROOT/'tools/out/art');return core.ingest(wave,**kwargs)
if __name__=='__main__':
    os.environ.setdefault('PACK_DIR',str(PACK_DIR))
    if not any(x in sys.argv for x in ['--self-test','--inspect-art','--out']):sys.argv.extend(['--out',str(SAMPLE_ROOT/'tools/out/art')])
    core.main()
