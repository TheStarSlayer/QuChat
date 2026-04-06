import authCaller from "./auth";
import { toast } from "react-toastify";

export default async function logout(navigate) {
    try {
        await authCaller.post("/logout");
        localStorage.removeItem("access-token");
        navigate("/onboard");
        toast.success("Logged out successfully!");
    }
    catch (error) {
        if (error.response?.status === 500)
            toast.error("Could not logout - internal server error");
        else
            toast.error(error.response.data.error);
    }
}