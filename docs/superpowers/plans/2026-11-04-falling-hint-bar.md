# Falling Hint Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a falling hint bar in note-reading learning mode that drifts from above the musical staff onto the correct piano key over ~1 second, showing the computer key letter, gated behind a preferences-dialog toggle.

**Architecture:** Reuse the existing `RenderingThread` 10ms repaint loop and the `NOTE_BY_KEY`/`PITCH_BY_KEY` maps (already committed from the keyboard-mapping feature). Add hint state to `Jalmus` (active, target pitch, key letter, progress 0→1, enabled flag). Add `Piano.setHint()`/`paintHint()` to draw the bar at the correct key's x-position (positions computed inside `paint()` where they're current). Trigger on new note in `newnote()`; dismiss on correct key press in `keyTyped`. Add a `JCheckBox` to the note-reading tab of the preferences dialog.

**Tech Stack:** Java (JDK 1.4.2+ compatible style — existing code uses generics + autoboxing), Swing/AWT, Ant build (`build.xml` + `nbproject/build-impl.xml`), no test framework.

## Global Constraints

- JDK compatibility as-is (no modern Java APIs beyond what the codebase already uses).
- Build via Ant (`ant compile`). No Maven/Gradle.
- No new test framework (YAGNI — none exists). Verify by compiling + manual playthrough.
- Only two files modified: `src/net/jalmus/Jalmus.java` and `src/net/jalmus/Piano.java`. No new files.
- Hint active only in note-reading + learning mode + hint preference enabled.
- Fall duration ~1 second (~100 ticks at the existing 10ms repaint interval).
- Reuse `NOTE_BY_KEY`/`PITCH_BY_KEY` maps (already committed) for note↔pitch↔letter lookups.
- Bar is solid bright medium (~12px tall) with the key letter drawn on it.
- If a hint is mid-fall when the note changes, the current bar completes before a new one starts.

---

### Task 1: Add hint state fields + getter/setter access to Jalmus

**Files:**
- Modify: `src/net/jalmus/Jalmus.java`

**Interfaces:**
- Consumes: `NOTE_BY_KEY`, `PITCH_BY_KEY` maps (from keyboard feature, already committed)
- Produces: fields `hintActive`, `hintPitch`, `hintLetter`, `hintProgress`, `hintEnabled`; method `updateHint()` (tick) accessed by RenderingThread

- [ ] **Step 1: Add hint state field declarations**

Add after the `keyboardSoundingKey` / `lastKeyboardKey` fields (around line 248-249):

```java
    // Falling hint bar (learning mode, note reading)
    private boolean hintActive = false;
    private int hintPitch = 0;
    private String hintLetter = "";
    private float hintProgress = 0f;   // 0.0 (above staff) to 1.0 (landed on key)
    private boolean hintEnabled = true; // preferences toggle, default on
```

- [ ] **Step 2: Add `updateHint()` tick method**

Add near `keyTyped`/`keyReleased` (around line 2680):

```java
    /**
     * Advance the falling hint bar one tick (~10ms, called from RenderingThread).
     * Progress goes 0.0 -> 1.0 over ~100 ticks (~1 second).
     */
    private void updateHint() {
        if (!hintActive) return;
        hintProgress += 0.01f;
        if (hintProgress > 1.0f) hintProgress = 1.0f;
    }
```

- [ ] **Step 3: Compile to verify**

Run: `ant compile`  
Expected: BUILD SUCCESSFUL. Fields/method unused so far — that's fine.

- [ ] **Step 4: Commit**

```bash
git add src/net/jalmus/Jalmus.java
git commit -m "feat(jalmus): add falling hint state fields"
```

---

### Task 2: Add `setHint()` and `paintHint()` to Piano

**Files:**
- Modify: `src/net/jalmus/Piano.java`

**Interfaces:**
- Consumes: `getKeyByPitch(int)` (from keyboard Task 1, already committed), key x-position math used in `paint()`
- Produces: `public void setHint(int pitch, float progress, String letter)` and `public void paintHint(Graphics g, int width)`

- [ ] **Step 1: Add hint state fields to Piano**

