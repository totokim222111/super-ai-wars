import copy,json,sys,unittest
from pathlib import Path
TOOLS=Path(__file__).resolve().parents[1];sys.path.insert(0,str(TOOLS))
from hit_adjust import modifiers,contract,patch
from apply_balance_v2 import generated
from paths import PACK_DIR
read=lambda p:json.loads(p.read_text(encoding='utf-8'))
class HitAdjustmentTests(unittest.TestCase):
 def test_cost_strongest_finisher_bands_and_ordinary_ranged(self):
  c=read(TOOLS/'balance-v2-approved.json')['hitAdjustments'];ws=[{'id':id,'kind':kind,'power':power,'hit':-5,**extra}for id,kind,power,extra in [('free','melee',100,{}),('paid','melee',150,{'ammo':10}),('best','melee',200,{}),('normal','shoot',200,{}),('low','shoot',300,{'finisher':True,'moraleReq':105}),('mid','melee',400,{'finisher':True,'moraleReq':115}),('high','map',500,{'finisher':True,'moraleReq':125}),('top','shoot',600,{'finisher':True,'moraleReq':130}),('pico','shoot',700,{'finisher':True,'moraleReq':100})]]
  ms=[{'id':'mech','weapons':[w['id']for w in ws if w['id']!='pico']},{'id':c['finisher']['finalBossMechs'][0],'weapons':['pico']}]
  self.assertEqual(modifiers(ws,ms,c),{'free':15,'paid':20,'best':25,'low':20,'mid':30,'high':40,'top':50,'pico':50})
 def test_generated_rows_are_idempotent_and_critical_is_untouched(self):
  out=generated();saved=out[TOOLS/'balance-v2-approved.json'];ws=copy.deepcopy(out[PACK_DIR/'data/weapons.json']);stages=copy.deepcopy(out[PACK_DIR/'balance-stages.json']);patch(out,PACK_DIR,saved['hitAdjustments']);self.assertEqual(ws,out[PACK_DIR/'data/weapons.json']);self.assertEqual(stages,out[PACK_DIR/'balance-stages.json']);self.assertEqual(out[PACK_DIR/'game.json']['battleRules']['meleeHitBonus'],0)
if __name__=='__main__':unittest.main()
