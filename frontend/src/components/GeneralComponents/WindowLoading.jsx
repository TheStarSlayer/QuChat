export default function WindowLoading({ message = "Please wait..." }) {
	
	return (
		<div style={overlayStyle}>
			<div className="d-flex flex-column align-items-center text-white p-3">
				<div className="spinner-border text-light mb-3" role="status" aria-hidden="true"></div>
				<div className="h5 fw-normal">{message}</div>
			</div>
		</div>
	);
}

const overlayStyle = {
	position: 'fixed',
	top: 0,
	left: 0,
	right: 0,
	bottom: 0,
	backgroundColor: 'rgba(0,0,0,0.45)',
	backdropFilter: 'blur(2px)',
	zIndex: 1050,
	display: 'flex',
	justifyContent: 'center',
	alignItems: 'center'
};

