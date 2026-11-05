#!/usr/bin/env node
/**
 * Phase 2 generator: convert extract-structure results into batch-<i>.json
 * (nodes + edges) files for merge-batch-graphs.py.
 */
import { createRequire } from 'node:module';
import { resolve, join, dirname, basename, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';

const PROJECT_ROOT = resolve(process.argv[2] || process.cwd());
const PLUGIN_ROOT = '/Users/xuyi/.understand-anything-plugin';

const require = createRequire(resolve(PLUGIN_ROOT, 'package.json'));
let core;
try {
  core = await import(pathToFileURL(require.resolve('@understand-anything/core')).href);
} catch {
  core = await import(pathToFileURL(resolve(PLUGIN_ROOT, 'packages/core/dist/index.js')).href);
}
const { TreeSitterPlugin, PluginRegistry, builtinLanguageConfigs, registerAllParsers } = core;

const tsConfigs = builtinLanguageConfigs.filter(c => c.treeSitter);
const tsPlugin = new TreeSitterPlugin(tsConfigs);
await tsPlugin.init();
const registry = new PluginRegistry();
registry.register(tsPlugin);
registerAllParsers(registry);

// ---------------------------------------------------------------------------
// Manual summaries for key classes (grounded in actual class role)
// ---------------------------------------------------------------------------
const SUMMARY_MAP = {
  Jalmus: 'Main application window and controller of the Jalmus music notation trainer; owns the game loop, menus, preferences, MIDI and note/rhythm/score reading exercises.',
  Note: 'Represents a single musical note (pitch, octave, alteration) used across note-reading and score-reading exercises.',
  Score: 'Represents a musical score with measures, staves and notes; model for the score-reading exercise.',
  Lessons: 'Loads and parses lesson XML files (SAX DefaultHandler) for note, rhythm and score reading lessons.',
  Level: 'Interface defining a lesson/exercise level (note reading, rhythm reading, score reading).',
  NoteLevel: 'Note-reading exercise level implementation.',
  ScoreLevel: 'Score-reading exercise level implementation.',
  RhythmLevel: 'Rhythm-reading exercise level implementation.',
  Piano: 'On-screen piano keyboard widget used to play and enter notes.',
  Chord: 'Represents a musical chord (root, type, inversion).',
  Interval: 'Represents a musical interval between two notes.',
  Tonality: 'Represents a musical key / tonality (tonic + mode).',
  Rhythm: 'Represents a rhythmic pattern with note durations and time signature.',
  Localizable: 'Localization interface plus inner UI element types (Button, Dialog, Tab) for translated menus.',
  FileTools: 'File-system utilities for reading/writing lessons, preferences and resources.',
  MidiCommon: 'Shared MIDI device, sequencer and message utilities.',
  Key: 'A key on the piano keyboard (extends java.awt.Rectangle).',
  Alteration: 'Musical accidental (sharp, flat, natural) applied to a note.',
  ChannelData: 'MIDI channel data (instrument, volume, pan) for playback.',
  ChooseNotePanel: 'Panel for choosing a note in exercises.',
  Key: 'Keyboard key visual representation.',
};

function nodeTypeFor(path, language, fileCategory) {
  if (path.startsWith('lessons/') && (language === 'xml' || extname(path) === '.xml')) return 'document';
  if (fileCategory === 'code' || fileCategory === 'script') return 'file';
  if (fileCategory === 'config') return 'config';
  if (fileCategory === 'docs' || fileCategory === 'markup') return 'document';
  if (fileCategory === 'data') return 'file';
  if (language === 'java') return 'file';
  if (language === 'xml' || language === 'properties' || path.endsWith('.xml') || path.endsWith('.properties')) return 'config';
  if (language === 'markdown' || language === 'txt' || path.endsWith('.md') || path.endsWith('.txt')) return 'document';
  if (language === 'html') return 'document';
  if (language === 'shell') return 'file';
  if (language === 'shell') return 'file';
  return 'file';
}

function summaryFor(path, language, type, analysis) {
  const base = basename(path, extname(path));
  if (SUMMARY_MAP[base]) return SUMMARY_MAP[base];
  if (type === 'class') {
    const nMethods = (analysis?.classes || []).find(c => c.name === base)?.methods?.length || 0;
    return `\`${base}\` — Jalmus component with ${nMethods} method${nMethods !== 1 ? 's' : ''}.`;
  }
  if (type === 'file' && language === 'java') {
    return `Java source file \`${base}.java\` in the net.jalmus package.`;
  }
  if (type === 'config') return `Configuration file \`${base}\`.`;
  if (type === 'document') return `Documentation / content file \`${base}\`.`;
  return `Source file \`${base}\`.`;
}

function tagsFor(path, language, type, analysis) {
  const tags = [];
  if (language === 'java') tags.push('java', 'source');
  else if (language === 'xml') tags.push('xml');
  else if (language === 'properties') tags.push('properties');
  else if (language === 'markdown') tags.push('documentation');
  else if (language === 'shell') tags.push('script');
  if (type === 'class') tags.push('class');
  if (type === 'function') tags.push('function', 'method');
  if (type === 'config') tags.push('config');
  if (type === 'document') tags.push('documentation');
  if (path.startsWith('lessons/')) tags.push('lesson');
  if (path === 'src/net/jalmus/Jalmus.java') tags.push('entry-point', 'main');
  if (path.startsWith('src/net/jalmus/')) tags.push('net.jalmus');
  // dedupe
  return [...new Set(tags)];
}

function complexityFor(analysis, nFuncs, nClasses) {
  if (!analysis) return 'simple';
  let score = 0;
  if (analysis.functions) score += analysis.functions.length;
  if (analysis.classes) score += analysis.classes.length * 2;
  if (analysis.imports) score += analysis.imports.length;
  if (score <= 4) return 'simple';
  if (score <= 18) return 'moderate';
  return 'complex';
}

const batches = JSON.parse(readFileSync(join(PROJECT_ROOT, '.understand-anything/intermediate/batches.json'), 'utf8')).batches;

// index of all java file paths for import resolution
const allJavaFiles = new Set();
for (const b of batches) {
  for (const f of b.files) {
    if (f.language === 'java') allJavaFiles.add(f.path);
  }
}

function resolveInternalImport(source) {
  // source like "net.jalmus.Note" -> src/net/jalmus/Note.java
  const p = 'src/' + source.replace(/\./g, '/') + '.java';
  if (allJavaFiles.has(p)) return p;
  return null;
}

let totalNodes = 0, totalEdges = 0;

for (const batch of batches) {
  const batchIndex = batch.batchIndex;
  const nodes = [];
  const edges = [];
  const fileFuncs = new Map(); // path -> Set of function names (for calls matching)

  // first pass: collect functions per file
  const fileAnalysis = new Map();
  for (const file of batch.files) {
    const absPath = join(PROJECT_ROOT, file.path);
    let content;
    try { content = readFileSync(absPath, 'utf-8'); } catch { continue; }
    let analysis = null;
    try { analysis = registry.analyzeFile(file.path, content); } catch {}
    fileAnalysis.set(file.path, { file, content, analysis });
    const funcs = new Set();
    if (analysis && analysis.functions) {
      for (const fn of analysis.functions) funcs.add(fn.name);
    }
    fileFuncs.set(file.path, funcs);
  }

  // second pass: build nodes + edges
  for (const [path, { file, content, analysis }] of fileAnalysis) {
    const type = nodeTypeFor(path, file.language, file.fileCategory);
    const fileId = `file:${path}`;
    const fileNode = {
      id: fileId,
      type,
      name: basename(path),
      summary: summaryFor(path, file.language, type, analysis),
      tags: tagsFor(path, file.language, type, analysis),
      complexity: complexityFor(analysis,
        analysis ? analysis.functions.length : 0,
        analysis ? analysis.classes.length : 0),
      filePath: path,
      language: file.language,
    };
    nodes.push(fileNode);

    if (analysis) {
      // class nodes
      if (analysis.classes) {
        for (const cls of analysis.classes) {
          const clsId = `class:${path}:${cls.name}`;
          nodes.push({
            id: clsId,
            type: 'class',
            name: cls.name,
            summary: summaryFor(path, file.language, 'class', analysis),
            tags: tagsFor(path, file.language, 'class', analysis),
            complexity: 'moderate',
            filePath: path,
            language: file.language,
          });
          edges.push({ source: fileId, target: clsId, type: 'contains', weight: 1.0, direction: 'forward' });
        }
      }
      // function nodes (top-level functions / methods listed in functions array)
      if (analysis.functions) {
        for (const fn of analysis.functions) {
          const fnId = `function:${path}:${fn.name}`;
          nodes.push({
            id: fnId,
            type: 'function',
            name: fn.name,
            summary: `Function \`${fn.name}\` in \`${basename(path)}\`.`,
            tags: tagsFor(path, file.language, 'function', analysis),
            complexity: 'simple',
            filePath: path,
            language: file.language,
          });
          edges.push({ source: fileId, target: fnId, type: 'contains', weight: 1.0, direction: 'forward' });
        }
      }
      // imports edges (internal only)
      if (analysis.imports) {
        for (const imp of analysis.imports) {
          const tgt = resolveInternalImport(imp.source);
          if (tgt) {
            edges.push({ source: fileId, target: `file:${tgt}`, type: 'imports', weight: 0.7, direction: 'forward' });
          }
        }
      }
    }

    // calls edges (intra-file, where callee matches a known function)
    let callGraph = null;
    if ((file.fileCategory === 'code' || file.fileCategory === 'script') && analysis) {
      try {
        const cg = registry.extractCallGraph(file.path, content);
        if (cg) callGraph = cg;
      } catch {}
    }
    const knownFuncs = fileFuncs.get(path) || new Set();
    if (callGraph) {
      for (const entry of callGraph) {
        const caller = entry.caller;
        const calleeRaw = entry.callee;
        const callee = calleeRaw.split('.').pop();
        if (!knownFuncs.has(caller) || !knownFuncs.has(callee)) continue;
        if (caller === callee) continue;
        const cId = `function:${path}:${caller}`;
        const tId = `function:${path}:${callee}`;
        edges.push({ source: cId, target: tId, type: 'calls', weight: 0.8, direction: 'forward' });
      }
    }
  }

  const out = { nodes, edges };
  writeFileSync(join(PROJECT_ROOT, '.understand-anything/intermediate', `batch-${batchIndex}.json`), JSON.stringify(out, null, 2));
  totalNodes += nodes.length;
  totalEdges += edges.length;
  console.log(`batch-${batchIndex}: ${nodes.length} nodes, ${edges.length} edges`);
}

console.log(`\nTOTAL: ${totalNodes} nodes, ${totalEdges} edges across ${batches.length} batches`);