Add near `prevKey` field (line 30):

```java
  net.jalmus.Key hintKey;
  float hintProgress;
  String hintLetter;
```

- [ ] **Step 2: Add `setHint()` method**

Add after `Getprevkey()` (around line 104):

```java
  /**
   * Set the falling hint bar target: which key (pitch), how far it has fallen (0-1),
   * and the key letter to show on the bar.
   */
  public void setHint(int pitch, float progress, String letter) {
    this.hintKey = getKeyByPitch(pitch);
    this.hintProgress = progress;
    this.hintLetter = letter;
  }
```

- [ ] **Step 3: Add `paintHint()` method**

Add `paintHint` after `playNote()` (around line 167). It draws a solid bright medium bar (~12px tall) at the hint key's x-position, y interpolating from above the staff down to the key top based on progress, with the key letter centered:

```java
  /**
   * Paint the falling hint bar over the target piano key.
   *
   * @param g Graphics to paint
   * @param width window width (for offset)
   */
  public void paintHint(Graphics g, int width) {
    if (hintKey == null) return;
    Graphics2D g2 = (Graphics2D) g;
    int offx = (width / 2) - 390;

    // Compute the key's screen x-position, mirroring paint()'s layout math.
    int keyX;
    int keyW;
    boolean isBlack = blackKeys.contains(hintKey);
    if (isBlack) {
      int bi = blackKeys.indexOf(hintKey);
      keyX = marge + offx + hintKey.getXoffset() - 2 + ((bi + 1) * kw);
      keyW = kw / 2;
    } else {
      int wi = whiteKeys.indexOf(hintKey);
      keyX = 2 + marge + offx + (kw * wi);
      keyW = kw - 1;
    }

    // Y interpolates from above the staff down to the key top as progress goes 0->1.
    int staffY = ypos - 120;   // above the staff
    int keyY = ypos;            // top of piano keys
    int barY = (int) (staffY + (keyY - staffY) * hintProgress);

    // Draw solid bright medium bar (~12px tall).
    g2.setColor(new Color(255, 215, 0)); // gold
    g2.fillRect(keyX, barY, keyW, 12);
    g2.setColor(Color.black);
    g2.drawRect(keyX, barY, keyW, 12);

    // Draw the key letter centered on the bar.
    if (hintLetter != null && !hintLetter.isEmpty()) {
      g2.setColor(Color.black);
      g2.drawString(hintLetter, keyX + keyW / 2 - 4, barY + 9);
    }
  }
```

Note: `Vector.indexOf(Object)` works since `Key` objects are compared by identity (no equals override), which is correct here since `hintKey` is the exact same object instance from the vector.

- [ ] **Step 4: Compile to verify**

Run: `ant compile`  
Expected: BUILD SUCCESSFUL. `paintHint` not yet called — fine.

- [ ] **Step 5: Commit**

```bash
git add src/net/jalmus/Piano.java
git commit -m "feat(piano): add setHint and paintHint for falling hint bar"
```

---

### Task 3: Call `piano.setHint()` and `piano.paintHint()` in the render loop

**Files:**
- Modify: `src/net/jalmus/Jalmus.java`

**Interfaces:**
- Consumes: `updateHint()` (Task 1), `piano.setHint()`/`paintHint()` (Task 2), `hintActive`, `hintPitch`, `hintLetter`, `hintProgress`
- Produces: hint ticked each render frame and drawn over the piano

- [ ] **Step 1: Tick the hint in RenderingThread.run()**

In `RenderingThread.run()` (around line 5739, after `panelanim.repaint()`), add hint advancement:

```java
                    panelanim.repaint();
                    if (hintActive) {
                        updateHint();
                        panelanim.repaint();
                    }
```

Placed inside the `while(true)` loop where `panelanim.repaint()` is already called each ~10ms frame.

- [ ] **Step 2: Draw the hint in Anim.paintComponent()**

In `Anim.paintComponent()` (around line 5800), after the `piano.paint(...)` call for notes (around line 5865-5870), add:

