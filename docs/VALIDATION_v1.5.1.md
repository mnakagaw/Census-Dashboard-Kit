# Validation record — 1.5.1

Date: 2026-09-16 (Asia/Tokyo)

Scope: stability fixes for national map rendering, thematic comparison geography, and map zoom-out.

## Automated validation

- `npm run check`
- `npm test`
- `node scripts/validate-country.mjs --project <lao-sample>`
- `node scripts/verify-delivery.mjs --project <lao-sample>`

## Browser regressions

- A national territorial URL renders without dereferencing a missing parent.
- Selecting Oudomxai as the comparison area changes the displayed level to ADM2, keeps the map fitted to Oudomxai, and reports 0 of 7 observations for a literacy indicator that has no ADM2 values.
- Changing the indicator to 2024 population keeps Oudomxai and ADM2, then displays 7 of 7 district observations.
- Changing the comparison area to Louangnamtha keeps ADM2, fits the map to Louangnamtha, and displays 5 of 5 district observations.
- Map zoom changes from 100% to 75% to 50%; the minus control disables only at 50%, and scope changes reset the view to 100%.

Public verification and the exact Git commit are recorded in the Lao sample delivery evidence after deployment.
