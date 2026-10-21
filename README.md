# paper.ly

Get the latest *n* papers on a topic, sorted by date, relevance, or investigator location, and filtered by country (any / first / last author). Data comes from [OpenAlex](https://openalex.org).

- **Follow** searches (stored in your browser); unseen papers get a NEW badge.
- **Atom feed** for every search at `/api/feed?q=...` for your feed reader.

## Run

    cp .env.example .env.local   # add OPENALEX_API_KEY (free)
    npm install && npm run dev

## Deploy (Vercel)

Import the repo and set `OPENALEX_API_KEY` (and optionally `OPENALEX_MAILTO`). No database needed; results are cached for 1 hour. Any Node host works with `npm run build && npm start`.
