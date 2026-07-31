import os, math, tempfile
import numpy as np
import librosa
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

app = FastAPI(title="Guitarnada Backend", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

KS_MAJOR = np.array(
    [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
    dtype=np.float64,
)
KS_MINOR = np.array(
    [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17],
    dtype=np.float64,
)

# (pitch-class offsets, quality id, display suffix) — quality id is internal only.
TEMPLATES = [
    ([0, 4, 7],        "maj", ""),
    ([0, 3, 7],        "min", "m"),
    ([0, 3, 6],        "dim", "dim"),
    ([0, 4, 8],        "aug", "aug"),
    ([0, 2, 7],        "sus2", "sus2"),
    ([0, 5, 7],        "sus4", "sus4"),
    ([0, 4, 7, 11],    "maj7", "maj7"),
    ([0, 3, 7, 10],    "m7", "m7"),
    ([0, 4, 7, 10],    "dom7", "7"),
    ([0, 4, 7, 14],    "add9", "add9"),
    ([0, 3, 7, 14],    "madd9", "m(add9)"),
    ([0, 4, 7, 9],     "6", "6"),
    ([0, 3, 7, 9],     "m6", "m6"),
    ([0, 3, 6, 9],     "dim7", "dim7"),
    ([0, 3, 6, 10],    "m7b5", "m7b5"),
    ([0, 4, 7, 11, 14], "maj9", "maj9"),
    ([0, 4, 7, 10, 14], "9", "9"),
    ([0, 5, 7, 10],    "7sus4", "7sus4"),
    ([0, 2, 4, 7],     "6/9", "6/9"),
]

# Precompute normalised chord masks — one binary 12-vector per (root, template).
MASKS = []
for root in range(12):
    for offsets, _quality, suffix in TEMPLATES:
        m = np.zeros(12, dtype=np.float64)
        for o in offsets:
            m[(root + o) % 12] = 1.0
        n = float(np.linalg.norm(m) or 1.0)
        MASKS.append((m / n, suffix, root))


class KeyInfo(BaseModel):
    tonic: str
    type: str  # "maj" | "min"


class ChordItem(BaseModel):
    time: float
    bar: int
    chordName: str
    roman: Optional[str] = None


class Section(BaseModel):
    name: str
    start: float
    end: float


class AnalyzeResponse(BaseModel):
    key: KeyInfo
    keyObj: KeyInfo
    bpm: int
    timeSignature: str
    durationSec: float
    chords: List[ChordItem]
    sections: List[Section]
    onDevice: bool


def detect_key(chroma_sum: np.ndarray):
    """Krumhansl–Schmuckler key detection over the summed chroma histogram."""
    best_score = -1.0
    best_tonic = 0
    best_is_major = True
    for shift in range(12):
        rotated = np.roll(chroma_sum, -shift)
        sm = float(np.corrcoef(rotated, KS_MAJOR)[0, 1])
        sn = float(np.corrcoef(rotated, KS_MINOR)[0, 1])
        if not math.isnan(sm) and sm > best_score:
            best_score, best_tonic, best_is_major = sm, shift, True
        if not math.isnan(sn) and sn > best_score:
            best_score, best_tonic, best_is_major = sn, shift, False
    return NOTE_NAMES[best_tonic], ("maj" if best_is_major else "min")


def name_chord(vec: np.ndarray):
    """Match a 12-bin chroma vector to the closest chord template by cosine similarity."""
    nrm = float(np.linalg.norm(vec) or 1.0)
    uv = vec / nrm
    best_sim = -2.0
    best_root = 0
    best_suffix = ""
    for mask_norm, suffix, root in MASKS:
        sim = float(np.dot(mask_norm, uv))
        if sim > best_sim:
            best_sim, best_root, best_suffix = sim, root, suffix
    return NOTE_NAMES[best_root], best_suffix


def roman_for(note: str, tonic: str, mode: str):
    """Return the diatonic roman-numeral function of `note` in `tonic`/`mode`."""
    if note not in NOTE_NAMES or tonic not in NOTE_NAMES:
        return None
    idx = NOTE_NAMES.index(note)
    ti = NOTE_NAMES.index(tonic)
    off = (idx - ti + 12) % 12
    major_table = {0: "I", 2: "ii", 4: "iii", 5: "IV", 7: "V", 9: "vi", 11: "vii°"}
    minor_table = {0: "i", 2: "ii°", 3: "III", 5: "iv", 7: "v", 8: "VI", 10: "VII"}
    table = major_table if mode == "maj" else minor_table
    return table.get(off, None)


@app.post("/analyze/audio")
async def post_analyze(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file given")
    raw = await file.read()
    tmp_name = ""
    try:
        fd, tmp_name = tempfile.mkstemp(suffix=".audio")
        os.write(fd, raw)
        os.close(fd)
        y, sr = librosa.load(tmp_name, sr=22050, mono=True)
    finally:
        if tmp_name and os.path.exists(tmp_name):
            os.unlink(tmp_name)

    if y is None or len(y) == 0:
        raise HTTPException(status_code=400, detail="Could not decode audio")

    duration = float(len(y) / max(sr, 1))

    # Tempo / beats: librosa returns either a float or an array depending on version.
    tempo, _beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    if isinstance(tempo, np.ndarray):
        bpm = float(tempo[0]) if tempo.size else 0.0
    else:
        bpm = float(tempo) if tempo else 0.0
    if bpm <= 0 or not math.isfinite(bpm):
        bpm = 92.0

    # Chroma (CENS is robust to dynamics/timbre) summed across the whole track → key.
    chroma = librosa.feature.chroma_cens(y=y, sr=sr, hop_length=512)
    chroma_sum = chroma.sum(axis=1)
    tonic, mode = detect_key(chroma_sum)

    # Per-bar chord detection: aggregate the chroma inside each bar, name it, debounce
    # so a chord only re-surfaces when it changes.
    bar_sec = (60.0 / max(bpm, 0.1)) * 4.0
    total_bars = max(1, int(duration // bar_sec))
    chords: List[ChordItem] = []
    last_name = ""
    for b in range(total_bars):
        t0 = b * bar_sec
        t1 = (b + 1) * bar_sec
        s0 = librosa.time_to_frames(t0, sr=sr, hop_length=512)
        s1 = librosa.time_to_frames(t1, sr=sr, hop_length=512)
        s0 = max(0, min(s0, chroma.shape[1] - 1))
        s1 = max(s0 + 1, min(s1, chroma.shape[1]))
        seg = chroma[:, s0:s1].sum(axis=1)
        root, suffix = name_chord(seg)
        name = f"{root}{suffix}"
        if last_name != name:
            chords.append(
                ChordItem(
                    time=round(t0, 2),
                    bar=b,
                    chordName=name,
                    roman=roman_for(root, tonic, mode),
                )
            )
            last_name = name

    # Naive song-section split — keep parity with the on-device analyzer's heuristic.
    sections: List[Section] = []
    if len(chords) >= 3:
        boundary = bar_sec * max(1, chords[1].bar)
        sections.append(Section(name="Intro", start=0.0, end=boundary))
        sections.append(
            Section(
                name="Verse",
                start=boundary,
                end=max(duration - bar_sec, boundary),
            )
        )
        if duration > bar_sec * (len(chords) + 1):
            sections.append(
                Section(name="Outro", start=max(0.0, duration - bar_sec), end=duration)
            )
    elif chords:
        sections.append(Section(name="Verse", start=0.0, end=duration))

    return AnalyzeResponse(
        key=KeyInfo(tonic=tonic, type=mode),
        keyObj=KeyInfo(tonic=tonic, type=mode),
        bpm=int(round(bpm)),
        timeSignature="4/4",
        durationSec=round(duration, 2),
        chords=chords,
        sections=sections,
        onDevice=False,
    ).model_dump()


@app.get("/health")
def health():
    return {"status": "ok"}
