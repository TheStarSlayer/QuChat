from fastapi import FastAPI
from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2 as Sampler
from qiskit.transpiler import generate_preset_pass_manager
from qiskit import QuantumCircuit
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI()

q_service = QiskitRuntimeService(
    token=os.getenv("API_KEY"),
    instance="quchat-key"
)

@app.get("/rng/{bit_length}/{no_of_shots}")
async def random_num_generator(bit_length, no_of_shots):
    if (bit_length < 1 or bit_length > 32 or no_of_shots < 1):
        return
    
    q_backend = q_service.least_busy(min_num_qubits=32)
    pm = generate_preset_pass_manager(backend=q_backend, optimization_level=1)
    sampler = Sampler(q_backend)
    
    qc = QuantumCircuit(bit_length, bit_length)
    qc.h(range(bit_length))
    qc.measure_all()
    isa_circuit = pm.run(qc)

    job = sampler.run([isa_circuit], shots = no_of_shots)
    result = job.result()
    counts = result[0].data.meas.get_counts()
    
    bitstrings = []
    for bitstring in list(counts.keys()):
        bitstrings.append(bitstring)

    return bitstrings