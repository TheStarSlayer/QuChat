import HomeContext from "../../../contexts/HomeContext";
import { useContext } from "react";
import apiCaller from "../../../lib/api";
import { toast } from "react-toastify";

function EavesdroppableRequests() {
    /**
     * Use subsetEDRequests to build a list
     * 
     * It contains searchbar to search through requests based on sender/host
     * It contains a close button that calls resetChatWindow
     * Each list item (request) contains a button that allows user to eavesdrop the request
     * The arguments/parameters need to be modified based on how the request is passed to the function
     * Currently assuming it to be an object (you can choose to pre-process it into an object...)
     */

    const {
        searchTermForEDR, setSearchTermForEDR,
        eavesdroppableRequests, resetChatWindow,
        setWindowLoading, socketRef,
        userId, initChatSession, setShowChatSession
    } = useContext(HomeContext);

    let subsetEDRequests = [...eavesdroppableRequests];

    function searcher() {
        if (searchTermForEDR === "") {
            subsetEDRequests = [...eavesdroppableRequests];
        }
        else {
            const regex = new RegExp(searchTermForEDR, "i");
            subsetEDRequests = eavesdroppableRequests.filter((request) => regex.test(request.sender));
        }
    }

    async function eavesdropRequest(request) {
        setWindowLoading("Sneaking...");
        try {
            await apiCaller.patch(`/eavesdrop/${request.sender}`);
            const socket = socketRef.current;
            setWindowLoading("Waiting for response from receiver...");

            const timeoutId = setTimeout(() => {
                throw new Error("Request timed out");
            }, request.timeLimitInMs);

            socket.once("response", (response) => {
                clearTimeout(timeoutId);
                if (response === "rejected")
                    throw new Error("Receiver rejected the chat request!");

                if (request.typeOfEncryption === "bb84")
                    socket.emit("updateOnResponseAcceptQC", userId);
                else
                    socket.emit("updateOnResponseAccept", userId);

                resetChatWindow();
                initChatSession(request.sender, request.typeOfEncryption, request.chatSessionTimeInMin, "eavesdropper");
                setShowChatSession(true);
            });
        }
        catch (error){
            if (error.response?.status === 404) {
                toast.error("This request cannot be eavesdropped now!");
            }
            else {
                toast.error(error.message);
                console.error(error);
            }
        }
        finally {
            setWindowLoading("");
        }
    }

    return (
        <>
        </>
    );
}

export default EavesdroppableRequests;