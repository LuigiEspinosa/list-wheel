# CHANGELOG

## [2026-04-14]

### Added

- `EntryEditorComponent`: inline editor that hides the wheel and lets you add, rename, and remove entries in place, then persits the edited list back to the source file.
- Auto-scaling winner label on the wheel hub so long entries no longer overflow.
- Background layer behind the winner label for contrast agains the lime pointer and violet hub.

### Fixed

- Supurious "Popup blocked" banner that appeared when the user clicked a winner link while a while spin was finishing.

### Changed

- `tsconfig.app.json` and `tsconfig.spec.json` now set an explicit `rootDir` to stop Angular's build from inferring the wrong one.
- Controls, wheel, and entry specs aligned with the current erro-handling and File System Access API permission flow.

## [2026-04-13]

### Added

- Dark-only theme using a Sentry-inspired design system. Tokens in `src/styles/tokens.css`.
- Rubik as the UI font. Monaco for monospace.
- Frosted glass panel, ambient purple glow around the wheel, lime pointer accent
- White-solid CTA treatment on the Spin button.
