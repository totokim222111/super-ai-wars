import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0,str(_Path(__file__).resolve().parent))
from paths import SAMPLE_ROOT, STUDIO_ROOT, ENGINE_DIR, PACK_DIR, STORY_DIR, SOURCE_DIR, ART_SOURCE_DIR, AUDIO_SOURCE_DIR, system_font, system_font
"""engine에서 실행. 검수 리포트의 데스크톱/휴대폰 화면을 한 장으로 모은다."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
out = Path("tools/out/v2-d")
report = json.loads((out / "report.json").read_text(encoding="utf-8"))
paths = report["shots"]
cols, width, height = 4, 320, 210
canvas = Image.new("RGB", (cols * width, ((len(paths) + cols - 1) // cols) * height + 40), "#080e1b")
draw = ImageDraw.Draw(canvas)
font = ImageFont.truetype(system_font(), 14)
draw.text((14, 10), "v2 D / desktop 1280x720 + mobile 844x390 / Korean M Super", font=font, fill="white")
for i, name in enumerate(paths):
    x, y = (i % cols) * width, 40 + (i // cols) * height
    with Image.open(name) as source:
        image = source.convert("RGB")
        image.thumbnail((width, 180))
        canvas.paste(image, (x, y + (180 - image.height) // 2))
    draw.text((x + 8, y + 184), Path(name).stem, font=font, fill="#d5e9ff")
canvas.save(out / "contact.png")
