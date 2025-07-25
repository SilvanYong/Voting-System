const socket = io();
const app = document.getElementById('app');
let currentSession = null;
let userName = prompt('请输入您的用户名：', '用户' + Math.floor(Math.random() * 1000));

// 初始按钮事件
app.addEventListener('click', e => {
  if (e.target.id === 'btn-create') showCreateSession();
  if (e.target.id === 'btn-join') showJoinSession();
});

// 渲染: 创建会话
function showCreateSession() {
  app.innerHTML = `
    <div class="mt-5">
      <input id="session-name" class="form-control mb-3" placeholder="输入会话名称">
      <div id="online-list" class="mb-3"></div>
      <button id="send-invite" class="btn btn-success">发送邀请</button>
      <button id="start-session" class="btn btn-primary ms-3">开始会话</button>
      <button id="end-session" class="btn btn-outline-dark position-absolute" style="top:10px; right:10px;">结束会话</button>
    </div>
  `;

  // 在线用户列表
  socket.on('onlineUsers', list => renderOnlineList(list));
  // 邀请接受
  socket.on('inviteAccepted', ({ socketId, userName }) => updateInviteStatus(socketId, userName));

  document.getElementById('send-invite').onclick = () => {
    const name = document.getElementById('session-name').value;
    currentSession = name;
    socket.emit('createSession', { sessionName: name, userName });
    const checkboxes = document.querySelectorAll('#online-list input:checked');
    const invitees = Array.from(checkboxes).map(cb => cb.value);
    socket.emit('inviteUsers', { sessionName: name, invitees });
  };
  document.getElementById('start-session').onclick = () => socket.emit('startSession', currentSession);
  document.getElementById('end-session').onclick = () => socket.emit('endSession', currentSession);

  // 会话结束
  socket.on('sessionEnded', () => location.reload());
  // 会话开始时其他人
  socket.on('sessionStarted', () => renderWaitingTopic());
  // 收到议题
  socket.on('topicCreated', topic => renderVoting(topic));
  // 投票结果
  socket.on('voteResult', votes => renderResult(votes));
}

// 渲染在线列表
function renderOnlineList(list) {
  const div = document.getElementById('online-list');
  div.innerHTML = list.filter(id => id !== socket.id).map(id => `
    <div><input type="checkbox" value="${id}"> ${id} <span id="status-${id}" class="text-warning">邀请中</span></div>
  `).join('');
}

function updateInviteStatus(id, name) {
  const span = document.getElementById(`status-${id}`);
  span.textContent = name + ' 已同意';
  span.className = 'text-success';
}

// 渲染: 等待议题
function renderWaitingTopic() {
  app.innerHTML = `<div class="text-center mt-5"><h4>等待会话发起人创建议题...</h4></div>`;
}

// 渲染: 投票
function renderVoting(topic) {
  const canAbstain = true; // 后端也限制两次，此处简化
  app.innerHTML = `
    <div class="text-center mt-5">
      <h4>议题：${topic}</h4>
      <div class="d-flex justify-content-around mt-4">
        <button id="btn-agree"   class="btn btn-success vote-btn">同意</button>
        <button id="btn-oppose"  class="btn btn-danger  vote-btn">反对</button>
        ${canAbstain ? '<button id="btn-abstain" class="btn btn-warning vote-btn">弃权</button>' : ''}
      </div>
    </div>
  `;
  document.getElementById('btn-agree').onclick  = () => vote('agree');
  document.getElementById('btn-oppose').onclick = () => vote('oppose');
  if (canAbstain) document.getElementById('btn-abstain').onclick = () => vote('abstain');
}

function vote(v) {
  socket.emit('vote', { sessionName: currentSession, voteType: v });
  app.innerHTML = `<div class="text-center mt-5"><h4>投票已提交，请等待...</h4></div>`;
}

// 渲染: 结果
function renderResult({ agree, oppose, abstain }) {
  app.innerHTML = `
    <div class="text-center mt-5">
      <h4>投票结果</h4>
      <p class="text-success">同意：${agree} 人</p>
      <p class="text-danger">反对：${oppose} 人</p>
      <p class="text-warning">弃权：${abstain} 人</p>
    </div>
  `;
}