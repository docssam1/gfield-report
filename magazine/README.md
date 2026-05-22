# GFIELD Magazine

GFIELD Magazine converts search results, news summaries, and source notes into magazine-style HTML content using Gemini.

## Local Run

1. Install Node.js.
2. Copy `personal-gemini-proxy/.env.example` to `personal-gemini-proxy/.env`.
3. Put your Gemini key in `.env`.
4. Run `run-gfield-magazine.bat`, or run:

```bash
cd personal-gemini-proxy
npm start
```

Open `http://localhost:8787`.

## Security

- Do not commit `personal-gemini-proxy/.env`.
- `personal-gemini-proxy/.gitignore` excludes `.env`.
- For GitHub Actions or cloud deployment, save the key as a repository secret named `GEMINI_API_KEY`.
- The browser calls the local proxy only. The Gemini key stays on the server side.

