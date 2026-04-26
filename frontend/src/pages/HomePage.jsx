import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import apiCaller from "../lib/api";
import { toast } from "react-toastify";
import { io } from "socket.io-client";
import HomeContext from "../contexts/HomeContext";
import authCaller from "../lib/auth";
import Header from "../components/HomeComponents/Header";
import OnlineUsers from "../components/HomeComponents/OnlineUsers";
import ChatWindow from "../components/HomeComponents/ChatWindow";
import WindowLoading from "../components/GeneralComponents/WindowLoading";
import ExitPageWarning from "../components/GeneralComponents/ExitPageWarning";

function HomePage() {

    const [userId, setUserId] = useState(null);
    const [profilePic, setProfilePic] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [eavesdroppableRequests, setEavesdroppableRequests] = useState([]);
    const [requestsToMe, setRequestsToMe] = useState([]);
    const mainStates = {
        userId, profilePic,
        onlineUsers,
        eavesdroppableRequests,
        requestsToMe, setRequestsToMe,
    };

    const [showNewRequest, setShowNewRequest] = useState(null);
    const [showRequestsToMe, setShowRequestsToMe] = useState(false);
    const [showEavesdroppableRequests, setShowEavesdroppableRequests] = useState(false);
    const [showChatSession, setShowChatSession] = useState(false);
    const currentChatWindowComponentSetter = {
        showNewRequest, setShowNewRequest,
        showRequestsToMe, setShowRequestsToMe,
        showEavesdroppableRequests, setShowEavesdroppableRequests,
        showChatSession, setShowChatSession
    };

    const [alreadyLoggedIn, setAlreadyLoggedIn] = useState(false);
    const [windowLoading, setWindowLoading] = useState("");
    const [showTimer, setShowTimer] = useState(-1);
    const generalComponentStates = {
        setWindowLoading, showTimer, setShowTimer
    };

    const [chatSessionTimer, setChatSessionTimer] = useState(-1);
    const [chatEncryption, setChatEncryption] = useState("");
    const [chatUsesSimulator, setChatUsesSimulator] = useState(null);
    const [chatRoomId, setChatRoomId] = useState(null);
    const [chatRole, setChatRole] = useState("");

    const chatSessionStates = {
        chatSessionTimer, setChatSessionTimer,
        chatEncryption, setChatEncryption,
        chatRoomId, setChatRoomId,
        chatRole, setChatRole,
        chatUsesSimulator, setChatUsesSimulator
    };

    const navigate = useNavigate();
    const initiatedSocket = useRef(false);
    const initiatedOnlineUsers = useRef(false);
    const initiatedRequests = useRef(false);
    const initiatedEDR = useRef(false);
    const socketRef = useRef(null);

    function resetChatWindow() {
        setWindowLoading("");
        setShowNewRequest("");
        setShowEavesdroppableRequests(false);
        setShowRequestsToMe(false);
        setShowChatSession(false);
        setChatSessionTimer(-1);
        setChatEncryption("");
        setChatUsesSimulator(null);
        setChatRoomId(null);
        setChatRole("");
    }

    function initChatSession(roomId, typeOfEncryption, timer, role, usesSimulator) {
        setChatRoomId(roomId);
        setChatEncryption(typeOfEncryption);
        setChatSessionTimer(timer);
        setChatRole(role);
        setChatUsesSimulator(usesSimulator);
    }

    useEffect(() => {
        apiCaller.get("/verify")
            .then((response) => {
                const resUserId = response.data.userId;
                const profilePicAvtr = resUserId[0].toLowerCase() + resUserId[1].toLowerCase();
                setUserId(resUserId);
                setProfilePic(`https://cdn.auth0.com/avatars/${profilePicAvtr}.png`);
                toast.success(`Welcome ${resUserId}`);
            })
            .catch(() => {
                navigate("/onboard");
            });
    }, [navigate]);

    useEffect(() => {
        if (initiatedSocket.current)
            return;

        if (userId) {
            initiatedSocket.current = true;
            const socket = io({
                auth: { token: localStorage.getItem("access-token")?.split(" ")[1] }
            });
            socketRef.current = socket;

            socket.on("connect_error", async (error) => {
                if (error.message === "User already exists!") {
                    setAlreadyLoggedIn(true);
                }
                else {
                    try {
                        const response = await authCaller.post("/refresh");
                        localStorage.setItem("access-token", `Bearer ${response.data.accessToken}`);
                        socket.auth.token = response.data.accessToken;
                        socket.connect();
                    } 
                    catch (error) {
                        console.error(error);
                    }
                }
            });

            socket.on("requestFailed", (message) => {
                setShowTimer(-1);
                toast.error(message);
                resetChatWindow();
            });

            return () => {
                initiatedSocket.current = false;
                socket.disconnect();
            };
        }
    }, [userId]);

    useEffect(() => {
        if (initiatedOnlineUsers.current)
            return;

        if (userId && !alreadyLoggedIn) {
            initiatedOnlineUsers.current = true;
            apiCaller.get("/getOnlineUsers")
                .then(r => setOnlineUsers(r.data.onlineUsers))
                .catch(() => toast.error("Could not get online users!"));

            const socket = socketRef.current;
            
            socket.on("newUser", (newUser) => {
                if (newUser.username !== userId)
                    setOnlineUsers(prev => [newUser, ...prev])
            });

            socket.on("userLeft", (uid) => 
                setOnlineUsers(prev => prev.filter(u => u.username !== uid))
            );
            
            return () => {
                socket.off("newUser");
                socket.off("userLeft");
                initiatedOnlineUsers.current = false;
            };
        }
    }, [userId, alreadyLoggedIn]);

    useEffect(() => {
        if (initiatedRequests.current)
            return;

        if (userId && !alreadyLoggedIn) {
            initiatedRequests.current = true;

            apiCaller.get("/getMyActiveRequests")
                .then(r => setRequestsToMe(r.data.requests || []))
                .catch(() => toast.error("Could not get your active requests!"));

            const socket = socketRef.current;

            socket.on("requestToJoin", (request) => {
                toast.info(`New request from ${request.sender}`);
                setRequestsToMe(prev => [request, ...prev])
            });

            socket.on("removeRequest", (uid) => {
                setRequestsToMe(prev => prev.filter(r => r.sender !== uid))
            });

            return () => {
                socket.off("requestToJoin");
                socket.off("removeRequest");
                initiatedRequests.current = false;
            };
        }
    }, [alreadyLoggedIn, userId]);

    useEffect(() => {
        if (initiatedEDR.current)
            return;

        if (userId && !alreadyLoggedIn) {
            initiatedEDR.current = true;

            apiCaller.get("/getEavesdroppableRequests")
                .then(r => setEavesdroppableRequests(r.data.requests || []))
                .catch(() => toast.error("Could not get eavesdroppable requests!"));

            const socket = socketRef.current;

            const addEDRequests = (request) => {
                if (request.sender !== userId && request.receiver !== userId)
                    setEavesdroppableRequests(prev => [request, ...prev]);
            };

            socket.on("requestForED", addEDRequests);
            socket.on("renewedEDRequest", addEDRequests);

            socket.on("removeRequestForED", (uid) =>
                setEavesdroppableRequests(prev => prev.filter(r => r.sender !== uid))
            );

            socket.on("removeRequest", (uid) =>
                setEavesdroppableRequests(prev => prev.filter(r => r.sender !== uid))
            );
            
            return () => {
                socket.off("requestForED");
                socket.off("renewedEDRequest");                
                socket.off("removeRequestForED");
                socket.off("removeRequest");
                initiatedEDR.current = false;
            };
        }
    }, [alreadyLoggedIn, userId]);

    // Prevent right-click
    useEffect(() => {
        const handler = e => e.preventDefault();
        document.addEventListener("contextmenu", handler);
        return () => document.removeEventListener("contextmenu", handler);
    }, []);

    // Warn before unload
    useEffect(() => {
        const handleBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ""; };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, []);

    // Handle back navigation
    useEffect(() => {
        const handlePopState = () => {
            const confirmLeave = window.confirm("Are you sure you want to leave? Your session will end.");
            if (!confirmLeave) window.history.pushState(null, "", window.location.href);
        };
        window.history.pushState(null, "", window.location.href);
        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, []);

    return (
        <HomeContext.Provider value={{
            ...mainStates,
            ...currentChatWindowComponentSetter,
            ...generalComponentStates,
            ...chatSessionStates,
            resetChatWindow, initChatSession,
            socketRef
        }}>
            <div style={{
                display: "flex",
                flexDirection: "column",
                height: "100vh",
                overflow: "hidden",
                background: "#09151a"
            }}>
                <Header navigate={navigate} />
                <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                    <OnlineUsers />
                    <ChatWindow />
                </div>
            </div>

            {/* Overlays — outside layout div but inside provider */}
            {alreadyLoggedIn && <ExitPageWarning />}
            {windowLoading !== "" && <WindowLoading message={windowLoading} />}

        </HomeContext.Provider>
    );
}

export default HomePage;
