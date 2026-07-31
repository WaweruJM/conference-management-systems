#!/usr/bin/env python3
"""
Backend test for DRAFT abstract visibility + new PUT endpoint.

Tests:
- Change 1: DRAFT visibility gate on GET /api/abstracts (list) and GET /api/abstracts/:id (detail)
- Change 2: New PUT /api/abstracts/:id endpoint for editing existing draft
- Regression: Existing flows still work (POST /api/abstracts, POST /api/abstracts/:id/submit)
"""

import requests
import sys

BASE_URL = "https://scms-platform-1.preview.emergentagent.com/api"

# Test users (all with password "password123")
USERS = {
    "author": "author@scms.io",
    "author2": "author2@scms.io",
    "chief": "chief@scms.io",
    "committee": "committee@scms.io",
    "reviewer1": "reviewer1@scms.io",
    "admin": "admin@scms.io",
}

def login(email, password="password123"):
    """Login and return JWT token"""
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
        if resp.status_code == 200:
            data = resp.json()
            token = data.get("token")
            print(f"✅ Login successful for {email}")
            return token
        else:
            print(f"❌ Login failed for {email}: {resp.status_code} - {resp.text}")
            return None
    except Exception as e:
        print(f"❌ Login exception for {email}: {str(e)}")
        return None

def get_featured_conference():
    """Get featured conference ID and first theme ID"""
    try:
        resp = requests.get(f"{BASE_URL}/public/config")
        if resp.status_code == 200:
            data = resp.json()
            conf = data.get("conference", {})
            conf_id = conf.get("id")
            themes = conf.get("themes", [])
            theme_id = themes[0]["id"] if themes else None
            print(f"✅ Featured conference: {conf.get('name')} (ID: {conf_id})")
            print(f"   First theme ID: {theme_id}")
            return conf_id, theme_id
        else:
            print(f"❌ Failed to get featured conference: {resp.status_code}")
            return None, None
    except Exception as e:
        print(f"❌ Exception getting featured conference: {str(e)}")
        return None, None