```java
                if (hintActive && selectedGame == NOTEREADING && parti && !paused) {
                    piano.setHint(hintPitch, hintProgress, hintLetter);
                    piano.paintHint(g, d.width);
                }
```

Place it right after the note-reading `piano.paint()` block so the bar draws on top of the keys.

- [ ] **Step 3: Compile to verify**

Run: `ant compile`  
Expected: BUILD SUCCESSFUL. Hint not yet triggered (no call to activate it) — fine.

- [ ] **Step 4: Commit**

```bash
git add src/net/jalmus/Jalmus.java
git commit -m "feat(jalmus): tick and draw falling hint in render loop"
```

---

### Task 4: Trigger hint on new note in learning mode

**Files:**
- Modify: `src/net/jalmus/Jalmus.java`

**Interfaces:**
- Consumes: `newnote()` method, `selectedGame`, `noteLevel.isLearninggame()`, `hintEnabled`, `ncourante`, `PITCH_BY_KEY`, `NOTE_BY_KEY`
- Produces: hint activated when a new staff note appears

- [ ] **Step 1: Add hint activation at the start of `newnote()`**

Find `newnote()` method. At its start, add:

```java
        // Falling hint for learning mode (note reading)
        if (selectedGame == NOTEREADING && noteLevel.isLearninggame() && hintEnabled) {
            String nom = ncourante.getNom();
            Integer pitch = null;
            String letter = "";
            // reverse-lookup: find which letter maps to this note's pitch via kNum
            // We need pitch from note name; PITCH_BY_KEY maps letter->pitch, NOTE_BY_KEY maps letter->note name.
            // Scan NOTE_BY_KEY for the entry whose note name matches, then get its pitch.
            for (java.util.Map.Entry<Character, String> e : NOTE_BY_KEY.entrySet()) {
                if (e.getValue().equals(nom)) {
                    pitch = PITCH_BY_KEY.get(e.getKey());
                    letter = String.valueOf(e.getKey()).toUpperCase();
                    break;
                }
            }
            if (pitch != null) {
                hintPitch = pitch;
                hintLetter = letter;
                hintProgress = 0f;
                hintActive = true;
            }
        }
```

This uses `ncourante` (the current target note) which is already set when `newnote()` is called.

- [ ] **Step 2: Compile to verify**

Run: `ant compile`  
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Manual verification — hint appears on new note**

Run Jalmus (`ant run`), open preferences → note-reading tab (confirm hint checkbox present from Task 5 — but for now just start), start a note-reading game in learning mode. When a note appears, confirm a gold bar drifts onto the correct key with the letter.

Note: the preferences checkbox doesn't exist yet (Task 5), so `hintEnabled` defaults to `true` and the hint will show. That's fine for this step's verification; the checkbox wiring comes next.

- [ ] **Step 4: Commit**

```bash
git add src/net/jalmus/Jalmus.java
git commit -m "feat(jalmus): trigger falling hint on new note in learning mode"
```

---

### Task 5: Add hint toggle to preferences dialog (note-reading tab)

**Files:**
- Modify: `src/net/jalmus/Jalmus.java`

**Interfaces:**
- Consumes: `preferencesTabbedPane`, note-reading tab panel, `savePrefs` array (existing pattern)
- Produces: `hintCheckBox` JCheckBox in the note-reading preferences tab, `hintEnabled` read from it

- [ ] **Step 1: Declare `hintCheckBox` field**

Add near the other note-reading preferences fields (around line 413-420, near `noteGameTypeComboBox` etc.):

```java
    private JCheckBox hintCheckBox; // falling key hint toggle, note-reading tab
```

- [ ] **Step 2: Add the checkbox to the note-reading preferences panel**

Find where the note-reading preferences tab is built (the `preferencesTabbedPane` setup). Add a `hintCheckBox` with label "Show falling key hint" alongside the other note-reading controls. Follow the existing `JCheckBox` pattern (e.g. `wholeCheckBox`, `metronomeCheckBox`).

- [ ] **Step 3: Wire `hintEnabled` from the checkbox state**

When building/reading the preferences dialog, set `hintEnabled = hintCheckBox.isSelected()`. Follow the existing pattern of reading checkBox states into the `savePrefs`/settings logic.

