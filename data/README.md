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

## `frontend/public/data/astana-districts.geojson`

- Source: reused from the Astana Aqua Ops baseline repository, whose provenance
  points to the published Astana architecture GIS district layer:
  `https://gis.esaulet.kz/server/rest/services/Hosted/raiony/FeatureServer/0`.
- Imported: 2026-09-23.
- Contents: six Astana district polygons. Five are mapped to the current simulator;
  Saraishyk is rendered only as geographic context because it has no synthetic
  indicators in `simulator.json`.
- Quality limitation: publication date, present-day boundary accuracy, and the
  upstream layer's reuse license were not independently verified. The UI discloses
  this and must not describe the boundaries as official or current.
- Privacy: polygon geometry only; no personal data.

## `frontend/public/images/astana-hero.jpg`

- Source: original image generated for MeysQosAI with OpenAI image generation.
- Created: 2026-09-23.
- Contents: a stylized blue-hour Astana skyline centered on Baiterek, with no text,
  logos, or identifiable people.
- Purpose: local decorative hero image that makes the Astana-only scope immediate.
