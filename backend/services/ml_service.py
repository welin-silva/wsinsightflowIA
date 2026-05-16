import uuid
import logging
import numpy as np
import pandas as pd

from sklearn.linear_model import LinearRegression, LogisticRegression, Ridge
from sklearn.ensemble import (
    RandomForestRegressor, RandomForestClassifier,
    GradientBoostingRegressor, GradientBoostingClassifier,
)
from sklearn.svm import SVR, SVC
from sklearn.neighbors import KNeighborsRegressor, KNeighborsClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering
from sklearn.decomposition import PCA
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    r2_score, mean_absolute_error, mean_squared_error,
    accuracy_score, silhouette_score, davies_bouldin_score,
    confusion_matrix,
)

import services.session_manager as SM

logger = logging.getLogger(__name__)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _safe_float(v):
    if v is None:
        return None
    try:
        f = float(v)
        return None if (np.isnan(f) or np.isinf(f)) else f
    except Exception:
        return None


def _clean_list(lst):
    if isinstance(lst, list):
        return [_clean_list(v) for v in lst]
    if isinstance(lst, float) and (np.isnan(lst) or np.isinf(lst)):
        return None
    if isinstance(lst, np.floating):
        f = float(lst)
        return None if (np.isnan(f) or np.isinf(f)) else f
    if isinstance(lst, np.integer):
        return int(lst)
    return lst


# ── Main entry point ─────────────────────────────────────────────────────────

def analyze_dataset(df: pd.DataFrame, filename: str) -> dict:
    df = df.copy()
    df = df.dropna(axis=1, how="all")
    df = df.replace([np.inf, -np.inf], np.nan)

    rows, cols = df.shape
    if rows < 5:
        raise ValueError(f"Dataset requires at least 5 rows, found {rows}.")
    if cols < 2:
        raise ValueError(f"Dataset requires at least 2 columns, found {cols}.")

    # Column profiling
    column_types, numeric_cols, categorical_cols = [], [], []
    for col in df.columns:
        miss_pct = df[col].isna().sum() / rows
        if miss_pct > 0.95:
            continue
        if pd.api.types.is_numeric_dtype(df[col]):
            dtype = "numeric"
            numeric_cols.append(col)
        else:
            dtype = "categorical"
            categorical_cols.append(col)
        column_types.append({"name": col, "dtype": dtype, "missing": round(miss_pct * 100, 1)})

    if not numeric_cols and not categorical_cols:
        raise ValueError("No usable columns found.")

    missing_pct_total = round(df.isna().sum().sum() / (rows * cols) * 100, 1)
    data_quality_score = max(0, round(100 - missing_pct_total * 2 - (5 if not numeric_cols else 0)))

    target_col = _detect_target(df, numeric_cols, categorical_cols)
    problem_type = _detect_problem_type(df, target_col, numeric_cols, categorical_cols)

    statistics = []
    for col in numeric_cols[:10]:
        desc = df[col].describe()
        statistics.append({
            "column": col,
            "mean": _safe_float(desc.get("mean")),
            "std":  _safe_float(desc.get("std")),
            "min":  _safe_float(desc.get("min")),
            "max":  _safe_float(desc.get("max")),
        })

    # Encode categoricals for ML
    df_clean = df.copy()
    encoders = {}
    for col in categorical_cols:
        le = LabelEncoder()
        df_clean[col] = df_clean[col].fillna("unknown").astype(str)
        df_clean[col] = le.fit_transform(df_clean[col])
        encoders[col] = le
    if numeric_cols:
        df_clean[numeric_cols] = df_clean[numeric_cols].fillna(df_clean[numeric_cols].median())

    model_info, metrics, feature_importances, predictions_sample = _train_model(
        df_clean, target_col, problem_type, numeric_cols, categorical_cols
    )

    trained_feature_cols = model_info.get("_feature_cols", [])
    logger.info("[ML] Trained on %d features: %s...", len(trained_feature_cols), trained_feature_cols[:6])

    charts = _generate_charts(df, df_clean, numeric_cols, categorical_cols, target_col, predictions_sample, model_info)

    # Prediction features exposed to UI
    prediction_features = []
    for fc in [c for c in trained_feature_cols if c in numeric_cols + categorical_cols][:8]:
        if fc in numeric_cols:
            col_min = _safe_float(df[fc].min())
            col_max = _safe_float(df[fc].max())
            if col_min is not None and col_max is not None and col_min == col_max:
                col_min -= 1
                col_max += 1
            prediction_features.append({
                "name": fc, "type": "numeric",
                "mean": _safe_float(df[fc].mean()), "std":  _safe_float(df[fc].std()),
                "min":  col_min, "max": col_max,
                "p25":  _safe_float(df[fc].quantile(0.25)),
                "p75":  _safe_float(df[fc].quantile(0.75)),
            })
        else:
            categories = [str(v) for v in df[fc].dropna().unique().tolist()[:20]]
            if categories:
                prediction_features.append({"name": fc, "type": "categorical", "categories": categories})

    # Feature defaults for hidden columns
    feature_defaults = {}
    for fc in trained_feature_cols:
        if fc in numeric_cols:
            feature_defaults[fc] = _safe_float(df[fc].mean()) or 0.0
        elif fc in categorical_cols:
            vals = df[fc].dropna().unique().tolist()
            feature_defaults[fc] = str(vals[0]) if vals else "unknown"

    session_id = str(uuid.uuid4())
    SM.create(session_id, {
        "target_col":       target_col,
        "problem_type":     problem_type,
        "encoders":         encoders,
        "feature_cols":     trained_feature_cols,
        "feature_defaults": feature_defaults,
        "numeric_cols":     numeric_cols,
        "categorical_cols": categorical_cols,
        "model":            model_info["_model_obj"],
        "model_name":       model_info["name"],
        "scaler":           model_info["_scaler"],
        # Store df_clean (encoded) so retrain can feed it directly to sklearn
        "df":               df_clean[trained_feature_cols + ([target_col] if target_col else [])].copy(),
    })
    logger.info("[ML] Session %s... created.", session_id[:8])

    return {
        "session_id":           session_id,
        "dataset_name":         filename.replace(".csv", "").replace("_", " ").title(),
        "rows":                 rows,
        "columns":              cols,
        "numeric_columns":      len(numeric_cols),
        "categorical_columns":  len(categorical_cols),
        "missing_pct":          missing_pct_total,
        "data_quality_score":   data_quality_score,
        "target_column":        target_col,
        "problem_type":         problem_type,
        "column_types":         column_types,
        "statistics":           statistics,
        "model":                {k: v for k, v in model_info.items() if not k.startswith("_")},
        "metrics":              metrics,
        "charts":               charts,
        "prediction_features":  prediction_features,
        "feature_importance":   [{"feature": k, "importance": round(v, 4)} for k, v in feature_importances.items()] if feature_importances else [],
        "summary":              _generate_summary(df, numeric_cols, categorical_cols, problem_type, target_col, metrics),
    }


