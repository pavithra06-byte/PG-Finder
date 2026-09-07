import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext.jsx";
import { useToast } from "./ToastContext.jsx";

const SocketContext = createContext(null);


export function SocketProvider({ children }) {
  const { user, token } = useAuth();
  const toast = useToast();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [msgBadge, setMsgBadge] = useState(0);
  const [lastEvent, setLastEvent] = useState(null); // {event, data, ts}
  const handlers = useRef({});

  const on = useCallback((event, fn) => {
    handlers.current[event] = fn;
  }, []);

  useEffect(() => {
    if (!user || !token) {
      if (socket) { socket.disconnect(); setSocket(null); setConnected(false); }
      return;
    }
    const s = io("/", {
      path: "/socket.io",
      transports: ["polling", "websocket"],
      auth: { token },
      query: { token },
    });
    setSocket(s);
    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));

    for (const ev of ["booking:new", "booking:accepted", "booking:rejected", "booking:cancelled", "booking:updated", "booking:completed",
      "visit:new", "visit:accepted", "visit:rescheduled", "visit:rejected",
      "enquiry:new", "enquiry:reply", "availability:updated"]) {
      s.on(ev, (data) => {
        setLastEvent({ event: ev, data, ts: Date.now() });
        if (handlers.current[ev]) handlers.current[ev](data);
      });
    }

    s.on("message:new", (data) => {
      setMsgBadge((b) => b + 1);
      setLastEvent({ event: "message:new", data, ts: Date.now() });
      showRealtimeNotification(toast, "New message", data.preview || "You have a new message", data.link);
      if (handlers.current["message:new"]) handlers.current["message:new"](data);
    });
    s.on("notification:new", (data) => {
      setLastEvent({ event: "notification:new", data, ts: Date.now() });
      showRealtimeNotification(toast, data.title || "New update", data.body || "You have a new update", data.link);
      if (handlers.current["notification:new"]) handlers.current["notification:new"](data);
    });
    s.on("message:receive", (data) => {
      if (handlers.current["message:receive"]) handlers.current["message:receive"](data);
    });
    s.on("message:typing", (data) => {
      if (handlers.current["message:typing"]) handlers.current["message:typing"](data);
    });
    s.on("message:read", (data) => {
      if (handlers.current["message:read"]) handlers.current["message:read"](data);
    });
    s.on("user:online", (d) => setOnlineUsers((u) => ({ ...u, [d.userId]: true })));
    s.on("user:offline", (d) => setOnlineUsers((u) => ({ ...u, [d.userId]: false })));
    s.on("location:updated", (d) => {
      if (handlers.current["location:updated"]) handlers.current["location:updated"](d);
    });

    refreshCounts();
    return () => { s.disconnect(); };
  }, [user?.id, token]);

  const refreshCounts = useCallback(async () => {
    try {
      const api = (await import("../api/client")).default;
      const r = await api.get("/notifications/unread-count");
      setMsgBadge(r.data.data.messages);
    } catch {  }
  }, []);

  const emit = useCallback((event, data) => {
    if (socket?.connected) socket.emit(event, data);
  }, [socket]);

  const value = {
    socket, connected, onlineUsers, msgBadge, lastEvent,
    setMsgBadge, refreshCounts, on, emit,
  };
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);

export async function requestBrowserNotifications() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

function showRealtimeNotification(toast, title, body, link) {
  toast.info(title, body);
  notifyBrowser(title, body, link);
}

async function notifyBrowser(title, body, link) {
  if (!("Notification" in window)) return;
  try {
    const permission = Notification.permission;
    if (permission !== "granted") return;
    const n = new Notification(title, { body: body || "", icon: "/images/hero.jpg" });
    n.onclick = () => { window.focus(); if (link) window.location.href = link; n.close(); };
  } catch (error) {
    console.warn("Browser notification could not be shown", error);
  }
}
