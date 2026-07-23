#!/usr/bin/env python3
"""
Backend API tests for SCMS platform - Sprint: Editorial Office enhancements
Tests 4 specific changes:
1. GET /api/abstracts SEARCH BY AUTHOR NAME
2. TECHNICAL SCORE AGGREGATION ON /api/abstracts
3. POST /api/abstracts/:id/assign-editor — RBAC + REASSIGNMENT
4. LIGHT REGRESSION
"""

import requests
import json
import sys

BASE_URL = "https://scms-platform-1.preview.emergentagent.com/api"

# Test credentials (all password: password123)
CREDENTIALS = {
    "admin": {"email": "admin@scms.io", "password": "password123"},
    "managing": {"email": "managing@scms.io", "password": "password123"},
    "section": {"email": "section@scms.io", "password": "password123"},
    "committee": {"email": "committee@scms.io", "password": "password123"},
    "reviewer1": {"email": "reviewer1@scms.io", "password": "password123"},
    "author": {"email": "author@scms.io", "password": "password123"},
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

def test_author_search():
    """Test 1: GET /api/abstracts SEARCH BY AUTHOR NAME"""
    print("\n" + "="*80)
    print("TEST 1: GET /api/abstracts SEARCH BY AUTHOR NAME")
    print("="*80)
    
    token = login(CREDENTIALS["admin"]["email"], CREDENTIALS["admin"]["password"])
    if not token:
        print("❌ Cannot proceed without admin token")
        return False
    
    headers = get_headers(token)
    all_passed = True
    
    # Test 1a: Search by author name "Anna"
    print("\n[1a] GET /api/abstracts?q=Anna")
    try:
        resp = requests.get(f"{BASE_URL}/abstracts?q=Anna", headers=headers, timeout=10)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            abstracts = data.get("abstracts", [])
            print(f"✅ Returned {len(abstracts)} abstracts")
            
            # Verify each abstract has "Anna" in authors or submittedBy or title/code
            for idx, abstract in enumerate(abstracts):
                has_anna = False
                match_reason = []
                
                # Check authors
                for author in abstract.get("authors", []):
                    if "anna" in author.get("fullName", "").lower():
                        has_anna = True
                        match_reason.append(f"author: {author.get('fullName')}")
                
                # Check submittedBy
                submitted_by = abstract.get("submittedBy", {})
                if submitted_by:
                    first = submitted_by.get("firstName", "").lower()
                    last = submitted_by.get("lastName", "").lower()
                    if "anna" in first or "anna" in last:
                        has_anna = True
                        match_reason.append(f"submittedBy: {submitted_by.get('firstName')} {submitted_by.get('lastName')}")
                
                # Check title/code
                if "anna" in abstract.get("title", "").lower() or "anna" in abstract.get("submissionCode", "").lower():
                    has_anna = True
                    match_reason.append("title/code")
                
                if has_anna:
                    print(f"  ✅ Abstract {idx+1} ({abstract.get('submissionCode')}): matches via {', '.join(match_reason)}")
                else:
                    print(f"  ❌ Abstract {idx+1} ({abstract.get('submissionCode')}): NO MATCH for 'Anna'")
                    all_passed = False
        else:
            print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    # Test 1b: Search by author name "Fischer"
    print("\n[1b] GET /api/abstracts?q=Fischer")
    try:
        resp = requests.get(f"{BASE_URL}/abstracts?q=Fischer", headers=headers, timeout=10)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            abstracts = data.get("abstracts", [])
            print(f"✅ Returned {len(abstracts)} abstracts")
            
            for idx, abstract in enumerate(abstracts):
                has_fischer = False
                match_reason = []
                
                for author in abstract.get("authors", []):
                    if "fischer" in author.get("fullName", "").lower():
                        has_fischer = True
                        match_reason.append(f"author: {author.get('fullName')}")
                
                submitted_by = abstract.get("submittedBy", {})
                if submitted_by:
                    first = submitted_by.get("firstName", "").lower()
                    last = submitted_by.get("lastName", "").lower()
                    if "fischer" in first or "fischer" in last:
                        has_fischer = True
                        match_reason.append(f"submittedBy: {submitted_by.get('firstName')} {submitted_by.get('lastName')}")
                
                if "fischer" in abstract.get("title", "").lower() or "fischer" in abstract.get("submissionCode", "").lower():
                    has_fischer = True
                    match_reason.append("title/code")
                
                if has_fischer:
                    print(f"  ✅ Abstract {idx+1} ({abstract.get('submissionCode')}): matches via {', '.join(match_reason)}")
                else:
                    print(f"  ❌ Abstract {idx+1} ({abstract.get('submissionCode')}): NO MATCH for 'Fischer'")
                    all_passed = False
        else:
            print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    # Test 1c: Search with no results
    print("\n[1c] GET /api/abstracts?q=zzznoresult")
    try:
        resp = requests.get(f"{BASE_URL}/abstracts?q=zzznoresult", headers=headers, timeout=10)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            abstracts = data.get("abstracts", [])
            if len(abstracts) == 0:
                print(f"✅ Returned empty list as expected")
            else:
                print(f"❌ Expected empty list, got {len(abstracts)} abstracts")
                all_passed = False
        else:
            print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    # Test 1d: No query parameter
    print("\n[1d] GET /api/abstracts (no q parameter)")
    try:
        resp = requests.get(f"{BASE_URL}/abstracts", headers=headers, timeout=10)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            abstracts = data.get("abstracts", [])
            print(f"✅ Returned {len(abstracts)} abstracts (full list)")
        else:
            print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    return all_passed

def test_technical_score_aggregation():
    """Test 2: TECHNICAL SCORE AGGREGATION ON /api/abstracts"""
    print("\n" + "="*80)
    print("TEST 2: TECHNICAL SCORE AGGREGATION ON /api/abstracts")
    print("="*80)
    
    token = login(CREDENTIALS["admin"]["email"], CREDENTIALS["admin"]["password"])
    if not token:
        print("❌ Cannot proceed without admin token")
        return False
    
    headers = get_headers(token)
    all_passed = True
    
    print("\n[2a] GET /api/abstracts - Check technicalScoreAverage and technicalScoreCount fields")
    try:
        resp = requests.get(f"{BASE_URL}/abstracts", headers=headers, timeout=10)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            abstracts = data.get("abstracts", [])
            print(f"✅ Returned {len(abstracts)} abstracts")
            
            if len(abstracts) == 0:
                print("⚠️  No abstracts to check")
                return True
            
            # Check every abstract has the required fields
            for idx, abstract in enumerate(abstracts):
                code = abstract.get("submissionCode", "N/A")
                has_avg = "technicalScoreAverage" in abstract
                has_count = "technicalScoreCount" in abstract
                
                avg_val = abstract.get("technicalScoreAverage")
                count_val = abstract.get("technicalScoreCount")
                
                if has_avg and has_count:
                    # Validate types
                    if count_val is not None and not isinstance(count_val, int):
                        print(f"  ❌ Abstract {idx+1} ({code}): technicalScoreCount is not an integer: {count_val}")
                        all_passed = False
                    elif count_val is not None and count_val < 0:
                        print(f"  ❌ Abstract {idx+1} ({code}): technicalScoreCount is negative: {count_val}")
                        all_passed = False
                    elif avg_val is not None and not isinstance(avg_val, (int, float)):
                        print(f"  ❌ Abstract {idx+1} ({code}): technicalScoreAverage is not a number: {avg_val}")
                        all_passed = False
                    else:
                        print(f"  ✅ Abstract {idx+1} ({code}): technicalScoreAverage={avg_val}, technicalScoreCount={count_val}")
                else:
                    missing = []
                    if not has_avg:
                        missing.append("technicalScoreAverage")
                    if not has_count:
                        missing.append("technicalScoreCount")
                    print(f"  ❌ Abstract {idx+1} ({code}): Missing fields: {', '.join(missing)}")
                    all_passed = False
            
            # Find at least one abstract with scores > 0 to verify calculation
            found_scored = False
            for abstract in abstracts:
                if abstract.get("technicalScoreCount", 0) > 0:
                    found_scored = True
                    code = abstract.get("submissionCode")
                    avg = abstract.get("technicalScoreAverage")
                    count = abstract.get("technicalScoreCount")
                    print(f"\n  ℹ️  Found scored abstract: {code} with avg={avg}, count={count}")
                    print(f"     (Average should be mean of 5 category scores from TechnicalScore table)")
                    break
            
            if not found_scored:
                print("\n  ℹ️  No abstracts have technical scores yet (all have count=0, avg=null)")
        else:
            print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    return all_passed

def test_assign_editor_rbac_reassignment():
    """Test 3: POST /api/abstracts/:id/assign-editor — RBAC + REASSIGNMENT"""
    print("\n" + "="*80)
    print("TEST 3: POST /api/abstracts/:id/assign-editor — RBAC + REASSIGNMENT")
    print("="*80)
    
    # First, get an abstract ID and user IDs
    admin_token = login(CREDENTIALS["admin"]["email"], CREDENTIALS["admin"]["password"])
    if not admin_token:
        print("❌ Cannot proceed without admin token")
        return False
    
    headers = get_headers(admin_token)
    all_passed = True
    
    # Get abstracts
    print("\n[Setup] Getting abstracts and users...")
    try:
        resp = requests.get(f"{BASE_URL}/abstracts", headers=headers, timeout=10)
        if resp.status_code != 200:
            print(f"❌ Failed to get abstracts: {resp.status_code}")
            return False
        abstracts = resp.json().get("abstracts", [])
        if len(abstracts) == 0:
            print("❌ No abstracts available for testing")
            return False
        
        # Pick first abstract
        test_abstract = abstracts[0]
        abstract_id = test_abstract["id"]
        abstract_code = test_abstract.get("submissionCode", "N/A")
        print(f"✅ Using abstract: {abstract_code} (ID: {abstract_id})")
        
        # Get users with committee/editor roles
        resp = requests.get(f"{BASE_URL}/users", headers=headers, timeout=10)
        if resp.status_code != 200:
            print(f"❌ Failed to get users: {resp.status_code}")
            return False
        users = resp.json().get("users", [])
        
        # Find committee@scms.io and section@scms.io
        committee_user = None
        section_user = None
        for u in users:
            if u["email"] == "committee@scms.io":
                committee_user = u
            elif u["email"] == "section@scms.io":
                section_user = u
        
        if not committee_user:
            print("❌ committee@scms.io user not found")
            return False
        if not section_user:
            print("❌ section@scms.io user not found")
            return False
        
        print(f"✅ Found committee user: {committee_user['email']} (ID: {committee_user['id']})")
        print(f"✅ Found section user: {section_user['email']} (ID: {section_user['id']})")
        
    except Exception as e:
        print(f"❌ Setup exception: {e}")
        return False
    
    # Test 3a: Assign editor as admin
    print(f"\n[3a] POST /api/abstracts/{abstract_id}/assign-editor as admin@scms.io")
    try:
        payload = {"editorId": committee_user["id"], "role": "COMMITTEE_EDITOR"}
        resp = requests.post(f"{BASE_URL}/abstracts/{abstract_id}/assign-editor", 
                           headers=headers, json=payload, timeout=10)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            assignment = data.get("assignment", {})
            print(f"✅ Assignment created: {assignment.get('id')}")
            
            # Verify the abstract now has this assignment
            resp2 = requests.get(f"{BASE_URL}/abstracts/{abstract_id}", headers=headers, timeout=10)
            if resp2.status_code == 200:
                abstract = resp2.json().get("abstract", {})
                editor_assignments = abstract.get("editorAssignments", [])
                active_assignments = [a for a in editor_assignments if a.get("active", False)]
                
                if len(active_assignments) == 1:
                    assigned_editor = active_assignments[0].get("editor", {})
                    if assigned_editor.get("id") == committee_user["id"]:
                        print(f"✅ Verified: Exactly ONE active assignment to {assigned_editor.get('email')}")
                    else:
                        print(f"❌ Active assignment is to wrong editor: {assigned_editor.get('email')}")
                        all_passed = False
                else:
                    print(f"❌ Expected 1 active assignment, found {len(active_assignments)}")
                    all_passed = False
            else:
                print(f"❌ Failed to verify assignment: {resp2.status_code}")
                all_passed = False
        else:
            print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    # Test 3b: Reassign to different editor (test deactivation of previous)
    print(f"\n[3b] POST /api/abstracts/{abstract_id}/assign-editor again (reassignment to section@scms.io)")
    try:
        payload = {"editorId": section_user["id"], "role": "SECTION_EDITOR"}
        resp = requests.post(f"{BASE_URL}/abstracts/{abstract_id}/assign-editor", 
                           headers=headers, json=payload, timeout=10)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"✅ Reassignment created")
            
            # Verify: previous assignment should be inactive, new one active
            resp2 = requests.get(f"{BASE_URL}/abstracts/{abstract_id}", headers=headers, timeout=10)
            if resp2.status_code == 200:
                abstract = resp2.json().get("abstract", {})
                editor_assignments = abstract.get("editorAssignments", [])
                active_assignments = [a for a in editor_assignments if a.get("active", False)]
                inactive_assignments = [a for a in editor_assignments if not a.get("active", False)]
                
                if len(active_assignments) == 1:
                    assigned_editor = active_assignments[0].get("editor", {})
                    if assigned_editor.get("id") == section_user["id"]:
                        print(f"✅ Verified: New active assignment to {assigned_editor.get('email')}")
                    else:
                        print(f"❌ Active assignment is to wrong editor: {assigned_editor.get('email')}")
                        all_passed = False
                    
                    # Check that previous assignment is now inactive
                    if len(inactive_assignments) >= 1:
                        prev_inactive = [a for a in inactive_assignments if a.get("editor", {}).get("id") == committee_user["id"]]
                        if len(prev_inactive) > 0:
                            print(f"✅ Verified: Previous assignment to {committee_user['email']} is now inactive")
                        else:
                            print(f"⚠️  Previous assignment to {committee_user['email']} not found in inactive list")
                    else:
                        print(f"⚠️  No inactive assignments found (expected at least 1)")
                else:
                    print(f"❌ Expected 1 active assignment, found {len(active_assignments)}")
                    all_passed = False
            else:
                print(f"❌ Failed to verify reassignment: {resp2.status_code}")
                all_passed = False
        else:
            print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    # Test 3c: RBAC - author should get 403
    print(f"\n[3c] POST /api/abstracts/{abstract_id}/assign-editor as author@scms.io (expect 403)")
    try:
        author_token = login(CREDENTIALS["author"]["email"], CREDENTIALS["author"]["password"])
        if not author_token:
            print("❌ Failed to login as author")
            all_passed = False
        else:
            author_headers = get_headers(author_token)
            payload = {"editorId": committee_user["id"], "role": "COMMITTEE_EDITOR"}
            resp = requests.post(f"{BASE_URL}/abstracts/{abstract_id}/assign-editor", 
                               headers=author_headers, json=payload, timeout=10)
            print(f"Status: {resp.status_code}")
            if resp.status_code == 403:
                print(f"✅ Correctly denied with 403")
            else:
                print(f"❌ Expected 403, got {resp.status_code}: {resp.text}")
                all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    # Test 3d: RBAC - managing editor should be allowed
    print(f"\n[3d] POST /api/abstracts/{abstract_id}/assign-editor as managing@scms.io (expect 200)")
    try:
        managing_token = login(CREDENTIALS["managing"]["email"], CREDENTIALS["managing"]["password"])
        if not managing_token:
            print("❌ Failed to login as managing editor")
            all_passed = False
        else:
            managing_headers = get_headers(managing_token)
            payload = {"editorId": committee_user["id"], "role": "COMMITTEE_EDITOR"}
            resp = requests.post(f"{BASE_URL}/abstracts/{abstract_id}/assign-editor", 
                               headers=managing_headers, json=payload, timeout=10)
            print(f"Status: {resp.status_code}")
            if resp.status_code == 200:
                print(f"✅ Managing editor allowed (200)")
            else:
                print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
                all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    # Test 3e: RBAC - CHIEF_EDITOR should be allowed (section@scms.io has CHIEF_EDITOR role)
    print(f"\n[3e] POST /api/abstracts/{abstract_id}/assign-editor as section@scms.io (CHIEF_EDITOR, expect 200)")
    try:
        section_token = login(CREDENTIALS["section"]["email"], CREDENTIALS["section"]["password"])
        if not section_token:
            print("❌ Failed to login as section editor")
            all_passed = False
        else:
            section_headers = get_headers(section_token)
            payload = {"editorId": committee_user["id"], "role": "COMMITTEE_EDITOR"}
            resp = requests.post(f"{BASE_URL}/abstracts/{abstract_id}/assign-editor", 
                               headers=section_headers, json=payload, timeout=10)
            print(f"Status: {resp.status_code}")
            if resp.status_code == 200:
                print(f"✅ CHIEF_EDITOR allowed (200)")
            else:
                print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
                all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    return all_passed

