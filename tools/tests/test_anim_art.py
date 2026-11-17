"""Atlas tool checks use temporary media only; production inputs stay read-only."""
import importlib.util,json,tempfile,unittest
from pathlib import Path
from PIL import Image

tool=Path(__file__).resolve().parents[1]/'pack_anim_art.py'
spec=importlib.util.spec_from_file_location('pack_anim_art_test',tool)
atlas=importlib.util.module_from_spec(spec);spec.loader.exec_module(atlas)

class AnimationAtlasTests(unittest.TestCase):
    def test_rejects_source_paths_outside_cut(self):
        with tempfile.TemporaryDirectory()as temp:
            root=Path(temp);(root/'manifest.json').write_text(json.dumps([{'id':'hammer','kind':'prop','file':'../other.png'}]),encoding='utf8')
            with self.assertRaisesRegex(ValueError,'cut PNG'):atlas.prepare(root)

    def test_packing_is_deterministic_and_rectangles_do_not_overlap(self):
        rows=[{'id':str(i),'image':Image.new('RGBA',(size,size//2))}for i,size in enumerate([1024,768,512,512,320,192,96])]
        first,count=atlas.pack(rows);self.assertEqual(atlas.pack(list(reversed(rows))),(first,count))
        for i,a in enumerate(rows):
            page,x,y=first[a['id']];self.assertLessEqual(x+a['image'].width+atlas.PAD,atlas.EDGE);self.assertLessEqual(y+a['image'].height+atlas.PAD,atlas.EDGE)
            for b in rows[i+1:]:
                p,xx,yy=first[b['id']]
                if page==p:self.assertTrue(x+a['image'].width<=xx or xx+b['image'].width<=x or y+a['image'].height<=yy or yy+b['image'].height<=y)

    def test_public_check_detects_a_changed_page_without_raw_png(self):
        with tempfile.TemporaryDirectory()as temp:
            root=Path(temp);path=root/'page.webp';Image.new('RGBA',(8,8),'red').save(path,'WEBP')
            data={'version':1,'pages':{'page':{'file':'art/page.webp','width':8,'height':8,'sha256':atlas.sha(path.read_bytes())}}}
            (root/'atlas.json').write_text(json.dumps(data),encoding='utf8');self.assertEqual(atlas.verify_shipped(root),data)
            path.write_bytes(path.read_bytes()+b'changed')
            with self.assertRaisesRegex(ValueError,'atlas hash'):atlas.verify_shipped(root)

if __name__=='__main__':unittest.main()