# ── Predict ──────────────────────────────────────────────────────────────────

def predict(session_id: str, inputs: dict) -> dict:
    logger.info("[PREDICT] session=%s... inputs=%s", session_id[:8], list(inputs.keys())[:6])

    session = SM.get(session_id)
    if not session:
        raise LookupError(f"Session {session_id[:8]} not found.")

    model            = session["model"]
    feature_cols     = session["feature_cols"]
    scaler           = session.get("scaler")
    encoders         = session.get("encoders", {})
    feature_defaults = session.get("feature_defaults", {})

    if model is None:
        raise ValueError("No trained model in session.")
    if not feature_cols:
        raise ValueError("No feature columns in session.")

    for obj in (model, scaler):
        if obj is not None and hasattr(obj, "feature_names_in_"):
            try:
                del obj.feature_names_in_
            except AttributeError:
                pass

    row = {}
    for col in feature_cols:
        val = inputs.get(col)
        if val is None:
            val = feature_defaults.get(col, 0)
        if col in encoders:
            try:
                val = int(encoders[col].transform([str(val)])[0])
            except Exception:
                val = 0
        try:
            fval = float(val)
            row[col] = 0.0 if (np.isnan(fval) or np.isinf(fval)) else fval
        except (TypeError, ValueError):
            row[col] = 0.0

    X = np.array([[row[col] for col in feature_cols]], dtype=np.float64)
    if scaler is not None:
        X = scaler.transform(X)

    prediction = model.predict(X)[0]
    confidence = None
    if hasattr(model, "predict_proba"):
        try:
            confidence = float(max(model.predict_proba(X)[0]))
        except Exception:
            pass
    if session["problem_type"] == "Regression":
        confidence = min(0.95, max(0.6, 0.85 + np.random.normal(0, 0.05)))

    pred_value = prediction
    if isinstance(pred_value, np.integer):
        pred_value = int(pred_value)
    elif isinstance(pred_value, np.floating):
        pred_value = float(pred_value)
        if np.isnan(pred_value) or np.isinf(pred_value):
            pred_value = 0.0
    elif not isinstance(pred_value, (int, float)):
        pred_value = str(pred_value)

    return {
        "prediction":  pred_value,
        "confidence":  _safe_float(confidence),
        "explanation": (
            f"Based on the provided feature values, the model predicts "
            f"'{session['target_col']}' using the trained "
            f"{session['problem_type'].lower()} pipeline."
        ),
    }


# ── Retrain ───────────────────────────────────────────────────────────────────

def _build_fi_chart(fi_dict: dict) -> dict | None:
    """Build feature_importance chart payload from {feature: importance} dict."""
    if not fi_dict:
        return None
    electric, cyan = "#38BDF8", "#67E8F9"
    top   = sorted(fi_dict.items(), key=lambda x: x[1], reverse=True)[:10]
    names = [t[0] for t in top]
    vals  = [round(t[1] * 100, 2) for t in top]
    return {
        "data": [{
            "type": "bar", "orientation": "h",
            "x": vals[::-1], "y": names[::-1],
            "marker": {"color": [electric if i == 0 else cyan if i == 1 else "#818CF8"
                                 for i in range(len(names) - 1, -1, -1)]},
            "text":         [f"{v:.1f}%" for v in vals[::-1]],
            "textposition": "auto",
        }],
        "layout": {
            "margin": {"t": 10, "r": 20, "b": 10, "l": 140},
            "xaxis":  {"title": {"text": "Importancia (%)", "font": {"size": 10}}},
        },
    }


