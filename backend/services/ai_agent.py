import os
import json
import urllib.request
import urllib.error

try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))
except ImportError:
    pass

SYSTEM_PROMPT = """You are InsightFlow AI's analytics engine. Your role is to analyze datasets and provide clear,
professional insights in the style of a senior data scientist. Be concise, precise, and insightful.
Always provide actionable observations. Do not use markdown formatting — plain text only."""

SIRI_SYSTEM_PROMPT = """Eres DataBot, el AI Data Science Assistant de InsightFlow IA.
Actúas como un científico de datos senior y profesor universitario de ML/IA con 15 años de experiencia.
Eres riguroso, didáctico, natural y ligeramente humano. Usas emojis ocasionales (📊 🧠 🎯) cuando añaden claridad.
Respondes SIEMPRE en español con markdown (**negrita**, listas con -, código si hace falta).

════════════════════════════════════════════════
IDENTIDAD
════════════════════════════════════════════════
- Experto en estadística, EDA, ML supervisado y no supervisado, y visualización de datos.
- Distingues siempre TIPO DE PROBLEMA (Regression / Classification / Clustering) vs ALGORITMO concreto.
- Usas ÚNICAMENTE datos reales del contexto. Nunca inventas métricas, columnas ni valores.
- Puedes defender técnicamente el proyecto como si fuera una exposición oral académica.

════════════════════════════════════════════════
DATASETS DE LA DEMO — CONOCIMIENTO ESPECÍFICO
════════════════════════════════════════════════
Conoces en profundidad estos datasets habituales y sabes interpretarlos sin que te den más contexto:

• Titanic: clasificación de supervivencia. Variables clave: Pclass, Sex, Age, Fare, Embarked, SibSp, Parch.
  - Survived=1 (sobrevivió), Survived=0 (no). Clases 1/2/3 (primera, segunda, tercera clase).
  - Insight esperado: mujeres y primera clase tenían mayor tasa de supervivencia.

• Iris: clasificación de 3 especies de flores (setosa, versicolor, virginica). 150 muestras.
  - Variables: sepal_length, sepal_width, petal_length, petal_width.
  - Setosa es linealmente separable; versicolor y virginica se solapan en algunas dimensiones.

• Mall Customers: clustering de segmentación de clientes de centro comercial.
  - Variables: CustomerID, Genre, Age, Annual Income (k$), Spending Score (1-100).
  - KMeans suele detectar 5 clusters naturales: ahorradores, gastadores, medios, jóvenes, etc.

• Heart Disease: clasificación médica de riesgo cardíaco.
  - Variables: age, sex, cp (chest pain), trestbps (blood pressure), chol (cholesterol), thalach (max heart rate), target.
  - Target=1 (tiene enfermedad), Target=0 (no).

• Housing Prices: regresión de precios de vivienda.
  - Variables típicas: RM (rooms), LSTAT (% población baja renta), PTRATIO, TAX, MEDV (precio mediano).
  - LSTAT y RM suelen ser las variables más predictivas del precio.

════════════════════════════════════════════════
DOMINIO TÉCNICO COMPLETO
════════════════════════════════════════════════

📊 REGRESIÓN:
- R² = 1 - SS_res/SS_tot. Interpreta el % de varianza explicada por el modelo.
  R²>0.85 = excelente | 0.70-0.85 = bueno | 0.50-0.70 = moderado | <0.50 = mejorable.
- MAE: error absoluto medio, en las mismas unidades que el target. Robusto a outliers.
- RMSE: raíz del error cuadrático. Penaliza errores grandes más que MAE. Si RMSE >> MAE → outliers.
- Residuos: diferencia real-predicho. Histograma centrado en 0 y simétrico = modelo bien calibrado.
- Overfitting: R² muy alto en train, bajo en test. Señales: pocos datos, árbol sin poda, muchas features.
- Underfitting: R² bajo en ambos. El modelo es demasiado simple para la complejidad del problema.

🎯 CLASIFICACIÓN:
- Accuracy: % correctos. Puede ser engañoso con clases desbalanceadas (ej: 95% de una clase = accuracy alta trivial).
- Precision = TP/(TP+FP): de los que predijo positivo, ¿cuántos eran realmente positivos?
- Recall = TP/(TP+FN): de los positivos reales, ¿cuántos detectó el modelo?
- F1 = 2·P·R/(P+R): balance entre precision y recall. Mejor métrica con desbalanceo.
- Matriz de confusión: filas = clase real, columnas = predicción. Diagonal = aciertos.
  Off-diagonal superior = falsos positivos. Off-diagonal inferior = falsos negativos.

🔵 CLUSTERING (no supervisado):
- Silhouette Score ∈ [-1, 1]: cohesión intra-cluster vs separación inter-cluster.
  >0.7=excelente | 0.5-0.7=bueno | 0.25-0.5=moderado | <0.25=clusters solapados.
- Davies-Bouldin Index: más bajo es mejor. Compara compacidad interna con distancia entre clusters.
- KMeans: centroides esféricos. Rápido. Requiere especificar K. Sensible a outliers y escala.
- DBSCAN: detecta formas arbitrarias, identifica ruido (puntos que no pertenecen a ningún cluster). No necesita K.
- Agglomerative: jerarquía bottom-up de fusiones. Genera dendrograma. Bueno para datos pequeños.
- PCA 2D: reduce dimensionalidad para visualizar clusters en 2D. Los ejes no tienen unidad directa — son combinaciones lineales de las variables originales.

🌲 FEATURE IMPORTANCE:
- Árboles (Random Forest, Gradient Boosting, Decision Tree): importancia = reducción media de impureza (Gini o MSE) al dividir por esa variable.
  Si una variable tiene 40% de importancia → el 40% de la capacidad predictiva del modelo viene de ella.
- Lineales (Linear Regression, Ridge): coeficientes normalizados como proxy de importancia.
- KNN, SVR: NO tienen feature importance nativa. Requieren métodos de permutación externos.
- Interpretable vs no interpretable: árboles = interpretables, SVR/KNN = caja negra.
- Importancia alta ≠ causalidad. Indica correlación predictiva, no causa directa.

⚙️ ALGORITMOS EN DETALLE:
- Random Forest: ensemble de N árboles con muestras bootstrap. Reduce overfitting mediante promedio. Robusto.
- Gradient Boosting: árboles en secuencia. Cada árbol corrige los errores del anterior (gradiente del error).
  Más potente que RF pero más sensible a hiperparámetros y datos con ruido.
- Linear/Ridge Regression: asume relación lineal entre features y target.
  Ridge añade penalización L2 (λ·||w||²) para regularizar y evitar overfitting.
- Decision Tree: árbol único. Muy interpretable pero se sobreajusta fácilmente sin poda (max_depth).
- SVR/SVM: maximiza margen entre clases en espacio de alta dimensión. Potente en datos pequeños.
- KNN: predice por los K vecinos más cercanos. No paramétrico. Lento con datos grandes. Sensible a escala.

════════════════════════════════════════════════
GRÁFICAS DEL SISTEMA — CÓMO INTERPRETARLAS
════════════════════════════════════════════════
- **distribution**: histograma de cada variable numérica. Muestra normalidad, sesgo, bimodalidad, outliers.
- **target_dist**: distribución de la variable objetivo. En clasificación = barras por clase. En regresión = histograma de valores.
- **correlation**: mapa de calor de correlaciones Pearson. Rojo = correlación positiva fuerte, azul = negativa.
  Correlación >0.7 o <-0.7 entre features puede indicar multicolinealidad.
- **scatter**: dispersión entre dos variables. Revela relaciones lineales, no lineales, clusters o outliers.
- **predictions**: predicciones vs valores reales (regresión). Diagonal perfecta = modelo perfecto.
- **feature_importance**: barras horizontales ordenadas. Visualiza qué variables usa más el modelo.
- **cluster_pca**: proyección PCA 2D de los clusters detectados. Colores = grupos distintos.

════════════════════════════════════════════════
SKLEARN vs GEMINI — ARQUITECTURA DEL SISTEMA
════════════════════════════════════════════════
Cuando te pregunten cómo funciona el sistema, explica esto con precisión:

"Los modelos predictivos son entrenados mediante scikit-learn, que realiza los cálculos matemáticos reales:
ajuste de parámetros, validación cruzada y cálculo de métricas sobre los datos del dataset.
Gemini (yo, DataBot) actúa como una IA generativa que interpreta esos resultados, explica
su significado estadístico y responde preguntas en lenguaje natural usando el contexto real del análisis.
No accedo a los datos crudos — interpreto el resumen estadístico que sklearn ha calculado."

════════════════════════════════════════════════
MODO DEFENSA ACADÉMICA
════════════════════════════════════════════════
Si el usuario hace preguntas técnicas de tipo exposición oral (¿por qué este modelo? ¿qué significa esto?
¿cómo funciona? ¿qué diferencia hay entre X e Y?), responde como si estuvieras defendiendo un TFG:
- Con precisión técnica y terminología correcta.
- Con explicaciones accesibles sin perder rigor.
- Con referencias a los datos reales del contexto.
- Máximo 8 líneas para análisis profundo, 4 para preguntas simples.

════════════════════════════════════════════════
REGLAS DE RESPUESTA
════════════════════════════════════════════════
- NUNCA inventes métricas, columnas, valores o variables que no estén en el contexto.
- Usa SIEMPRE los números reales del contexto al interpretar.
- Para métricas: explica QUÉ significa el número + interpreta si es bueno/malo para este dataset.
- Para FI: menciona las variables top reales del contexto + explica por qué tienen esa importancia.
- Para clustering: interpreta Silhouette y DBI con los valores reales + explica qué implican.
- Para gráficas: describe qué muestra + qué conclusión se saca de los datos reales.
- Si falta información para responder: dilo claramente — "Con los datos disponibles puedo decir X, pero necesitaría Y para confirmarlo."
- Si la pregunta es ajena al dataset: responde con humor amistoso + un dato real del dataset.
- Si no hay dataset cargado: pide que suban un CSV primero."""



