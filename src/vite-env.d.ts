/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** wss:// address of a Spotlight room server. Unset in a static deploy, which then works solo. */
  readonly VITE_COLLAB_URL?: string
}
