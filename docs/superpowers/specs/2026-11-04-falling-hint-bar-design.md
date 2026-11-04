# Falling Hint Bar — Design Spec

**Project:** Jalmus (Java Swing music-education app)  
**Date:** 2026-11-04  
**Topic:** Falling hint bar showing which computer key to press during the note-reading learning game  
**Status:** Approved design

## 1. Purpose & Success Criteria

**Purpose:** In learning mode during note reading, show the user which computer key to press for the currently-displayed staff note via a "falling bar" animation — a solid bright bar that drifts down from above the musical staff and lands on the correct piano key, with the computer key letter shown on the bar. This is a learning/practice aid, not a gameplay crutch.

**Success criteria:**
- A solid bright medium bar falls from above the staff onto the correct piano key over ~1 second (moderate pace) when learning mode is active and a new note appears.
- The bar shows the computer key letter (e.g. "A") so the user knows exactly which key to press.
- The bar lands on the correct key and stays highlighted until the user presses the matching key or the note changes.
- If the note changes while a bar is mid-fall, the current bar completes its fall before a new one starts.
- The feature is gated behind a preferences-dialog toggle (note-reading tab) and only active in learning mode during note reading — never in normal game scoring or rhythm/score reading.
- When the hint toggle is off, nothing changes in rendering or behavior.

## 2. Scope (in / out)

**In scope:**
- Hint state + timing in `Jalmus` (active, target pitch, key letter, progress 0→1).
- `Piano.paintHint()` to draw the bar at the correct key's x-position with the key letter.
- Trigger on new note in `newnote()` when learning mode + hint enabled + note reading.
- Preferences-dialog toggle in the note-reading tab.
- Reuse the existing `RenderingThread` 10ms repaint loop for animation ticks.

**Out of scope (YAGNI):**
- Hint for rhythm reading or score reading.
- Hint in normal (scoring) game mode — learning mode only.
- User-customizable fall speed, color, or key letter font.
- Hint persisting after game end or across lessons.
- Sound accompanying the hint.

## 3. Architecture

Three existing components, minimally extended:

| Component | Role | Change |
|---|---|---|
| `Jalmus` | Owns game state, `keyTyped` input, `newnote()` trigger, preferences | Add hint fields, `updateHint()` tick, trigger in `newnote()`, preferences toggle, read toggle in `keyTyped` answer check |
| `Piano` | Renders the keyboard; computes key x-positions in `paint()` | Add `setHint(int pitch, float progress, String letter)` + `paintHint(Graphics, int width)` |
| `RenderingThread` | Repaints `panelanim` every ~10ms | Unchanged — drives hint progress ticks via `updateHint()` |

## 4. Components

### 4.1 Hint state (in `Jalmus`)

- `private boolean hintActive;` — is a hint currently falling/resting
- `private int hintPitch;` — MIDI pitch (kNum) of the key the bar targets
- `private String hintLetter;` — computer key letter to show on the bar ("A", "S", ...)
- `private float hintProgress;` — 0.0 (top of staff) to 1.0 (landed on key)

A static map `NOTE_BY_KEY` / `PITCH_BY_KEY` already exists from the keyboard-mapping feature (Task 2 of the keyboard spec). Reuse it to look up the letter→pitch and vice versa. The note name of `ncourante` maps to a pitch via `PITCH_BY_KEY`.

### 4.2 Hint trigger

In `newnote()` (called when a fresh staff note appears), when all of:
- `selectedGame == NOTEREADING`
- `noteLevel.isLearninggame()`
- hint preference enabled

Set `hintPitch`, `hintLetter`, `hintProgress = 0`, `hintActive = true`.

If a hint is already active when `newnote()` fires, leave the current bar to complete its fall ("complete the fall, then start new" — the new hint starts once `hintProgress` reaches 1.0 and the note is answered).

### 4.3 Hint animation (tick + draw)

`updateHint()` — called each `RenderingThread` tick (~10ms) while `hintActive`:
- `hintProgress += 0.01` (→ reaches 1.0 after ~100 ticks ≈ 1 second)
- When `hintProgress >= 1.0`, clamp to 1.0 (bar rests on key)

`Piano.paintHint(Graphics g, int width)`:
- Look up the `Key` for `hintPitch` via `getKeyByPitch()`.
- Compute the key's screen x-position using the same math `paint()` uses (`marge + offx + kw*i` for white keys; `marge + offx + key.getXoffset() - 2 + kw*(i+1)` for black keys).
- Draw a solid bright medium bar (~12px tall) spanning the key's width, at a y that interpolates from above the staff (`ypos - fallRange`) down to the key top (`ypos`) based on `hintProgress`.
- Draw the key letter (`hintLetter`) centered on the bar.

Because `paintHint` runs inside `Piano.paint`, x-positions are always current with the window width/offset.

### 4.4 Hint dismissal

- When the user presses the matching computer key (in `keyTyped`, the answer-check block), clear `hintActive = false` so the bar disappears on the next repaint.
- When the note changes and a new hint starts, the old one is replaced.
- Game end / pause: `hintActive = false` (no hint while paused or stopped).

## 5. Data Flow

```
newnote() (learning mode + hint enabled)
   │
   └─ hintActive = true, hintProgress = 0, hintPitch/PitchLetter set

RenderingThread tick (~10ms) ─────┐
   │                              │
   └─ updateHint(): hintProgress += 0.01 (cap 1.0)
         │
         └─ panelanim.repaint()
               │
               └─ Anim.paintComponent → piano.paint() → piano.paintHint()
                     │
                     └─ draws falling bar at key x, letter on bar, y by progress

User presses matching key (keyTyped answer check)
   │
   └─ hintActive = false → bar vanishes on next repaint

Note changes mid-fall
   │
   └─ newnote() leaves active bar to finish (progress reaches 1.0), then new hint starts
```

## 6. Preferences toggle

Add a `JCheckBox hintCheckBox` ("Show falling key hint") to the note-reading tab of the preferences dialog, next to the other note-reading controls. Saved with the other preferences (`savePrefs` array / settings). Read as `hintEnabled` boolean. Default: on (learning aid is the point).

## 7. Error Handling

- `getKeyByPitch()` returns null for unmapped pitches → `paintHint` skips drawing (no crash).
- `panelanim` null-guarded (already the pattern elsewhere).
- Hint only active when `parti && !paused` — consistent with the rest of the game loop.

## 8. Testing

Manual verification:
1. Open preferences → note-reading tab → ensure "Show falling key hint" is checked.
2. Start a note-reading game in learning mode.
3. When a note appears, confirm a solid bright bar drifts from above the staff onto the correct piano key over ~1 second, with the key letter on it.
4. Press the matching computer key → bar disappears.
5. Press the wrong key → bar stays until correct key pressed or note changes.
6. Uncheck the hint preference → no bar appears.
7. Switch to normal game mode or rhythm/score reading → no bar.
8. Resize window mid-fall → bar still lands on the correct key (positions recomputed in `paint`).

## 9. What's NOT in scope

- Rhythm/score reading hints.
- Hint in normal/scoring mode.
- Customizable speed/color/letter.
- Hint sound.

---

*End of spec.*