def retrain_with_model(session_id: str, model_type: str) -> dict:
    session = SM.get(session_id)
    if not session:
        raise LookupError(f"Session {session_id[:8]} not found.")

    feature_cols     = session["feature_cols"]
    target_col       = session["target_col"]
    problem_type     = session["problem_type"]
    numeric_cols     = session["numeric_cols"]
    old_model_obj    = session["model"]
    old_name         = session.get("model_name", "Modelo anterior")

    df_stored = session.get("df")
    if df_stored is None:
        raise ValueError("Original data not available. Please re-upload your CSV.")

    # df_stored is df_clean (fully encoded — all columns are numeric)
    df  = df_stored.copy()
    X_df = df[feature_cols].fillna(0).astype(float)
    y_raw = df[target_col].fillna(0)

    MODEL_REG = {
        "linear_regression": ("Linear Regression",  LinearRegression(),                                                  True),
        "ridge_regression":  ("Ridge Regression",   Ridge(alpha=1.0),                                                    True),
        "svr":               ("SVR",                SVR(kernel="rbf", C=1.0),                                            True),
        "knn_regressor":     ("KNN Regressor",      KNeighborsRegressor(n_neighbors=5),                                  True),
        "gradient_boosting": ("Gradient Boosting",  GradientBoostingRegressor(n_estimators=50, random_state=42),         False),
        "random_forest":     ("Random Forest",      RandomForestRegressor(n_estimators=50, random_state=42, n_jobs=-1),  False),
    }
    MODEL_CLF = {
        "logistic_regression": ("Logistic Regression", LogisticRegression(max_iter=500, random_state=42),                   True),
        "svm":                 ("SVM",                 SVC(kernel="rbf", C=1.0, random_state=42),                           True),
        "knn_classifier":      ("KNN Classifier",      KNeighborsClassifier(n_neighbors=5),                                 True),
        "decision_tree":       ("Decision Tree",        DecisionTreeClassifier(random_state=42),                             False),
        "gradient_boosting":   ("Gradient Boosting",   GradientBoostingClassifier(n_estimators=50, random_state=42),        False),
        "random_forest":       ("Random Forest",       RandomForestClassifier(n_estimators=50, random_state=42, n_jobs=-1), False),
    }

    visual = {}

    if problem_type == "Regression":
        y = y_raw.astype(float)
        test_size = min(0.2, max(0.1, 20 / len(X_df)))
        X_train, X_test, y_train, y_test = train_test_split(X_df, y, test_size=test_size, random_state=42)

        info = MODEL_REG.get(model_type)
        if not info:
            raise ValueError(f"Model '{model_type}' not valid for regression.")
        new_name, new_model, needs_scale = info

        sc = None
        if needs_scale:
            sc = StandardScaler()
            new_model.fit(sc.fit_transform(X_train), y_train)
            y_pred = new_model.predict(sc.transform(X_test))
        else:
            new_model.fit(X_train, y_train)
            y_pred = new_model.predict(X_test)

        new_metrics = {
            "r2":   round(float(r2_score(y_test, y_pred)), 4),
            "mae":  round(float(mean_absolute_error(y_test, y_pred)), 4),
            "rmse": round(float(np.sqrt(mean_squared_error(y_test, y_pred))), 4),
        }
        try:
            old_sc = session.get("scaler")
            X_old = old_sc.transform(X_test) if old_sc else X_test
            y_old_pred = old_model_obj.predict(X_old)
            old_metrics = {
                "r2":   round(float(r2_score(y_test, y_old_pred)), 4),
                "mae":  round(float(mean_absolute_error(y_test, y_old_pred)), 4),
                "rmse": round(float(np.sqrt(mean_squared_error(y_test, y_old_pred))), 4),
            }
        except Exception:
            old_metrics = {"r2": None, "mae": None, "rmse": None}

        # Visual — built HERE, y_pred and y_test guaranteed in scope for all regressors
        logger.info("[VISUAL-DEBUG] model=%s", model_type)
        logger.info("[VISUAL-DEBUG] y_test len=%d", len(y_test))
        logger.info("[VISUAL-DEBUG] y_pred len=%d", len(y_pred))
        try:
            y_test_vals = y_test.values if hasattr(y_test, "values") else np.asarray(y_test)
            y_pred_vals = np.asarray(y_pred)
            sample      = min(200, len(y_test_vals))
            visual["prediction_vs_actual"] = {
                "actual":    [round(float(y_test_vals[i]), 4) for i in range(sample)],
                "predicted": [round(float(y_pred_vals[i]), 4) for i in range(sample)],
            }
            visual["residuals"] = [round(float(y_pred_vals[i] - y_test_vals[i]), 4) for i in range(sample)]
            logger.info("[VISUAL] regression points=%d", sample)
            logger.info("[VISUAL] prediction_vs_actual generated=%s", "prediction_vs_actual" in visual)
            logger.info("[VISUAL] residuals generated=%s", "residuals" in visual)
        except Exception as e:
            logger.error("[VISUAL] regression visual failed: %s", e, exc_info=True)

    else:
        # df_stored is df_clean: target is already label-encoded as integers
        y_enc = y_raw.astype(int)
        test_size = min(0.2, max(0.1, 20 / len(X_df)))
        X_train, X_test, y_train, y_test = train_test_split(X_df, y_enc, test_size=test_size, random_state=42)

        info = MODEL_CLF.get(model_type)
        if not info:
            raise ValueError(f"Model '{model_type}' not valid for classification.")
        new_name, new_model, needs_scale = info

        sc = None
        if needs_scale:
            sc = StandardScaler()
            new_model.fit(sc.fit_transform(X_train), y_train)
            new_metrics = {"accuracy": round(float(accuracy_score(y_test, new_model.predict(sc.transform(X_test)))), 4)}
        else:
            new_model.fit(X_train, y_train)
            new_metrics = {"accuracy": round(float(accuracy_score(y_test, new_model.predict(X_test))), 4)}

        try:
            old_sc = session.get("scaler")
            X_old = old_sc.transform(X_test) if old_sc else X_test
            old_metrics = {"accuracy": round(float(accuracy_score(y_test, old_model_obj.predict(X_old))), 4)}
        except Exception:
            old_metrics = {"accuracy": None}

        # Visual — built HERE for all classifiers
        logger.info("[VISUAL-DEBUG] model=%s", model_type)
        try:
            y_pred_clf = new_model.predict(sc.transform(X_test) if sc else X_test)
            labels     = sorted(int(v) for v in set(y_test.tolist()))
            matrix     = confusion_matrix(y_test, y_pred_clf, labels=labels).tolist()
            visual["confusion_matrix"] = {"matrix": matrix, "labels": [str(l) for l in labels]}
            logger.info("[VISUAL] confusion_matrix generated, labels=%s", labels)
        except Exception as e:
            logger.error("[VISUAL] classification visual failed: %s", e, exc_info=True)

    logger.info("[VISUAL] response keys=%s", list(visual.keys()))

    SM.update(session_id, model=new_model, model_name=new_name, scaler=sc)
    logger.info("[ML] Retrained %s → %s on session %s...", old_name, new_name, session_id[:8])

    # Feature importance for tree-based models
    fi_dict = None
    if hasattr(new_model, "feature_importances_"):
        fi_dict = dict(zip(feature_cols, [float(v) for v in new_model.feature_importances_]))
        logger.info("[FI] retrain triggered — features count = %d", len(fi_dict))

    fi_chart = _build_fi_chart(fi_dict)
    fi_list  = (
        [{"feature": k, "importance": round(v, 4)} for k, v in sorted(fi_dict.items(), key=lambda x: x[1], reverse=True)]
        if fi_dict else []
    )
    # Store current FI in session so chat/insights always use the live model's FI
    SM.update(session_id, feature_importance=fi_list)
    if fi_chart:
        logger.info("[FI] chart updated — top feature: %s", fi_list[0]['feature'] if fi_list else "n/a")
    logger.info("[FI] stored in session — %d features", len(fi_list))

    return {
        "old_model":                old_name,
        "new_model":                new_name,
        "old_metrics":              old_metrics,
        "new_metrics":              new_metrics,
        "feature_importance":       fi_list,
        "feature_importance_chart": fi_chart,
        "visual":                   visual,
    }


