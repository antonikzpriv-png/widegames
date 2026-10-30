// Minimal DOM fixture adapted read-only from Reviewer's world-ai-ui-review.test.mjs
// SHA256 3556e2d7a1933af2b3d8adfaee7c80696b664a501407d3c86ec3e5837622f189.
// These are controlled retained callback counterexamples, not native-browser workflows.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const sourceRoot = process.env.WORLD_UI_TEST_SOURCE_ROOT ? pathToFileURL(resolve(process.env.WORLD_UI_TEST_SOURCE_ROOT) + '/') : new URL('../', import.meta.url);
const uiRoot = process.env.WORLD_UI_TEST_UI_ROOT ? pathToFileURL(resolve(process.env.WORLD_UI_TEST_UI_ROOT) + '/') : sourceRoot;
const world = await import(new URL('shared/world.mjs', sourceRoot));
const { CHARACTERS } = await import(new URL('shared/contracts.mjs', sourceRoot));
const source = path => readFileSync(new URL(path, uiRoot), 'utf8');
const strip = text => text.replace(/^\uFEFF/gm, '').replace(/^import .*$/gm, '').replace(/^export /gm, '');
const flush = () => new Promise(resolve => setImmediate(resolve));
const {getMap} = await import(new URL('shared/maps/index.mjs', sourceRoot));
const mapHelpers = await import(new URL('public/world/map-model.mjs', uiRoot));
const beaconHelpers = await import(new URL('public/world/beacon-model.mjs', uiRoot));
const spectatorHelpers=await import(new URL('public/world/spectator.mjs',uiRoot));
// Real shared dependency introduced by merged ghost/task UI, no behavior stub.
const featureHelpers=/canViewAct/.test(source('public/world/experience.mjs'))?await import(new URL('shared/features.mjs',uiRoot)):{};


