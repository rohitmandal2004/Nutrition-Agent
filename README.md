# 🥗 NutriBot — AI-Powered Nutrition Agent

> **Powered by IBM Watsonx.ai Granite models**  
> A full-stack Flask web application for personalized nutrition planning, meal analysis, BMI calculations, and family diet recommendations — with a bold **Neobrutalism** design.

---

## 📸 Features

| Feature | Description |
|---|---|
| 💬 **AI Chat** | Conversational nutrition advice powered by IBM Granite |
| 📋 **Nutrition Dashboard** | Generate personalized 7-day nutrition plans |
| 🗓️ **Meal Planner** | Weekly meal plans with cuisine and dietary preferences |
| 📏 **BMI Calculator** | BMI + TDEE + macro targets with visual display |
| 👨‍👩‍👧‍👦 **Family Planner** | Unified family meal plans with per-member customization |
| 🔍 **Meal Analyzer** | AI analysis of any described meal |
| 🌙 **Dark Mode** | Full dark/light theme toggle |
| 📱 **Responsive** | Mobile-first design |

---

## 🗂️ Project Structure

```
NutriBot/
├── app.py                  # Flask backend with all API routes
├── agent_config.py         # ⭐ AGENT INSTRUCTIONS — customize AI behavior here
├── requirements.txt        # Python dependencies
├── .env.example            # Environment variable template
├── .env                    # Your secrets (never commit this!)
│
├── templates/
│   └── index.html          # Main frontend (Neobrutalism UI)
│
└── static/
    ├── css/
    │   └── style.css       # Neobrutalism design system
    └── js/
        └── app.js          # Frontend application logic
```

---

## ⚡ Quick Start

### 1. Clone / Download
```bash
git clone <your-repo-url>
cd NutriBot
```

### 2. Create a Python Virtual Environment
```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure IBM Watsonx.ai Credentials

Copy the example env file:
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```env
WATSONX_API_KEY=your_ibm_cloud_api_key_here
WATSONX_PROJECT_ID=your_watsonx_project_id_here
WATSONX_URL=https://us-south.ml.cloud.ibm.com
FLASK_SECRET_KEY=any-random-secret-string
```

**Where to get credentials:**
1. Log in to [IBM Cloud](https://cloud.ibm.com)
2. Go to **IBM Watsonx.ai** → Create a project
3. Copy your **Project ID** from Project Settings
4. Create an **API Key** from IAM → API Keys

### 5. Run the App
```bash
python app.py
```

Open your browser at: **http://localhost:5000**

---

## 🎛️ Customizing the Agent (`agent_config.py`)

The [`agent_config.py`](agent_config.py) file is your single control panel to customize NutriBot's behavior. No changes to the backend logic are needed.

### Change the AI Model
```python
MODEL_CONFIG = {
    "model_id": "ibm/granite-3-3-8b-instruct",  # or granite-13b-chat-v2
    "max_new_tokens": 1024,
    "temperature": 0.7,   # Lower = more factual, Higher = more creative
    ...
}
```

### Customize Agent Persona
Edit `AGENT_INSTRUCTIONS` in `agent_config.py`:

```python
AGENT_INSTRUCTIONS = """
You are NutriBot, a ...   ← Change persona here
...
TONE                      ← Change tone
...
DIET SPECIALIZATIONS      ← Add/remove diets
...
INDIAN FOOD PREFERENCES   ← Edit regional cuisines
...
SAFETY RULES              ← Adjust safety rules
...
"""
```

### Key Sections You Can Customize

| Section | What to change |
|---|---|
| `PERSONA & TONE` | Formal / casual / clinical tone |
| `DIET SPECIALIZATIONS` | Add new dietary frameworks |
| `INDIAN FOOD PREFERENCES` | Add regional cuisines, local foods |
| `FAMILY PROFILE HANDLING` | Rules for children, seniors, pregnancy |
| `CALORIE & MACRO ANALYSIS` | Macro ratios per goal |
| `MEAL PLANNING FORMAT` | Output structure and timing |
| `SAFETY & DISCLAIMER RULES` | Add/remove safety guardrails |
| `MODEL_CONFIG → temperature` | Creativity vs factual accuracy |

---

## 🌐 API Reference

All endpoints accept and return JSON.

### `GET /api/health`
Health check — confirms Watsonx.ai connection status.

### `POST /api/chat`
```json
{
  "message": "What should I eat for breakfast?",
  "history": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}],
  "profile": {"name": "Priya", "age": 30, "goal": "lose weight"}
}
```

### `POST /api/nutrition-plan`
```json
{
  "name": "Raj", "age": 35, "gender": "male",
  "weight": 80, "height": 175,
  "goal": "lose weight", "diet_type": "vegetarian",
  "activity_level": "moderate", "cuisine": "South Indian",
  "health_conditions": "pre-diabetes", "allergies": "none"
}
```

### `POST /api/meal-plan`
```json
{
  "days": 7, "meals_per_day": 3,
  "diet_type": "vegetarian", "target_calories": 1800,
  "cuisine": "Indian", "goal": "weight loss",
  "exclusions": "onion, garlic"
}
```

### `POST /api/analyze-meal`
```json
{
  "meal": "2 rotis with dal makhani, a bowl of rice, and a glass of lassi"
}
```

### `POST /api/bmi`
```json
{
  "weight": 70, "height": 170, "age": 28,
  "gender": "female", "activity_level": "moderate"
}
```

### `POST /api/family-plan`
```json
{
  "members": [
    {"name": "Amit", "age": 42, "gender": "male", "goal": "heart health", "conditions": "hypertension"},
    {"name": "Sunita", "age": 38, "gender": "female", "goal": "weight loss", "conditions": "none"},
    {"name": "Riya", "age": 10, "gender": "female", "goal": "child growth", "conditions": "none"}
  ]
}
```

---

## 🚀 Deployment

### Option A: Gunicorn (Production on Linux/Mac)
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Option B: Docker
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:5000", "app:app"]
```

