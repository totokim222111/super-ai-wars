import copy,json,sys,unittest
from pathlib import Path
TOOLS=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(TOOLS))
from apply_balance_v2 import contract,generated,read,APPROVED
from balance_adjust import adjusted,adjustments
class AdjustmentBounds(unittest.TestCase):
 def setUp(self):
  self.proposal,_=contract();self.overlay,_=adjustments(read,read(APPROVED))
 def rejects(self,edit):
  a=copy.deepcopy(self.overlay);edit(a)
  with self.assertRaises((ValueError,KeyError)):adjusted(self.proposal,a)
 def test_overlay_does_not_mutate_approved_proposal(self):
  before=copy.deepcopy(self.proposal);d=adjusted(self.proposal,self.overlay);self.assertEqual(self.proposal,before)
  for row in self.overlay['bossHp']:
   e=str(row['episode']);self.assertEqual(d['enemyStageCurves'][e][row['id']]['base']['hp'],row['hp']['value'])
 def test_hp_ceiling_and_untouched_grunts(self):
  row=self.overlay['bossHp'][0];base=self.proposal['enemyStageCurves'][str(row['episode'])][row['id']]['base']['hp']
  self.rejects(lambda a:a['bossHp'][0]['hp'].update(value=base*2))
  self.rejects(lambda a:a['bossHp'][0]['hp'].update(value=base-1))
  self.rejects(lambda a:a['bossHp'].append({'episode':1,'id':'spam-bot-episode-1','hp':{'value':5500,'reason':'forbidden grunt'}}))
 def test_weapon_power_range_temperature_and_unknown_field_bounds(self):
  power=next(i for i,w in enumerate(self.overlay['weapons'])if 'power'in w);heat=next(i for i,w in enumerate(self.overlay['weapons'])if 'moraleReq'in w);span=next(i for i,w in enumerate(self.overlay['weapons'])if 'rangeMax'in w)
  self.rejects(lambda a:a['weapons'][power]['power'].update(value=999999))
  self.rejects(lambda a:a['weapons'][heat]['moraleReq'].update(value=114))
  self.rejects(lambda a:a['weapons'][span]['rangeMax'].update(value=99))
  self.rejects(lambda a:a['weapons'][0].update(hit={'value':99,'reason':'forbidden'}))
 def test_reasons_and_unique_weapon_ids_required(self):
  self.rejects(lambda a:a['bossHp'][0]['hp'].update(reason=''))
  self.rejects(lambda a:a['weapons'].append(a['weapons'][0]))
if __name__=='__main__':unittest.main()


class NumericReferenceTests(unittest.TestCase):
 def test_numeric_contract_rejects_grunt_double_actions_and_out_of_range_ratio(self):
  from balance_adjust import numeric_adjustments
  from unittest.mock import patch
  import tempfile,os,json,copy
  base=json.loads((Path(__file__).resolve().parents[1]/'balance-v2-approved.json').read_text(encoding='utf8'))['numericAdjustments']
  with tempfile.NamedTemporaryFile()as f,patch.dict(os.environ,{'BALANCE_NUMERIC_FILE':f.name}):
   self.assertEqual(numeric_adjustments(lambda _:base,{}),base)
   for key,value in [('ratio',.95),('actionCap',2)]:
    wrong=copy.deepcopy(base);target=next(v for v in wrong['pilotBalance']['targets']['saw-01'].values()if v['category']=='grunt');target[key]=value
    with self.assertRaises(ValueError):numeric_adjustments(lambda _:wrong,{})