def _gemini_key():
    return os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

def _gemini_call(system: str, user: str, timeout: int = 12) -> str | None:
    """Direct HTTP call to Gemini REST API — no LangChain, no retries, proper timeout."""
    key = _gemini_key()
    if not key:
        return None
    model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    body = json.dumps({
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {"maxOutputTokens": 1536, "temperature": 0.35},
    }).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = json.load(r)
            return data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except urllib.error.HTTPError as e:
        if e.code == 429:
            return None  # rate limited — use fallback
        return None
    except Exception:
        return None


def chat_with_siri(message: str, context: dict = None) -> str:
    """Answer a natural language question using Gemini with full dataset context."""
    ctx = context or {}

    if not _gemini_key():
        return _siri_fallback(message, ctx)

    ctx_text = _build_full_context(ctx)
    section = ctx.get("section")

    if section:
        user_prompt = _section_prompt(section, ctx)
    else:
        # Include conversation history for session memory (last 6 turns)
        history = ctx.get("history", [])
        history_text = ""
        if history:
            history_text = "=== CONVERSACIÓN PREVIA ===\n"
            for turn in history[-6:]:
                role = "Usuario" if turn.get("role") == "user" else "DataBot"
                history_text += f"{role}: {turn.get('text','')}\n"
            history_text += "===========================\n\n"

        user_prompt = f"""{ctx_text}{history_text}PREGUNTA DEL USUARIO: {message}

INSTRUCCIONES DE RESPUESTA:
- Español. Markdown (**negrita**, listas con -, código si aplica). Emojis ligeros solo si añaden claridad.
- Usa ÚNICAMENTE datos reales del contexto: métricas, nombres de columnas, rangos, importancias reales.
- Nunca inventes valores, columnas ni métricas que no aparezcan en el contexto.

SEGÚN EL TIPO DE PREGUNTA:
• Métricas (R², MAE, Accuracy, Silhouette, DBI): explica qué significa matemáticamente + interpreta el valor concreto del contexto.
• Feature Importance: indica las variables reales del contexto, explica cómo se calcula para el modelo actual (árbol vs lineal vs KNN), qué implica la importancia alta/baja.
• "¿Por qué ganó modelo X?": compara tipos de modelo (ensamble vs lineal vs instancia), menciona el trade-off bias-varianza, relaciona con el problema real.
• "¿Diferencia entre X e Y?": explica algoritmos reales mencionados con sus ventajas/limitaciones.
• Overfitting/Underfitting: relaciona con métricas y tamaño del dataset del contexto.
• Clustering: interpreta Silhouette + DBI con los valores reales, explica qué significa cada cluster en el contexto del dataset.
• Gráficas (correlation, scatter, confusion matrix, residuos, PCA): describe qué muestra + qué conclusión se extrae con los datos reales.
• sklearn vs Gemini: explica que sklearn hace los cálculos matemáticos reales; tú interpretas los resultados.
• Modo defensa académica: responde con precisión técnica + lenguaje accesible para exposición oral.

LONGITUD: máx 4 líneas para preguntas simples, hasta 8 para análisis técnico profundo.
Si hay conversación previa: no repitas — refuerza o profundiza."""

    reply = _gemini_call(SIRI_SYSTEM_PROMPT, user_prompt, timeout=12)
    return reply if reply else _siri_fallback(message, ctx)


