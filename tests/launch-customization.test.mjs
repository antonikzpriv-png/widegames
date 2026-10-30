import test from 'node:test';
import assert from 'node:assert/strict';
import {normalisePregameDraft} from '../public/pregame-customization.mjs';
import {LOBBY_DEFAULTS,PERSONAS} from '../shared/lobby.mjs';

test('launch drafts preserve real map, mode settings, features and normalized wardrobe choices without sharing objects',()=>{
 const original=JSON.stringify(LOBBY_DEFAULTS),input={settings:{capacity:15,saboteurs:3,taskMix:'captcha'},mapId:'storm-foundry',features:{deathPolicy:'ghost-tasks',abilities:true},profile:{name:'  Ｍarin 02  ',color:PERSONAS[14].color}},draft=normalisePregameDraft(input);
 assert.equal(draft.settings.capacity,15);assert.equal(draft.settings.saboteurs,3);assert.equal(draft.settings.taskMix,'captcha');assert.equal(draft.mapId,'storm-foundry');assert.equal(draft.profile.name,'Marin 02');assert.equal(draft.profile.color,PERSONAS[14].color);assert.deepEqual(draft.features,{deathPolicy:'ghost-tasks',abilities:true});
 draft.settings.capacity=4;draft.features.abilities=false;draft.profile.name='Changed';assert.equal(input.settings.capacity,15);assert.equal(input.features.abilities,true);assert.equal(input.profile.name,'  Ｍarin 02  ');assert.equal(JSON.stringify(LOBBY_DEFAULTS),original);
});

test('launch rejects invalid rules and unsupported cosmetic/map values before opening a room',()=>{
 for(const input of [{settings:{capacity:4,saboteurs:3}},{settings:{speed:0}},{settings:{taskMix:'instant-win'}},{mapId:'missing-map'},{profile:{name:'Invisible\u200B'}},{profile:{name:'Long'.repeat(10)}},{profile:{color:'#000000'}},{features:{abilities:'yes'}}])assert.throws(()=>normalisePregameDraft(input));
});

test('historical launch settings acquire explicit supported defaults without mutating the original checkpoint values',()=>{
 const old={...LOBBY_DEFAULTS};delete old.taskMix;const snapshot=JSON.stringify(old),draft=normalisePregameDraft({settings:old});assert.equal(draft.settings.taskMix,'mixed');assert.equal(JSON.stringify(old),snapshot);assert.notEqual(draft.settings,old);assert.equal(draft.settings.capacity,6);assert.equal(draft.settings.saboteurs,1);
});
