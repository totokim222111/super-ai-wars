"""Local paths shared by sample authoring tools; no machine-specific defaults."""
import os
from pathlib import Path
SAMPLE_ROOT=Path(__file__).resolve().parents[1]
STUDIO_ROOT=SAMPLE_ROOT.parents[1]
def configured(name,default):
    return Path(os.environ.get(name,str(default))).expanduser().resolve()
ENGINE_DIR=configured('ENGINE_DIR',STUDIO_ROOT/'engine' if (STUDIO_ROOT/'engine').is_dir() else SAMPLE_ROOT/'engine')
PACK_DIR=configured('PACK_DIR',SAMPLE_ROOT/'pack')
STORY_DIR=configured('STORY_DIR',STUDIO_ROOT/'story')
SOURCE_DIR=configured('SOURCE_DIR',STUDIO_ROOT/'source')
ART_SOURCE_DIR=configured('ART_SOURCE_DIR',STUDIO_ROOT/'docs/studio/production/art-src')
AUDIO_SOURCE_DIR=configured('AUDIO_SOURCE_DIR',STUDIO_ROOT/'docs/studio/production/audio-src')

def system_font():
    candidates=[os.environ.get('FONT_PATH'),str(Path(os.environ.get('WINDIR',os.environ.get('SystemRoot','/Windows')))/'Fonts/malgun.ttf'),'/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']
    return next((p for p in candidates if p and Path(p).is_file()),None)
