package net.jalmus;

/**
 * A single recorded note: pitch, velocity, start time (ms from recording start)
 * and duration (ms). A duration of 0 means the note is still held (no note-off yet).
 *
 * <p>Title: Jalmus</p>
 *
 * <p>Description: Free software for sight reading</p>
 *
 * <p>Copyright: Copyright (c) 2006</p>
 *
 * @author RICHARD Christophe
 * @version 1.0
 */
public class RecordedNote {

    public int pitch;
    public int velocity;
    public long startTime;  // milliseconds from recording start
    public long duration;   // milliseconds, 0 if still held

    public RecordedNote(int pitch, int velocity, long startTime) {
        this.pitch = pitch;
        this.velocity = velocity;
        this.startTime = startTime;
        this.duration = 0;
    }

    public void setDuration(long duration) {
        this.duration = duration;
    }

    public long getEndTime() {
        return startTime + duration;
    }
}
