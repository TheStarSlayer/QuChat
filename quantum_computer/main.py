from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Literal

from pydantic import BaseModel

from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2 as Sampler
from qiskit_aer import AerSimulator
from qiskit.primitives import BackendSamplerV2

from qiskit.transpiler import generate_preset_pass_manager
from qiskit import QuantumCircuit

import os
from dotenv import load_dotenv
import math

import pymongo
from pymongo import ReturnDocument

from lib.BCHCode import BCHCode

load_dotenv()

app = FastAPI()

bch = BCHCode(2, 255, 15, 1)

powers_of_two = [1, 2, 4, 8, 16, 32, 64, 128, 256]

origins = []
if os.getenv("PROD") == "true":
    origins.append(os.getenv("SERVER_ADDR"))
else:
    origins.append("http://localhost:8595")
    origins.append("http://localhost:8596")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db_client = pymongo.MongoClient(os.getenv("MONGODB_CONN"))
database = db_client["test"]

q_service = QiskitRuntimeService(
    token=os.getenv("QC_API_KEY"),
    instance="quchat-key"
)

protected_routes = [
    "distributeRawKey", "deleteMetadata", "getRandomIndices",
    "generateECMetadata", "correctErrorsInKey"
]

@app.middleware("http")
async def authorize_call(
    request: Request,
    call_next
):
    # Don't block OPTIONS
    if request.method == "OPTIONS":
        return await call_next(request)
    
    if request.url.path.split("/")[1] not in protected_routes:
        return await call_next(request)
    
    auth_header = request.headers.get("Authorization")
    
    if not auth_header or not auth_header.startswith("Bearer "):
        return JSONResponse(status_code=400, content={"error": "Unauthorized"})

    import jwt
    
    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, os.getenv("ACCESS_TOKEN_SECRET"), algorithms=["HS256"])
    except:
        print("jwt expired")
        return JSONResponse(status_code=401, content={"error": "Unauthorized"})

    request.state.user = payload["userId"]
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
        q_backend = AerSimulator()
        sampler = BackendSamplerV2(backend=q_backend)
        isa_circuit = qc
    else:
        q_backend = q_service.least_busy(simulator=False, min_num_qubits=bit_length)
        pm = generate_preset_pass_manager(backend=q_backend, optimization_level=1)
        sampler = Sampler(q_backend)
        isa_circuit = pm.run(qc)
        
    job = sampler.run([isa_circuit], shots=no_of_shots)
    
    result = job.result()
    counts = result[0].data.meas.get_counts()

    return list(counts.keys())

@app.get("/getRandomIndices/{typeOfMachine}")
async def random_indices_generator(
    typeOfMachine: Literal["sim", "hw"],
    keyLength: int = 78
) -> list[int | None]:
    
    if keyLength >= 512:
        return JSONResponse(
            status_code=400,
            content={ "message": "Does not support key length greater than 511" }
        )

    min_length = math.floor(0.1 * keyLength)
    def_length = math.floor(0.15 * keyLength)
    no_of_bits = max(1, math.ceil(math.log2(keyLength)))
    
    observed_indices = await random_indices_gen_helper(keyLength, typeOfMachine, def_length, no_of_bits)
        
    while len(observed_indices) < min_length:
        new_indices = await random_indices_gen_helper(keyLength, typeOfMachine, min_length, no_of_bits)
        observed_indices.update(new_indices)
    
    observed_indices_list = list(observed_indices)
    observed_indices_list.sort()
    
    return JSONResponse(
        status_code=200,
        content={ "randIndices": observed_indices_list }
    )

async def random_indices_gen_helper(
    keyLength: int,
    typeOfMachine: Literal["sim", "hw"],
    no_of_indices: int,
    no_of_bits: int
):    
    observed_indices = set()
    indices_bitstring = await random_num_generator(typeOfMachine, str(no_of_bits), str(no_of_indices))
    
    for bitstring in indices_bitstring:
        index = 0
        for i in range(0, no_of_bits):
            if (bitstring[i] == "1"):
                index += powers_of_two[no_of_bits-1-i]
        if index < keyLength:
            observed_indices.add(index)

    return observed_indices

