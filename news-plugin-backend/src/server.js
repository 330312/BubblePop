import http from 'node:http';
import { createApp } from './app.js';

const app = createApp();
const port = Number(process.env.PORT || 8787);

const server = http.createServer(app);
server.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
});
