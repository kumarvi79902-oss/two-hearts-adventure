const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

const players = {};

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  players[socket.id] = {
    id: socket.id,
    x: 0,
    y: 1,
    z: 0
  };

  socket.emit("currentPlayers", players);
  socket.broadcast.emit("newPlayer", players[socket.id]);

  socket.on("playerMovement", (position) => {
    if (!players[socket.id]) return;

    players[socket.id] = {
      ...players[socket.id],
      ...position
    };

    socket.broadcast.emit("playerMoved", players[socket.id]);
  });

  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);
    delete players[socket.id];
    io.emit("playerDisconnected", socket.id);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Game server running at http://localhost:${PORT}`);
});