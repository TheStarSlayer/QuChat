import HomeContext from "../../../contexts/HomeContext";
import { useContext } from "react";

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
        searchTermForRTM, setSearchTermForRTM,
        requestsToMe, resetChatWindow, socketRef,
        initChatSession, setShowChatSession,
        setRequestsToMe
    } = useContext(HomeContext);

    let subsetRequestsToMe = [...requestsToMe];

    function searcher() {
        if (searchTermForRTM === "") {
            subsetRequestsToMe = [...requestsToMe];
        }
        else {
            const regex = new RegExp(searchTermForRTM, "i");
            subsetRequestsToMe = requestsToMe.filter((request) => regex.test(request.sender));
        }
    }

    async function respondToRequest(request, response) {
        const socket = socketRef.current;
        
        if (response && (request.createdAt + request.timeLimitInMs > Date.now()) ) {
            socket.emit("accept", request.sender, request.typeOfEncryption);
        
            resetChatWindow();
            initChatSession(request.sender, request.typeOfEncryption, request.chatSessionTimeInMin, "receiver");
            setShowChatSession();
        }
        else {
            socket.emit("reject", request.sender);
            setRequestsToMe(requests =>
                requests.filter(requestToMe => requestToMe.sender !== request.sender));
        }
        
    }

    return (
        <>
        </>
    );
}

export default RequestsToMe;