- [ ] **Step 4: Compile to verify**

Run: `ant compile`  
Expected: BUILD SUCCESSFUL.

- [ ] **Step 5: Manual verification — toggle works**

Open preferences → note-reading tab → uncheck "Show falling key hint" → start learning-mode note game → no bar appears. Re-check → bar appears.

- [ ] **Step 6: Commit**

```bash
git add src/net/jalmus/Jalmus.java
git commit -m "feat(jalmus): add falling-hint toggle to preferences dialog"
```

---

### Task 6: Dismiss hint on correct key press

**Files:**
- Modify: `src/net/jalmus/Jalmus.java`

**Interfaces:**
- Consumes: `keyTyped()` answer-check block (from keyboard Task 3, already committed), `hintActive`
- Produces: `hintActive = false` when the user presses the matching key

- [ ] **Step 1: Clear hint on correct answer**

In `keyTyped()`, inside the answer-check block where `rightAnswer()` is called, add `hintActive = false;` before/after `rightAnswer()`:

```java
                if (note.equals(ncourante.getNom())) {
                    hintActive = false;
                    rightAnswer();
                } else {
                    wrongAnswer();
                }
```

- [ ] **Step 2: Compile to verify**

Run: `ant compile`  
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Manual verification — hint dismisses**

Start learning-mode note game. Bar falls. Press the matching key → bar vanishes immediately. Press wrong key → bar stays.

- [ ] **Step 4: Commit**

```bash
git add src/net/jalmus/Jalmus.java
git commit -m "feat(jalmus): dismiss falling hint on correct key press"
```

---

### Task 7: Final compile, manual verification, commit

**Files:**
- Modify: none (review only)

- [ ] **Step 1: Final compile**

Run: `ant compile`  
Expected: BUILD SUCCESSFUL.

- [ ] **Step 2: Review diff**

Run: `git diff HEAD~7..HEAD --stat`  
Confirm: only `Jalmus.java` and `Piano.java` changed; rhythm/score reading untouched; no language branches in hint logic.

- [ ] **Step 3: Full manual verification**

Run Jalmus and verify:
- Preferences → note-reading tab has "Show falling key hint" checkbox.
- Learning mode + note reading: gold bar drifts onto correct key with letter over ~1s.
- Press correct key → bar vanishes.
- Uncheck hint → no bar.
- Normal game mode → no bar.
- Rhythm/score reading → no bar.
- Resize window mid-fall → bar still lands on correct key.

- [ ] **Step 4: Final commit (if any cleanup)**

```bash
git add -A
git commit -m "chore: finalize falling hint bar feature"
```

---

## Spec Coverage

| Spec requirement | Task(s) |
|---|---|
| Solid bright medium bar falls onto correct key | Task 2 (`paintHint`), Task 3 (draw) |
| Falls from above staff over ~1 second | Task 1 (`updateHint`, progress 0→1 over ~100 ticks) |
| Shows computer key letter on bar | Task 2 (`paintHint` draws letter), Task 4 (letter lookup) |
| Lands and stays until correct key pressed or note changes | Task 6 (dismiss on correct answer), Task 4 (new note replaces) |
| Note change mid-fall: current completes, then new | Task 4 logic (new `newnote()` sets state; `updateHint` caps at 1.0) |
| Gated by preferences toggle | Task 5 (`hintCheckBox`, `hintEnabled`) |
| Note-reading + learning mode only | Task 4 (`selectedGame==NOTEREADING && isLearninggame()`), Task 3 guard |
| Nothing changes when hint off | `hintEnabled`/`hintActive` guards throughout |
| No rhythm/score hint | No changes to RhythmLevel/ScoreLevel |
| Reuse existing render loop (10ms) | Task 3 |

---

Plan complete and saved to `docs/superpowers/plans/2026-11-04-falling-hint-bar.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration (uses `superpowers:subagent-driven-development`).
2. **Inline Execution** — I execute tasks in this session using `executing-plans`, batch execution with checkpoints for review.

Which approach would you like?