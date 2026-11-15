import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0,str(_Path(__file__).resolve().parent))
from paths import SAMPLE_ROOT, STUDIO_ROOT, ENGINE_DIR, PACK_DIR, STORY_DIR, SOURCE_DIR, ART_SOURCE_DIR, AUDIO_SOURCE_DIR
"""기존 256px 소품을 무손실 아틀라스로 합친다. 개별 원본은 그대로 보관한다."""
import json
from pathlib import Path
from PIL import Image

ROOT = SAMPLE_ROOT


def main():
    root = PACK_DIR
    game = json.loads((root / 'game.json').read_text(encoding='utf-8'))
    files = game['art']['files']
    report = ROOT / 'tools/out/release-cleanup/excluded-art.json'
    excluded = json.loads(report.read_text(encoding='utf-8'))['excluded'] if report.exists() else []
    for name, path in game['maps'].items():
        dest = root / path
        theme = json.loads(dest.read_text(encoding='utf-8'))
        props = list(dict.fromkeys(p for tile in theme['tiles'].values() for p in tile.get('props', [])))
        atlas = Image.new('RGBA', (1024, 768))
        rects = {}
        for i, prop in enumerate(props):
            source = PACK_DIR / 'art' / 'maps' / name / (prop.removeprefix('map-' + name + '-') + '.webp')
            image = Image.open(source).convert('RGBA')
            assert image.size == (256, 256), source
            x, y = i % 4 * 256, i // 4 * 256
            atlas.paste(image, (x, y))
            rects[prop] = [x, y, 256, 256]
            old = files.pop(prop, None)
            if old:
                excluded.append(old)
        art = 'map-' + name + '-props'
        url = 'art/maps/' + name + '/props.webp'
        atlas.save(root / url, lossless=True, method=6)
        files[art] = url
        theme['propsAtlas'] = {'art': art, 'width': 1024, 'height': 768, 'rects': rects}
        dest.write_text(json.dumps(theme, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        old = files.pop('map-' + name + '-ground', None)
        if old:
            excluded.append(old)
    aliases = {
        'gpi-bust': 'bust-gpi', 'gpi-bust-attack': 'bust-gpi', 'gpi-bust-smile': 'bust-gpi', 'gpi-bust-hit': 'bust-gpi',
        'otaku-bust': 'bust-otaku', 'otaku-bust-shock': 'bust-otaku', 'otaku-bust-serious': 'bust-otaku',
        'mech-omni-luna-sd': 'mech-gpi-generation-1', 'mech-commander-sd': 'mech-player-real-generation-1',
        'mech-spam-bot-sd': 'mech-spam-bot', 'mech-clickbait-sd': 'mech-clickbait-drone',
        'icon-omni-luna': 'mech-gpi-generation-1', 'icon-commander': 'mech-player-real-generation-1',
        'icon-spam-bot': 'mech-spam-bot', 'icon-clickbait': 'mech-clickbait-drone',
        'spam-portrait': 'portrait-spam-bot', 'spam-portrait-hit': 'portrait-spam-bot',
    }
    for key, target in aliases.items():
        if key in files:
            if files[key] != files[target]:
                excluded.append(files[key])
            files[key] = files[target]
    (root / 'game.json').write_text(json.dumps(game, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    out = ROOT / 'tools/out/release-cleanup'
    out.mkdir(parents=True, exist_ok=True)
    (out / 'excluded-art.json').write_text(json.dumps({'aliases': aliases, 'excluded': sorted(set(excluded)), 'originals': 'pack/art/ (빌드에서만 제외)'}, ensure_ascii=False, indent=2), encoding='utf-8')
    print('6 atlases; source files preserved; registered art URLs:', len(set(files.values())))


if __name__ == '__main__':
    main()
