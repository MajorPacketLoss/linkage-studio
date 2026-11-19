# Linkage Studio

Draw planar mechanisms, explore their motion, and construct velocity and acceleration polygons.

**[Open Linkage Studio](https://majorpacketloss.github.io/linkage-studio/)** · [User guide](docs/USER_GUIDE.md) · [Report a bug](https://github.com/MajorPacketLoss/linkage-studio/issues/new/choose)

Linkage Studio runs in your browser. No installation or account is required.

## Get started

1. Open **Examples** to explore a mechanism, or draw joints and links in a new sketch.
2. Add ground pivots, slider guides and constraints. Set a motion input in **Properties**.
3. Open **Analysis** for polygons, numerical results, equations and motion studies.

Use **Save** to keep a mechanism as a JSON file. Use **Print** for diagrams and polygons at a physical scale for tracing or comparison with hand calculations.

## Features

- Pin joints, rigid links, ground pivots, sliders and tracer points.
- External and internal gear meshes with grounded or moving shafts.
- Gear-driven linkages, open and crossed belt drives, and moving pulleys.
- Inextensible rope-length constraints with signed strand coefficients.
- Midpoint, coincident, horizontal, vertical, angle and collinear constraints.
- Position, velocity and acceleration analysis with component explanations and step-by-step polygon drawing.
- Per-joint **Calculated path** and **Live trail** toggles in Properties. Calculated paths use the Motion study span/samples and stop at the last solvable pose or 2,000 continuation steps. Live trails retain the latest 1,000 positions during playback, scrubbing and dragging; **Clear this joint’s trail** in Properties clears only that joint, while **Clear trails** on the canvas clears all trails. Clear buttons appear only when their corresponding trails contain recorded positions. Recording continues while Live trail is enabled. Paths are screen-only and reset when opening a mechanism or restoring Undo/Redo.
- System theme by default (with light/dark overrides), with custom accent, drawing-background and mechanism colors saved locally.
- Touchscreen editing: tap to select/place objects, drag objects to edit, drag empty canvas to pan, and pinch with two fingers to zoom/pan the sketch or polygons. Double-tap-and-drag empty canvas or use **Box select** for area selection. Lift all fingers after a pinch before editing again. The **Box select** toolbar button and on-screen touch hints appear only when the primary input is a coarse pointer (such as a phone or tablet touchscreen); mouse/trackpad devices show desktop hints and can drag empty canvas to select an area.
- Polygon line-thickness, line-style and arrowhead presets, with custom appearance controls.
- Animation, motion studies, CSV export and scale printing.
- Metric and imperial length units, editable link and tracer dimensions, undo and redo.

## Controls

| Action | Control |
| --- | --- |
| Pan | Right-drag the grid |
| Select an area | Left-drag empty grid |
| Edit geometry | Drag an object with Select active |
| Zoom | Scroll |
| Joint / link / gear | J / L / G |
| Pulley / collinear | U / K |
| Select / clear selection | V / Escape |
| Undo / redo | Ctrl+Z / Ctrl+Shift+Z or Ctrl+Y |
| Play or pause / fit view | Space / Home |

In-app **Help** offers a three-step quick start, collapsible FAQs and grouped keyboard shortcuts. The [user guide](docs/USER_GUIDE.md) covers detailed workflows.

## Scope

Analysis assumes planar rigid links, stationary straight slider guides and ideal no-slip gears and belts. Belt drives require fixed shafts; rope constraints use straight segments with fixed directions. Gear outlines are schematic; kinematics use pitch circles. A mechanism needs sufficient constraints and a compatible input. Singular configurations and incompatible dimensions can stop a solution.

Force analysis, elastic belts and ropes, arbitrary cable routing, friction and tooth-contact stresses are not currently included. Check results against an independent calculation before relying on them for a design or assessment.

## Project information

[Contributing](CONTRIBUTING.md) · [Release notes](CHANGELOG.md) · [Security](SECURITY.md)

Released under [The Unlicense](LICENSE).
