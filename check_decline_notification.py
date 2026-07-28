import requests
import json
import time

BASE_URL = "https://scms-platform-1.preview.emergentagent.com/api"

# Login as chief
resp = requests.post(f"{BASE_URL}/auth/login", json={"email": "chief@scms.io", "password": "password123"})
token = resp.json().get("token")

# Get all notifications
resp = requests.get(f"{BASE_URL}/notifications", headers={"Authorization": f"Bearer {token}"})
notifications = resp.json().get("notifications", [])

print(f"Total notifications: {len(notifications)}\n")
print("Looking for REVIEW_DECLINED notifications...")
print("-" * 80)

decline_notifs = [n for n in notifications if n.get("type") == "REVIEW_DECLINED"]
if decline_notifs:
    print(f"Found {len(decline_notifs)} REVIEW_DECLINED notification(s):\n")
    for notif in decline_notifs:
        print(f"Title: {notif.get('title')}")
        print(f"Body: {notif.get('body')}")
        print(f"Created: {notif.get('createdAt')}")
        print(f"Link: {notif.get('link')}")
        print()
else:
    print("❌ No REVIEW_DECLINED notifications found")
    print("\nAll notification types:")
    types = {}
    for n in notifications:
        t = n.get("type")
        types[t] = types.get(t, 0) + 1
    for t, count in sorted(types.items()):
        print(f"  {t}: {count}")
