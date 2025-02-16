// utils/users.js
const users = [];

//deneme 33


function userJoin(id, username, room) {
  const user = { id, username, room ,isTyping: false  };//is typing eklendi
  users.push(user);
  return user;
}

function getCurrentUser(id) {
  return users.find((user) => user.id === id);
}

function userLeave(id) {
  const index = users.findIndex((user) => user.id === id);
  if (index !== -1) {
    return users.splice(index, 1)[0];
  }
}

function getRoomUsers(room) {
  return users.filter((user) => user.room === room);
}
function getActiveUserCount() {
  return users.length;
}

module.exports = {
  userJoin,
  getCurrentUser,
  userLeave,
  getRoomUsers,
  getActiveUserCount, 
};