@app.get("/distributeRawKey/{roomId}")
async def distribute_raw_key(
    request: Request,
    roomId: str
):
    requests = database["requestmodels"]
    
    request_find_filter = {
        "sender": roomId,
        "status": "accepted" 
    }
    request_select_filter = {
        "sender": 1, "receiver": 1, "_id": 0,
        "eavesdropper": 1, "eavesdropperId": 1,
        "isSimulator": 1,
    }
    
    roomRequest = requests.find_one(
        request_find_filter,
        projection=request_select_filter,
        sort=[("createdOn", -1)]
    )
    
    if not roomRequest:
        return JSONResponse(
            status_code=404,
            content={ "error": "Room ID does not exist" }
        )
        
    typeOfMachine = "sim" if roomRequest["isSimulator"] else "hw"
    userId = request.state.user
    circuit_metadata = database["circuit_metadata"]
    
    if userId == roomRequest["sender"]:
        does_metadata_exists = circuit_metadata.find_one({ "roomId": roomId })
        if does_metadata_exists:
            circuit_metadata.delete_one({ "roomId": roomId })
            
        circuit_metadata_dict = {
            "roomId": roomId,
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
    
    if userId == roomRequest["eavesdropperId"] or userId == roomRequest["receiver"]:
        metadata_find_filter = {
            "roomId": roomId,
            "generatingMetadata": False
        }
        metadata_select_filter = {
            "senderBases": 1, "senderBits": 1, "_id": 0
        }

        metadata = circuit_metadata.find_one_and_update(
            metadata_find_filter, 
            {
                "$set": { "generatingMetadata": True }
            },
            projection=metadata_select_filter,
            return_document=ReturnDocument.BEFORE
        )

        if metadata is None:
            return JSONResponse(
                status_code=425,
                content={ "message": "Call again later" }
            )
        
        bases = (await random_num_generator(typeOfMachine=typeOfMachine))[0]
        
        observed_bits = await generateAndRunBB84Circuit(
            sender_bit_str=metadata["senderBits"],
            sender_bases_str=metadata["senderBases"],
            receiver_bases_str=bases,
            typeOfMachine=typeOfMachine,
            bit_length=156
        )
        
        if userId == roomRequest["eavesdropperId"]:
            updated_metadata_dict = {
                "senderBases": bases,
                "senderBits": observed_bits,
                "generatingMetadata": False
            }
            circuit_metadata.update_one({ "roomId": roomId }, { "$set": updated_metadata_dict })
                    
        if userId == roomRequest["receiver"]:
            circuit_metadata.delete_one({ "roomId": roomId })        
        
        return JSONResponse(
            status_code=200,
            content={ "bases": bases, "bits": observed_bits }
        )  
        
    return JSONResponse(
        status_code=400,
        content={ "error": "User is not related to request" }
    )

@app.get("/generateAndRunBB84Circuit")
async def generateAndRunBB84Circuit(
    sender_bit_str: str,
    sender_bases_str: str,
    receiver_bases_str: str,
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
    qc = QuantumCircuit(bit_length, bit_length)
    
    sender_bits = [int(i) for i in sender_bit_str]
    sender_bases = [int(i) for i in sender_bases_str]
    receiver_bases = [int(i) for i in receiver_bases_str]
    
    for i in range(bit_length):
        if sender_bits[i] == 0:
            if sender_bases[i] == 1:
                qc.h(i)
        if sender_bits[i] == 1:
            if sender_bases[i] == 0:
                qc.x(i)
            if sender_bases[i] == 1:
                qc.x(i)
                qc.h(i)
        
    for i in range(bit_length):
        if receiver_bases[i] == 1:
            qc.h(i)
        qc.measure(i, i)
    
    if (typeOfMachine == "sim"):
        backend = AerSimulator()
        sampler = BackendSamplerV2(backend=backend)
        isa_circuit = qc
    else:
        backend = q_service.least_busy(simulator=False, min_num_qubits=bit_length)
        sampler = Sampler(backend)
        pm = generate_preset_pass_manager(backend=backend, optimization_level=1)
        isa_circuit = pm.run(qc)

    job = sampler.run([isa_circuit], shots=1)
    result = job.result()
    counts = result[0].data.c.get_counts()
    
    key = list(counts.keys())[0]
    meas = list(key)
    observed_bits = ''.join(meas)
        
    return observed_bits[::-1]

@app.delete("/deleteMetadata/{roomId}")
async def deleteMetadata(
    roomId: str
):
    circuit_metadata = database["circuit_metadata"]
    circuit_metadata.delete_one({ 'roomId': roomId })
    return Response(status_code=204)

class ECInput(BaseModel):
    key: str
    
@app.post("/generateECMetadata")
async def generateECMetadata(ECInput: ECInput):
    key_list = [int(i) for i in ECInput.key]
    encoded_key = bch.encode(key_list)
    parity_bits = encoded_key[len(ECInput.key)::]
    
    parity_bits_str = ""
    for i in range(len(parity_bits)):
        parity_bits_str += str(parity_bits[i])
    
    return JSONResponse(status_code=200, content={ "parityBits": parity_bits_str })

@app.post("/correctErrorsInKey")
async def correctErrors(ECInput: ECInput):
    key_list = [int(i) for i in ECInput.key]
    corrected_key = bch.decode(key_list)
    
    corrected_key_str = ""
    for i in range(len(corrected_key)):
        corrected_key_str += str(corrected_key[i])
        
    return JSONResponse(status_code=200, content={ "key": corrected_key_str })
