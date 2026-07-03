"""
╔══════════════════════════════════════════════════════════════╗
║         NutriBot — IBM Watsonx.ai Nutrition Agent            ║
║         Flask Backend | app.py                               ║
╚══════════════════════════════════════════════════════════════╝

Endpoints:
  GET  /                    → Main UI
  POST /api/chat            → Chat with NutriBot
  POST /api/nutrition-plan  → Generate full nutrition plan
  POST /api/meal-plan       → Generate weekly meal plan
  POST /api/bmi             → BMI + calorie calculation
  POST /api/analyze-meal    → Analyze a described meal
  GET  /api/health          → Health check
"""

import os
import json
import logging
from datetime import datetime, timezone
from flask import Flask, render_template, request, jsonify, session
from flask_cors import CORS
from dotenv import load_dotenv
from ibm_watsonx_ai import Credentials
from ibm_watsonx_ai.foundation_models import ModelInference
from ibm_watsonx_ai.metanames import GenTextParamsMetaNames as GenParams
try:
    from ibm_watsonx_ai.wml_client_error import CannotSetProjectOrSpace as _WxAuthError
except ImportError:
    _WxAuthError = Exception  # fallback if SDK restructures

from agent_config import AGENT_INSTRUCTIONS, MODEL_CONFIG, APP_META
import database
import data_utils

# ─── Load environment variables ───────────────────────────────────────────────
load_dotenv()

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("nutribot")

# ─── Flask app ────────────────────────────────────────────────────────────────
app = Flask(__name__, template_folder="templates", static_folder="static")
app.secret_key = os.getenv("FLASK_SECRET_KEY", "nutribot-secret-fallback-key")
CORS(app)

# Initialize Database
database.init_db()

# ─── Watsonx.ai client initialization ────────────────────────────────────────
def _init_watsonx_model():
    api_key    = os.getenv("WATSONX_API_KEY")
    project_id = os.getenv("WATSONX_PROJECT_ID")
    url        = os.getenv("WATSONX_URL", "https://us-south.ml.cloud.ibm.com")

    if not api_key or not project_id:
        logger.warning("WATSONX_API_KEY or WATSONX_PROJECT_ID not set. Using demo mode.")
        return None

    try:
        credentials = Credentials(url=url, api_key=api_key)

        gen_params = {
            GenParams.MAX_NEW_TOKENS:      MODEL_CONFIG["max_new_tokens"],
            GenParams.TEMPERATURE:         MODEL_CONFIG["temperature"],
            GenParams.TOP_P:               MODEL_CONFIG["top_p"],
            GenParams.TOP_K:               MODEL_CONFIG["top_k"],
            GenParams.REPETITION_PENALTY:  MODEL_CONFIG["repetition_penalty"],
            GenParams.STOP_SEQUENCES:      MODEL_CONFIG["stop_sequences"],
        }

        model = ModelInference(
            model_id=MODEL_CONFIG["model_id"],
            credentials=credentials,
            project_id=project_id,
            params=gen_params,
        )
        logger.info("Watsonx.ai model '%s' initialized successfully.", MODEL_CONFIG["model_id"])
        return model
    except _WxAuthError as exc:
        logger.warning("Invalid Watsonx.ai credentials/project — running in demo mode. (%s)", exc)
        return None
    except Exception as exc:
        logger.warning("Could not connect to Watsonx.ai — running in demo mode. (%s)", exc)
        return None


watsonx_model = _init_watsonx_model()


# ─── Core AI call ─────────────────────────────────────────────────────────────
def call_watsonx(prompt: str) -> str:
    """Send a prompt to Watsonx.ai and return the generated text."""
    if watsonx_model is None:
        return _mock_response(prompt)

    try:
        response = watsonx_model.generate_text(prompt=prompt)
        return response.strip() if isinstance(response, str) else str(response).strip()
    except Exception as exc:
        logger.error("Watsonx.ai API error: %s", exc)
        return (
            "⚠️ I'm having trouble connecting to my AI backend right now. "
            "Please check your IBM Watsonx.ai credentials in the `.env` file and try again."
        )


