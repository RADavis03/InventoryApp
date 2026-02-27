const KEY = 'gah_auth_user';
const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function setUser(user) {
  localStorage.setItem(KEY, JSON.stringify({ ...user, lastActivity: Date.now() }));
}

export function clearUser() {
  localStorage.removeItem(KEY);
}

export function isSessionValid() {
  const user = getUser();
  if (!user) return false;
  return Date.now() - user.lastActivity < TIMEOUT_MS;
}

export function touchSession() {
  const user = getUser();
  if (user) {
    localStorage.setItem(KEY, JSON.stringify({ ...user, lastActivity: Date.now() }));
  }
}
