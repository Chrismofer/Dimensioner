# Dimensioner

A browser-based image measurement tool built with JS + HTML
Ideal for measuring drawings/renderings that are orthographic or isometric.

**Live app:** https://chrismofer.github.io/Dimensioner/

## What is it for?

Dimensioner is designed for extracting real-world measurements from relatively undistorted images technical drawings or straight-on photographs of objects.

The workflow is simple:
1. Load an image where at least one dimension is already known
2. Draw a line over that known feature and enter its real-world value to **calibrate** the scale
3. Draw lines over anything else you want to measure — Dimensioner converts pixel lengths to real-world units automatically


<img width="2196" height="1485" alt="image" src="https://github.com/user-attachments/assets/9526c9fc-015f-44e8-86d2-62f58f6efb81" />



## Features

- Load an image and draw measurement lines over it
- Select a line to define it's real-world length or to reposition it's endpoints
- Lines display length in pixels + calibrated units once any one line has been defined

- Snap lines to 45° angles (hold **Shift**)
- Snap line endpoints together (hold **Ctrl**)
- Undo / Redo line placement

- View controls: Zoom (scroll wheel or `+`/`-`), Pan (arrow keys or middle-mouse drag), and Rotate View (45° buttons)
- Save output: image with lines on top, lines-only image, and a CSV of all measurements

## Controls

| Action | Input |
|---|---|
| Draw line | Click and drag |
| Snap to 45° angle | Hold **Shift** while drawing |
| Link lines together | Hold **Ctrl** while drawing or dragging |
| Select / deselect line | Click on or near a line |
| Move endpoint | Select line first, drag endpoint |
| Set calibration | Select line, type value, press **Enter** or ✓ |
| Delete selected line | **Delete** key |
| Undo / Redo | **Ctrl+Z** / **Ctrl+Y** |
| Zoom | Scroll wheel or `+` / `-` |
| Pan | Arrow keys or middle-mouse click and drag |
| Rotate view | ↺ / ↻ buttons (45° steps) |
| Save output | **Save Output** button |
