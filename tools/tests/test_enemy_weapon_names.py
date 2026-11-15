import copy,json,sys,unittest
from pathlib import Path
TOOLS=Path(__file__).resolve().parents[1];sys.path.insert(0,str(TOOLS))
from port_enemy_weapon_names import contract,patch_output,PACK_DIR,APPROVED
from apply_balance_v2 import generated
class EnemyNamesTests(unittest.TestCase):
 def test_exact_85_names_and_23_special_names_match_all_original_characters(self):
  c=contract();rows=json.loads((PACK_DIR/'data/weapons.json').read_text(encoding='utf-8'));wm={r['id']:r for r in rows}
  self.assertEqual(len(c['names']),85);self.assertEqual(len(c['specials']),23)
  for id,name in c['names'].items():self.assertEqual(wm[id]['name'],name)
  for row in c['specials']:self.assertEqual(wm['zako-special-'+row['family']]['name'],row['name'])
 def test_overlay_and_balance_generation_are_idempotent_and_detect_missing_fields(self):
  output=generated();before=copy.deepcopy(output);patch_output(output);self.assertEqual(output,before)
  for path,value in output.items():self.assertEqual(json.loads(path.read_text(encoding='utf-8-sig')),value,str(path))
  altered=copy.deepcopy(output);next(w for w in altered[PACK_DIR/'data/weapons.json'] if w['id']=='zako-special-'+contract()['specials'][0]['family'])['name']='altered';patch_output(altered);self.assertEqual(altered,output)
 def test_every_family_including_later_episodes_has_exactly_one_special(self):
  c=contract();rows=json.loads((PACK_DIR/'data/mechs.json').read_text(encoding='utf-8'))
  for row in c['specials']:
   matches=[m for m in rows if m['id'].startswith(row['family']+'-episode-')]
   self.assertTrue(matches)
   for m in matches:self.assertEqual(m['weapons'].count('zako-special-'+row['family']),1)
if __name__=='__main__':unittest.main()
