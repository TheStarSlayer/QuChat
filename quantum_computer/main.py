from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from typing import Literal

from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2 as Sampler

from qiskit_aer import AerSimulator
from qiskit_aer.primitives import SamplerV2 as AerSampler
from qiskit_ibm_runtime.fake_provider import FakeMarrakesh

from qiskit.transpiler import generate_preset_pass_manager
from qiskit import QuantumCircuit

import os
from dotenv import load_dotenv

import pymongo

app = FastAPI()

load_dotenv()

db_client = pymongo.MongoClient(os.getenv("MONGODB_CONN"))
database = db_client["test"]

q_service = QiskitRuntimeService(
    token=os.getenv("API_KEY"),
    instance="quchat-key"
)

@app.middleware("http")
async def authorize_call(
    request: Request,
    call_next
):
    if request.url.path.split("/")[1] != "distributeRawKey":
        return await call_next(request)
    
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})

    import jwt
    
    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, os.getenv("ACCESS_TOKEN_SECRET"), algorithms=["HS256"])
    except:
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})

    request.state.user = payload.userId
    return await call_next(request)

@app.get("/rng/{typeOfMachine}")
async def random_num_generator(
    typeOfMachine: Literal["sim", "hw"],
    bit_length: str = "156",
    no_of_shots: str = "1"
) -> list[str | None]:
    
    bit_length = int(bit_length)
    no_of_shots = int(no_of_shots)

    if (bit_length < 1 or bit_length > 156 or no_of_shots < 1):
        return []
    
    qc = QuantumCircuit(bit_length)
    qc.h(range(bit_length))
    qc.measure_all()
    
    if (typeOfMachine == "sim"):
        q_backend = AerSimulator.from_backend(FakeMarrakesh())
    else:
        q_backend = q_service.least_busy(simulator=False, min_num_qubits=bit_length)
    
    pm = generate_preset_pass_manager(backend=q_backend, optimization_level=1)
    isa_circuit = pm.run(qc)

    if (typeOfMachine == 'sim'):
        sampler = AerSampler()
        job = sampler.run([isa_circuit], shots=no_of_shots)
    else:
        sampler = Sampler(q_backend)
        job = sampler.run([isa_circuit], shots=no_of_shots)
    
    result = job.result()
    counts = result[0].data.meas.get_counts()
    
    return list(counts.keys())

@app.get("/distributeRawKey/{roomId}")
async def distribute_raw_key(
    request: Request,
    roomId: str,
):
    requests = database["requestmodels"]
    
    request_find_filter = {
        "sender": roomId,
        "status": "accepted"
    }
    request_select_filter = {
        "sender": 1, "receiver": 1, "_id": 0,
        "eavesdropper": 1, "eavesdropperId": 1,
        "isSimulator": 1
    }
    roomRequest = requests.find_one(request_find_filter, request_select_filter)
    
    if not roomRequest:
        return JSONResponse(
            status_code=404,
            content={ "error": "Room ID does not exist" }
        )
        
    typeOfMachine = "sim" if roomRequest.isSimulator else "hw"
    userId = request.state.user
    circuit_metadata = database["circuit_metadata"]
    
    if userId == request.sender:
        does_metadata_exists = circuit_metadata.find_one({ "roomId": roomId })
        if does_metadata_exists:
            circuit_metadata.delete_one({ "roomId": roomId })
            
        circuit_metadata_dict = {
            "roomId": userId,
            "senderBases": None,
            "senderBits": None,
            "generatingMetadata": True
        }
        circuit_metadata.insert_one(circuit_metadata_dict)
        
        bitstrings = await random_num_generator(typeOfMachine=typeOfMachine, bit_length="156", no_of_shots="2")
        
        updated_metadata_dict = {
            "senderBases": bitstrings[0],
            "senderBits": bitstrings[1],
            "generatingMetadata": False
        }
        circuit_metadata.update_one({ "roomId": roomId }, { "$set": updated_metadata_dict })
        
        return JSONResponse(
            status_code=200,
            content={ "bases": bitstrings[0], "bits": bitstrings[1] }
        )        
    
    if userId == request.eavesdropperId or userId == request.receiver:
        metadata_find_filter = {
            "roomId": roomId,
            "generatingMetadata": False
        }
        metadata_select_filter = {
            "senderBases": 1, "senderBits": 1, "_id": 0
        }
        metadata = circuit_metadata.find_one(metadata_find_filter, metadata_select_filter)

        if not metadata:
            return JSONResponse(
                status_code=425,
                content={ "message": "Call again later" }
            )
        
        circuit_metadata.update_one(metadata_find_filter, { "$set": { "generatingMetadata": True } })
        
        bases = (await random_num_generator(typeOfMachine=typeOfMachine))[0]
        
        observed_bits = await generateAndRunBB84Circuit(
            sender_bits=metadata.senderBits,
            sender_bases=metadata.senderBases,
            receiver_bases=bases,
            typeOfMachine=typeOfMachine,
            bit_length=156
        )
        
        if userId == request.eavesdropperId:
            updated_metadata_dict = {
                "senderBases": bases,
                "senderBits": observed_bits,
                "generatingMetadata": False
            }
            circuit_metadata.update_one({ "roomId": roomId }, { "$set": updated_metadata_dict })
                    
        if userId == request.receiver:
            circuit_metadata.delete_one({ "roomId": roomId })        
        
        return JSONResponse(
            status_code=200,
            content={ "bases": bitstrings[0], "bits": bitstrings[1] }
        )  
        
    return JSONResponse(
        status_code=400,
        content={ "error": "User is not related to request" }
    )

@app.get("/generateAndRunBB84Circuit")
async def generateAndRunBB84Circuit(
    sender_bits: str,
    sender_bases: str,
    receiver_bases: str,
    typeOfMachine: Literal["sim", "hw"],
    bit_length: int = 156,
) -> str | None:
    """
        Default base: Z (0)
        Bits: 0 -> |0>
              1 -> |1>
              
        Alternate base: X (1)
        Bits: 0 -> |+>
              1 -> |->
    """
    qc = QuantumCircuit(bit_length)
    
    for i in range(bit_length):
        if sender_bases[i] == '1':
            qc.h(i)
        
        if sender_bits[i] == '1':
            qc.x(i)
            
        if receiver_bases[i] == '1':
            qc.h(i)
            
    qc.measure_all()
    
    if (typeOfMachine == "sim"):
        q_backend = AerSimulator.from_backend(FakeMarrakesh())
    else:
        q_backend = q_service.least_busy(simulator=False, min_num_qubits=bit_length)
    
    pm = generate_preset_pass_manager(backend=q_backend, optimization_level=1)
    isa_circuit = pm.run(qc)

    if (typeOfMachine == 'sim'):
        sampler = AerSampler()
        job = sampler.run([isa_circuit], shots=1)
    else:
        sampler = Sampler(q_backend)
        job = sampler.run([isa_circuit], shots=1)
    
    result = job.result()
    counts = result[0].data.meas.get_counts()
    
    return list(counts.keys())[0]