_CHART_DESCRIPTIONS = {
    "distribution":        "histogramas de distribución de cada variable numérica (muestra normalidad, sesgo, outliers)",
    "target_dist":         "distribución de la variable objetivo (barras por clase en clasificación, histograma en regresión)",
    "correlation":         "mapa de calor de correlaciones Pearson entre variables numéricas",
    "scatter":             "dispersión entre dos variables para detectar relaciones lineales o no lineales",
    "predictions":         "predicciones vs valores reales del modelo (diagonal perfecta = modelo perfecto)",
    "feature_importance":  "importancia relativa de cada variable para el modelo entrenado (barras horizontales)",
    "cluster_pca":         "proyección PCA 2D de los clusters detectados (colores = grupos distintos)",
}

import logging as _logging
_log = _logging.getLogger(__name__)


def _build_full_context(ctx: dict) -> str:
    if not ctx.get("rows"):
        return "No hay dataset cargado aún.\n\n"

    dataset_name = ctx.get("dataset_name", "sin nombre")
    problem_type = ctx.get("problem_type", "desconocido")
    target_col   = ctx.get("target_column", "ninguna")
    model_name   = ctx.get("model_name", "")

    parts = [
        f"Dataset: {dataset_name}",
        f"{ctx['rows']:,} filas × {ctx.get('columns', 0)} columnas ({ctx.get('numeric_columns',0)} numéricas, {ctx.get('categorical_columns',0)} categóricas)",
        f"Calidad de datos: {ctx.get('data_quality_score', 0)}% (valores faltantes: {round(ctx.get('missing_pct',0),1)}%)",
        f"Tipo de problema ML: {problem_type}",
        f"Variable objetivo (target): {target_col}",
    ]
    _log.info("[CHAT] dataset expert mode enabled — dataset=%s problem=%s", dataset_name, problem_type)

    if ctx.get("summary"):
        parts.append(f"Resumen automático del análisis: {ctx['summary']}")

    # Column list with types
    if ctx.get("column_types"):
        numeric = [c["name"] for c in ctx["column_types"] if c.get("dtype") == "numeric"]
        categorical = [c["name"] for c in ctx["column_types"] if c.get("dtype") == "categorical"]
        if numeric:
            parts.append(f"Columnas numéricas ({len(numeric)}): {', '.join(numeric)}")
        if categorical:
            parts.append(f"Columnas categóricas ({len(categorical)}): {', '.join(categorical)}")

    # Model info and metrics
    if model_name:
        reasoning = ctx.get("model_reasoning", "")
        parts.append(f"Algoritmo ML seleccionado: {model_name}{'  — ' + reasoning if reasoning else ''}")

    if ctx.get("metrics"):
        m = ctx["metrics"]
        if "r2" in m:
            r2 = round(m["r2"], 4)
            q = "excelente" if r2 > 0.85 else "bueno" if r2 > 0.70 else "moderado" if r2 > 0.50 else "mejorable"
            parts.append(
                f"Rendimiento (Regresión): R²={r2} ({q}) — el modelo explica el {round(r2*100,1)}% "
                f"de la varianza de '{target_col}'"
            )
            if m.get("mae"):
                mae  = round(m["mae"], 4)
                rmse = round(m.get("rmse", 0), 4)
                parts.append(
                    f"Errores: MAE={mae} (error medio absoluto en unidades de {target_col}), "
                    f"RMSE={rmse} (penaliza más errores grandes; si RMSE>>MAE hay outliers)"
                )
        if "accuracy" in m:
            acc = round(m["accuracy"] * 100, 2)
            q = "excelente" if acc > 90 else "bueno" if acc > 75 else "moderado" if acc > 60 else "mejorable"
            parts.append(
                f"Rendimiento (Clasificación): Accuracy={acc}% ({q}) — "
                f"clasifica correctamente {acc} de cada 100 casos de '{target_col}'"
            )
            if m.get("precision") is not None:
                parts.append(
                    f"Precision={round(m['precision']*100,1)}%, "
                    f"Recall={round(m.get('recall',0)*100,1)}%, "
                    f"F1={round(m.get('f1',0)*100,1)}%"
                )

    # Clustering metrics
    if ctx.get("metrics") and "n_clusters" in (ctx.get("metrics") or {}):
        m = ctx["metrics"]
        n   = m.get("n_clusters", 0)
        sil = m.get("silhouette")
        dbi = m.get("davies_bouldin")
        algo = m.get("algorithm", model_name or "automático")
        parts.append(f"Clustering con {algo}: se detectaron {n} grupos naturales en los datos")
        if sil is not None:
            sq = "excelente" if sil > 0.7 else "bueno" if sil > 0.5 else "moderado" if sil > 0.25 else "solapado/mejorable"
            parts.append(
                f"Silhouette Score={round(sil,4)} ({sq}): cohesión intra-cluster vs separación inter-cluster "
                f"(rango [-1,1]; 1=clusters perfectamente separados, 0=solapados)"
            )
        if dbi is not None:
            parts.append(
                f"Davies-Bouldin Index={round(dbi,4)} (más bajo = mejor; compara compacidad interna "
                f"vs distancia entre clusters)"
            )

    # Prediction features with ranges
    if ctx.get("prediction_features"):
        feats = ctx["prediction_features"]
        feat_lines = []
        for f in feats[:10]:
            nm = f.get("name", "")
            if f.get("type") == "numeric":
                feat_lines.append(
                    f"  '{nm}': rango [{round(f.get('min',0),3)} – {round(f.get('max',0),3)}], "
                    f"media={round(f.get('mean',0),3)}"
                )
            else:
                cats = f.get("categories", [])
                feat_lines.append(f"  '{nm}': categorías → {cats[:8]}")
        parts.append("Variables de entrada con rangos reales:\n" + "\n".join(feat_lines))

    # Statistics (with temporal detection)
    date_cols = []
    if ctx.get("statistics"):
        stat_lines = []
        for s in ctx["statistics"]:
            col  = s.get("column", "")
            mn   = s.get("min")
            mx   = s.get("max")
            mean = s.get("mean")
            std  = s.get("std")
            if mn is not None and mx is not None and 1900 <= mn <= 2200 and 1900 <= mx <= 2200:
                date_cols.append({"col": col, "min": int(mn), "max": int(mx)})
                stat_lines.append(f"  '{col}' (temporal): {int(mn)} – {int(mx)}")
            elif mn is not None and mean is not None:
                std_part = f", std={round(std,3)}" if std is not None else ""
                stat_lines.append(
                    f"  '{col}': min={round(mn,3)}, media={round(mean,3)}, max={round(mx or 0,3)}{std_part}"
                )
        if stat_lines:
            parts.append("Estadísticas por columna:\n" + "\n".join(stat_lines))
    if date_cols:
        parts.append(f"Columnas temporales detectadas: {', '.join(d['col']+' ('+str(d['min'])+'–'+str(d['max'])+')' for d in date_cols)}")

    # Feature importance
    if ctx.get("feature_importance"):
        fi_list = ctx["feature_importance"]
        top_fi  = sorted(fi_list, key=lambda x: x.get("importance", 0), reverse=True)[:10]
        fi_lines = [
            f"{f['feature']}={round(f.get('importance',0)*100,1)}%"
            for f in top_fi
        ]
        parts.append(
            f"Feature importance ({model_name}, top {len(top_fi)} variables por influencia predictiva): "
            + " | ".join(fi_lines)
        )
        _log.info("[CHAT] feature importance loaded — %d features, top=%s", len(fi_list), fi_lines[0] if fi_lines else "none")

    # Charts available in the EDA panel
    charts = ctx.get("charts") or {}
    if charts:
        chart_keys = [k for k in charts.keys() if charts[k]]
        described  = [f"{k} ({_CHART_DESCRIPTIONS.get(k, 'gráfica')})" for k in chart_keys]
        parts.append("Gráficas disponibles en panel de Visualizaciones:\n  " + "\n  ".join(described))
        _log.info("[CHAT] charts context added — %s", chart_keys)
    else:
        # Always describe the system charts so Gemini can answer questions about them
        all_charts = [f"{k} ({v})" for k, v in _CHART_DESCRIPTIONS.items()]
        parts.append(
            "Gráficas del sistema (generadas según tipo de problema):\n  " + "\n  ".join(all_charts)
        )
        _log.info("[CHAT] charts context added — static description")

    # Visual intelligence (post-retrain)
    visual = ctx.get("visual") or {}
    if visual:
        visual_keys = list(visual.keys())
        parts.append(f"Gráficas de inteligencia visual post-entrenamiento activas: {', '.join(visual_keys)}")
        if "residuals" in visual:
            residuals = visual["residuals"]
            if isinstance(residuals, list) and residuals:
                import math
                n        = len(residuals)
                mean_res = sum(residuals) / n
                var_res  = sum((r - mean_res) ** 2 for r in residuals) / n
                std_res  = math.sqrt(var_res)
                max_abs  = max(abs(r) for r in residuals)
                bias_note = (
                    "centrado en 0 — buen calibrado" if abs(mean_res) < std_res * 0.1
                    else f"media={round(mean_res,4)} — posible sesgo sistemático"
                )
                parts.append(
                    f"Análisis de residuos: n={n}, media={round(mean_res,4)} ({bias_note}), "
                    f"std={round(std_res,4)}, max_abs={round(max_abs,4)}"
                )
        if "prediction_vs_actual" in visual:
            pva = visual["prediction_vs_actual"]
            n_pts = len(pva.get("actual", []))
            parts.append(f"Gráfica Predicción vs Real: {n_pts} puntos de validación disponibles")
        if "confusion_matrix" in visual:
            cm = visual["confusion_matrix"]
            labels = cm.get("labels", [])
            parts.append(f"Matriz de confusión: {len(labels)} clases → {labels}")
        _log.info("[CHAT] visual reasoning enabled — keys=%s", visual_keys)

    _log.info("[CHAT] academic mode active — context parts=%d dataset=%s", len(parts), dataset_name)
    return "=== CONTEXTO DEL DATASET ===\n" + "\n".join(f"- {p}" for p in parts) + "\n===========================\n\n"


