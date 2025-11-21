const logger = require('./logger');
const users = []

const addUser = ({id, name, room, address}) => {
   const numberOfUsersInRoom = users.filter(user => user.room === room && user.connected !== false).length
   if(numberOfUsersInRoom === 6) {
      logger.info(`Room ${room} is full, user ${id} rejected`);
      return { error: 'Room full' };
   }

   // Check if user is reconnecting (same name in same room OR same address in same room)
   let existingUser = users.find(u => u.name === name && u.room === room && u.connected === false);

   // If not found by name, try by address (for page refresh scenarios)
   if (!existingUser && address) {
      existingUser = users.find(u => u.address === address && u.room === room && u.connected === false);
   }

   if (existingUser) {
      // User is reconnecting, update their socket ID
      existingUser.id = id;
      existingUser.connected = true;
      existingUser.disconnectedAt = null;
      if (address && !existingUser.address) {
         existingUser.address = address;
      }
      logger.info(`User ${name} reconnected to room ${room} with new socket ${id}`);
      return { newUser: existingUser, reconnected: true };
   }

   const newUser = { id, name, room, address, connected: true, disconnectedAt: null };
   users.push(newUser);
   logger.info(`User ${id} added to room ${room} as ${name} with address ${address}`);
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

// Mark user as disconnected instead of removing immediately
const markUserDisconnected = id => {
   const user = users.find(user => user.id === id);
   if (user) {
      user.connected = false;
      user.disconnectedAt = Date.now();
      logger.info(`User ${id} marked as disconnected in room ${user.room}`);
      return user;
   }
   return null;
}

// Clean up users who have been disconnected for too long
const cleanupDisconnectedUsers = (maxDisconnectTime = 60000) => {
   const now = Date.now();
   const toRemove = users.filter(user => 
      user.connected === false && 
      user.disconnectedAt && 
      (now - user.disconnectedAt) > maxDisconnectTime
   );
   
   toRemove.forEach(user => {
      const index = users.findIndex(u => u.id === user.id);
      if (index !== -1) {
         users.splice(index, 1);
         logger.info(`Cleaned up disconnected user ${user.id} from room ${user.room}`);
      }
   });
   
   return toRemove;
}

// Find user by name and room (for reconnection)
const findUserByNameAndRoom = (name, room) => {
   return users.find(user => user.name === name && user.room === room);
}

// Find user by address and room (for reconnection after page refresh)
const findUserByAddressAndRoom = (address, room) => {
   if (!address) return null;
   return users.find(user => user.address === address && user.room === room);
}

const getUser = id => {
   return users.find(user => user.id === id)
}

const getUsersInRoom = room => {
   return users.filter(user => user.room === room)
}

module.exports = {
   addUser,
   removeUser,
   getUser,
   getUsersInRoom,
   markUserDisconnected,
   cleanupDisconnectedUsers,
   findUserByNameAndRoom,
   findUserByAddressAndRoom
}