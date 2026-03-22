from datetime import datetime

def check_expiry(expiry_date):
    today = datetime.today()
    days = (expiry_date - today).days

    if days <= 7:
        return "CRITICAL"
    elif days <= 30:
        return "WARNING"
    else:
        return "SAFE"