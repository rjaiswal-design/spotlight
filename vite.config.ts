import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import type { Server } from 'node:http'
import { attachCollab } from './server/collab.ts'

/** Runs the multiplayer room on the same port as the app, at /collab. */
function collab(): Plugin {
  const dir = path.resolve('data')
  return {
    name: 'spotlight-collab',
    configureServer(server) {
      if (server.httpServer) attachCollab(server.httpServer as Server, dir)
    },
    configurePreviewServer(server) {
      attachCollab(server.httpServer as Server, dir)
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), collab()],
  server: { port: 5360, strictPort: true, host: true },
  preview: { port: 5360, host: true },
})
