import { atom, selector } from 'recoil';

// Define the atom for storing the user's account address
export const userAccountState = atom<string | null>({
  key: 'userAccountState', // unique ID (with respect to other atoms/selectors)
  default: null, // default value (initial value)
});

// Selector to check if user is connected
export const isUserConnectedState = selector({
  key: 'isUserConnectedState',
  get: ({ get }) => {
    const account = get(userAccountState);
    return !!account; // Returns true if account exists and is not null
  },
});

// Helper functions to interact with the state
export const getUserAccount = (get: any) => get(userAccountState);
