import { useContext } from "react";
import OnboardContext from "../../contexts/OnboardContext";
import WindowLoading from "../GeneralComponents/WindowLoading";

export default function LoginUI() {
	const { 
        login, username, setUsername,
        password, setPassword,
        setIsLogin, windowLoading 
    } = useContext(OnboardContext);

	return (
		<div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center bg-light">
			<div className="card shadow-sm p-4" style={{ maxWidth: 420, width: "100%" }}>
				<div className="text-center mt-2 mb-4">
					<div className="quchat-logo" aria-label="QuChat"> 
						<span className="qu">Qu</span><span className="chat">Chat</span>
					</div>
				</div>

				<h4 className="mt-2 mb-3 text-center">Welcome back</h4>

				<div className="mb-3">
					<label className="form-label">Username</label>
					<input
						type="text"
						className="form-control"
						value={username}
						onChange={(e) => setUsername(e.target.value)}
						placeholder="Enter username"
					/>
				</div>

				<div className="mb-4">
					<label className="form-label">Password</label>
					<input
						type="password"
						className="form-control"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder="Enter password"
					/>
				</div>

				<div className="d-grid gap-2">
					<button className="btn btn-primary" onClick={login} disabled={windowLoading}>
						Log in
					</button>
					<button className="btn btn-outline-secondary" onClick={() => setIsLogin(false)} disabled={windowLoading}>
						Create account
					</button>
				</div>

				<div className="mt-3 text-center">
					<small className="text-muted">Secure messaging made simple — QuChat</small>
				</div>
			</div>

			{ windowLoading && <WindowLoading message="Logging in..." /> }
		</div>
	);
}

