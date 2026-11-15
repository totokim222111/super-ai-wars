import json
import unittest
from pathlib import Path
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[2]


class PropAtlasTest(unittest.TestCase):
    def test_all_66_prop_crops_preserve_source_pixels(self):
        root = ROOT / 'pack'
        game = json.loads((root / 'game.json').read_text(encoding='utf-8'))
        count = 0
        for setting, path in game['maps'].items():
            theme = json.loads((root / path).read_text(encoding='utf-8'))
            spec = theme['propsAtlas']
            atlas = Image.open(root / game['art']['files'][spec['art']]).convert('RGBA')
            for key, (x, y, w, h) in spec['rects'].items():
                source = root / 'art/maps' / setting / (key.removeprefix(f'map-{setting}-') + '.webp')
                original = Image.open(source).convert('RGBA')
                crop = atlas.crop((x, y, x+w, y+h))
                # 완전 투명한 픽셀의 RGB는 화면에 영향을 주지 않는다.
                a = Image.new('RGBA', crop.size)
                b = Image.new('RGBA', crop.size)
                a.alpha_composite(original)
                b.alpha_composite(crop)
                self.assertTrue(all(high == 0 for low, high in ImageChops.difference(a, b).getextrema()), key)
                count += 1
        self.assertEqual(count, 66)


if __name__ == '__main__':
    unittest.main()
