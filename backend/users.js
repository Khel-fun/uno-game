const logger = require('./logger');
const users = []

const addUser = ({id, name, room}) => {
   const numberOfUsersInRoom = users.filter(user => user.room === room).length
   if(numberOfUsersInRoom === 6) {
      logger.info(`Room ${room} is full, user ${id} rejected`);
      return { error: 'Room full' };
   }

   const newUser = { id, name, room };
   users.push(newUser);
   logger.info(`User ${id} added to room ${room} as ${name}`);
   return { newUser };
}

const removeUser = id => {
   const removeIndex = users.findIndex(user => user.id === id);

   if(removeIndex!==-1) {
       const removedUser = users.splice(removeIndex, 1)[0];
       logger.info(`User ${id} removed from room ${removedUser.room}`);
       return removedUser;
   }
   logger.debug(`Attempted to remove non-existent user ${id}`);
   return null;
}

const getUser = id => {
   return users.find(user => user.id === id)
}

const getUsersInRoom = room => {
   return users.filter(user => user.room === room)
}

module.exports = { addUser, removeUser, getUser, getUsersInRoom }