def test_light_regression():
    """Test 4: LIGHT REGRESSION"""
    print("\n" + "="*80)
    print("TEST 4: LIGHT REGRESSION")
    print("="*80)
    
    all_passed = True
    
    # Test 4a: GET /api/abstracts?scope=mine as author
    print("\n[4a] GET /api/abstracts?scope=mine as author@scms.io")
    try:
        author_token = login(CREDENTIALS["author"]["email"], CREDENTIALS["author"]["password"])
        if not author_token:
            print("❌ Failed to login as author")
            all_passed = False
        else:
            headers = get_headers(author_token)
            resp = requests.get(f"{BASE_URL}/abstracts?scope=mine", headers=headers, timeout=10)
            print(f"Status: {resp.status_code}")
            if resp.status_code == 200:
                data = resp.json()
                abstracts = data.get("abstracts", [])
                print(f"✅ Returned {len(abstracts)} abstracts (author's own)")
            else:
                print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
                all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    # Test 4b: GET /api/abstracts?scope=assigned as reviewer
    print("\n[4b] GET /api/abstracts?scope=assigned as reviewer1@scms.io")
    try:
        reviewer_token = login(CREDENTIALS["reviewer1"]["email"], CREDENTIALS["reviewer1"]["password"])
        if not reviewer_token:
            print("❌ Failed to login as reviewer")
            all_passed = False
        else:
            headers = get_headers(reviewer_token)
            resp = requests.get(f"{BASE_URL}/abstracts?scope=assigned", headers=headers, timeout=10)
            print(f"Status: {resp.status_code}")
            if resp.status_code == 200:
                data = resp.json()
                abstracts = data.get("abstracts", [])
                print(f"✅ Returned {len(abstracts)} abstracts (assigned to reviewer)")
            else:
                print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
                all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    # Test 4c: POST /api/auth/login for admin
    print("\n[4c] POST /api/auth/login for admin@scms.io")
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", 
                           json={"email": CREDENTIALS["admin"]["email"], "password": CREDENTIALS["admin"]["password"]}, 
                           timeout=10)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            token = data.get("token")
            if token and token.startswith("eyJ"):
                print(f"✅ Login successful, JWT token received (starts with 'eyJ')")
            else:
                print(f"❌ Token format unexpected: {token[:20] if token else 'None'}")
                all_passed = False
        else:
            print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Exception: {e}")
        all_passed = False
    
    # Test 4d: GET /api/notifications for admin
    print("\n[4d] GET /api/notifications for admin@scms.io")
    try:
        admin_token = login(CREDENTIALS["admin"]["email"], CREDENTIALS["admin"]["password"])
        if not admin_token:
            print("❌ Failed to login as admin")
            all_passed = False
        else:
            headers = get_headers(admin_token)
            resp = requests.get(f"{BASE_URL}/notifications", headers=headers, timeout=10)
            print(f"Status: {resp.status_code}")
            if resp.status_code == 200:
                data = resp.json()
                notifications = data.get("notifications", [])
                print(f"✅ Returned {len(notifications)} notifications")
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
    print("SCMS BACKEND API TESTS - Editorial Office Enhancements")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Testing 4 specific changes:")
    print("  1. GET /api/abstracts SEARCH BY AUTHOR NAME")
    print("  2. TECHNICAL SCORE AGGREGATION ON /api/abstracts")
    print("  3. POST /api/abstracts/:id/assign-editor — RBAC + REASSIGNMENT")
    print("  4. LIGHT REGRESSION")
    
    results = {}
    
    # Run tests
    results["test1_author_search"] = test_author_search()
    results["test2_technical_scores"] = test_technical_score_aggregation()
    results["test3_assign_editor"] = test_assign_editor_rbac_reassignment()
    results["test4_regression"] = test_light_regression()
    
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
