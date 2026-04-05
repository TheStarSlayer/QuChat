import { useContext } from "react";
import logout from "../../lib/logout";
import HomeContext from "../../contexts/HomeContext";

function Header({ navigate }) {
    // QuChat logo, Welcome User w/ profile picture,
    // Logout button

    const { userId, profilePic } = useContext(HomeContext);
}

export default Header;