import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import apiCaller from "../lib/api";
import { toast } from "react-toastify";
import { io } from "socket.io-client";
import authCaller from "../lib/auth";

function HomePage() {
    const [userId, setUserId] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [eavesdroppableRequests, setEavesdroppableRequests] = useState([]);
    const [requestsToMe, setRequestsToMe] = useState([]);

    const [showRequestsToMe, setShowRequestsToMe] = useState(false);
    const [showEavesdroppableRequests, setShowEavesdroppableRequests] = useState(false);

    const navigate = useNavigate();
    const socketRef = useRef(null);

    // Verify privelege and set userId
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
    }, []);
    
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
    }, []);

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
    }, []);

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
    }, [userId]);

    return (
        <>
            <Header userId={userId}/>
            
            <OnlineUsers onlineUsers={onlineUsers} />

            <ChatWindow eavesdroppableRequests={eavesdroppableRequests} requestsToMe={requestsToMe}
                showRequestsToMe={showRequestsToMe} setShowRequestsToMe={setShowRequestsToMe}
                showEavesdroppableRequests={showEavesdroppableRequests}
                setShowEavesdroppableRequests={setShowEavesdroppableRequests}
            />
        </>
    );
}

export default HomePage;