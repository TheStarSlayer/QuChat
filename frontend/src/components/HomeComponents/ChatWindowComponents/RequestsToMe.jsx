import HomeContext from "../../../contexts/HomeContext";
import { useContext, useState } from "react";
import { toast } from "react-toastify";

function RequestsToMe() {
    /**
     * Use subsetRequestsToMe to build a list
     * 
     * It contains searchbar to search through requests based on sender/host
     * It contains a close button that calls resetChatWindow
     * Each list item (request) contains request details and two buttons: Accept and Reject
     * The arguments/parameters need to be modified based on how the request is passed to the function
     * Currently assuming request to be an object (you can choose to pre-process it into an object...)
     * If accept, response is true; else, response is false
     */
    
    const {
        requestsToMe, resetChatWindow, socketRef,
        initChatSession, setShowChatSession,
        setRequestsToMe
    } = useContext(HomeContext);

    const [searchTermForRTM, setSearchTermForRTM] = useState("");
    const [subsetRequestsToMe, setSubsetRequestsToMe] = useState([...requestsToMe]);

    function searcher() {
        if (searchTermForRTM === "") {
            setSubsetRequestsToMe([...requestsToMe]);
        }
        else {
            const regex = new RegExp(searchTermForRTM, "i");
            setSubsetRequestsToMe(requestsToMe.filter((request) => regex.test(request.sender)));
        }
    }

    async function respondToRequest(request, response) {
        const socket = socketRef.current;
        
        if (request.createdAt + request.timeLimitInMs > Date.now()) {
            toast.info("This request is timed out! Auto-rejecting...");
            response = false;

            if (response) {
                socket.emit("accept", request.sender, request.typeOfEncryption);
            
                resetChatWindow();
                initChatSession(request.sender, request.typeOfEncryption, request.chatSessionTimeInMin, "receiver", request.isSimulator);
                setShowChatSession();
            }
            else {
                socket.emit("reject", request.sender);
                
                setRequestsToMe(requests =>
                    requests.filter(requestToMe => requestToMe.sender !== request.sender));
                
                setSubsetRequestsToMe(requests =>
                    requests.filter(requestToMe => requestToMe.sender !== request.sender));
            }
        }
    }

    return (
        <>
        </>
    );
}

export default RequestsToMe;