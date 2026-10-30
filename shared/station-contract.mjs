/** Original in-game station puzzles; not an external anti-bot service. */
export const STATION_TASK_VERSION=1;
export const STATION_TASK_KINDS=Object.freeze(['circuit','signal','sequence','glyphs','alignment','manifolds']);
export const isStationTask=task=>task?.kind==='station'&&task?.challenge?.version===STATION_TASK_VERSION&&STATION_TASK_KINDS.includes(task.challenge.kind);
export const STATION_INPUT_FIELDS=Object.freeze(['taskId','interactionId','value']);
