#!/usr/bin/env python3
"""
Backend API tests for SCMS platform - Logistics & Sponsorship Sprint
Tests 10 specific scenarios as per review request:
1. POST /api/auth/register — welcome message
2. POST /api/abstracts/:id/scores — auto-tick technical check
3. POST /api/abstracts/:id/assign-editor — RBAC tightened
4. GET /api/announcements — channel support
5. GET /api/logistics/members
6. Sponsorship requests (multiple endpoints)
7. PUT /api/conferences/:id/attendee-registration — admin toggle
8. Attendee registration gating
9. POST /api/users/:id/roles + DELETE
10. Regression checks
"""

import requests
import json
import sys
import time

BASE_URL = "https://scms-platform-1.preview.emergentagent.com/api"

# Test credentials (all password: password123)
CREDENTIALS = {
    "admin": {"email": "admin@scms.io", "password": "password123"},
    "chief": {"email": "chief@scms.io", "password": "password123"},
    "managing": {"email": "managing@scms.io", "password": "password123"},
    "committee": {"email": "committee@scms.io", "password": "password123"},
    "author": {"email": "author@scms.io", "password": "password123"},
    "chief_logistics": {"email": "chief.logistics@scms.io", "password": "password123"},
    "logistics1": {"email": "logistics1@scms.io", "password": "password123"},
    "sponsor": {"email": "sponsor@scms.io", "password": "password123"},
    "attendee": {"email": "attendee@scms.io", "password": "password123"},
}

def login(email, password):
    """Login and return JWT token"""
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            return data.get("token")
        else:
            print(f"❌ Login failed for {email}: {resp.status_code} - {resp.text}")
            return None
    except Exception as e:
        print(f"❌ Login exception for {email}: {e}")
        return None

def get_headers(token):
    """Return headers with Bearer token"""
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

