"""Stitch fieldwork-demo frames into an animated GIF.

Usage: python scripts/stitch-demo-gif.py [out_path]

Reads /tmp/fieldwork-demo/frame-*.png in lexical order, downsamples to a
reasonable width, and writes a GIF with per-frame timings tuned for the
demo arc (lingers on briefing/debrief, quick on turn results).
"""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path
from PIL import Image

# Resolve frames dir cross-platform: bash on Windows maps /tmp to %TEMP%, but
# the Windows Python interpreter doesn't honor that mapping.
FRAMES_DIR_ENV = os.environ.get("FIELDWORK_FRAMES_DIR")
if FRAMES_DIR_ENV:
    FRAMES_DIR = Path(FRAMES_DIR_ENV)
elif Path("/tmp/fieldwork-demo").exists():
    FRAMES_DIR = Path("/tmp/fieldwork-demo")
else:
    FRAMES_DIR = Path(tempfile.gettempdir()) / "fieldwork-demo"

DEFAULT_OUT = FRAMES_DIR / "fieldwork-demo.gif"
TARGET_WIDTH = 960

# Curated subset — drop duplicates / broken-state frames the agent captured
# while debugging. Keep the narrative arc clean.
FRAME_ORDER = [
    ("frame-01-picker.png", 1800),
    ("frame-02-briefing.png", 2400),
    ("frame-02c-action-typed.png", 1400),
    ("frame-07-turn1-fresh.png", 2200),
    ("frame-09-turn2-success.png", 2200),
    ("frame-10-turn3-objective-met.png", 2600),
    ("frame-12-after-debrief-click.png", 1600),
    ("frame-13-debrief-text.png", 2800),
    ("frame-14-debrief-middle.png", 2800),
    ("frame-15-debrief-bottom.png", 2800),
    ("frame-16-pick-another.png", 2000),
    ("frame-17-back-to-picker.png", 2400),
]


def load_and_resize(path: Path) -> Image.Image:
    img = Image.open(path).convert("RGB")
    if img.width > TARGET_WIDTH:
        ratio = TARGET_WIDTH / img.width
        new_size = (TARGET_WIDTH, int(img.height * ratio))
        img = img.resize(new_size, Image.LANCZOS)
    return img.convert("P", palette=Image.ADAPTIVE, colors=256)


def main() -> int:
    out_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_OUT

    frames: list[Image.Image] = []
    durations: list[int] = []
    missing: list[str] = []
    for name, duration_ms in FRAME_ORDER:
        path = FRAMES_DIR / name
        if not path.exists():
            missing.append(name)
            continue
        frames.append(load_and_resize(path))
        durations.append(duration_ms)

    if missing:
        print(f"warning: missing frames skipped: {', '.join(missing)}")

    if not frames:
        print("error: no frames loaded", file=sys.stderr)
        return 1

    out_path.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        out_path,
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=0,
        optimize=True,
        disposal=2,
    )
    size_kb = out_path.stat().st_size / 1024
    print(f"wrote {out_path} ({len(frames)} frames, {size_kb:.0f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
