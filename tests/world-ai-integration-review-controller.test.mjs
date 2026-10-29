import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = process.env.WORLD_AI_SOURCE_ROOT ? pathToFileURL(resolve(process.env.WORLD_AI_SOURCE_ROOT) + '/') : new URL('../', import.meta.url);
const pin = process.env.WORLD_AI_REVIEW_APP_PIN;
if (pin) assert.match(pin, /^[a-f0-9]{40}$/);
const source = (path, revision = pin) => revision ? execFileSync('git', ['show', `${revision}:${path}`], { encoding: 'utf8' }) : readFileSync(new URL(path, root), 'utf8');
const strip = value => value.replace(/^import .*$/gm, '').replace(/^export /gm, '');
const dataUrl = value => 'data:text/javascript;base64,' + Buffer.from(value).toString('base64');
const flush = () => new Promise(resolve => setImmediate(resolve));
function domFixture(){
 let document;
 class NodeFixture{
  constructor(tag='',type=1,text=''){this.tagName=tag.toUpperCase();this.nodeType=type;this.nodeValue=text;this.parentNode=null;this.childNodes=[];this._attrs=new Map();this.style={};this.namespaceURI='http://www.w3.org/1999/xhtml';this._listeners=new Map();this.value='';this.selectionStart=0;this.selectionEnd=0;this.scrollTop=0;}
  get children(){return this.childNodes.filter(n=>n.nodeType===1);}get attributes(){return [...this._attrs].map(([name,value])=>({name,value}));}get lastChild(){return this.childNodes.at(-1);}
  get id(){return this.getAttribute('id')||'';}get className(){return this.getAttribute('class')||'';}set className(value){this.setAttribute('class',value);}
  get classList(){return {toggle:(name,on)=>{const names=new Set(this.className.split(/\s+/).filter(Boolean));if(on??!names.has(name))names.add(name);else names.delete(name);this.className=[...names].join(' ');}};}
  get disabled(){return this.hasAttribute('disabled');}set disabled(value){if(value)this.setAttribute('disabled','');else this.removeAttribute('disabled');}
  get hidden(){return this.hasAttribute('hidden');}set hidden(value){if(value)this.setAttribute('hidden','');else this.removeAttribute('hidden');}
  get isConnected(){return this===document.body||Boolean(this.parentNode?.isConnected);}
  setAttribute(name,value){this._attrs.set(name,String(value));}getAttribute(name){return this._attrs.get(name)??null;}hasAttribute(name){return this._attrs.has(name);}removeAttribute(name){this._attrs.delete(name);}
  contains(node){return this===node||this.childNodes.some(n=>n.contains(node));}
  insertBefore(node,before){node.remove();const index=before?this.childNodes.indexOf(before):this.childNodes.length;assert(index>=0);this.childNodes.splice(index,0,node);node.parentNode=this;return node;}
  append(...nodes){for(const node of nodes)this.insertBefore(node instanceof NodeFixture?node:new NodeFixture('',3,String(node)),null);}
  prepend(...nodes){for(const node of [...nodes].reverse())this.insertBefore(node,this.childNodes[0]||null);}
  replaceChildren(...nodes){for(const node of [...this.childNodes])node.remove();this.append(...nodes);}
  remove(){if(!this.parentNode)return;if(this.contains(document.activeElement))document.activeElement=document.body;const siblings=this.parentNode.childNodes;siblings.splice(siblings.indexOf(this),1);this.parentNode=null;}
  get textContent(){return this.nodeType===3?this.nodeValue:this.childNodes.map(n=>n.textContent).join('');}set textContent(value){this.replaceChildren(new NodeFixture('',3,String(value)));}
  addEventListener(name,handler){if(!this._listeners.has(name))this._listeners.set(name,new Set());this._listeners.get(name).add(handler);}removeEventListener(name,handler){this._listeners.get(name)?.delete(handler);}
  focus(){if(this.isConnected&&!this.disabled)document.activeElement=this;}setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;}
  matches(selector){
   const attr=selector.match(/^\[([^=\]]+)(?:=["']?([^\]"']+)["']?)?\]$/);if(attr)return attr[2]===undefined?this.hasAttribute(attr[1]):this.getAttribute(attr[1])===attr[2];
   if(selector[0]==='#')return this.id===selector.slice(1);if(selector[0]==='.')return this.className.split(/\s+/).includes(selector.slice(1));return this.tagName===selector.toUpperCase();
  }
  querySelectorAll(selector){const all=[];const walk=node=>{for(const child of node.childNodes){if(child.nodeType===1&&child.matches(selector))all.push(child);walk(child);}};walk(this);return all;}querySelector(selector){return this.querySelectorAll(selector)[0]??null;}
 }
 document={createElement:tag=>new NodeFixture(tag),createElementNS:(ns,tag)=>{const node=new NodeFixture(tag);node.namespaceURI=ns;return node;},createTextNode:text=>new NodeFixture('',3,String(text)),hidden:false};
 document.body=new NodeFixture('body');document.activeElement=document.body;
 for(const id of ['main','feedback','phase-status']){const node=new NodeFixture(id==='main'?'main':'div');node.setAttribute('id',id);document.body.append(node);}
 document.querySelector=selector=>document.body.querySelector(selector);document.querySelectorAll=selector=>document.body.querySelectorAll(selector);document.getElementById=id=>document.querySelector('#'+id);
 return {document,NodeFixture};
}

