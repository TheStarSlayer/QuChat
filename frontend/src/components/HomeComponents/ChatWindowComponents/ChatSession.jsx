import { useContext, useEffect, useState } from "react";
import HomeContext from "../../../contexts/HomeContext";
import { toast } from "react-toastify";
import qcCaller from "../../../lib/qc";
import { encrypt, decrypt } from "../../../lib/protector";

function ChatSession() {
    /**
     * If freeToChat is true, display ChatSession with send message bar and button (not for eavesdropper)
     * Else, display ChatSession with ChatSessionStatus
     * 
     * If typeOfEncryption is bb84, display QBER on the same bar as close button
     * 
     */
    const {
        chatSessionTimer, chatEncryption,
        chatRoomId, chatRole, socketRef,
        userId, profilePic,
        resetChatWindow,
        statusWindow, setStatusWindow,
        qkeyBases, setQkeyBases,
        qkeyBits, setQkeyBits
    } = useContext(HomeContext);

    const [freeToChat, setFreeToChat] = useState(false);

    const [chatMessages, setChatMessages] = useState([]);
    const [message, setMessage] = useState([]);

    const [siftedQkeyBits, setSiftedQkeyBits] = useState("");
    const [QBER, setQBER] = useState(null);

    function siftKey(receivedBases) {
        const myBases = qkeyBases;
        const indicesToDelete = [];

        for (let i = 0; i < myBases.length; i++) {
            if (receivedBases[i] !== myBases[i]) {
                indicesToDelete.push(i);
            }
        }

        let myKey = qkeyBits;
        for (let i = indicesToDelete.length - 1; i >= 0; i--) {
            myKey = myKey.slice(0, indicesToDelete[i]) + myKey.slice(indicesToDelete[i] + 1);
        }

        setSiftedQkeyBits(myKey);
    }

    function getRandBits(randIndices) {
        let randBits = "";
        for (const ind of randIndices) {
            randBits += siftedQkeyBits[ind];
        }

        setSiftedQkeyBits(bits => {
            randIndices.sort((a, b) => a - b);
            
            let myKey = bits;
            for (let i = randIndices.length - 1; i >= 0; i--) {
                myKey = myKey.slice(0, randIndices[i]) + myKey.slice(randIndices[i] + 1);
            }

            return myKey;
        });

        return randBits;
    }

    function qberCalculator(randIndices, randBits) {
        const myRandBits = getRandBits(randIndices);
        const comparedBits = randBits.length;
        let mismatchedBits = 0;
        
        for (let i = 0; i < comparedBits; i++) {
            if (myRandBits[i] !== randBits[i])
                mismatchedBits++;
        }

        return (mismatchedBits / comparedBits) * 100;
    }

    function sessionStarted() {
        setFreeToChat(true);
        toast.success("You are free to chat!");
    }

    function sendMessage() {
        const socket = socketRef.current;

        let messageToSend = message;
        setChatMessages([...chatMessages, { messageToSend, userId, profilePic }]);
        
        if (chatEncryption !== "none")
            messageToSend = encrypt(messageToSend, siftedQkeyBits);

        socket.emit("sendMessage", chatRoomId, messageToSend);
    }

    function closeChatSession() {
        const socket = socketRef.current;
        socket.emit("sessionDisturbed", "Participant left");
        resetChatWindow();
        toast.success("Left chat session!");
    }

    useEffect(() => {        
        const socket = socketRef.current;

        if (chatEncryption === "none") {
            setStatusWindow("");
            if (chatRole !== "eavesdropper")
                sessionStarted();
            else
                toast.success("Eavesdropping successfully!");
        }
        else {
            if (chatRole === "sender") {
                socket.once("bases", async (bases) => {
                    socket.emit("shareBases", chatRoomId, qkeyBases);
                    siftKey(bases);
                    
                    try {
                        const response = await qcCaller.get(`/getRandomIndices/${siftedQkeyBits.length}`);
                        
                        const randIndices = response.data.randIndices;
                        const randBits = getRandBits(randIndices);

                        socket.emit("calculateQBER", chatRoomId, { randIndices, randBits });

                        socket.once("qberResult", (receivedQber) => {
                            if (receivedQber > 10) {
                                setStatusWindow("Session compromised. QBER too high to continue. There might be an eavesdropper!");
                                socket.emit("resetSocketStats");
                                toast.error("Session compromised!");
                                resetChatWindow();
                            }
                            else {
                                socket.emit("updateOnQBERAccept", chatRoomId);
                                setQBER(receivedQber);
                                setStatusWindow("");
                                sessionStarted();
                            }
                        });
                    }
                    catch (error) {
                        socket.emit("sessionDisturbed", "Could not request for QBER!");

                        toast.error("Could not request for QBER!");
                        console.error(error);
                        resetChatWindow();
                    }
                });
            }
            else if (chatRole === "eavesdropper") {
                socket.once("ackFromHost", async () => {
                    try {
                        const response = await qcCaller.get(`/distributeRawKey/${userId}`);
                        setQkeyBases(response.data.bases);
                        setQkeyBits(response.data.bits);
                        setStatusWindow("Intercepted bits and resent to receiver, waiting on receiver end...");

                        socket.once("qberResult", (receivedQber) => {
                            if (receivedQber > 10) {
                                toast.error("Detected by BB84 QKD algorithm!");
                                resetChatWindow();
                            }
                            else {
                                socket.emit("updateOnQBERAccept", chatRoomId);
                                setStatusWindow("");
                                toast.success("Eavesdropping successfully!");
                            }
                        });
                    }
                    catch (error) {
                        toast.error("Unexpected error occurred!");
                        console.error(error);
                        resetChatWindow();
                    }

                });
            }
            else { // role would be receiver
                socket.once("ackFromHost", async () => {
                    let tryLaterCount = 0;
                    const intervalId = setInterval(async () => {
                        try {
                            const response = await qcCaller.get(`/distributeRawKey/${userId}`);
                            clearInterval(intervalId);
        
                            setQkeyBases(response.data.bases);
                            setQkeyBits(response.data.bits);
                            setStatusWindow("Generating key...calculating QBER...");
                            
                            socket.emit("shareBases", chatRoomId, qkeyBases);
                            socket.once("bases", (bases) => {
                                siftKey(bases);
                                socket.once("qber", ({ randIndices, randBits }) => {
                                    const calcQber = qberCalculator(randIndices, randBits);
                                    setStatusWindow(`Measured QBER is ${calcQber}%....`);
                                    socket.emit("shareQBERResult", chatRoomId, calcQber);

                                    if (calcQber < 10) {
                                        setQBER(calcQber);
                                        setStatusWindow("");
                                        sessionStarted();
                                    }
                                    else {
                                        setStatusWindow("Session compromised. QBER too high to continue. There might be an eavesdropper!");
                                        socket.emit("leave");
                                        toast.error("Session compromised!");
                                        resetChatWindow();
                                    }
                                });
                            });
                        }
                        catch (error) {
                            if (error.response?.status === 425 && tryLaterCount <= 3) {
                                tryLaterCount++;
                            }
                            else {
                                toast.error("Key generation failed!");
                                console.error(error);
                                socket.emit("sessionDisturbed", chatRoomId, "Key Generation Failed!");
                                resetChatWindow();
                            }
                        }
                    }, 5000);
                });
            }

            socket.on("message", (message, sender, senderProfilePic) => {
                let receivedMessage = message;
                
                if (chatEncryption !== "none")
                    receivedMessage = decrypt(receivedMessage, siftedQkeyBits);

                setChatMessages((chatMessages) => 
                    [...chatMessages, { message: receivedMessage, sender, senderProfilePic }]);
            });

            socket.on("sessionEnd", () => {
                if (userId !== chatRoomId)
                    socket.emit("leave");

                toast.info("Session ended gracefully");
                resetChatWindow();
            });

            socket.on("sessionDisturbed", (message) => {
                if (userId !== chatRoomId)
                    socket.emit("leave");

                toast.error(message);
                resetChatWindow();
            })
        }

        return () => {
            socket.off("message");
            socket.off("sessionEnd");
            socket.off("sessionDisturbed");
        };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chatEncryption, chatRole, chatRoomId, socketRef, userId]);

    return (
        <>
        </>
    );
}

export default ChatSession;