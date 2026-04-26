import pandas as pd
from sklearn.ensemble import RandomForestClassifier
import joblib

data = pd.read_csv("dataset.csv")

X = data[['budget', 'usage', 'priority']]
y = data['tier']

model = RandomForestClassifier(n_estimators=50)
model.fit(X, y)

joblib.dump(model, "model.pkl")
print("Model trained!")