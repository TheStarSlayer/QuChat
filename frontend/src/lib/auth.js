import axios from "axios";

const authCaller = axios.create({
    baseURL: `/auth`,
    withCredentials: true
});

export default authCaller;