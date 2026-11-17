/** Image-only overlay: preserve the original pack/site and every compiled code byte. */
import {readdir,readFile,writeFile,mkdir,cp,rm,lstat,realpath} from 'node:fs/promises';
import {resolve,dirname,join,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const here=dirname(fileURLToPath(import.meta.url)),sample=resolve(here,'../..');
const source=resolve(sample,'tools/out/release/site'),target=resolve(sample,'tools/out/release/site-o-handsome'),pack=resolve(sample,'pack');
const digest=b=>createHash('sha256').update(b).digest('hex');
async function walk(dir,prefix=''){const out=[];for(const d of await readdir(dir,{withFileTypes:true})){const p=prefix+d.name;if(d.isSymbolicLink())throw Error('Symlink not allowed: '+p);if(d.isDirectory())out.push(...await walk(join(dir,d.name),p+'/'));else if(d.isFile())out.push(p);}return out.sort();}
async function snapshot(dir){const rows={};for(const p of await walk(dir))rows[p]=digest(await readFile(join(dir,p)));return rows;}
const protectedBefore={pack:await snapshot(pack),site:await snapshot(source)};
const spec=JSON.parse(await readFile(join(here,'overlay.json'),'utf8'));
// Check final absolute paths before the sole recursive removal. Never follow a target symlink.
if(target!==join(dirname(source),'site-o-handsome')||target===source||target===pack||relative(dirname(source),target)!=='site-o-handsome')throw Error('Unsafe overlay output');
await realpath(source);try{if((await lstat(target)).isSymbolicLink())throw Error('Output is a symlink');}catch(e){if(e.code!=='ENOENT')throw e;}
const files=await walk(source);
const overlays=[];
for(const row of spec.files){
 const input=resolve(here,row.source),dest=resolve(target,row.site_path);
 if(!input.startsWith(here+sep)||!dest.startsWith(target+sep)||!row.site_path.startsWith('packs/saw/art/'))throw Error('Overlay path escapes allowed roots');
 const bytes=await readFile(input);if(digest(bytes)!==row.sha256)throw Error('Overlay hash mismatch: '+row.source);
 if(!files.includes(row.site_path))throw Error('Overlay must replace an existing media path: '+row.site_path);
 overlays.push({...row,bytes});
}
await rm(target,{recursive:true,force:true});await cp(source,target,{recursive:true,force:true});
for(const row of overlays)await writeFile(join(target,row.site_path),row.bytes);
const changes=[];const byPath=new Map(overlays.map(r=>['/'+r.site_path,r]));
const game=JSON.parse(await readFile(join(pack,'game.json'),'utf8'));
for(const name of files.filter(p=>p.startsWith('assets/')&&p.endsWith('.json'))){
 const bundle=JSON.parse(await readFile(join(target,name),'utf8'));let changed=false;
 for(const [key,data] of Object.entries(bundle)){
  if(key.endsWith('/assets.json')&&data?.entries){
   const refreshed=[];for(const [path,entry]of Object.entries(data.entries)){const row=byPath.get(path);if(row){entry.hash=row.sha256;entry.bytes=row.bytes.length;refreshed.push({path,hash:entry.hash,url:path+'?v='+entry.hash.slice(0,16)});}}
   if(refreshed.length!==overlays.length)throw Error('Incomplete media index');
   data.version=digest(JSON.stringify(data.entries)).slice(0,20);changed=true;changes.push({file:name,kind:'media-content-hashes',version:data.version,refreshed});
  }
  if(key.endsWith('/art-info.json')){
   for(const [id,path]of Object.entries(game.art.files)){const row=byPath.get('/packs/saw/'+path);if(row&&data[id]){data[id].bytes=row.bytes.length;changed=true;}}
  }
 }
 if(changed)await writeFile(join(target,name),JSON.stringify(bundle));
}
if(!changes.length)throw Error('Missing compiled media index');
const after=await snapshot(target),allowed=new Set([...overlays.map(r=>r.site_path),...changes.map(r=>r.file)]);
// art-info may share a metadata bucket; permit only that bucket after semantic verification above.
for(const name of files.filter(p=>p.startsWith('assets/')&&p.endsWith('.json'))){
 if(protectedBefore.site[name]!==after[name])allowed.add(name);
}
const changedFiles=Object.keys(after).filter(p=>after[p]!==protectedBefore.site[p]);
for(const p of changedFiles)if(!allowed.has(p))throw Error('Unexpected site mutation: '+p);
for(const p of files.filter(p=>/\.(js|css|html|mp4)$/.test(p)||p==='_headers'))if(after[p]!==protectedBefore.site[p])throw Error('Code/layout/video changed: '+p);
const protectedAfter={pack:await snapshot(pack),site:await snapshot(source)};
if(JSON.stringify(protectedBefore)!==JSON.stringify(protectedAfter))throw Error('Original edition changed during build');
const stats=[];for(const file of await walk(target))stats.push({file,bytes:(await lstat(join(target,file))).size});
if(stats.some(s=>s.bytes>25*1024*1024))throw Error('A static file exceeds25MiB');
const result={output:relative(sample,target).replaceAll('\\','/'),files:stats.length,bytes:stats.reduce((s,r)=>s+r.bytes,0),largest:stats.sort((a,b)=>b.bytes-a.bytes).slice(0,5),changedFiles,media:changes,originalPackUnchanged:true,originalSiteUnchanged:true,compiledCodeUnchanged:true,videosAndPostersUnchanged:overlays.every(r=>!r.site_path.includes('video')),headersUnchanged:true};
await writeFile(join(here,'build-report.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
