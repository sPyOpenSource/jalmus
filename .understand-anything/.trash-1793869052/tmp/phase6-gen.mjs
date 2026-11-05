#!/usr/bin/env node
/**
 * Phase 6: assemble full KnowledgeGraph, validate layers/tour, write
 * to intermediate/assembled-graph.json, then run inline validator.
 */
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const PROJECT_ROOT = resolve(process.argv[2] || process.cwd());
const INTER = join(PROJECT_ROOT, '.understand-anything/intermediate');

const graph = JSON.parse(readFileSync(join(INTER, 'assembled-graph.json'), 'utf8'));
const layers = JSON.parse(readFileSync(join(INTER, 'layers.json'), 'utf8'));
const tour = JSON.parse(readFileSync(join(INTER, 'tour.json'), 'utf8'));

const nodeIds = new Set(graph.nodes.map(n => n.id));
const issues = [];
const warnings = [];

// ---- Validate layers ----
if (!Array.isArray(layers)) { issues.push('layers is not an array'); layers = []; }
const layerIdSet = new Set();
layers.forEach((layer, i) => {
  for (const f of ['id','name','description','nodeIds']) {
    if (!(f in layer)) issues.push(`Layer[${i}] missing field '${f}'`);
  }
  if (layer.id && layerIdSet.has(layer.id)) issues.push(`Duplicate layer id '${layer.id}'`);
  layerIdSet.add(layer.id);
  if (Array.isArray(layer.nodeIds)) {
    layer.nodeIds.forEach(id => {
      if (!nodeIds.has(id)) issues.push(`Layer '${layer.id}' refs missing node '${id}'`);
    });
  }
});

// every file-level node in exactly one layer
const FILE_TYPES = new Set(['file','config','document','service','pipeline','table','schema','resource','endpoint']);
const fileNodes = graph.nodes.filter(n => FILE_TYPES.has(n.type));
const assigned = new Map();
layers.forEach(layer => {
  (layer.nodeIds || []).forEach(id => {
    if (assigned.has(id)) issues.push(`Node '${id}' appears in multiple layers`);
    assigned.set(id, layer.id);
  });
});
fileNodes.forEach(n => {
  if (!assigned.has(n.id)) issues.push(`File node '${n.id}' not in any layer`);
});

// ---- Validate tour ----
if (!Array.isArray(tour)) { issues.push('tour is not an array'); tour = []; }
tour.forEach((step, i) => {
  for (const f of ['order','title','description','nodeIds']) {
    if (!(f in step)) issues.push(`Tour step[${i}] missing field '${f}'`);
  }
  (step.nodeIds || []).forEach(id => {
    if (!nodeIds.has(id)) issues.push(`Tour step[${i}] refs missing node '${id}'`);
  });
});
tour.sort((a,b)=>(a.order||0)-(b.order||0));

// ---- Build full KnowledgeGraph ----
const pkgName = 'jalmus';
const pkgDesc = 'Jalmus is a music notation learning application that trains note reading, rhythm reading, and score reading. Version 2.3, internationalized into 13 languages. Built with Java and Ant.';
const languages = ['java','xml','properties','markdown','shell','txt','gm','mf','prefs','html'];
const fullGraph = {
  version: '1.0.0',
  project: {
    name: pkgName,
    languages,
    frameworks: [],
    description: pkgDesc,
    analyzedAt: new Date().toISOString(),
    gitCommitHash: '7ea4a7bf44ac2eefb75a77aeed2fbbc1d982b2b5'
  },
  nodes: graph.nodes,
  edges: graph.edges,
  layers,
  tour
};

// normalize: ensure required node fields present
graph.nodes.forEach((n, idx) => {
  if (!n.summary) { n.summary = 'No summary available'; issues.push(`Node[${idx}] '${n.id}' missing summary (filled default)`); }
  if (!n.tags || !n.tags.length) { n.tags = ['untagged']; issues.push(`Node[${idx}] '${n.id}' missing tags (filled default)`); }
  if (!n.name) n.name = n.id;
});

writeFileSync(join(INTER, 'assembled-graph.json'), JSON.stringify(fullGraph, null, 2));
console.log('Wrote full KnowledgeGraph to assembled-graph.json');

// ---- Run inline validator ----
const validator = join(INTER, '..', 'tmp', 'ua-inline-validate.cjs');
// (write validator via shell separately); here we just invoke it after writing the file
const outPath = join(INTER, 'review.json');
try {
  execSync(`node "${join(PROJECT_ROOT,'.understand-anything','tmp','ua-inline-validate.cjs')}" "${join(INTER,'assembled-graph.json')}" "${outPath}"`, {stdio:'inherit'});
} catch (e) {
  console.error('Validator exited non-zero:', e.message);
}
console.log('review written to', outPath);
