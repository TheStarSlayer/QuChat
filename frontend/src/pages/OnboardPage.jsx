import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiCaller from "../lib/api";
import authCaller from "../lib/auth";
import { toast } from "react-toastify";
import LoginUI from "../components/OnboardComponents/LoginUI";
import SignupUI from "../components/OnboardComponents/SignupUI";
import OnboardContext from "../contexts/OnboardContext";

function OnboardPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [windowLoading, setWindowLoading] = useState(false);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPasswordConstraints, setShowPasswordConstraints] = useState(false);
    const [showLengthConstraint, setShowLengthConstraint] = useState(false);
    const [showSpCharConstraint, setShowSpCharConstraint] = useState(false);
    const [showAlpNumConstraint, setShowAlpNumConstraint] = useState(false);
    
    const navigate = useNavigate();

    /**
     * checkAuth
     * 
     * call /api/verify -> if success, navigate to home
     * call /auth/refresh -> if success, navigate to home
     * 
     * if ok, continue
     */
    useEffect(() => {
        const navigateToHome = () => {
            navigate("/");
            toast.info("You are already logged in!");
        };

        apiCaller.get("/verify")
        .then(navigateToHome)
        .catch(() => {
            authCaller.post("/refresh")
            .then(navigateToHome)
            .catch(() => {
                console.log("Login to avail services");
            });
        });
    }, [navigate]);

    async function login() {
        try {
            setWindowLoading(true);
            const response = await authCaller.post("/login", { username: username, password: password });
            localStorage.setItem("access-token", `Bearer ${response.data.accessToken}`);
            navigate("/");
        }
        catch (error) {
            if (error.response.status === 409)
                toast.error("User is already logged in!");
            else if (error.response.status === 400)
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
        try {
            setWindowLoading(true);
            await authCaller.post("/signup", { username: username, password: password });
            toast.success("User created successfully! Login to avail services.");
            setIsLogin(true);
        }
        catch {
            toast.error("Unexpected error occurred! Could not create new user!");
        }
        finally {
            setUsername("");
            setPassword("");
            setWindowLoading(false);
        }
    }

    function checkPasswordLength() {
        setShowPasswordConstraints(false);

        let lengthNotGood = false;
        let containsNum = false;
        let containsAlp = false;
        let containsSpCh = false;

        if (password.length < 6) {
            lengthNotGood = true;
        }

        for (const char of password) {
            if (char.match(/[0-9]/g))
                containsNum = true;
            else if (char.match(/[a-zA-Z]/g))
                containsAlp = true;
            else if (char.match(/[^a-zA-Z0-9]/g))
                containsSpCh = true;
        }

        if (lengthNotGood || !(containsNum && containsAlp) || !containsSpCh)
            setShowPasswordConstraints(true);

        setShowLengthConstraint(lengthNotGood);
        setShowAlpNumConstraint(!(containsAlp && containsNum));
        setShowSpCharConstraint(!containsSpCh);
    }

    return (
        <OnboardContext.Provider value={{ 
                login, signup, checkPasswordLength, username, setUsername, password, setPassword, windowLoading, isLogin, setIsLogin, showPasswordConstraints, showLengthConstraint, showSpCharConstraint, showAlpNumConstraint 
            }}
        >
            { isLogin ? <LoginUI /> : <SignupUI /> }
        </OnboardContext.Provider>
    );
}

export default OnboardPage;