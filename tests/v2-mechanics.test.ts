import { beforeAll, describe, it, expect } from 'vitest';
import { readFile } from '../tools/files.mjs';
import {execFileSync} from 'node:child_process';
import { createBattle, snapshot, restore, sureHitEffect, effectiveMech, reachable, type BattleState } from '@engine/src/core';
import { loadPack, type Pack } from '@engine/src/v2/pack/load';
import { compileStage } from '@engine/src/v2/story/stage';
import { parseStory } from '@engine/src/v2/story/parse';
import { applyRules, prepareRules, runtime, storeRuntime, ruleCommand, ruleActions, rulesForecast, rulesProjection, setRuleVariable, phase, faction, nextRulesAI } from '@engine/src/v2/rules/runtime';
import { stageApply, wallProjection } from '@engine/src/v2/story/stage-core';
import { stageFacts } from '@engine/src/v2/story/stage';
import { configOf } from '@engine/src/v2/rules/config';
import { CoreMap } from '@engine/src/v2/adapter/map';
import { packLookup } from '@engine/src/v2/pack/load';
import { battleExchange } from '@engine/src/v2/adapter/battle';
import {CoreCampaign} from '@engine/src/v2/adapter/campaign';
import {TrainingSaves} from '@engine/src/v2/adapter/saves';
import {MemoryStore} from './v2-campaign-fixtures';
import {StoryEvents} from '@engine/src/v2/story/events';
import {testCondition} from '@engine/src/v2/story/play';
let pack: Pack;
beforeAll(async () => { pack = await loadPack('content/packs/saw', p => readFile(p, 'utf8')); expect(pack.errors).toEqual([]); });
const gun = 'gpi-generation-2-weapon-3';
function setup(extra = '', third = false) {
    const content = structuredClone(pack.rules);
    delete content.rules.ai.resources;delete content.rules.actions;
    content.terrain.push({ ...structuredClone(content.terrain.find(t => t.id === 'saw-plain')!), id: 'test-boost', name: '가속', ...{ char: '>' } });
    const source = `# 범용 검사\n@ 규칙\n아군: a = gpi-generation-2 1,2 파일럿 gpi 레벨 20 / b = claude-generation-2 1,3 파일럿 claude 레벨 20\n적: boss = spam-bot-episode-1 5,2 파일럿 unmanned\n${third ? '제3: rival = qwen-generation-1 6,3 파일럿 qwen\n' : ''}승리: 격파 boss\n패배: 격파 a\n지역 tile (3,1~3,3): 아군 진입 반복 → 사건 roll\n${extra}\n@ 맵\n${Array.from({ length: 6 }, (_, y) => Array.from({ length: 9 }, (_, x) => x === 1 && y === 2 ? '>' : '.').join(' ')).join('\n')}\n@ 사건 roll\n[끝]\n@ 사건 sleep\n[끝]`;
    const story = parseStory(source), compiled = compileStage(story.stage!, { id: 'generic', name: '범용', content, roster: [], scenes: story.scenes }, 'generic.story');
    expect([...story.issues, ...compiled.issues]).toEqual([]);
    const state = prepareRules(createBattle(content, compiled.stage, 19, { autoResponse: true }));
    for (const u of state.units)u.morale=150;
    for (const u of state.units)
        u.effects.push(sureHitEffect(state, { unit: 'round', remaining: 100 }));
    return { state, compiled, content, source };
}
const damage = (s: BattleState) => applyRules(s, { type: 'attack', unitId: 'a', targetId: 'boss', weaponId: gun });
describe('범용 v2 전술 규칙', () => {
    it('90% 배리어는 예측·실행 피해를 줄이고 명령으로 해제된다', () => {
        const { state } = setup('배리어 boss 90');
        const shield = damage(state), unlocked = applyRules(state, ruleCommand({ kind: 'barrier', id: 'boss', value: 0 })).state, plain = damage(unlocked);
        const shot = (s: ReturnType<typeof damage>) => s.events.find(e => e.type === 'attack' && e.attackerId === 'a')! as {
            damage: number;
        };
        expect(Math.abs(shot(shield).damage-shot(plain).damage*.1)).toBeLessThanOrEqual(1);
        expect(rulesForecast(state, 'a', 'boss', gun).expectedDamage).toBeLessThan(rulesForecast(unlocked, 'a', 'boss', gun).expectedDamage * .11);
        expect(runtime(state).barriers.boss).toBe(90);
    });
    it('무적은 최소 피해까지 0이며 합체기만 지정 배리어를 깬다', () => {
        const { state } = setup('배리어 boss 무적 합체기 horizon\n합체기 horizon = a + b 무장 gpi-generation-2-weapon-4 조건 변수 unlocked');
        expect(damage(state).events.find(e => e.type === 'attack')).toMatchObject({ damage: 0 });
        expect(ruleActions(state, 'a').some(c => c.type === 'attack' && c.weaponId.startsWith('v2-combo'))).toBe(false);
        setRuleVariable(state, 'unlocked', true);
        const combo = ruleActions(state, 'a').find(c => c.type === 'attack' && c.weaponId.startsWith('v2-combo'))!;
        expect(combo).toBeDefined();
        if (combo.type !== 'attack')
            throw Error();
        expect(rulesForecast(state, 'a', 'boss', combo.weaponId).expectedDamage).toBeGreaterThan(0);
        const before = state.units.slice(0, 2).map(u => u.en), total = state.content.weapons.find(w => w.id === 'gpi-generation-2-weapon-4')!.en!;
        const result = applyRules(state, combo);
        expect(runtime(result.state).barriers.boss).toBe(0);
        expect(result.state.units.slice(0, 2).every(u => u.acted)).toBe(true);
        expect(before.reduce((a, b) => a + b) - result.state.units.slice(0, 2).reduce((n, u) => n + u.en, 0)).toBe(total);
    });
    it('합체기는 떨어지거나 파트너가 행동·자원 소진 상태면 목록에서 빠진다', () => {
        for (const mode of ['far', 'acted', 'empty']) {
            const { state } = setup('합체기 horizon = a + b 무장 gpi-generation-2-weapon-4 조건 변수 unlocked');
            setRuleVariable(state, 'unlocked', 1);
            const b = state.units[1];
            if (mode === 'far')
                b.x = 8;
            if (mode === 'acted')
                b.acted = true;
            if (mode === 'empty')
                b.en = 0;
            expect(ruleActions(state, 'a').some(c => c.type === 'attack' && c.weaponId.startsWith('v2-combo'))).toBe(false);
        }
    });
    it('폼 체인지는 비율과 행동 여부를 보존하고 자기 턴당 한 번이다', () => {
        const { state, content, compiled } = setup('형태 a = small:gem-generation-1 / large:gpi-generation-2');
        const a = state.units[0], old = effectiveMech(state, a);
        a.hp = Math.floor(old.hp * .4);
        a.en = Math.floor(old.en * .6);
        const changed = applyRules(state, { type: 'transform', unitId: 'a', formId: 'large' }).state, u = changed.units[0], max = effectiveMech(changed, u);
        expect(u.hp).toBe(Math.floor(max.hp * a.hp / old.hp));
        expect(u.en).toBe(Math.floor(max.en * a.en / old.en));
        expect(u.acted).toBe(false);
        expect(() => applyRules(changed, { type: 'transform', unitId: 'a', formId: 'small' })).toThrow();
        expect(restore(content, compiled.stage, snapshot(changed)).units[0].formId).toBe('large');
    });
    it('격파된 적의 대본 폼 전환은 같은 id로 다음 외피를 시작한다', () => {
        const { state } = setup('형태 boss = mask:spam-bot-episode-1 / core:qwen-generation-1');
        state.units[2].hp = 0;
        state.units[2].alive = false;
        const result = applyRules(state, ruleCommand({ kind: 'form', id: 'boss', form: 'core' })).state;
        expect(result.units.filter(u => u.id === 'boss')).toHaveLength(1);
        expect(result.units[2]).toMatchObject({ alive: true, formId: 'core' });
        expect(result.units[2].hp).toBe(effectiveMech(result, result.units[2]).hp);
    });
    it('가챠는 저장 시드로 재현되고, 이동 취소·재진입으로 재추첨되지 않는다', () => {
        const { state, content, compiled } = setup('가챠 luck 변수 won = HP 30 / VRAM 50 / 크레딧 200 / 이동 -2 1 / 꽝\n가챠지역 luck = tile');
        state.units[0].hp = 1000;
        state.units[0].en = 0;
        const original = snapshot(state), a = stageApply(state, { type: 'move', unitId: 'a', x: 3, y: 2 }).state, b = stageApply(restore(content, compiled.stage, original), { type: 'move', unitId: 'a', x: 3, y: 2 }).state;
        expect(snapshot(a)).toBe(snapshot(b));
        expect(runtime(a).drawn).toEqual(['luck']);
        expect(() => stageApply(a, { type: 'undoMove', unitId: 'a' })).toThrow();
        expect(a.rng).not.toBe(state.rng);
        expect(restore(content, compiled.stage, snapshot(a)).rng).toBe(a.rng);
    });
    it('제3세력은 아군→적→제3 순서이며 적과 서로 공격하고 저장된다', () => {
        const { state, content, compiled } = setup('', true);
        expect(faction(state.units[3])).toBe('third');
        let s = applyRules(state, { type: 'endPhase' }).state;
        expect(phase(s)).toBe('enemy');
        const third=applyRules(s,{type:'endPhase'});expect(third.events.some(e=>e.type==='phase-start'&&e.phase==='enemy')).toBe(false);s=third.state;
        expect(phase(s)).toBe('third');
        expect(s.round).toBe(1);
        const cmd = ruleActions(s, 'rival').find(c => c.type === 'attack' && c.targetId === 'boss')!;
        expect(cmd).toBeDefined();
        const out = applyRules(s, cmd);
        expect(out.events.some(e => e.type === 'attack' && e.attackerId === 'rival' && e.targetId === 'boss')).toBe(true);
        const restored = restore(content, compiled.stage, snapshot(s));
        expect(phase(restored)).toBe('third');
        expect(applyRules(restored, { type: 'endPhase' }).state).toMatchObject({ phase: 'player', round: 2 });
        expect(nextRulesAI(s)).toBeTruthy();
    });
    it('복사 무장은 다음 자기 페이즈부터 사용하고 같은 무장의 연속 피해는 경감된다', () => {
        const { state } = setup('복사 boss 경감 30\n배리어 boss 90');
        const one = damage(state).state;
        expect(runtime(one).copies.boss.pending).toBe(gun);
        expect(rulesProjection(one, 'boss').content.mechs.find(m => m.id === one.units[2].mechId)!.weapons).not.toContain(gun);
        const enemy = applyRules(one, { type: 'endPhase' }).state;expect(nextRulesAI(enemy)).toMatchObject({type:'attack',unitId:'boss',weaponId:gun});
        expect(rulesProjection(enemy, 'boss').content.mechs.find(m => m.id === enemy.units[2].mechId)!.weapons).toContain(gun);
        let round = applyRules(enemy, { type: 'endPhase' }).state;
        const rt = runtime(round);
        rt.barriers.boss = 0;
        storeRuntime(round, rt);
        round.units[2].hp = 20000;
        const repeat = damage(round), plain = structuredClone(round), r = runtime(plain);
        r.copies = {};
        storeRuntime(plain, r);
        const hit = (x: ReturnType<typeof damage>) => (x.events.find(e => e.type === 'attack') as {
            damage: number;
        }).damage;
        expect(hit(repeat)).toBeCloseTo(hit(damage(plain)) * .7, 0);
    });
    it('가속 지형은 턴 시작 이동력을 올리고 다음 턴 떠난 뒤에는 해제된다', () => {
        const { state } = setup('가속 test-boost 이동 2');
        const u = state.units[0], base = state.content.mechs.find(m => m.id === u.mechId)!.move;
        expect(effectiveMech(state, u).move).toBe(base + 2);
        let s = stageApply(state, { type: 'move', unitId: 'a', x: 2, y: 2 }).state;
        s = applyRules(s, { type: 'endPhase' }).state;
        s = applyRules(s, { type: 'endPhase' }).state;
        expect(effectiveMech(s, s.units[0]).move).toBe(base);
    });
    it('전투 횟수는 반격과 피격을 한 교전당 한 번 세고 임계 사건은 한 번만 낸다', () => {
        const { state } = setup('전투 사건 a 1 → 사건 sleep\n배리어 boss 무적');
        const out = damage(state);
        expect(runtime(out.state).battles.a).toBe(1);
        expect(runtime(out.state).battles.boss).toBe(1);
        expect(out.events.filter(e => (e as unknown as {
            type: string;
        }).type === 'v2-scene')).toHaveLength(1);
    });
    it('통행 토글은 조회·실행 경로와 저장에 반영되고 다시 열 수 있다', () => {
        const { state, content, compiled } = setup();
        const closed = applyRules(state, ruleCommand({ kind: 'passage', rect: [3, 0, 3, 5], blocked: true })).state;
        expect(reachable(wallProjection(closed), 'a').some(p => p.x >= 3)).toBe(false);
        expect(() => stageApply(closed, { type: 'move', unitId: 'a', x: 3, y: 2 })).toThrow();
        const loaded = restore(content, compiled.stage, snapshot(closed));
        expect(runtime(loaded).blocked).toHaveLength(6);
        const opened = applyRules(loaded, ruleCommand({ kind: 'passage', rect: [3, 0, 3, 5], blocked: false })).state;
        expect(reachable(wallProjection(opened), 'a').some(p => p.x >= 3)).toBe(true);
    });
    it('합체기 AI는 먼저 파트너와 붙여 이동하고 실제 합체기를 쓴다', () => {
        const { state } = setup('합체기 horizon = a + b 무장 gpi-generation-2-weapon-4 조건 변수 unlocked\n배리어 boss 무적 합체기 horizon');
        setRuleVariable(state, 'unlocked', true);
        state.units[1].x = 6;
        state.units[1].y = 4;
        let s = state;
        let fired = false;
        for (let n = 0; n < 80 && !fired; n++) {
            const c = nextRulesAI(s)!;
            const result = stageApply(s, c);
            s = result.state;
            fired = result.events.some(e => e.type === 'attack' && (e as unknown as {
                combo?: string;
            }).combo === 'horizon');
        }
        expect(fired).toBe(true);
    });
    it('합체 파트너는 컷인 자료에만 있으며 전투 무대 기체로 생성되지 않는다', () => {
        const { state } = setup('합체기 horizon = a + b 무장 gpi-generation-2-weapon-4 조건 변수 unlocked');
        setRuleVariable(state, 'unlocked', true);
        const c = ruleActions(state, 'a').find(c => c.type === 'attack' && c.weaponId.startsWith('v2-combo'))!;
        const result = applyRules(state, c), exchange = battleExchange(state, result.events, packLookup(pack, {}).battle);
        expect(exchange.strikes[0].combo?.partner.id).toBe('b');
        expect(exchange.fighters.map(f => f.id)).not.toContain('b');
    });
    it('적도 제3을 실제 표적으로 삼고 제3→아군 수동 대응도 저장·재개한다', () => {
        const { state, content, compiled } = setup('', true);
        state.units[2].x = 5;
        state.units[2].y = 3;
        let s = applyRules(state, { type: 'endPhase' }).state;
        const enemy = ruleActions(s, 'boss').find(c => c.type === 'attack' && c.targetId === 'rival');
        expect(enemy).toBeDefined();
        expect(applyRules(s, enemy!).events.some(e => e.type === 'attack' && e.attackerId === 'boss' && e.targetId === 'rival')).toBe(true);
        s = applyRules(s, { type: 'endPhase' }).state;
        s.options.autoResponse = false;
        s.units[0].x = 5;
        s.units[0].y = 2;
        const shot = ruleActions(s, 'rival').find(c => c.type === 'attack' && c.targetId === 'a')!;
        const waiting = applyRules(s, shot).state;
        expect(waiting.pending).not.toBeNull();
        const saved = restore(content, compiled.stage, snapshot(waiting));
        expect(phase(saved)).toBe('third');
        expect(applyRules(saved, { type: 'respond', response: { type: 'defend' } }).state.pending).toBeNull();
    });
    it('복사한 탄수 무장의 잔탄도 원래 저장 검증을 통과한다', () => {
        const { state, content, compiled } = setup('복사 boss 경감 30\n배리어 boss 무적');
        const w = content.weapons.find(w => w.id === gun)!;
        w.ammo = 4;
        state.content.weapons.find(w => w.id === gun)!.ammo = 4;
        for (const u of state.units)
            if (state.content.mechs.find(m => m.id === u.mechId)!.weapons.includes(gun))
                u.ammo[gun] = 4;
        let s = damage(state).state;
        s = applyRules(s, { type: 'endPhase' }).state;
        const copy = rulesProjection(s, 'boss');
        expect(copy.units[2].ammo[gun]).toBe(4);
        const attack = ruleActions(s, 'boss').find(c => c.type === 'attack' && c.weaponId === gun && c.targetId === 'a')!;
        expect(attack).toBeDefined();
        s = applyRules(s, attack).state;
        expect(runtime(s).copies.boss.ammo?.[gun]).toBe(3);
        expect(restore(content, compiled.stage, snapshot(s)).units[2].ammo[gun]).toBe(3);
    });
    it('복사 무장으로 공격한 수동 대응 대기도 원래 저장 형식으로 왕복한다', () => {
        const { state, content, compiled } = setup('복사 boss 경감 30\n배리어 boss 무적');
        let s = damage(state).state;
        s = applyRules(s, { type: 'endPhase' }).state;
        s.options.autoResponse = false;
        const c = ruleActions(s, 'boss').find(c => c.type === 'attack' && c.weaponId === gun && c.targetId === 'a')!;
        s = applyRules(s, c).state;
        expect(s.pending?.weaponId).toBe(gun);
        const loaded = restore(content, compiled.stage, snapshot(s));
        expect(snapshot(applyRules(loaded, { type: 'respond', response: { type: 'defend' } }).state)).toBe(snapshot(applyRules(s, { type: 'respond', response: { type: 'defend' } }).state));
    });
    it('적 합체기의 수동 대응도 저장되며 재개 시 파트너 자원을 한 번만 쓴다', () => {
        const { state, content, compiled } = setup('합체기 horizon = a + b 무장 gpi-generation-2-weapon-4 조건 변수 unlocked');
        state.units[0].side = state.units[1].side = 'enemy';
        state.units[2].side = 'player';
        state.phase = 'enemy';
        state.options.autoResponse = false;
        setRuleVariable(state, 'unlocked', true);
        const c = ruleActions(state, 'a').find(c => c.type === 'attack' && c.weaponId.startsWith('v2-combo'))!;
        let s = applyRules(state, c).state;
        expect(s.pending).not.toBeNull();
        const loaded = restore(content, compiled.stage, snapshot(s));
        const after = applyRules(loaded, { type: 'respond', response: { type: 'defend' } }).state;
        expect(after.units[1].acted).toBe(true);
        expect(after.units[1].en).toBe(state.units[1].en - Math.floor(content.weapons.find(w=>w.id==='gpi-generation-2-weapon-4')!.en!/2));
    });
    it('형태·격파형태와 제3 전멸 조건은 실제 상태로 판정한다', () => {
        const { state, compiled } = setup('형태 boss = mask:spam-bot-episode-1 / core:qwen-generation-1', true);
        compiled.facts.push({ id: 'f', kind: 'form', unit: 'boss', form: 'core' }, { id: 'd', kind: 'form-defeated', unit: 'boss', form: 'mask' }, { id: 'third-dead', kind: 'side-dead', side: 'third' });
        const flags = {};
        stageFacts(compiled, state, flags);
        expect(flags).toEqual({});
        const r = runtime(state);
        r.defeated['boss.mask'] = true;
        storeRuntime(state, r);
        let s = applyRules(state, ruleCommand({ kind: 'form', id: 'boss', form: 'core' })).state;
        s.units[3].hp = 0;
        s.units[3].alive = false;
        stageFacts(compiled, s, flags);
        expect(flags).toEqual({ f: true, d: true, 'third-dead': true });
    });
    it('퀜형 지원 모드는 인접 아군 VRAM을 회복하고 반격형은 반격 피해를 늘린다', () => {
        const { state } = setup('형태 a = attack:gpi-generation-2 / counter:gpi-generation-2 / support:gpi-generation-2\n형태효과 a counter: 반격 140\n형태효과 a support: 지원 1 / 공급 16');
        state.units[1].en = 0;
        let s = applyRules(state, { type: 'transform', unitId: 'a', formId: 'support' }).state;
        s = applyRules(applyRules(s, { type: 'endPhase' }).state, { type: 'endPhase' }).state;
        expect(s.units[1].en).toBeGreaterThanOrEqual(16);
        s = applyRules(s, { type: 'transform', unitId: 'a', formId: 'counter' }).state;
        const normal = applyRules(s, ruleCommand({ kind: 'form', id: 'a', form: 'attack' })).state;
        s.units.find(u=>u.id==='boss')!.acted=false;
        const weapon = ruleActions({ ...s, phase: 'enemy' }, 'boss').find(c => c.type === 'attack' && c.targetId === 'a');
        if (!weapon || weapon.type !== 'attack')
            throw Error('반격 검사 무장 없음');
        expect(rulesForecast(s, 'boss', 'a', weapon.weaponId).counter?.expectedDamage).toBeGreaterThan(rulesForecast(normal, 'boss', 'a', weapon.weaponId).counter!.expectedDamage);
    });
    it('이동 감소 가챠는 이미 끝난 이동에 낭비되지 않고 다음 아군 턴 동안 지속된다', () => {
        const { state } = setup('가챠 slow 변수 won = 이동 -2 1\n가챠지역 slow = tile');
        const base = effectiveMech(state, state.units[0]).move;
        let s = stageApply(state, { type: 'move', unitId: 'a', x: 3, y: 2 }).state;
        s = applyRules(applyRules(s, { type: 'endPhase' }).state, { type: 'endPhase' }).state;
        expect(effectiveMech(s, s.units[0]).move).toBe(base - 2);
        s = applyRules(applyRules(s, { type: 'endPhase' }).state, { type: 'endPhase' }).state;
        expect(effectiveMech(s, s.units[0]).move).toBe(base);
    });
    it('어댑터의 새 규칙 조회는 원래 스테이지·시드를 바꾸지 않는다', () => {
        const { state } = setup('배리어 boss 90');
        const before = snapshot(state), map = new CoreMap(state, packLookup(pack, {}));
        map.reach('a');
        map.forecast('a', { col: 1, row: 2 }, gun, 'boss');
        nextRulesAI(state);
        expect(snapshot(state)).toBe(before);
        expect(state.stage.scenario).toBe(true);
        expect(configOf(state.stage).units.boss.barrier).toBe(90);
    });
    it('복사 보스가 선공해도 같은 무장의 반격 피해 경감은 예측·실행에 일치한다',()=>{
        const {state}=setup('복사 boss 경감 30');state.units[2].x=4;state.phase='enemy';state.options.autoResponse=false;const r=runtime(state);r.copies.boss={last:gun,ready:1};storeRuntime(state,r);
        const shot=ruleActions(state,'boss').find(c=>c.type==='attack'&&c.targetId==='a')!;if(shot.type!=='attack')throw Error();const response={type:'counter' as const,weaponId:gun};const reduced=rulesForecast(state,'boss','a',shot.weaponId,response),plain=structuredClone(state),p=runtime(plain);p.copies={};storeRuntime(plain,p);
        expect(reduced.counter!.expectedDamage).toBeCloseTo(rulesForecast(plain,'boss','a',shot.weaponId,response).counter!.expectedDamage*.7,0);
        const waiting=applyRules(state,shot).state,out=applyRules(waiting,{type:'respond',response});expect(out.events.find(e=>e.type==='attack'&&e.counter)).toBeDefined();
        const normal=applyRules(applyRules(plain,shot).state,{type:'respond',response}),hit=(x:typeof out)=>(x.events.find(e=>e.type==='attack'&&e.counter)as {damage:number}).damage;expect(Math.abs(hit(out)-hit(normal)*.7)).toBeLessThanOrEqual(1);
    });
    it('맵 병기에도 무적·동일 무장 경감이 적용된다',()=>{
        const {state}=setup('복사 boss 경감 30\n배리어 boss 무적');const w=state.content.weapons.find(w=>w.id===gun)!;w.map={shape:'area',size:0,friendlyFire:false};const command={type:'mapAttack' as const,unitId:'a',weaponId:gun,point:{x:5,y:2}},immune=applyRules(state,command);expect(immune.events.find(e=>e.type==='attack')).toMatchObject({damage:0});
        let s=applyRules(state,ruleCommand({kind:'barrier',id:'boss',value:0})).state;const rt=runtime(s);rt.copies.boss={last:gun,ready:1};storeRuntime(s,rt);const repeat=applyRules(s,command),plain=structuredClone(s),p=runtime(plain);p.copies={};storeRuntime(plain,p);const normal=applyRules(plain,command),hit=(x:typeof repeat)=>(x.events.find(e=>e.type==='attack')as {damage:number}).damage;expect(Math.abs(hit(repeat)-hit(normal)*.7)).toBeLessThanOrEqual(1);
    });
    it('3화의 실제 다섯 번째 교전은 조건 값·절전 사건·저장에 함께 반영된다',()=>{
        const bytes=new MemoryStore(),lookup=packLookup(pack,{}),model=new CoreCampaign(pack.campaign,pack.rules,new TrainingSaves(bytes,pack.campaign,pack.rules,pack.training),lookup,bytes,[],pack);model.newGame({name:'검사',preset:0,line:'real'});model.session.campaign.node=pack.campaign.nodes.findIndex(n=>n.type==='stage'&&n.id==='saw-03');model.advance(false);
        const s=model.session.game!.battle;s.stage.scenario=true;const claude=s.units.find(u=>u.id==='claude')!,enemy=s.units.find(u=>u.side==='enemy')!;claude.side='player';Object.assign(enemy,{x:claude.x+1,y:claude.y});const rt=runtime(s);rt.battles.claude=4;storeRuntime(s,rt);const events=new StoryEvents(pack,model,'ep03'),boot=events.process();model.acceptBattle(boot.state,boot.changes);const map=new CoreMap(boot.state,{...lookup,afterCommand:c=>events.process(c),onChange:(s,c)=>model.acceptBattle(s,c)});
        const command=ruleActions(map.state(),'claude').find(c=>c.type==='attack'&&c.targetId===enemy.id)!;expect(command).toBeDefined();map.execute(command);expect(events.state.get('전투횟수 claude')).toBe(5);expect(String(model.storyValue('v2:pending:ep03'))).toContain('사건 5시간 한도 도달');const condition=parseStory('@ 검사\n[조건] 전투횟수 claude >= 5 -> 끝\n[끝]\n@ 끝\n[끝]').scenes.검사[0];if(condition.do!=='condition')throw Error();expect(testCondition(condition.test,events.state)).toBe(true);expect(runtime(restore(map.state().content,map.state().stage,map.save())).battles.claude).toBe(5);
    });
    it('교전 조건만 쓴 팩도 지연 로딩 색인과 전체 대본의 규칙·저장 지문이 같다',()=>{
        const fixture=setup(),text=fixture.source.replace('@ 사건 roll\n','@ 사건 roll\n[조건] 전투횟수 a >= 5 -> 사건 sleep\n');
        const outline=execFileSync(process.execPath,['--input-type=module','-e',"import{outlineStory}from'./tools/story_outlines.mjs';import{readFileSync}from'node:fs';process.stdout.write(outlineStory(readFileSync(0,'utf8')));"],{input:text,encoding:'utf8'});
        const compile=(text:string)=>{const story=parseStory(text);return compileStage(story.stage!,{id:'counter-only',name:'추적',content:structuredClone(fixture.content),roster:[],scenes:story.scenes},'counter.story');};const full=compile(text),late=compile(outline);expect(full.issues).toEqual([]);expect(late.issues).toEqual([]);expect(late.stage).toEqual(full.stage);expect(late.program).toEqual(full.program);expect(configOf(full.stage).units.a).toBeDefined();
    });

    it('아군 대 제3·적 대 제3의 전투 화면은 언제나 서로 반대편이다',()=>{
        const {state}=setup('',true);state.units[3].x=4;state.units[3].y=2;const out=applyRules(state,{type:'attack',unitId:'a',targetId:'rival',weaponId:gun}),exchange=battleExchange(state,out.events,packLookup(pack,{}).battle);expect(exchange.fighters.find(f=>f.id==='a')?.side).toBe('ally');expect(exchange.fighters.find(f=>f.id==='rival')?.side).toBe('enemy');
        let s=applyRules(state,{type:'endPhase'}).state;const cmd=ruleActions(s,'boss').find(c=>c.type==='attack'&&c.targetId==='rival')!;const enemy=applyRules(s,cmd),pair=battleExchange(s,enemy.events,packLookup(pack,{}).battle);expect(pair.fighters.find(f=>f.id==='boss')?.side).toBe('enemy');expect(pair.fighters.find(f=>f.id==='rival')?.side).toBe('ally');
    });

});
