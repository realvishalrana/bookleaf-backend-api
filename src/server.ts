import http from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { initSocket } from "./services/realtime/socket";

const app = createApp();
const server = http.createServer(app);

initSocket(server);

server.listen(env.PORT, () => {
  console.log(`BookLeaf API running on http://localhost:${env.PORT}`);
  console.log(`API docs: http://localhost:${env.PORT}/api/docs`);
});
