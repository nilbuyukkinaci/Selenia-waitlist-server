# Waitlist server

Tiny Node/Express server that receives an email from the site's waitlist form,
validates it, and appends it to `waitlist.xlsx` (one row per person).

## Why a separate server?

Your `index.html` has a `CNAME` file next to it, which means the site is
static (e.g. GitHub Pages). Static hosting can't write files, so writing to
an Excel file needs a small always-on server somewhere. This folder is that
server — it's separate from your site's repo/deploy.

## Run it locally

```bash
cd waitlist-server
npm install
npm start
```

This starts the server on `http://localhost:3001` and creates `waitlist.xlsx`
in this folder the first time someone signs up.

Test it:

```bash
curl -X POST http://localhost:3001/api/waitlist \
  -H "Content-Type: application/json" \
  -d '{"email":"someone@example.com"}'
```

## Deploy it

Since GitHub Pages only serves static files, deploy this folder to a small
host that can run Node, e.g. Render, Railway, Fly.io, or any VPS. Free tiers
on Render/Railway work fine for a waitlist. Steps are the same everywhere:
push this folder, set the start command to `npm start`, and note the public
URL it gives you (e.g. `https://selenia-waitlist.onrender.com`).

**Important:** most of these hosts wipe the local filesystem on redeploy, so
`waitlist.xlsx` won't survive updates to the server code. That's fine while
you're just collecting waitlist signups, but download the file periodically,
or swap in a persistent disk / database later if you need long-term storage.

## Connect it to your site

In `index.html`, find this line near the bottom (`<script>` block, waitlist
section) and set it to your deployed URL:

```js
var WAITLIST_API='https://your-waitlist-server.example.com/api/waitlist';
```

That's it — the form already POSTs `{ email }` to that URL, shows "Please
enter a valid email address." for bad input, and shows the success state
once the server confirms the email was saved.

## What gets stored

`waitlist.xlsx` has two columns: `Email` and `Signed up at (UTC)`. Duplicate
emails are recognized and not added twice (the request still returns
success so the visitor doesn't see an error).