def _section_prompt(section: str, ctx: dict) -> str:
    ctx_text = _build_full_context(ctx)
    prompts = {
        "overview": (
            f"{ctx_text}Haz una lectura en voz alta del resumen general del dataset. "
            "Menciona cuántas filas y columnas tiene, la calidad de los datos, si hay valores faltantes, "
            "y qué tipo de problema es. Habla como si lo explicaras a alguien que acaba de abrir el archivo. "
            "Máximo 4 frases naturales, sin listas."
        ),
        "visualizations": (
            f"{ctx_text}Haz una lectura en voz alta de las visualizaciones. "
            "Explica qué muestran las distribuciones de las variables principales, "
            "y qué relaciones importantes aparecen en la matriz de correlación. "
            "Menciona si hay variables muy correlacionadas o patrones visuales destacables. "
            "Máximo 4 frases naturales."
        ),
        "model": (
            f"{ctx_text}Haz una lectura en voz alta del modelo de machine learning. "
            "Explica qué tipo de modelo se ha usado, por qué es apropiado para este problema, "
            "e interpreta las métricas de rendimiento en lenguaje sencillo. "
            "Si hay importancia de variables, menciona las más relevantes. "
            "Máximo 4 frases."
        ),
        "predictions": (
            f"{ctx_text}Haz una lectura en voz alta de la sección de predicciones. "
            "Explica cómo funciona el modelo para predecir {ctx.get('target_column','el objetivo')}, "
            "qué variables hay que introducir, y cómo interpretar el resultado. "
            "Máximo 3 frases naturales."
        ),
    }
    return prompts.get(section, f"{ctx_text}El usuario pregunta sobre {section}. Responde en 3 frases en español.")


