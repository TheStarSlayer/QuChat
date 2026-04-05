import { useContext, useState } from "react";
import HomeContext from "../../contexts/HomeContext";

function OnlineUsers() {

    const { 
        onlineUsers, setShowNewRequest,
        setShowRequestsToMe, setShowEavesdroppableRequests,
        showChatSession
    } = useContext(HomeContext)

    const [searchTermForUsers, setSearchTermForUsers] = useState("");
    const [subsetOnlineUsers, setSubsetOnlineUsers] = useState([...onlineUsers]);

    function searcher() {
        if (searchTermForUsers === "") {
            setSubsetOnlineUsers([...onlineUsers]);
        }
        else {
            const regex = new RegExp(searchTermForUsers, "i");
            setSubsetOnlineUsers(onlineUsers.filter((user) => regex.test(user.username)));
        }
    }

    function newRequest(receiverUserId) {
        setShowRequestsToMe(false);
        setShowEavesdroppableRequests(false);
        setShowNewRequest(receiverUserId);
    }

    /**
     * Contains list of online users with request button (for chatting)
     * 
     * Contains a search bar (for searching through onlineUsers)
     * 
     * When searchbar is empty, show all users (initially, all are shown)
     * When value of searchbar changes (use searchTermForUsers state), call setsearchTermForUsers and searcher() function
     * 
     * Build the list from subsetOnlineUsers only
     * 
     * When request button is clicked, call newRequest(receiverUserId) -> 
     *      try to set receiverUserId based on list key
     * 
     * When showChatSession is enabled, onlineUsers component should not be interactable
     */
    return (
        <>
        </>
    );
}

export default OnlineUsers;