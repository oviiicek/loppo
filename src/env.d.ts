/** the game's name, version and address from package.json (set by vite.config.ts) */
declare const __APP_NAME__: string;
declare const __APP_VERSION__: string;
declare const __APP_URL__: string;
/** the payment server of the web version and the public key its grants are signed with (package.json "store") */
declare const __STORE__: { api: string; publicKey: JsonWebKey | null };
