import {engineURL} from './paths.mjs';const source=await import(new URL('tools/story_outlines.mjs',engineURL));export const outlineStory=source.outlineStory;