```bash
docker build -t nutribot .
docker run -p 5000:5000 --env-file .env nutribot
```

### Option C: IBM Code Engine
```bash
ibmcloud ce application create \
  --name nutribot \
  --image <your-image> \
  --env-from-secret nutribot-secrets \
  --min-scale 1 --max-scale 5
```

### Option D: Railway / Render / Fly.io
Set environment variables from `.env` in the platform dashboard, then deploy from GitHub.

---

## 🔒 Security Notes

- **Never commit `.env`** — it's listed in `.gitignore`
- Use IBM IAM service credentials in production (not API keys in env vars)
- Set `FLASK_DEBUG=False` in production
- Use HTTPS in production (reverse proxy with nginx or platform TLS)
- Rotate your `FLASK_SECRET_KEY` regularly

---

## 🧩 IBM Watsonx.ai Granite Models

| Model | Best For |
|---|---|
| `ibm/granite-3-3-8b-instruct` | Fast responses, good instruction following (default) |
| `ibm/granite-13b-chat-v2` | Richer, more detailed responses |
| `ibm/granite-3-8b-instruct` | Balanced performance |

Change the model in [`agent_config.py`](agent_config.py) → `MODEL_CONFIG["model_id"]`.

---

## 📦 Dependencies

| Package | Version | Purpose |
|---|---|---|
| `flask` | 3.0.3 | Web framework |
| `flask-cors` | 4.0.1 | CORS headers |
| `python-dotenv` | 1.0.1 | `.env` file loading |
| `ibm-watsonx-ai` | 1.1.2 | Watsonx.ai Python SDK |
| `gunicorn` | 22.0.0 | Production WSGI server |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📜 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">
  <strong>Built with ❤️ using IBM Watsonx.ai Granite</strong><br/>
  <sub>NutriBot v1.0.0</sub>
</div>
# Nutrition-Agent
# Nutrition-Agent