def test_draft_visibility_and_put():
    """Test DRAFT abstract visibility + PUT endpoint"""
    print("\n" + "="*80)
    print("DRAFT ABSTRACT VISIBILITY + PUT ENDPOINT TEST")
    print("="*80)
    
    all_passed = True
    
    # Get featured conference and theme
    conf_id, theme_id = get_featured_conference()
    if not conf_id or not theme_id:
        print("❌ Cannot proceed without conference ID and theme ID")
        return False
    
    # Login all users
    tokens = {}
    for role, email in USERS.items():
        token = login(email)
        if not token:
            print(f"❌ Cannot proceed without {role} token")
            return False
        tokens[role] = token
    
    # Step 1: Login as author@scms.io and create a DRAFT abstract
    print("\n--- Step 1: Create DRAFT abstract as author@scms.io ---")
    headers_author = {"Authorization": f"Bearer {tokens['author']}"}
    try:
        payload = {
            "conferenceId": conf_id,
            "title": "Draft visibility test",
            "body": "short body",
            "keywords": ["a", "b", "c"],
            "reportType": "ORIGINAL_RESEARCH",
            "themeId": theme_id,
            "authors": [{
                "fullName": "Author One",
                "email": "author@scms.io",
                "affiliation": "Test",
                "isCorresponding": True,
                "phone": "1234567890",
                "orderIndex": 0
            }]
        }
        resp = requests.post(f"{BASE_URL}/abstracts", headers=headers_author, json=payload)
        if resp.status_code == 200:
            data = resp.json()
            abstract = data.get("abstract", {})
            abs_id = abstract.get("id")
            submission_code = abstract.get("submissionCode")
            current_state = abstract.get("currentState")
            print(f"✅ Step 1 PASSED: Created abstract")
            print(f"   ID: {abs_id}")
            print(f"   Submission Code: {submission_code}")
            print(f"   Current State: {current_state}")
            if current_state != "DRAFT":
                print(f"❌ Step 1 WARNING: Expected currentState=DRAFT, got {current_state}")
                all_passed = False
        else:
            print(f"❌ Step 1 FAILED: POST /abstracts returned {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        print(f"❌ Step 1 FAILED: Exception: {str(e)}")
        return False
    
    # Step 2: As author@scms.io: GET /api/abstracts?scope=mine — verify absId is present
    print("\n--- Step 2: GET /api/abstracts?scope=mine as author@scms.io ---")
    try:
        resp = requests.get(f"{BASE_URL}/abstracts?scope=mine", headers=headers_author)
        if resp.status_code == 200:
            data = resp.json()
            abstracts = data.get("abstracts", [])
            found = any(a.get("id") == abs_id for a in abstracts)
            if found:
                draft_abstract = next(a for a in abstracts if a.get("id") == abs_id)
                print(f"✅ Step 2 PASSED: Draft abstract found in ?scope=mine")
                print(f"   Current State: {draft_abstract.get('currentState')}")
            else:
                print(f"❌ Step 2 FAILED: Draft abstract NOT found in ?scope=mine")
                all_passed = False
        else:
            print(f"❌ Step 2 FAILED: GET returned {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Step 2 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Step 3: As author2@scms.io: GET /api/abstracts?scope=mine — verify absId is NOT present
    print("\n--- Step 3: GET /api/abstracts?scope=mine as author2@scms.io ---")
    headers_author2 = {"Authorization": f"Bearer {tokens['author2']}"}
    try:
        resp = requests.get(f"{BASE_URL}/abstracts?scope=mine", headers=headers_author2)
        if resp.status_code == 200:
            data = resp.json()
            abstracts = data.get("abstracts", [])
            found = any(a.get("id") == abs_id for a in abstracts)
            if not found:
                print(f"✅ Step 3 PASSED: Draft abstract NOT visible to author2@scms.io")
            else:
                print(f"❌ Step 3 FAILED: Draft abstract IS visible to author2@scms.io (should not be)")
                all_passed = False
        else:
            print(f"❌ Step 3 FAILED: GET returned {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Step 3 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Step 4: As chief@scms.io: GET /api/abstracts (default) → draft must NOT be in results
    print("\n--- Step 4: GET /api/abstracts (default) as chief@scms.io ---")
    headers_chief = {"Authorization": f"Bearer {tokens['chief']}"}
    try:
        resp = requests.get(f"{BASE_URL}/abstracts", headers=headers_chief)
        if resp.status_code == 200:
            data = resp.json()
            abstracts = data.get("abstracts", [])
            found = any(a.get("id") == abs_id for a in abstracts)
            if not found:
                print(f"✅ Step 4 PASSED: Draft abstract NOT visible to chief editor (default listing)")
            else:
                print(f"❌ Step 4 FAILED: Draft abstract IS visible to chief editor (should not be)")
                all_passed = False
        else:
            print(f"❌ Step 4 FAILED: GET returned {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Step 4 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Step 4b: As chief@scms.io: GET /api/abstracts?state=DRAFT → expect 403
    print("\n--- Step 4b: GET /api/abstracts?state=DRAFT as chief@scms.io (expect 403) ---")
    try:
        resp = requests.get(f"{BASE_URL}/abstracts?state=DRAFT", headers=headers_chief)
        if resp.status_code == 403:
            error_msg = resp.json().get("error", "")
            if "draft" in error_msg.lower():
                print(f"✅ Step 4b PASSED: Explicit ?state=DRAFT query returned 403")
                print(f"   Error message: {error_msg}")
            else:
                print(f"❌ Step 4b FAILED: 403 but error message doesn't mention drafts: {error_msg}")
                all_passed = False
        else:
            print(f"❌ Step 4b FAILED: Expected 403, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Step 4b FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Step 5: As committee@scms.io: same expectations as chief
    print("\n--- Step 5: GET /api/abstracts as committee@scms.io ---")
    headers_committee = {"Authorization": f"Bearer {tokens['committee']}"}
    try:
        resp = requests.get(f"{BASE_URL}/abstracts", headers=headers_committee)
        if resp.status_code == 200:
            data = resp.json()
            abstracts = data.get("abstracts", [])
            found = any(a.get("id") == abs_id for a in abstracts)
            if not found:
                print(f"✅ Step 5a PASSED: Draft abstract NOT visible to committee member (default listing)")
            else:
                print(f"❌ Step 5a FAILED: Draft abstract IS visible to committee member")
                all_passed = False
        else:
            print(f"❌ Step 5a FAILED: GET returned {resp.status_code}: {resp.text}")
            all_passed = False
        
        # Also test ?state=DRAFT
        resp2 = requests.get(f"{BASE_URL}/abstracts?state=DRAFT", headers=headers_committee)
        if resp2.status_code == 403:
            print(f"✅ Step 5b PASSED: Explicit ?state=DRAFT query returned 403 for committee")
        else:
            print(f"❌ Step 5b FAILED: Expected 403, got {resp2.status_code}")
            all_passed = False
    except Exception as e:
        print(f"❌ Step 5 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Step 6: As reviewer1@scms.io: same expectations
    print("\n--- Step 6: GET /api/abstracts as reviewer1@scms.io ---")
    headers_reviewer = {"Authorization": f"Bearer {tokens['reviewer1']}"}
    try:
        resp = requests.get(f"{BASE_URL}/abstracts", headers=headers_reviewer)
        if resp.status_code == 200:
            data = resp.json()
            abstracts = data.get("abstracts", [])
            found = any(a.get("id") == abs_id for a in abstracts)
            if not found:
                print(f"✅ Step 6a PASSED: Draft abstract NOT visible to external reviewer (default listing)")
            else:
                print(f"❌ Step 6a FAILED: Draft abstract IS visible to external reviewer")
                all_passed = False
        else:
            print(f"❌ Step 6a FAILED: GET returned {resp.status_code}: {resp.text}")
            all_passed = False
        
        # Also test ?state=DRAFT
        resp2 = requests.get(f"{BASE_URL}/abstracts?state=DRAFT", headers=headers_reviewer)
        if resp2.status_code == 403:
            print(f"✅ Step 6b PASSED: Explicit ?state=DRAFT query returned 403 for reviewer")
        else:
            print(f"❌ Step 6b FAILED: Expected 403, got {resp2.status_code}")
            all_passed = False
    except Exception as e:
        print(f"❌ Step 6 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Step 7: As admin@scms.io: GET /api/abstracts (default) — draft IS visible
    print("\n--- Step 7: GET /api/abstracts as admin@scms.io ---")
    headers_admin = {"Authorization": f"Bearer {tokens['admin']}"}
    try:
        resp = requests.get(f"{BASE_URL}/abstracts", headers=headers_admin)
        if resp.status_code == 200:
            data = resp.json()
            abstracts = data.get("abstracts", [])
            found = any(a.get("id") == abs_id for a in abstracts)
            if found:
                print(f"✅ Step 7a PASSED: Draft abstract IS visible to admin (default listing)")
            else:
                print(f"❌ Step 7a FAILED: Draft abstract NOT visible to admin (should be visible)")
                all_passed = False
        else:
            print(f"❌ Step 7a FAILED: GET returned {resp.status_code}: {resp.text}")
            all_passed = False
        
        # Also test ?state=DRAFT
        resp2 = requests.get(f"{BASE_URL}/abstracts?state=DRAFT", headers=headers_admin)
        if resp2.status_code == 200:
            data2 = resp2.json()
            abstracts2 = data2.get("abstracts", [])
            found2 = any(a.get("id") == abs_id for a in abstracts2)
            if found2:
                print(f"✅ Step 7b PASSED: Admin can filter to ?state=DRAFT (200)")
            else:
                print(f"❌ Step 7b FAILED: Admin ?state=DRAFT query didn't return the draft")
                all_passed = False
        else:
            print(f"❌ Step 7b FAILED: Expected 200, got {resp2.status_code}")
            all_passed = False
    except Exception as e:
        print(f"❌ Step 7 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Step 8: Detail endpoint - As chief@scms.io: GET /api/abstracts/{absId} → expect 403
    print("\n--- Step 8: GET /api/abstracts/{absId} as chief@scms.io (expect 403) ---")
    try:
        resp = requests.get(f"{BASE_URL}/abstracts/{abs_id}", headers=headers_chief)
        if resp.status_code == 403:
            error_msg = resp.json().get("error", "")
            if "draft" in error_msg.lower():
                print(f"✅ Step 8 PASSED: Chief editor denied access to draft detail (403)")
                print(f"   Error message: {error_msg}")
            else:
                print(f"❌ Step 8 FAILED: 403 but error message doesn't mention draft: {error_msg}")
                all_passed = False
        else:
            print(f"❌ Step 8 FAILED: Expected 403, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Step 8 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Step 9: As committee@scms.io: same → 403
    print("\n--- Step 9: GET /api/abstracts/{absId} as committee@scms.io (expect 403) ---")
    try:
        resp = requests.get(f"{BASE_URL}/abstracts/{abs_id}", headers=headers_committee)
        if resp.status_code == 403:
            error_msg = resp.json().get("error", "")
            if "draft" in error_msg.lower():
                print(f"✅ Step 9 PASSED: Committee member denied access to draft detail (403)")
                print(f"   Error message: {error_msg}")
            else:
                print(f"❌ Step 9 FAILED: 403 but error message doesn't mention draft: {error_msg}")
                all_passed = False
        else:
            print(f"❌ Step 9 FAILED: Expected 403, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Step 9 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Step 10: As reviewer1@scms.io: same → 403
    print("\n--- Step 10: GET /api/abstracts/{absId} as reviewer1@scms.io (expect 403) ---")
    try:
        resp = requests.get(f"{BASE_URL}/abstracts/{abs_id}", headers=headers_reviewer)
        if resp.status_code == 403:
            error_msg = resp.json().get("error", "")
            if "draft" in error_msg.lower() or "forbidden" in error_msg.lower():
                print(f"✅ Step 10 PASSED: External reviewer denied access to draft detail (403)")
                print(f"   Error message: {error_msg}")
            else:
                print(f"❌ Step 10 FAILED: 403 but error message unclear: {error_msg}")
                all_passed = False
        else:
            print(f"❌ Step 10 FAILED: Expected 403, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Step 10 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Step 11: As author@scms.io (owner): GET /api/abstracts/{absId} → 200
    print("\n--- Step 11: GET /api/abstracts/{absId} as author@scms.io (owner) ---")
    try:
        resp = requests.get(f"{BASE_URL}/abstracts/{abs_id}", headers=headers_author)
        if resp.status_code == 200:
            data = resp.json()
            abstract = data.get("abstract", {})
            print(f"✅ Step 11 PASSED: Owner can access draft detail (200)")
            print(f"   Title: {abstract.get('title')}")
            print(f"   Current State: {abstract.get('currentState')}")
        else:
            print(f"❌ Step 11 FAILED: Expected 200, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Step 11 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Step 12: As admin@scms.io: GET /api/abstracts/{absId} → 200
    print("\n--- Step 12: GET /api/abstracts/{absId} as admin@scms.io ---")
    try:
        resp = requests.get(f"{BASE_URL}/abstracts/{abs_id}", headers=headers_admin)
        if resp.status_code == 200:
            data = resp.json()
            abstract = data.get("abstract", {})
            print(f"✅ Step 12 PASSED: Admin can access draft detail (200)")
            print(f"   Title: {abstract.get('title')}")
            print(f"   Current State: {abstract.get('currentState')}")
        else:
            print(f"❌ Step 12 FAILED: Expected 200, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Step 12 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Step 13: PUT /api/abstracts/:id - As author2@scms.io: expect 403
    print("\n--- Step 13: PUT /api/abstracts/{absId} as author2@scms.io (expect 403) ---")
    try:
        resp = requests.put(f"{BASE_URL}/abstracts/{abs_id}", 
                           headers=headers_author2, 
                           json={"title": "hijack"})
        if resp.status_code == 403:
            print(f"✅ Step 13 PASSED: Non-owner denied PUT access (403)")
            print(f"   Error message: {resp.json().get('error', '')}")
        else:
            print(f"❌ Step 13 FAILED: Expected 403, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Step 13 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Step 14: As chief@scms.io: same → 403
    print("\n--- Step 14: PUT /api/abstracts/{absId} as chief@scms.io (expect 403) ---")
    try:
        resp = requests.put(f"{BASE_URL}/abstracts/{abs_id}", 
                           headers=headers_chief, 
                           json={"title": "hijack"})
        if resp.status_code == 403:
            print(f"✅ Step 14 PASSED: Chief editor denied PUT access (403)")
            print(f"   Error message: {resp.json().get('error', '')}")
        else:
            print(f"❌ Step 14 FAILED: Expected 403, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Step 14 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Step 15: As author@scms.io: PUT with valid updates → expect 200
    print("\n--- Step 15: PUT /api/abstracts/{absId} with valid updates as author@scms.io ---")
    try:
        payload = {
            "title": "Revised draft title",
            "body": "Updated body content",
            "keywords": ["updated", "testing", "draft"],
            "coverLetter": "cover"
        }
        resp = requests.put(f"{BASE_URL}/abstracts/{abs_id}", 
                           headers=headers_author, 
                           json=payload)
        if resp.status_code == 200:
            data = resp.json()
            abstract = data.get("abstract", {})
            print(f"✅ Step 15a PASSED: Owner can PUT draft (200)")
            print(f"   Updated title: {abstract.get('title')}")
            print(f"   Updated keywords: {abstract.get('keywords')}")
            
            # Verify fields updated by GET
            resp2 = requests.get(f"{BASE_URL}/abstracts/{abs_id}", headers=headers_author)
            if resp2.status_code == 200:
                abstract2 = resp2.json().get("abstract", {})
                if (abstract2.get("title") == "Revised draft title" and 
                    abstract2.get("keywords") == ["updated", "testing", "draft"]):
                    print(f"✅ Step 15b PASSED: Fields verified via GET")
                else:
                    print(f"❌ Step 15b FAILED: Fields not updated correctly")
                    print(f"   Title: {abstract2.get('title')}")
                    print(f"   Keywords: {abstract2.get('keywords')}")
                    all_passed = False
        else:
            print(f"❌ Step 15 FAILED: Expected 200, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Step 15 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Step 16: As author@scms.io: PUT with overly long title (>20 words) → expect 400
    print("\n--- Step 16: PUT with overly long title (>20 words) as author@scms.io (expect 400) ---")
    try:
        long_title = " ".join(["word"] * 21)  # 21 words
        resp = requests.put(f"{BASE_URL}/abstracts/{abs_id}", 
                           headers=headers_author, 
                           json={"title": long_title})
        if resp.status_code == 400:
            error_msg = resp.json().get("error", "")
            if "20 words" in error_msg or "20" in error_msg:
                print(f"✅ Step 16 PASSED: Overly long title rejected (400)")
                print(f"   Error message: {error_msg}")
            else:
                print(f"❌ Step 16 FAILED: 400 but error message doesn't mention 20 words: {error_msg}")
                all_passed = False
        else:
            print(f"❌ Step 16 FAILED: Expected 400, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Step 16 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Step 17: As author@scms.io: PUT with overly long body (>300 words) → expect 400
    print("\n--- Step 17: PUT with overly long body (>300 words) as author@scms.io (expect 400) ---")
    try:
        long_body = " ".join(["word"] * 301)  # 301 words
        resp = requests.put(f"{BASE_URL}/abstracts/{abs_id}", 
                           headers=headers_author, 
                           json={"body": long_body})
        if resp.status_code == 400:
            error_msg = resp.json().get("error", "")
            if "300 words" in error_msg or "300" in error_msg:
                print(f"✅ Step 17 PASSED: Overly long body rejected (400)")
                print(f"   Error message: {error_msg}")
            else:
                print(f"❌ Step 17 FAILED: 400 but error message doesn't mention 300 words: {error_msg}")
                all_passed = False
        else:
            print(f"❌ Step 17 FAILED: Expected 400, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Step 17 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Step 18: As author@scms.io: PUT with authors array → expect 200
    print("\n--- Step 18: PUT with authors array as author@scms.io ---")
    try:
        payload = {
            "authors": [
                {
                    "fullName": "New Corr Author",
                    "email": "author@scms.io",
                    "isCorresponding": True,
                    "phone": "999",
                    "affiliation": "X",
                    "orderIndex": 0
                },
                {
                    "fullName": "Co Author",
                    "email": "co@x.com",
                    "isCorresponding": False,
                    "orderIndex": 1
                }
            ]
        }
        resp = requests.put(f"{BASE_URL}/abstracts/{abs_id}", 
                           headers=headers_author, 
                           json=payload)
        if resp.status_code == 200:
            print(f"✅ Step 18a PASSED: Authors array updated (200)")
            
            # Verify authors via GET
            resp2 = requests.get(f"{BASE_URL}/abstracts/{abs_id}", headers=headers_author)
            if resp2.status_code == 200:
                abstract = resp2.json().get("abstract", {})
                authors = abstract.get("authors", [])
                if len(authors) == 2:
                    print(f"✅ Step 18b PASSED: Abstract now has 2 authors")
                    print(f"   Author 1: {authors[0].get('fullName')} (corresponding: {authors[0].get('isCorresponding')})")
                    print(f"   Author 2: {authors[1].get('fullName')} (corresponding: {authors[1].get('isCorresponding')})")
                else:
                    print(f"❌ Step 18b FAILED: Expected 2 authors, got {len(authors)}")
                    all_passed = False
        else:
            print(f"❌ Step 18 FAILED: Expected 200, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Step 18 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Step 19: Submit flow - As author@scms.io: POST /api/abstracts/{absId}/submit → expect 200
    print("\n--- Step 19: POST /api/abstracts/{absId}/submit as author@scms.io ---")
    try:
        resp = requests.post(f"{BASE_URL}/abstracts/{abs_id}/submit", headers=headers_author)
        if resp.status_code == 200:
            data = resp.json()
            abstract = data.get("abstract", {})
            new_state = abstract.get("currentState")
            print(f"✅ Step 19 PASSED: Abstract submitted (200)")
            print(f"   New state: {new_state}")
            if new_state == "DRAFT":
                print(f"❌ Step 19 WARNING: State is still DRAFT (should have transitioned)")
                all_passed = False
        else:
            print(f"❌ Step 19 FAILED: Expected 200, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Step 19 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Step 20: Now abstract must be visible to editors - GET /api/abstracts as chief@scms.io
    print("\n--- Step 20: GET /api/abstracts as chief@scms.io (after submit) ---")
    try:
        resp = requests.get(f"{BASE_URL}/abstracts", headers=headers_chief)
        if resp.status_code == 200:
            data = resp.json()
            abstracts = data.get("abstracts", [])
            found = any(a.get("id") == abs_id for a in abstracts)
            if found:
                print(f"✅ Step 20 PASSED: Submitted abstract now visible to chief editor")
            else:
                print(f"❌ Step 20 FAILED: Submitted abstract NOT visible to chief editor")
                all_passed = False
        else:
            print(f"❌ Step 20 FAILED: GET returned {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Step 20 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Step 21: GET /api/abstracts/{absId} as chief@scms.io → 200
    print("\n--- Step 21: GET /api/abstracts/{absId} as chief@scms.io (after submit) ---")
    try:
        resp = requests.get(f"{BASE_URL}/abstracts/{abs_id}", headers=headers_chief)
        if resp.status_code == 200:
            data = resp.json()
            abstract = data.get("abstract", {})
            print(f"✅ Step 21 PASSED: Chief editor can access submitted abstract detail (200)")
            print(f"   Current State: {abstract.get('currentState')}")
        else:
            print(f"❌ Step 21 FAILED: Expected 200, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Step 21 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Step 22: Post-submit PUT rejected - As author@scms.io: PUT /api/abstracts/{absId} → expect 409
    print("\n--- Step 22: PUT /api/abstracts/{absId} after submit (expect 409) ---")
    try:
        resp = requests.put(f"{BASE_URL}/abstracts/{abs_id}", 
                           headers=headers_author, 
                           json={"title": "try edit"})
        if resp.status_code == 409:
            error_msg = resp.json().get("error", "")
            if "submitted" in error_msg.lower():
                print(f"✅ Step 22 PASSED: PUT after submit rejected (409)")
                print(f"   Error message: {error_msg}")
            else:
                print(f"❌ Step 22 FAILED: 409 but error message doesn't mention submission: {error_msg}")
                all_passed = False
        else:
            print(f"❌ Step 22 FAILED: Expected 409, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Step 22 FAILED: Exception: {str(e)}")
        all_passed = False
    
    return all_passed

def main():
    print("="*80)
    print("BACKEND TEST: DRAFT Abstract Visibility + PUT Endpoint")
    print("="*80)
    
    all_passed = test_draft_visibility_and_put()
    
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    if all_passed:
        print("✅ ALL TESTS PASSED")
        return 0
    else:
        print("❌ SOME TESTS FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())
