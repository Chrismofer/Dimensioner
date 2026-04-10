# Dimensioner

A browser-based image measurement tool built with [p5.js](https://p5js.org/).

**Live app:** https://chrismofer.github.io/Dimensioner/

## Features

- Load any image and draw measurement lines over it
- Lines display pixel lengths; set a calibration value on one line to show real-world units on all others
- Snap lines to 45° angle increments (hold **Shift**)
- Snap line endpoints together (hold **Ctrl**)
- Select a line to edit its calibration value or drag its endpoints
- Zoom (scroll wheel or `+`/`-`), pan (arrow keys or middle-mouse drag), and rotate view (45° buttons)
- Undo / Redo
- Save output: image with lines, lines-only image, and a CSV of all measurements

## Controls

| Action | How |
|---|---|
| Draw line | Click and drag |
| Snap to 45° angle | Hold **Shift** while drawing |
| Snap endpoints | Hold **Ctrl** while drawing or dragging |
| Select / deselect line | Click near a line |
| Move endpoint | Select line, drag endpoint circle |
| Set calibration | Select line, type value, press **Enter** or ✓ |
| Delete selected line | **Delete** key |
| Undo / Redo | **Ctrl+Z** / **Ctrl+Y** |
| Zoom | Scroll wheel or `+` / `-` |
| Pan | Arrow keys or middle-mouse drag |
| Rotate view | ↺ / ↻ buttons (45° steps) |
| Save output | **Save Output** button |
