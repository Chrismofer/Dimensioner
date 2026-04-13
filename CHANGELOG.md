# Changelog





## 2026-04-13 v1.2

- added 1.5px black border around the opened image to differentiate it's edges from the background color
- changed panning method to be rotationally aware (still works with middle mouse button or arrow keys)
- changed zoom level to be an input box for extra control
- rearranged and colorized the UI buttons for easier usage
- changed default line color to pleasing amber
- adjusted look of Zoom and Position labels
- instructions moved to dialog box with toggle button
- reset lines now asks for confirmation (are you sure?)


## 2026-04-13 v1.1


- Fixed "reset view" bugs and added X/Y position readout to the toolbar
- Added "measure angle" feature
- Arc editing features to match line editing
- Renamed PNG exports for clarity
- "Reset Image" no longer clears lines, calibration, zoom, pan, or rotation, it only unloads the image
- Added position readout font/size/color to match the Zoom readout
- PNG label text is now always white (was using line color)


## 2026-04-11

- Dimension label numbers (px, units, calibration) now draw in white instead of the line's color
- Sidebar instructions extended and text color brightened
- Fixed Shift-to-snap not working when dragging an existing line's endpoint (only worked when drawing new lines)
- Moved "Save Output" button to above the Instructions section in the sidebar
- Save Output now shows a checkbox dialog to select which formats to download (PNG composite, PNG lines-only, SVG with labels, SVG lines-only, CSV)
- Added SVG export: lines with labels (`lines_with_labels.svg`) and lines only (`lines_only.svg`)
- Fixed color picker bug: `colorPicker.value` → `colorPicker.value()` - changing line color no longer breaks line rendering
- Selecting a line and changing the color picker now recolors that line immediately
- Added per-line thickness control; lines can have different thicknesses and colors in the same drawing
- Renamed "Reset Zoom" to "Reset View"; it now also re-centers the image
- Fixed sidebar squishing on window resize (added `flex-shrink: 0` and `min-width`)
- Updated README

