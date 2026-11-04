# Keyboard-to-Piano Key Mapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users press computer keys to play the on-screen piano keys during the note-reading game, with a home-row ergonomic mapping, sound, visual button highlight, and right/wrong answer feedback.

**Architecture:** Extend the existing `KeyListener` in `Jalmus.java` (already wired via `addKeyListener(this)`). Map character keys to note names (for answer checking, reusing the existing `ncourante.getNom()` comparison) and to canonical MIDI pitches (for sound + highlight). Reuse `Key.on()`/`off()`, which already plays sound and sets `noteState=ON` — and `Piano.paint` already renders `isNoteOn()` keys in blue, so no new painting code is needed. Add one small helper `Piano.getKeyByPitch(int)` to locate the `Key` object to play/highlight.

**Tech Stack:** Java (JDK 1.4.2+ per project header), Swing/AWT, Ant build (`build.xml`), no test framework.

## Global Constraints

- JDK source/target compatibility must remain as-is (do not introduce modern Java APIs).
- Build via Ant (`ant` / `build.xml` + `nbproject/build-impl.xml`). No Maven/Gradle.
- No new test framework (YAGNI — none exists). Verify by compiling and manual play.
- Mapping is language-independent: remove the `language=="fr"` Q-vs-A branch.
- Scope: note-reading game only. Rhythm/score reading untouched.
- Only `src/net/jalmus/Jalmus.java` and `src/net/jalmus/Piano.java` may be modified. No new files.

---

### Task 1: Add `Piano.getKeyByPitch(int)` helper

**Files:**
- Modify: `src/net/jalmus/Piano.java`

**Interfaces:**
- Consumes: none new
- Produces: `public net.jalmus.Key getKeyByPitch(int pitch)` — scans `whiteKeys` then `blackKeys`, returns the `Key` whose `kNum == pitch`, or `null`.

- [ ] **Step 1: Write the helper method**

```java
  /**
   * Return the piano Key whose MIDI pitch (kNum) matches pitch, or null.
   * Used to play/highlight a specific key from keyboard input.
   */
  public net.jalmus.Key getKeyByPitch(int pitch) {
    for (int i = 0; i < whiteKeys.size(); i++) {
      net.jalmus.Key key = (net.jalmus.Key) whiteKeys.get(i);
      if (key.kNum == pitch) return key;
    }
    for (int i = 0; i < blackKeys.size(); i++) {
      net.jalmus.Key key = (net.jalmus.Key) blackKeys.get(i);
      if (key.kNum == pitch) return key;
    }
    return null;
  }
```

Insert after `Getprevkey()` (around line 104), before `getKey(Point)`.

- [ ] **Step 2: Compile to verify**

Run: `ant` (or `javac` per `build.xml`)  
Expected: BUILD SUCCESSFUL / compiles with no errors. `getKeyByPitch` is unused so far — that's fine.

- [ ] **Step 3: Commit**

```bash
git add src/net/jalmus/Piano.java
git commit -m "feat(piano): add getKeyByPitch helper for keyboard input"
```

---

### Task 2: Add key→note mapping constants and fields in Jalmus

**Files:**
- Modify: `src/net/jalmus/Jalmus.java`

**Interfaces:**
- Consumes: `DO`, `RE`, `MI`, `FA`, `SOL`, `LA`, `SI` localized strings (set in `updateLang()` around line 4182)
- Produces: two static maps and one field:
  - `static Map<Character,String> NOTE_BY_KEY` — char → note name (for answer check)
  - `static Map<Character,Integer> PITCH_BY_KEY` — char → canonical MIDI pitch (for sound/highlight)
  - `net.jalmus.Key keyboardSoundingKey` — the key currently sounding from keyboard (to stop on release)

**Home-row mapping (naturals):**
| char | note | canonical MIDI pitch |
|------|------|----------------------|
| a | DO | 60 |
| s | RE | 62 |
| d | MI | 64 |
| f | FA | 65 |
| g | SOL | 67 |
| h | LA | 69 |
| j | SI | 71 |
| k | DO (octave+1) | 72 |

