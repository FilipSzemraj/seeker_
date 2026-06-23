# FlatSearcher

A web app for finding rental flats in Poland from a single, clean interface.

It brings listings together into one consistent format and lets you search them two ways from the same screen:

- **Conversational search** — ask in plain language and get a grounded answer with the matching listings.
- **Structured search** — apply exact filters (price, size, rooms, location, and more) over the catalogue.

Both paths render into one shared results grid. Each listing card links out to the original offer.

Built with Angular 22 (standalone components, signals) and deployed as a static site on GitHub Pages.

## Development

```bash
npm install
npm start      # dev server at http://localhost:4200/
npm run build  # production build into dist/
npm test       # unit tests
```
