"""
Локальный бэкенд: сторонний ризонер OWL 2 RL (библиотека owlrl).

Модуль «Оценка сложности системы» умеет выводить отношения r2–r5 двумя способами:
  1) встроенным JS-ризонером — работает офлайн, если просто открыть index.html;
  2) этим сервисом на owlrl — настоящий сторонний OWL 2 RL ризонер.

Запуск:
    pip install -r requirements.txt
    uvicorn app:app --host 127.0.0.1 --port 8000
    # затем открыть http://127.0.0.1:8000
"""
from pathlib import Path

import rdflib
from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from owlrl import DeductiveClosure, OWLRL_Semantics
from pydantic import BaseModel

BASE = Path(__file__).resolve().parent
NS = "http://system-analysis.local/graph#"
PREFIXES = (
    f"@prefix : <{NS}> .\n"
    "@prefix owl: <http://www.w3.org/2002/07/owl#> .\n"
    "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n"
)
MEASURE = ("r1", "r2", "r3", "r4", "r5")
ALLOWED_EXT = {".html", ".js", ".css", ".svg", ".png", ".ico"}
DENY_PARTS = {"tasks", ".git", ".claude"}


class ReasonRequest(BaseModel):
    turtle: str
    mode: str = "rl"


app = FastAPI(title="System Analysis — OWL 2 RL reasoner (owlrl)")


@app.get("/health")
def health():
    return {"status": "ok", "reasoner": "owlrl", "profile": "OWL 2 RL"}


@app.post("/reason")
def reason(req: ReasonRequest):
    if req.mode == "dl":
        return JSONResponse(
            status_code=501,
            content={"error": "OWL 2 DL (HermiT) не подключён. Используйте mode='rl'."},
        )

    g = rdflib.Graph()
    try:
        g.parse(data=PREFIXES + "\n" + req.turtle, format="turtle")
    except Exception as exc:  # noqa: BLE001
        return JSONResponse(status_code=400, content={"error": f"Ошибка разбора Turtle: {exc}"})

    # OWL 2 RL: полное замыкание набора правил профиля
    DeductiveClosure(OWLRL_Semantics).expand(g)

    relations = {}
    for p in MEASURE:
        pred = rdflib.URIRef(NS + p)
        pairs = []
        for s, _, o in g.triples((None, pred, None)):
            if not (isinstance(s, rdflib.URIRef) and isinstance(o, rdflib.URIRef)):
                continue
            s_str, o_str = str(s), str(o)
            if not s_str.startswith(NS) or not o_str.startswith(NS):
                continue
            ss, oo = s_str[len(NS):], o_str[len(NS):]
            # В эталонной онтологии r5(x,x) — артефакт цепочки; нужны точные пары x != y
            if p == "r5" and ss == oo:
                continue
            pairs.append([ss, oo])
        relations[p] = sorted(pairs)

    return {"mode": "rl", "reasoner": "owlrl", "relations": relations}


# --- Раздача статики (после API-маршрутов) ---
@app.get("/")
def index():
    return FileResponse(BASE / "index.html")


@app.get("/{path:path}")
def static_file(path: str):
    target = (BASE / path).resolve()
    try:
        rel = target.relative_to(BASE)
    except ValueError:
        return JSONResponse(status_code=404, content={"error": "not found"})
    if any(part in DENY_PARTS for part in rel.parts):
        return JSONResponse(status_code=404, content={"error": "not found"})
    if target.is_dir():
        target = target / "index.html"
    if target.is_file() and target.suffix.lower() in ALLOWED_EXT:
        return FileResponse(target)
    return JSONResponse(status_code=404, content={"error": "not found"})
