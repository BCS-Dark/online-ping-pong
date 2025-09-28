const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Храним комнаты: { roomID: [player1, player2] }
const rooms = {};

app.use(express.static('public'));

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    
    if (msg.type === 'join') {
      const { room } = msg;
      if (!rooms[room]) rooms[room] = [];
      
      if (rooms[room].length < 2) {
        rooms[room].push(ws);
        ws.room = room;
        ws.player = rooms[room].length; // 1 или 2
        
        // Отправляем игроку его номер
        ws.send(JSON.stringify({ type: 'player', num: ws.player }));
        
        // Если комната полная — начинаем игру
        if (rooms[room].length === 2) {
          rooms[room].forEach(client => {
            client.send(JSON.stringify({ type: 'start' }));
          });
        }
      } else {
        ws.send(JSON.stringify({ type: 'error', msg: 'Комната заполнена' }));
      }
    }
    
    if (msg.type === 'paddle') {
      const room = ws.room;
      if (rooms[room]) {
        // Пересылаем позицию ракетки другому игроку
        rooms[room].forEach(client => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'paddle',
              player: ws.player,
              y: msg.y
            }));
          }
        });
      }
    }
    
    if (msg.type === 'ball') {
      const room = ws.room;
      if (rooms[room]) {
        rooms[room].forEach(client => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'ball',
              x: msg.x,
              y: msg.y,
              dx: msg.dx,
              dy: msg.dy
            }));
          }
        });
      }
    }
  });

  ws.on('close', () => {
    if (ws.room) {
      const room = rooms[ws.room];
      if (room) {
        const index = room.indexOf(ws);
        if (index !== -1) room.splice(index, 1);
        // Уведомить оставшегося игрока
        room.forEach(client => {
          client.send(JSON.stringify({ type: 'opponent-left' }));
        });
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});