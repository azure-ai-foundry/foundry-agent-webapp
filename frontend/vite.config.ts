import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve, dirname } from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  // Load from azd environment if exists, otherwise fall back to frontend directory
  const azdEnvPath = resolve(__dirname, "../.azure");
  const envName = process.env.ENVIRONMENT_NAME || process.env.AZURE_ENV_NAME || "localdev";
  const envDir = existsSync(resolve(azdEnvPath, envName, ".env"))
    ? resolve(azdEnvPath, envName)
    : __dirname;

  const env = loadEnv(mode, envDir, "");
  
  // Map to VITE_ prefixed vars for client access (Vite only exposes VITE_ prefixed vars)
  process.env.VITE_ENTRA_SPA_CLIENT_ID = env.ENTRA_SPA_CLIENT_ID || env.VITE_ENTRA_SPA_CLIENT_ID;
  process.env.VITE_ENTRA_TENANT_ID = env.ENTRA_TENANT_ID || env.VITE_ENTRA_TENANT_ID;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "~": resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: "http://localhost:8080",
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
