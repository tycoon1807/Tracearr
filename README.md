# Tracearr

Streaming access manager for Plex and Jellyfin.

See who's using your server, detect account sharing, and get alerted when something's off.

## Status

In Development - Not ready for use yet.

## Features (Planned)

- **Multi-server support** - Connect Plex and Jellyfin instances
- **Session tracking** - Full history of who watched what, when, from where
- **Sharing detection** - Impossible travel, simultaneous locations, device velocity
- **Real-time alerts** - Discord and webhook notifications
- **Stream mapping** - Visualize where your streams originate
- **Server statistics** - Watch time, top content, user leaderboards

## Tech Stack

- **Frontend**: React 18 + TypeScript + Tailwind + shadcn/ui
- **Backend**: Node.js + TypeScript + Fastify
- **Database**: TimescaleDB + Redis
- **Real-time**: Socket.io
- **Monorepo**: pnpm + Turborepo

## Requirements

- Node.js 20+
- pnpm 9+
- Docker (for local database services)

## Development Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/tracearr.git
cd tracearr
```

2. Install dependencies:
```bash
pnpm install
```

3. Copy environment file and configure:
```bash
cp .env.example .env
```

4. Start database services:
```bash
docker compose -f docker/docker-compose.dev.yml up -d
```

5. Run database migrations:
```bash
pnpm --filter @tracearr/server db:migrate
```

6. Start development servers:
```bash
pnpm dev
```

The frontend will be available at `http://localhost:5173` and the API at `http://localhost:3000`.

## Project Structure

```
tracearr/
├── apps/
│   ├── web/          # React frontend
│   └── server/       # Fastify backend
├── packages/
│   └── shared/       # Shared types and utilities
├── docker/           # Docker configuration
└── docs/             # Documentation
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in development mode |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type check all packages |
| `pnpm test` | Run tests |

## License

AGPL-3.0 - See [LICENSE](LICENSE) for details.
