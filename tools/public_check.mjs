/** Public compiled contract: raw workshop manuscripts are deliberately not distributed. */
import {readFile} from 'node:fs/promises';import {resolve,sep} from 'node:path';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('../',import.meta.url))),contract=JSON.parse(await readFile(new URL('./public-contracts.json',import.meta.url),'utf8'));
for(const row of contract.files){const file=resolve(root,row.path);if(!file.startsWith(root+sep))throw Error('Unsafe public contract path');const bytes=await readFile(file);if(createHash('sha256').update(bytes).digest('hex')!==row.sha256)throw Error('Public compiled contract mismatch: '+row.path);}
console.log(`공개 컴파일 데이터·이름·대사·어셋 대조 완료: ${contract.files.length} 파일 (원고 불포함)`);