def _siri_fallback(message: str, context: dict) -> str:
    """Smart rule-based fallback when no Gemini API key is configured."""
    msg = message.lower()
    ctx = context or {}
    name         = ctx.get("dataset_name", "tu dataset")
    rows         = ctx.get("rows")
    cols         = ctx.get("columns", 0)
    problem      = ctx.get("problem_type", "")
    target       = ctx.get("target_column", "")
    model        = ctx.get("model_name", "")
    quality      = ctx.get("data_quality_score", 0)
    metrics      = ctx.get("metrics") or {}
    stats        = ctx.get("statistics") or []
    fi           = ctx.get("feature_importance") or []
    column_types = ctx.get("column_types") or []

    has_data = bool(rows)

    # ── Detect date/year columns from statistics ─────────────────────────
    date_cols = []
    for s in stats:
        mn, mx = s.get("min"), s.get("max")
        if mn is not None and mx is not None:
            try:
                if 1900 <= float(mn) <= 2200 and 1900 <= float(mx) <= 2200:
                    date_cols.append({"col": s["column"], "min": int(float(mn)), "max": int(float(mx))})
            except Exception:
                pass

    # ── Dates / periods / time ────────────────────────────────────────────
    if any(w in msg for w in ["fecha", "año", "periodo", "periodo", "tiempo", "temporal", "fechas", "años", "historico", "histórico", "when", "rango", "desde", "hasta"]):
        if date_cols and has_data:
            lines = [f"He detectado **{len(date_cols)} columna(s) temporal(es)** en **{name}**:\n"]
            for d in date_cols:
                span = d['max'] - d['min']
                lines.append(f"- **{d['col']}**: desde **{d['min']}** hasta **{d['max']}** ({span} años de datos)")
            lines.append(f"\nPuedes filtrar por estos rangos usando el **Explorador Interactivo** en la pestaña Visualizaciones — arrastra los sliders para ver cómo cambian las gráficas.")
            return "\n".join(lines)
        if has_data:
            all_cols = [c["name"] for c in column_types]
            return f"No he detectado columnas de fecha obvias en {name}. Las columnas disponibles son: {', '.join(all_cols)}. Si alguna contiene años o fechas, prueba el Explorador Interactivo en Visualizaciones para filtrar por ella."
        return "Sube un dataset CSV para analizar sus rangos temporales."

    # ── Chart / visualization requests ───────────────────────────────────
    if any(w in msg for w in ["gráfica", "grafica", "grafico", "gráfico", "chart", "visualiza", "dibuja", "muéstrame", "mostrame", "plot", "histograma", "scatter", "barras", "línea", "linea"]):
        if has_data:
            suggestions = []
            if fi:
                top = sorted(fi, key=lambda x: x.get("importance", 0), reverse=True)[:2]
                suggestions.append(f"**Dispersión** de {top[0]['feature']} vs {top[1]['feature'] if len(top)>1 else target} (las variables más influyentes)")
            if date_cols:
                suggestions.append(f"**Líneas** con {date_cols[0]['col']} en el eje X para ver la evolución temporal")
            if stats:
                suggestions.append(f"**Histograma** de {stats[0]['column']} para ver su distribución de frecuencias")
            resp = f"Para generar una gráfica de {name}, ve a la pestaña **Visualizaciones → Explorador Interactivo**. Allí puedes elegir:\n"
            resp += "- Tipo: Dispersión, Líneas, Barras o Histograma\n"
            resp += "- Eje X e Y: cualquier columna del dataset\n"
            if date_cols:
                resp += f"- Slider temporal: filtra entre {date_cols[0]['min']} y {date_cols[0]['max']}\n"
            if suggestions:
                resp += f"\nSugerencias con tus datos:\n" + "\n".join(f"- {s}" for s in suggestions)
            return resp
        return "Sube un CSV primero. Luego en la pestaña Visualizaciones podrás crear gráficas interactivas eligiendo tipo, ejes y rango temporal."

    # ── Why Regression vs Linear Regression ──────────────────────────────
    if any(w in msg for w in ["por qué regresion", "por que regresion", "porque regresion", "no lineal", "lineal", "linear"]):
        if has_data:
            r2 = metrics.get("r2")
            resp = f"**Regression** es el **tipo de problema**, no un algoritmo. Significa que la variable objetivo ({target}) es un número continuo que el modelo intenta predecir.\n\n"
            resp += f"El algoritmo elegido fue **{model}**. El sistema evaluó varios candidatos:\n"
            resp += "- Random Forest Regressor\n- Gradient Boosting Regressor\n- Linear Regression\n\n"
            if r2 is not None:
                resp += f"**{model}** fue el ganador con R²={r2:.3f}. "
                if "random forest" in model.lower() or "gradient" in model.lower():
                    resp += "Random Forest y Gradient Boosting suelen superar a la Regresión Lineal cuando hay relaciones no lineales entre variables o interacciones complejas."
                else:
                    resp += "Linear Regression fue suficientemente buena porque la relación entre variables es aproximadamente lineal."
            return resp
        return "Sube un dataset para ver la comparativa de algoritmos."

    # ── Why this model / model explanation ───────────────────────────────
    if any(w in msg for w in ["por qué", "porque", "por que", "modelo", "algoritmo", "eligió", "eligio", "eligió", "random forest", "gradient", "svm", "seleccion", "selección"]):
        if model and has_data:
            r2  = metrics.get("r2")
            acc = metrics.get("accuracy")
            resp = f"El sistema evaluó automáticamente varios algoritmos para este problema de **{problem}** y eligió **{model}** por ser el más preciso.\n\n"
            if r2 is not None:
                q = "excelente" if r2 > 0.85 else "bueno" if r2 > 0.7 else "moderado" if r2 > 0.5 else "mejorable"
                resp += f"- **R² = {r2:.3f}** → rendimiento {q} (explica el {r2*100:.1f}% de la varianza de {target})\n"
                if metrics.get("mae"):
                    resp += f"- **MAE = {metrics['mae']:.3f}** → error medio de predicción\n"
            if acc is not None:
                q = "excelente" if acc > 0.9 else "bueno" if acc > 0.75 else "moderado"
                resp += f"- **Accuracy = {acc*100:.1f}%** → {q}\n"
            if fi:
                top = sorted(fi, key=lambda x: x.get("importance", 0), reverse=True)[:3]
                names = ", ".join(f"{f['feature']} ({round(f.get('importance',0)*100,1)}%)" for f in top)
                resp += f"\nVariables más influyentes: {names}"
            return resp
        return "Sube un dataset para ver el análisis de selección de modelo."

    # ── Column listing ───────────────────────────────────────────────────
    if any(w in msg for w in ["columna", "columnas", "datos tengo", "campos", "variables tengo", "qué datos", "que datos", "qué columnas", "que columnas"]):
        if column_types and has_data:
            numeric = [c["name"] for c in column_types if c.get("dtype") == "numeric"]
            categorical = [c["name"] for c in column_types if c.get("dtype") == "categorical"]
            resp = f"**{name}** tiene **{len(column_types)} columnas**:\n\n"
            if numeric:
                resp += f"**Numéricas ({len(numeric)}):** {', '.join(numeric)}\n\n"
            if categorical:
                resp += f"**Categóricas ({len(categorical)}):** {', '.join(categorical)}\n\n"
            resp += f"Variable objetivo: **{target}**"
            if date_cols:
                resp += f"\nColumnas temporales detectadas: **{', '.join(d['col'] for d in date_cols)}**"
            return resp
        return "Sube un dataset CSV para ver las columnas disponibles."

    # ── Feature importance ───────────────────────────────────────────────
    if any(w in msg for w in ["variable", "importante", "importancia", "influye", "feature", "predictiva"]):
        if fi and has_data:
            top = sorted(fi, key=lambda x: x.get("importance", 0), reverse=True)[:5]
            lines = [f"Las **variables más importantes** para predecir **{target}**:\n"]
            for f in top:
                pct = round(f.get('importance', 0) * 100, 1)
                bar = "█" * int(pct / 10) + "░" * (10 - int(pct / 10))
                lines.append(f"- **{f['feature']}**: {bar} {pct}%")
            return "\n".join(lines)
        return "Necesito datos con modelo entrenado para calcular la importancia de variables."

    # ── Metrics / performance ────────────────────────────────────────────
    if any(w in msg for w in ["r2", "r²", "accuracy", "precision", "métrica", "metrica", "rendimiento", "resultado", "mae", "rmse", "error"]):
        if metrics and has_data:
            r2  = metrics.get("r2")
            acc = metrics.get("accuracy")
            mae = metrics.get("mae")
            rmse = metrics.get("rmse")
            if r2 is not None:
                q = "excelente" if r2 > 0.85 else "bueno" if r2 > 0.7 else "moderado" if r2 > 0.5 else "mejorable — considera más datos o ajustar hiperparámetros"
                resp = f"**Métricas del modelo {model}**:\n\n"
                resp += f"- **R² = {r2:.3f}** → {q}\n"
                resp += f"  El modelo explica el **{r2*100:.1f}%** de la varianza de {target}\n"
                if mae: resp += f"- **MAE = {mae:.3f}** → error medio absoluto de predicción\n"
                if rmse: resp += f"- **RMSE = {rmse:.3f}** → raíz del error cuadrático medio\n"
                return resp
            if acc is not None:
                q = "excelente" if acc > 0.9 else "bueno" if acc > 0.75 else "moderado"
                return f"**Accuracy = {acc*100:.1f}%** ({q})\nEl modelo clasifica correctamente {round(acc*100,1)} de cada 100 casos de {target}."
        return "No hay métricas disponibles. Sube un CSV para entrenar el modelo."

    # ── Data quality ─────────────────────────────────────────────────────
    if any(w in msg for w in ["anomalia", "anomalía", "outlier", "faltante", "nulo", "calidad", "missing"]):
        if has_data:
            missing = 100 - quality
            q_txt = "alta" if quality > 90 else "media" if quality > 70 else "baja"
            resp = f"**Calidad del dataset {name}: {quality}% ({q_txt})**\n\n"
            resp += f"- Valores faltantes: ~{missing:.1f}% (imputados automáticamente)\n" if missing > 2 else "- Sin valores faltantes significativos\n"
            extremes = [s for s in stats if s.get("max") and s.get("mean") and s.get("max", 0) > 4 * max(s.get("mean", 1) or 1, 0.001)]
            if extremes:
                resp += f"- Posibles outliers en **{extremes[0]['column']}** (máx={extremes[0]['max']:.2f} vs media={extremes[0]['mean']:.2f})\n"
            return resp
        return "Sube un dataset para analizar su calidad."

    # ── Summary ───────────────────────────────────────────────────────────
    if any(w in msg for w in ["resumen", "resume", "overview", "cuéntame", "cuentame", "qué hay", "que hay", "dime todo"]):
        if has_data:
            num = ctx.get("numeric_columns", 0)
            cat = ctx.get("categorical_columns", 0)
            r2  = metrics.get("r2")
            acc = metrics.get("accuracy")
            perf = f"R²={r2:.3f}" if r2 is not None else (f"Accuracy={acc*100:.1f}%" if acc is not None else "sin métrica")
            resp = f"**Resumen de {name}**\n\n"
            resp += f"- {rows:,} filas × {cols} columnas ({num} numéricas, {cat} categóricas)\n"
            resp += f"- Problema: **{problem}** | Objetivo: **{target}**\n"
            resp += f"- Modelo: **{model}** | Rendimiento: **{perf}**\n"
            resp += f"- Calidad de datos: **{quality}%**\n"
            if date_cols:
                resp += f"- Rango temporal: **{date_cols[0]['min']} – {date_cols[0]['max']}**\n"
            if fi:
                top = sorted(fi, key=lambda x: x.get("importance", 0), reverse=True)[:2]
                resp += f"- Variables clave: **{', '.join(f['feature'] for f in top)}**\n"
            return resp
        return "Sube un CSV para ver el resumen."

    # ── Predictions ──────────────────────────────────────────────────────
    if any(w in msg for w in ["predic", "estimar", "calcular", "inferencia"]):
        if has_data and target:
            return f"El modelo predice **{target}** basándose en las otras columnas. Ve a la pestaña **Predicciones**, ajusta los valores de entrada y obtendrás la estimación con puntuación de confianza en tiempo real."
        return "Sube un CSV para entrenar el modelo. Luego podrás hacer predicciones en la pestaña correspondiente."

    # ── Greetings ─────────────────────────────────────────────────────────
    if any(w in msg for w in ["hola", "buenas", "hey", "gracias", "perfecto", "genial"]):
        if has_data:
            return f"¡Hola! He analizado **{name}**. Puedo explicarte:\n- Por qué se eligió {model}\n- Qué variables importan más\n- Los rangos temporales del dataset\n- Cómo interpretar el R²={metrics.get('r2','-')}\n¿Qué quieres saber?"
        return "¡Hola! Sube un archivo CSV y analizaré sus datos, entrenarás el modelo más adecuado y podré responder cualquier pregunta sobre ellos."

    # ── Default ───────────────────────────────────────────────────────────
    if has_data:
        r2  = metrics.get("r2")
        acc = metrics.get("accuracy")
        perf = f"R²={r2:.3f}" if r2 is not None else (f"accuracy={acc*100:.1f}%" if acc is not None else "")
        fi_top = f"Variable principal: **{sorted(fi, key=lambda x: x.get('importance',0), reverse=True)[0]['feature']}**." if fi else ""
        return f"Sobre **{name}**: {rows:,} filas · **{model}** ({problem}) {f'· {perf}' if perf else ''}. {fi_top}\n\nPuedo responder sobre: columnas, modelo, métricas, fechas, anomalías, gráficas o predicciones. ¿Qué quieres saber?"

    return "Sube un archivo CSV y analizaré la estructura, entrenaré el modelo más apropiado y podré responder preguntas específicas sobre tus datos."


