import {pathToFileURL} from 'node:url';
import {engineDir,packDir} from './tools/paths.mjs';import {join} from 'node:path';
process.env.PACK_DIR??=packDir;const {releaseData}=await import(pathToFileURL(join(engineDir,'tools/release-data.ts')).href);
export default {plugins:[releaseData()],resolve:{alias:{'@engine':engineDir,vitest:join(engineDir,'node_modules/vitest/dist/index.js')}},test:{environment:'node',include:['tests/**/*.test.ts'],testTimeout:20000,hookTimeout:30000}};
