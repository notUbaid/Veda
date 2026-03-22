# ═══════════════════════════════════════════════════════════════════
#  VEDA — Hospital Pharmacy Intelligence Backend
#  Flask + Firebase Admin SDK + scikit-learn
#
#  Endpoints consumed by the frontend:
#   GET/POST  /api/inventory
#   PATCH     /api/inventory/<id>
#   DELETE    /api/inventory/<id>
#   POST      /api/dispense
#   GET       /api/dispensing/recent
#   GET/POST  /api/orders
#   PATCH     /api/orders/<id>/status
#   GET       /api/analytics/summary
#   GET       /api/intelligence/alerts
#   GET       /api/intelligence/order-suggestions
#   GET       /api/locations
#   GET       /health
# ═══════════════════════════════════════════════════════════════════

import os
import json
import uuid
from datetime import datetime, timedelta, timezone
from functools import wraps

from flask import Flask, request, jsonify, render_template, send_from_directory, redirect
from flask_cors import CORS

# ── Optional deps — gracefully degrade if missing ──────────────────
try:
    import firebase_admin
    from firebase_admin import credentials, firestore, auth as fb_auth
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False
    print("[Veda] firebase-admin not installed — running in demo mode")

try:
    import numpy as np
    from sklearn.linear_model import LinearRegression
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False
    print("[Veda] scikit-learn not installed — ML features disabled")

# ══════════════════════════════════════════════════════════════════
#  APP INIT
# ══════════════════════════════════════════════════════════════════
app = Flask(
    __name__,
    template_folder="templates",   # all HTML files live here
    static_folder="static",        # firebase-config.js, CSS, images
    static_url_path="/static"
)
CORS(app, origins="*", supports_credentials=True)

# ══════════════════════════════════════════════════════════════════
#  FIREBASE INIT
# ══════════════════════════════════════════════════════════════════
db = None

def init_firebase():
    global db
    if not FIREBASE_AVAILABLE:
        return False
    try:
        cred_path = os.environ.get("FIREBASE_CREDENTIALS", "serviceAccountKey.json")
        if not firebase_admin._apps:
            if os.path.exists(cred_path):
                cred = credentials.Certificate(cred_path)
            else:
                # Try inline JSON from env var
                cred_json = os.environ.get("FIREBASE_CREDENTIALS_JSON")
                if cred_json:
                    cred = credentials.Certificate(json.loads(cred_json))
                else:
                    print("[Veda] No Firebase credentials found — demo mode")
                    return False
            firebase_admin.initialize_app(cred)
        db = firestore.client()
        print("[Veda] Firebase connected ✓")
        return True
    except Exception as e:
        print(f"[Veda] Firebase init error: {e} — demo mode")
        return False

FIREBASE_READY = init_firebase()

# ══════════════════════════════════════════════════════════════════
#  DEMO DATA (used when Firestore is not connected)
# ══════════════════════════════════════════════════════════════════
DEMO_INVENTORY = [
    {"id":"1","name":"Paracetamol 500mg",  "category":"Analgesic",      "batch":"BT-2024-001","qty":450,"unitCost":2.50, "expiry":"2024-04-15","row":"A1","shelf":"S1","comp":"C1","supplier":"Cipla",    "threshold":50,"dailyUsage":15},
    {"id":"2","name":"Amoxicillin 250mg",  "category":"Antibiotic",     "batch":"BT-2024-002","qty":120,"unitCost":8.00, "expiry":"2025-06-30","row":"B2","shelf":"S2","comp":"C3","supplier":"Sun Pharma","threshold":30,"dailyUsage":8},
    {"id":"3","name":"Metformin 500mg",    "category":"Diabetic",       "batch":"BT-2024-003","qty":22, "unitCost":4.00, "expiry":"2026-01-10","row":"C1","shelf":"S1","comp":"C2","supplier":"Zydus",    "threshold":30,"dailyUsage":12},
    {"id":"4","name":"Atorvastatin 10mg",  "category":"Cardiovascular", "batch":"BT-2024-004","qty":380,"unitCost":6.50, "expiry":"2026-08-20","row":"D3","shelf":"S2","comp":"C1","supplier":"Ranbaxy",  "threshold":50,"dailyUsage":10},
    {"id":"5","name":"Salbutamol Inhaler", "category":"Respiratory",    "batch":"BT-2024-005","qty":18, "unitCost":85.00,"expiry":"2024-05-01","row":"E1","shelf":"S3","comp":"C4","supplier":"GSK",      "threshold":20,"dailyUsage":5},
    {"id":"6","name":"Omeprazole 20mg",    "category":"Gastrointestinal","batch":"BT-2024-006","qty":300,"unitCost":5.00, "expiry":"2025-12-15","row":"F2","shelf":"S1","comp":"C3","supplier":"Lupin",   "threshold":40,"dailyUsage":9},
    {"id":"7","name":"Cetirizine 10mg",    "category":"Antihistamine",  "batch":"BT-2024-007","qty":8,  "unitCost":3.00, "expiry":"2024-04-10","row":"G1","shelf":"S2","comp":"C2","supplier":"Cipla",    "threshold":25,"dailyUsage":6},
    {"id":"8","name":"Ibuprofen 400mg",    "category":"Analgesic",      "batch":"BT-2024-008","qty":210,"unitCost":3.50, "expiry":"2026-03-30","row":"A2","shelf":"S1","comp":"C4","supplier":"Abbott",   "threshold":40,"dailyUsage":11},
]