// Actual root lifecycle/network functions, minimal DOM and unabortable queued
// responses. Stub renderer captures owner-bound callbacks; no Chrome claims.
async function fixture(sourcePin = pin) {
  const { document, NodeFixture } = domFixture(), instances = [], requests = [], timers = new Map(); let timer = 0;
  const api = await import(dataUrl(source('public/api.mjs', sourcePin)));
  const { worldInputEnvelope } = await import(dataUrl(source('public/world-input-envelope.mjs', sourcePin)));
  const context = vm.createContext({ document, Node: NodeFixture, console, AbortController, DOMException, crypto, Date,
    CSS: { escape: value => value }, history: { replaceState() {}, pushState() {} }, sessionStorage: { setItem() {}, removeItem() {} }, location: { href: 'http://fixture/', protocol: 'http:', host: 'fixture' }, navigator: {},
    setTimeout: (fn, ms) => { const id = ++timer; timers.set(id, { fn, ms }); return id; }, clearTimeout: id => timers.delete(id),
    WebSocket: class { constructor() { throw new Error('Labeled WS-unavailable fixture'); } },
    worldInputEnvelope, roomPath: api.roomPath, roomFrom: api.roomFrom, actionEnvelope: api.actionEnvelope, roomIdFromPath: api.roomIdFromPath,
    request: (path, options = {}) => { const entry = { path, options }; requests.push(entry); return new Promise((resolve, reject) => Object.assign(entry, { resolve, reject })); },
    createWorldExperience: (host, callbacks) => { const item = { callbacks, updates: [], disposed: false }; instances.push(item); return { update: (room, options) => item.updates.push({ room, options }), dispose: () => { item.disposed = true; } }; },
    harbor: () => document.createElement('section'), phaseLabel: value => value, aiLabel: () => 'DEMO', aiNotice: () => '', requestAnimationFrame: () => 0, queueMicrotask });
  Object.assign(context, vm.runInContext(`(()=>{${strip(source('public/ui.mjs', sourcePin))};return {element,button,syncChildren,secondsUntil,clockText};})()`, context)); context.h = context.element;
  const app = source('public/app.mjs', sourcePin); assert(app.includes('const rulesToggle='));
  vm.runInContext(strip(app.slice(0, app.indexOf('const rulesToggle='))) + ';globalThis.audit={openRoom,home,stop,getRoom:()=>room,getRetry:()=>retry};', context);
  const button = label => document.querySelectorAll('button').find(node => node.textContent === label);
  const activate = node => { assert(node); return [...node._listeners.get('click')][0]({ target: node, preventDefault() {} }); };
  return { api: context.audit, requests, instances, document, timers, button, activate };
}
function room(id, version = 1) { return { roomId: id, mode: 'human', isHost: true, seatId: 'p1', ai: { mode: 'demo' }, notices: [], game: { worldVersion: 1, matchId: id, version, serverNow: 1000 + version, phase: 'roam', self: { id: 'p1', alive: true, role: 'crew', tasks: [] }, players: [], events: [] } }; }
const uncertain = () => Object.assign(new Error('Labeled uncertain request'), { status: 503 });

test('independent root: old world input/action/replay completions and callbacks cannot affect another room', async () => {
  const f = await fixture(); await f.api.openRoom('room-A', room('room-A')); const first = f.instances[0];
  const pending = [first.callbacks.input({ seq: 1, dx: .707, dy: -.707 }), first.callbacks.loadReplay(), first.callbacks.action('task', { taskId: 'task-A' })];
  const settled = Promise.allSettled(pending); assert.equal(f.requests.length, 3); assert.equal(f.requests[0].options.body.dx, 1); assert.equal(f.requests[0].options.body.dy, -1);
  const ordinary = [...f.requests]; await f.api.openRoom('room-B', room('room-B')); assert(first.disposed); assert(ordinary.every(request => request.options.signal.aborted));
  const cleanup = f.requests.filter(request => !ordinary.includes(request));
  assert(cleanup.length >= 1); for (const request of cleanup) { assert.equal(request.path, '/api/rooms/room-A/input'); assert.equal(request.options.body.dx, 0); assert.equal(request.options.body.dy, 0); assert.equal(request.options.keepalive, true); assert.equal(request.options.timeoutMs, 1500); assert.equal(request.options.signal, undefined); }
  for (const request of f.requests) request.resolve(room('room-A', 200));
  assert((await settled).every(result => result.status === 'rejected')); assert.equal(f.api.getRoom().roomId, 'room-B');
  const count = f.requests.length;
  for (const call of [() => first.callbacks.input({ seq: 2, dx: 0, dy: 0 }), () => first.callbacks.action('task', {}), () => first.callbacks.start(), () => first.callbacks.loadReplay()]) await assert.rejects(call, /room changed/i);
  first.callbacks.leave(); assert.equal(f.api.getRoom().roomId, 'room-B'); assert.equal(f.requests.length, count);
});

