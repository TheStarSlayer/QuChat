import axios from "axios";
import authCaller from "./auth";

const prod = import.meta.env.VITE_PROD;
const server = prod === "true" ? import.meta.env.VITE_QC_ADDR : "http://localhost:8598";

const qcCaller = axios.create({
    baseURL: server,
    withCredentials: true
});


// Add auth token dynamically on every request
qcCaller.interceptors.request.use(async (config) => {
    const token = localStorage.getItem("access-token");
    if (token)
        config.headers.Authorization = token;

    return config;
});

qcCaller.interceptors.response.use(
    response => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest.retry) {
            originalRequest.retry = true;

            try {
                const authResponse = await authCaller.post("/refresh");
                localStorage.setItem("access-token", `Bearer ${authResponse.data.accessToken}`);
                originalRequest.headers.Authorization = localStorage.getItem("access-token");
                return qcCaller(originalRequest);
            } catch {
                return Promise.reject(error);
            }
        }
        return Promise.reject(error);
    }
);

export default qcCaller;