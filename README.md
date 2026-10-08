# Spotlight

A deck for showing work, one project per slide, with its author and impact.

- **Weekly spotlight**: one session per week, with progress tracked across weeks (projects shown, people featured, appreciation).
- **Masterclass**: guided tutorials and guest lectures built from step slides (an instruction, a prompt to copy, a tip and a live demo), narrated live.
- **Present mode**: live sessions others can join and follow, emoji reactions, appreciation for authors, and a chat panel with stickers and images.
- **Multiplayer**: shared editing, cursors, presence and follow mode.

Built with Vite, React 19, Tailwind v4 and [Lightweight UI](https://github.com/ayaneshu/lightweight-ui-kit).

## Run it

```bash
npm install
npm run dev   # http://localhost:5360, plus the room server at /collab
```

`npm run dev` also runs the multiplayer room inside the Vite server (`server/collab.ts`). Everyone who opens the same address joins the same library, and it is saved to `data/library.json` (not committed). Vite listens on your network too, so teammates on the same Wi-Fi can join with the address that **Invite** copies.

## Deployed copies

A static build (`npm run build`, e.g. on Vercel) has no room server of its own. It runs in **Solo** mode and saves to each viewer's browser. To make a deployed copy live, run `server/collab.ts` somewhere that keeps WebSockets open and build with:

```bash
VITE_COLLAB_URL=wss://your-room-server.example/collab npm run build
```