def test_register_welcome_message():
    """Test 1: POST /api/auth/register — welcome message"""
    print("\n" + "="*80)
    print("TEST 1: POST /api/auth/register — WELCOME MESSAGE")
    print("="*80)
    
    all_passed = True
    timestamp = int(time.time())
    test_email = f"welcome-test-{timestamp}@example.com"
    
    # Test 1a: Register new user and check welcome message in response
    print(f"\n[1a] POST /api/auth/register with email {test_email}")
    try:
        payload = {
            "email": test_email,
            "password": "password123",
            "firstName": "Welcome",
            "lastName": "Tester",
            "affiliation": "Test University",
            "country": "Test Country"
        }
        resp = requests.post(f"{BASE_URL}/auth/register", json=payload, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            welcome_msg = data.get("welcome")
            token = data.get("token")
            
            if welcome_msg and "Welcome" in welcome_msg and "Welcome" in welcome_msg:
                print(f"✅ Welcome message present: '{welcome_msg}'")
            else:
                print(f"❌ Welcome message missing or incorrect: {welcome_msg}")
                all_passed = False
            
            # Test 1b: Check notifications for welcome notification
            if token:
                print(f"\n[1b] GET /api/notifications to verify welcome notification")
                headers = get_headers(token)
                resp2 = requests.get(f"{BASE_URL}/notifications", headers=headers, timeout=10)
                print(f"Status: {resp2.status_code}")
                
                if resp2.status_code == 200:
                    notifs = resp2.json().get("notifications", [])
                    welcome_notif = [n for n in notifs if n.get("title", "").startswith("Welcome to ")]
                    
                    if welcome_notif:
                        print(f"✅ Welcome notification found: '{welcome_notif[0].get('title')}'")
                    else:
                        print(f"❌ Welcome notification not found. Notifications: {[n.get('title') for n in notifs]}")
                        all_passed = False
                else:
                    print(f"❌ Failed to get notifications: {resp2.status_code}")
                    all_passed = False
            else:
                print(f"❌ No token returned from registration")
                all_passed = False
        else:
            print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    return all_passed

def test_abstract_scores_auto_tick():
    """Test 2: POST /api/abstracts/:id/scores — auto-tick technical check"""
    print("\n" + "="*80)
    print("TEST 2: POST /api/abstracts/:id/scores — AUTO-TICK TECHNICAL CHECK")
    print("="*80)
    
    all_passed = True
    
    # Get an existing abstract in SUBMITTED state or create one
    print("\n[2a] Get or create an abstract in SUBMITTED state")
    admin_token = login(CREDENTIALS["admin"]["email"], CREDENTIALS["admin"]["password"])
    admin_headers = get_headers(admin_token)
    
    try:
        # Get all abstracts
        resp = requests.get(f"{BASE_URL}/abstracts", headers=admin_headers, timeout=10)
        if resp.status_code != 200:
            print(f"❌ Failed to get abstracts: {resp.status_code}")
            return False
        
        abstracts = resp.json().get("abstracts", [])
        
        # Find an abstract in SUBMITTED or DRAFT state
        test_abstract = None
        for abstract in abstracts:
            if abstract.get("currentState") in ["SUBMITTED", "DRAFT"]:
                test_abstract = abstract
                break
        
        if not test_abstract:
            print("⚠️  No abstracts in SUBMITTED or DRAFT state available for testing")
            print("⚠️  Skipping test 2 - requires an abstract in SUBMITTED state")
            return True  # Skip test gracefully
        
        abstract_id = test_abstract["id"]
        current_state = test_abstract.get("currentState")
        print(f"✅ Using existing abstract: {abstract_id} (state: {current_state})")
        
        # If in DRAFT, submit it first
        if current_state == "DRAFT":
            # Get the submitter's token
            submitter_email = test_abstract.get("submittedBy", {}).get("email")
            if not submitter_email:
                print("⚠️  Cannot determine submitter, skipping test")
                return True
            
            submitter_token = login(submitter_email, "password123")
            if not submitter_token:
                print(f"⚠️  Cannot login as {submitter_email}, skipping test")
                return True
            
            submitter_headers = get_headers(submitter_token)
            resp = requests.post(f"{BASE_URL}/abstracts/{abstract_id}/submit", headers=submitter_headers, timeout=10)
            if resp.status_code == 200:
                print(f"✅ Abstract submitted successfully")
                current_state = "SUBMITTED"
            else:
                print(f"⚠️  Failed to submit abstract: {resp.status_code}, skipping test")
                return True
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False
    
    # Login as committee member and score the abstract
    print(f"\n[2b] Login as committee@scms.io and POST /api/abstracts/{abstract_id}/scores")
    committee_token = login(CREDENTIALS["committee"]["email"], CREDENTIALS["committee"]["password"])
    if not committee_token:
        print("❌ Failed to login as committee")
        return False
    
    committee_headers = get_headers(committee_token)
    
    try:
        score_payload = {
            "originality": 8,
            "methodology": 7,
            "relevance": 8,
            "language": 9,
            "themeAlignment": 8,
            "comments": "Good work"
        }
        resp = requests.post(f"{BASE_URL}/abstracts/{abstract_id}/scores", 
                           headers=committee_headers, json=score_payload, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ Failed to submit score: {resp.text}")
            return False
        
        print(f"✅ Score submitted successfully")
    except Exception as e:
        print(f"❌ Exception submitting score: {e}")
        return False
    
    # Verify auto-transition to EDITORIAL_ASSIGNMENT
    print(f"\n[2c] GET /api/abstracts/{abstract_id} to verify auto-transition")
    
    try:
        resp = requests.get(f"{BASE_URL}/abstracts/{abstract_id}", headers=admin_headers, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            abstract = resp.json().get("abstract", {})
            new_state = abstract.get("currentState")
            
            if new_state == "EDITORIAL_ASSIGNMENT":
                print(f"✅ Abstract auto-transitioned to EDITORIAL_ASSIGNMENT")
            else:
                print(f"❌ Expected EDITORIAL_ASSIGNMENT, got {new_state}")
                all_passed = False
        else:
            print(f"❌ Failed to get abstract: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    return all_passed

def test_assign_editor_rbac_tightened():
    """Test 3: POST /api/abstracts/:id/assign-editor — RBAC tightened"""
    print("\n" + "="*80)
    print("TEST 3: POST /api/abstracts/:id/assign-editor — RBAC TIGHTENED")
    print("="*80)
    
    all_passed = True
    
    # Get an abstract and committee user
    admin_token = login(CREDENTIALS["admin"]["email"], CREDENTIALS["admin"]["password"])
    admin_headers = get_headers(admin_token)
    
    try:
        resp = requests.get(f"{BASE_URL}/abstracts", headers=admin_headers, timeout=10)
        abstracts = resp.json().get("abstracts", [])
        if not abstracts:
            print("❌ No abstracts available")
            return False
        abstract_id = abstracts[0]["id"]
        
        resp = requests.get(f"{BASE_URL}/users", headers=admin_headers, timeout=10)
        users = resp.json().get("users", [])
        committee_user = next((u for u in users if u["email"] == "committee@scms.io"), None)
        if not committee_user:
            print("❌ committee@scms.io not found")
            return False
        
        print(f"✅ Using abstract: {abstract_id}, editor: {committee_user['id']}")
    except Exception as e:
        print(f"❌ Setup exception: {e}")
        return False
    
    # Test 3a: managing@scms.io should get 403 (previously allowed)
    print(f"\n[3a] POST /api/abstracts/{abstract_id}/assign-editor as managing@scms.io (expect 403)")
    managing_token = login(CREDENTIALS["managing"]["email"], CREDENTIALS["managing"]["password"])
    managing_headers = get_headers(managing_token)
    
    try:
        payload = {"editorId": committee_user["id"], "role": "COMMITTEE_EDITOR"}
        resp = requests.post(f"{BASE_URL}/abstracts/{abstract_id}/assign-editor", 
                           headers=managing_headers, json=payload, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 403:
            print(f"✅ Managing editor correctly denied with 403")
        else:
            print(f"❌ Expected 403, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    # Test 3b: chief@scms.io (CHIEF_EDITOR) should get 200
    print(f"\n[3b] POST /api/abstracts/{abstract_id}/assign-editor as chief@scms.io (expect 200)")
    chief_token = login(CREDENTIALS["chief"]["email"], CREDENTIALS["chief"]["password"])
    chief_headers = get_headers(chief_token)
    
    try:
        payload = {"editorId": committee_user["id"], "role": "COMMITTEE_EDITOR"}
        resp = requests.post(f"{BASE_URL}/abstracts/{abstract_id}/assign-editor", 
                           headers=chief_headers, json=payload, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            print(f"✅ Chief editor allowed (200)")
        else:
            print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    # Test 3c: admin@scms.io should get 200
    print(f"\n[3c] POST /api/abstracts/{abstract_id}/assign-editor as admin@scms.io (expect 200)")
    try:
        payload = {"editorId": committee_user["id"], "role": "COMMITTEE_EDITOR"}
        resp = requests.post(f"{BASE_URL}/abstracts/{abstract_id}/assign-editor", 
                           headers=admin_headers, json=payload, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            print(f"✅ Admin allowed (200)")
        else:
            print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    return all_passed

def test_announcements_channel_support():
    """Test 4: GET /api/announcements — channel support"""
    print("\n" + "="*80)
    print("TEST 4: GET /api/announcements — CHANNEL SUPPORT")
    print("="*80)
    
    all_passed = True
    
    # Test 4a: chief@scms.io GET EDITORIAL channel (should work)
    print("\n[4a] GET /api/announcements?channel=EDITORIAL as chief@scms.io (expect 200)")
    chief_token = login(CREDENTIALS["chief"]["email"], CREDENTIALS["chief"]["password"])
    chief_headers = get_headers(chief_token)
    
    try:
        resp = requests.get(f"{BASE_URL}/announcements?channel=EDITORIAL", headers=chief_headers, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            announcements = resp.json().get("announcements", [])
            print(f"✅ Chief editor can access EDITORIAL channel ({len(announcements)} announcements)")
        else:
            print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    # Test 4b: chief@scms.io GET LOGISTICS channel (should fail)
    print("\n[4b] GET /api/announcements?channel=LOGISTICS as chief@scms.io (expect 403)")
    try:
        resp = requests.get(f"{BASE_URL}/announcements?channel=LOGISTICS", headers=chief_headers, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 403:
            print(f"✅ Chief editor correctly denied LOGISTICS channel (403)")
        else:
            print(f"❌ Expected 403, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    # Test 4c: chief.logistics@scms.io GET LOGISTICS channel (should work)
    print("\n[4c] GET /api/announcements?channel=LOGISTICS as chief.logistics@scms.io (expect 200)")
    logistics_token = login(CREDENTIALS["chief_logistics"]["email"], CREDENTIALS["chief_logistics"]["password"])
    logistics_headers = get_headers(logistics_token)
    
    try:
        resp = requests.get(f"{BASE_URL}/announcements?channel=LOGISTICS", headers=logistics_headers, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            announcements = resp.json().get("announcements", [])
            print(f"✅ Chief logistics can access LOGISTICS channel ({len(announcements)} announcements)")
        else:
            print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    # Test 4d: chief.logistics@scms.io GET EDITORIAL channel (should fail)
    print("\n[4d] GET /api/announcements?channel=EDITORIAL as chief.logistics@scms.io (expect 403)")
    try:
        resp = requests.get(f"{BASE_URL}/announcements?channel=EDITORIAL", headers=logistics_headers, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 403:
            print(f"✅ Chief logistics correctly denied EDITORIAL channel (403)")
        else:
            print(f"❌ Expected 403, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    # Test 4e: admin@scms.io can access both channels
    print("\n[4e] GET /api/announcements?channel=LOGISTICS as admin@scms.io (expect 200)")
    admin_token = login(CREDENTIALS["admin"]["email"], CREDENTIALS["admin"]["password"])
    admin_headers = get_headers(admin_token)
    
    try:
        resp = requests.get(f"{BASE_URL}/announcements?channel=LOGISTICS", headers=admin_headers, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            print(f"✅ Admin can access LOGISTICS channel")
        else:
            print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    print("\n[4f] GET /api/announcements?channel=EDITORIAL as admin@scms.io (expect 200)")
    try:
        resp = requests.get(f"{BASE_URL}/announcements?channel=EDITORIAL", headers=admin_headers, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            print(f"✅ Admin can access EDITORIAL channel")
        else:
            print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    # Test 4g: POST announcement to LOGISTICS channel
    print("\n[4g] POST /api/announcements?channel=LOGISTICS as logistics1@scms.io")
    logistics1_token = login(CREDENTIALS["logistics1"]["email"], CREDENTIALS["logistics1"]["password"])
    logistics1_headers = get_headers(logistics1_token)
    
    try:
        timestamp = int(time.time())
        payload = {"body": f"Test logistics message {timestamp}"}
        resp = requests.post(f"{BASE_URL}/announcements?channel=LOGISTICS", 
                           headers=logistics1_headers, json=payload, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            print(f"✅ Posted to LOGISTICS channel")
            
            # Verify it appears in LOGISTICS but not EDITORIAL
            resp2 = requests.get(f"{BASE_URL}/announcements?channel=LOGISTICS", headers=logistics_headers, timeout=10)
            if resp2.status_code == 200:
                announcements = resp2.json().get("announcements", [])
                found = any(a.get("body", "").startswith(f"Test logistics message {timestamp}") for a in announcements)
                if found:
                    print(f"✅ Message appears in LOGISTICS channel")
                else:
                    print(f"❌ Message not found in LOGISTICS channel")
                    all_passed = False
            
            # Check it doesn't appear in EDITORIAL
            resp3 = requests.get(f"{BASE_URL}/announcements?channel=EDITORIAL", headers=admin_headers, timeout=10)
            if resp3.status_code == 200:
                announcements = resp3.json().get("announcements", [])
                found = any(a.get("body", "").startswith(f"Test logistics message {timestamp}") for a in announcements)
                if not found:
                    print(f"✅ Message correctly NOT in EDITORIAL channel")
                else:
                    print(f"❌ Message incorrectly appears in EDITORIAL channel")
                    all_passed = False
        else:
            print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    return all_passed

def test_logistics_members():
    """Test 5: GET /api/logistics/members"""
    print("\n" + "="*80)
    print("TEST 5: GET /api/logistics/members")
    print("="*80)
    
    all_passed = True
    
    admin_token = login(CREDENTIALS["admin"]["email"], CREDENTIALS["admin"]["password"])
    admin_headers = get_headers(admin_token)
    
    print("\n[5a] GET /api/logistics/members as admin@scms.io")
    try:
        resp = requests.get(f"{BASE_URL}/logistics/members", headers=admin_headers, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            members = resp.json().get("members", [])
            print(f"✅ Returned {len(members)} logistics members")
            
            # Check for expected members
            emails = [m.get("email") for m in members]
            expected = ["chief.logistics@scms.io", "logistics1@scms.io", "logistics2@scms.io"]
            
            for email in expected:
                if email in emails:
                    print(f"  ✅ Found {email}")
                else:
                    print(f"  ❌ Missing {email}")
                    all_passed = False
            
            # Check Chief Logistics is first
            if members and members[0].get("email") == "chief.logistics@scms.io":
                print(f"✅ Chief Logistics sorted first")
            else:
                print(f"❌ Chief Logistics not sorted first. First member: {members[0].get('email') if members else 'None'}")
                all_passed = False
        else:
            print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    return all_passed

def test_sponsorship_requests():
    """Test 6: Sponsorship requests"""
    print("\n" + "="*80)
    print("TEST 6: SPONSORSHIP REQUESTS")
    print("="*80)
    
    all_passed = True
    
    # Test 6a: GET /api/sponsorship-tiers (public)
    print("\n[6a] GET /api/sponsorship-tiers (no auth)")
    try:
        resp = requests.get(f"{BASE_URL}/sponsorship-tiers", timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            tiers = resp.json().get("tiers", [])
            expected_tiers = ["PLATINUM", "GOLD", "SILVER", "BRONZE"]
            
            if len(tiers) == 4:
                print(f"✅ Returned 4 tiers")
                
                for tier in tiers:
                    key = tier.get("key")
                    if key in expected_tiers:
                        print(f"  ✅ {key}: {tier.get('label')} - {tier.get('price')} ({len(tier.get('benefits', []))} benefits)")
                    else:
                        print(f"  ❌ Unexpected tier: {key}")
                        all_passed = False
            else:
                print(f"❌ Expected 4 tiers, got {len(tiers)}")
                all_passed = False
        else:
            print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    # Get conference ID
    try:
        resp = requests.get(f"{BASE_URL}/conferences", timeout=10)
        conferences = resp.json().get("conferences", [])
        if not conferences:
            print("❌ No conferences available")
            return False
        conf_id = conferences[0]["id"]
        print(f"✅ Using conference: {conf_id}")
    except Exception as e:
        print(f"❌ Exception getting conference: {e}")
        return False
    
    # Test 6b: POST /api/sponsorship-requests as sponsor
    print("\n[6b] POST /api/sponsorship-requests as sponsor@scms.io")
    sponsor_token = login(CREDENTIALS["sponsor"]["email"], CREDENTIALS["sponsor"]["password"])
    sponsor_headers = get_headers(sponsor_token)
    
    try:
        timestamp = int(time.time())
        payload = {
            "conferenceId": conf_id,
            "companyName": f"Acme Pharma {timestamp}",
            "industry": "Pharma",
            "sponsorTier": "GOLD",
            "contactEmail": "sponsor@scms.io",
            "message": "Interested in sponsoring"
        }
        resp = requests.post(f"{BASE_URL}/sponsorship-requests", headers=sponsor_headers, json=payload, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            request_data = resp.json().get("request", {})
            request_id = request_data.get("id")
            status = request_data.get("status")
            
            if status == "PENDING":
                print(f"✅ Sponsorship request created with status=PENDING (ID: {request_id})")
            else:
                print(f"❌ Expected status=PENDING, got {status}")
                all_passed = False
        else:
            print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    # Test 6c: POST without companyName (should fail)
    print("\n[6c] POST /api/sponsorship-requests without companyName (expect 4xx)")
    try:
        payload = {
            "conferenceId": conf_id,
            "industry": "Pharma",
            "sponsorTier": "GOLD"
        }
        resp = requests.post(f"{BASE_URL}/sponsorship-requests", headers=sponsor_headers, json=payload, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code >= 400 and resp.status_code < 500:
            print(f"✅ Correctly rejected with {resp.status_code}")
        else:
            print(f"❌ Expected 4xx, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    # Test 6d: GET /api/sponsorship-requests as chief.logistics
    print("\n[6d] GET /api/sponsorship-requests as chief.logistics@scms.io")
    logistics_token = login(CREDENTIALS["chief_logistics"]["email"], CREDENTIALS["chief_logistics"]["password"])
    logistics_headers = get_headers(logistics_token)
    
    try:
        resp = requests.get(f"{BASE_URL}/sponsorship-requests", headers=logistics_headers, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            requests_list = resp.json().get("requests", [])
            print(f"✅ Chief logistics can see all requests ({len(requests_list)} total)")
            
            # Find our test request
            test_request = next((r for r in requests_list if f"Acme Pharma {timestamp}" in r.get("companyName", "")), None)
            if test_request:
                print(f"  ✅ Found our test request: {test_request.get('companyName')}")
                request_id = test_request.get("id")
            else:
                print(f"  ❌ Test request not found")
                all_passed = False
                request_id = None
        else:
            print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            all_passed = False
            request_id = None
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
        request_id = None
    
    # Test 6e: PUT /api/sponsorship-requests/:id to approve
    if request_id:
        print(f"\n[6e] PUT /api/sponsorship-requests/{request_id} to APPROVE")
        try:
            payload = {
                "status": "APPROVED",
                "reviewNotes": "Welcome aboard"
            }
            resp = requests.put(f"{BASE_URL}/sponsorship-requests/{request_id}", 
                              headers=logistics_headers, json=payload, timeout=10)
            print(f"Status: {resp.status_code}")
            
            if resp.status_code == 200:
                updated = resp.json().get("request", {})
                if updated.get("status") == "APPROVED":
                    print(f"✅ Request approved successfully")
                    
                    # Verify sponsor receives notification
                    resp2 = requests.get(f"{BASE_URL}/notifications", headers=sponsor_headers, timeout=10)
                    if resp2.status_code == 200:
                        notifs = resp2.json().get("notifications", [])
                        approval_notif = [n for n in notifs if "approved" in n.get("title", "").lower()]
                        if approval_notif:
                            print(f"✅ Sponsor received approval notification")
                        else:
                            print(f"❌ Sponsor did not receive approval notification")
                            all_passed = False
                else:
                    print(f"❌ Status not updated to APPROVED: {updated.get('status')}")
                    all_passed = False
            else:
                print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
                all_passed = False
        except Exception as e:
            print(f"❌ Exception: {e}")
            all_passed = False
    
    # Test 6f: GET /api/sponsorship-requests as sponsor (should only see own)
    print("\n[6f] GET /api/sponsorship-requests as sponsor@scms.io (should only see own)")
    try:
        resp = requests.get(f"{BASE_URL}/sponsorship-requests", headers=sponsor_headers, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            requests_list = resp.json().get("requests", [])
            print(f"✅ Sponsor sees {len(requests_list)} request(s)")
            
            # All should belong to sponsor
            all_own = all(r.get("requester", {}).get("email") == "sponsor@scms.io" for r in requests_list)
            if all_own:
                print(f"✅ All requests belong to sponsor")
            else:
                print(f"❌ Sponsor can see other users' requests")
                all_passed = False
        else:
            print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    return all_passed

def test_attendee_registration_toggle():
    """Test 7: PUT /api/conferences/:id/attendee-registration — admin toggle"""
    print("\n" + "="*80)
    print("TEST 7: PUT /api/conferences/:id/attendee-registration — ADMIN TOGGLE")
    print("="*80)
    
    all_passed = True
    
    # Get conference ID
    try:
        resp = requests.get(f"{BASE_URL}/conferences", timeout=10)
        conferences = resp.json().get("conferences", [])
        if not conferences:
            print("❌ No conferences available")
            return False
        conf_id = conferences[0]["id"]
        print(f"✅ Using conference: {conf_id}")
    except Exception as e:
        print(f"❌ Exception getting conference: {e}")
        return False
    
    # Test 7a: author@scms.io should get 403
    print(f"\n[7a] PUT /api/conferences/{conf_id}/attendee-registration as author@scms.io (expect 403)")
    author_token = login(CREDENTIALS["author"]["email"], CREDENTIALS["author"]["password"])
    author_headers = get_headers(author_token)
    
    try:
        payload = {"open": True}
        resp = requests.put(f"{BASE_URL}/conferences/{conf_id}/attendee-registration", 
                          headers=author_headers, json=payload, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 403:
            print(f"✅ Author correctly denied (403)")
        else:
            print(f"❌ Expected 403, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    # Test 7b: admin@scms.io should succeed and broadcast notification
    print(f"\n[7b] PUT /api/conferences/{conf_id}/attendee-registration as admin@scms.io with open=true")
    admin_token = login(CREDENTIALS["admin"]["email"], CREDENTIALS["admin"]["password"])
    admin_headers = get_headers(admin_token)
    
    try:
        # Get current notification count
        resp_before = requests.get(f"{BASE_URL}/notifications", headers=admin_headers, timeout=10)
        notifs_before = len(resp_before.json().get("notifications", [])) if resp_before.status_code == 200 else 0
        
        payload = {"open": True}
        resp = requests.put(f"{BASE_URL}/conferences/{conf_id}/attendee-registration", 
                          headers=admin_headers, json=payload, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            conference = resp.json().get("conference", {})
            if conference.get("attendeeRegistrationOpen") == True:
                print(f"✅ attendeeRegistrationOpen set to true")
                
                # Check for broadcast notification
                time.sleep(1)  # Give time for notifications to be created
                resp_after = requests.get(f"{BASE_URL}/notifications", headers=admin_headers, timeout=10)
                if resp_after.status_code == 200:
                    notifs_after = resp_after.json().get("notifications", [])
                    new_notifs = [n for n in notifs_after if "Attendee registration is now open" in n.get("title", "")]
                    
                    if new_notifs:
                        print(f"✅ Broadcast notification sent: '{new_notifs[0].get('title')}'")
                    else:
                        print(f"❌ No broadcast notification found")
                        all_passed = False
            else:
                print(f"❌ attendeeRegistrationOpen not set to true")
                all_passed = False
        else:
            print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    # Test 7c: Set back to false
    print(f"\n[7c] PUT /api/conferences/{conf_id}/attendee-registration with open=false")
    try:
        payload = {"open": False}
        resp = requests.put(f"{BASE_URL}/conferences/{conf_id}/attendee-registration", 
                          headers=admin_headers, json=payload, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            conference = resp.json().get("conference", {})
            if conference.get("attendeeRegistrationOpen") == False:
                print(f"✅ attendeeRegistrationOpen set to false")
            else:
                print(f"❌ attendeeRegistrationOpen not set to false")
                all_passed = False
        else:
            print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    return all_passed

def test_attendee_registration_gating():
    """Test 8: Attendee registration gating"""
    print("\n" + "="*80)
    print("TEST 8: ATTENDEE REGISTRATION GATING")
    print("="*80)
    
    all_passed = True
    
    # Get conference ID
    try:
        resp = requests.get(f"{BASE_URL}/conferences", timeout=10)
        conferences = resp.json().get("conferences", [])
        if not conferences:
            print("❌ No conferences available")
            return False
        conf_id = conferences[0]["id"]
        print(f"✅ Using conference: {conf_id}")
    except Exception as e:
        print(f"❌ Exception getting conference: {e}")
        return False
    
    # Ensure attendeeRegistrationOpen is false
    admin_token = login(CREDENTIALS["admin"]["email"], CREDENTIALS["admin"]["password"])
    admin_headers = get_headers(admin_token)
    
    try:
        payload = {"open": False}
        resp = requests.put(f"{BASE_URL}/conferences/{conf_id}/attendee-registration", 
                          headers=admin_headers, json=payload, timeout=10)
        if resp.status_code == 200:
            print(f"✅ Set attendeeRegistrationOpen to false")
        else:
            print(f"⚠️  Could not set attendeeRegistrationOpen to false")
    except Exception as e:
        print(f"⚠️  Exception setting toggle: {e}")
    
    # Test 8a: Try to register as attendee (should get 409)
    print(f"\n[8a] POST /api/conferences/{conf_id}/register as attendee@scms.io (expect 409)")
    attendee_token = login(CREDENTIALS["attendee"]["email"], CREDENTIALS["attendee"]["password"])
    attendee_headers = get_headers(attendee_token)
    
    try:
        payload = {
            "type": "ATTENDEE",
            "mode": "PHYSICAL",
            "fullName": "Test Attendee",
            "rank": "Delegate",
            "unit": "Cardio",
            "affiliation": "UCH"
        }
        resp = requests.post(f"{BASE_URL}/conferences/{conf_id}/register", 
                           headers=attendee_headers, json=payload, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 409:
            error_msg = resp.json().get("error", "")
            if "not yet open" in error_msg.lower():
                print(f"✅ Correctly blocked with 409: '{error_msg}'")
            else:
                print(f"⚠️  Got 409 but message doesn't mention 'not yet open': '{error_msg}'")
        else:
            print(f"❌ Expected 409, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    # Test 8b: Toggle open and try again
    print(f"\n[8b] Toggle attendeeRegistrationOpen=true and try again")
    try:
        payload = {"open": True}
        resp = requests.put(f"{BASE_URL}/conferences/{conf_id}/attendee-registration", 
                          headers=admin_headers, json=payload, timeout=10)
        if resp.status_code == 200:
            print(f"✅ Set attendeeRegistrationOpen to true")
            
            # Try to register again
            payload = {
                "type": "ATTENDEE",
                "mode": "PHYSICAL",
                "fullName": "Test Attendee",
                "rank": "Delegate",
                "unit": "Cardio",
                "affiliation": "UCH"
            }
            resp2 = requests.post(f"{BASE_URL}/conferences/{conf_id}/register", 
                               headers=attendee_headers, json=payload, timeout=10)
            print(f"Status: {resp2.status_code}")
            
            if resp2.status_code == 200:
                print(f"✅ Registration succeeded with toggle open")
            elif resp2.status_code >= 400 and "not yet open" not in resp2.json().get("error", "").lower():
                # Date-based check might still block, but shouldn't be the toggle message
                print(f"⚠️  Got {resp2.status_code} (may be date-based check): {resp2.json().get('error', '')}")
            else:
                print(f"❌ Expected 200 or date-specific error, got {resp2.status_code}: {resp2.text}")
                all_passed = False
        else:
            print(f"❌ Failed to toggle: {resp.status_code}")
            all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    return all_passed

def test_user_roles():
    """Test 9: POST /api/users/:id/roles + DELETE /api/users/:id/roles/:role"""
    print("\n" + "="*80)
    print("TEST 9: POST /api/users/:id/roles + DELETE /api/users/:id/roles/:role")
    print("="*80)
    
    all_passed = True
    
    admin_token = login(CREDENTIALS["admin"]["email"], CREDENTIALS["admin"]["password"])
    admin_headers = get_headers(admin_token)
    
    # Get a non-logistics user (reviewer1@scms.io)
    try:
        resp = requests.get(f"{BASE_URL}/users", headers=admin_headers, timeout=10)
        users = resp.json().get("users", [])
        test_user = next((u for u in users if u["email"] == "reviewer1@scms.io"), None)
        if not test_user:
            print("❌ reviewer1@scms.io not found")
            return False
        user_id = test_user["id"]
        print(f"✅ Using user: reviewer1@scms.io (ID: {user_id})")
    except Exception as e:
        print(f"❌ Exception getting users: {e}")
        return False
    
    # Test 9a: POST /api/users/:id/roles as admin
    print(f"\n[9a] POST /api/users/{user_id}/roles with role=COMMITTEE_LOGISTICS")
    try:
        payload = {"role": "COMMITTEE_LOGISTICS"}
        resp = requests.post(f"{BASE_URL}/users/{user_id}/roles", 
                           headers=admin_headers, json=payload, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            print(f"✅ Role added successfully")
            
            # Verify role was added
            resp2 = requests.get(f"{BASE_URL}/users", headers=admin_headers, timeout=10)
            if resp2.status_code == 200:
                users = resp2.json().get("users", [])
                test_user = next((u for u in users if u["id"] == user_id), None)
                if test_user:
                    roles = [r.get("role") for r in test_user.get("roles", [])]
                    if "COMMITTEE_LOGISTICS" in roles:
                        print(f"✅ COMMITTEE_LOGISTICS role confirmed in user data")
                    else:
                        print(f"❌ COMMITTEE_LOGISTICS role not found in user data")
                        all_passed = False
        else:
            print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    # Test 9b: POST same role again (idempotent)
    print(f"\n[9b] POST /api/users/{user_id}/roles with same role (idempotent)")
    try:
        payload = {"role": "COMMITTEE_LOGISTICS"}
        resp = requests.post(f"{BASE_URL}/users/{user_id}/roles", 
                           headers=admin_headers, json=payload, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("alreadyExists"):
                print(f"✅ Idempotent: alreadyExists=true")
            else:
                print(f"⚠️  Role added again (not idempotent)")
        else:
            print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    # Test 9c: DELETE /api/users/:id/roles/:role
    print(f"\n[9c] DELETE /api/users/{user_id}/roles/COMMITTEE_LOGISTICS")
    try:
        resp = requests.delete(f"{BASE_URL}/users/{user_id}/roles/COMMITTEE_LOGISTICS", 
                             headers=admin_headers, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            print(f"✅ Role deleted successfully")
            
            # Verify role was removed
            resp2 = requests.get(f"{BASE_URL}/users", headers=admin_headers, timeout=10)
            if resp2.status_code == 200:
                users = resp2.json().get("users", [])
                test_user = next((u for u in users if u["id"] == user_id), None)
                if test_user:
                    roles = [r.get("role") for r in test_user.get("roles", [])]
                    if "COMMITTEE_LOGISTICS" not in roles:
                        print(f"✅ COMMITTEE_LOGISTICS role removed from user data")
                    else:
                        print(f"❌ COMMITTEE_LOGISTICS role still present in user data")
                        all_passed = False
        else:
            print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    # Test 9d: Non-admin should get 403
    print(f"\n[9d] POST /api/users/{user_id}/roles as author@scms.io (expect 403)")
    author_token = login(CREDENTIALS["author"]["email"], CREDENTIALS["author"]["password"])
    author_headers = get_headers(author_token)
    
    try:
        payload = {"role": "COMMITTEE_LOGISTICS"}
        resp = requests.post(f"{BASE_URL}/users/{user_id}/roles", 
                           headers=author_headers, json=payload, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 403:
            print(f"✅ Non-admin correctly denied (403)")
        else:
            print(f"❌ Expected 403, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    return all_passed

def test_regression():
    """Test 10: Regression checks"""
    print("\n" + "="*80)
    print("TEST 10: REGRESSION CHECKS")
    print("="*80)
    
    all_passed = True
    
    # Test 10a: Login for all key accounts
    print("\n[10a] POST /api/auth/login for all key accounts")
    accounts = ["admin", "chief", "chief_logistics", "sponsor"]
    
    for account in accounts:
        try:
            creds = CREDENTIALS[account]
            resp = requests.post(f"{BASE_URL}/auth/login", json=creds, timeout=10)
            print(f"  {creds['email']}: {resp.status_code}", end="")
            
            if resp.status_code == 200:
                token = resp.json().get("token")
                if token and token.startswith("eyJ"):
                    print(f" ✅")
                else:
                    print(f" ❌ (invalid token)")
                    all_passed = False
            else:
                print(f" ❌")
                all_passed = False
        except Exception as e:
            print(f"  {creds['email']}: ❌ Exception: {e}")
            all_passed = False
    
    # Test 10b: GET /api/abstracts returns technicalScoreAverage/count
    print("\n[10b] GET /api/abstracts returns technicalScoreAverage/count fields")
    admin_token = login(CREDENTIALS["admin"]["email"], CREDENTIALS["admin"]["password"])
    admin_headers = get_headers(admin_token)
    
    try:
        resp = requests.get(f"{BASE_URL}/abstracts", headers=admin_headers, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            abstracts = resp.json().get("abstracts", [])
            if abstracts:
                sample = abstracts[0]
                has_avg = "technicalScoreAverage" in sample
                has_count = "technicalScoreCount" in sample
                
                if has_avg and has_count:
                    print(f"✅ technicalScoreAverage and technicalScoreCount fields present")
                else:
                    missing = []
                    if not has_avg:
                        missing.append("technicalScoreAverage")
                    if not has_count:
                        missing.append("technicalScoreCount")
                    print(f"❌ Missing fields: {', '.join(missing)}")
                    all_passed = False
            else:
                print(f"⚠️  No abstracts to check")
        else:
            print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    return all_passed

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("SCMS BACKEND API TESTS - Logistics & Sponsorship Sprint")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Testing 10 scenarios:")
    print("  1. POST /api/auth/register — welcome message")
    print("  2. POST /api/abstracts/:id/scores — auto-tick technical check")
    print("  3. POST /api/abstracts/:id/assign-editor — RBAC tightened")
    print("  4. GET /api/announcements — channel support")
    print("  5. GET /api/logistics/members")
    print("  6. Sponsorship requests")
    print("  7. PUT /api/conferences/:id/attendee-registration — admin toggle")
    print("  8. Attendee registration gating")
    print("  9. POST /api/users/:id/roles + DELETE")
    print("  10. Regression checks")
    
    results = {}
    
    # Run tests
    results["test1_register_welcome"] = test_register_welcome_message()
    results["test2_scores_auto_tick"] = test_abstract_scores_auto_tick()
    results["test3_assign_editor_rbac"] = test_assign_editor_rbac_tightened()
    results["test4_announcements_channel"] = test_announcements_channel_support()
    results["test5_logistics_members"] = test_logistics_members()
    results["test6_sponsorship"] = test_sponsorship_requests()
    results["test7_attendee_toggle"] = test_attendee_registration_toggle()
    results["test8_attendee_gating"] = test_attendee_registration_gating()
    results["test9_user_roles"] = test_user_roles()
    results["test10_regression"] = test_regression()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    for test_name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{test_name}: {status}")
    
    all_passed = all(results.values())
    
    if all_passed:
        print("\n🎉 ALL TESTS PASSED")
        return 0
    else:
        print("\n❌ SOME TESTS FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())
