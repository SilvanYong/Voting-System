const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);

app.use(express.static(__dirname + '/public'));

// 存储会话、用户、投票等状态
const sessions = {}; // { sessionName: { creatorId, users: {socketId: {name, state, abstainCount, voted}}, topic: null, votes: {} } }

io.on('connection', socket => {
  // 新用户上线，发送当前在线用户列表
  io.emit('onlineUsers', Object.keys(io.sockets.sockets));

  // 创建会话
  socket.on('createSession', ({ sessionName, userName }) => {
    sessions[sessionName] = {
      creatorId: socket.id,
      users: { [socket.id]: { name: userName, state: 'creator', abstainCount: 0, voted: false } },
      topic: null,
      votes: { agree: 0, oppose: 0, abstain: 0 }
    };
    socket.join(sessionName);
    socket.emit('sessionCreated', sessionName);
  });

  // 发送邀请
  socket.on('inviteUsers', ({ sessionName, invitees }) => {
    invitees.forEach(id => {
      io.to(id).emit('receiveInvite', { from: sessions[sessionName].users[socket.id].name, sessionName });
    });
  });

  // 接受邀请
  socket.on('acceptInvite', ({ sessionName, userName }) => {
    socket.join(sessionName);
    sessions[sessionName].users[socket.id] = { name: userName, state: 'invitee', abstainCount: 0, voted: false };
    io.to(sessions[sessionName].creatorId).emit('inviteAccepted', { socketId: socket.id, userName });
  });

  // 开始会话
  socket.on('startSession', sessionName => {
    io.to(sessionName).emit('sessionStarted');
  });

  // 发起议题
  socket.on('newTopic', ({ sessionName, topic }) => {
    sessions[sessionName].topic = topic;
    io.to(sessionName).emit('topicCreated', topic);
  });

  // 接收投票
  socket.on('vote', ({ sessionName, voteType }) => {
    const user = sessions[sessionName].users[socket.id];
    if (voteType === 'abstain') {
      user.abstainCount++;
    }
    sessions[sessionName].votes[voteType]++;
    user.voted = true;

    // 检查是否所有人已投（排除发起人）
    const totalVoters = Object.values(sessions[sessionName].users).filter(u => u.state === 'invitee').length;
    const votedCount = Object.values(sessions[sessionName].users).filter(u => u.state === 'invitee' && u.voted).length;
    if (votedCount === totalVoters) {
      // 发送结果给发起人
      io.to(sessions[sessionName].creatorId).emit('voteResult', sessions[sessionName].votes);
    }
  });

  // 结束会话
  socket.on('endSession', sessionName => {
    io.to(sessionName).emit('sessionEnded');
    delete sessions[sessionName];
  });
});

server.listen(3000, () => console.log('Server running on http://localhost:3000'));