#!/usr/bin/env node
/**
 * Phase 4 generator: structural analysis + layer assignment -> layers.json
 */
import { createRequire } from 'node:module';
import { resolve, join, dirname, basename, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const PROJECT_ROOT = resolve(process.argv[2] || process.cwd());

const graph = JSON.parse(readFileSync(join(PROJECT_ROOT, '.understand-anything/intermediate/assembled-graph.json'), 'utf8'));

// Collect all file-level nodes
const FILE_TYPES = new Set(['file','config','document','service','pipeline','table','schema','resource','endpoint']);
const fileNodes = graph.nodes.filter(n => FILE_TYPES.has(n.type));
console.log('file-level nodes:', fileNodes.length);

// Directory grouping (common prefix src/)
const paths = fileNodes.map(n => n.filePath || n.id.replace(/^[^:]+:/,''));
// common prefix
function commonPrefix(arr) {
  if (!arr.length) return '';
  let prefix = arr[0];
  for (const s of arr) {
    while (!s.startsWith(prefix)) prefix = prefix.slice(0, -1);
    if (!prefix) return '';
  }
  return prefix;
}
const cp = commonPrefix(paths);
console.log('common prefix:', JSON.stringify(cp));

const dirGroups = {};
for (const n of fileNodes) {
  const p = n.filePath || n.id.replace(/^[^:]+:/,'');
  let seg;
  if (cp && p.startsWith(cp)) {
    const rest = p.slice(cp.length);
    seg = rest.split('/')[0] || '(root)';
  } else {
    seg = p.split('/')[0] || '(root)';
  }
  if (!dirGroups[seg]) dirGroups[seg] = [];
  dirGroups[seg].push(n.id);
}
console.log('directory groups:');
for (const [k,v] of Object.entries(dirGroups)) console.log(`  ${k}: ${v.length}`);

// node type groups
const typeGroups = {};
for (const n of fileNodes) {
  (typeGroups[n.type] || (typeGroups[n.type] = [])).push(n.id);
}
console.log('node type groups:');
for (const [k,v] of Object.entries(typeGroups)) console.log(`  ${k}: ${v.length}`);

// ---------- Layer assignment ----------
const layers = {}; // id -> {name, description, nodeIds[]}

function add(layerId, name, desc, id) {
  if (!layers[layerId]) layers[layerId] = { id: layerId, name, description: desc, nodeIds: [] };
  layers[layerId].nodeIds.push(id);
}

for (const n of fileNodes) {
  const p = n.filePath || n.id.replace(/^[^:]+:/,'');
  const type = n.type;
  const lang = n.language;
  const tags = n.tags || [];
  const lower = p.toLowerCase();

  if (p.startsWith('src/net/jalmus/') && type === 'file') {
    add('layer:application','Application Layer','Java source code of the Jalmus music notation trainer (net.jalmus package).', n.id);
  } else if (p.startsWith('lessons/')) {
    add('layer:lessons','Lesson Content','XML lesson definitions for note, rhythm and score reading exercises.', n.id);
  } else if (p.startsWith('.superpowers/')) {
    add('layer:tooling','Tooling','Opencode/superpowers runtime artifacts (not project source).', n.id);
  } else if (p === '.understand-anything/.understandignore') {
    add('layer:config','Configuration','Project analysis configuration (.understandignore).', n.id);
  } else if (lang === 'xml' || lower.endsWith('.xml') || p === 'build.xml' || p === 'manifest.mf' || p === '.classpath' || p === '.project' || lower.endsWith('.properties') || p === 'settings.properties' || p.startsWith('nbproject/') || p.startsWith('install_files/') || p === 'compile_Izpack.sh' || p === 'installjalmus.xml') {
    add('layer:config','Configuration','Build scripts, IDE/project configuration, installer metadata and properties.', n.id);
  } else if (type === 'document' || lang === 'markdown' || lang === 'txt' || lang === 'html' || p === 'Changelog.txt' || p.startsWith('docs/')) {
    add('layer:documentation','Documentation','Release notes, readmes, design specs and markup documentation.', n.id);
  } else if (type === 'service' || type === 'pipeline' || type === 'resource') {
    add('layer:infrastructure','Infrastructure','Service, pipeline and infrastructure resource definitions.', n.id);
  } else {
    add('layer:config','Configuration','Remaining project configuration / support files.', n.id);
  }
}

// build array
const layersArr = Object.values(layers).map(l => ({...l, nodeIds: l.nodeIds.sort()}));
// sort layers by id for determinism
layersArr.sort((a,b)=>a.id.localeCompare(b.id));

let totalAssigned = 0;
for (const l of layersArr) totalAssigned += l.nodeIds.length;
console.log('\nLayers:', layersArr.length, '| total assigned:', totalAssigned, '| file nodes:', fileNodes.length);
for (const l of layersArr) console.log(`  ${l.id}: ${l.nodeIds.length} files`);

if (totalAssigned !== fileNodes.length) {
  console.error('MISMATCH! assigned != file nodes');
  process.exit(1);
}

// verify no dangling refs
const nodeIds = new Set(graph.nodes.map(n=>n.id));
for (const l of layersArr) {
  for (const id of l.nodeIds) {
    if (!nodeIds.has(id)) { console.error('dangling:', id); process.exit(1); }
  }
}

writeFileSync(join(PROJECT_ROOT, '.understand-anything/intermediate/layers.json'), JSON.stringify(layersArr, null, 2));
console.log('written layers.json');
