import {resolve,dirname,join} from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';import {existsSync} from 'node:fs';
export const sampleDir=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const studioDir=resolve(sampleDir,'../..');
export const engineDir=resolve(process.env.ENGINE_DIR??(existsSync(join(studioDir,'engine/package.json'))?join(studioDir,'engine'):join(sampleDir,'engine')));
export const packDir=resolve(process.env.PACK_DIR??join(sampleDir,'pack'));
export const storyDir=resolve(process.env.STORY_DIR??join(studioDir,'story'));
export const storyURL=pathToFileURL(storyDir+'/');
export const engineURL=pathToFileURL(engineDir+'/');
export const sampleURL=pathToFileURL(sampleDir+'/');