DEMO_ORDERS = [
    {"id":"ORD-2024-081","medicine":"Paracetamol 500mg","qty":500,"supplier":"Cipla",     "status":"dispatched","createdAt":"2024-03-10T10:00:00Z","notes":""},
    {"id":"ORD-2024-082","medicine":"Amoxicillin 250mg","qty":200,"supplier":"Sun Pharma","status":"approved",  "createdAt":"2024-03-12T09:00:00Z","notes":""},
    {"id":"ORD-2024-083","medicine":"Salbutamol Inhaler","qty":50,"supplier":"GSK",       "status":"requested", "createdAt":"2024-03-14T11:00:00Z","notes":""},
]

DEMO_DISPENSING = [
    {"id":"D1","medicineName":"Amoxicillin 500mg","batch":"B-9920","qty":2,"patientId":"#P-88421","prescriptionNo":"RX-001","dispensedAt":"2024-03-20T09:04:00Z","dispensedBy":"pharmacist@hospital"},
    {"id":"D2","medicineName":"Metformin 500mg",  "batch":"B-2012","qty":1,"patientId":"#P-90112","prescriptionNo":"RX-002","dispensedAt":"2024-03-20T08:52:00Z","dispensedBy":"pharmacist@hospital"},
    {"id":"D3","medicineName":"Atorvastatin 20mg","batch":"B-4552","qty":1,"patientId":"#P-87220","prescriptionNo":"RX-003","dispensedAt":"2024-03-20T08:36:00Z","dispensedBy":"pharmacist@hospital"},
    {"id":"D4","medicineName":"Paracetamol 500mg","batch":"B-2047","qty":4,"patientId":"#P-90224","prescriptionNo":"RX-004","dispensedAt":"2024-03-20T08:19:00Z","dispensedBy":"pharmacist@hospital"},
    {"id":"D5","medicineName":"Ibuprofen 400mg",  "batch":"B-1029","qty":1,"patientId":"#P-88001","prescriptionNo":"RX-005","dispensedAt":"2024-03-20T08:03:00Z","dispensedBy":"pharmacist@hospital"},
]

