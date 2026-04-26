from invoke import task

@task
def run(c):
    c.run("uvicorn main:app --host \"localhost\" --port \"8598\"")

@task
def build(c):
    c.run("docker build --no-cache -t quantum-service .")
    c.run("docker tag quchat thestarslayer/quantum-service:latest")
    c.run("docker push thestarslayer/quantum-service:latest")