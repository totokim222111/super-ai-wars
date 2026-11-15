"""Wave 5 pilot only: normalize selected built-in outputs, ingest, and make review sheets."""
from __future__ import annotations
import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0,str(_Path(__file__).resolve().parent))
from paths import SAMPLE_ROOT, STUDIO_ROOT, ENGINE_DIR, PACK_DIR, STORY_DIR, SOURCE_DIR, ART_SOURCE_DIR, AUDIO_SOURCE_DIR
import hashlib
import io
import json
import subprocess
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageOps
from art_ingest import ROOT, bbox, font, ingest, inspect_art, read_json, write_json

WAVE = ART_SOURCE_DIR / 'wave5'
OUT = ROOT / 'tools/out/wave5'
SELECTED = {
    'gpi-flat-apology': ('cg', 2), 'gray-locked-logout': ('cg', 2),
    'grok-timeline-run': ('cg', 1), 'talk-abyss': ('bg', 1), 'talk-dorm': ('bg', 1),
    'carbon-grandma-default': ('portrait', 1), 'carbon-grandma-hit': ('portrait', 1),
}
REFERENCES = {
    'gpi-flat-apology': ['public/v2/art/bust/gpi.webp', 'public/v2/art/bust/gpi-moods.webp', '../story/gpt-image/enemy-sheets-v01/characters/chatjip/master-illustration-v03.png', 'tools/out/wave5/ref-gpi.png', 'public/v2/art/cg-gpi-entrance.webp'],
    'gray-locked-logout': ['art-src/wave5/raw/talk-dorm-a1.png', 'public/v2/art/portrait/pico.webp', 'public/v2/art/portrait/pico-moods.webp', '../story/gpt-image/final-entities-v01/characters/pico/master-v01.png'],
    'grok-timeline-run': ['public/v2/art/bust/grok.webp', 'public/v2/art/bust/grok-moods.webp', '../story/gpt-image/enemy-sheets-v01/characters/grok/master-illustration-v03.png', 'tools/out/wave5/ref-grok.png', 'public/v2/art/cg-gpi-entrance.webp'],
    'talk-abyss': ['public/v2/art/bg/talk-tea-room.webp', 'public/v2/art/bg/talk-harbor.webp'],
    'talk-dorm': ['public/v2/art/bg/talk-tea-room.webp'],
    'carbon-grandma-default': ['public/v2/art/mech/bluecheck-drone.webp', 'public/v2/art/portrait/bluecheck-drone.webp', 'public/v2/art/portrait/predict-cube.webp'],
    'carbon-grandma-hit': ['art-src/wave5/raw/carbon-grandma-default-a1.png'],
}


