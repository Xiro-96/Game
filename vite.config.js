import os from "node:os";
import { defineConfig } from "vite";

function lanAddress() {
  const nets = os.networkInterfaces();
  for (const addrs of Object.values(nets)) {
    for (const a of addrs || []) {
      if (a.family === "IPv4" && !a.internal) return a.address;
    }
  }
  return null;
}

const lan = lanAddress();

export default defineConfig({
  base: "./",
  define: {
    __LAN_URL__: JSON.stringify(lan ? `http://${lan}:5173` : ""),
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
  },
});