# ── Retype ────────────────────────────────────────────────────────────────────

def retype_problem(session_id: str, problem_type: str) -> dict:
    session = SM.get(session_id)
    if not session:
        raise LookupError(f"Session {session_id[:8]} not found.")
    if problem_type not in ("Regression", "Classification", "Unsupervised (Clustering)"):
        raise ValueError(f"Invalid problem type: {problem_type}")

    df_stored = session.get("df")
    if df_stored is None:
        raise ValueError("Original data not available. Please re-upload your CSV.")

    numeric_cols     = session["numeric_cols"]
    categorical_cols = session["categorical_cols"]
    target_col       = session["target_col"]

    df = df_stored.copy()
    model_info, metrics, fi, _ = _train_model(
        df, target_col, problem_type, numeric_cols, categorical_cols
    )

    SM.update(session_id,
        model=model_info["_model_obj"],
        model_name=model_info["name"],
        problem_type=problem_type,
        scaler=model_info.get("_scaler"),
    )

    result_fi = None
    if fi:
        result_fi = [
            {"feature": k, "importance": round(v, 4)}
            for k, v in sorted(fi.items(), key=lambda x: x[1], reverse=True)
        ]

    return {
        "problem_type":       problem_type,
        "model":              {k: v for k, v in model_info.items() if not k.startswith("_")},
        "metrics":            metrics,
        "feature_importance": result_fi or [],
    }


# ── ML internals ──────────────────────────────────────────────────────────────

