import {describe,it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,copyFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {execFileSync} from 'node:child_process';
describe('portable sample entry paths',()=>{
 it('chooses studio ../../engine, public ./engine, or ENGINE_DIR; keeps STORY_DIR configurable',async()=>{
  const temp=await mkdtemp(join(tmpdir(),'srpg-layout-')),sample=join(temp,'games/sample'),tools=join(sample,'tools');await mkdir(tools,{recursive:true});await copyFile('tools/paths.mjs',join(tools,'paths.mjs'));
  const env={...process.env};delete env.ENGINE_DIR;delete env.STORY_DIR;const script='import {engineDir,storyDir} from '+JSON.stringify(pathToFileURL(join(tools,'paths.mjs')).href)+';console.log(JSON.stringify({engineDir,storyDir}));';
  const read=(extra:Record<string,string>={})=>JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',script],{cwd:sample,env:{...env,...extra},encoding:'utf8'}));
  try{await mkdir(join(temp,'engine'));await writeFile(join(temp,'engine/package.json'),'{}');expect(read()).toEqual({engineDir:join(temp,'engine'),storyDir:join(temp,'story')});
   await rm(join(temp,'engine'),{recursive:true,force:true});await mkdir(join(sample,'engine'));await writeFile(join(sample,'engine/package.json'),'{}');expect(read().engineDir).toBe(join(sample,'engine'));
   expect(read({ENGINE_DIR:'./alternate',STORY_DIR:'./manuscript'})).toEqual({engineDir:resolve(sample,'alternate'),storyDir:resolve(sample,'manuscript')});
  }finally{if(!resolve(temp).startsWith(resolve(tmpdir())))throw Error('Unsafe temporary cleanup');await rm(temp,{recursive:true,force:true});}
 });
});
