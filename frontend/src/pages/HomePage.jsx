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
import ConfirmDialogBox from "../components/GeneralComponents/ConfirmDialogBox";
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

    // Native to General Components
    const [alreadyLoggedIn, setAlreadyLoggedIn] = useState(false);
    const [windowLoading, setWindowLoading] = useState("");
    const [showTimer, setShowTimer] = useState(-1);
    const [showConfirmDialogBox, setShowConfirmDialogBox] = useState("");
    const generalComponentStates = {
        setWindowLoading, setShowTimer, setShowConfirmDialogBox
    };

    // Native to ChatSession
    const [chatSessionTimer, setChatSessionTimer] = useState(-1);
    const [chatEncryption, setChatEncryption] = useState("");
    const [chatUsesSimulator, setChatUsesSimulator] = useState(null);
    const [chatRoomId, setChatRoomId] = useState(null);
    const [chatRole, setChatRole] = useState("");

    const [statusWindow, setStatusWindow] = useState("Starting up session...");

    const qkeyBases = useRef("");
    const qkeyBits = useRef("");

    const chatSessionStates = {
        chatSessionTimer, setChatSessionTimer,
        chatEncryption, setChatEncryption, 
        chatRoomId, setChatRoomId,
        chatRole, setChatRole,
        statusWindow, setStatusWindow,
        chatUsesSimulator, setChatUsesSimulator,
        qkeyBases, qkeyBits
    };

    const navigate = useNavigate();
    const socketRef = useRef(null);

    function resetChatWindow() {
        setShowNewRequest("");
        setShowEavesdroppableRequests(false);
        setShowRequestsToMe(false);
        setShowChatSession(false);

        setChatSessionTimer(-1);
        setChatEncryption("");
        setChatUsesSimulator(null);
        setChatRoomId(null);
        setChatRole("");
        qkeyBases.current = "";
        qkeyBits.current = "";
    }

    function initChatSession(roomId, typeOfEncryption, timer, role, usesSimulator) {
        setChatRoomId(roomId);
        setChatEncryption(typeOfEncryption);
        setChatSessionTimer(timer);
        setChatRole(role);
        setChatUsesSimulator(usesSimulator);
    }
    
    // Verify privilege and set userId
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
            toast.error("Login to avail services");
        });
    }, [navigate]);
    
    // Connect to socket.io
    useEffect(() => {
        if (userId) {
            const socket = io({
                auth: {
                    token: localStorage.getItem("access-token").split(" ")[1]
                }
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
                    catch (error){
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
                socket.disconnect();
            };   
        }
    }, [userId]);
    
    // Get online users and register corresponding event listeners
    useEffect(() => {
        async function getOnlineUsers() {
            try {
                const response = await apiCaller.get("/getOnlineUsers");
                setOnlineUsers(response.data.onlineUsers);
            }
            catch (error) {
                console.log("Unexpected error occurred", error);
                toast.error("Could not get online users!");
            }
        };

        if (userId && !alreadyLoggedIn) {
            getOnlineUsers();

            const socket = socketRef.current;

            socket.on("newUser", (newUser) => {
                setOnlineUsers(onlineUsers => [newUser, ...onlineUsers]);
            });

            socket.on("userLeft", (userId) => {
                setOnlineUsers(onlineUsers => onlineUsers.filter((user) => user.username !== userId));
            });

            return () => {
                socket.off("newUser");
                socket.off("userLeft");
            };
        }
    }, [userId, alreadyLoggedIn]);

    // get my active requests and register corresponding event listeners
    useEffect(() => {
        async function getRequestsToMe() {
            try {
                const response = await apiCaller.get("/getMyActiveRequests");
                setRequestsToMe(response.data.requests);
            }
            catch (error) {
                console.log("Unexpected error occurred", error);
                toast.error("Could not get your active requests!");
            }
        };

        if (userId && !alreadyLoggedIn) {
            getRequestsToMe();

            const socket = socketRef.current;

            socket.on("requestToJoin", (request) => {
                setRequestsToMe(requests => [request, ...requests]);
            });

            socket.on("removeRequest", (userId) => {
                setRequestsToMe(requests => requests.filter(request => request.sender !== userId));
            });

            return () => {
                socket.off("requestToJoin");
                socket.off("removeRequest");
            };
        }
    }, [alreadyLoggedIn, userId]);

    // get eavesdroppable requests and register corresponding event listeners
    useEffect(() => {
        async function getEavesdroppableRequests() {
            try {
                const response = await apiCaller.get("/getEavesdroppableRequests");
                setEavesdroppableRequests(response.data.requests);
            }
            catch (error) {
                console.log("Unexpected error occurred", error);
                toast.error("Could not get eavesdroppable requests!");
            }
        };

        if (userId && !alreadyLoggedIn) {
            getEavesdroppableRequests();
            
            const socket = socketRef.current;

            socket.on("requestForED", (request) => {
                if (request.sender !== userId || request.receiver !== userId)
                    setEavesdroppableRequests(requests => [request, ...requests]);
            });

            socket.on("removeRequestForED", (userId) => {
                setEavesdroppableRequests(requests => requests.filter(request => request.sender !== userId));
            });

            socket.on("removeRequest", (userId) => {
                setEavesdroppableRequests(requests => requests.filter(request => request.sender !== userId));
            });

            return () => {
                socket.off("requestToJoin");
                socket.off("removeRequestForED");
                socket.off("removeRequest");
            };
        }
    }, [alreadyLoggedIn, userId]);

    // Prevent right-click
    document.addEventListener("contextmenu", (event) => {
        event.preventDefault();
    });

    // Show browser native warning when user tries to reload
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            e.preventDefault();
            e.returnValue = ""; // Required for Chrome
        };

        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, []);

    // Handle browser-native navigation attempts
    useEffect(() => {
        const handlePopState = () => {
            const confirmLeave = window.confirm("Are you sure you want to leave?");
            
            if (!confirmLeave) {
            // Push state back to prevent navigation
            window.history.pushState(null, "", window.location.href);
            }
        };

        // Push initial state so popstate works properly
        window.history.pushState(null, "", window.location.href);

        window.addEventListener("popstate", handlePopState);

        return () => {
            window.removeEventListener("popstate", handlePopState);
        };
    }, []);

    return (
        <>
            <HomeContext.Provider value={{
                ...mainStates,
                ...currentChatWindowComponentSetter,
                ...generalComponentStates,
                ...chatSessionStates,
                resetChatWindow, initChatSession,
                socketRef
            }}>

                <Header navigate={navigate}/>
                <OnlineUsers />
                <ChatWindow />

            </HomeContext.Provider>

            {alreadyLoggedIn && <ExitPageWarning />}

            {showTimer !== -1 && <Timer time={showTimer}/>}
            {windowLoading !== "" && <WindowLoading message={windowLoading} />}
            {showConfirmDialogBox !== "" && <ConfirmDialogBox message={showConfirmDialogBox} />}
        </>
    );
}

export default HomePage;