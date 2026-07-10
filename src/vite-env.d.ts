/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_DEMO_SEED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
