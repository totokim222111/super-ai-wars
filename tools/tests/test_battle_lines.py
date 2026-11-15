import copy
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
TOOLS=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(TOOLS))
from port_battle_lines import generate,sections,PACK_DIR,STORY_DIR

class BattleLinesTest(unittest.TestCase):
    def test_all_source_text_is_verbatim_and_check_is_reproducible(self):
        before={p:p.read_bytes() for p in (STORY_DIR/'carbon').glob('battle-lines-*.md')}
        output=generate()
        for path,value in output.items():
            self.assertEqual(json.loads(path.read_text(encoding='utf-8')),value,str(path))
        for p,data in before.items():self.assertEqual(p.read_bytes(),data)
        rows=sections(STORY_DIR/'carbon')
        self.assertEqual(sum(len(lines) for section in rows for _,lines in section['rows']),530)
        # Every authored utterance, including structural combo speaker prefixes, round-trips.
        archive=output[PACK_DIR/'battle-lines/combos.json']
        for section in rows:
            if not section['name'].startswith('합체기: '):continue
            name=section['name'][5:].split(' — ')[0]
            combo=next(c for c in archive['combos'] if c['name']==name)
            self.assertEqual(combo['finish']['speech']['text'],dict(section['rows'])['마무리'][0]['text'].split(' | ',1)[1])
    def test_check_rejects_one_changed_punctuation_character(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            for f in ['cast.json','game.json','players.json','rules.json','units.json','data/weapons.json','data/mechs.json']:
                dest=root/f;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes((PACK_DIR/f).read_bytes())
            output=generate(root,STORY_DIR)
            for path,value in output.items():
                path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(value,ensure_ascii=False),encoding='utf-8')
            env={**os.environ,'PACK_DIR':str(root),'STORY_DIR':str(STORY_DIR)}
            cmd=[sys.executable,'-X','utf8',str(TOOLS/'port_battle_lines.py'),'--check']
            self.assertEqual(subprocess.run(cmd,env=env,capture_output=True).returncode,0)
            path=root/'cast.json';data=json.loads(path.read_text(encoding='utf-8'));data['gpi']['battleLines']['attack'][0]['text']+='!';path.write_text(json.dumps(data,ensure_ascii=False),encoding='utf-8')
            self.assertNotEqual(subprocess.run(cmd,env=env,capture_output=True).returncode,0)
