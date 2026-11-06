# ChillnGo CLI

`chillngo` is the official command-line tool for the [ChillnGo API](https://chillgo-project-web.vercel.app/developers). Use it to read travel journeys, check-ins and livestreams, sign in, and call any endpoint from a terminal or a script.

## Install

```sh
npm install -g chillngo
# or, without installing
npx chillngo posts
```

You need Node.js 18.3 or newer.

## Commands

```sh
chillngo posts [--author <userId>]   # published journeys, newest first
chillngo post <id>                   # one journey, day by day
chillngo checkins [--authors <ids>]  # recent check-ins (comma-separated author ids)
chillngo live                        # streams live now
chillngo user <id>                   # a public profile
chillngo login --email <email>       # sign in
chillngo me                          # the signed-in account
chillngo logout                      # forget the saved token
chillngo api <METHOD> <path> [--data <json>]   # any endpoint
chillngo openapi                     # the OpenAPI 3.1 description
```

Add `--json` to any command to get the raw JSON response. Errors go to stderr. The exit code is 1 for an API error and 2 for a usage error.

```sh
chillngo posts --json | jq '.items[].title'
chillngo api GET /api/posts/6844e3345b2cd8207816f718
```

## Signing in

`chillngo login --email you@example.com` reads the password from `CHILLNGO_PASSWORD`. If that is not set, it asks for it at a hidden prompt, or reads it from standard input when input is piped. The token is saved in `~/.config/chillngo/config.json` (on Windows, `%APPDATA%\chillngo`), and only your user can read the file. `CHILLNGO_TOKEN` overrides the saved token.

## Configuration

| Variable | Purpose |
| --- | --- |
| `CHILLNGO_API_URL` | API server. Default: `https://chillgo-project.vercel.app`. Same as `--base-url`. |
| `CHILLNGO_TOKEN` | Bearer token to use instead of the saved one. |
| `CHILLNGO_PASSWORD` | Password for `login`. |
| `CHILLNGO_CONFIG_DIR` | Where to keep `config.json`. |

## As a library

```js
import { createClient } from 'chillngo'

const api = createClient({ token: process.env.CHILLNGO_TOKEN })
const { items } = await api.request('GET', '/api/posts')
```

## Development

```sh
cd cli
npm test
node bin/chillngo.js posts --base-url http://localhost:4000
```

Docs: <https://chillgo-project-web.vercel.app/developers/cli> · Source: <https://github.com/HuynhBaHieuu/ChillnGo_Project/tree/master/cli>
