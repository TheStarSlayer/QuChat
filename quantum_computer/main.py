from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Literal

from starlette.concurrency import run_in_threadpool

import asyncio

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

powers_of_two = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024]

origins = []
if os.getenv("PROD") == "true":
    origins.append(os.getenv("SERVER_ADDR"))
else:
    origins.append("http://localhost:8595")
    origins.append("http://localhost:8596")

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
protected_routes = [
    "distributeRawKey", "deleteMetadata", "getRandomIndices",
    "generateECMetadata", "correctErrorsInKey"
]

db_client = pymongo.MongoClient(os.getenv("MONGODB_CONN"))
database = db_client["test"]

q_service = QiskitRuntimeService(
    token=os.getenv("QC_API_KEY"),
    instance="quchat-key"
)
simulator_job_store = {}

bch = BCHCode(2, 511, 15, 1)

@app.middleware("http")
async def authorize_call(
    request: Request,
    call_next
):
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
def random_num_generator(
    typeOfMachine: Literal["sim", "hw"],
    bit_length: int = 156,
    no_of_shots: int = 1
) -> list[str | None] | tuple[str, int, int, int, str]:
    
    if bit_length < 1 or no_of_shots < 1:
        return []
    
    adj_shots = no_of_shots
    if bit_length > 156:
        adj_shots += ((bit_length // 156) - 1) * no_of_shots
        if bit_length % 156 != 0:
            adj_shots += no_of_shots
    
    adj_bitlength = 156 if bit_length > 156 else bit_length
    
    qc = QuantumCircuit(adj_bitlength)
    qc.h(range(adj_bitlength))
    qc.measure_all()
    
    if typeOfMachine == "sim":
        q_backend = AerSimulator()
        sampler = BackendSamplerV2(backend=q_backend)
        isa_circuit = qc
    else:
        q_backend = q_service.least_busy(simulator=False, min_num_qubits=156)
        pm = generate_preset_pass_manager(backend=q_backend, optimization_level=1)
        sampler = Sampler(q_backend)
        isa_circuit = pm.run(qc)
        
    job = sampler.run([isa_circuit], shots=adj_shots)
    job_id = job.job_id()
    
    if typeOfMachine == "sim":
        simulator_job_store[job_id] = job
        
    return (job_id, adj_shots, no_of_shots, bit_length, typeOfMachine)

@app.get("/generateAndRunBB84Circuit")
def generateAndRunBB84Circuit(
    sender_bit_str: str,
    sender_bases_str: str,
    receiver_bases_str: str,
    typeOfMachine: Literal["sim", "hw"],
) -> str | tuple[list, list, str]:
    """
        Default base: Z (0)
        Bits: 0 -> |0>
              1 -> |1>
              
        Alternate base: X (1)
        Bits: 0 -> |+>
              1 -> |->
    """
    
    og_bit_length = len(sender_bit_str)
    quantum_circuits = []
    step = og_bit_length // 156
    
    if typeOfMachine == "sim":
        backend = AerSimulator()
        sampler = BackendSamplerV2(backend=backend)
        pm = None
    else:
        backend = q_service.least_busy(simulator=False, min_num_qubits=156)
        sampler = Sampler(backend)
        pm = generate_preset_pass_manager(backend=backend, optimization_level=1)
    
    for i in range(step):
        bit_length = 156
        
        start_index = bit_length * i
        end_index = start_index + 156
        
        qc = quantum_circuit(
            bit_length=bit_length,
            sender_bit_str=sender_bit_str[start_index:end_index],
            sender_bases_str=sender_bases_str[start_index:end_index],
            receiver_bases_str=receiver_bases_str[start_index:end_index]
        )
        
        quantum_circuits.append(qc)
        
    if og_bit_length % 156 != 0:
        bit_length = og_bit_length % 156
        
        start_index = step * 156
        end_index = start_index + bit_length
        
        qc = quantum_circuit(
            bit_length=bit_length,
            sender_bit_str=sender_bit_str[start_index:end_index],
            sender_bases_str=sender_bases_str[start_index:end_index],
            receiver_bases_str=receiver_bases_str[start_index:end_index]
        )
        
        quantum_circuits.append(qc)
    
    isa_circuit = [qc if typeOfMachine == "sim" else pm.run(qc) for qc in quantum_circuits]
    isa_circuits = []
    
    for i in range(0, len(isa_circuit), 3):
        isa_circuits.append(isa_circuit[i:i+3])
    
    job_list = []
    for i in range(len(isa_circuits)):
        job = sampler.run(isa_circuits[i], shots=1)
        job_id = job.job_id()
        
        if typeOfMachine == "sim":
            simulator_job_store[job_id] = job
            
        job_list.append(job_id)

    return (job_list, isa_circuits, typeOfMachine)

@app.get("/distributeRawKey/{roomId}")
async def distribute_raw_key(
    request: Request,
    roomId: str
):
    """
        AES requires a minimum of 128 bit key
        We assume 50% of generated bits to be sifted away in BB84 (to generate: 256 bits)
        We also remove maximum of 15% of sifted key for QBER calculation (to generate: ~ 376 bits)
        
        These are lower bounds; considering extra bits will only increase the entropy of the key
        So we will generate 511 bit key
    """
    
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
    job_db = database["job_db"]
    
    if userId == roomRequest["sender"]:
        deleteMetadataHelper(roomId)
            
        circuit_metadata_dict = {
            "roomId": roomId,
            "senderBases": None,
            "senderBits": None,
            "generatingMetadata": True
        }
        circuit_metadata.insert_one(circuit_metadata_dict)
        
        job_db_dict = {
            "roomId": roomId,
            "hardwareJobs": [],
            "simulatorJobs": []
        }
        job_db.insert_one(job_db_dict)
        
        bitstrings = random_num_generator(typeOfMachine=typeOfMachine, bit_length=511, no_of_shots=2)
        
        if not isinstance(bitstrings, list):
            job_id = bitstrings[0]
            if typeOfMachine == "sim":
                job_db.update_one(
                    { "roomId": roomId },
                    { "$push": { "simulatorJobs": job_id } }
                )
            else:
                job_db.update_one(
                    { "roomId": roomId },
                    {"$push": { "hardwareJobs": job_id }}
                )
                
            bitstrings = await check_for_random_number(bitstrings)
            if bitstrings is None:
                return JSONResponse(status_code=408, content={ "error": "Request timed out" })
            
            if typeOfMachine == "sim":
                job_db.update_one(
                    { "roomId": roomId },
                    { "$pull": { "simulatorJobs": job_id } }
                )
            else:
                job_db.update_one(
                    { "roomId": roomId },
                    { "$pull": { "simulatorJobs": job_id } }
                )
        
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
        
        bases_list = random_num_generator(typeOfMachine=typeOfMachine, bit_length=511, no_of_shots=1)
        
        if not isinstance(bases_list, list):
            job_id = bases_list[0]
            if typeOfMachine == "sim":
                job_db.update_one(
                    { "roomId": roomId },
                    { "$push": { "simulatorJobs": job_id } }
                )
            else:
                job_db.update_one(
                    { "roomId": roomId },
                    {"$push": { "hardwareJobs": job_id }}
                )
                
            bases_list = await check_for_random_number(bases_list)
            if bases_list is None:
                return JSONResponse(status_code=408, content={ "error": "Request timed out" })
            
            if typeOfMachine == "sim":
                job_db.update_one(
                    { "roomId": roomId },
                    { "$pull": { "simulatorJobs": job_id } }
                )
            else:
                job_db.update_one(
                    { "roomId": roomId },
                    { "$pull": { "simulatorJobs": job_id } }
                )
            
        bases = bases_list[0]
        observed_bits = generateAndRunBB84Circuit(
            sender_bit_str=metadata["senderBits"],
            sender_bases_str=metadata["senderBases"],
            receiver_bases_str=bases,
            typeOfMachine=typeOfMachine
        )

        if not isinstance(observed_bits, str):
            job_list = observed_bits[0]
            if typeOfMachine == "sim":
                job_db.update_one(
                    { "roomId": roomId },
                    { "$push": { "simulatorJobs": {
                        "$each": job_list   
                    }}}
                )
            else:
                job_db.update_one(
                    { "roomId": roomId },
                    { "$push": { "simulatorJobs": {
                        "$each": job_list   
                    }}}
                )
                
            observed_bits = await check_for_circuit_results(observed_bits)
            if observed_bits is None:
                return JSONResponse(status_code=408, content={ "error": "Request timed out" })
            
            if typeOfMachine == "sim":
                job_db.update_one(
                    { "roomId": roomId },
                    { "$pull": { "simulatorJobs": {
                        "$in": job_list   
                    }}}
                )
            else:
                job_db.update_one(
                    { "roomId": roomId },
                    { "$pull": { "simulatorJobs": {
                        "$in": job_list   
                    }}}
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

def quantum_circuit(
    bit_length,
    sender_bit_str,
    sender_bases_str,
    receiver_bases_str
):
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
        
    return qc

@app.get("/getRandomIndices/{typeOfMachine}")
async def random_indices_generator(
    request: Request,
    typeOfMachine: Literal["sim", "hw"],
    keyLength: int = 156
):
    if keyLength >= 1024:
        return JSONResponse(
            status_code=400,
            content={ "message": "Does not support key length greater than 1023" }
        )
        
    if keyLength - 156 < 20:
        min_length = math.floor(0.1 * keyLength)
        def_length = math.floor(0.15 * keyLength)
    else:
        min_length = math.floor(0.2 * keyLength)
        def_length = math.floor(0.3 * keyLength)

    no_of_bits = max(1, math.ceil(math.log2(keyLength)))
    
    roomId = request.state.user
    
    observed_indices = await random_indices_gen_helper(keyLength, typeOfMachine, def_length, no_of_bits, roomId)
    if observed_indices is None:
        return JSONResponse(status_code=408, content={ "error": "Request timed out" })
    
    while len(observed_indices) < min_length:
        new_indices = await random_indices_gen_helper(keyLength, typeOfMachine, min_length, no_of_bits, roomId)
        if new_indices is None:
            return JSONResponse(status_code=408, content={ "error": "Request timed out" })
        observed_indices.update(new_indices)
    
    observed_indices_list = list(observed_indices)
    observed_indices_list.sort()
    
    job_db = database["job_db"]
    job_db.delete_one({ "roomId": roomId })
    
    return JSONResponse(
        status_code=200,
        content={ "randIndices": observed_indices_list }
    )

async def random_indices_gen_helper(
    keyLength: int,
    typeOfMachine: Literal["sim", "hw"],
    no_of_indices: int,
    no_of_bits: int,
    roomId: str
) -> set | None:
    
    observed_indices = set()
    indices_bitstring = random_num_generator(typeOfMachine, no_of_bits, no_of_indices)
    
    job_db = database["job_db"]
    
    if not isinstance(indices_bitstring, list):
        job_id = indices_bitstring[0]
        
        if typeOfMachine == "sim":
            job_db.update_one(
                { "roomId": roomId },
                { "$push": { "simulatorJobs": job_id } }
            )
        else:
            job_db.update_one(
                { "roomId": roomId },
                {"$push": { "hardwareJobs": job_id }}
            )
            
        indices_bitstring = await check_for_random_number(indices_bitstring)
        if indices_bitstring is None:
            return None
        
        if typeOfMachine == "sim":
            job_db.update_one(
                { "roomId": roomId },
                { "$pull": { "simulatorJobs": job_id } }
            )
        else:
            job_db.update_one(
                { "roomId": roomId },
                { "$pull": { "simulatorJobs": job_id } }
            )
            
    for bitstring in indices_bitstring:
        index = 0
        for i in range(0, no_of_bits):
            if (bitstring[i] == "1"):
                index += powers_of_two[no_of_bits-1-i]
        if index < keyLength:
            observed_indices.add(index)

    return observed_indices

def poll_for_random_numbers(
    job_id,
    adj_shots: int,
    no_of_shots: int,
    bit_length: int,
    typeOfMachine: str
) -> list[str | None] | str:
    
    if typeOfMachine == "hw":
        job = q_service.job(job_id)
        job_status = job.status()
    else:
        job = simulator_job_store[job_id]
        job_status = job.status().name
    
    print("Random Num: ", job_status)
    
    if job_status in ["ERROR", "CANCELLED"]:
        return None
    
    if job_status == "DONE":
        result = job.result()
        counts = result[0].data.meas.get_counts()
        list_of_rn = list(counts.keys())

        if adj_shots > no_of_shots:
            adj_list_of_rn = []
            step = int(adj_shots/no_of_shots)
            
            for i in range(0, adj_shots, step):
                bitstring = ""
                for j in range(step):
                    bitstring += list_of_rn[i + j]
                adj_list_of_rn.append(bitstring[:bit_length])

            return adj_list_of_rn
        return list_of_rn
    return "Try later"
    
async def check_for_random_number(job_details):
    await asyncio.sleep(5)
    
    job_id, adj_shots, no_of_shots, bit_length, typeOfMachine = job_details
    
    counter = 0
    while True:
        random_numbers = poll_for_random_numbers(job_id, adj_shots, no_of_shots, bit_length, typeOfMachine)
        
        if isinstance(random_numbers, list):
            if typeOfMachine == "sim":
                del simulator_job_store[job_id]
            return random_numbers
        
        if counter > 20 or random_numbers is None:
            delete_job(job_id, typeOfMachine)
            if typeOfMachine == "sim":
                del simulator_job_store[job_id]
                
            return None
        
        counter += 1
        await asyncio.sleep(10)

def poll_for_circuit_results(job_list, typeOfMachine):
    for jid in job_list:
        
        if typeOfMachine == "sim":
            job = simulator_job_store[jid]
            job_status = job.status().name
        else:
            job = q_service.job(jid)
            job_status = job.status()
            
        print("Circuit results: ", job_status)
        
        if job_status in ["ERROR", "CANCELLED"]:
            return "Failed"

        if job_status != "DONE":
            return "Try later"
    
    return "Done"
        
async def check_for_circuit_results(job_metadata):
    job_list, isa_circuits, typeOfMachine = job_metadata
    
    await asyncio.sleep(5)
    counter = 0
    
    while True:
        all_job_status = poll_for_circuit_results(job_list, typeOfMachine)
        if all_job_status == "Done":
            break
        
        if counter > 40 or all_job_status == "Failed":
            for jid in job_list:
                delete_job(jid, typeOfMachine)
                if typeOfMachine == "sim":
                    del simulator_job_store[jid]
            return None
        
        counter += 1
        await asyncio.sleep(10)
    
    observed_bits = ""
    
    for i in range(len(isa_circuits)):
        if typeOfMachine == "sim":
            job = simulator_job_store[job_list[i]]
        else:
            job = q_service.job(job_list[i])
            
        result = job.result()
        
        for j in range(len(isa_circuits[i])):
            counts = result[j].data.c.get_counts()
            key = list(counts.keys())[0]
            meas = list(key)
            observed_bits += ''.join(meas)[::-1]
        
        del simulator_job_store[job_list[i]]
                
    return observed_bits
            
def delete_job(job_id, typeOfMachine):
    if typeOfMachine == "hw":
        job = q_service.job(job_id)
    else:
        job = simulator_job_store[job_id]
        
    job_status = job.status()
    if not isinstance(job_status, str):
        job_status = job_status.name
    
    if job_status in ["DONE", "ERROR", "CANCELLED"]:
        print("Job is already closed: ", job_id)
        return True
    
    try:
        job.cancel()
        print("Closed: ", job_id)
        return True
    except:
        pass
    
    return False

def deleteMetadataHelper(roomId: str):
    circuit_metadata = database["circuit_metadata"]
    job_db = database["job_db"]
    
    circuit_metadata.delete_one({ 'roomId': roomId })
    room_job = job_db.find_one_and_delete({ "roomId": roomId })
    
    if room_job is not None:
        simulator_jobs = room_job["simulatorJobs"]
        hardware_jobs = room_job["hardwareJobs"]
        
        for job_id in simulator_jobs:
            try:
                delete_job(job_id, "sim")
            except:
                print("Could not close job ", job_id)
                
            del simulator_job_store[job_id] 
            
        for job_id in hardware_jobs:
            try:
                delete_job(job_id, "hw")
            except:
                print("Could not close job ", job_id)

@app.delete("/deleteMetadata/{roomId}")
async def deleteMetadata(
    roomId: str
):
    deleteMetadataHelper(roomId)
    return Response(status_code=204)

class ECInput(BaseModel):
    key: str
    
@app.post("/generateECMetadata")
async def generateECMetadata(ECInput: ECInput):
    key_list = [int(i) for i in ECInput.key]
    encoded_key = await run_in_threadpool(bch.encode, key_list)
    parity_bits = encoded_key[len(ECInput.key)::]
    
    parity_bits_str = ""
    for i in range(len(parity_bits)):
        parity_bits_str += str(parity_bits[i])
    
    return JSONResponse(status_code=200, content={ "parityBits": parity_bits_str })

@app.post("/correctErrorsInKey")
async def correctErrors(ECInput: ECInput):
    key_list = [int(i) for i in ECInput.key]
    corrected_key = await run_in_threadpool(bch.decode, key_list)
    
    corrected_key_str = ""
    for i in range(len(corrected_key)):
        corrected_key_str += str(corrected_key[i])
        
    return JSONResponse(status_code=200, content={ "key": corrected_key_str })