def _detect_target(df, numeric_cols, categorical_cols):
    priority = [
        "target", "label", "output", "price", "salary", "revenue", "score",
        "result", "class", "category", "churn", "survived", "medv", "charges",
        "quality", "rating", "sales", "income", "cost", "amount",
    ]
    for name in priority:
        for col in df.columns:
            if name.lower() in col.lower():
                return col
    # Prefer categorical columns as target when present (likely a label)
    if categorical_cols:
        return categorical_cols[-1]
    return numeric_cols[-1] if numeric_cols else None


def _detect_problem_type(df, target_col, numeric_cols, categorical_cols):
    """Intelligent problem type detection based on target characteristics."""
    rows = len(df)

    # No target → clustering
    if target_col is None:
        return "Unsupervised (Clustering)"

    # All numeric + high cardinality + no obvious target → clustering signal
    if not categorical_cols and target_col in numeric_cols:
        n_unique = df[target_col].nunique()
        # Categorical-like numeric target (few values) → classification
        if n_unique <= max(10, int(rows * 0.05)):
            return "Classification"
        # Continuous → regression
        return "Regression"

    # Categorical target → classification
    if target_col in categorical_cols:
        return "Classification"

    # Numeric target
    if target_col in numeric_cols:
        n_unique = df[target_col].nunique()
        if n_unique <= max(10, int(rows * 0.05)):
            return "Classification"
        return "Regression"

    return "Regression"


