# Data

Store only small, non-sensitive development fixtures here. Local SQLite database files are ignored by Git.

Document every dataset's source, license, date, field meanings, quality issues, and any personal-data handling in a separate Markdown file. Commit derived samples only when sharing them is lawful and necessary.

## `simulator.json`

- Source: organizer-provided Google Doc, “Датасет районов”, supplied for the HackAlem case.
- Imported: 2026-09-23.
- Mode: `SAMPLE`; synthetic demo data only, with no personal information.
- Contents: five districts, ten normalized indicators, fourteen initiatives, costs,
  lags, effects, synergies, incompatibilities, and global simulation rules.
- Scale: every indicator is 0–100 and higher is always better.
- Quality check: indicator weights and population shares each sum to 1; the exact
  calculated baseline is 52.5577, matching the published rounded value 52.56.
