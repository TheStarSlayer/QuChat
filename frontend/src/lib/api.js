import axios from "axios";
import authCaller from "./auth";

const apiCaller = axios.create({
    baseURL: `/api`,
    withCredentials: true
});

// Add auth token dynamically on every request
apiCaller.interceptors.request.use((config) => {
    const token = localStorage.getItem("access-token");
    if (token)
        config.headers.Authorization = token;
    return config;
});

apiCaller.interceptors.response.use(
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

export default apiCaller;
