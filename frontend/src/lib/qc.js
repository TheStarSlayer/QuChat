import axios from "axios";
import authCaller from "./auth";

const server = import.meta.env.VITE_QC_ADDR;

const qcCaller = axios.create({
    baseURL: server,
    withCredentials: true
});

// Add auth token dynamically on every request
qcCaller.interceptors.request.use((config) => {
    const token = localStorage.getItem("access-token");
    if (token)
        config.headers.Authorization = token;
    return config;
});

qcCaller.interceptors.response.use(
    null,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest.retry) {
            originalRequest.retry = true;

            try {
                const authResponse = await authCaller.post("/refresh");
                localStorage.setItem("access-token", `Bearer ${authResponse.data.accessToken}`);
                originalRequest.headers.Authorization = localStorage.getItem("access-token");
                return axios(originalRequest);
            } catch {
                return Promise.reject(error);
            }
        }
        return Promise.reject(error);
    }
);

export default qcCaller;