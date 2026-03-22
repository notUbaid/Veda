import pandas as pd
from sklearn.linear_model import LinearRegression

def forecast_usage(data):
    df = pd.DataFrame({
        "day": range(len(data)), # sytantic data pe train 
        "usage": data
    })

    X = df[["day"]]
    y = df["usage"]

    model = LinearRegression()
    model.fit(X, y)

    future_days = [[len(data) + i] for i in range(1, 8)]
    predictions = model.predict(future_days)

    return predictions.tolist()