**Accidentals:**
| char | note | canonical MIDI pitch |
|------|------|----------------------|
| w | DO# | 61 |
| e | RE# | 63 |
| t | FA# | 66 |
| y | SOL# | 68 |
| u | LA# | 70 |

- [ ] **Step 1: Add imports and field declarations**

Add `import java.util.HashMap;` and `import java.util.Map;` near the other `java.util.*` imports.

Add field declarations near the other main variables (after `private int noteDuration = 2000;` area):

```java
    // Keyboard-to-piano mapping (home row, language independent)
    private static final Map<Character,String> NOTE_BY_KEY = new HashMap<Character,String>();
    private static final Map<Character,Integer> PITCH_BY_KEY = new HashMap<Character,Integer>();
    static {
        // naturals
        NOTE_BY_KEY.put('a', DO);     PITCH_BY_KEY.put('a', 60);
        NOTE_BY_KEY.put('s', RE);     PITCH_BY_KEY.put('s', 62);
        NOTE_BY_KEY.put('d', MI);     PITCH_BY_KEY.put('d', 64);
        NOTE_BY_KEY.put('f', FA);     PITCH_BY_KEY.put('f', 65);
        NOTE_BY_KEY.put('g', SOL);    PITCH_BY_KEY.put('g', 67);
        NOTE_BY_KEY.put('h', LA);     PITCH_BY_KEY.put('h', 69);
        NOTE_BY_KEY.put('j', SI);     PITCH_BY_KEY.put('j', 71);
        NOTE_BY_KEY.put('k', DO);     PITCH_BY_KEY.put('k', 72); // DO2, same name as DO
        // accidentals
        NOTE_BY_KEY.put('w', DO+"#"); PITCH_BY_KEY.put('w', 61);
        NOTE_BY_KEY.put('e', RE+"#"); PITCH_BY_KEY.put('e', 63);
        NOTE_BY_KEY.put('t', FA+"#"); PITCH_BY_KEY.put('t', 66);
        NOTE_BY_KEY.put('y', SOL+"#");PITCH_BY_KEY.put('y', 68);
        NOTE_BY_KEY.put('u', LA+"#"); PITCH_BY_KEY.put('u', 70);
    }
    private net.jalmus.Key keyboardSoundingKey = null;
```

