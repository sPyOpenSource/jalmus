# Keyboard-to-Piano Key Mapping — Design Spec

**Project:** Jalmus (Java Swing music-education app)  
**Date:** 2026-11-04  
**Topic:** Computer-keyboard triggering of the on-screen piano during the note-reading exercise  
**Status:** Approved design

## 1. Purpose & Success Criteria

**Purpose:** Let users press computer keys to play the on-screen piano keys during the note-reading game, instead of only clicking buttons with the mouse. This speeds up gameplay and reduces repetitive clicking.

**Success criteria:**
- Pressing a mapped home-row key triggers the corresponding piano key's sound and highlights the button visually.
- Correct note (matching the current staff note) counts as `rightAnswer()`; incorrect note counts as `wrongAnswer()`.
- Unmapped keys are ignored. Game-not-started or paused states ignore note input.
- Mapping is language-independent (no Q-vs-A branch depending on locale).
- Works within the existing note-reading game only (rhythm/score reading out of scope — YAGNI).

## 2. Scope (in / out)

**In scope:**
- Extend `Jalmus.keyTyped()` with a clean, language-independent key → piano-note map.
- Add visual highlight feedback to `Piano` buttons when a key is pressed.
- Cover all 7 naturals plus the 5 black-key accidentals.
- Gate input behind existing `parti` / `paused` guards.

**Out of scope (deferred):**
- Rhythm reading and score reading games.
- User-customizable key bindings stored in preferences.
- Unifying computer-keyboard and MIDI input behind a single interface.
- New unit-test framework (manual verification only).

## 3. Architecture

The feature reuses existing components and adds no new files:

- **`Jalmus`** (`Jalmus.java`) — owns the `KeyListener` (`keyTyped`/`keyPressed`/`keyReleased`), holds `parti`, `paused`, `ncourante` (current target note), and calls `rightAnswer()` / `wrongAnswer()`.
- **`Piano`** (`Piano.java`) — renders the on-screen keyboard; owns `Key` instances; will gain two small helpers to highlight/unhighlight a pressed key.
- **`Key`** (`Key.java`) — represents one piano key; already has `on()` / `off()` for sound.

No new classes, no new packages, no changes to layout managers.

## 4. Components

### 4.1 Key → note map (in `Jalmus`)

A static map from `KeyEvent.VK_*` constants to a descriptor `(note name, piano key object lookup, isNatural)`.

Home-row naturals:
| Key | Note | Solfege |
|-----|------|---------|
| A | C | DO |
| S | D | RE |
| D | E | MI |
| F | F | FA |
| G | G | SOL |
| H | A | LA |
| J | B | SI |
| K | C (octave +1) | DO2 |

Accidentals (row above home row):
| Key | Accidental | Solfege |
|-----|------------|---------|
| W | C# | DO# |
| E | D# | RE# |
| T | F# | FA# |
| Y | G# | SOL# |
| U | A# | LA# |

### 4.2 Piano visual feedback (in `Piano`)

- `void setPressedKey(Key k)` — marks `k` as visually pressed and repaints.
- `void clearPressedKey()` — clears the pressed highlight and repaints.

`Piano` already tracks a "prev key" for mouse hover; this adds a keyboard-pressed highlight independent of mouse state.

## 5. Data Flow

```
keyTyped(KeyEvent)
   │
   ├─ unmapped key ─────────→ ignore (no-op)
   ├─ game not started (!parti) ─→ ignore
   ├─ paused (paused) ────────→ ignore
   └─ mapped key ─────────────→ Piano.setPressedKey(key)
                                    key.on(channel, sound)
                                    if note-reading game active:
                                       if key.pitch == ncourante.pitch:
                                          rightAnswer()
                                       else:
                                          wrongAnswer()
keyReleased / focus loss ────→ key.off(channel, sound)
                                  Piano.clearPressedKey()
```

The existing `keyPressed` (arrow keys, Escape, space) is untouched. `keyReleased` remains an empty required override.

## 6. Error Handling

- **Unmapped key:** no-op, no sound, no highlight — silently ignored.
- **Game not started / not in note-reading mode:** input ignored via existing `parti` and `selectedGame == NOTEREADING` guards (already present in `keyTyped`).
- **Paused:** input ignored via existing `paused` guard.
- **`ncourante` null / uninitialized:** guarded by existing `parti && !paused && noteLevel.isNotesgame()` condition; pitch comparison only reached when a current note exists.
- **MIDI channel unavailable:** existing `!midierror` guard preserved around `key.on()`.

## 7. Changes to Remove

Remove the old language-dependent branch in `keyTyped()` that special-cased `Q` vs `A` for DO based on `language == "fr"`. Replace with the single consistent home-row map above. This eliminates a locale-dependent bug where French users used `Q` for DO and others used `A`.

## 8. Testing

Manual verification steps:
1. Launch Jalmus, start a note-reading game.
2. Press A, S, D, F, G, H, J, K in turn — confirm each corresponding piano button highlights and sounds, and the answer registers right/wrong against the staff note.
3. Press W, E, T, Y, U — confirm accidental keys sound and highlight.
4. Press an unmapped key (e.g. X, Z) — confirm nothing happens.
5. Start the game but don't play; confirm keys do nothing until `parti` is true.
6. Press P to pause; confirm keys are ignored while paused.
7. Click piano buttons with the mouse as before — confirm mouse behavior unchanged.

No automated test infrastructure exists; manual testing is sufficient (YAGNI).

## 9. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Focus not on frame → key events dropped | `addKeyListener(this)` already on the frame; mouse click already calls `requestFocus()`. Document that window must be focused. |
| Key repeat (held key fires repeatedly) | Existing behavior for held mouse keys; acceptable for this scope. |
| Visual highlight out of sync with mouse highlight | `Piano.setPressedKey`/`clearPressedKey` operate independently of the mouse `prevkey` tracking; last writer wins on repaint, acceptable. |

---

*End of spec.*