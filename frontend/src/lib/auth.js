import axios from "axios";

const server = import.meta.env.VITE_SERVER_ADDR;

const authCaller = axios.create({
    baseURL: `${server}/auth`,
    withCredentials: true
});

export default authCaller;