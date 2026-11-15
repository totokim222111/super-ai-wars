import {memoryStoryState as memoryState} from '@engine/src/v2/story/play';
import {readFile} from '../tools/files.mjs';
import {loadPack,packLookup,type Pack} from '@engine/src/v2/pack/load';
import {createBattle,type Stage} from '@engine/src/core';
import {buildSample as sample,type Images} from '@engine/src/v2/gallery/sample';
export type {Sample} from '@engine/src/v2/gallery/sample';
import tactics from './fixtures/tactics.json';
import trial from './fixtures/trial-campaign.json';
export const testPack:Pack=await loadPack('content/packs/saw',p=>readFile(p,'utf8'));
if(testPack.errors.length)throw Error(JSON.stringify(testPack.errors));
export const content=testPack.rules;
export const sawCampaignContent={...testPack.campaign,nodes:[{type:'stage' as const,id:'saw-01'},{type:'intermission' as const},{type:'stage' as const,id:'saw-02'},{type:'intermission' as const}],stages:tactics as unknown as Pack['campaign']['stages']};
export const campaignContent={...sawCampaignContent,...trial}as unknown as Pack['campaign'];
export const buildSample=(images:Images)=>sample(images,testPack);
export const sawLookup=(s:ReturnType<typeof buildSample>)=>packLookup(testPack,s.images);
export function sawBattle(seed=20261110){const stage=structuredClone(tactics['saw-01'].stage)as Stage;stage.scenario=false;return createBattle(content,stage,seed);}
const gallery=testPack.game.gallery as unknown as import('@engine/src/v2/gallery/sample').GalleryData;
export const MOVES=gallery.moves!,SPIRITS=gallery.spirits!,WEAPONS=gallery.weapons!;

export function memoryStoryState(type=testPack.players.presets[0].type,candidates=testPack.game.story?.affection){const preset=testPack.players.presets.find(p=>p.type===type);return {...memoryState(type,candidates),placeholders:testPack.players.placeholders,playerName:()=>testPack.players.name.default,actor:(id:string)=>id===testPack.players.actor?preset?.cast??id:id};}
