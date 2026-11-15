import { describe, expect, it } from 'vitest';
import { apply, snapshot } from '@engine/src/core';
import { transition, menuItems } from '@engine/src/game/controller';
import type { Game } from '@engine/src/game/controller';
import { campaignContent as data } from './pack-fixture';
import { content } from './pack-fixture';
import { deserialize, enterNode, finishStage, loadSession, saveSession, serialize, titleSession } from '@engine/src/campaign/session';
import { newCampaign, nextNode } from '@engine/src/campaign/state';

const action = (g: Game, id: string) => transition(g, { type: 'action', id });
function drain(game: Game): Game {
  let g = game;
  for (let n = 0; n < 500; n++) {
    if (g.mode === 'scenario') { g = transition(g, { type: 'tick', ms: 10000 }); if (g.mode === 'scenario') g = transition(g, { type: 'tap', cell: g.cursor }); }
    else if (['moving', 'banner', 'result', 'enemy','reward','ability','mapResult'].includes(g.mode)) g = transition(g, { type: 'tick', ms: 10000 });
    else if(g.mode==='levelUp')g=transition(g,{type:'tap',cell:g.cursor});
    else if (g.mode === 'response') g = action(g, 'defend');
    else return g;
  }
  throw new Error('campaign did not settle');
}
function persuade(g: Game): Game {
  g = drain(g); g = transition(g, { type: 'tap', cell: { x: 3, y: 3 } }); g = transition(g, { type: 'tap', cell: { x: 3, y: 3 } });
  expect(menuItems(g).some(i => i.label === '설득')).toBe(true); return drain(action(action(g, 'persuade'), 'persuade:rival'));
}
function survive(g: Game, round: number): Game {
  for (let n = 0; n < 20 && !g.battle.outcome && g.battle.round < round; n++) { g = action(transition(g, { type: 'endTurn' }), 'yes'); g = drain(g); }
  return g;
}
describe('campaign flow and persistence', () => {
  it('skips false flag nodes on initial entry and advancement', () => {
    const nodes = [{ type: 'stage' as const, id: 'a', if: 'flag:a' }, { type: 'intermission' as const, if: 'flag:b' }, { type: 'stage' as const, id: 'c' }], c = newCampaign();
    expect(nextNode(nodes, c, false)).toBe(2); c.flags.b = true; expect(nextNode(nodes, c)).toBe(1);
  });
  it('starts with a serializable fade wait before the first player action', () => {
    const s = enterNode(titleSession(), data, content), g = s.game!;
    expect(g.mode).toBe('scenario'); expect(g.scenario!.runner.waiting!.command.op).toBe('fade');
    const frozen = snapshot(g.battle); expect(snapshot(transition(g, { type: 'endTurn' }).battle)).toBe(frozen);
    expect(transition(g, { type: 'action', id: 'wait' }).commands).toEqual(g.commands);
  });
  it('persuaded unit deploys next stage with credits, parts, flags and clear record', () => {
    let s = enterNode(titleSession(), data, content); let g = persuade(s.game!);
    expect(g.scenario!.campaign.roster.some(u => u.id === 'rival')).toBe(true);
    g = transition(g, { type: 'tap', cell: { x: 4, y: 3 } }); g = transition(g, { type: 'tap', cell: { x: 4, y: 3 } });
    g = transition(g, { type: 'tap', cell: { x: 4, y: 4 } }); g = drain(transition(g, { type: 'tap', cell: { x: 4, y: 4 } }));
    g = survive(g, 4); expect(g.battle.outcome).toBe('victory'); expect(g.scenario!.campaign.credits).toBe(1500); expect(g.scenario!.campaign.parts).toEqual(['repair-kit']);
    let replay = enterNode(titleSession(), data, content).game!.battle;
    for (const cmd of g.commands) replay = apply(replay, cmd).state;
    expect(snapshot(replay)).toBe(snapshot(g.battle));
    s.game = g; finishStage(s); expect(s.screen).toBe('result'); expect(s.campaign.cleared).toEqual(['trial-escort']);
    s = enterNode(s, data, content, true); expect(s.screen).toBe('intermission'); s = enterNode(s, data, content, true);
    expect(s.game!.battle.units.find(u => u.id === 'rival')).toMatchObject({ side: 'player', x: 4, y: 3 });
    s.game = survive(drain(s.game!), 6); finishStage(s); expect(s.game.battle.outcome).toBe('victory'); expect(s.game.battle.round).toBe(6); expect(s.campaign.credits).toBe(3000);
    expect(enterNode(s, data, content, true).screen).toBe('end');
  });
  it('without persuasion, next deployment and opening narration reflect the flag', () => {
    let s = enterNode(titleSession(), data, content); s.game = survive(drain(s.game!), 4); finishStage(s);
    s = enterNode(enterNode(s, data, content, true), data, content, true);
    expect(s.game!.battle.units.some(u => u.id === 'rival')).toBe(false);
    let g = transition(s.game!, { type: 'tick', ms: 10000 }); g = transition(g, { type: 'tick', ms: 10000 });
    expect(g.scenario!.runner.waiting!.command.op).toBe('narrate');
  });
  it('full scenario command log replay matches core snapshot exactly, including effects and spawns', () => {
    let s = enterNode(titleSession(), data, content); s.game = survive(persuade(s.game!), 4); finishStage(s);
    s = enterNode(enterNode(s, data, content, true), data, content, true);
    const initial = s.game!.battle, g = survive(drain(s.game!), 6); let replay = initial;
    for (const cmd of g.commands) replay = apply(replay, cmd).state;
    expect(snapshot(replay)).toBe(snapshot(g.battle));
    expect(g.commands.filter(c => c.type === 'system').map(c => c.action.kind)).toEqual(expect.arrayContaining(['spawn', 'move', 'set-ai', 'effect', 'leave', 'win']));
  });
  it('restores during text and timed animation waits and follows the exact same progression', () => {
    let s = enterNode(titleSession(), data, content); s.game = transition(s.game!, { type: 'tick', ms: 500 }); s.campaign = s.game.scenario!.campaign;
    expect(s.game.scenario!.runner.waiting!.command.op).toBe('talk');
    s.game = transition(s.game, { type: 'tick', ms: 120 }); s.campaign = s.game.scenario!.campaign;
    const loaded = deserialize(serialize(s, data), data, content); expect(loaded.game!.scenario!.runner).toEqual(s.game.scenario!.runner);
    const a = survive(persuade(s.game), 4), b = survive(persuade(loaded.game!), 4);
    expect(snapshot(a.battle)).toBe(snapshot(b.battle)); expect(a.commands).toEqual(b.commands); expect(a.scenario!.campaign).toEqual(b.scenario!.campaign);
  });
  it('saves to one key, resumes intermission and rejects corrupt or incompatible saves', () => {
    const values = new Map<string, string>(), storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); } };
    const s = enterNode(titleSession(), data, content); expect(saveSession(storage, s, data)).toBe(true); expect(values.size).toBe(1);
    expect(serialize(loadSession(storage, data, content)!, data)).toBe(serialize(s, data));
    const broken = JSON.parse(serialize(s, data)); broken.fingerprint++; expect(() => deserialize(JSON.stringify(broken), data, content)).toThrow('콘텐츠');
    storage.setItem([...values.keys()][0], 'bad'); expect(loadSession(storage, data, content)).toBeNull();
    expect(saveSession({ ...storage, setItem() { throw new Error('quota'); } }, s, data)).toBe(false);
  });
  it('retry resets stage rewards, flags and recruitment to the stage-entry checkpoint', () => {
    let s = enterNode(titleSession(), data, content); s.game = persuade(s.game!); s.campaign = s.game.scenario!.campaign;
    expect(s.campaign.flags.persuaded).toBe(true); s.campaign = structuredClone(s.stageStart); s = enterNode(s, data, content);
    expect(s.campaign.flags.persuaded).toBeUndefined(); expect(s.campaign.credits).toBe(0); expect(s.game!.battle.units.find(u => u.id === 'rival')!.side).toBe('enemy');
  });
  it('saves and restores movement and combat display state with the pre-animation core snapshot', () => {
    const s = enterNode(titleSession(), data, content); let g = drain(s.game!);
    for (let n = 0; n < 2; n++) g = transition(g, { type: 'tap', cell: { x: 3, y: 3 } });
    for (let n = 0; n < 2; n++) g = transition(g, { type: 'tap', cell: { x: 3, y: 4 } });
    expect(g.mode).toBe('moving'); s.game = transition(g, { type: 'tick', ms: 30 }); s.campaign = s.game.scenario!.campaign;
    const loaded = deserialize(serialize(s, data), data, content);
    expect(loaded.game!.before).toEqual(s.game.before); expect(loaded.game!.elapsed).toBe(30);
    expect(drain(loaded.game!)).toEqual(drain(s.game));
  });
  it('rejects corrupt script pointers, waiting commands and campaign resources', () => {
    const s = enterNode(titleSession(), data, content), original = serialize(s, data);
    const badPc = JSON.parse(original); badPc.session.game.scenario.runner.queue[0].pc = 9999;
    expect(() => deserialize(JSON.stringify(badPc), data, content)).toThrow('포인터');
    const badWait = JSON.parse(original); badWait.session.game.scenario.runner.waiting.command.op = 'win';
    expect(() => deserialize(JSON.stringify(badWait), data, content)).toThrow('대기');
    const badFunds = JSON.parse(original); badFunds.session.campaign.credits = -1;
    expect(() => deserialize(JSON.stringify(badFunds), data, content)).toThrow('캠페인');
  });
});