def _mock_response(prompt: str) -> str:
    """Fallback when credentials are not configured — useful for UI development."""
    return (
        "🤖 **NutriBot (Demo Mode)**\n\n"
        "I'm running in demo mode because IBM Watsonx.ai credentials are not configured yet.\n\n"
        "To activate the full AI, add your `WATSONX_API_KEY` and `WATSONX_PROJECT_ID` "
        "to the `.env` file and restart the server.\n\n"
        "📌 Your question was received:\n> " + prompt[-200:] + "\n\n"
        "_Set up your credentials to get real AI-powered nutrition advice!_"
    )


# ─── Prompt builders ──────────────────────────────────────────────────────────
def build_chat_prompt(user_message: str, chat_history: list, user_profile: dict) -> str:
    profile_text = _format_profile(user_profile)
    history_text = _format_history(chat_history)
    db_context = data_utils.get_context_for_llm(user_message)

    return f"""<|system|>
{AGENT_INSTRUCTIONS}

{profile_text}
<|end|>
{history_text}
<|user|>
{db_context}
{user_message}
<|assistant|>
"""


def build_nutrition_plan_prompt(profile: dict) -> str:
    name       = profile.get("name", "the user")
    age        = profile.get("age", "unknown")
    gender     = profile.get("gender", "not specified")
    weight     = profile.get("weight", "unknown")
    height     = profile.get("height", "unknown")
    goal       = profile.get("goal", "maintain weight")
    diet_type  = profile.get("diet_type", "balanced")
    conditions = profile.get("health_conditions", "none")
    allergies  = profile.get("allergies", "none")
    cuisine    = profile.get("cuisine", "Indian")
    activity   = profile.get("activity_level", "moderate")

    return f"""<|system|>
{AGENT_INSTRUCTIONS}
<|end|>
<|user|>
Generate a complete, personalized 7-day nutrition plan for:
- Name: {name}
- Age: {age} | Gender: {gender}
- Weight: {weight} kg | Height: {height} cm
- Goal: {goal}
- Diet type: {diet_type}
- Activity level: {activity}
- Health conditions: {conditions}
- Food allergies/intolerances: {allergies}
- Cuisine preference: {cuisine}

Include:
1. Daily calorie target and macro breakdown (protein/carbs/fat in grams)
2. A sample one-day detailed meal plan with timings and approximate calories
3. 5 key nutrition tips personalized to their goal
4. Foods to eat more of and foods to limit
5. A motivating closing message
<|assistant|>
"""


def build_meal_plan_prompt(preferences: dict) -> str:
    days      = preferences.get("days", 7)
    meals     = preferences.get("meals_per_day", 3)
    diet      = preferences.get("diet_type", "balanced")
    calories  = preferences.get("target_calories", 2000)
    cuisine   = preferences.get("cuisine", "Indian")
    goal      = preferences.get("goal", "healthy eating")
    exclusions = preferences.get("exclusions", "none")

    return f"""<|system|>
{AGENT_INSTRUCTIONS}
<|end|>
<|user|>
Create a {days}-day meal plan with {meals} meals per day.
- Diet type: {diet}
- Daily calorie target: {calories} kcal
- Cuisine preference: {cuisine}
- Health goal: {goal}
- Exclude these foods: {exclusions}

Format each day clearly with breakfast, lunch, dinner (and snacks if applicable).
Include approximate calorie count for each meal.
<|assistant|>
"""


def build_meal_analysis_prompt(meal_description: str) -> str:
    db_context = data_utils.get_context_for_llm(meal_description)
    return f"""<|system|>
{AGENT_INSTRUCTIONS}
<|end|>
<|user|>
Analyze the nutritional value of the following meal:

"{meal_description}"

{db_context}
Provide:
1. Estimated calorie count
2. Macro breakdown (protein, carbs, fat in grams)
3. Key micronutrients present
4. Health rating (1–10) with reasoning
5. One suggestion to make it healthier
<|assistant|>
"""