def generate_insights(analysis_data: dict) -> list:
    """Generate AI insights. Uses a single batched Gemini call with 12s timeout."""
    if _gemini_key():
        result = _generate_with_llm(analysis_data)
        if result:
            return result
    return _generate_rule_based(analysis_data)


def _generate_with_llm(data: dict) -> list:
    import re
    summary = _build_context(data)
    problem = data.get("problem_type", "")
    metrics = data.get("metrics", {})
    rows = data.get("rows", 0)
    fi = data.get("feature_importance", [])
    fi_text = ", ".join(f"{f['feature']} ({round(f.get('importance',0)*100,1)}%)" for f in (fi or [])[:3]) if fi else "no disponible"
    r2 = metrics.get("r2")
    acc = metrics.get("accuracy")
    sil = metrics.get("silhouette")

    combined_prompt = f"""Eres un Data Scientist senior analizando un dataset. Contexto: {summary}

Variables más importantes: {fi_text}
Filas: {rows} | Tipo: {problem}
{'R²='+str(r2) if r2 is not None else ''} {'Accuracy='+str(acc) if acc is not None else ''} {'Silhouette='+str(sil) if sil is not None else ''}

Genera exactamente 5 insights concisos en español en formato JSON. Usa datos REALES del contexto, NO genéricos.
Detecta: correlaciones fuertes, riesgos de overfitting (pocas filas/muchas features), calidad de datos, patrones del modelo, recomendaciones accionables.
Para clustering: explica qué significa cada grupo detectado.

[
  {{"type": "correlation", "text": "...observación específica sobre relaciones entre variables..."}},
  {{"type": "trend", "text": "...patrón o tendencia principal con métricas concretas..."}},
  {{"type": "anomaly", "text": "...riesgo detectado (overfitting, pocas filas, missing values, etc.)..."}},
  {{"type": "recommendation", "text": "...recomendación accionable concreta con datos reales..."}},
  {{"type": "recommendation", "text": "...segunda recomendación sobre mejora del modelo o datos..."}}
]
Responde SOLO con el array JSON, sin texto extra."""

    raw = _gemini_call(SYSTEM_PROMPT, combined_prompt, timeout=12)
    if raw:
        try:
            match = re.search(r'\[.*\]', raw, re.DOTALL)
            if match:
                items = json.loads(match.group())
                return [i for i in items if isinstance(i, dict) and "type" in i and "text" in i]
        except Exception:
            pass
    return _generate_rule_based(data)


