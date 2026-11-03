import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { pathToFileURL } from 'url';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'vercel-serverless-api-dev-middleware',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url.startsWith('/api/v1/')) {
            return next();
          }

          try {
            const urlPath = req.url.split('?')[0];
            
            let relPath = null;
            if (urlPath.startsWith('/api/v1/auth/')) {
              const endpoint = urlPath.replace('/api/v1/auth/', '');
              const handlerMap = {
                'login': 'api/v1/auth/login.js',
                'logout': 'api/v1/auth/logout.js',
                'refresh': 'api/v1/auth/refresh.js',
                'me': 'api/v1/auth/me.js',
                'forgot-password': 'api/v1/auth/forgot-password.js',
                'reset-password': 'api/v1/auth/reset-password.js',
                'change-password': 'api/v1/auth/change-password.js',
              };
              relPath = handlerMap[endpoint];
            } else if (urlPath.startsWith('/api/v1/data')) {
              relPath = 'api/v1/data.js';
            }

            if (!relPath) {
              return next();
            }

            // Parse json body for dev middleware if method is POST/PUT/DELETE
            if (['POST', 'PUT', 'DELETE'].includes(req.method) && !req.body) {
              let bodyStr = '';
              for await (const chunk of req) {
                bodyStr += chunk;
              }
              if (bodyStr) {
                try {
                  req.body = JSON.parse(bodyStr);
                } catch (e) {
                  req.body = {};
                }
              } else {
                req.body = {};
              }
            }

            // Parse query
            const parsedUrl = new URL(req.url, 'http://localhost:5173');
            req.query = Object.fromEntries(parsedUrl.searchParams.entries());

            const absPath = path.resolve(process.cwd(), relPath);
            const fileUrl = `${pathToFileURL(absPath).href}?t=${Date.now()}`;

            const { default: handler } = await import(fileUrl);
            await handler(req, res);
          } catch (err) {
            console.error('[DEV API MIDDLEWARE ERROR]', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: { code: 'DEV_SERVER_ERROR', message: err.message } }));
          }
        });
      },
    },
  ],
});