def build_family_plan_prompt(family_members: list) -> str:
    members_text = "\n".join(
        f"  - {m.get('name', 'Member')}: Age {m.get('age', '?')}, "
        f"Gender {m.get('gender', '?')}, Goal: {m.get('goal', 'healthy eating')}, "
        f"Conditions: {m.get('conditions', 'none')}"
        for m in family_members
    )

    return f"""<|system|>
{AGENT_INSTRUCTIONS}
<|end|>
<|user|>
Create a unified family nutrition plan for the following family members:

{members_text}

Generate:
1. A shared family meal plan that works for everyone
2. Individual modifications needed for each member
3. Practical shopping list highlights
4. Tips for cooking one meal that satisfies all dietary needs
<|assistant|>
"""


# ─── Helper functions ─────────────────────────────────────────────────────────
def _format_profile(profile: dict) -> str:
    if not profile:
        return ""
    parts = ["Current user profile:"]
    for k, v in profile.items():
        if v:
            parts.append(f"  {k.replace('_', ' ').title()}: {v}")
    return "\n".join(parts)


def _format_history(history: list) -> str:
    if not history:
        return ""
    lines = []
    for turn in history[-6:]:   # keep last 6 turns for context
        role = turn.get("role", "user")
        msg  = turn.get("content", "")
        tag  = "<|user|>" if role == "user" else "<|assistant|>"
        lines.append(f"{tag}\n{msg}\n<|end|>")
    return "\n".join(lines)


def _calculate_bmi(weight_kg: float, height_cm: float) -> dict:
    height_m = height_cm / 100
    bmi = weight_kg / (height_m ** 2)
    bmi = round(bmi, 1)

    if bmi < 18.5:
        category, advice = "Underweight", "Focus on calorie-dense, nutrient-rich foods to gain healthy weight."
    elif bmi < 25.0:
        category, advice = "Normal weight", "Great! Maintain your healthy weight with balanced nutrition."
    elif bmi < 30.0:
        category, advice = "Overweight", "Aim for a moderate calorie deficit with increased physical activity."
    else:
        category, advice = "Obese", "Consult a healthcare provider for a medically supervised weight-loss plan."

    return {"bmi": bmi, "category": category, "advice": advice}


def _calculate_tdee(weight: float, height: float, age: int, gender: str, activity: str) -> dict:
    # Mifflin-St Jeor BMR
    if gender.lower() in ("male", "m"):
        bmr = 10 * weight + 6.25 * height - 5 * age + 5
    else:
        bmr = 10 * weight + 6.25 * height - 5 * age - 161

    multipliers = {
        "sedentary": 1.2,
        "light": 1.375,
        "moderate": 1.55,
        "active": 1.725,
        "very_active": 1.9,
    }
    mult = multipliers.get(activity.lower(), 1.55)
    tdee = round(bmr * mult)

    return {
        "bmr":           round(bmr),
        "tdee":          tdee,
        "weight_loss":   tdee - 500,
        "weight_gain":   tdee + 500,
        "macros": {
            "protein_g":  round(weight * 1.6),
            "carbs_g":    round((tdee * 0.45) / 4),
            "fat_g":      round((tdee * 0.30) / 9),
        },
    }


# ─── Routes ───────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html", app_meta=APP_META)


@app.route("/api/health")
def health_check():
    return jsonify({
        "status": "ok",
        "model": MODEL_CONFIG["model_id"],
        "watsonx_connected": watsonx_model is not None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "app": APP_META["name"],
    })


@app.route("/api/chats", methods=["GET"])
def get_chats():
    sessions = database.get_all_sessions()
    return jsonify({"sessions": sessions})

@app.route("/api/chats", methods=["POST"])
def create_chat():
    data = request.get_json(silent=True) or {}
    title = data.get("title", "New Chat")
    session_id = database.create_session(title)
    return jsonify({"session_id": session_id})

@app.route("/api/chats/<session_id>", methods=["GET"])
def get_chat(session_id):
    messages = database.get_session_messages(session_id)
    return jsonify({"messages": messages})

@app.route("/api/chats/<session_id>", methods=["DELETE"])
def delete_chat(session_id):
    database.delete_session(session_id)
    return jsonify({"status": "deleted"})

