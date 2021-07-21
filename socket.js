// const WebSocket = require('ws');

// module.exports = (server) => {
//   const wss = new WebSocket.Server({ server });

//   wss.on('connection', (ws, req) => {
//     const ip = req.headers['x-forward-for'] || req.connection.remoteAddress;
//     console.log('새로운 클라이언트 접속', ip);
//     ws.on('message', (message) => {
//       console.log(message);
//     });
//     ws.on('error', (error) => {
//       console.error(error);
//     });
//     ws.on('close', () => {
//       consloe.log('클라이언트 접속 해제', ip);
//       clearInterval(ws.interval);
//     });
//     ws.interval = setInterval(() => {
//       if (ws.readyState === ws.OPEN) {
//         ws.send('서버에서 클라이언트로 메시지를 보냅니다.');
//       }
//     }, 3000);
//   });
// };

const SocketIO = require('socket.io');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const cookie = require('cookie-signature');

module.exports = (server, app, sessionMiddleware) => {
  const io = SocketIO(server, { path: '/socket.io' });
  app.set('io', io);
  const room = io.of('/room');
  const chat = io.of('/chat');

  io.use((socket, next) => {
    cookieParser(process.env.COOKIE_SECRET)(socket.request, socket.request.res, next);
    // sessionMiddleware(socket.request, socket.request.res, next);
    sessionMiddleware(socket.request, {}, next);
  });

  room.on('connection', (socket) => {
    console.log('room 네임스페이스에 접속');
    socket.on('disconnect', () => {
      console.log('room 네임스페이스 접속 해제');
    });
  });

  chat.on('connection', (socket) => {
    console.log('chat 네임스페이스에 접속');
    const req = socket.request;
    const { headers: { referer } } = req;
    const roomId = referer
      .split('/')[referer.split('/').length - 1]
      .replace(/\?.+/, '');
    socket.join(roomId);
    socket.to(roomId).emit('join', {
      user: 'system',
      chat: `${req.session.color}님이 입장하셨습니다.`,
    });

    socket.on('disconnect', () => {
      console.log('chat 네임스페이스 접속 해제');
      socket.leave(roomId);
      const currentRoom = socket.adapter.rooms[roomId];
      const userCount = currentRoom ? currentRoom.length : 0;
      if (userCount === 0) { // 유저가 0명이면 방 삭제
        const signedCookie = cookie.sign(req.signedCookies['connect.sid'], process.env.COOKIE_SECRET);
        const connectSID = `${signedCookie}`;
        axios.delete(`http://localhost:8005/room/${roomId}`, {
          headers: {
            Cookie: `connect.sid=s%3A${connectSID}`
          }
        })
          .then(() => {
            console.log('방 제거 요청 성공');
          })
          .catch((error) => {
            console.error(error);
          });
      } else {
        socket.to(roomId).emit('exit', {
          user: 'system',
          chat: `${req.session.color}님이 퇴장하셨습니다.`,
        });
      }
    });
  });
};

  // io.on('connection', (socket) => { // 웹소켓 연결 시
  //   const req = socket.request;
  //   const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  //   console.log('새로운 클라이언트 접속!', ip, socket.id, req.ip);

  //   socket.on('error', (error) => { // 에러 시
  //     console.error(error);
  //   });
  //   socket.on('reply', (data) => { // 클라이언트로부터 메시지
  //     console.log(data);
  //   });
  //   socket.interval = setInterval(() => { // 3초마다 클라이언트로 메시지 전송
  //     socket.emit('news', 'Hello Socket.IO');
  //   }, 3000);
  // });