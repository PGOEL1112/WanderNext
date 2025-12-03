const socket = io();

// join a room (call on page load with room id)
function joinRoom(room) { socket.emit('joinRoom', room); }
function leaveRoom(room) { socket.emit('leaveRoom', room); }

function sendMessage(room, msg, meta={}) {
  socket.emit('chatMessage', { room, msg, meta });
}

socket.on('chatMessage', data => {
  // implement UI insertion: e.g. append to messages list
  console.log('chatMessage', data);
});
