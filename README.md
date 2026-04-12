# Dimensioner

A browser-based image measurement tool built with JS + HTML
Ideal for measuring drawings/renderings that are orthographic or isometric.

**Live app:** https://chrismofer.github.io/Dimensioner/

## What is it for?

Dimensioner is designed for extracting real-world measurements from relatively undistorted images, technical drawings, or straight-on photographs of objects.

The workflow is simple:
1. Load an image where at least one dimension is already known
2. Draw a line over that known feature and enter its real-world value to **calibrate** the scale
3. Draw lines over anything else you want to measure and Dimensioner converts pixel lengths to real-world units automatically


<img width="2196" height="1485" alt="image" src="https://github.com/user-attachments/assets/9526c9fc-015f-44e8-86d2-62f58f6efb81" />



## Features

- Opens any browser-supported image format (PNG, JPG, WebP, GIF, etc.)
- Works best with isometric and orthographic drawings, or top/front/side view of objects
- Draw and reposition measurement lines over the image
- Lines display length in pixels; once calibrated, all lines show real-world units automatically
- Choose line colors and thickness with sidebar controls; changes apply to selected lines instantly
- Snap lines to 45° angles and link endpoints to other lines
- Zoom, pan, and rotate the view
- Unlimited Undo / Redo
- Save output options:
  - **PNG** composite image with lines and labels overlaid
  - **PNG** lines and labels only
  - **SVG** vector graphic of lines and labels
  - **SVG** vector graphic of lines only
  - **CSV** spreadsheet of all line coordinates and lengths

## Controls

| Action | Input |
|---|---|
| Draw line | Click and drag |
| Snap to 45° angle | Hold **Shift** while drawing |
| Set line color | Color picker in sidebar |
| Set line thickness | Thickness input in sidebar |
| Link lines together | Hold **Ctrl** while drawing or dragging |
| Select / deselect line | Click on or near a line |
| Move endpoint | Select line first, drag endpoint |
| Set calibration | Select line, type value, press **Enter** or ✓ |
| Delete selected line | **Delete** key |
| Undo / Redo | **Ctrl+Z** / **Ctrl+Y** |
| Zoom | Scroll wheel or `+` / `-` |
| Pan | Arrow keys or middle-mouse click and drag |
| Rotate view | ↺ / ↻ buttons (45° steps) |
| Reset view | **Reset View** button (resets zoom, rotation, and re-centers image) |
| Save output | **Save Output** button |