DEMO_LOCATIONS = [
    {"id":"L1","name":"Civil Hospital Pharmacy", "type":"pharmacy", "lat":23.0225,"lng":72.5714,"value":"₹12.4L","alerts":4,"ward":"General OPD"},
    {"id":"L2","name":"VS Hospital Pharmacy",    "type":"pharmacy", "lat":23.0313,"lng":72.5680,"value":"₹8.1L", "alerts":2,"ward":"Emergency"},
    {"id":"L3","name":"LG Hospital Pharmacy",    "type":"pharmacy", "lat":23.0460,"lng":72.5560,"value":"₹6.8L", "alerts":1,"ward":"Maternity"},
    {"id":"L4","name":"Shardaben Hospital",       "type":"pharmacy", "lat":22.9960,"lng":72.5800,"value":"₹5.2L", "alerts":3,"ward":"Orthopedics"},
    {"id":"L5","name":"Sola Civil Hospital",      "type":"pharmacy", "lat":23.0720,"lng":72.5470,"value":"₹4.9L", "alerts":0,"ward":"General"},
    {"id":"L6","name":"GMERS Sola",               "type":"pharmacy", "lat":23.0820,"lng":72.5390,"value":"₹3.7L", "alerts":2,"ward":"Pediatrics"},
    {"id":"L7","name":"State Pharma Warehouse",   "type":"warehouse","lat":23.0100,"lng":72.5600,"value":"₹38.2L","alerts":0,"ward":"Central Store"},
    {"id":"L8","name":"North Zone Depot",         "type":"warehouse","lat":23.0950,"lng":72.5200,"value":"₹22.6L","alerts":1,"ward":"Distribution"},
]

# In-memory store when Firestore is unavailable
_mem_inventory  = {i["id"]: i.copy() for i in DEMO_INVENTORY}
_mem_orders     = {o["id"]: o.copy() for o in DEMO_ORDERS}
_mem_dispensing = list(DEMO_DISPENSING)

# ══════════════════════════════════════════════════════════════════
#  AUTH MIDDLEWARE
# ══════════════════════════════════════════════════════════════════
def verify_token(token: str):
    """Verify Firebase ID token. Returns decoded claims dict or None."""
    if not FIREBASE_READY or not token:
        return None
    try:
        return fb_auth.verify_id_token(token)
    except Exception:
        return None

