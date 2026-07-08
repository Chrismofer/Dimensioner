# Dimensioner

A browser-based image measurement tool built with JS + HTML

**Use it here:** https://chrismofer.github.io/Dimensioner/


## How does it work?

Dimensioner is for measuring real-world dimensions from images, technical drawings, and photographs.

While ideal for drawings and renders that are orthographic or isometric, it also handles perspective distortion using the grid tool in 2VP mode.

The workflow is simple:
1. Load an image
2. Draw a line over a known feature and enter its real-world length to **calibrate** the scale
3. Draw additional lines over anything you want to measure. each line's dimensioned length will be displayed.

<img width="1644" height="1480" alt="image" src="https://github.com/user-attachments/assets/0e16be06-b030-42ec-abd1-5ed1155ca22f" />


## Features

- Opens any browser-supported image format (PNG, JPG, WebP, GIF, etc.)
- Works best with isometric and orthographic drawings, or top/front/side view images of objects
- Draw and reposition measurement lines over the image
- Lines display length in pixels.
- Once calibrated, lines show real-world unit lengths.
- Multi-select lines and arcs using **Ctrl** or **Alt**. move or delete them as a group. press **A** to select ALL
- Measure angles between any two lines: an arc and angle label can be placed in any angle sector.
- Selected angle labels can be clicked and dragged to reposition.
- Angle arcs and labels update live if the referenced lines are moved.
- Draw a grid between two lines with configurable cell counts
- **Affine Spacing** mode: evenly spaces lines across the grid a la orthographic projection.
- **2VP Spacing** mode: perspective-correct harmonic spacing using two vanishing points derived from the reference lines; the button turns red if the quad is concave (no interior lines are drawn).
- Choose line colors and thickness with sidebar controls; changes apply to selected lines instantly.
- Snap lines to 45° increments by holding **Shift**
- hold **Ctrl**/**Alt** while drawing or moving a line or group of lines to snap to endpoints.
- Zoom, pan, and rotate the view
- Unlimited Undo / Redo history
  
- Save output options:
  - **PNG**: lines and labels over image
  - **PNG**: lines and labels over dark background
  - **SVG**: vector lines and labels over raster image
  - **SVG**: vector lines and labels (no image)
  - **CSV**: spreadsheet of all line coordinates and lengths
(labels will not be included in outputs if they are disabled in the UI)

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
| Toggle grid spacing mode | **Affine Spacing** / **2VP Spacing** button (teal = active/convex, red = concave quad) |
| Adjust grid extents | Drag endpoint circles while in grid mode |
| Confirm / Cancel grid | **Enter** / **Escape** |
| Undo / Redo | **Ctrl+Z** / **Ctrl+Y** |
| Zoom | Scroll wheel, `+` / `-`, or zoom input box |
| Pan | Arrow keys or middle-mouse click and drag |
| Rotate view | ↺ / ↻ buttons (45° steps) |
| Reset view | **Reset View** button (resets zoom, rotation, re-centers image) |
| Save output | **Save Output** button |


Dimensioner is free and open source, runs locally and requires no internet connection.


## To-do

- CSV export only deals in lines but should include labels, image dimensions, and other information.
- UI could be more reactive to the currently chosen tool or mode
- zoom speed slows and stops too early. correct log zoom function
- grid creation should count as one undo/redo rather than each line being it's own.
