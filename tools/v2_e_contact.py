import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0,str(_Path(__file__).resolve().parent))
from paths import SAMPLE_ROOT, STUDIO_ROOT, ENGINE_DIR, PACK_DIR, STORY_DIR, SOURCE_DIR, ART_SOURCE_DIR, AUDIO_SOURCE_DIR, system_font
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFont
out=Path('tools/out/v2-e');files=sorted(p for p in out.glob('*.png') if p.name!='contact.png')
w,h=480,300
sheet=Image.new('RGB',(w*3,h*((len(files)+2)//3)),'#101525');draw=ImageDraw.Draw(sheet);font=ImageFont.truetype(system_font(),17)
for i,path in enumerate(files):
    thumb=ImageOps.contain(Image.open(path).convert('RGB'),(w-16,h-44));x=(i%3)*w+(w-thumb.width)//2;y=(i//3)*h+30;sheet.paste(thumb,(x,y));draw.text(((i%3)*w+12,(i//3)*h+6),path.stem,font=font,fill='white')
sheet.save(out/'contact.png')
