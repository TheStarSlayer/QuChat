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
                "/auth": `${env.SERVER_ADDR}/auth`,
                "/api": `${env.SERVER_ADDR}/api`,
                "/socket.io": {
                    target: `${env.SERVER_ADDR}`,
                    ws: true
                }
            }
        }
    });
};