Note: `DO`...`SI` are instance Strings initialized in `updateLang()`, so the static initializer above cannot reference them at class-load time (they're null then). **Fix:** populate the maps lazily on first use, or in `updateLang()` after the strings are set.

Revised approach: keep the maps empty-static, and add a private method `ensureKeyboardMapsPopulated()` called at the start of `keyTyped`, which fills them if empty using the (by then) initialized `DO`..`SI`.

- [ ] **Step 2: Add lazy population method**

```java
    private void ensureKeyboardMaps() {
        if (!NOTE_BY_KEY.isEmpty()) return;
        NOTE_BY_KEY.put('a', DO);     PITCH_BY_KEY.put('a', 60);
        NOTE_BY_KEY.put('s', RE);     PITCH_BY_KEY.put('s', 62);
        NOTE_BY_KEY.put('d', MI);     PITCH_BY_KEY.put('d', 64);
        NOTE_BY_KEY.put('f', FA);     PITCH_BY_KEY.put('f', 65);
        NOTE_BY_KEY.put('g', SOL);    PITCH_BY_KEY.put('g', 67);
        NOTE_BY_KEY.put('h', LA);     PITCH_BY_KEY.put('h', 69);
        NOTE_BY_KEY.put('j', SI);     PITCH_BY_KEY.put('j', 71);
        NOTE_BY_KEY.put('k', DO);     PITCH_BY_KEY.put('k', 72);
        NOTE_BY_KEY.put('w', DO+"#"); PITCH_BY_KEY.put('w', 61);
        NOTE_BY_KEY.put('e', RE+"#"); PITCH_BY_KEY.put('e', 63);
        NOTE_BY_KEY.put('t', FA+"#"); PITCH_BY_KEY.put('t', 66);
        NOTE_BY_KEY.put('y', SOL+"#");PITCH_BY_KEY.put('y', 68);
        NOTE_BY_KEY.put('u', LA+"#"); PITCH_BY_KEY.put('u', 70);
    }
```

- [ ] **Step 3: Compile to verify**

Run: `ant`  
Expected: compiles. Maps not yet used — OK.

- [ ] **Step 4: Commit**

```bash
git add src/net/jalmus/Jalmus.java
git commit -m "feat(jalmus): add keyboard-to-note mapping fields"
```

---

### Task 3: Play sound + highlight on mapped key press (keyTyped)

**Files:**
- Modify: `src/net/jalmus/Jalmus.java` (`keyTyped`, around line 2565)

**Interfaces:**
- Consumes: `NOTE_BY_KEY`, `PITCH_BY_KEY`, `ensureKeyboardMaps()`, `currentChannel`, `soundOnCheckBox`, `midierror`, `piano`, `ncourante`, `parti`, `paused`, `selectedGame`
- Produces: on a mapped note key press, calls `key.on()` (sound + blue highlight) and tracks `keyboardSoundingKey`.

- [ ] **Step 1: Replace the language-dependent Q-vs-A note block**

Replace the existing answer-check block (lines 2590-2619) with a map-driven version that also plays sound/highlight:

```java
        if (selectedGame==NOTEREADING && parti && !paused && noteLevel.isNotesgame()) {
            ensureKeyboardMaps();
            char ch = evt.getKeyChar();
            String note = NOTE_BY_KEY.get(Character.valueOf(ch));
            if (note != null) {
                // play the pressed piano key (sound + blue highlight)
                Integer pitch = PITCH_BY_KEY.get(Character.valueOf(ch));
                if (pitch != null && piano != null && currentChannel != null) {
                    net.jalmus.Key key = piano.getKeyByPitch(pitch);
                    if (key != null) {
                        if (keyboardSoundingKey != null) {
                            keyboardSoundingKey.off(currentChannel, soundOnCheckBox.isSelected() && !midierror);
                        }
                        key.on(currentChannel, soundOnCheckBox.isSelected() && !midierror);
                        keyboardSoundingKey = key;
                        // repaint so the blue highlight shows
                        if (panelanim != null) panelanim.repaint();
                    }
                }
                // answer check by note name (existing semantics, language independent)
                if (note.equals(ncourante.getNom())) {
                    rightAnswer();
                } else {
                    wrongAnswer();
                }
            }
        }
```

This removes the `if (ch=='Q'||...)` chain and the `language=="fr"` branch, replacing them with the map lookup.

- [ ] **Step 2: Compile to verify**

Run: `ant`  
Expected: compiles. `NOTE_BY_KEY.get(Character.valueOf(ch))` — `Map.get(Object)` accepts the boxed Character; fine. Alternatively use `NOTE_BY_KEY.get(ch)` (autoboxing). Use `NOTE_BY_KEY.get(ch)` for clarity.

- [ ] **Step 3: Manual verification — sound + highlight**

Run Jalmus (`ant run` or launch Jalmus.java). Start a note-reading game. Press A/S/D/F/G/H/J/K. Expected: corresponding piano button turns blue and sounds; pressing the note shown on staff → "right answer" (new note appears); wrong note → "wrong answer". Press W/E/T/Y/U → accidental sounds. Click window to focus first (key events need focus).

- [ ] **Step 4: Commit**

```bash
git add src/net/jalmus/Jalmus.java
git commit -m "feat(jalmus): play sound & highlight on keyboard note press"
```

---

### Task 4: Stop sounding key on release (keyReleased)

**Files:**
- Modify: `src/net/jalmus/Jalmus.java` (`keyReleased`, around line 2652)

**Interfaces:**
- Consumes: `keyboardSoundingKey`, `currentChannel`, `soundOnCheckBox`, `midierror`, `panelanim`
- Produces: releases the currently sounding keyboard key so the note stops and blue highlight clears.

- [ ] **Step 1: Implement keyReleased release logic**

```java
    public void keyReleased(KeyEvent evt) {
        // empty method, required by the KeyListener Interface
        ensureKeyboardMaps();
        char ch = evt.getKeyChar();
        if (NOTE_BY_KEY.containsKey(Character.valueOf(ch))) {
            if (keyboardSoundingKey != null && currentChannel != null) {
                keyboardSoundingKey.off(currentChannel, soundOnCheckBox.isSelected() && !midierror);
                keyboardSoundingKey = null;
                if (panelanim != null) panelanim.repaint();
            }
        }
    }
```

Use `NOTE_BY_KEY.containsKey(ch)` (autoboxing) — simpler.

- [ ] **Step 2: Compile to verify**

Run: `ant`  
Expected: compiles.

- [ ] **Step 3: Manual verification — release stops sound**

Run Jalmus, start note-reading game. Press and hold A → note sounds + blue highlight. Release A → sound stops, highlight clears. Press multiple in sequence → each stops when released.

- [ ] **Step 4: Commit**

```bash
git add src/net/jalmus/Jalmus.java
git commit -m "feat(jalmus): stop keyboard note on key release"
```

---

### Task 5: Guard against key repeat and clean up

**Files:**
- Modify: `src/net/jalmus/Jalmus.java` (`keyTyped`)

**Interfaces:**
- Consumes: `keyboardSoundingKey`
- Produces: answer-check only triggers on a new key (not OS repeat), avoiding rapid-fire newnote when holding a key.

- [ ] **Step 1: Add repeat suppression**

In `keyTyped`, track the last processed char in a field `private char lastKeyboardKey = 0;`. Only run the answer-check block when `ch != lastKeyboardKey`; update `lastKeyboardKey = ch` at the end. Sound still plays on every typed event (acceptable), but answer advances only once per key.

- [ ] **Step 2: Compile + full manual verification**

Run: `ant` → compiles.  
Manual: full play-through of a note-reading game using only the keyboard (no mouse on piano). Verify naturals, accidentals, right/wrong, highlight on/off, pause (P key still works), and that mouse piano clicking still works unchanged.

- [ ] **Step 3: Commit**

```bash
git add src/net/jalmus/Jalmus.java
git commit -m "feat(jalmus): suppress key-repeat answer triggers"
```

---

### Task 6: Final review and commit

**Files:**
- Modify: none (review only)

- [ ] **Step 1: Review diff against spec**

Run: `git log --oneline -6` and `git diff HEAD~6..HEAD --stat`  
Confirm: only `Jalmus.java` and `Piano.java` changed; no new files; rhythm/score reading untouched; maps are language-independent; `key.on()`/`off()` reused for sound+highlight.

- [ ] **Step 2: Final compile**

Run: `ant`  
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit (if any cleanup) / done**

```bash
git add -A
git commit -m "chore: finalize keyboard piano mapping feature"
```

---

## Verification Checklist (manual)

1. Window focused → start note-reading game.
2. Press A, S, D, F, G, H, J, K → each piano key sounds + turns blue.
3. Press W, E, T, Y, U → accidentals sound + turn blue.
4. Press the note shown on the staff → "right answer", next note appears.
5. Press a different note → "wrong answer".
6. Release a key → sound stops, blue clears.
7. Press P → pause; keys ignored while paused.
8. Click piano buttons with mouse → still works unchanged.
9. Unmapped key (e.g. X, Z) → nothing happens.

## Spec Coverage

- Home-row ergonomic mapping → Tasks 2–3 (A/S/D/F/G/H/J/K).
- Accidentals → Task 2 (W/E/T/Y/U).
- Sound + visual highlight → `key.on()` (already renders blue via `isNoteOn()`), Task 3.
- Right/wrong answer → `rightAnswer()`/`wrongAnswer()` by note name, Task 3.
- Language-independent (no Q/A branch) → Task 3 removes it.
- Note-reading game only → gated by `selectedGame==NOTEREADING`, Task 3.
- Unmapped keys ignored → `NOTE_BY_KEY.get(ch)` null check, Task 3.
- Game not started/paused ignored → existing `parti`/`paused` guards, Task 3.

---

Plan complete and saved to `docs/superpowers/plans/2026-11-04-keyboard-piano-mapping.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration (uses `superpowers:subagent-driven-development`).
2. **Inline Execution** — I execute tasks in this session using `executing-plans`, batch execution with checkpoints for review.

Which approach would you like?