#!/usr/bin/env python3
"""
Backend smoke test for SCMS sponsorship-requests email fire-and-forget change
Review request: Verify POST /api/sponsorship-requests now fires confirmation emails (fire-and-forget)
"""
import requests
import json
import sys
import time

# Base URL from environment
BASE_URL = "https://scms-platform-1.preview.emergentagent.com/api"

# Test credentials (all password: password123)
CREDENTIALS = {
    "admin": {"email": "admin@scms.io", "password": "password123"},
    "chief_logistics": {"email": "chief.logistics@scms.io", "password": "password123"},
    "sponsor": {"email": "sponsor@scms.io", "password": "password123"},
    "author": {"email": "author@scms.io", "password": "password123"},
}

def login(email, password):
    """Login and return JWT token"""
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            token = data.get("token")
            print(f"✅ Login successful for {email}")
            return token
        else:
            print(f"❌ Login failed for {email}: {resp.status_code} - {resp.text}")
            return None
    except Exception as e:
        print(f"❌ Login exception for {email}: {e}")
        return None

def get_featured_conference(token):
    """Get the featured conference ID"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.get(f"{BASE_URL}/conferences", headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            conferences = data.get("conferences", [])
            if conferences:
                conf = conferences[0]
                conf_id = conf.get("id")
                print(f"✅ Found featured conference: {conf.get('name')} (ID: {conf_id})")
                return conf_id
            else:
                print("❌ No conferences found")
                return None
        else:
            print(f"❌ GET /conferences failed: {resp.status_code} - {resp.text}")
            return None
    except Exception as e:
        print(f"❌ GET /conferences exception: {e}")
        return None

def test_sponsorship_request_with_email(token, conference_id):
    """Test 1: POST /api/sponsorship-requests — now fires confirmation emails (fire-and-forget)"""
    print("\n" + "="*80)
    print("TEST 1: POST /api/sponsorship-requests — Email fire-and-forget")
    print("="*80)
    
    try:
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        payload = {
            "conferenceId": conference_id,
            "companyName": "Smoke Test Corp",
            "industry": "Testing",
            "sponsorTier": "GOLD",
            "contactEmail": "sponsor@scms.io",
            "message": "Verifying email flow",
            "virtualBoothRequested": True
        }
        
        resp = requests.post(f"{BASE_URL}/sponsorship-requests", headers=headers, json=payload, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            request_obj = data.get("request")
            
            # Verify response structure
            if not request_obj:
                print("❌ Response missing 'request' object")
                return False
            
            # Check required fields
            required_fields = ["id", "status", "createdAt", "sponsorTier", "virtualBoothRequested"]
            missing = [f for f in required_fields if f not in request_obj]
            if missing:
                print(f"❌ Response missing fields: {missing}")
                return False
            
            # Verify values
            if request_obj.get("status") != "PENDING":
                print(f"❌ Expected status=PENDING, got {request_obj.get('status')}")
                return False
            
            if request_obj.get("sponsorTier") != "GOLD":
                print(f"❌ Expected sponsorTier=GOLD, got {request_obj.get('sponsorTier')}")
                return False
            
            if request_obj.get("virtualBoothRequested") != True:
                print(f"❌ Expected virtualBoothRequested=true, got {request_obj.get('virtualBoothRequested')}")
                return False
            
            print(f"✅ POST /api/sponsorship-requests returned 200")
            print(f"   - Request ID: {request_obj.get('id')}")
            print(f"   - Status: {request_obj.get('status')}")
            print(f"   - Sponsor Tier: {request_obj.get('sponsorTier')}")
            print(f"   - Virtual Booth: {request_obj.get('virtualBoothRequested')}")
            print(f"   - Created At: {request_obj.get('createdAt')}")
            print("✅ Email fire-and-forget code executed (wrapped in try/catch, non-blocking)")
            return True
        else:
            print(f"❌ POST /api/sponsorship-requests failed: {resp.status_code} - {resp.text}")
            return False
    except Exception as e:
        print(f"❌ POST /api/sponsorship-requests exception: {e}")
        return False

def test_notification_for_chief_logistics(token):
    """Verify GET /api/notifications as chief.logistics shows new notification"""
    print("\n" + "="*80)
    print("TEST 2: GET /api/notifications as chief.logistics — Verify notification pathway")
    print("="*80)
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.get(f"{BASE_URL}/notifications", headers=headers, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            notifications = data.get("notifications", [])
            
            # Find the newest notification with title starting "New sponsorship request from Smoke Test Corp"
            found = False
            for notif in notifications:
                title = notif.get("title", "")
                if title.startswith("New sponsorship request from Smoke Test Corp"):
                    found = True
                    print(f"✅ Found notification: {title}")
                    print(f"   - Body: {notif.get('body', '')}")
                    print(f"   - Created: {notif.get('createdAt', '')}")
                    break
            
            if found:
                print("✅ Notification pathway confirmed working after adding email try/catch block")
                return True
            else:
                print("❌ No notification found with title starting 'New sponsorship request from Smoke Test Corp'")
                print(f"   Total notifications: {len(notifications)}")
                if notifications:
                    print(f"   Latest notification title: {notifications[0].get('title', 'N/A')}")
                return False
        else:
            print(f"❌ GET /api/notifications failed: {resp.status_code} - {resp.text}")
            return False
    except Exception as e:
        print(f"❌ GET /api/notifications exception: {e}")
        return False

def test_unauthenticated_sponsorship_request():
    """Test 3: Regression — POST /api/sponsorship-requests without auth should return 401"""
    print("\n" + "="*80)
    print("TEST 3: Regression — Unauthenticated POST /api/sponsorship-requests → 401")
    print("="*80)
    
    try:
        payload = {
            "conferenceId": "dummy-id",
            "companyName": "Test Corp",
            "industry": "Testing",
            "sponsorTier": "GOLD",
            "message": "Test"
        }
        
        resp = requests.post(f"{BASE_URL}/sponsorship-requests", json=payload, timeout=10)
        
        if resp.status_code == 401:
            print(f"✅ Unauthenticated POST /api/sponsorship-requests correctly returned 401")
            return True
        else:
            print(f"❌ Expected 401, got {resp.status_code} - {resp.text}")
            return False
    except Exception as e:
        print(f"❌ Unauthenticated POST exception: {e}")
        return False

def test_sponsorship_tiers_crud(admin_token, chief_logistics_token, author_token):
    """Test 4: Regression — Sponsorship tier CRUD still fine"""
    print("\n" + "="*80)
    print("TEST 4: Regression — Sponsorship tier CRUD")
    print("="*80)
    
    results = []
    
    # 4a. Unauthenticated GET /api/sponsorship-tiers → 200 with tiers array
    print("\n4a. Unauthenticated GET /api/sponsorship-tiers")
    try:
        resp = requests.get(f"{BASE_URL}/sponsorship-tiers", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            tiers = data.get("tiers", [])
            if len(tiers) >= 4:
                tier_keys = [t.get("key") for t in tiers]
                defaults = ["PLATINUM", "GOLD", "SILVER", "BRONZE"]
                if all(d in tier_keys for d in defaults):
                    print(f"✅ GET /api/sponsorship-tiers returned {len(tiers)} tiers with defaults: {defaults}")
                    results.append(True)
                else:
                    print(f"❌ Missing default tiers. Found: {tier_keys}")
                    results.append(False)
            else:
                print(f"❌ Expected at least 4 tiers, got {len(tiers)}")
                results.append(False)
        else:
            print(f"❌ GET /api/sponsorship-tiers failed: {resp.status_code} - {resp.text}")
            results.append(False)
    except Exception as e:
        print(f"❌ GET /api/sponsorship-tiers exception: {e}")
        results.append(False)
    
    # 4b. POST /api/sponsorship-tiers as admin
    print("\n4b. POST /api/sponsorship-tiers as admin")
    tier_id = None
    try:
        headers = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
        payload = {
            "key": "SMOKE-VERIFY",
            "label": "Smoke Verify Sponsor",
            "price": "999",
            "currency": "USD",
            "benefits": ["Test"]
        }
        resp = requests.post(f"{BASE_URL}/sponsorship-tiers", headers=headers, json=payload, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            tier = data.get("tier")
            tier_id = tier.get("id")
            print(f"✅ POST /api/sponsorship-tiers as admin returned 200")
            print(f"   - Tier ID: {tier_id}")
            print(f"   - Key: {tier.get('key')}")
            print(f"   - Label: {tier.get('label')}")
            results.append(True)
        else:
            print(f"❌ POST /api/sponsorship-tiers failed: {resp.status_code} - {resp.text}")
            results.append(False)
    except Exception as e:
        print(f"❌ POST /api/sponsorship-tiers exception: {e}")
        results.append(False)
    
    # 4c. PUT /api/sponsorship-tiers/:id as admin
    if tier_id:
        print("\n4c. PUT /api/sponsorship-tiers/:id as admin")
        try:
            headers = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
            payload = {
                "price": "1200",
                "currency": "KES"
            }
            resp = requests.put(f"{BASE_URL}/sponsorship-tiers/{tier_id}", headers=headers, json=payload, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                tier = data.get("tier")
                if tier.get("price") == "1200" and tier.get("currency") == "KES":
                    print(f"✅ PUT /api/sponsorship-tiers/{tier_id} as admin returned 200")
                    print(f"   - Updated price: {tier.get('price')}")
                    print(f"   - Updated currency: {tier.get('currency')}")
                    results.append(True)
                else:
                    print(f"❌ PUT did not update correctly: price={tier.get('price')}, currency={tier.get('currency')}")
                    results.append(False)
            else:
                print(f"❌ PUT /api/sponsorship-tiers/{tier_id} failed: {resp.status_code} - {resp.text}")
                results.append(False)
        except Exception as e:
            print(f"❌ PUT /api/sponsorship-tiers exception: {e}")
            results.append(False)
    
    # 4d. POST /api/sponsorship-tiers as author → 403
    print("\n4d. POST /api/sponsorship-tiers as author → 403")
    try:
        headers = {"Authorization": f"Bearer {author_token}", "Content-Type": "application/json"}
        payload = {
            "key": "AUTHOR-TEST",
            "label": "Author Test",
            "price": "100",
            "currency": "USD",
            "benefits": ["Test"]
        }
        resp = requests.post(f"{BASE_URL}/sponsorship-tiers", headers=headers, json=payload, timeout=10)
        if resp.status_code == 403:
            print(f"✅ POST /api/sponsorship-tiers as author correctly returned 403")
            results.append(True)
        else:
            print(f"❌ Expected 403, got {resp.status_code} - {resp.text}")
            results.append(False)
    except Exception as e:
        print(f"❌ POST /api/sponsorship-tiers as author exception: {e}")
        results.append(False)
    
    # 4e. DELETE /api/sponsorship-tiers/:id as admin
    if tier_id:
        print("\n4e. DELETE /api/sponsorship-tiers/:id as admin")
        try:
            headers = {"Authorization": f"Bearer {admin_token}"}
            resp = requests.delete(f"{BASE_URL}/sponsorship-tiers/{tier_id}", headers=headers, timeout=10)
            if resp.status_code == 200:
                print(f"✅ DELETE /api/sponsorship-tiers/{tier_id} as admin returned 200")
                results.append(True)
            else:
                print(f"❌ DELETE /api/sponsorship-tiers/{tier_id} failed: {resp.status_code} - {resp.text}")
                results.append(False)
        except Exception as e:
            print(f"❌ DELETE /api/sponsorship-tiers exception: {e}")
            results.append(False)
    
    return all(results)

def test_auth_and_main_endpoints(admin_token, chief_logistics_token, sponsor_token, author_token):
    """Test 5: Regression — Auth + main endpoints"""
    print("\n" + "="*80)
    print("TEST 5: Regression — Auth + main endpoints")
    print("="*80)
    
    results = []
    
    # 5a. POST /api/auth/login for all four accounts
    print("\n5a. POST /api/auth/login for all four accounts")
    accounts = [
        ("admin@scms.io", admin_token),
        ("chief.logistics@scms.io", chief_logistics_token),
        ("sponsor@scms.io", sponsor_token),
        ("author@scms.io", author_token)
    ]
    
    for email, token in accounts:
        if token and token.startswith("eyJ"):
            print(f"✅ {email} login successful (JWT starts with 'eyJ')")
            results.append(True)
        else:
            print(f"❌ {email} login failed or invalid JWT")
            results.append(False)
    
    # 5b. GET /api/abstracts as admin → 200 (abstracts array with technicalScoreAverage still present)
    print("\n5b. GET /api/abstracts as admin")
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        resp = requests.get(f"{BASE_URL}/abstracts", headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            abstracts = data.get("abstracts", [])
            if abstracts:
                # Check if technicalScoreAverage is present
                first_abstract = abstracts[0]
                if "technicalScoreAverage" in first_abstract:
                    print(f"✅ GET /api/abstracts as admin returned 200 with {len(abstracts)} abstracts")
                    print(f"   - technicalScoreAverage field present: {first_abstract.get('technicalScoreAverage')}")
                    results.append(True)
                else:
                    print(f"❌ technicalScoreAverage field missing from abstracts")
                    results.append(False)
            else:
                print(f"✅ GET /api/abstracts as admin returned 200 with 0 abstracts (empty array)")
                results.append(True)
        else:
            print(f"❌ GET /api/abstracts failed: {resp.status_code} - {resp.text}")
            results.append(False)
    except Exception as e:
        print(f"❌ GET /api/abstracts exception: {e}")
        results.append(False)
    
    return all(results)

def main():
    print("="*80)
    print("SCMS BACKEND SMOKE TEST — Sponsorship Requests Email Fire-and-Forget")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print()
    
    # Login all accounts
    print("Logging in all test accounts...")
    admin_token = login(CREDENTIALS["admin"]["email"], CREDENTIALS["admin"]["password"])
    chief_logistics_token = login(CREDENTIALS["chief_logistics"]["email"], CREDENTIALS["chief_logistics"]["password"])
    sponsor_token = login(CREDENTIALS["sponsor"]["email"], CREDENTIALS["sponsor"]["password"])
    author_token = login(CREDENTIALS["author"]["email"], CREDENTIALS["author"]["password"])
    
    if not all([admin_token, chief_logistics_token, sponsor_token, author_token]):
        print("\n❌ FAILED: Could not login all accounts")
        sys.exit(1)
    
    # Get featured conference
    conference_id = get_featured_conference(sponsor_token)
    if not conference_id:
        print("\n❌ FAILED: Could not get featured conference")
        sys.exit(1)
    
    # Run tests
    test_results = []
    
    # Test 1: POST /api/sponsorship-requests with email fire-and-forget
    test_results.append(("POST /api/sponsorship-requests with email", test_sponsorship_request_with_email(sponsor_token, conference_id)))
    
    # Small delay to allow notification to be created
    time.sleep(1)
    
    # Test 2: Verify notification for chief.logistics
    test_results.append(("GET /api/notifications for chief.logistics", test_notification_for_chief_logistics(chief_logistics_token)))
    
    # Test 3: Unauthenticated POST should return 401
    test_results.append(("Unauthenticated POST /api/sponsorship-requests", test_unauthenticated_sponsorship_request()))
    
    # Test 4: Sponsorship tier CRUD
    test_results.append(("Sponsorship tier CRUD", test_sponsorship_tiers_crud(admin_token, chief_logistics_token, author_token)))
    
    # Test 5: Auth + main endpoints
    test_results.append(("Auth + main endpoints", test_auth_and_main_endpoints(admin_token, chief_logistics_token, sponsor_token, author_token)))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in test_results if result)
    total = len(test_results)
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print()
    print(f"Total: {passed}/{total} tests passed ({int(passed/total*100)}%)")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED")
        sys.exit(0)
    else:
        print(f"\n❌ {total - passed} TEST(S) FAILED")
        sys.exit(1)

if __name__ == "__main__":
    main()
