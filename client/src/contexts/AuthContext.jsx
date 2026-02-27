import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getUser, setUser, clearUser, isSessionValid, touchSession } from '../lib/auth.js';
import * as api from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [hasUsers, setHasUsers] = useState(null); // null = still loading
  const [loading, setLoading] = useState(true);

  // Load initial state
  useEffect(() => {
    api.users.list().then(users => {
      setHasUsers(users.length > 0);
      if (users.length > 0 && isSessionValid()) {
        setCurrentUser(getUser());
      }
    }).catch(() => {
      setHasUsers(false);
    }).finally(() => setLoading(false));
  }, []);

  // Inactivity timer — checks every 30s, logs out if session expired
  useEffect(() => {
    if (!currentUser) return;

    const EVENTS = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    const touch = () => touchSession();
    EVENTS.forEach(e => window.addEventListener(e, touch, { passive: true }));

    const interval = setInterval(() => {
      if (!isSessionValid()) logout();
    }, 30_000);

    return () => {
      EVENTS.forEach(e => window.removeEventListener(e, touch));
      clearInterval(interval);
    };
  }, [currentUser]);

  const login = useCallback((user) => {
    setUser(user);
    setCurrentUser(user);
    setHasUsers(true);
  }, []);

  const logout = useCallback(() => {
    clearUser();
    setCurrentUser(null);
  }, []);

  // Called after a user is added on the Users page so hasUsers updates
  const refreshHasUsers = useCallback((val) => {
    setHasUsers(val);
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, hasUsers, loading, login, logout, refreshHasUsers }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
