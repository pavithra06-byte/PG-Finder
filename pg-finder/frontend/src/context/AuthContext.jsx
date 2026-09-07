import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, { errMsg } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("pgf_user") || "null"); } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem("pgf_token"));
  const [loading, setLoading] = useState(true);

  const announceSignedOut = useCallback(() => {
    window.dispatchEvent(new Event("pgf:signed-out"));
  }, []);

  useEffect(() => {
    if (token) {
      api
        .get("/auth/me")
        .then((r) => setUser(r.data.data))
        .catch(() => {
          setUser(null); setToken(null);
          localStorage.removeItem("pgf_token"); localStorage.removeItem("pgf_user");
          announceSignedOut();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token, announceSignedOut]);

  const setSession = useCallback((t, u) => {
    localStorage.setItem("pgf_token", t);
    localStorage.setItem("pgf_user", JSON.stringify(u));
    setToken(t);
    setUser(u);
  }, []);

  const login = useCallback(async (email, password) => {
    const r = await api.post("/auth/login", { email, password });
    setSession(r.data.data.token, r.data.data.user);
    return r.data.data.user;
  }, [setSession]);

  const register = useCallback(async (payload) => {
    const r = await api.post("/auth/register", payload);
    setSession(r.data.token, r.data.user);
    return r.data.user;
  }, [setSession]);

  const googleLogin = useCallback(async (payload) => {
    const r = await api.post("/auth/google", payload);
    setSession(r.data.data.token, r.data.data.user);
    return r.data.data.user;
  }, [setSession]);

  const logout = useCallback(() => {
    localStorage.removeItem("pgf_token");
    localStorage.removeItem("pgf_user");
    setToken(null);
    setUser(null);
    announceSignedOut();
  }, [announceSignedOut]);

  const updateUser = useCallback((u) => {
    setUser(u);
    localStorage.setItem("pgf_user", JSON.stringify(u));
  }, []);

  const refreshUser = useCallback(async () => {
    const r = await api.get("/auth/me");
    setUser(r.data.data);
    localStorage.setItem("pgf_user", JSON.stringify(r.data.data));
    return r.data.data;
  }, []);

  const value = { user, token, loading, login, register, googleLogin, logout, updateUser, refreshUser, errMsg };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
