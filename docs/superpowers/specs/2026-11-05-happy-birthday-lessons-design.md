# Happy Birthday Note-Reading Lessons — Design Spec

**Project:** Jalmus (Java Swing music-education app)  
**Date:** 2026-11-05  
**Topic:** Add "Happy Birthday" note-reading lessons in C major for treble and bass clefs  
**Status:** Approved design

## 1. Purpose & Success Criteria

**Purpose:** Add a familiar, beginner-friendly song ("Happy Birthday") as note-reading lessons so new users have a recognizable melody to practice. This improves onboarding by giving learners an immediately gratifying song instead of abstract note sequences.

**Success criteria:**
- Two lesson files exist in `lessons/en/01. Basic/`: "Happy Birthday (Treble).xml" and "Happy Birthday (Bass).xml".
- Both files parse as valid XML under Jalmus's `<levels>`/`<notereading>` schema.
- Both files appear in the Jalmus Lessons menu under "01. Basic".
- Each lesson progresses from learning a small note subset → practicing without help → playing the full Happy Birthday melody.
- Notes used are limited to the C major scale naturals (C D E F G A B) — no accidentals.
- Works identically in treble and bass clef versions.

## 2. Scope (in / out)

**In scope:**
- Two XML lesson files, English only, note-reading game type, C major key.
- Treble clef version and bass clef version.
- 8 levels per file (4 learning/4 normal) progressing from 3-note subsets to the full 7-note melody.

**Out of scope (YAGNI):**
- Translations into other languages (de, fr, es, etc.).
- Score-reading or rhythm-reading versions.
- Audio/MIDI playback of the full melody (Jalmus plays individual notes on key press).
- New lesson types or schema changes.
- Modifications to existing lessons.

## 3. Architecture

No code changes. This is purely data — new XML lesson files under `lessons/en/01. Basic/`, conforming to Jalmus's existing lesson schema:

```
<levels>
  <notereading id='N'>
    <message>…</message>
    <game>learning|normal|inline</game>
    <learningduration>…</learningduration>   (learning only)
    <clef>treble|bass</clef>
    <notes>notes</notes>
    <nbnotes>N</nbnotes>
    <speed>…</speed>
    <startingnote>…</startingnote>             (optional)
  </notereading>
</levels>
```

Jalmus's `Lessons` class reads these files and builds the lesson menu. Each `<notereading>` block is one lesson level. No source code, build, or preferences changes required.

## 4. Components

### 4.1 File 1: `lessons/en/01. Basic/Happy Birthday (Treble).xml`
Clef: treble. Notes: C D E F G A B (C major).

### 4.2 File 2: `lessons/en/01. Basic/Happy Birthday (Bass).xml`
Clef: bass. Same notes, same level structure, different clef.

### 4.3 Level Progression (identical structure for both clefs)

| id | Game | Notes | nbnotes | Purpose |
|---|---|---|---|---|
| 0 | learning | C D E | 3 | Learn first three notes |
| 1 | normal | C D E | 3 | Practice C D E without help |
| 2 | learning | F G A | 3 | Learn next three notes |
| 3 | normal | F G A | 3 | Practice F G A without help |
| 4 | learning | B C(high) | 2 | Learn remaining two notes |
| 5 | normal | B C(high) | 2 | Practice B C without help |
| 6 | learning | All 7 | 7 | Full Happy Birthday melody (guided) |
| 7 | normal | All 7 | 7 | Full Happy Birthday melody (solo) |

## 5. Data Flow

No runtime data flow — Jalmus reads the XML at startup and populates the Lessons menu. When a user selects "Happy Birthday (Treble)" or "Happy Birthday (Bass)", Jalmus loads the corresponding `<notereading>` levels sequentially and presents them as a lesson.

## 6. Error Handling

- XML must be well-formed and conform to the `<levels>`/`<notereading>` schema Jalmus expects. Invalid XML will fail to load (existing behavior — no change).
- `clef` value must be `treble` or `bass` (matching existing lesson files).
- `notes` value `notes` means the C major natural note set; `nbnotes` limits how many of those are active per level.

## 7. Testing

Manual verification steps:
1. Build Jalmus (`ant compile` → BUILD SUCCESSFUL).
2. Launch Jalmus, open Lessons menu → "01. Basic".
3. Confirm "Happy Birthday (Treble)" and "Happy Birthday (Bass)" appear in the menu.
4. Select each lesson; verify it loads without errors and the first level shows the correct clef.
5. Play through levels 0→7: learning levels show note help, normal levels don't.
6. Verify both clefs render notes in their respective ranges.
7. Verify no accidentals (sharps/flats) appear — all notes are C-major naturals.

## 8. What's NOT in scope

- Other languages.
- Score-reading / rhythm-reading versions.
- Existing lesson modifications.
- Schema or code changes.

---

*End of spec.*