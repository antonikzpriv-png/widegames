import test from 'node:test';
import assert from 'node:assert/strict';
import {containsShape,floorBoundary,distanceToSegment} from '../shared/maps/shape-geometry.mjs';

const rect=(x,y,width,height)=>({x,y,width,height});
const segment=(x1,y1,x2,y2)=>({a:{x:x1,y:y1},b:{x:x2,y:y2}});
const boundaryLength=walls=>walls.reduce((sum,w)=>sum+Math.hypot(w.b.x-w.a.x,w.b.y-w.a.y),0);

test('polygon membership rejects clipped corners and concave notches inside room bounds',()=>{
 const octagon={...rect(0,0,100,100),outline:[[20,0],[80,0],[100,20],[100,80],[80,100],[20,100],[0,80],[0,20]].map(([x,y])=>({x,y}))};
 assert(containsShape({x:50,y:50},octagon));assert(containsShape({x:10,y:10},octagon));assert(!containsShape({x:5,y:5},octagon));
 const elbow={...rect(0,0,100,100),outline:[[0,0],[100,0],[100,40],[40,40],[40,100],[0,100]].map(([x,y])=>({x,y}))};
 assert(containsShape({x:20,y:80},elbow));assert(!containsShape({x:80,y:80},elbow));assert(!containsShape({x:101,y:20},elbow));
});

test('union boundaries leave overlapping and edge-touching doors open without removing hull walls',()=>{
 const floors=[rect(0,0,100,100),rect(80,40,100,20),rect(180,0,100,100)],walls=floorBoundary(floors);
 assert.equal(boundaryLength(walls),920);
 for(const p of [{x:100,y:50},{x:180,y:50},{x:90,y:50}])assert(walls.every(w=>distanceToSegment(p,w)>=10));
 assert(walls.some(w=>distanceToSegment({x:100,y:20},w)===0));
 assert(walls.some(w=>distanceToSegment({x:280,y:50},w)===0));
 assert(Object.isFrozen(walls)&&walls.every(w=>Object.isFrozen(w.a)&&Object.isFrozen(w.b)));
});

test('crossing polygon floor edges are split; interior seams never become collision walls',()=>{
 const diamond={...rect(0,0,100,100),outline:[{x:50,y:0},{x:100,y:50},{x:50,y:100},{x:0,y:50}]};
 const walls=floorBoundary([diamond,rect(70,35,60,30)]);
 assert(walls.every(w=>distanceToSegment({x:90,y:50},w)>=15-1e-6));
 assert(walls.some(w=>distanceToSegment({x:20,y:20},w)<15));
 assert.equal(distanceToSegment({x:8,y:8},segment(0,0,10,10)),0);
 assert.equal(distanceToSegment({x:10,y:0},segment(0,0,10,10)),Math.sqrt(50));
});
