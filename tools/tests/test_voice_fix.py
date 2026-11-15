import json,os,subprocess,sys,tempfile,unittest
from pathlib import Path
TOOLS=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(TOOLS))
from port_voice_fix import contract,generated,replace_rows,PACK_DIR,APPROVED

class VoiceFixTests(unittest.TestCase):
 def test_all_180_rows_round_trip_and_originals_stay_read_only(self):
  c=contract();self.assertEqual(len(c['rows']),180)
  self.assertEqual(sum(r['id'].startswith('S')for r in c['rows']),157)
  for path,value in generated().items():
   actual=path.read_text(encoding='utf8');self.assertEqual(actual if isinstance(value,str)else json.loads(actual),value,str(path))

 def test_original_text_wins_over_shifted_line_and_duplicate_requires_id(self):
  row={'id':'S02-99','before':'젬짱(웃음): 원래 글','after':'젬짱(미소): 승인 글'}
  self.assertEqual(replace_rows('머리\n'+row['before']+'\n',[row]),'머리\n'+row['after']+'\n')
  row['id']='S02-3';text=row['before']+'\n사이\n'+row['before']+'\n'
  self.assertEqual(replace_rows(text,[row]),row['before']+'\n사이\n'+row['after']+'\n')
  row['id']='S02-99'
  with self.assertRaisesRegex(ValueError,'ambiguous'):replace_rows(text,[row])
  with self.assertRaisesRegex(ValueError,'not found'):replace_rows('다른 줄\n',[row])

 def test_check_rejects_changed_story_battle_and_combo_without_repair(self):
  with tempfile.TemporaryDirectory()as folder:
   pack=Path(folder)
   names=['cast.json','game.json','players.json','rules.json','units.json','data/weapons.json','data/mechs.json','data/pilots.json','gallery.json','story/carbon-audit.json','battle-lines/combos.json','battle-lines/import-audit.json']+[f'story/ep{n:02}.story'for n in range(1,16)]
   for name in names:
    p=pack/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((PACK_DIR/name).read_bytes())
   cmd=[sys.executable,'-X','utf8',str(TOOLS/'port_voice_fix.py'),'--check'];env={**os.environ,'PACK_DIR':str(pack)}
   self.assertEqual(subprocess.run(cmd,env=env,capture_output=True).returncode,0)
   for name,mutate in [
    ('story/ep02.story',lambda s:s.replace('꺄아아악! 비켜, 다 비켜!','꺄아아악! 비켜, 다 비켜!!',1)),
    ('cast.json',lambda s:s.replace('자동완성보다 빠르게! 내가 먼저 쏜다~!','자동완성보다 빠르게! 내가 먼저 쏜다~!!',1)),
    ('battle-lines/combos.json',lambda s:s.replace('멀티모달 관측 에너지 충전 끝!','멀티모달 관측 에너지 충전 끝!!',1))]:
    p=pack/name;before=p.read_bytes();p.write_bytes(mutate(before.decode()).encode());wrong=p.read_bytes();self.assertNotEqual(wrong,before)
    self.assertNotEqual(subprocess.run(cmd,env=env,capture_output=True).returncode,0);self.assertEqual(p.read_bytes(),wrong);p.write_bytes(before)