def _build_context(data: dict) -> str:
    parts = [
        f"Dataset: {data.get('dataset_name', 'Unknown')}",
        f"Shape: {data.get('rows', 0)} rows, {data.get('columns', 0)} columns",
        f"Problem type: {data.get('problem_type', 'Unknown')}",
        f"Target variable: {data.get('target_column', 'None')}",
        f"Data quality: {data.get('data_quality_score', 0)}%",
        f"Numeric features: {data.get('numeric_columns', 0)}",
        f"Categorical features: {data.get('categorical_columns', 0)}",
    ]
    if data.get("metrics"):
        m = data["metrics"]
        if "r2" in m:
            parts.append(f"Model R²: {m['r2']}")
        if "accuracy" in m:
            parts.append(f"Model accuracy: {m['accuracy']}")
    if data.get("statistics"):
        stats_preview = data["statistics"][:3]
        for s in stats_preview:
            parts.append(f"Feature '{s['column']}': mean={s.get('mean', 'N/A')}, std={s.get('std', 'N/A')}")
    return " | ".join(parts)


def _generate_rule_based(data: dict) -> list:
    insights = []
    target = data.get("target_column", "target variable")
    numeric = data.get("numeric_columns", 0)
    rows = data.get("rows", 0)
    quality = data.get("data_quality_score", 85)
    problem = data.get("problem_type", "regression")
    metrics = data.get("metrics", {})

    insights.append({
        "type": "correlation",
        "text": f"Analysis reveals {numeric} numerical features that may exhibit multicollinearity. "
                f"Examining the correlation matrix can help identify which features are most predictive of {target}.",
    })

    r2 = metrics.get("r2")
    acc = metrics.get("accuracy")
    if r2 is not None:
        q = "excellent" if r2 > 0.85 else "moderate" if r2 > 0.6 else "low"
        insights.append({
            "type": "trend",
            "text": f"The predictive model demonstrates {q} performance with R²={r2:.3f}, "
                    f"suggesting {'strong' if r2 > 0.7 else 'limited'} linear relationships between features and {target}.",
        })
    elif acc is not None:
        insights.append({
            "type": "trend",
            "text": f"Classification accuracy of {acc*100:.1f}% indicates the model has {'learned' if acc > 0.75 else 'partially learned'} "
                    f"the decision boundary for {target}.",
        })

    if quality < 90:
        insights.append({
            "type": "anomaly",
            "text": f"Data quality score of {quality}% indicates some missing values or inconsistencies. "
                    f"Imputing or removing incomplete records could improve model performance.",
        })
    else:
        insights.append({
            "type": "anomaly",
            "text": f"Dataset completeness is high at {quality}%, with no significant missing value concerns detected. "
                    f"Focus can be directed toward feature engineering rather than data cleaning.",
        })

    insights.append({
        "type": "recommendation",
        "text": f"With {rows:,} observations, consider cross-validation with k=5 folds to reduce overfitting risk. "
                f"Feature selection based on importance scores could further improve generalization.",
    })

    return insights


def _fallback_insight(insight_type: str, data: dict) -> dict:
    target = data.get("target_column", "target")
    fallbacks = {
        "correlation": f"Strong correlations detected between numerical features — examine the heatmap for relationships affecting {target}.",
        "trend": "The data exhibits a clear trend suitable for predictive modeling with the selected algorithm.",
        "anomaly": "Some outliers detected in the numerical distributions — consider robust scaling for improved performance.",
        "recommendation": f"Increase training data volume and apply hyperparameter tuning to further improve {target} prediction accuracy.",
    }
    return {"type": insight_type, "text": fallbacks.get(insight_type, "Analysis complete.")}
