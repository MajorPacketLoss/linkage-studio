# Contributing

Bug reports, reproducible mechanism files and feature proposals are welcome.

## Reporting problems

Use an issue template and include reproduction steps, expected and actual behavior, and your browser and operating system. Attach a small mechanism JSON file when practical. Remove private project information from shared files and screenshots.

For numerical discrepancies, include the pose, units, dimensions, sign conventions and an independent calculation for comparison.

## Development

Use Node.js 22 or newer. No package installation is needed.

```sh
git clone https://github.com/MajorPacketLoss/linkage-studio.git
cd linkage-studio
npm run build
npm run check
npm test
```

Open the generated root `index.html` in a browser to use the app locally. Edit the files in `src/`; `scripts/build.cjs` packages them into the self-contained root `index.html`. Include the regenerated file with source changes. Do not edit the generated file directly.

## Validation

- Keep pull requests focused and explain the user-visible behavior.
- For solver changes, include independently derived positions or rates with units and sign conventions.
- For interaction changes, verify the gesture in an actual browser as well as running automated checks.
- Check save/open compatibility and undo/redo when changing model or editor state.
- Check physical print scale when changing drawing or printing code.

The integration suite uses a simulated DOM. It checks solver and editor behavior but does not verify browser layout or native pointer-event delivery.

## Preparing a release

1. Update the version in `package.json` and the release label in `src/index.html`.
2. Add a dated entry to `CHANGELOG.md` describing the changes since the previous release. Keep historical entries unchanged and update the README, user guide and in-app help for changed behavior.
3. Run `npm run build`, `npm run check` and `npm test`. Verify the generated app in a browser and include the regenerated root `index.html` with the source changes.
4. After review, commit the release changes and tag the release with the same version (for example, `v0.5.0`). Push the commit and tag, then publish GitHub release notes from the changelog. Confirm the hosted app shows the new version.

## Source layout

| Path | Purpose |
| --- | --- |
| `src/solver.js` | Constraint closure and kinematic equations |
| `src/studio.js` | Drawing, editing and analysis views |
| `src/gear-mounts.js` | Gear supports and mesh connections |
| `src/examples.js` | Examples and saved-model normalization |
| `src/print.js` | Physical-scale print output |
| `tests/` | Automated integration checks |

Contributions are made available under [The Unlicense](LICENSE).
