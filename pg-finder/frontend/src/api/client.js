import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("pgf_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401) {
      const t = localStorage.getItem("pgf_token");
      if (t && !window.location.pathname.startsWith("/login")) {
        localStorage.removeItem("pgf_token");
        localStorage.removeItem("pgf_user");
        if (!err.config.url.includes("/auth/login")) {
          window.location.href = "/login?expired=1";
        }
      }
    }
    return Promise.reject(err);
  }
);

export function errMsg(err, fallback = "Something went wrong. Please try again.") {
  return err?.response?.data?.error || err?.message || fallback;
}

export default api;
