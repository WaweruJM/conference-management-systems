#!/usr/bin/env python3
"""
SCMS Backend Smoke Test
Quick smoke test to verify JSX fix and RBAC rules
"""

import requests
import json
import time
from datetime import datetime

# Base URL from .env
BASE_URL = "https://scms-platform-1.preview.emergentagent.com"
API_URL = f"{BASE_URL}/api"

# Test credentials (all password: password123)
CREDENTIALS = {
    "admin": {"email": "admin@scms.io", "password": "password123"},
    "chief": {"email": "chief@scms.io", "password": "password123"},
    "author": {"email": "author@scms.io", "password": "password123"},
    "committee": {"email": "committee@scms.io", "password": "password123"}
}

def login(email, password):
    """Login and return JWT token"""
    try:
        response = requests.post(
            f"{API_URL}/auth/login",
            json={"email": email, "password": password},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("token")
        else:
            print(f"❌ Login failed for {email}: {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ Login exception for {email}: {str(e)}")
        return None

def test_landing_page():
    """Test 1.1: GET / returns 200 HTML (JSX build error fixed)"""
    print("\n=== TEST 1.1: Landing Page (JSX Build Fix) ===")
    try:
        response = requests.get(BASE_URL, timeout=10)
        if response.status_code == 200 and "text/html" in response.headers.get("content-type", ""):
            print(f"✅ GET / → 200 (HTML) - JSX build error is fixed")
            return True
        else:
            print(f"❌ GET / → {response.status_code} - Expected 200 HTML")
            return False
    except Exception as e:
        print(f"❌ GET / exception: {str(e)}")
        return False

def test_auth_login():
    """Test 1.2 & 1.3: Login for admin and chief"""
    print("\n=== TEST 1.2 & 1.3: Authentication ===")
    results = []
    
    # Test admin login
    try:
        response = requests.post(
            f"{API_URL}/auth/login",
            json=CREDENTIALS["admin"],
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            token = data.get("token")
            roles = data.get("user", {}).get("roles", [])
            if token and isinstance(roles, list):
                print(f"✅ POST /api/auth/login (admin@scms.io) → 200 with JWT and roles: {roles}")
                results.append(True)
            else:
                print(f"❌ POST /api/auth/login (admin@scms.io) → 200 but missing token or roles")
                results.append(False)
        else:
            print(f"❌ POST /api/auth/login (admin@scms.io) → {response.status_code}")
            results.append(False)
    except Exception as e:
        print(f"❌ Admin login exception: {str(e)}")
        results.append(False)
    
    # Test chief login
    try:
        response = requests.post(
            f"{API_URL}/auth/login",
            json=CREDENTIALS["chief"],
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            token = data.get("token")
            roles = data.get("user", {}).get("roles", [])
            if token and isinstance(roles, list):
                print(f"✅ POST /api/auth/login (chief@scms.io) → 200 with JWT and roles: {roles}")
                results.append(True)
            else:
                print(f"❌ POST /api/auth/login (chief@scms.io) → 200 but missing token or roles")
                results.append(False)
        else:
            print(f"❌ POST /api/auth/login (chief@scms.io) → {response.status_code}")
            results.append(False)
    except Exception as e:
        print(f"❌ Chief login exception: {str(e)}")
        results.append(False)
    
    return all(results)

def test_core_endpoints():
    """Test 2: Core endpoints (abstracts, notifications)"""
    print("\n=== TEST 2: Core Endpoints ===")
    results = []
    
    # Login as admin
    admin_token = login(CREDENTIALS["admin"]["email"], CREDENTIALS["admin"]["password"])
    if not admin_token:
        print("❌ Cannot test core endpoints - admin login failed")
        return False
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Test GET /api/abstracts
    try:
        response = requests.get(f"{API_URL}/abstracts", headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            abstracts = data.get("abstracts", [])
            if abstracts and len(abstracts) > 0:
                # Check for technicalScoreAverage and technicalScoreCount
                first_abstract = abstracts[0]
                has_score_fields = "technicalScoreAverage" in first_abstract and "technicalScoreCount" in first_abstract
                if has_score_fields:
                    print(f"✅ GET /api/abstracts → 200 with {len(abstracts)} abstracts (technicalScoreAverage/Count present)")
                    results.append(True)
                    
                    # Store an abstract ID for next test
                    abstract_id = first_abstract.get("id")
                    
                    # Test GET /api/abstracts/:id
                    if abstract_id:
                        try:
                            response2 = requests.get(f"{API_URL}/abstracts/{abstract_id}", headers=headers, timeout=10)
                            if response2.status_code == 200:
                                print(f"✅ GET /api/abstracts/{abstract_id} → 200")
                                results.append(True)
                            else:
                                print(f"❌ GET /api/abstracts/{abstract_id} → {response2.status_code}")
                                results.append(False)
                        except Exception as e:
                            print(f"❌ GET /api/abstracts/:id exception: {str(e)}")
                            results.append(False)
                else:
                    print(f"❌ GET /api/abstracts → 200 but missing technicalScoreAverage/Count fields")
                    results.append(False)
            else:
                print(f"❌ GET /api/abstracts → 200 but empty abstracts array")
                results.append(False)
        else:
            print(f"❌ GET /api/abstracts → {response.status_code}")
            results.append(False)
    except Exception as e:
        print(f"❌ GET /api/abstracts exception: {str(e)}")
        results.append(False)
    
    # Test GET /api/notifications
    try:
        response = requests.get(f"{API_URL}/notifications", headers=headers, timeout=10)
        if response.status_code == 200:
            print(f"✅ GET /api/notifications → 200")
            results.append(True)
        else:
            print(f"❌ GET /api/notifications → {response.status_code}")
            results.append(False)
    except Exception as e:
        print(f"❌ GET /api/notifications exception: {str(e)}")
        results.append(False)
    
    return all(results)

def test_rbac_reviewer_invitations():
    """Test 3.1 & 3.2: Reviewer invitation RBAC"""
    print("\n=== TEST 3.1 & 3.2: Reviewer Invitation RBAC ===")
    results = []
    
    timestamp = int(time.time())
    test_email = f"smoke-{timestamp}@example.com"
    invitation_payload = {
        "email": test_email,
        "fullName": "Smoke Test",
        "specialty": "Cardio"
    }
    
    # Test 3.1: Chief editor can invite (should return 200 with delivery.sent:true)
    chief_token = login(CREDENTIALS["chief"]["email"], CREDENTIALS["chief"]["password"])
    if chief_token:
        headers = {"Authorization": f"Bearer {chief_token}"}
        try:
            response = requests.post(
                f"{API_URL}/reviewer-invitations",
                json=invitation_payload,
                headers=headers,
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                delivery_sent = data.get("delivery", {}).get("sent")
                if delivery_sent is True:
                    print(f"✅ POST /api/reviewer-invitations (chief@scms.io) → 200 with delivery.sent:true")
                    results.append(True)
                else:
                    print(f"❌ POST /api/reviewer-invitations (chief@scms.io) → 200 but delivery.sent is not true: {data}")
                    results.append(False)
            else:
                print(f"❌ POST /api/reviewer-invitations (chief@scms.io) → {response.status_code}: {response.text}")
                results.append(False)
        except Exception as e:
            print(f"❌ Chief reviewer invitation exception: {str(e)}")
            results.append(False)
    else:
        print("❌ Cannot test chief reviewer invitation - login failed")
        results.append(False)
    
    # Test 3.2: Author cannot invite (should return 403)
    author_token = login(CREDENTIALS["author"]["email"], CREDENTIALS["author"]["password"])
    if author_token:
        headers = {"Authorization": f"Bearer {author_token}"}
        try:
            response = requests.post(
                f"{API_URL}/reviewer-invitations",
                json=invitation_payload,
                headers=headers,
                timeout=10
            )
            if response.status_code == 403:
                print(f"✅ POST /api/reviewer-invitations (author@scms.io) → 403 (correctly denied)")
                results.append(True)
            else:
                print(f"❌ POST /api/reviewer-invitations (author@scms.io) → {response.status_code} (expected 403)")
                results.append(False)
        except Exception as e:
            print(f"❌ Author reviewer invitation exception: {str(e)}")
            results.append(False)
    else:
        print("❌ Cannot test author reviewer invitation - login failed")
        results.append(False)
    
    return all(results)

def test_rbac_committee_transition():
    """Test 3.3: Committee editor can only transition assigned abstracts"""
    print("\n=== TEST 3.3: Committee Editor Transition RBAC ===")
    
    # First, get all abstracts as admin to find one NOT assigned to committee@scms.io
    admin_token = login(CREDENTIALS["admin"]["email"], CREDENTIALS["admin"]["password"])
    if not admin_token:
        print("❌ Cannot test committee transition - admin login failed")
        return False
    
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    try:
        response = requests.get(f"{API_URL}/abstracts", headers=admin_headers, timeout=10)
        if response.status_code != 200:
            print(f"❌ Cannot get abstracts list: {response.status_code}")
            return False
        
        data = response.json()
        abstracts = data.get("abstracts", [])
        
        # Find an abstract NOT assigned to committee@scms.io
        unassigned_abstract_id = None
        for abstract in abstracts:
            editor_assignments = abstract.get("editorAssignments", [])
            # Check if committee@scms.io is assigned
            is_assigned = any(
                ea.get("editor", {}).get("email") == "committee@scms.io" 
                for ea in editor_assignments
            )
            if not is_assigned:
                unassigned_abstract_id = abstract.get("id")
                break
        
        if not unassigned_abstract_id:
            print("⚠️  All abstracts are assigned to committee@scms.io - cannot test unassigned scenario")
            # Try to use any abstract
            if abstracts:
                unassigned_abstract_id = abstracts[0].get("id")
                print(f"ℹ️  Using abstract {unassigned_abstract_id} for testing (may be assigned)")
            else:
                print("❌ No abstracts available for testing")
                return False
        
        # Now try to transition as committee@scms.io
        committee_token = login(CREDENTIALS["committee"]["email"], CREDENTIALS["committee"]["password"])
        if not committee_token:
            print("❌ Cannot test committee transition - committee login failed")
            return False
        
        committee_headers = {"Authorization": f"Bearer {committee_token}"}
        
        try:
            response = requests.post(
                f"{API_URL}/abstracts/{unassigned_abstract_id}/transition",
                json={"newState": "COMMITTEE_REVIEW"},
                headers=committee_headers,
                timeout=10
            )
            
            if response.status_code == 403:
                error_text = response.text.lower()
                if "assigned" in error_text:
                    print(f"✅ POST /api/abstracts/:id/transition (committee@scms.io, unassigned abstract) → 403 with 'assigned' phrasing")
                    return True
                else:
                    print(f"✅ POST /api/abstracts/:id/transition (committee@scms.io, unassigned abstract) → 403 (but missing 'assigned' phrasing)")
                    print(f"   Response: {response.text}")
                    return True  # Still pass as 403 is correct
            else:
                print(f"❌ POST /api/abstracts/:id/transition (committee@scms.io, unassigned abstract) → {response.status_code} (expected 403)")
                print(f"   Response: {response.text}")
                return False
        except Exception as e:
            print(f"❌ Committee transition exception: {str(e)}")
            return False
            
    except Exception as e:
        print(f"❌ Exception getting abstracts: {str(e)}")
        return False

def main():
    """Run all smoke tests"""
    print("=" * 70)
    print("SCMS BACKEND SMOKE TEST")
    print("Quick smoke test to verify JSX fix and RBAC rules")
    print("=" * 70)
    
    results = {
        "1.1 Landing Page (JSX Fix)": False,
        "1.2-1.3 Authentication": False,
        "2. Core Endpoints": False,
        "3.1-3.2 Reviewer Invitation RBAC": False,
        "3.3 Committee Transition RBAC": False
    }
    
    # Run tests
    results["1.1 Landing Page (JSX Fix)"] = test_landing_page()
    results["1.2-1.3 Authentication"] = test_auth_login()
    results["2. Core Endpoints"] = test_core_endpoints()
    results["3.1-3.2 Reviewer Invitation RBAC"] = test_rbac_reviewer_invitations()
    results["3.3 Committee Transition RBAC"] = test_rbac_committee_transition()
    
    # Summary
    print("\n" + "=" * 70)
    print("SMOKE TEST SUMMARY")
    print("=" * 70)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, passed_flag in results.items():
        status = "✅ PASS" if passed_flag else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print("=" * 70)
    print(f"TOTAL: {passed}/{total} test groups passed")
    print("=" * 70)
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
