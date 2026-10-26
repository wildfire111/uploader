# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Volunteers and admins running 7PH community events. Volunteers enter tournament results and decklists; an admin reviews them and publishes each deck to Moxfield. Entry usually happens after the tournament is finished. Login is by invitation.
- Judges using Check, who upload a Melee decklist PDF and click through every list to find errors.
- Players using Sideboard as tournament prep, planning their sideboarding before or between matches.

## Product Purpose

thoughtca.st is the toolset for the 7PH community: an Uploader for event results and decklists (publishing to Moxfield), Check for judges, and Sideboard for players. Success is that results get published accurately, judges find decklist errors fast, and players prepare with confidence.

## Capabilities and Constraints

- Pages in scope for the redesign: all of them (home, login, events, event import, admin, Check, Sideboard).
- The site runs on a Next.js version with breaking changes; read `node_modules/next/dist/docs/` before writing code (see AGENTS.md).
- Melee PDFs are read in the browser and never uploaded (Check and import).

## Brand Commitments

- The name "thoughtca.st" stays.
- The top banner background image (`public/navbarbg.png`, art from a Magic: The Gathering card) is the touchstone for the whole design. The wordmark is `public/thoughtcast-logo.png`.
- The whole site should evoke Magic: The Gathering: cards, wizards. Usability comes above all.

## Evidence on Hand

- `public/navbarbg.png` and `public/thoughtcast-logo.png`.
- Earlier critiques in `.impeccable/critique/`.

## Product Principles

- Usability above all; the Magic feel never costs speed or clarity.
- Serve people doing a task (entering results, checking lists, planning), so favour scanability and familiar patterns.
- The banner art is the source of the visual identity.
