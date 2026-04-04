import HomeContext from "../../../contexts/HomeContext";
import { useContext } from "react";

import apiCaller from "../../../lib/api";
import { toast } from "react-toastify";
import qcCaller from "../../../lib/qc";

function NewRequest() {
    /**
     * receiverId, timeLimitInMs,
     * typeOfEncryption, chatSessionTimeInMin,
     * isSimulator
     * 
     * These are the fields that need to be collected from sender
     * showNewRequest contains receiverId
     *  
     * timeLimitInMs is the time limit of waiting for response from receiver.
     * It ranges from 30 sec to 90 sec (30, 45, 60, 75, 90). Millisecond conversion will be done internally
     * (slider)
     * 
     * typeOfEncryption -> none, bb84 (radio)
     * 
     * chatSessionTimeInMin is the time limit of the chat session (ranges from 3 min to 10 min (one min incr))
     * (slider)
     * 
     * isSimulator is not shown if typeOfEncryption is none. If bb84, it is true by default. Also, warn users that
     * real devices take a long time for key generations (if false, time for keygen cannot be estimated)
     * (radio)
     * 
     * On click of submit, call createRequest()
     * 
     * NewRequest also contains a close button, which will call resetChatWindow()
     */

    const {
        showNewRequest, setWindowLoading,
        timeLimitInSec, setTimeLimitInSec,
        chatSessionTimeInMin, setChatSessionTimeInMin,
        typeOfEncryption, setTypeOfEncryption,
        isSimulator, setIsSimulator,
        socketRef,
        showTimer, setShowTimer,
        setShowChatSession,
        userId, resetChatWindow,
        initChatSession
    } = useContext(HomeContext);

    /**
     * setLoading
     * make request to backend
     * wait for response (setLoading is still true)
     * if response is success, send requestToJoin to receiver
     * start timer (use showTimer to display <Timer />)
     * register timeout function and response event
     */
    async function createRequest() {
        setWindowLoading("Sending request...");

        try {
            const response = await apiCaller.post("/persistRequest", {
                receiverId: showNewRequest,
                timeLimitInMs: timeLimitInSec * 1000,
                typeOfEncryption,
                chatSessionTimeInMin,
                isSimulator
            });
            
            const request = response.data.newRequestPublic;
            const socket = socketRef.current;

            socket.emit("sendJoinRequest", showNewRequest, request);
            setShowTimer(timeLimitInSec);

            const timeoutId = setTimeout(async () => {
                toast.info("Request timed out!");

                socket.off("response");
                resetChatWindow();

                try {
                    await apiCaller.post("/finishRequest", { finishStatus: "timeout" });
                }
                catch (error){
                    toast.error("Could not close request successfully!");
                    console.error(error);
                }
            }, timeLimitInSec * 1000);

            socket.once("response", async (response) => {
                clearTimeout(timeoutId);
                setShowTimer(-1);
                setWindowLoading("Handling response...");
                try {
                    if (response === "accepted") {
                        await apiCaller.post("/finishRequest", { finishStatus: "accepted" });
                        
                        if (typeOfEncryption === "bb84") {
                            socket.emit("updateOnResponseAcceptQC", userId);
                            await qcCaller.get(`/distributeRawKey/${userId}`);
                        }
                        else {
                            socket.emit("updateOnResponseAccepted", userId);
                        }

                        socket.emit("joinAck", userId, true);

                        resetChatWindow();
                        initChatSession(userId, request.typeOfEncryption, request.chatSessionTimeInMin, "host");
                        setShowChatSession(true);
                    }
                    else {
                        await apiCaller.post("/finishRequest", { finishStatus: "rejected" });
                        resetChatWindow();
                    }
                }
                catch (error) {
                    toast.error("Could not handle request successfully!");
                    console.error(error);
                    resetChatWindow();
                }
                finally {
                    setWindowLoading("");
                }
            });
        }
        catch (error){
            toast.error("Something unexpected happened!");
            console.error(error);
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

export default NewRequest;