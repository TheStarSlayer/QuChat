import axios from "axios";

const server = import.meta.env.VITE_SERVER_ADDR;

const apiCaller = axios.create({
    baseURL: `${server}/api`,
    headers: { "Authorization": localStorage.getItem("access-token") },
    withCredentials: true
});

export default apiCaller;