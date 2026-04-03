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

function HomePage() {
    const [userId, setUserId] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [eavesdroppableRequests, setEavesdroppableRequests] = useState([]);
    const [requestsToMe, setRequestsToMe] = useState([]);

    const [searchTermForUsers, setSearchTermForUsers] = useState("");

    const [showNewRequest, setShowNewRequest] = useState(null);
    const [showRequestsToMe, setShowRequestsToMe] = useState(false);
    const [showEavesdroppableRequests, setShowEavesdroppableRequests] = useState(false);
    const [showChatSession, setShowChatSession] = useState(false);

    const [windowLoading, setWindowLoading] = useState("");
    const [showTimer, setShowTimer] = useState(-1);

    // Native to newRequest
    const [timeLimitInSec, setTimeLimitInSec] = useState(30);
    const [chatSessionTimeInMin, setChatSessionTimeInMin] = useState(5);
    const [typeOfEncryption, setTypeOfEncryption] = useState("bb84");
    const [isSimulator, setIsSimulator] = useState(true);

    // Native to chatSession
    const [chatSessionTimer, setChatSessionTimer] = useState(-1);
    const [chatEncryption, setChatEncryption] = useState("");
    const [chatRoomId, setChatRoomId] = useState(null);
    const [chatRole, setChatRole] = useState("");

    const navigate = useNavigate();
    const socketRef = useRef(null);

    // Verify privilege and set userId
    useEffect(() => {
        apiCaller.get("/verify")
        .then((response) => {
            setUserId(response.data.userId);
            toast.success(`Welcome ${response.data.userId}`);
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

            socket.on("connect_error", async () => {
                try {
                    const response = await authCaller.post("/refresh");
                    localStorage.setItem("access-token", `Bearer ${response.data.accessToken}`);
                    socket.auth.token = response.data.accessToken;

                    socket.connect();
                }
                catch (error){
                    console.error(error);
                }
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

        if (userId) {
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
    }, [userId]);

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

        if (userId) {
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
    }, [userId]);

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

        if (userId) {
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
    }, [userId]);

    function resetChatWindow() {
        setShowTimer(-1);
        setShowNewRequest("");
        setShowEavesdroppableRequests(false);
        setShowRequestsToMe(false);
    }

    function initChatSession(roomId, typeOfEncryption, timer, role) {
        setChatRoomId(roomId);
        setChatEncryption(typeOfEncryption);
        setChatSessionTimer(timer);
        setChatRole(role);
    }

    return (
        <>
            <Header userId={userId} navigate={navigate}/>

            <OnlineUsers onlineUsers={onlineUsers} 
                searchTerm={searchTermForUsers} setSearchTerm={setSearchTermForUsers}
                setShowNewRequest={setShowNewRequest} setShowRequestsToMe={setShowRequestsToMe}
                setShowEavesdroppableRequests={setShowEavesdroppableRequests}
            />

            <HomeContext.Provider value={{
                userId, socketRef,
                eavesdroppableRequests, requestsToMe,
                showNewRequest, setShowNewRequest,
                showRequestsToMe, setShowRequestsToMe,
                showEavesdroppableRequests, setShowEavesdroppableRequests,
                showTimer, setShowTimer,
                showChatSession, setShowChatSession,
                setWindowLoading,
                timeLimitInSec, setTimeLimitInSec,
                chatSessionTimeInMin, setChatSessionTimeInMin,
                typeOfEncryption, setTypeOfEncryption,
                isSimulator, setIsSimulator,
                chatRoomId, setChatRoomId,
                chatSessionTimer, setChatSessionTimer,
                chatEncryption, setChatEncryption,
                chatRole, setChatRole,
                resetChatWindow, initChatSession
            }}>
                <ChatWindow />
            </HomeContext.Provider>

            {windowLoading !== "" && <WindowLoading message={windowLoading} />}
        </>
    );
}

export default HomePage;