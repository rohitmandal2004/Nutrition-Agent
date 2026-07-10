import pandas as pd
import os
import re

# Load the dataset
# Assumes data/Indian_Food_Nutrition_Processed.csv exists
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, 'data', 'Indian_Food_Nutrition_Processed.csv')

# Global dataframe
_df = None

def load_data():
    global _df
    if _df is None:
        try:
            _df = pd.read_csv(CSV_PATH)
            # Fill NaNs with 0 for numeric columns
            numeric_cols = _df.select_dtypes(include=['float64', 'int64']).columns
            _df[numeric_cols] = _df[numeric_cols].fillna(0)
            # Ensure Dish Name is string
            _df['Dish Name'] = _df['Dish Name'].fillna('').astype(str)
        except Exception as e:
            print(f"Error loading food database: {e}")
            _df = pd.DataFrame() # Fallback to empty DF

def search_food(query, limit=5):
    """
    Search the Indian food database for a dish matching the query.
    Returns a list of dictionaries with nutritional info.
    """
    load_data()
    if _df.empty or not query:
        return []
        
    query = str(query).lower().strip()
    
    # 1. Exact substring match
    matches = _df[_df['Dish Name'].str.lower().str.contains(query, na=False, regex=False)]
    
    # 2. Token overlap match (if exact substring fails)
    if matches.empty:
        tokens = set(re.findall(r'\w+', query))
        if not tokens:
            return []
            
        def token_match_score(dish_name):
            dish_tokens = set(re.findall(r'\w+', str(dish_name).lower()))
            return len(tokens.intersection(dish_tokens))
            
        scores = _df['Dish Name'].apply(token_match_score)
        best_matches = _df[scores > 0].copy()
        if not best_matches.empty:
            best_matches['score'] = scores[scores > 0]
            matches = best_matches.sort_values(by='score', ascending=False)
            matches = matches.drop(columns=['score'])
    
    # Convert matches to list of dicts, replacing NaN with 0
    results = matches.head(limit).fillna(0).to_dict(orient='records')
    return results

def get_context_for_llm(query):
    """
    Helper function to get a formatted string of nutritional data 
    to inject into the LLM prompt.
    """
    results = search_food(query, limit=3)
    if not results:
        return ""
        
    context = "Here is some exact nutritional data from the Indian Food Database to use in your answer:\n"
    for item in results:
        name = item.get('Dish Name', 'Unknown')
        cal = item.get('Calories (kcal)', 0)
        prot = item.get('Protein (g)', 0)
        carbs = item.get('Carbohydrates (g)', 0)
        fats = item.get('Fats (g)', 0)
        context += f"- {name}: {cal} kcal | Protein: {prot}g | Carbs: {carbs}g | Fat: {fats}g\n"
        
    return context + "\n"