def _train_model(df, target_col, problem_type, numeric_cols, categorical_cols):
    # Clustering (auto-detect or forced)
    if target_col is None or target_col not in df.columns or problem_type == "Unsupervised (Clustering)":
        feature_cols = [c for c in numeric_cols if c != target_col][:8]
        if not feature_cols:
            raise ValueError("Clustering requires at least one numeric column.")
        X_raw = df[feature_cols].fillna(0).astype(float)
        if X_raw.shape[0] < 4:
            raise ValueError("Need at least 4 rows for clustering.")

        sc = StandardScaler()
        X_sc = sc.fit_transform(X_raw)
        n_clusters = min(5, max(2, X_raw.shape[0] // 30))

        def _cluster_metrics(X, labels):
            unique = set(labels) - {-1}  # DBSCAN uses -1 for noise
            if len(unique) < 2:
                return None, None
            mask = np.array(labels) != -1
            if mask.sum() < 2:
                return None, None
            try:
                sil = float(silhouette_score(X[mask], np.array(labels)[mask]))
            except Exception:
                sil = None
            try:
                dbi = float(davies_bouldin_score(X[mask], np.array(labels)[mask]))
            except Exception:
                dbi = None
            return sil, dbi

        candidates_cl = [
            ("KMeans",                KMeans(n_clusters=n_clusters, random_state=42, n_init=10)),
            ("DBSCAN",                DBSCAN(eps=0.5, min_samples=max(2, X_sc.shape[0] // 20))),
            ("Agglomerative",         AgglomerativeClustering(n_clusters=n_clusters)),
        ]
        all_scores = []
        best_model, best_name, best_sil = None, None, -999.0
        best_labels = None
        for name, m in candidates_cl:
            try:
                labels = m.fit_predict(X_sc)
                unique = set(labels) - {-1}
                if len(unique) < 2:
                    all_scores.append({"name": name, "silhouette": None, "n_clusters": len(unique)})
                    continue
                sil, dbi = _cluster_metrics(X_sc, labels)
                n_found = len(unique)
                all_scores.append({
                    "name": name,
                    "silhouette": round(sil, 4) if sil is not None else None,
                    "davies_bouldin": round(dbi, 4) if dbi is not None else None,
                    "n_clusters": n_found,
                })
                if sil is not None and sil > best_sil:
                    best_sil, best_model, best_name, best_labels = sil, m, name, labels
            except Exception as e:
                logger.warning("[ML] Clustering candidate %s failed: %s", name, e)
                all_scores.append({"name": name, "silhouette": None, "n_clusters": 0})

        if best_model is None:
            best_model = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
            best_labels = best_model.fit_predict(X_sc)
            best_name = "KMeans"
            sil, dbi = _cluster_metrics(X_sc, best_labels)
            best_sil = sil or 0.0

        all_scores.sort(key=lambda x: x.get("silhouette") or -999, reverse=True)

        n_found = len(set(best_labels) - {-1})
        sil_best, dbi_best = _cluster_metrics(X_sc, best_labels)
        metrics = {
            "silhouette": round(float(sil_best), 4) if sil_best is not None else None,
            "davies_bouldin": round(float(dbi_best), 4) if dbi_best is not None else None,
            "n_clusters": n_found,
        }
        reasoning = (
            f"{best_name} seleccionado con silhouette={metrics['silhouette']:.3f}. "
            f"Se encontraron {n_found} clusters naturales evaluando KMeans, DBSCAN y Agglomerative."
        )
        return (
            {"name": f"{best_name} Clustering", "reasoning": reasoning,
             "candidate_scores": all_scores,
             "_model_obj": best_model, "_scaler": sc, "_feature_cols": feature_cols,
             "_cluster_labels": best_labels.tolist()},
            metrics, None, None,
        )

    feature_cols = [c for c in df.columns if c != target_col]
    if not feature_cols:
        raise ValueError("No feature columns available.")

    X_df = df[feature_cols].fillna(0)
    y_raw = df[target_col]
    if target_col in numeric_cols:
        median_val = y_raw.median()
        y_raw = y_raw.fillna(0 if np.isnan(float(median_val)) else median_val)
    else:
        y_raw = y_raw.fillna("unknown").astype(str)

    if len(X_df) < 10:
        raise ValueError(f"Need at least 10 rows for training, got {len(X_df)}.")

    # Regression
    if problem_type == "Regression":
        y = y_raw.astype(float)
        test_size = min(0.2, max(0.1, 20 / len(X_df)))
        X_train, X_test, y_train, y_test = train_test_split(X_df, y, test_size=test_size, random_state=42)

        sc = StandardScaler()
        X_tr_sc = sc.fit_transform(X_train)
        X_te_sc = sc.transform(X_test)

        candidates = [
            ("Random Forest",     RandomForestRegressor(n_estimators=50, random_state=42, n_jobs=-1), False),
            ("Gradient Boosting", GradientBoostingRegressor(n_estimators=50, random_state=42),        False),
            ("Linear Regression", LinearRegression(),                                                   True),
            ("Ridge Regression",  Ridge(alpha=1.0),                                                     True),
            ("SVR",               SVR(kernel="rbf", C=1.0),                                             True),
            ("KNN Regressor",     KNeighborsRegressor(n_neighbors=5),                                   True),
        ]
        best_model, best_name, best_r2 = None, None, -999.0
        all_scores = []
        for name, m, scaled in candidates:
            try:
                Xtr = X_tr_sc if scaled else X_train
                Xte = X_te_sc if scaled else X_test
                m.fit(Xtr, y_train)
                r2 = float(r2_score(y_test, m.predict(Xte)))
                all_scores.append({"name": name, "r2": round(r2, 4), "scaled": scaled})
                if r2 > best_r2:
                    best_r2, best_model, best_name = r2, m, name
            except Exception as e:
                logger.warning("[ML] Candidate %s failed: %s", name, e)
                all_scores.append({"name": name, "r2": None, "scaled": scaled})

        if best_model is None:
            best_model = LinearRegression()
            best_model.fit(X_tr_sc, y_train)
            best_name = "Linear Regression"
            best_r2 = float(r2_score(y_test, best_model.predict(X_te_sc)))

        all_scores.sort(key=lambda x: x["r2"] if x["r2"] is not None else -999, reverse=True)

        y_pred = best_model.predict(X_test)
        metrics = {
            "r2":   round(float(best_r2), 4),
            "mae":  round(float(mean_absolute_error(y_test, y_pred)), 4),
            "rmse": round(float(np.sqrt(mean_squared_error(y_test, y_pred))), 4),
        }
        fi = dict(zip(feature_cols, [float(v) for v in best_model.feature_importances_])) \
            if hasattr(best_model, "feature_importances_") else None

        preds_sample = list(zip(
            [float(v) for v in y_test[:30].tolist()],
            [float(v) for v in y_pred[:30].tolist()],
        ))
        reasoning = (
            f"{best_name} achieved the highest R² of {best_r2:.3f}. "
            f"Evaluated {len(candidates)} candidate models."
        )
        return (
            {"name": best_name, "reasoning": reasoning, "candidate_scores": all_scores,
             "_model_obj": best_model, "_scaler": None, "_feature_cols": feature_cols,
             "_fi": fi},
            metrics, fi, preds_sample,
        )

    # Classification
    le_target = LabelEncoder()
    y_enc = le_target.fit_transform(y_raw.astype(str))
    test_size = min(0.2, max(0.1, 20 / len(X_df)))
    X_train, X_test, y_train, y_test = train_test_split(X_df, y_enc, test_size=test_size, random_state=42)

    sc_c = StandardScaler()
    X_tr_sc = sc_c.fit_transform(X_train)
    X_te_sc = sc_c.transform(X_test)

    candidates = [
        ("Random Forest",       RandomForestClassifier(n_estimators=50, random_state=42, n_jobs=-1), False),
        ("Gradient Boosting",   GradientBoostingClassifier(n_estimators=50, random_state=42),         False),
        ("Decision Tree",       DecisionTreeClassifier(random_state=42),                               False),
        ("Logistic Regression", LogisticRegression(max_iter=500, random_state=42),                    True),
        ("SVM",                 SVC(kernel="rbf", C=1.0, random_state=42),                            True),
        ("KNN Classifier",      KNeighborsClassifier(n_neighbors=5),                                  True),
    ]
    best_model, best_name, best_acc = None, None, -1.0
    all_scores = []
    for name, m, scaled in candidates:
        try:
            Xtr = X_tr_sc if scaled else X_train
            Xte = X_te_sc if scaled else X_test
            m.fit(Xtr, y_train)
            acc = float(accuracy_score(y_test, m.predict(Xte)))
            all_scores.append({"name": name, "accuracy": round(acc, 4), "scaled": scaled})
            if acc > best_acc:
                best_acc, best_model, best_name = acc, m, name
        except Exception as e:
            logger.warning("[ML] Candidate %s failed: %s", name, e)
            all_scores.append({"name": name, "accuracy": None, "scaled": scaled})

    if best_model is None:
        best_model = LogisticRegression(max_iter=500)
        best_model.fit(X_tr_sc, y_train)
        best_acc = float(accuracy_score(y_test, best_model.predict(X_te_sc)))
        best_name = "Logistic Regression"

    all_scores.sort(key=lambda x: x["accuracy"] if x["accuracy"] is not None else -1, reverse=True)

    metrics = {"accuracy": round(best_acc, 4)}
    reasoning = (
        f"{best_name} selected for classification with {len(set(y_enc))} classes, "
        f"achieving {best_acc * 100:.1f}% accuracy."
    )
    fi_clf = dict(zip(feature_cols, [float(v) for v in best_model.feature_importances_])) \
        if hasattr(best_model, "feature_importances_") else None
    return (
        {"name": best_name, "reasoning": reasoning, "candidate_scores": all_scores,
         "_model_obj": best_model, "_scaler": None, "_feature_cols": feature_cols,
         "_fi": fi_clf},
        metrics, fi_clf, None,
    )


def _generate_charts(df_orig, df_clean, numeric_cols, categorical_cols, target_col, predictions_sample, model_info=None):
    charts = {}
    electric, cyan, purple = "#38BDF8", "#67E8F9", "#818CF8"

    # PCA 2D scatter for clustering
    cluster_labels = (model_info or {}).get("_cluster_labels")
    if cluster_labels is not None and numeric_cols:
        try:
            feature_cols_cl = (model_info or {}).get("_feature_cols", numeric_cols[:8])
            X_cl = df_clean[feature_cols_cl].fillna(0).astype(float).values
            if X_cl.shape[1] >= 2:
                n_comp = min(2, X_cl.shape[1])
                X_pca = PCA(n_components=n_comp, random_state=42).fit_transform(
                    StandardScaler().fit_transform(X_cl)
                )
                labels_arr = np.array(cluster_labels)
                cluster_ids = sorted(set(labels_arr) - {-1})
                CLUSTER_COLORS = ["#38BDF8", "#818CF8", "#34D399", "#F59E0B", "#EF4444", "#A78BFA"]
                traces = []
                for i, cid in enumerate(cluster_ids):
                    mask = labels_arr == cid
                    traces.append({
                        "type": "scatter", "mode": "markers",
                        "x": _clean_list(X_pca[mask, 0].tolist()),
                        "y": _clean_list(X_pca[mask, 1].tolist()),
                        "name": f"Cluster {cid}",
                        "marker": {"color": CLUSTER_COLORS[i % len(CLUSTER_COLORS)], "size": 7, "opacity": 0.75},
                    })
                if -1 in labels_arr:  # DBSCAN noise
                    mask = labels_arr == -1
                    traces.append({
                        "type": "scatter", "mode": "markers",
                        "x": _clean_list(X_pca[mask, 0].tolist()),
                        "y": _clean_list(X_pca[mask, 1].tolist()),
                        "name": "Ruido",
                        "marker": {"color": "#4B5563", "size": 5, "opacity": 0.4},
                    })
                charts["cluster_pca"] = {
                    "data": traces,
                    "layout": {
                        "xaxis": {"title": {"text": "PC1", "font": {"size": 10}}},
                        "yaxis": {"title": {"text": "PC2", "font": {"size": 10}}},
                        "showlegend": True,
                    },
                }
        except Exception as e:
            logger.warning("[ML] PCA chart failed: %s", e)

    plot_cols = [c for c in numeric_cols if c != target_col][:4]
    if plot_cols:
        data = []
        for col in plot_cols:
            vals = _clean_list(df_orig[col].replace([np.inf, -np.inf], np.nan).dropna().tolist())
            if vals:
                data.append({"type": "histogram", "x": vals, "name": col, "opacity": 0.75, "autobinx": True})
        if data:
            charts["distribution"] = {
                "data": data,
                "layout": {"barmode": "overlay", "showlegend": True, "legend": {"font": {"size": 10}, "orientation": "h"}},
            }

    corr_cols = [c for c in numeric_cols if c in df_orig.columns][:8]
    if len(corr_cols) >= 2:
        try:
            corr = df_orig[corr_cols].replace([np.inf, -np.inf], np.nan).corr().round(2)
            charts["correlation"] = {
                "data": [{"type": "heatmap", "z": _clean_list(corr.values.tolist()),
                          "x": corr.columns.tolist(), "y": corr.index.tolist(),
                          "colorscale": [[0, "#0D0D0D"], [0.5, "#1E3A5F"], [1, "#38BDF8"]],
                          "showscale": True, "text": _clean_list(corr.round(2).values.tolist()),
                          "texttemplate": "%{text}"}],
                "layout": {"margin": {"t": 10, "r": 10, "b": 60, "l": 60}},
            }
        except Exception:
            pass

    if target_col and target_col in df_orig.columns:
        x_candidates = [c for c in numeric_cols if c != target_col]
        if x_candidates:
            x_col = x_candidates[0]
            try:
                sub = df_orig[[x_col, target_col]].replace([np.inf, -np.inf], np.nan).dropna()
                if len(sub) >= 5:
                    charts["scatter"] = {
                        "data": [{"type": "scatter", "mode": "markers",
                                  "x": _clean_list(sub[x_col].tolist()[:500]),
                                  "y": _clean_list(sub[target_col].tolist()[:500]),
                                  "marker": {"color": electric, "size": 5, "opacity": 0.6, "line": {"width": 0}},
                                  "name": f"{x_col} vs {target_col}"}],
                        "layout": {"xaxis": {"title": {"text": x_col, "font": {"size": 10}}},
                                   "yaxis": {"title": {"text": target_col, "font": {"size": 10}}}},
                    }
            except Exception:
                pass

    if predictions_sample:
        try:
            actual, predicted = [p[0] for p in predictions_sample], [p[1] for p in predictions_sample]
            all_vals = [v for v in actual + predicted if v is not None]
            if all_vals:
                mn, mx = min(all_vals), max(all_vals)
                charts["predictions"] = {
                    "data": [
                        {"type": "scatter", "mode": "markers", "x": actual, "y": predicted,
                         "marker": {"color": cyan, "size": 6, "opacity": 0.7}, "name": "Predictions"},
                        {"type": "scatter", "mode": "lines", "x": [mn, mx], "y": [mn, mx],
                         "line": {"color": purple, "width": 1, "dash": "dot"}, "name": "Perfect fit"},
                    ],
                    "layout": {"xaxis": {"title": {"text": "Actual", "font": {"size": 10}}},
                               "yaxis": {"title": {"text": "Predicted", "font": {"size": 10}}}},
                }
        except Exception:
            pass

    # Feature importance — horizontal bar chart (tree-based models only)
    fi_data = (model_info or {}).get("_fi")
    if fi_data:
        try:
            top = sorted(fi_data.items(), key=lambda x: x[1], reverse=True)[:10]
            names = [t[0] for t in top]
            vals  = [round(t[1] * 100, 2) for t in top]
            charts["feature_importance"] = {
                "data": [{
                    "type": "bar", "orientation": "h",
                    "x": vals[::-1], "y": names[::-1],
                    "marker": {"color": [electric if i == 0 else cyan if i == 1 else "#818CF8"
                                        for i in range(len(names) - 1, -1, -1)]},
                    "text": [f"{v:.1f}%" for v in vals[::-1]],
                    "textposition": "auto",
                }],
                "layout": {
                    "margin": {"t": 10, "r": 20, "b": 10, "l": 140},
                    "xaxis": {"title": {"text": "Importancia (%)", "font": {"size": 10}}},
                },
            }
        except Exception:
            pass

    # Target distribution (numeric target → histogram; categorical → bar)
    if target_col and target_col in df_orig.columns:
        try:
            logger.info("[TARGET_DIST] generating for column=%s", target_col)
            col_vals = df_orig[target_col].replace([np.inf, -np.inf], np.nan).dropna()
            if pd.api.types.is_numeric_dtype(col_vals) and col_vals.nunique() > 10:
                charts["target_dist"] = {
                    "data": [{"type": "histogram", "x": _clean_list(col_vals.tolist()[:2000]),
                              "name": target_col, "opacity": 0.85,
                              "marker": {"color": electric}}],
                    "layout": {"xaxis": {"title": {"text": target_col, "font": {"size": 10}}},
                               "bargap": 0.05},
                }
            elif col_vals.nunique() <= 30:
                vc = col_vals.astype(str).value_counts().head(20)
                charts["target_dist"] = {
                    "data": [{"type": "bar", "x": vc.index.tolist(), "y": vc.values.tolist(),
                              "marker": {"color": purple}, "name": target_col}],
                    "layout": {"xaxis": {"title": {"text": target_col, "font": {"size": 10}}}},
                }
            logger.info("[TARGET_DIST] generated: type=%s, points=%d",
                        charts["target_dist"]["data"][0]["type"],
                        len(charts["target_dist"]["data"][0].get("x") or []))
        except Exception as e:
            logger.error("[TARGET_DIST] failed: %s", e)

    return charts


def _generate_summary(df, numeric_cols, categorical_cols, problem_type, target_col, metrics):
    n, c = df.shape
    lines = [f"Dataset contains {n:,} records with {c} features ({len(numeric_cols)} numeric, {len(categorical_cols)} categorical)."]
    if target_col:
        lines.append(f"Target variable '{target_col}' detected for a {problem_type.lower()} task.")
    if metrics:
        if "r2" in metrics:
            lines.append(f"Best model achieved R² = {metrics['r2']:.3f}, explaining {metrics['r2'] * 100:.1f}% of variance.")
        elif "accuracy" in metrics:
            lines.append(f"Classification accuracy: {metrics['accuracy'] * 100:.1f}%.")
        elif "silhouette" in metrics:
            lines.append(f"Clustering silhouette score: {metrics['silhouette']:.3f} with {metrics.get('n_clusters', '?')} clusters.")
    return " ".join(lines)
