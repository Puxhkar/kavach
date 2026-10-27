VENV ?= .venv
PY := $(VENV)/bin/python

venv:
	uv venv --python 3.13 $(VENV)

install: venv
	uv pip install --python $(PY) -r requirements.txt -r requirements-dev.txt

run:
	ENVIRONMENT=local $(PY) -m uvicorn main:app --reload --port 8010

# No Mongo running locally? Keep everything in process memory (lost on restart).
run-memory:
	ENVIRONMENT=local STORAGE_BACKEND=memory $(PY) -m uvicorn main:app --reload --port 8010

test:
	$(PY) -m pytest

# Also runs the Mongo repository tests against the local narada-mongo container.
test-mongo:
	NARADA_TEST_MONGO_URL=mongodb://localhost:27217 $(PY) -m pytest

# Loads three example agents into the running service (for UI work).
seed:
	$(PY) scripts/seed_examples.py

lint:
	$(VENV)/bin/ruff check app tests main.py scripts

format:
	$(VENV)/bin/ruff format app tests main.py scripts
