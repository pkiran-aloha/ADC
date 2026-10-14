import { createContext, useContext } from 'react';

export const FeedbackContext = createContext(() => {});
export function useFeedback() { return useContext(FeedbackContext); }
