import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import authCaller from "../lib/auth";
import { toast } from "react-toastify";
import LoginUI from "../components/OnboardComponents/LoginUI";
import SignupUI from "../components/OnboardComponents/SignupUI";
import OnboardContext from "../contexts/OnboardContext";
import apiCaller from "../lib/api";

function OnboardPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [windowLoading, setWindowLoading] = useState(false);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPasswordConstraints, setShowPasswordConstraints] = useState(true);
    const [showLengthConstraint, setShowLengthConstraint] = useState(true);
    const [showSpCharConstraint, setShowSpCharConstraint] = useState(true);
    const [showAlpNumConstraint, setShowAlpNumConstraint] = useState(true);

    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem("access-token");
        if (!token)
            return;

        apiCaller.get("/verify")
            .then(() => {
                navigate("/");
            })
            .catch(() => {
                localStorage.removeItem("access-token");
            });
    }, [navigate]);

    async function login() {
        if (!username || !password) {
            toast.error("Please enter username and password");
            return;
        }
        try {
            setWindowLoading(true);
            const response = await authCaller.post("/login", { username, password });
            localStorage.setItem("access-token", `Bearer ${response.data.accessToken}`);
            navigate("/");
        }
        catch (error) {
            if (error.response?.status === 409)
                toast.error("User is already logged in!");
            else if (error.response?.status === 400)
                toast.error("Invalid credentials!");
            else
                toast.error("Unexpected error occurred!");
        }
        finally {
            setUsername("");
            setPassword("");
            setWindowLoading(false);
        }
    }

    async function signup() {
        if (!username || !password) {
            toast.error("Please fill in all fields");
            return;
        }
        try {
            setWindowLoading(true);
            await authCaller.post("/signup", { username, password });
            toast.success("Account created! Please log in.");
            setIsLogin(true);
        }
        catch (error) {
            if (error.response?.status === 400)
                toast.error("Username already exists!");
            else
                toast.error("Unexpected error occurred!");
        }
        finally {
            setUsername("");
            setPassword("");
            setWindowLoading(false);
        }
    }

    function checkPasswordLength(newPassword) {
        const lengthNotGood = newPassword.length < 6;
        const containsNum = /[0-9]/.test(newPassword);
        const containsAlp = /[a-zA-Z]/.test(newPassword);
        const containsSpCh = /[^a-zA-Z0-9]/.test(newPassword);

        const criteria = lengthNotGood || !(containsNum && containsAlp) || !containsSpCh;
        setShowPasswordConstraints(criteria);
        setShowLengthConstraint(lengthNotGood);
        setShowAlpNumConstraint(!(containsAlp && containsNum));
        setShowSpCharConstraint(!containsSpCh);
    }

    return (
        <OnboardContext.Provider value={{
            login, signup, checkPasswordLength,
            username, setUsername,
            password, setPassword,
            windowLoading, isLogin, setIsLogin,
            showPasswordConstraints,
            showLengthConstraint, showSpCharConstraint, showAlpNumConstraint
        }}>
            {isLogin ? <LoginUI /> : <SignupUI />}
        </OnboardContext.Provider>
    );
}

export default OnboardPage;
