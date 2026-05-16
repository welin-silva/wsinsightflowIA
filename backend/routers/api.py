import io
import asyncio
import logging
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import pandas as pd

from services.ml_service import analyze_dataset, predict, retrain_with_model, retype_problem
from services.ai_agent import generate_insights, chat_with_siri
import services.session_manager as SM

logger = logging.getLogger(__name__)
router = APIRouter()


_MAX_CSV_BYTES = 20 * 1024 * 1024  # 20 MB hard limit


def _read_csv_robust(contents: bytes) -> "pd.DataFrame":
    """Try multiple separator/encoding combos until one succeeds."""
    attempts = [
        ("utf-8",  ","),
        ("utf-8",  ";"),
        ("utf-8",  "\t"),
        ("latin1", ","),
        ("latin1", ";"),
        ("latin1", "\t"),
    ]
    last_err = None
    for encoding, sep in attempts:
        label = "tab" if sep == "\t" else sep
        logger.info("[CSV] trying %s %s", encoding, label)
        try:
            df = pd.read_csv(
                io.BytesIO(contents),
                sep=sep,
                encoding=encoding,
                on_bad_lines="skip",
                engine="python",
            )
            if df.empty or len(df.columns) < 2:
                continue
            logger.info("[CSV] loaded successfully — separator=%r encoding=%s rows=%d cols=%d",
                        sep, encoding, len(df), len(df.columns))
            return df
        except Exception as e:
            last_err = e
    raise HTTPException(status_code=422, detail=f"Failed to parse CSV after all attempts: {last_err}")


class PredictRequest(BaseModel):
    inputs: dict
    session_id: str


class ChatRequest(BaseModel):
    message: str
    context: dict = {}


class RetrainRequest(BaseModel):
    session_id: str
    model_type: str


class RetypeRequest(BaseModel):
    session_id: str
    problem_type: str


class InsightsRequest(BaseModel):
    analysis: dict


def _run(fn, *args):
    """Run a blocking function in the default executor."""
    loop = asyncio.get_event_loop()
    return loop.run_in_executor(None, fn, *args)


# ── /analyze ─────────────────────────────────────────────────────────────────

@router.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")

    try:
        contents = await file.read()
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to read upload: {e}")

    if len(contents) > _MAX_CSV_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(contents)//1024//1024} MB). Maximum allowed: 20 MB.",
        )

    try:
        df = _read_csv_robust(contents)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse CSV: {e}")

    if df.empty:
        raise HTTPException(status_code=422, detail="The CSV file is empty.")
    if len(df.columns) < 2:
        raise HTTPException(status_code=422, detail="Dataset must have at least 2 columns.")
    if len(df) < 5:
        raise HTTPException(status_code=422, detail=f"Dataset too small: needs at least 5 rows, found {len(df)}.")

    if len(df) > 50_000:
        df = df.sample(50_000, random_state=42)

    try:
        result = await asyncio.wait_for(_run(analyze_dataset, df, file.filename), timeout=120.0)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("[API] /analyze failed")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {e}")

    result["ai_insights"] = []
    return JSONResponse(content=result)


# ── /predict ──────────────────────────────────────────────────────────────────

@router.post("/predict")
async def make_prediction(body: PredictRequest):
    logger.info("[API] POST /predict session=%s...", body.session_id[:8])
    try:
        result = await asyncio.wait_for(_run(predict, body.session_id, body.inputs), timeout=30.0)
        return JSONResponse(content=result)
    except LookupError as e:
        # Session not found — 404 so frontend can distinguish from other errors
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("[API] /predict failed")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")


# ── /retrain ──────────────────────────────────────────────────────────────────

@router.post("/retrain")
async def retrain(body: RetrainRequest):
    logger.info("[API] POST /retrain session=%s... model=%s", body.session_id[:8], body.model_type)
    try:
        comparison = await asyncio.wait_for(
            _run(retrain_with_model, body.session_id, body.model_type),
            timeout=120.0,
        )
        nm = comparison["new_metrics"]
        if "r2" in nm:
            perf = f"R²={nm['r2']:.3f}, MAE={nm.get('mae', 0):.3f}"
        elif "accuracy" in nm:
            perf = f"Accuracy={nm['accuracy'] * 100:.1f}%"
        else:
            perf = str(nm)
        reply = f"Entrenado **{comparison['new_model']}** (antes: {comparison['old_model']}). Resultados: {perf}."
        return JSONResponse(content={"reply": reply, "comparison": comparison})
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Retraining timed out.")
    except Exception as e:
        logger.exception("[API] /retrain failed")
        raise HTTPException(status_code=500, detail=f"Retraining failed: {e}")


# ── /retype ───────────────────────────────────────────────────────────────────

@router.post("/retype")
async def retype(body: RetypeRequest):
    logger.info("[API] POST /retype session=%s... type=%s", body.session_id[:8], body.problem_type)
    try:
        result = await asyncio.wait_for(
            _run(retype_problem, body.session_id, body.problem_type),
            timeout=120.0,
        )
        return JSONResponse(content=result)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Retype timed out.")
    except Exception as e:
        logger.exception("[API] /retype failed")
        raise HTTPException(status_code=500, detail=f"Retype failed: {e}")


# ── /chat ─────────────────────────────────────────────────────────────────────

@router.post("/chat")
async def chat(body: ChatRequest):
    try:
        ctx = dict(body.context)
        # Enrich context with live feature_importance from session (updated after each retrain)
        sid = ctx.get("session_id")
        if sid and SM.exists(sid):
            session = SM.get(sid)
            live_fi = session.get("feature_importance")
            if live_fi is not None:
                ctx["feature_importance"] = live_fi
                logger.info("[FI] Gemini context updated — %d features from session %s...", len(live_fi), sid[:8])
        reply = await asyncio.wait_for(_run(chat_with_siri, body.message, ctx), timeout=18.0)
        return JSONResponse(content={"reply": reply})
    except asyncio.TimeoutError:
        return JSONResponse(content={"reply": "La respuesta tardó demasiado. Inténtalo de nuevo."})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── /insights ─────────────────────────────────────────────────────────────────

@router.post("/insights")
async def insights(body: InsightsRequest):
    try:
        result = await asyncio.wait_for(_run(generate_insights, body.analysis), timeout=20.0)
        return JSONResponse(content={"insights": result})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── /session/validate ─────────────────────────────────────────────────────────

@router.get("/session/{session_id}/validate")
async def validate_session(session_id: str):
    """Frontend calls this on page load to check if a stored session_id is still valid."""
    if SM.exists(session_id):
        session = SM.get(session_id)
        return JSONResponse(content={
            "valid": True,
            "model_name":   session.get("model_name", ""),
            "problem_type": session.get("problem_type", ""),
        })
    return JSONResponse(content={"valid": False}, status_code=404)


# ── /health ───────────────────────────────────────────────────────────────────

@router.get("/health")
def health():
    return {"status": "ok", "sessions": len(SM.list_ids())}


@router.get("/ai-status")
def ai_status():
    import os
    key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    return {
        "active":   bool(key),
        "provider": "Gemini" if key else None,
        "model":    model if key else None,
    }