test('independent root: hidden/stopped/disposed world owner cannot send further input', async () => {
  const f = await fixture(); await f.api.openRoom('room-A', room('room-A')); const first = f.instances[0];
  f.document.hidden = true; await assert.rejects(() => first.callbacks.input({ seq: 1, dx: 1, dy: 0 }), /room changed/i); assert.equal(f.requests.length, 0);
  f.api.stop(); f.document.hidden = false; await assert.rejects(() => first.callbacks.input({ seq: 2, dx: 0, dy: 0 }), /room changed/i);
  f.api.home(); assert(first.disposed); await assert.rejects(() => first.callbacks.start(), /room changed/i);
  assert(f.requests.length >= 1); for (const cleanup of f.requests) { assert.equal(cleanup.path, '/api/rooms/room-A/input'); assert.equal(cleanup.options.body.dx, 0); assert.equal(cleanup.options.body.dy, 0); assert.equal(cleanup.options.keepalive, true); assert.equal(cleanup.options.signal, undefined); cleanup.resolve(room('room-A', 200)); }
  await flush(); assert.equal(f.api.getRoom(), null);
});

test('independent root: HTTP-only fallback stays playable and uncertain task rejects while same-ID retry remains accessible', async () => {
  const f = await fixture(); await f.api.openRoom('room-A', room('room-A')); const instance = f.instances[0];
  assert.equal(instance.updates.at(-1).options.connected, true, 'authenticated HTTP is playable when WS constructor fails');
  const operation = instance.callbacks.action('task', { taskId: 'task-A' }); const rejected = assert.rejects(operation, /uncertain request/i);
  const original = f.requests[0]; original.reject(uncertain()); await rejected;
  const feedback = f.document.querySelector('#feedback'); assert.equal(feedback.getAttribute('data-retry'), 'true'); assert(f.button('Retry same request'));
  const retry = f.activate(f.button('Retry same request')); assert.equal(f.requests[1].path, original.path); assert.deepEqual(f.requests[1].options.body, original.options.body);
  f.requests[1].resolve(room('room-A', 2)); await retry; assert.equal(feedback.getAttribute('data-retry'), 'false'); assert(!f.button('Retry same request'));
  assert.match(feedback.textContent, /confirmed/i);
  const css = source('public/styles.css'); assert.match(css, /body\.world-mode>#feedback\[data-retry=true\]\{display:flex;position:fixed;z-index:90/);
});

test('independent root: retained old-room retry callback must not invoke a new room retry', async () => {
  const f = await fixture(); await f.api.openRoom('room-A', room('room-A'));
  let operation = f.instances[0].callbacks.action('task', { taskId: 'task-A' }); let rejection = assert.rejects(operation); f.requests.at(-1).reject(uncertain()); await rejection;
  const oldButton = f.button('Retry same request'), oldHandler = [...oldButton._listeners.get('click')][0];
  await f.api.openRoom('room-B', room('room-B'));
  operation = f.instances.at(-1).callbacks.action('task', { taskId: 'task-B' }); rejection = assert.rejects(operation); f.requests.at(-1).reject(uncertain()); await rejection;
  const count = f.requests.length, stale = oldHandler({ preventDefault() {} });
  if (f.requests.length > count) { f.requests.at(-1).resolve(room('room-B', 2)); await stale; }
  assert.equal(f.requests.length, count, 'old callback must not execute the new owner retry');
});

test('historical root c683963 KNOWN DEFECT: retained retry invokes the new owner retry', async () => {
  const f = await fixture('c68396318ba2df0c9608f1e9fa624f5a0a593476'); await f.api.openRoom('room-A', room('room-A'));
  let operation = f.instances[0].callbacks.action('task', { taskId: 'task-A' }); let rejection = assert.rejects(operation); f.requests.at(-1).reject(uncertain()); await rejection;
  const oldButton = f.button('Retry same request'), oldHandler = [...oldButton._listeners.get('click')][0];
  await f.api.openRoom('room-B', room('room-B'));
  operation = f.instances.at(-1).callbacks.action('task', { taskId: 'task-B' }); rejection = assert.rejects(operation); f.requests.at(-1).reject(uncertain()); await rejection;
  const count = f.requests.length, stale = oldHandler({ preventDefault() {} });
  if (f.requests.length > count) { f.requests.at(-1).resolve(room('room-B', 2)); await stale; }
  assert.equal(f.requests.length, count + 1, 'historical callback executes the new owner retry');
});

test('independent root: failed movement revokes readiness until authenticated HTTP polling resynchronizes', async () => {
  const f = await fixture(); await f.api.openRoom('room-A', room('room-A')); const instance = f.instances[0];
  const input = instance.callbacks.input({ seq: 1, dx: 1, dy: 0 }), rejected = assert.rejects(input); f.requests[0].reject(new Error('Labeled unavailable movement')); await rejected;
  assert.equal(instance.updates.at(-1).options.connected, false);
  await assert.rejects(() => instance.callbacks.input({ seq: 2, dx: 1, dy: 0 }), /resynchronizing/i); assert.equal(f.requests.length, 1);
  const poll = [...f.timers.values()][0].fn(); assert.equal(f.requests[1].path, '/api/rooms/room-A'); f.requests[1].resolve(room('room-A', 2)); await poll;
  assert.equal(instance.updates.at(-1).options.connected, true);
  const resumed = instance.callbacks.input({ seq: 3, dx: 1, dy: 0 }); f.requests[2].resolve(room('room-A', 3)); await resumed;
});

test('independent root: lifecycle zero stops are scoped and fresh local intents allocate beyond their wire sequence', async () => {
  const f = await fixture(), initial = room('room-A'); initial.game.self.inputSeq = 40; await f.api.openRoom('room-A', initial); const scene = f.instances[0];
  const first = scene.callbacks.input({ seq: 5, dx: 1, dy: 0 }); assert.equal(f.requests[0].options.body.seq, 41); const ack = room('room-A', 2); ack.game.self.inputSeq = 41; f.requests[0].resolve(ack); await first;
  f.document.hidden = true; f.api.stop(); const cleanup = f.requests.at(-1); assert.equal(cleanup.options.body.seq, 42); assert.equal(cleanup.options.signal, undefined); assert.equal(cleanup.options.keepalive, true); assert.equal(cleanup.options.timeoutMs, 1500);
  cleanup.resolve(room('room-A', 900)); await flush(); assert.equal(f.api.getRoom().game.version, 2, 'cleanup response never becomes state');
  f.document.hidden = false; const restored = room('room-A', 3); restored.game.self.inputSeq = 42; await f.api.openRoom('room-A', restored);
  const stops = f.requests.filter(request => request.options.keepalive); assert(stops.every(request => request.path === '/api/rooms/room-A/input' && !request.options.body.dx && !request.options.body.dy));
  const maximumStop = Math.max(...stops.map(request => request.options.body.seq));
  const current = scene.callbacks.input({ seq: 6, dx: 0, dy: 1 }), sent = f.requests.at(-1); assert(sent.options.body.seq > maximumStop); const packet = { ...sent.options.body }; sent.resolve(room('room-A', 4)); await current;
  const duplicate = scene.callbacks.input({ seq: 6, dx: 0, dy: 1 }); assert.deepEqual(JSON.parse(JSON.stringify(f.requests.at(-1).options.body)), packet); f.requests.at(-1).resolve(room('room-A', 4)); await duplicate;
  const count = f.requests.length; await assert.rejects(() => scene.callbacks.input({ seq: 5, dx: 1, dy: 0 }), /newer control intent/i); await assert.rejects(() => scene.callbacks.input({ seq: 6, dx: 1, dy: 0 }), /sequence already used/i); assert.equal(f.requests.length, count);
  for (const stop of stops) stop.resolve(room('room-A', 1000)); await flush(); assert.equal(f.api.getRoom().game.version, 4);
});

test('independent root API: keepalive stop remains same-origin, uncached and independent of an aborted ordinary controller', async t => {
  const { request } = await import(dataUrl(source('public/api.mjs'))); const ordinary = new AbortController(); ordinary.abort();
  let options;
  t.mock.method(globalThis, 'fetch', async (path, init) => { assert.equal(path, '/api/rooms/room-A/input'); options = init; return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } }); });
  await request('/api/rooms/room-A/input', { method: 'POST', body: { seq: 9, dx: 0, dy: 0 }, keepalive: true, timeoutMs: 1500 });
  assert.equal(options.keepalive, true); assert.equal(options.credentials, 'same-origin'); assert.equal(options.cache, 'no-store'); assert.equal(options.signal.aborted, false); assert.notEqual(options.signal, ordinary.signal); assert.deepEqual(JSON.parse(options.body), { seq: 9, dx: 0, dy: 0 });
});