// Actual frontend logic, controlled network completions, minimal DOM. These
// adversarial retained callbacks are not claims about native click scheduling.
function fixture() {
  const events = () => ({ handlers: new Map(), addEventListener(type, fn) { if (!this.handlers.has(type)) this.handlers.set(type, new Set()); this.handlers.get(type).add(fn); }, removeEventListener(type, fn) { this.handlers.get(type)?.delete(fn); } });
  const document = { ...events(), hidden: false, activeElement: null };
  class Node {
    constructor(tag) { Object.assign(this, events()); this.tagName = tag.toUpperCase(); this.children = []; this.parentNode = null; this.attrs = new Map(); this.dataset = {}; this.style = { setProperty() {} }; this.hidden = false; this.disabled = false; this.text = ''; this.value = ''; this.ownerDocument = document; }
    setAttribute(key, value) { this.attrs.set(key, String(value)); } getAttribute(key) { return this.attrs.get(key) ?? null; }
    get className() { return this.attrs.get('class') ?? ''; } set className(value) { this.setAttribute('class', value); }
    get classList() { return { add: (...names) => { this.className = [...new Set([...this.className.split(' '), ...names])].join(' '); }, remove: (...names) => { this.className = this.className.split(' ').filter(n => !names.includes(n)).join(' '); }, toggle: (name, value) => { if (value) this.classList.add(name); else this.classList.remove(name); } }; }
    get textContent() { return this.text + this.children.map(n => n.textContent).join(''); } set textContent(value) { this.replaceChildren(); this.text = String(value); }
    get isConnected() { return this === document.body || !!this.parentNode?.isConnected; }
    get visible() { return this.isConnected && !this.hidden && (!this.parentNode || this.parentNode.visible); }
    append(...nodes) { for (const node of nodes) { node.remove(); this.children.push(node); node.parentNode = this; } }
    replaceChildren(...nodes) { for (const node of [...this.children]) node.remove(); this.text = ''; this.append(...nodes); }
    remove() { if (!this.parentNode) return; if (this.contains(document.activeElement)) document.activeElement = document.body; this.parentNode.children = this.parentNode.children.filter(n => n !== this); this.parentNode = null; }
    contains(node) { return this === node || this.children.some(n => n.contains(node)); }
    focus() { if (this.visible && !this.disabled) document.activeElement = this; }
    querySelectorAll(selector) { const found = [], selectors = selector.split(','); const match = node => selectors.some(s => s.startsWith('.') ? node.className.split(' ').includes(s.slice(1)) : s === 'button' ? node.tagName === 'BUTTON' : s.startsWith('[') ? node.getAttribute(s.slice(1, -1)) !== null : node.tagName === s.toUpperCase()); const walk = node => { for (const child of node.children) { if (match(child)) found.push(child); walk(child); } }; walk(this); return found; }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    getClientRects() { return this.visible ? [{}] : []; }
    getContext() { return { clearRect() {} }; }
    getBoundingClientRect() { return { x: 0, y: 0, left: 0, top: 0, width: 0, height: 0 }; }
    closest() { return null; }
  }
  document.createElement = tag => new Node(tag); document.body = new Node('body'); document.activeElement = document.body;
  const win = { ...events(), setInterval: () => 1, clearInterval() {} }, calls = [];
  const context = vm.createContext({ document, window: win, world, CHARACTERS, getMap, ...mapHelpers, mapRoomName:mapHelpers.roomName, ...beaconHelpers, ...featureHelpers, ...spectatorHelpers, console, Date, performance: { now: () => 100 }, matchMedia: () => ({ matches: true }), requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    drawKeeper() {}, createWorldScene: () => ({ update() {}, draw() {}, toWorld() { return { x: 0, y: 0 }; }, dispose() {} }), replayText: event => event.type, replayEvents: value => value.replay ?? [], outcomeText: reason => reason });
  const module = (path, names) => Object.assign(context, vm.runInContext(`(()=>{${strip(source(path))};return {${names}};})()`, context));
  module('public/world/dom.mjs', 'dom,control,setText,trapDialog,restoreTrigger');
  module('public/world/model.mjs', 'aiLabel,clock,contexts,distance,point,roleLabel,taskKind,validTaskSession,visiblePlayers');
  module('public/world/input.mjs', 'createWorldInput');
  module('public/world/puzzles.mjs', 'createTaskPuzzle');
  module('public/world/phases.mjs', 'createCouncil,createResults');
  // New dependencies are actual modules in the fixture DOM, never inert replacements.
  // Preserve the historical 9e equipment fixture whose source predates these imports.
  if (/createLocalSound/.test(source('public/world/experience.mjs'))) {
    module('public/world/lobby-map.mjs', 'createLobbyMapSelector');
    module('public/world/sound.mjs', 'createLocalSound');
    module('public/world/camera-cards.mjs', 'createCameraCards');
    module('public/world/beacon-panel.mjs', 'createBeaconPanel');
  }
  if(/createSpectatorInput/.test(source('public/world/experience.mjs')))module('public/world/spectator.mjs','createSpectatorInput,createSpectatorInspector,observerAgents,observerGame');
  module('public/world/experience.mjs', 'createWorldExperience');
  const host = document.createElement('main'); document.body.append(host);
  let action = async (type, fields) => { calls.push({ type, fields }); };
  const experience = context.createWorldExperience(host, { action: (...args) => action(...args), input: async () => {}, start: async () => {}, leave() {}, loadReplay: async () => ({ replay: [] }) });
  const find = (predicate, visible = true) => host.querySelectorAll('button').find(node => (!visible || node.visible) && predicate(node));
  const click = node => { assert(node, 'missing fixture button'); if (node.disabled) return; return [...(node.handlers.get('click') ?? [])][0]?.({ target: node, preventDefault() {} }); };
  const button = text => find(node => node.textContent === text);
  function update(room) { experience.update(room, { now: room.game.serverNow, connected: true, pending: false }); }
  function open(room) { update(room); const enter = button('Enter the beacon'); if (enter) click(enter); click(find(node => node.dataset.worldAction === 'use')); assert(host.querySelector('.lw-task-modal')?.visible); }
  function solve() { for (const n of [1, 2, 3]) { click(find(node => node.getAttribute('aria-label')?.startsWith(`Left cable ${n}`))); click(find(node => node.getAttribute('aria-label')?.startsWith(`Right socket ${n}`))); } assert(!button('Send completed task').disabled); }
  return { host, document, experience, find, click, button, update, open, solve, calls, defer() { let done, fail; action = (type, fields) => { calls.push({ type, fields }); return new Promise((resolve, reject) => { done = resolve; fail = reject; }); }; return { resolve: () => done(), reject: () => fail(new Error('OLD TASK FAILURE')) }; } };
}
function room() {
  return { roomId: 'world-ui-owner', mode: 'human', isHost: true, ai: { mode: 'demo' }, notices: [], game: { matchId: 'world-ui-match', worldVersion: 1, phase: 'roam', version: 1, serverNow: 1000, deadlineAt: 200000,
    players: CHARACTERS.map(p => ({ ...p, alive: true, position: p.id === 'p1' ? { ...world.WORLD_STATIONS.bridge } : null })),
    self: { id: 'p1', role: 'crew', alive: true, roomId: 'bridge', position: { ...world.WORLD_STATIONS.bridge }, inputSeq: 0, tasks: [{ id: 'relay-1', label: 'Relay fixture', roomId: 'bridge', completed: false }] }, tasks: { total: 15, completed: 0 }, availableActions: ['task', 'wait', 'navigate'], events: [], meeting: null } };
}
function council(before) { const next = structuredClone(before); next.game.phase = 'discussion'; next.game.version++; next.game.availableActions = ['say']; next.game.meeting = { id: 'council-1', reason: 'timeout', messages: [], votes: [], eligibleVoters: CHARACTERS.map(p => p.id) }; return next; }


