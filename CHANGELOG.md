# Changelog

## 0.5.0 - 2026-11-19

### Added

- Added independent Calculated path and Live trail controls for each joint in Properties. Calculated paths use the Motion study span and samples, stopping at the last solvable pose or 2,000 continuation steps.
- Added live trails retaining the latest 1,000 positions during playback, scrubbing and object dragging, with controls to clear one joint’s trail or all trails. Paths are screen-only, are excluded from saved mechanisms and printed diagrams, and reset on Open and Undo/Redo.
- Added touchscreen navigation: drag empty canvas to pan, pinch with two fingers to zoom and pan the sketch or polygons, and double-tap-and-drag or use Box select for area selection.

### Changed

- New and reset appearance preferences now follow the system theme by default, while preserving saved light/dark overrides and custom colors.
- Show Box select and touch-specific navigation hints only for primary coarse-pointer devices. Increased touch target sizes and made toolbars and constraint controls scrollable on touchscreens and short displays.
- Updated the README, user guide and in-app help for motion paths, touchscreen controls and the system-theme default.
- Replaced the in-app help wall of text with a three-step quick start, collapsible FAQs, grouped shortcuts and a link to the full user guide.

### Fixed

- Cancel unfinished object drags and selection boxes when a two-finger gesture begins, and ignore remaining fingers until all are lifted to prevent accidental edits.
- Restore live trails after cancelled drags and break trails across failed solutions or geometry changes instead of connecting unrelated poses.
- Synchronized package metadata and the in-app release label, which still reported 0.3.0 after the 0.4.0 release.
- Expanded interaction regression coverage for joint paths, trail limits and clearing, touchscreen gestures, pointer cancellation and input-specific hints.

## 0.4.0 - 2026-11-18

### Added

- Added Light, Dark and Follow system themes, with a top-bar Appearance dialog.
- Added custom accent, drawing-background, six repeating link, wheel and rope colors, with immediate preview, browser-local saving and reset. When browser storage is unavailable, preferences apply for the session only.
- Added Tracing, Fine, Bold, Dashed and Technical polygon appearance presets, plus custom line thickness, line patterns and arrowheads. These settings also apply to printed polygons.
- Added step-by-step velocity and acceleration polygon drawing for the current solved mechanism, including custom links, sliders, tracers, gears, belts and moving pulleys. Previous/Next controls, a progress slider and Show complete reveal vectors with explanations, equations and component values.
- Added optional grid snapping for object placement and dragging, enabled by default without overriding mechanical constraints.
- Added inline link-length editing by double-clicking a dimension label, using the selected display units. Enter or leaving the field commits and locks the length; Escape cancels, and edits support undo/redo and constraint validation.

### Changed

- Moved the mechanism status badge into the Model panel header.
- Replaced collapsible Properties section indicators with chevrons showing their expanded or collapsed state.
- Start the analysis panel retracted to its tabs, including on narrow screens, to leave more room for the mechanism.
- New gears and pulleys now use Free centre shaft support by default.
- Updated the README, user guide and in-app help for appearance controls, polygon construction steps, snapping and wheel-support defaults.

### Fixed

- Unified gear and pulley dragging with constrained joint dragging, preserving grounded shafts and rejecting incompatible movement.
- Preserved dimension labels during selection so double-click editing works reliably.
- Kept polygon construction steps synchronized with pose and unit changes, restarting when a different mechanism is loaded. Printing always includes complete polygons, regardless of step-viewer progress.
- Kept app theme and color preferences separate from mechanism files, analysis values and printed diagram colors.
- Expanded interaction regression coverage for appearance preferences, polygon styles and steps, dimension editing, wheel dragging and grid snapping.

## 0.3.0 - 2026-11-18

- Removed the planet-carrier builder interface.
- Added pulley wheels, open and crossed belt connections, and rope-length constraints.
- Added three worked pulley examples with velocity, acceleration, equations and scale printing.
- Added live collinear constraints between two links or a link and joint.
- Added tracer offset, radius and angle dimensions that remain fixed when a base link changes length.
- Added U for pulley and K for collinear, and updated the user guide.

## 0.2.0 — 2026-11-18

Initial public release.

- Planar linkage construction with joints, sliders, ground pivots and tracers.
- Editable dimensions and constraints with selectable simulation behavior.
- Gear supports, external/internal meshes and carrier motion.
- Position, velocity and acceleration analysis with graphical polygons.
- Animation, motion studies, CSV export and mechanism JSON files.
- Physical-scale printing, metric and imperial units, and keyboard controls.
- User documentation, contribution guidance and Unlicense metadata.
- Escaped imported labels, bounded mechanism imports, spreadsheet-safe CSV labels and a restrictive content security policy.
