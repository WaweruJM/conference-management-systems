#!/usr/bin/env python3
"""
Backend Verification Test for SCMS Platform
Tests specific fixes as per review request:
1. LiveKit authentication bug fix
2. Editorial Office assignment visibility
3. Editors' Chat backend integrity
4. Light regression checks
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Base URL from environment
BASE_URL = "https://scms-platform-1.preview.emergentagent.com/api"

# Test credentials
ADMIN_EMAIL = "admin@scms.io"
ADMIN_PASSWORD = "password123"
AUTHOR_EMAIL = "author@scms.io"
AUTHOR_PASSWORD = "password123"
MANAGING_EMAIL = "managing@scms.io"
MANAGING_PASSWORD = "password123"

# Featured conference ID from review request
FEATURED_CONFERENCE_ID = "e01de36e-e09e-479f-bd53-c056b2a90436"

# Test results
test_results = {
    "passed": [],
    "failed": [],
    "details": []
}


def log_test(name: str, passed: bool, details: str = ""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {name}")
    if details:
        print(f"   {details}")
    
    if passed:
        test_results["passed"].append(name)
    else:
        test_results["failed"].append(name)
    
    test_results["details"].append({
        "name": name,
        "passed": passed,
        "details": details
    })


def login(email: str, password: str) -> Optional[str]:
    """Login and return Bearer token"""
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
        if resp.status_code == 200:
            data = resp.json()
            return data.get("token")
        return None
    except Exception as e:
        print(f"Login error: {e}")
        return None


def register_attendee() -> Optional[tuple]:
    """Register a new attendee user and return (token, user_id)"""
    try:
        import time
        email = f"attendee_{int(time.time())}@test.com"
        resp = requests.post(f"{BASE_URL}/auth/register", json={
            "email": email,
            "password": "testpass123",
            "firstName": "Test",
            "lastName": "Attendee",
            "role": "ATTENDEE"
        })
        if resp.status_code == 200:
            data = resp.json()
            return data.get("token"), data.get("user", {}).get("id")
        return None, None
    except Exception as e:
        print(f"Registration error: {e}")
        return None, None


print("="*80)
print("SCMS Backend Verification Test")
print("="*80)
print(f"Base URL: {BASE_URL}")
print(f"Featured Conference ID: {FEATURED_CONFERENCE_ID}")
print("="*80)

# ============================================================================
# FIX 1: LiveKit Authentication Bug
# ============================================================================
print("\n" + "="*80)
print("FIX 1: LiveKit Authentication Bug")
print("="*80)

# Test 1a: POST /api/livekit/token with valid admin token
print("\n[Test 1a] POST /api/livekit/token with valid admin Authorization header")
try:
    admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not admin_token:
        log_test("1a: Admin login", False, "Failed to login as admin")
    else:
        log_test("1a: Admin login", True, f"Token: {admin_token[:20]}...")
        
        # First, set conference to live
        headers = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
        resp = requests.post(
            f"{BASE_URL}/conferences/{FEATURED_CONFERENCE_ID}/live",
            headers=headers,
            json={"isLive": True}
        )
        
        if resp.status_code == 200:
            log_test("1a: Set conference live", True, "Conference set to live")
        else:
            log_test("1a: Set conference live", False, f"Status {resp.status_code}: {resp.text}")
        
        # Now request LiveKit token
        resp = requests.post(
            f"{BASE_URL}/livekit/token",
            headers=headers,
            json={"conferenceId": FEATURED_CONFERENCE_ID}
        )
        
        if resp.status_code == 200:
            data = resp.json()
            token = data.get("token", "")
            url = data.get("url", "")
            room = data.get("room", "")
            role = data.get("role", "")
            identity = data.get("identity", "")
            
            checks = []
            checks.append(("token starts with 'eyJ'", token.startswith("eyJ")))
            checks.append(("url is wss://scms-pa6acvh8.livekit.cloud", url == "wss://scms-pa6acvh8.livekit.cloud"))
            checks.append(("room equals conference-{CID}", room == f"conference-{FEATURED_CONFERENCE_ID}"))
            checks.append(("role is 'host'", role == "host"))
            checks.append(("identity is present", bool(identity)))
            
            all_passed = all(check[1] for check in checks)
            details = ", ".join([f"{check[0]}: {check[1]}" for check in checks])
            
            log_test("1a: POST /api/livekit/token (admin)", all_passed, details)
        else:
            log_test("1a: POST /api/livekit/token (admin)", False, 
                    f"Expected 200, got {resp.status_code}: {resp.text}")
except Exception as e:
    log_test("1a: POST /api/livekit/token (admin)", False, f"Exception: {e}")

# Test 1b: POST /api/livekit/token with NO Authorization header
print("\n[Test 1b] POST /api/livekit/token with NO Authorization header")
try:
    resp = requests.post(
        f"{BASE_URL}/livekit/token",
        headers={"Content-Type": "application/json"},
        json={"conferenceId": FEATURED_CONFERENCE_ID}
    )
    
    if resp.status_code == 401:
        data = resp.json()
        if data.get("error") == "Unauthenticated":
            log_test("1b: POST /api/livekit/token (no auth) → 401", True, 
                    f"Response: {json.dumps(data)}")
        else:
            log_test("1b: POST /api/livekit/token (no auth) → 401", False, 
                    f"Expected error='Unauthenticated', got: {json.dumps(data)}")
    else:
        log_test("1b: POST /api/livekit/token (no auth) → 401", False, 
                f"Expected 401, got {resp.status_code}: {resp.text}")
except Exception as e:
    log_test("1b: POST /api/livekit/token (no auth)", False, f"Exception: {e}")

# Test 1c: POST /api/conferences/{CID}/live and GET /api/conferences/{CID}/live-status
print("\n[Test 1c] Conference live status management")
try:
    admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    headers = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    
    # Set to live
    resp = requests.post(
        f"{BASE_URL}/conferences/{FEATURED_CONFERENCE_ID}/live",
        headers=headers,
        json={"isLive": True}
    )
    
    if resp.status_code == 200:
        log_test("1c: POST /conferences/{CID}/live (isLive=true)", True, "Conference set to live")
        
        # Check live status (no auth)
        resp2 = requests.get(f"{BASE_URL}/conferences/{FEATURED_CONFERENCE_ID}/live-status")
        
        if resp2.status_code == 200:
            data = resp2.json()
            is_live = data.get("isLive")
            name = data.get("name")
            
            if is_live is True and name:
                log_test("1c: GET /conferences/{CID}/live-status (no auth)", True, 
                        f"isLive: {is_live}, name: {name}")
            else:
                log_test("1c: GET /conferences/{CID}/live-status (no auth)", False, 
                        f"Expected isLive=true and name, got: {json.dumps(data)}")
        else:
            log_test("1c: GET /conferences/{CID}/live-status (no auth)", False, 
                    f"Expected 200, got {resp2.status_code}: {resp2.text}")
    else:
        log_test("1c: POST /conferences/{CID}/live (isLive=true)", False, 
                f"Expected 200, got {resp.status_code}: {resp.text}")
except Exception as e:
    log_test("1c: Conference live status", False, f"Exception: {e}")

# Test 1d: Conference offline + viewer token attempt
print("\n[Test 1d] Conference offline - auth check and viewer rejection")
try:
    admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    headers = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    
    # Set to offline
    resp = requests.post(
        f"{BASE_URL}/conferences/{FEATURED_CONFERENCE_ID}/live",
        headers=headers,
        json={"isLive": False}
    )
    
    if resp.status_code == 200:
        log_test("1d: POST /conferences/{CID}/live (isLive=false)", True, "Conference set to offline")
        
        # Test unauthenticated call (should return 401, not 409)
        resp2 = requests.post(
            f"{BASE_URL}/livekit/token",
            headers={"Content-Type": "application/json"},
            json={"conferenceId": FEATURED_CONFERENCE_ID}
        )
        
        if resp2.status_code == 401:
            log_test("1d: POST /livekit/token (no auth, offline) → 401", True, 
                    "Auth check happens first")
        else:
            log_test("1d: POST /livekit/token (no auth, offline) → 401", False, 
                    f"Expected 401, got {resp2.status_code}: {resp2.text}")
        
        # Register a new attendee (non-host viewer)
        viewer_token, viewer_id = register_attendee()
        
        if viewer_token:
            log_test("1d: Register viewer", True, f"Viewer ID: {viewer_id}")
            
            # Try to get token as viewer while conference is offline
            viewer_headers = {"Authorization": f"Bearer {viewer_token}", "Content-Type": "application/json"}
            resp3 = requests.post(
                f"{BASE_URL}/livekit/token",
                headers=viewer_headers,
                json={"conferenceId": FEATURED_CONFERENCE_ID}
            )
            
            if resp3.status_code == 409:
                data = resp3.json()
                if data.get("error") == "Conference is offline":
                    log_test("1d: POST /livekit/token (viewer, offline) → 409", True, 
                            f"Response: {json.dumps(data)}")
                else:
                    log_test("1d: POST /livekit/token (viewer, offline) → 409", False, 
                            f"Expected error='Conference is offline', got: {json.dumps(data)}")
            else:
                log_test("1d: POST /livekit/token (viewer, offline) → 409", False, 
                        f"Expected 409, got {resp3.status_code}: {resp3.text}")
        else:
            log_test("1d: Register viewer", False, "Failed to register viewer")
    else:
        log_test("1d: POST /conferences/{CID}/live (isLive=false)", False, 
                f"Expected 200, got {resp.status_code}: {resp.text}")
except Exception as e:
    log_test("1d: Conference offline tests", False, f"Exception: {e}")

# ============================================================================
# FIX 2: Editorial Office Assignment Visibility
# ============================================================================
print("\n" + "="*80)
print("FIX 2: Editorial Office Assignment Visibility")
print("="*80)

print("\n[Test 2] GET /api/abstracts includes editorAssignments and reviewAssignments")
try:
    admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    resp = requests.get(f"{BASE_URL}/abstracts", headers=headers)
    
    if resp.status_code == 200:
        data = resp.json()
        abstracts = data.get("abstracts", [])
        
        if len(abstracts) == 0:
            log_test("2: GET /abstracts (admin)", False, "No abstracts found in system")
        else:
            log_test("2: GET /abstracts (admin)", True, f"Found {len(abstracts)} abstracts")
            
            # Check structure of first abstract
            abstract = abstracts[0]
            
            # Check editorAssignments
            editor_assignments = abstract.get("editorAssignments")
            if editor_assignments is None:
                log_test("2: editorAssignments field exists", False, "Field is missing (None)")
            elif not isinstance(editor_assignments, list):
                log_test("2: editorAssignments field exists", False, f"Expected list, got {type(editor_assignments)}")
            else:
                log_test("2: editorAssignments field exists", True, f"Array with {len(editor_assignments)} items")
                
                # If there are assignments, check structure
                if len(editor_assignments) > 0:
                    ea = editor_assignments[0]
                    editor = ea.get("editor", {})
                    has_fields = all(k in editor for k in ["firstName", "lastName", "email"])
                    log_test("2: editorAssignments[0].editor has firstName/lastName/email", has_fields,
                            f"Editor: {editor.get('firstName')} {editor.get('lastName')} ({editor.get('email')})")
            
            # Check reviewAssignments
            review_assignments = abstract.get("reviewAssignments")
            if review_assignments is None:
                log_test("2: reviewAssignments field exists", False, "Field is missing (None)")
            elif not isinstance(review_assignments, list):
                log_test("2: reviewAssignments field exists", False, f"Expected list, got {type(review_assignments)}")
            else:
                log_test("2: reviewAssignments field exists", True, f"Array with {len(review_assignments)} items")
                
                # If there are assignments, check structure
                if len(review_assignments) > 0:
                    ra = review_assignments[0]
                    reviewer = ra.get("reviewer", {})
                    status = ra.get("invitationStatus") or ra.get("status")
                    has_fields = all(k in reviewer for k in ["firstName", "lastName", "email"])
                    log_test("2: reviewAssignments[0].reviewer has firstName/lastName/email + status", 
                            has_fields and status is not None,
                            f"Reviewer: {reviewer.get('firstName')} {reviewer.get('lastName')} ({reviewer.get('email')}), Status: {status}")
            
            # Find an abstract with no assignments to verify empty arrays
            abstract_no_assignments = next((a for a in abstracts 
                                           if len(a.get("editorAssignments", [])) == 0 
                                           and len(a.get("reviewAssignments", [])) == 0), None)
            
            if abstract_no_assignments:
                ea_empty = abstract_no_assignments.get("editorAssignments")
                ra_empty = abstract_no_assignments.get("reviewAssignments")
                
                if ea_empty == [] and ra_empty == []:
                    log_test("2: Empty assignments are [] not null", True, 
                            "Confirmed empty arrays for abstracts without assignments")
                else:
                    log_test("2: Empty assignments are [] not null", False, 
                            f"editorAssignments: {ea_empty}, reviewAssignments: {ra_empty}")
    else:
        log_test("2: GET /abstracts (admin)", False, 
                f"Expected 200, got {resp.status_code}: {resp.text}")
except Exception as e:
    log_test("2: Editorial Office assignments", False, f"Exception: {e}")

# ============================================================================
# FIX 3: Editors' Chat Backend Intact
# ============================================================================
print("\n" + "="*80)
print("FIX 3: Editors' Chat Backend Intact")
print("="*80)

print("\n[Test 3a] GET /api/announcements as admin")
try:
    admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    resp = requests.get(f"{BASE_URL}/announcements", headers=headers)
    
    if resp.status_code == 200:
        data = resp.json()
        announcements = data.get("announcements")
        
        if announcements is not None and isinstance(announcements, list):
            log_test("3a: GET /announcements (admin) → 200", True, 
                    f"Response has 'announcements' array with {len(announcements)} items")
        else:
            log_test("3a: GET /announcements (admin) → 200", False, 
                    f"Expected 'announcements' array, got: {json.dumps(data)}")
    else:
        log_test("3a: GET /announcements (admin) → 200", False, 
                f"Expected 200, got {resp.status_code}: {resp.text}")
except Exception as e:
    log_test("3a: GET /announcements (admin)", False, f"Exception: {e}")

print("\n[Test 3b] GET /api/announcements as managing editor")
try:
    managing_token = login(MANAGING_EMAIL, MANAGING_PASSWORD)
    headers = {"Authorization": f"Bearer {managing_token}"}
    
    resp = requests.get(f"{BASE_URL}/announcements", headers=headers)
    
    if resp.status_code == 200:
        data = resp.json()
        announcements = data.get("announcements")
        
        if announcements is not None and isinstance(announcements, list):
            log_test("3b: GET /announcements (managing) → 200", True, 
                    f"Response has 'announcements' array with {len(announcements)} items")
        else:
            log_test("3b: GET /announcements (managing) → 200", False, 
                    f"Expected 'announcements' array, got: {json.dumps(data)}")
    else:
        log_test("3b: GET /announcements (managing) → 200", False, 
                f"Expected 200, got {resp.status_code}: {resp.text}")
except Exception as e:
    log_test("3b: GET /announcements (managing)", False, f"Exception: {e}")

print("\n[Test 3c] GET /api/announcements as author → 403")
try:
    author_token = login(AUTHOR_EMAIL, AUTHOR_PASSWORD)
    headers = {"Authorization": f"Bearer {author_token}"}
    
    resp = requests.get(f"{BASE_URL}/announcements", headers=headers)
    
    if resp.status_code == 403:
        log_test("3c: GET /announcements (author) → 403", True, 
                "Authors correctly denied access")
    else:
        log_test("3c: GET /announcements (author) → 403", False, 
                f"Expected 403, got {resp.status_code}: {resp.text}")
except Exception as e:
    log_test("3c: GET /announcements (author)", False, f"Exception: {e}")

# ============================================================================
# LIGHT REGRESSION CHECKS
# ============================================================================
print("\n" + "="*80)
print("LIGHT REGRESSION CHECKS")
print("="*80)

print("\n[Regression 1] POST /api/auth/login returns valid JWT")
try:
    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    
    if resp.status_code == 200:
        data = resp.json()
        token = data.get("token", "")
        user = data.get("user")
        
        if token and user and token.startswith("eyJ"):
            log_test("Regression 1: POST /auth/login", True, 
                    f"Valid JWT returned: {token[:30]}...")
        else:
            log_test("Regression 1: POST /auth/login", False, 
                    f"Token or user missing or invalid format")
    else:
        log_test("Regression 1: POST /auth/login", False, 
                f"Expected 200, got {resp.status_code}: {resp.text}")
except Exception as e:
    log_test("Regression 1: POST /auth/login", False, f"Exception: {e}")

print("\n[Regression 2] GET /api/notifications returns 200")
try:
    admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    resp = requests.get(f"{BASE_URL}/notifications", headers=headers)
    
    if resp.status_code == 200:
        data = resp.json()
        notifications = data.get("notifications")
        
        if notifications is not None and isinstance(notifications, list):
            log_test("Regression 2: GET /notifications", True, 
                    f"Returns 200 with {len(notifications)} notifications")
        else:
            log_test("Regression 2: GET /notifications", False, 
                    f"Expected 'notifications' array, got: {json.dumps(data)}")
    else:
        log_test("Regression 2: GET /notifications", False, 
                f"Expected 200, got {resp.status_code}: {resp.text}")
except Exception as e:
    log_test("Regression 2: GET /notifications", False, f"Exception: {e}")

print("\n[Regression 3] Featured conference has mapAddress and hotelImagePath")
try:
    resp = requests.get(f"{BASE_URL}/conferences/{FEATURED_CONFERENCE_ID}")
    
    if resp.status_code == 200:
        data = resp.json()
        conference = data.get("conference", {})
        
        map_address = conference.get("mapAddress")
        hotel_image_path = conference.get("hotelImagePath")
        
        checks = []
        checks.append(("mapAddress is populated", bool(map_address)))
        checks.append(("hotelImagePath is populated", bool(hotel_image_path)))
        
        all_passed = all(check[1] for check in checks)
        details = f"mapAddress: {bool(map_address)}, hotelImagePath: {bool(hotel_image_path)}"
        
        log_test("Regression 3: Featured conference fields", all_passed, details)
    else:
        log_test("Regression 3: Featured conference fields", False, 
                f"Expected 200, got {resp.status_code}: {resp.text}")
except Exception as e:
    log_test("Regression 3: Featured conference fields", False, f"Exception: {e}")

# ============================================================================
# SUMMARY
# ============================================================================
print("\n" + "="*80)
print("TEST SUMMARY")
print("="*80)

total = len(test_results["passed"]) + len(test_results["failed"])
passed = len(test_results["passed"])
failed = len(test_results["failed"])

print(f"\nTotal Tests: {total}")
print(f"✅ Passed: {passed}")
print(f"❌ Failed: {failed}")

if test_results["failed"]:
    print("\n❌ FAILED TESTS:")
    for test in test_results["failed"]:
        print(f"  - {test}")

success_rate = (passed / total * 100) if total > 0 else 0
print(f"\nSuccess Rate: {success_rate:.1f}%")

if failed > 0:
    print("\n⚠️  Some tests failed - see details above")
    sys.exit(1)
else:
    print("\n✅ All verification tests passed!")
    sys.exit(0)
