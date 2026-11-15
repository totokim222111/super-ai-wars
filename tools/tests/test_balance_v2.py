import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
TOOLS=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(TOOLS))
from apply_balance_v2 import generated,PACK_DIR

class ApprovedBalanceTests(unittest.TestCase):
    def test_approved_generation_is_idempotent_and_read_only(self):
        outputs=generated()
        before={p:p.read_bytes() for p in outputs}
        for path,value in outputs.items():
            self.assertEqual(json.loads(before[path]),value,str(path))
        self.assertEqual(before,{p:p.read_bytes() for p in outputs})

    def test_check_rejects_one_wrong_weapon_power_without_repairing_it(self):
        with tempfile.TemporaryDirectory() as folder:
            pack=Path(folder)
            for src in PACK_DIR.rglob('*.json'):
                rel=src.relative_to(PACK_DIR)
                if rel.parts[0] in ['art','audio']:continue
                dest=pack/rel;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(src.read_bytes())
            path=pack/'data/weapons.json'
            rows=json.loads(path.read_text(encoding='utf8'));rows[0]['power']+=1
            path.write_text(json.dumps(rows,ensure_ascii=False),encoding='utf8');before=path.read_bytes()
            result=subprocess.run([sys.executable,str(TOOLS/'apply_balance_v2.py'),'--check'],env={**os.environ,'PACK_DIR':str(pack),'PYTHONUTF8':'1'},capture_output=True,text=True,encoding='utf8')
            self.assertNotEqual(result.returncode,0)
            self.assertIn('balance v2 mismatch',result.stderr+result.stdout)
            self.assertEqual(path.read_bytes(),before)

    def test_missing_explicit_contract_is_not_silently_replaced(self):
        with tempfile.TemporaryDirectory() as folder:
            result=subprocess.run([sys.executable,str(TOOLS/'apply_balance_v2.py'),'--check'],env={**os.environ,'BALANCE_V2_FILE':str(Path(folder)/'missing.json'),'PYTHONUTF8':'1'},capture_output=True,text=True,encoding='utf8')
            self.assertNotEqual(result.returncode,0)
            self.assertIn('FileNotFoundError',result.stderr)

if __name__=='__main__':unittest.main()
