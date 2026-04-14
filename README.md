# Dimensioner

A browser-based image measurement tool built with JS + HTML

**Use it here:** https://chrismofer.github.io/Dimensioner/


## How does it work?

Dimensioner helps you measure real-world dimensions from relatively undistorted images, technical drawings, or straight-on photographs of objects. 
It is Ideal for drawings/renderings that are orthographic or isometric.

The workflow is simple:
1. Load an image where at least one dimension is already known
2. Draw a line over that known feature and enter its real-world value to **calibrate** the scale
3. Draw lines over anything else you want to measure. it will calculate and display the real-world dimensions.


<img width="1644" height="1480" alt="image" src="https://github.com/user-attachments/assets/0e16be06-b030-42ec-abd1-5ed1155ca22f" />



## Features

- Opens any browser-supported image format (PNG, JPG, WebP, GIF, etc.)
- Works best with isometric and orthographic drawings, or top/front/side view images of objects
- Draw and reposition measurement lines over the image
- Lines display length in pixels; once calibrated, lines show real-world units automatically
- Multi-select lines and arcs with **Ctrl** or **Alt**. move or delete them as a group
- press **A** to select everything
- Measure angles between any two lines: an arc and angle label can be placed in any angle sector.
- Selected angle labels can be clicked and dragged to reposition.
- Angle arcs and labels update live if the referenced lines are moved.
- Draw a grid between two lines with configurable cross and along cell counts
- Choose line colors and thickness with sidebar controls; changes apply to selected lines instantly.
- Snap lines to 45° anglesby holding **Shift**
- hold **Ctrl**/**Alt** while dragging a whole line or group of lines to link lines by endpoints
- Zoom, pan, and rotate the view
- Unlimited Undo / Redo
- Save output options:
  - **PNG** — composite image with lines and labels
  - **PNG** — lines and labels only, on a dark background
  - **SVG** — vector lines and labels (raster image included)
  - **SVG** — vector lines and labels (no raster image)
  - **CSV** — spreadsheet of all line coordinates and lengths


## Controls

| Action | Input |
|---|---|
| Draw line | Click and drag |
| Snap to 45° angle | Hold **Shift** while drawing |
| Set line color | Color picker in sidebar |
| Set line thickness | Thickness input in sidebar |
| Link lines by endpoints | Hold **Ctrl** or **Alt** while drawing or dragging |
| Select / deselect line | Click on or near a line |
| Add to / remove from selection | Hold **Ctrl** or **Alt**, click a line or arc |
| Select all | Press **A** |
| Move endpoint | Select line first, drag endpoint |
| Move whole line (with snap) | Drag line body; hold **Ctrl**/**Alt** to snap an endpoint to another |
| Move all selected | Drag any selected line or arc |
| Set calibration | Select line, type value, press **Enter** or ✓ |
| Delete selected line(s) / arc(s) | **Delete** key |
| Measure angle | Click **Measure Angle** button, then select two lines |
| Place angle arc | Move mouse to desired position, click or press **Enter** |
| Select arc | Click on arc or its label in normal mode |
| Reposition arc | Click and drag a selected arc |
| Cancel angle mode | Press **Escape** or click **Measure Angle** again |
| Draw grid | Click **Draw Grid** button, then select two lines |
| Set grid cell counts | **Cross** / **Along** inputs in sidebar |
| Adjust grid extents | Drag endpoint circles while in grid mode |
| Confirm / Cancel grid | **Enter** / **Escape** |
| Undo / Redo | **Ctrl+Z** / **Ctrl+Y** |
| Zoom | Scroll wheel, `+` / `-`, or zoom input box |
| Pan | Arrow keys or middle-mouse click and drag |
| Rotate view | ↺ / ↻ buttons (45° steps) |
| Reset view | **Reset View** button (resets zoom, rotation, re-centers image) |
| Save output | **Save Output** button |
