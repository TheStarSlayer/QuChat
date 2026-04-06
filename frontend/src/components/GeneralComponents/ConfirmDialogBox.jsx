import HomeContext from "../../contexts/HomeContext";
import { useContext } from "react";

function ConfirmDialogBox({ onConfirm, onCancel }) {
    const { showConfirmDialogBox, setShowConfirmDialogBox } = useContext(HomeContext);

    function handleConfirm() {
        setShowConfirmDialogBox("");
        if (onConfirm) onConfirm();
    }

    function handleCancel() {
        setShowConfirmDialogBox("");
        if (onCancel) onCancel();
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(9,21,26,0.85)", backdropFilter: "blur(8px)", fontFamily: "'Courier New', Courier, monospace" }}>
            <div className="w-full max-w-sm mx-4 rounded-2xl p-6"
                style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(33,150,243,0.2)",
                    boxShadow: "0 0 60px rgba(33,150,243,0.1)"
                }}>

                {/* Warning icon */}
                <div className="flex justify-center mb-4">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center"
                        style={{ background: "rgba(216,121,0,0.1)", border: "1px solid rgba(216,121,0,0.3)" }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D87900" strokeWidth="2">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                    </div>
                </div>

                <h3 className="text-center text-white font-bold text-base mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    Confirm Action
                </h3>
                <p className="text-center mb-6" style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
                    {showConfirmDialogBox}
                </p>

                <div className="flex gap-3">
                    <button
                        onClick={handleCancel}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                        style={{
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            color: "rgba(255,255,255,0.6)"
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
                        onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                        style={{
                            background: "linear-gradient(135deg, #ef4444, #b91c1c)",
                            boxShadow: "0 0 12px rgba(239,68,68,0.2)"
                        }}
                        onMouseEnter={e => e.currentTarget.style.boxShadow = "0 0 20px rgba(239,68,68,0.4)"}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = "0 0 12px rgba(239,68,68,0.2)"}
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ConfirmDialogBox;
