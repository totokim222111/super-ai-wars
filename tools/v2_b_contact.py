import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0,str(_Path(__file__).resolve().parent))
from paths import SAMPLE_ROOT, STUDIO_ROOT, ENGINE_DIR, PACK_DIR, STORY_DIR, SOURCE_DIR, ART_SOURCE_DIR, AUDIO_SOURCE_DIR, system_font, system_font
"""tools/v2_b_browser.mjs의 48장을 한 장으로 모은다. engine에서 실행한다."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

out = Path("tools/out/v2-b")
report = json.loads((out / "report.json").read_text(encoding="utf-8"))
contact = Image.new("RGB", (1280, 12 * 218 + 40), "#080d18")
draw = ImageDraw.Draw(contact)
font_path = Path(system_font())
font = ImageFont.truetype(str(font_path), 14) if font_path.exists() else ImageFont.load_default()
draw.text((12, 9), "v2 B / ally launch | ally impact | enemy launch | enemy impact", font=font, fill="white")
for row in range(12):
    ally, enemy = report["results"][row * 2:row * 2 + 2]
    y = 40 + row * 218
    for col, path in enumerate([ally["launch"], ally["impact"], enemy["launch"], enemy["impact"]]):
        with Image.open(path) as source:
            thumb = source.convert("RGB")
            thumb.thumbnail((320, 180))
            contact.paste(thumb, (col * 320, y))
    draw.text((12, y + 184), ally["template"] + " / " + ally["label"], font=font, fill="#d1e9ff")
contact.save(out / "contact.png")
