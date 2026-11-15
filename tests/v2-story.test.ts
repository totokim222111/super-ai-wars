import {memoryStoryState} from './pack-fixture';
import { describe, it, expect } from 'vitest';
import { parseStory } from '@engine/src/v2/story/parse';
import { PackStoryScreen,  StoryPlayback } from '@engine/src/v2/story/play';
import { MenuList } from '@engine/src/v2/kit';
import { MenuApp, campaign, yes } from './v2-campaign-fixtures';
import type { App } from '@engine/src/v2/screen';
import { Screen } from '@engine/src/v2/screen';
import { readFile } from '../tools/files.mjs';
import { loadPack } from '@engine/src/v2/pack/load';
import { buildSample } from './pack-fixture';
import { GameFlow } from '@engine/src/v2/game/flow';
import { MapScreen } from '@engine/src/v2/map/screen';
import { ObjectivesScreen } from '@engine/src/v2/map/objectives';
import { ResultScreen } from '@engine/src/v2/menus/result';
import { IntermissionScreen } from '@engine/src/v2/menus/screens';
const catalog = { cast: { gpi: { aliases: ['지피'], moods: { default: 'gpi' } } }, images: ['bg', 'cg'] };
const controls = '[배경] bg\n[장소] 서버\n[등장] 지피 왼쪽 미소\n[표정] 지피 분노\n지피(당황, 속마음): 생각\n[퇴장] 지피\n[번쩍]\n[흔들림]\n[암전]\n[밝아짐]\n[음악] theme\n[음악] 끔\n[효과음] hit\n[삽화] cg\n[삽화] cg | 이름 | 소개\n[잠깐] 0.2\n[타입 O] 지피: O\n[타입 M] [번쩍]\n[호감] 지피 +3\n[변수] count = 2\n[조건] count >= 2 -> 다음\n[맵] 보기 1,2\n[맵] 이동 gpi 2,3\n[맵] 등장 enemy 4,5\n[맵] 폭발 4,5\n[맵] 퇴장 enemy\n[선택]\n- 첫째 { 호감 지피 +2; count = 3 } -> 다음\n- 둘째\n[이동] 다음\n@ 다음\n[끝]';
describe('v2 story grammar and playback', () => {
    it('reads every documented command without a narration cue', () => { const s = parseStory('# 시험\n@ 도입\n' + controls, 'all.story', catalog); expect(s.issues).toEqual([]); expect(new Set(s.scenes.도입.map(c => c.do))).toEqual(new Set(['bg', 'place', 'enter', 'face', 'say', 'exit', 'flash', 'shake', 'dark', 'music', 'sound', 'cg', 'wait', 'typed', 'affection', 'variable', 'condition', 'map', 'choice', 'jump'])); expect(JSON.stringify(s.scenes)).not.toContain('narrate'); });
    it('collects narrative, unknown directive, character, image and scene errors with exact line numbers', () => { const s = parseStory('# 시험\n@ 도입\n그녀가 들어왔다.\n[모름] 값\n없는인물: 안녕\n[삽화] missing\n[이동] 없음', 'broken.story', catalog); expect(s.issues.map(e => e.line)).toEqual([3, 4, 5, 6, 7]); expect(s.issues.every(e => e.file === 'broken.story' && e.fix)).toBe(true); });
    it('runs typed lines, choices, affection, variables and branch jumps through touch', () => { const story = parseStory('# 시험\n@ 시작\n[타입 O] gpi: O\n[타입 M] gpi(속마음): M\n[선택]\n- 선택 { 호감 gpi +5; n = 2 } -> 분기\n@ 분기\n[조건] n == 2 -> 끝\n[변수] bad = true\n@ 끝\n[끝]'); const state = memoryStoryState('M'), app = new MenuApp(); let done = false; const screen = new PackStoryScreen(story, '시작', { gpi: { name: '지피', color: '#fff', height: 0 } }, {}, state, () => { done = true; }); app.push(screen); for (let i = 0; i < 100 && !done; i++) {
        app.tick(20);
        const list = screen.ui.focus;
        if (list instanceof MenuList) {
            screen.input({ kind: 'pointer', phase: 'down', x: list.x + 70, y: list.y + 55 });
            screen.input({ kind: 'pointer', phase: 'up', x: list.x + 70, y: list.y + 55 });
        }
        else
            screen.playback.taps.press();
    } expect(done).toBe(true); expect(screen.playback.log).toEqual(['지피: M']); expect(state.affection('gpi')).toBe(5); expect(state.get('n')).toBe(2); expect(state.get('bad')).toBe(false); });
    for (const type of ['O', 'M'] as const)
        it(`plays episode 1 through intro, map events, victory and intermission (${type})`, async () => {
            const pack = await loadPack('content/packs/saw', p => readFile(p, 'utf8'));
            const { model } = await campaign();
            model.session.campaign.persona = type === 'M' ? 'menhera' : 'otaku';
            const app = new MenuApp(), flow = new GameFlow(app as unknown as App, model, buildSample({}), undefined, pack);
            flow.show();
            expect(app.top).toBeInstanceOf(PackStoryScreen);
            const modeOf = () => app.top instanceof MapScreen ? (app.top as unknown as { mode: { kind: string } }).mode.kind : '';
            const drain = (stop: () => boolean) => { for (let i = 0; i < 2400 && !stop(); i++) {
                app.tick(15);
                // 작전 목표 카드는 확인으로 닫고, 적 공격에 대한 대응은 맨 위 것(반격)으로 정한다.
                if (app.top instanceof ObjectivesScreen) { app.action('confirm'); app.tick(20); continue; }
                if(app.top instanceof MapScreen&&app.top.guiding){app.action('confirm');continue;}
                if (modeOf() === 'responseForecast') { app.action('confirm'); continue; }
                const p = app.top instanceof PackStoryScreen ? app.top.playback : flow.playback;
                if (p?.active) {
                    const f = app.top.ui.focus;
                    if (f instanceof MenuList) {
                        app.action('confirm');
                    }
                    else
                        p.taps.press();
                }
            } expect(stop()).toBe(true); };
            drain(() => modeOf() === 'idle' && !flow.playback?.active);
            const map = flow.map!, screen = app.top as MapScreen;
            screen.present(map.endTurn());
            drain(() => map.turn().number >= 2 && modeOf() === 'idle' && !flow.playback?.active);
            flow.debugWin();
            drain(() => app.top instanceof ResultScreen);
            app.action('confirm');
            expect(app.top).toBeInstanceOf(PackStoryScreen);
            drain(() => app.top instanceof IntermissionScreen);
            expect(model.storyAffection('gpi')).toBeGreaterThan(0);
            expect(model.storyValue('coffee-done')).toBe(true);
            app.action('confirm');
            yes(app);
            expect(app.top).toBeInstanceOf(PackStoryScreen);
        });
    it('rejects narration and invalid nested targets without throwing on unusual scene names', () => { const story = parseStory('# 검사\n@ __proto__\n[타입 M] [이동] 없음\n[선택]\n- 보기 -> 없음\n그녀가 달렸다.', 'odd.story'); expect(story.issues.map(e => e.line).sort()).toEqual([3, 5, 6]); });
    it('restores pending map scripts after save/load without repeating native reinforcement or changing RNG', async () => { const pack = await loadPack('content/packs/saw', p => readFile(p, 'utf8')); const { model } = await campaign(), app = new MenuApp(), flow = new GameFlow(app as unknown as App, model, buildSample({}), undefined, pack); const drain = () => { for (let i = 0; i < 1800; i++) {
        app.tick(15);
        const p = app.top instanceof PackStoryScreen ? app.top.playback : flow.playback;
        if (p?.active) {
            if (p['choiceList'])
                app.action('confirm');
            else
                p.taps.press();
        }
        else if (app.top instanceof ObjectivesScreen) { app.action('confirm'); app.tick(20); }
        else if (app.top instanceof MapScreen && i > 30)
            return;
    } }; flow.show(); drain(); const map = flow.map!, events = [...map.endTurn()]; /* 적 페이즈의 대응을 모두 방어로 정해 다음 아군 턴까지 보낸다. */ for (let n = 0; n < 80 && (map.state().pending || map.turn().team === 'enemy'); n++) events.push(...(map.state().pending ? map.respond('defend') : map.continueTurn!())); expect(events.some(e => e.type === 'spawn')).toBe(true); const state = flow.map!.state(); expect(String(model.storyValue('v2:pending:ep01'))).toContain('턴 2'); await model.save('1'); await model.load('1'); flow.show(); drain(); expect(flow.map!.state().units).toEqual(state.units); expect(flow.map!.state().rng).toBe(state.rng); expect(model.storyValue('v2:pending:ep01')).toBe('[]'); });
    it('does not award intermission affection again for a completed legacy save', async () => { const pack = await loadPack('content/packs/saw', p => readFile(p, 'utf8')); const { model } = await campaign(), app = new MenuApp(); model.session.screen = 'intermission'; model.session.campaign.cleared = ['saw-01']; model.session.campaign.flags['coffee-done'] = true; model.session.campaign.affection = { gpi: 10 }; model.session.game = null; new GameFlow(app as unknown as App, model, buildSample({}), undefined, pack).show(); expect(app.top).toBeInstanceOf(IntermissionScreen); expect(model.storyAffection('gpi')).toBe(10); });
    it('keeps arbitrary story values in the existing flags save slot', async () => { const { model } = await campaign(); model.setStoryValue('text', '한글: 값'); model.setStoryValue('n', 4); await model.save('1'); model.setStoryValue('n', 9); await model.load('1'); expect(model.storyValue('text')).toBe('한글: 값'); expect(model.storyValue('n')).toBe(4); });
    it('has no DOM or narration path in the parser/runtime screen modules', async () => { for (const path of ['parse', 'play']) {
        const source = await readFile(`src/v2/story/${path}.ts`, 'utf8');
        expect(source).not.toMatch(/do:\s*['"]narrate['"]/);
        expect(source).not.toMatch(/document\.|addEventListener/);
    } });
});
void StoryPlayback;
void Screen;
