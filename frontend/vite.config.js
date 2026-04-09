import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default ({ mode }) => {
    const env = loadEnv(mode, process.cwd());

    return defineConfig({
        plugins: [react(), tailwindcss()],
        server: { 
            port: 8595,
            proxy: {
                "/auth": {
                    target: "http://localhost:8596",
                    changeOrigin: true
                },
                "/api": {
                    target: "http://localhost:8596",
                    changeOrigin: true
                },
                "/socket.io": {
                    target: "http://localhost:8596",
                    ws: true,
                    changeOrigin: true
                }
            }
        }
    });
};