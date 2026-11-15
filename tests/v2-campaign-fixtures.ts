import { CoreCampaign } from '@engine/src/v2/adapter/campaign';
import { content } from './pack-fixture';
import { sawCampaignContent } from './pack-fixture';
import { Saves } from '@engine/src/campaign/saves';
import { lookup, HeadlessApp } from './v2-map-fixtures';
import type { Screen } from '@engine/src/v2/screen';
import economy from '../pack/economy.json';
import training from '../pack/training.json';
export class MemoryStore {
  readonly values = new Map<string, string>();
  async read(key: string) { return this.values.get(key) ?? null; }
  async replace(key: string, value: string) { this.values.set(key, value); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}
export async function campaign() {
  const bytes = new MemoryStore(), saves = new Saves(bytes, sawCampaignContent, content); await saves.init();
  const model = new CoreCampaign(sawCampaignContent, content, saves, lookup, bytes, [{ title: '그림', detail: '테스트 자산' }],{economy,training});
  model.newGame({ name: '테스터', preset: 1, line: 'super' });
  return { model, bytes, saves };
}
export function intermission(model: CoreCampaign) {
  model.session.screen = 'intermission'; model.session.campaign.credits = 48000; model.session.campaign.parts = ['hull', 'battery'];
}
export class MenuApp extends HeadlessApp {
  readonly sound = { sfxVolume: 0.8, musicVolume: 0.6, play() {}, music() {}, credits: () => [] };
  replace(screen: Screen) { this.pop(); this.push(screen); }
}
export const flush = async () => { for (let i = 0; i < 10; i++) await new Promise<void>(resolve => setImmediate(resolve)); };
export function yes(app: HeadlessApp) { app.action('left'); app.action('confirm'); app.tick(30); }