for(const change of ['council','room','match','position','disabled','dead','completed','closed','phase-return']) test('task rejection ownership: old failure is inert after '+change, async()=>{
 const f=fixture(),initial=room();
 try{
  f.open(initial);f.solve();const pending=f.defer();f.click(f.button('Send completed task'));
  let next=structuredClone(initial);
  if(change==='council'||change==='phase-return')next=council(initial);
  if(change==='room')next.roomId='another-room';
  if(change==='match')next.game.matchId='another-match';
  if(change==='position')next.game.self.position={x:650,y:300};
  if(change==='disabled')next.game.availableActions=['wait'];
  if(change==='dead')next.game.self.alive=false;
  if(change==='completed')next.game.self.tasks[0].completed=true;
  if(change==='closed'){
   const modal=f.host.querySelector('.lw-task-modal');
   [...modal.handlers.get('keydown')][0]({key:'Escape',preventDefault(){}});
  }else f.update(next);
  if(change==='phase-return')f.update(initial);
  f.experience.update(change==='phase-return'?initial:next,{now:1000,connected:true,pending:false,feedback:'CURRENT WATCH NOTICE'});
  const feedback=f.host.querySelector('.lw-feedback'),before=feedback.textContent,chat=f.host.querySelector('textarea');
  if(change==='council')chat.focus();
  pending.reject();await flush();
  assert.equal(feedback.textContent,before,'obsolete rejection must preserve current feedback exactly');
  assert(!f.host.querySelector('.lw-task-modal')?.visible);
  if(change==='council')assert.equal(f.document.activeElement,chat);
  assert.equal(f.calls.length,1);
 }finally{f.experience.dispose();}
});

test('task rejection ownership: disposed equipment cannot receive a deferred error',async()=>{
 const f=fixture(),view=room();f.open(view);f.solve();const pending=f.defer();f.click(f.button('Send completed task'));
 const feedback=f.host.querySelector('.lw-feedback'),before=feedback.textContent;f.experience.dispose();pending.reject();await flush();
 assert.equal(feedback.textContent,before);assert.equal(f.host.children.length,0);assert.equal(f.calls.length,1);
});

test('task rejection ownership: current failure preserves solved nodes, error and a retryable submission',async()=>{
 const f=fixture(),view=room();
 try{
  f.open(view);f.solve();const modal=f.host.querySelector('.lw-task-modal'),submit=f.button('Send completed task'),pending=f.defer();
  f.click(submit);assert(submit.disabled);pending.reject();await flush();
  assert.equal(f.host.querySelector('.lw-task-modal'),modal);assert(modal.visible);assert.equal(f.button('Send completed task'),submit);assert(!submit.disabled);
  assert.match(f.host.querySelector('.lw-feedback').textContent,/OLD TASK FAILURE/);assert.equal(f.host.querySelectorAll('.lw-connected-wire').length,3);
  assert.equal(view.game.self.tasks[0].completed,false,'presentation must not manufacture completion');
  const retry=f.defer();f.click(submit);retry.resolve();await flush();assert.equal(f.calls.length,2);assert(!modal.visible);assert.match(f.host.querySelector('.lw-feedback').textContent,/Task submitted/);
 }finally{f.experience.dispose();}
});