@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}
    user_message = data.get("message", "").strip()
    session_id = data.get("session_id")
    # For backward compatibility or if not provided, just use the provided history
    chat_history = data.get("history", [])
    user_profile = data.get("profile", {})

    if not user_message:
        return jsonify({"error": "Message is required."}), 400

    if session_id:
        database.add_message(session_id, "user", user_message)
        # Fetch actual history from DB for prompt building
        db_messages = database.get_session_messages(session_id)
        chat_history = [{"role": msg["role"], "content": msg["content"]} for msg in db_messages[:-1]] # exclude current user message

    prompt   = build_chat_prompt(user_message, chat_history, user_profile)
    response = call_watsonx(prompt)

    if session_id:
        database.add_message(session_id, "assistant", response)

    return jsonify({
        "reply":     response,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


@app.route("/api/nutrition-plan", methods=["POST"])
def nutrition_plan():
    profile = request.get_json(silent=True) or {}
    if not profile.get("name") and not profile.get("age"):
        return jsonify({"error": "At least name or age is required to generate a plan."}), 400

    prompt   = build_nutrition_plan_prompt(profile)
    response = call_watsonx(prompt)

    return jsonify({
        "plan":      response,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


@app.route("/api/meal-plan", methods=["POST"])
def meal_plan():
    preferences = request.get_json(silent=True) or {}
    prompt      = build_meal_plan_prompt(preferences)
    response    = call_watsonx(prompt)

    return jsonify({
        "meal_plan": response,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


@app.route("/api/analyze-meal", methods=["POST"])
def analyze_meal():
    data = request.get_json(silent=True) or {}
    meal_description = data.get("meal", "").strip()

    if not meal_description:
        return jsonify({"error": "Meal description is required."}), 400

    prompt   = build_meal_analysis_prompt(meal_description)
    response = call_watsonx(prompt)

    return jsonify({
        "analysis":  response,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


@app.route("/api/search-food", methods=["POST"])
def search_food_api():
    data = request.get_json(silent=True) or {}
    query = data.get("query", "").strip()
    
    if not query:
        return jsonify({"results": []})
        
    results = data_utils.search_food(query, limit=5)
    return jsonify({"results": results})


@app.route("/api/progress", methods=["GET"])
def get_progress():
    progress = database.get_progress()
    return jsonify({"progress": progress})


@app.route("/api/progress", methods=["POST"])
def add_progress():
    data = request.get_json(silent=True) or {}
    weight = data.get("weight")
    bmi = data.get("bmi")
    
    if not weight or not bmi:
        return jsonify({"error": "Weight and BMI are required."}), 400
        
    try:
        database.add_progress(float(weight), float(bmi))
        return jsonify({"status": "success"})
    except Exception as e:
        logger.error(f"Error adding progress: {e}")
        return jsonify({"error": "Failed to add progress"}), 500



@app.route("/api/family-plan", methods=["POST"])
def family_plan():
    data           = request.get_json(silent=True) or {}
    family_members = data.get("members", [])

    if not family_members:
        return jsonify({"error": "At least one family member is required."}), 400

    prompt   = build_family_plan_prompt(family_members)
    response = call_watsonx(prompt)

    return jsonify({
        "plan":      response,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


@app.route("/api/bmi", methods=["POST"])
def bmi_calculator():
    data = request.get_json(silent=True) or {}

    try:
        weight   = float(data["weight"])
        height   = float(data["height"])
        age      = int(data.get("age", 25))
        gender   = data.get("gender", "female")
        activity = data.get("activity_level", "moderate")
    except (KeyError, ValueError, TypeError):
        return jsonify({"error": "weight and height are required numeric fields."}), 400

    bmi_data  = _calculate_bmi(weight, height)
    tdee_data = _calculate_tdee(weight, height, age, gender, activity)

    return jsonify({**bmi_data, **tdee_data, "timestamp": datetime.now(timezone.utc).isoformat()})


# ─── Entry point ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port  = int(os.getenv("APP_PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "True").lower() == "true"
    logger.info("Starting NutriBot on port %d (debug=%s)", port, debug)
    app.run(host="0.0.0.0", port=port, debug=debug)