def prepare():
    manifest = {'wave': 5, 'scope': 'pilot only; story binding deferred', 'generator': 'built-in image_gen',
                'spec': 'docs/v2-asset-spec.md', 'references': REFERENCES,
                'referenceNotes': 'Dots has no dedicated character directory in story/gpt-image; existing dedicated portrait+atlas used inside ref-gpi board. Carbon-grandma has no character sheet/bust: unmanned drone based on cast name and its current bluecheck-drone chassis. No human substitute.',
                'assets': [], 'generations': []}
    default = Image.open(WAVE/'raw/carbon-grandma-default-a1.png').convert('RGBA')
    hit = Image.open(WAVE/'raw/carbon-grandma-hit-a1.png').convert('RGBA')
    assert default.size == hit.size
    mask = np.maximum(np.asarray(default)[:, :, 3], np.asarray(hit)[:, :, 3])
    yy, xx = np.where(mask >= 8)
    region = (int(xx.min()), int(yy.min()), int(xx.max())+1, int(yy.max())+1)
    for name, (kind, attempt) in SELECTED.items():
        source = WAVE/f'raw/{name}-a{attempt}.png'
        image = Image.open(source)
        native = image.size
        if kind == 'portrait':
            tile = image.convert('RGBA').crop(region)
            tile.thumbnail((728, 728), Image.Resampling.LANCZOS)
            image = Image.new('RGBA', (768, 768))
            image.paste(tile, ((768-tile.width)//2, (768-tile.height)//2))
            dest = f'portrait/{name}.png'
            normalization = 'Shared union alpha crop and same uniform fit to 728px, centered on 768px RGBA; no repaint or expression alignment warp.'
        else:
            image = ImageOps.fit(image.convert('RGB'), (1600, 900), Image.Resampling.LANCZOS)
            dest = f'{kind}/{name}.png'
            normalization = 'Proportional Lanczos fit, tiny center crop to 1600x900 RGB; no repaint.'
        image.save(WAVE/dest)
        history = []
        for n in range(1, attempt+1):
            raw = WAVE/f'raw/{name}-a{n}.png'
            history.append({'attempt': n, 'raw': raw.relative_to(WAVE).as_posix(),
                            'prompt': f'prompts/{name}-a{n}.txt', 'sha256': hashlib.sha256(raw.read_bytes()).hexdigest(),
                            'selected': n == attempt})
        if attempt == 2:
            history[0]['rejection'] = 'Face/hands too close to dialogue region.' if name.startswith('gpi') else 'Pico shell too brightly lit; insufficient lurking shadow.'
            history[1]['references'] = [history[0]['raw'], *REFERENCES[name][1:]] if name.startswith('gray') else [history[0]['raw'], *REFERENCES[name][:4]]
        manifest['generations'].append({'key': name, 'attempts': attempt, 'history': history, 'nativeCanvas': native,
                                        'output': dest, 'normalization': normalization,
                                        'visualReview': {'identity': True, 'style': True, 'noTextOrLogos': True, 'anatomy': True,
                                                         'dialogueSafe': True if kind != 'portrait' else None}})
        if name == 'carbon-grandma-hit':
            continue
        ident = name.removeprefix('talk-').removesuffix('-default')
        entry = {'id': ident, 'kind': kind, 'source': dest}
        if kind == 'portrait':
            entry.update(cast='carbon-grandma', moods={'hit': 'portrait/carbon-grandma-hit.png'},
                         order=['default', 'hit'], alignMoods=False)
        manifest['assets'].append(entry)
    write_json(WAVE/'manifest.json', manifest)


def recompress():
    game = read_json(PACK_DIR / 'game.json')
    records = []
    targets = {'bust-mythos': 280, 'portrait-jepa-moods': 200, 'mech-gem-generation-4-ais': 200,
               'mech-qwen-generation-3': 200, 'mech-pico-form-1': 200}
    for ident, limit in targets.items():
        path = ROOT/'public'/game['art']['files'][ident].lstrip('/')
        backup = OUT/'before'/path.name
        backup.parent.mkdir(parents=True, exist_ok=True)
        if not backup.exists():
            backup.write_bytes(path.read_bytes())
        original = Image.open(backup).convert('RGBA')
        a = np.asarray(original).copy()
        a[a[:, :, 3] <= 2] = 0
        clean = Image.fromarray(a)
        for quality in range(80, 49, -1):
            stream = io.BytesIO()
            clean.save(stream, 'WEBP', quality=quality, alpha_quality=90, method=6, exact=True)
            data = stream.getvalue()
            if len(data) <= limit*1024:
                break
        assert len(data) <= limit*1024, ident
        ref = np.asarray(original).astype(float)
        decoded = np.asarray(Image.open(io.BytesIO(data)).convert('RGBA')).astype(float)
        visible = ref[:, :, 3] > 24
        rmse = float(np.sqrt(np.mean((ref[:, :, :3][visible]-decoded[:, :, :3][visible])**2)))
        assert rmse <= 7, (ident, rmse)
        assert np.array_equal(ref[:, :, 3][visible], decoded[:, :, 3][visible])
        path.write_bytes(data)
        records.append({'id': ident, 'file': path.relative_to(ROOT).as_posix(), 'generationAttempts': 0,
                        'before': backup.stat().st_size, 'bytes': len(data), 'quality': quality,
                        'visibleRGB_RMSE': round(rmse, 3), 'alphaPreservedAbove2': True,
                        'cleanup': 'Only RGB/alpha of alpha<=2 pixels zeroed; no blur, resizing, repaint, crop or shape change.'})
    write_json(WAVE/'recompression.json', records)


def register():
    units = (PACK_DIR / 'units.json').read_bytes()
    ingest(WAVE, register=True, replace=True, out=OUT)
    assert (PACK_DIR / 'units.json').read_bytes() == units, 'Unit data changed'
    atlas = Image.new('RGBA', (1536, 768))
    for i, mood in enumerate(['default', 'hit']):
        atlas.paste(Image.open(WAVE/f'portrait/carbon-grandma-{mood}.png'), (i*768, 0))
    atlas_path = PACK_DIR / 'art' / 'portrait/carbon-grandma-moods.webp'
    for quality in range(80, 59, -1):
        atlas.save(atlas_path, 'WEBP', quality=quality, alpha_quality=90, exact=True, method=6)
        if atlas_path.stat().st_size <= 200*1024:
            break
    assert atlas_path.stat().st_size <= 200*1024
    manifest = read_json(WAVE/'manifest.json')
    manifest['portraitAtlasEncoding'] = {'quality': quality, 'alpha_quality': 90, 'bytes': atlas_path.stat().st_size}
    manifest['recompression'] = 'recompression.json'
    manifest['reviewSheet'] = 'tools/out/wave5/pilot-sheet.png'
    for entry in manifest['assets']:
        prefix = 'talk-' if entry['kind'] == 'bg' else ''
        target = PACK_DIR/'art'/entry['kind']/(prefix+entry['id']+'.webp')
        with Image.open(target) as image:
            entry['output'] = {'file': target.relative_to(ROOT).as_posix(), 'canvas': image.size,
                               'mode': image.mode, 'bytes': target.stat().st_size, 'quality': 80,
                               'sha256': hashlib.sha256(target.read_bytes()).hexdigest()}
    for generation in manifest['generations']:
        for attempt in generation['history']:
            attempt['promptSha256'] = hashlib.sha256((WAVE/attempt['prompt']).read_bytes()).hexdigest()
    write_json(WAVE/'manifest.json', manifest)
    report = read_json(OUT/'wave5-report.json')
    for row in report:
        if row['id'] == 'carbon-grandma/moods':
            row['kb'] = round(atlas_path.stat().st_size/1024, 1)
            row['warnings'] = []
            row['quality'] = quality
    write_json(OUT/'wave5-report.json', report)
    path = PACK_DIR / 'game.json'
    game = read_json(path)
    gallery_path = PACK_DIR/game['gallery']
    gallery = read_json(gallery_path)
    assets = read_json(WAVE/'manifest.json')['assets']
    for a in assets:
        artid = {'bg': 'bg-', 'cg': 'cg-', 'portrait': 'portrait-'}[a['kind']]+a['id']
        if artid not in gallery['art']:
            gallery['art'].append(artid)
    if 'portrait-carbon-grandma-moods' not in gallery['moods']:
        gallery['moods'].append('portrait-carbon-grandma-moods')
    write_json(gallery_path, gallery)
    sheets = {c['moodSheet']['art']: c['moodSheet'] for c in read_json(PACK_DIR / 'cast.json').values() if c.get('moodSheet')}
    write_json(PACK_DIR/game['art']['metadata'], inspect_art({'files': game['art']['files'], 'sheets': sheets}))
    # Preserve each tracked JSON file's original newline convention, avoiding unrelated churn.
    for rel in ['cast.json', 'game.json', 'gallery.json', game['art']['metadata']]:
        target = PACK_DIR/rel
        original = subprocess.check_output(['git', 'show', 'HEAD:engine/content/packs/saw/'+rel], cwd=ROOT)
        if b'\r\n' in original:
            target.write_bytes(target.read_bytes().replace(b'\r\n', b'\n').replace(b'\n', b'\r\n'))


def contact():
    # Three comparisons, with all six pilot assets represented (portrait includes both cells).
    rows = [
        [('Existing Gpi bust', 'public/v2/art/bust/gpi.webp'), ('NEW Gpi apology', 'public/v2/art/cg/gpi-flat-apology.webp'), ('Existing entrance CG', 'public/v2/art/cg-gpi-entrance.webp')],
        [('Existing tea room', 'public/v2/art/bg/talk-tea-room.webp'), ('NEW dorm', 'public/v2/art/bg/talk-dorm.webp'), ('NEW abyss', 'public/v2/art/bg/talk-abyss.webp')],
        [('NEW locked logout', 'public/v2/art/cg/gray-locked-logout.webp'), ('NEW Grok ending', 'public/v2/art/cg/grok-timeline-run.webp'), ('NEW grandma default / hit', 'public/v2/art/portrait/carbon-grandma-moods.webp')],
    ]
    canvas = Image.new('RGB', (2400, 1485), '#182134')
    d = ImageDraw.Draw(canvas)
    for row, cells in enumerate(rows):
        for col, (label, path) in enumerate(cells):
            x, y = col*800, row*495
            d.text((x+16, y+8), label, font=font(21), fill='#e4edff')
            im = Image.open(ROOT/path).convert('RGBA')
            im.thumbnail((788, 447), Image.Resampling.LANCZOS)
            canvas.paste(im, (x+(800-im.width)//2, y+43+(447-im.height)//2), im)
    canvas.save(OUT/'pilot-sheet.png')
    records = read_json(WAVE/'recompression.json')
    comp = Image.new('RGB', (1500, len(records)*370), '#253047')
    draw = ImageDraw.Draw(comp)
    for i, record in enumerate(records):
        draw.text((8, i*370+4), record['id']+' | before / after', font=font(18), fill='white')
        for col, path in enumerate([OUT/'before'/Path(record['file']).name, ROOT/record['file']]):
            im = Image.open(path).convert('RGBA'); im.thumbnail((740, 330))
            comp.paste(im, (col*750+(750-im.width)//2, i*370+35), im)
    comp.save(OUT/'recompression-sheet.png')


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    prepare()
    recompress()
    register()
    contact()
    print('Pilot normalized and registered; compression and comparison sheets written.')
