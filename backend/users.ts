import logger from './logger';

interface User {
  id: string;
  name: string;
  room: string;
}

interface AddUserResult {
  error?: string;
  newUser?: User;
}

const users: User[] = [];

const addUser = ({ id, name, room }: { id: string; name: string; room: string }): AddUserResult => {
  const numberOfUsersInRoom = users.filter(user => user.room === room).length;
  if (numberOfUsersInRoom === 6) {
    logger.info(`Room ${room} is full, user ${id} rejected`);
    return { error: 'Room full' };
  }

  const newUser: User = { id, name, room };
  users.push(newUser);
  logger.info(`User ${id} added to room ${room} as ${name}`);
  return { newUser };
};

const removeUser = (id: string): User | null => {
  const removeIndex = users.findIndex(user => user.id === id);

  if (removeIndex !== -1) {
    const removedUser = users.splice(removeIndex, 1)[0];
    logger.info(`User ${id} removed from room ${removedUser.room}`);
    return removedUser;
  }
  logger.debug(`Attempted to remove non-existent user ${id}`);
  return null;
};

const getUser = (id: string): User | undefined => {
  return users.find(user => user.id === id);
};

const getUsersInRoom = (room: string): User[] => {
  return users.filter(user => user.room === room);
};

export { addUser, removeUser, getUser, getUsersInRoom, User };
