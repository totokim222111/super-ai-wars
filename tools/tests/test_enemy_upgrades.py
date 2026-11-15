import unittest,sys,json,copy,tempfile,os
from unittest.mock import patch
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from balance_adjust import upgrade_enemies,upgrade_adjustments
class EnemyUpgrades(unittest.TestCase):
 def test_per_stat_caps_replace_old_floor_and_leave_allies(self):
  values={'hp':7,'en':7,'armor':5,'mobility':5,'weapons':2};overlay={'episodes':[{'episode':7,'levels':{k:{'value':v}for k,v in values.items()}}]};units=[{'side':'enemy','upgrades':{'hp':9,'weapons':7}},{'side':'enemy'},{'side':'player','upgrades':{'hp':1}}];upgrade_enemies(units,7,overlay)
  self.assertEqual(units[0]['upgrades'],values);self.assertEqual(units[1]['upgrades'],values);self.assertEqual(units[2]['upgrades'],{'hp':1})
 def test_contract_requires_all_episode_numbers_and_reason(self):
  with self.assertRaises(ValueError):upgrade_adjustments(lambda _: {'schemaVersion':'enemy-upgrades-1','episodes':[]},{})
 def test_only_the_final_authorized_policy_and_exact_levels_are_accepted(self):
  base=json.loads((Path(__file__).resolve().parents[1]/'balance-v2-approved.json').read_text(encoding='utf8'))['enemyUpgrades']
  with tempfile.NamedTemporaryFile()as f,patch.dict(os.environ,{'ENEMY_UPGRADE_FILE':f.name}):
   for divisor,cap,reduction in [(2,2,0)]:
    value=copy.deepcopy(base);value['policy']={'weaponDivisor':divisor,'armorMobilityDivisor':cap,'lateHpEnReduction':reduction}
    for row in value['episodes']:
     n=row['episode'];hp=n-(reduction if n>=8 else 0)
     for k,v in {'hp':hp,'en':hp,'armor':n//cap,'mobility':n//cap,'weapons':n//divisor}.items():row['levels'][k]['value']=v
    self.assertEqual(upgrade_adjustments(lambda _:value,{}),value)
    wrong=copy.deepcopy(value);wrong['episodes'][0]['levels']['hp']['value']=0
    with self.assertRaises(ValueError):upgrade_adjustments(lambda _:wrong,{})
   wrong=copy.deepcopy(base);wrong['policy']['armorMobilityDivisor']=3
   with self.assertRaises(ValueError):upgrade_adjustments(lambda _:wrong,{})
