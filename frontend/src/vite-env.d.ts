/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RPC_URL?: string;
  readonly VITE_CAJO_ADDRESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
