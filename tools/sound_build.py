"""Rebuild the MP3 pack from approved local originals; never downloads media."""
import subprocess,sys
from paths import ENGINE_DIR,PACK_DIR,AUDIO_SOURCE_DIR,SAMPLE_ROOT

def main():
    subprocess.run([sys.executable,'-I',str(ENGINE_DIR/'tools/reencode_audio.py'),'--pack',str(PACK_DIR),'--selection',str(SAMPLE_ROOT/'docs/audio/selection.json'),'--source-root',str(AUDIO_SOURCE_DIR),'--report',str(SAMPLE_ROOT/'docs/audio/mp3-conversion.json')],check=True)
if __name__=='__main__':main()
