import {pathToFileURL} from 'node:url';import {join} from 'node:path';import {engineDir,packDir} from './paths.mjs';
process.env.PACK_DIR??=packDir;
const vite=await import(pathToFileURL(join(engineDir,'node_modules/vite/dist/node/index.js')).href);
export const createServer=(options={})=>vite.createServer({...options,root:engineDir});
export const preview=(options={})=>vite.preview({...options,root:engineDir});
const playwright=await import(pathToFileURL(join(engineDir,'node_modules/playwright-core/index.mjs')).href);
export const chromium=playwright.chromium;

const browserTools=await import(pathToFileURL(join(engineDir,'tools/browser.mjs')).href);export const findBrowser=browserTools.findBrowser;