def require_auth(f):
    """Decorator: require valid Firebase token OR demo mode."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not FIREBASE_READY:
            # Demo mode — skip auth
            return f(*args, **kwargs)
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing Authorization header"}), 401
        token = auth_header.split(" ", 1)[1]
        if token == "demo-token":
            return f(*args, **kwargs)
        decoded = verify_token(token)
        if not decoded:
            return jsonify({"error": "Invalid or expired token"}), 401
        request.user = decoded
        return f(*args, **kwargs)
    return decorated

def require_role(*roles):
    """Decorator: require specific role(s). Must come AFTER @require_auth."""
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if not FIREBASE_READY:
                return f(*args, **kwargs)
            email = getattr(request, "user", {}).get("email", "") or ""
            role = _detect_role(email)
            if role not in roles:
                return jsonify({"error": f"Access denied for role '{role}'"}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator

def _detect_role(email: str) -> str:
    if email.endswith("@admin"):   return "admin"
    if email.endswith("@manager"): return "manager"
    return "pharmacist"

# ══════════════════════════════════════════════════════════════════
#  FIRESTORE HELPERS
# ══════════════════════════════════════════════════════════════════
def _fs_get_all(collection: str) -> list:
    if not db:
        return []
    docs = db.collection(collection).stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]

def _fs_add(collection: str, data: dict) -> str:
    if not db:
        return None
    doc_ref = db.collection(collection).document()
    data["id"] = doc_ref.id
    doc_ref.set(data)
    return doc_ref.id

def _fs_update(collection: str, doc_id: str, data: dict) -> bool:
    if not db:
        return False
    db.collection(collection).document(doc_id).update(data)
    return True

def _fs_delete(collection: str, doc_id: str) -> bool:
    if not db:
        return False
    db.collection(collection).document(doc_id).delete()
    return True

# ══════════════════════════════════════════════════════════════════
#  INTELLIGENCE ENGINE
# ══════════════════════════════════════════════════════════════════
def _days_left(expiry_str: str) -> int:
    try:
        exp = datetime.strptime(expiry_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        return (exp - now).days
    except Exception:
        return 9999

def _is_low(item: dict) -> bool:
    return item.get("qty", 0) <= item.get("threshold", 30)

def _stockout_days(item: dict) -> float:
    usage = item.get("dailyUsage", 1) or 1
    qty   = item.get("qty", 0)
    return round(qty / usage, 1)

def _order_recommendation(item: dict) -> int:
    usage  = item.get("dailyUsage", 10) or 10
    qty    = item.get("qty", 0)
    safety = usage * 7
    needed = (usage * 30) - qty + safety
    return max(0, round(needed))

def _demand_forecast(daily_usage: float, n: int = 7) -> list:
    """Simple linear regression forecast on synthetic 14-day history."""
    if not ML_AVAILABLE or not daily_usage:
        # Fallback: flat + small noise
        import random
        return [max(1, round(daily_usage + random.uniform(-2, 2))) for _ in range(n)]

    base   = max(1, daily_usage)
    import math
    hist   = [max(1, base + math.sin(i * 0.6) * 2 + (hash(i) % 3 - 1)) for i in range(14)]
    X      = np.array(range(14)).reshape(-1, 1)
    y      = np.array(hist)
    model  = LinearRegression().fit(X, y)
    future = np.array(range(14, 14 + n)).reshape(-1, 1)
    preds  = model.predict(future)
    return [max(1, round(float(p))) for p in preds]

def _generate_alerts(inventory: list) -> list:
    alerts = []
    for item in inventory:
        d    = _days_left(item.get("expiry", "2099-01-01"))
        name = item.get("name", "Unknown")
        batch= item.get("batch", "")

        if d < 0:
            alerts.append({"type":"danger","category":"expiry","message":f"{name} — EXPIRED (batch {batch})","item":name})
        elif d <= 7:
            alerts.append({"type":"danger","category":"expiry","message":f"{name} expires in {d} days (batch {batch}) · FEFO PRIORITY","item":name})
        elif d <= 30:
            alerts.append({"type":"warning","category":"expiry","message":f"{name} expires in {d} days — plan dispensing","item":name})

        if _is_low(item):
            alerts.append({"type":"warning","category":"low_stock","message":f"Low stock: {name} — {item.get('qty')} units (threshold {item.get('threshold',30)})","item":name})

        sd = _stockout_days(item)
        if sd < 7:
            alerts.append({"type":"danger","category":"stockout","message":f"Stockout risk: {name} — only {sd} days of stock remaining","item":name})

    return alerts

# ══════════════════════════════════════════════════════════════════
#  INVENTORY ENDPOINTS
# ══════════════════════════════════════════════════════════════════
@app.route("/api/inventory", methods=["GET"])
@require_auth
def get_inventory():
    if db:
        items = _fs_get_all("inventory")
    else:
        items = list(_mem_inventory.values())

    # Sort FEFO (earliest expiry first)
    items.sort(key=lambda i: i.get("expiry", "9999-99-99"))
    return jsonify({"status": "ok", "data": items})


@app.route("/api/inventory", methods=["POST"])
@require_auth
def add_inventory():
    data = request.get_json(force=True)
    required = ["name", "batch", "qty", "expiry"]
    for field in required:
        if field not in data:
            return jsonify({"error": f"Missing field: {field}"}), 400

    item = {
        "name":       str(data["name"]),
        "category":   str(data.get("category", "Other")),
        "batch":      str(data["batch"]),
        "qty":        int(data["qty"]),
        "unitCost":   float(data.get("unitCost", 0)),
        "expiry":     str(data["expiry"]),
        "row":        str(data.get("row", "A1")),
        "shelf":      str(data.get("shelf", "S1")),
        "comp":       str(data.get("comp", "C1")),
        "supplier":   str(data.get("supplier", "")),
        "threshold":  int(data.get("threshold", 30)),
        "dailyUsage": int(data.get("dailyUsage", 10)),
        "createdAt":  datetime.utcnow().isoformat() + "Z",
    }

    if db:
        item_id = _fs_add("inventory", item)
        item["id"] = item_id
    else:
        item_id = str(uuid.uuid4())[:8]
        item["id"] = item_id
        _mem_inventory[item_id] = item

    return jsonify({"status": "ok", "data": item}), 201


@app.route("/api/inventory/<item_id>", methods=["PATCH"])
@require_auth
def update_inventory(item_id):
    data = request.get_json(force=True)
    if db:
        _fs_update("inventory", item_id, data)
    else:
        if item_id in _mem_inventory:
            _mem_inventory[item_id].update(data)
    return jsonify({"status": "ok"})


@app.route("/api/inventory/<item_id>", methods=["DELETE"])
@require_auth
def delete_inventory(item_id):
    if db:
        _fs_delete("inventory", item_id)
    else:
        _mem_inventory.pop(item_id, None)
    return jsonify({"status": "ok"})


# ══════════════════════════════════════════════════════════════════
#  DISPENSE ENDPOINT
# ══════════════════════════════════════════════════════════════════
@app.route("/api/dispense", methods=["POST"])
@require_auth
def dispense():
    data = request.get_json(force=True)
    item_id   = str(data.get("itemId", ""))
    qty       = int(data.get("qty", 0))
    patient   = str(data.get("patientId", ""))
    rx        = str(data.get("prescriptionNo", ""))

    if not item_id or qty <= 0:
        return jsonify({"error": "itemId and qty required"}), 400

    # Get item
    if db:
        doc = db.collection("inventory").document(item_id).get()
        if not doc.exists:
            return jsonify({"error": "Item not found"}), 404
        item = {"id": doc.id, **doc.to_dict()}
    else:
        item = _mem_inventory.get(item_id)
        if not item:
            return jsonify({"error": "Item not found"}), 404

    if item["qty"] < qty:
        return jsonify({"error": f"Insufficient stock. Available: {item['qty']}"}), 400

    # Decrement stock
    new_qty = item["qty"] - qty
    if db:
        _fs_update("inventory", item_id, {"qty": new_qty})
    else:
        _mem_inventory[item_id]["qty"] = new_qty

    # Record dispensing event
    record = {
        "medicineName":   item["name"],
        "batch":          item.get("batch", ""),
        "qty":            qty,
        "patientId":      patient,
        "prescriptionNo": rx,
        "unitCost":       item.get("unitCost", 0),
        "totalAmount":    round(qty * item.get("unitCost", 0), 2),
        "dispensedAt":    datetime.utcnow().isoformat() + "Z",
        "dispensedBy":    getattr(request, "user", {}).get("email", "unknown"),
    }

    if db:
        _fs_add("dispensing", record)
    else:
        record["id"] = "D" + str(len(_mem_dispensing) + 1)
        _mem_dispensing.insert(0, record)

    return jsonify({"status": "ok", "data": record})


@app.route("/api/dispensing/recent", methods=["GET"])
@require_auth
def recent_dispensing():
    limit = int(request.args.get("limit", 20))
    if db:
        docs = (db.collection("dispensing")
                  .order_by("dispensedAt", direction=firestore.Query.DESCENDING)
                  .limit(limit)
                  .stream())
        records = [{"id": d.id, **d.to_dict()} for d in docs]
    else:
        records = _mem_dispensing[:limit]
    return jsonify({"status": "ok", "data": records})


# ══════════════════════════════════════════════════════════════════
#  ORDERS ENDPOINTS
# ══════════════════════════════════════════════════════════════════
@app.route("/api/orders", methods=["GET"])
@require_auth
def get_orders():
    if db:
        orders = _fs_get_all("orders")
    else:
        orders = list(_mem_orders.values())
    orders.sort(key=lambda o: o.get("createdAt", ""), reverse=True)
    return jsonify({"status": "ok", "data": orders})


@app.route("/api/orders", methods=["POST"])
@require_auth
def create_order():
    data = request.get_json(force=True)
    required = ["medicine", "qty", "supplier"]
    for field in required:
        if field not in data:
            return jsonify({"error": f"Missing field: {field}"}), 400

    order = {
        "medicine":  str(data["medicine"]),
        "itemId":    str(data.get("itemId", "")),
        "qty":       int(data["qty"]),
        "supplier":  str(data["supplier"]),
        "notes":     str(data.get("notes", "")),
        "status":    "requested",
        "createdAt": datetime.utcnow().isoformat() + "Z",
        "createdBy": getattr(request, "user", {}).get("email", "unknown"),
    }

    if db:
        order_id = _fs_add("orders", order)
        order["id"] = order_id
    else:
        order_id = "ORD-" + datetime.utcnow().strftime("%Y%m%d%H%M%S")
        order["id"] = order_id
        _mem_orders[order_id] = order

    return jsonify({"status": "ok", "data": order}), 201


@app.route("/api/orders/<order_id>/status", methods=["PATCH"])
@require_auth
def update_order_status(order_id):
    data   = request.get_json(force=True)
    status = data.get("status", "")
    valid  = ["requested", "approved", "dispatched", "received"]
    if status not in valid:
        return jsonify({"error": f"status must be one of {valid}"}), 400

    update_data = {"status": status, "updatedAt": datetime.utcnow().isoformat() + "Z"}
    if db:
        _fs_update("orders", order_id, update_data)
    else:
        if order_id in _mem_orders:
            _mem_orders[order_id].update(update_data)
        else:
            return jsonify({"error": "Order not found"}), 404

    return jsonify({"status": "ok", "data": {"id": order_id, "status": status}})


# ══════════════════════════════════════════════════════════════════
#  ANALYTICS ENDPOINTS
# ══════════════════════════════════════════════════════════════════
@app.route("/api/analytics/summary", methods=["GET"])
@require_auth
def analytics_summary():
    if db:
        items = _fs_get_all("inventory")
    else:
        items = list(_mem_inventory.values())

    total_medicines = len(items)
    total_value     = sum(i.get("qty", 0) * i.get("unitCost", 0) for i in items)
    expiring_week   = sum(1 for i in items if 0 <= _days_left(i.get("expiry","9999-01-01")) <= 7)
    expiring_month  = sum(1 for i in items if 0 <= _days_left(i.get("expiry","9999-01-01")) <= 30)
    low_stock_count = sum(1 for i in items if _is_low(i))
    expired_count   = sum(1 for i in items if _days_left(i.get("expiry","9999-01-01")) < 0)
    total_alerts    = expiring_week + low_stock_count + expired_count

    return jsonify({
        "status": "ok",
        "data": {
            "totalMedicines":  total_medicines,
            "totalValue":      round(total_value, 2),
            "expiringThisWeek":expiring_week,
            "expiringThisMonth":expiring_month,
            "lowStockCount":   low_stock_count,
            "expiredCount":    expired_count,
            "totalAlerts":     total_alerts,
        }
    })


@app.route("/api/analytics/category-distribution", methods=["GET"])
@require_auth
def category_distribution():
    if db:
        items = _fs_get_all("inventory")
    else:
        items = list(_mem_inventory.values())

    cats = {}
    for item in items:
        cat = item.get("category", "Other")
        cats[cat] = cats.get(cat, 0) + item.get("qty", 0)

    return jsonify({"status": "ok", "data": [{"category": k, "qty": v} for k, v in cats.items()]})


@app.route("/api/analytics/usage-trend", methods=["GET"])
@require_auth
def usage_trend():
    days = int(request.args.get("days", 7))
    if db:
        cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat() + "Z"
        docs = (db.collection("dispensing")
                  .where("dispensedAt", ">=", cutoff)
                  .stream())
        records = [{"id": d.id, **d.to_dict()} for d in docs]
    else:
        records = _mem_dispensing

    # Aggregate by day
    trend = {}
    for r in records:
        day = str(r.get("dispensedAt", ""))[:10]
        trend[day] = trend.get(day, 0) + r.get("qty", 0)

    return jsonify({"status": "ok", "data": [{"date": k, "qty": v} for k, v in sorted(trend.items())]})


# ══════════════════════════════════════════════════════════════════
#  INTELLIGENCE ENDPOINTS
# ══════════════════════════════════════════════════════════════════
@app.route("/api/intelligence/alerts", methods=["GET"])
@require_auth
def intelligence_alerts():
    if db:
        items = _fs_get_all("inventory")
    else:
        items = list(_mem_inventory.values())

    alerts = _generate_alerts(items)
    return jsonify({"status": "ok", "data": alerts})


@app.route("/api/intelligence/order-suggestions", methods=["GET"])
@require_auth
def order_suggestions():
    if db:
        items = _fs_get_all("inventory")
    else:
        items = list(_mem_inventory.values())

    suggestions = []
    for item in items:
        if _is_low(item) or _stockout_days(item) < 14:
            rec = _order_recommendation(item)
            if rec > 0:
                suggestions.append({
                    "itemId":        item.get("id"),
                    "name":          item.get("name"),
                    "currentStock":  item.get("qty"),
                    "dailyUsage":    item.get("dailyUsage", 10),
                    "stockoutDays":  _stockout_days(item),
                    "recommendedQty":rec,
                    "priority":      "HIGH" if _stockout_days(item) < 7 else "MEDIUM",
                })

    suggestions.sort(key=lambda s: s["stockoutDays"])
    return jsonify({"status": "ok", "data": suggestions})


@app.route("/api/intelligence/forecast", methods=["GET"])
@require_auth
def demand_forecast():
    """Return 7-day demand forecast for each item."""
    if db:
        items = _fs_get_all("inventory")
    else:
        items = list(_mem_inventory.values())

    forecasts = []
    for item in items:
        usage = item.get("dailyUsage", 10)
        preds = _demand_forecast(usage, n=7)
        forecasts.append({
            "itemId": item.get("id"),
            "name":   item.get("name"),
            "forecast": preds,
        })

    return jsonify({"status": "ok", "data": forecasts})


@app.route("/api/intelligence/stockout-risk", methods=["GET"])
@require_auth
def stockout_risk():
    if db:
        items = _fs_get_all("inventory")
    else:
        items = list(_mem_inventory.values())

    result = []
    for item in items:
        sd = _stockout_days(item)
        lead = 7
        result.append({
            "name":         item.get("name"),
            "currentStock": item.get("qty"),
            "dailyUsage":   item.get("dailyUsage", 10),
            "daysRemaining":sd,
            "leadTimeDays": lead,
            "riskLevel":    "CRITICAL" if sd < lead else ("MONITOR" if sd < 14 else "SAFE"),
        })

    result.sort(key=lambda r: r["daysRemaining"])
    return jsonify({"status": "ok", "data": result})


# ══════════════════════════════════════════════════════════════════
#  LOCATIONS (Admin map)
# ══════════════════════════════════════════════════════════════════
@app.route("/api/locations", methods=["GET"])
@require_auth
def get_locations():
    if db:
        locs = _fs_get_all("locations")
        if not locs:
            locs = DEMO_LOCATIONS
    else:
        locs = DEMO_LOCATIONS
    return jsonify({"status": "ok", "data": locs})


# ══════════════════════════════════════════════════════════════════
#  EXPIRY REPORT
# ══════════════════════════════════════════════════════════════════
@app.route("/api/reports/expiry", methods=["GET"])
@require_auth
def expiry_report():
    days = int(request.args.get("days", 30))
    if db:
        items = _fs_get_all("inventory")
    else:
        items = list(_mem_inventory.values())

    expiring = [
        {**i, "daysLeft": _days_left(i.get("expiry", "9999-01-01"))}
        for i in items
        if _days_left(i.get("expiry", "9999-01-01")) <= days
    ]
    expiring.sort(key=lambda i: i["daysLeft"])
    return jsonify({"status": "ok", "data": expiring})


# ══════════════════════════════════════════════════════════════════
#  DISPENSING REPORT
# ══════════════════════════════════════════════════════════════════
@app.route("/api/reports/dispensing", methods=["GET"])
@require_auth
def dispensing_report():
    period = request.args.get("period", "7d")
    days   = int(period.replace("d", "").replace("m", "30"))
    cutoff = datetime.utcnow() - timedelta(days=days)

    if db:
        docs = (db.collection("dispensing")
                  .where("dispensedAt", ">=", cutoff.isoformat() + "Z")
                  .stream())
        records = [{"id": d.id, **d.to_dict()} for d in docs]
    else:
        records = _mem_dispensing

    total_amount = sum(r.get("totalAmount", 0) for r in records)
    total_qty    = sum(r.get("qty", 0) for r in records)

    return jsonify({
        "status": "ok",
        "data": {
            "records":     records,
            "totalQty":    total_qty,
            "totalAmount": round(total_amount, 2),
            "period":      period,
        }
    })


# ══════════════════════════════════════════════════════════════════
#  WASTE LOG
# ══════════════════════════════════════════════════════════════════
@app.route("/api/waste", methods=["GET"])
@require_auth
def get_waste():
    if db:
        records = _fs_get_all("waste")
    else:
        records = []
    return jsonify({"status": "ok", "data": records})


@app.route("/api/waste", methods=["POST"])
@require_auth
def log_waste():
    data = request.get_json(force=True)
    record = {
        "itemId":    str(data.get("itemId", "")),
        "name":      str(data.get("name", "")),
        "batch":     str(data.get("batch", "")),
        "qty":       int(data.get("qty", 0)),
        "reason":    str(data.get("reason", "expired")),
        "value":     float(data.get("value", 0)),
        "loggedAt":  datetime.utcnow().isoformat() + "Z",
        "loggedBy":  getattr(request, "user", {}).get("email", "unknown"),
    }
    if db:
        _fs_add("waste", record)
    return jsonify({"status": "ok", "data": record}), 201



# ══════════════════════════════════════════════════════════════════
#  PAGE ROUTES — serve HTML templates
#  Flask reads from the  templates/  folder automatically
# ══════════════════════════════════════════════════════════════════

@app.route("/")
def root():
    # If templates folder exists, redirect to sign-in page
    import os
    tmpl = os.path.join(app.template_folder or "templates", "signin.html")
    if os.path.exists(tmpl):
        return redirect("/signin")
    # Otherwise show API index (templates not moved yet)
    return jsonify({
        "status": "running",
        "message": "VEDA Hospital Pharmacy API 💊",
        "endpoints": ["/api/inventory", "/api/orders", "/api/analytics/summary", "/api/intelligence/alerts", "/health"],
        "setup": "Run setup.sh to organize your files, then visit /signin",
        "docs": "See README.md for full API reference"
    })

@app.route("/signin")
def page_signin():
    return render_template("signin.html")

@app.route("/signup")
def page_signup():
    return render_template("signup.html")

@app.route("/pharma")
def page_pharma():
    return render_template("pharma.html")

@app.route("/manager")
def page_manager():
    return render_template("manager.html")

@app.route("/admin")
def page_admin():
    return render_template("admin.html")

@app.route("/inventory")
def page_inventory():
    return render_template("inventry.html")

@app.route("/settings")
def page_settings():
    return render_template("setting.html")

# Also serve .html extensions (so links like href="pharma.html" work)
@app.route("/<page>.html")
def serve_html(page):
    return render_template(f"{page}.html")


# ══════════════════════════════════════════════════════════════════
#  HEALTH CHECK
# ══════════════════════════════════════════════════════════════════
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status":   "healthy",
        "version":  "1.0.0",
        "firebase": FIREBASE_READY,
        "ml":       ML_AVAILABLE, 
        "ts":       datetime.utcnow().isoformat() + "Z",
    })


# ══════════════════════════════════════════════════════════════════
#  ERROR HANDLERS
# ══════════════════════════════════════════════════════════════════
@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Endpoint not found", "path": request.path}), 404

@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({"error": "Method not allowed"}), 405

@app.errorhandler(500)
def internal_error(e):
    return jsonify({"error": "Internal server error", "detail": str(e)}), 500


# ══════════════════════════════════════════════════════════════════
#  ENTRY POINT
# ══════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    port  = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_ENV", "development") == "development"
    print()
    print("=" * 58)
    print("  Veda Pharmacy Backend")
    print(f"  URL:      http://127.0.0.1:{port}")
    print(f"  Firebase: {'connected' if FIREBASE_READY else 'demo mode (no serviceAccountKey.json)'}")
    print(f"  ML:       {'available' if ML_AVAILABLE else 'disabled (install scikit-learn)'}")
    print()
    print("  Pages:")
    print("    http://127.0.0.1:{}/signin   <- Start here".format(port))
    print("    http://127.0.0.1:{}/pharma   <- Pharmacist".format(port))
    print("    http://127.0.0.1:{}/manager  <- Manager".format(port))
    print("    http://127.0.0.1:{}/admin    <- Admin".format(port))
    print("=" * 58)
    print()
    app.run(host="0.0.0.0", port=port, debug=debug)
