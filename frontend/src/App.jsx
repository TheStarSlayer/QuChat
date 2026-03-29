import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import HomePage from "./pages/HomePage";
import OnboardPage from "./pages/OnboardPage";

function App() {
    return (
        <>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={ <HomePage /> } /> 
                    <Route path="/onboard" element={ <OnboardPage /> } /> 
                </Routes>
            </BrowserRouter>
            
            <ToastContainer />
        </>
    );
};

export default App;