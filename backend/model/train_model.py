import pandas as pd
from sklearn.ensemble import RandomForestClassifier
import joblib

# Load the dataset
data = pd.read_csv("dataset.csv")

# Map performance priorities to numerical values for the model
priority_mapping = {
    'CPU': 1,
    'GPU': 2,
    'RAM': 3,
    'Storage': 4
}
data['priority'] = data['priority'].map(priority_mapping)

# Define features and target variable
X = data[['budget', 'usage', 'priority']]
y = data['tier']

# Train the model
model = RandomForestClassifier(n_estimators=50)
model.fit(X, y)

# Save the trained model
joblib.dump(model, "model.pkl")
print("Model trained with performance priorities!")