import {it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {testPack} from './pack-fixture';
it('binds five finished videos, effect-only combo ducking and the pre-finale before any introduction dialogue',async()=>{
 const p=testPack,c=p.game.cinematics!;expect(c.opening).toEqual({id:'opening',when:'title'});
 expect(Object.keys(c.videos)).toHaveLength(5);for(const [id,v]of Object.entries(c.videos)){expect(v.music).toBe(id.startsWith('combo-')?'duck':'mute');expect(p.game.art.files[v.fallback!]).toBeTruthy();const b=await readFile('pack/video/'+id+'.mp4');expect(b.toString('ascii',4,8)).toBe('ftyp');}
 for(const [w,v]of [['balance-combo-context-horizon','combo-context-horizon'],['balance-combo-user-gpi','combo-omni-prompt-drive'],['balance-combo-architecture-symphony','combo-architecture-symphony']])expect(p.weapons[w].video).toBe(v);
 expect(p.stories.ep15.scenes['도입'][0]).toEqual({do:'video',id:'pre-finale'});
});
