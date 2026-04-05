import { useContext } from "react";
import logout from "../../lib/logout";
import HomeContext from "../../contexts/HomeContext";

function Header({ navigate }) {
    // QuChat logo, Welcome User w/ profile picture (https://cdn.auth0.com/avatars/${first two characters}.png),
    // Logout button

    const { userId } = useContext(HomeContext);
}

export default Header;