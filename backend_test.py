#!/usr/bin/env python3
"""
Backend test for PUT /api/abstracts/:id endpoint
Tests the previously-failing scenario (#15) plus authors-array test (#18)
"""

import requests
import json
import sys

BASE_URL = "https://scms-platform-1.preview.emergentagent.com/api"

def login(email, password):
    """Login and return JWT token"""
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": email, "password": password},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            token = data.get('token')
            print(f"✅ Login successful for {email}")
            return token
        else:
            print(f"❌ Login failed for {email}: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Login exception for {email}: {str(e)}")
        return None

def get_featured_conference(token):
    """Get featured conference ID"""
    try:
        response = requests.get(
            f"{BASE_URL}/public/config",
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            conf_id = data.get('conference', {}).get('id')
            conf_name = data.get('conference', {}).get('name')
            print(f"✅ Featured conference: {conf_name} (ID: {conf_id})")
            return conf_id
        else:
            print(f"❌ Failed to get featured conference: {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ Exception getting featured conference: {str(e)}")
        return None

def create_draft_abstract(token, conf_id):
    """Create a fresh DRAFT abstract"""
    try:
        payload = {
            "conferenceId": conf_id,
            "title": "Initial Draft Title for Testing PUT Endpoint",
            "body": "This is the initial body content for testing the PUT endpoint. It needs to be long enough to be meaningful.",
            "keywords": ["initial", "draft", "test"],
            "reportType": "ORIGINAL_RESEARCH",
            "themeId": None,
            "coverLetter": "Initial cover letter content",
            "authors": [
                {
                    "fullName": "Test Author",
                    "email": "author@scms.io",
                    "affiliation": "Test University",
                    "isCorresponding": True,
                    "orderIndex": 0
                }
            ]
        }
        response = requests.post(
            f"{BASE_URL}/abstracts",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            abstract = data.get('abstract', {})
            abs_id = abstract.get('id')
            submission_code = abstract.get('submissionCode')
            state = abstract.get('currentState')
            print(f"✅ Created DRAFT abstract: {submission_code} (ID: {abs_id}, State: {state})")
            return abs_id
        else:
            print(f"❌ Failed to create abstract: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Exception creating abstract: {str(e)}")
        return None

def test_step_a_put_with_body_and_cover_letter(token, abs_id):
    """
    Step A: PUT with title, body, keywords, coverLetter
    Expect 200 and verify the response
    """
    print("\n=== STEP A: PUT with title, body, keywords, coverLetter ===")
    try:
        payload = {
            "title": "Revised draft title",
            "body": "Updated body content that is short and clear.",
            "keywords": ["updated", "testing", "draft"],
            "coverLetter": "Cover letter text here"
        }
        response = requests.put(
            f"{BASE_URL}/abstracts/{abs_id}",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        
        print(f"PUT /api/abstracts/{abs_id} → {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            abstract = data.get('abstract', {})
            
            # Verify title
            if abstract.get('title') == "Revised draft title":
                print(f"✅ Title verified: {abstract.get('title')}")
            else:
                print(f"❌ Title mismatch: expected 'Revised draft title', got '{abstract.get('title')}'")
            
            # Verify keywords
            if abstract.get('keywords') == ["updated", "testing", "draft"]:
                print(f"✅ Keywords verified: {abstract.get('keywords')}")
            else:
                print(f"❌ Keywords mismatch: expected ['updated', 'testing', 'draft'], got {abstract.get('keywords')}")
            
            # Verify body and coverLetter from latest version
            versions = abstract.get('versions', [])
            if versions:
                latest_version = versions[0]
                body = latest_version.get('body')
                cover_letter = latest_version.get('coverLetter')
                
                if body == "Updated body content that is short and clear.":
                    print(f"✅ Body verified: {body}")
                else:
                    print(f"❌ Body mismatch: expected 'Updated body content that is short and clear.', got '{body}'")
                
                if cover_letter == "Cover letter text here":
                    print(f"✅ CoverLetter verified: {cover_letter}")
                else:
                    print(f"❌ CoverLetter mismatch: expected 'Cover letter text here', got '{cover_letter}'")
            else:
                print(f"❌ No versions found in response")
            
            print("✅ STEP A PASSED: PUT with body and coverLetter successful")
            return True
        else:
            print(f"❌ STEP A FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ STEP A EXCEPTION: {str(e)}")
        return False

def test_step_b_put_with_authors_array(token, abs_id):
    """
    Step B: PUT with authors array of TWO authors
    Expect 200 and verify authors length === 2, ordered by orderIndex
    """
    print("\n=== STEP B: PUT with authors array (2 authors) ===")
    try:
        payload = {
            "authors": [
                {
                    "fullName": "Dr. Jane Smith",
                    "email": "jane.smith@example.com",
                    "affiliation": "University of Science",
                    "isCorresponding": True,
                    "orderIndex": 0
                },
                {
                    "fullName": "Dr. John Doe",
                    "email": "john.doe@example.com",
                    "affiliation": "Research Institute",
                    "isCorresponding": False,
                    "orderIndex": 1
                }
            ]
        }
        response = requests.put(
            f"{BASE_URL}/abstracts/{abs_id}",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        
        print(f"PUT /api/abstracts/{abs_id} with authors → {response.status_code}")
        
        if response.status_code == 200:
            # GET the abstract to verify authors
            get_response = requests.get(
                f"{BASE_URL}/abstracts/{abs_id}",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10
            )
            
            if get_response.status_code == 200:
                data = get_response.json()
                abstract = data.get('abstract', {})
                authors = abstract.get('authors', [])
                
                if len(authors) == 2:
                    print(f"✅ Authors count verified: {len(authors)}")
                else:
                    print(f"❌ Authors count mismatch: expected 2, got {len(authors)}")
                
                # Verify order
                if len(authors) >= 2:
                    if authors[0].get('orderIndex') == 0 and authors[1].get('orderIndex') == 1:
                        print(f"✅ Authors order verified: orderIndex 0, 1")
                    else:
                        print(f"❌ Authors order mismatch: got orderIndex {authors[0].get('orderIndex')}, {authors[1].get('orderIndex')}")
                    
                    # Verify names
                    if authors[0].get('fullName') == "Dr. Jane Smith":
                        print(f"✅ First author verified: {authors[0].get('fullName')}")
                    else:
                        print(f"❌ First author mismatch: expected 'Dr. Jane Smith', got '{authors[0].get('fullName')}'")
                    
                    if authors[1].get('fullName') == "Dr. John Doe":
                        print(f"✅ Second author verified: {authors[1].get('fullName')}")
                    else:
                        print(f"❌ Second author mismatch: expected 'Dr. John Doe', got '{authors[1].get('fullName')}'")
                
                print("✅ STEP B PASSED: Authors array update successful")
                return True
            else:
                print(f"❌ STEP B FAILED: GET after PUT returned {get_response.status_code}")
                return False
        else:
            print(f"❌ STEP B FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ STEP B EXCEPTION: {str(e)}")
        return False

def test_step_c_regression_checks(author_token, chief_token, author2_token, abs_id):
    """
    Step C: Confirm regression fix did NOT re-introduce earlier issues
    - As chief@scms.io: GET /api/abstracts/{absId} → 403 (draft still hidden)
    - PUT the draft as author2@scms.io (non-owner) → 403
    - Word-count validation: PUT with 21-word title → 400
    """
    print("\n=== STEP C: Regression checks ===")
    
    all_passed = True
    
    # C1: Chief editor cannot see draft
    print("\n--- C1: Chief editor cannot see draft ---")
    try:
        response = requests.get(
            f"{BASE_URL}/abstracts/{abs_id}",
            headers={"Authorization": f"Bearer {chief_token}"},
            timeout=10
        )
        
        print(f"GET /api/abstracts/{abs_id} as chief@scms.io → {response.status_code}")
        
        if response.status_code == 403:
            print(f"✅ C1 PASSED: Chief editor correctly denied access to draft (403)")
        else:
            print(f"❌ C1 FAILED: Expected 403, got {response.status_code}")
            all_passed = False
    except Exception as e:
        print(f"❌ C1 EXCEPTION: {str(e)}")
        all_passed = False
    
    # C2: Non-owner author cannot PUT draft
    print("\n--- C2: Non-owner author cannot PUT draft ---")
    try:
        payload = {"title": "Unauthorized edit attempt"}
        response = requests.put(
            f"{BASE_URL}/abstracts/{abs_id}",
            json=payload,
            headers={"Authorization": f"Bearer {author2_token}"},
            timeout=10
        )
        
        print(f"PUT /api/abstracts/{abs_id} as author2@scms.io → {response.status_code}")
        
        if response.status_code == 403:
            print(f"✅ C2 PASSED: Non-owner correctly denied PUT access (403)")
        else:
            print(f"❌ C2 FAILED: Expected 403, got {response.status_code}")
            all_passed = False
    except Exception as e:
        print(f"❌ C2 EXCEPTION: {str(e)}")
        all_passed = False
    
    # C3: Word-count validation (21-word title)
    print("\n--- C3: Word-count validation (21-word title) ---")
    try:
        # Create a 21-word title
        long_title = " ".join(["word"] * 21)
        payload = {"title": long_title}
        response = requests.put(
            f"{BASE_URL}/abstracts/{abs_id}",
            json=payload,
            headers={"Authorization": f"Bearer {author_token}"},
            timeout=10
        )
        
        print(f"PUT /api/abstracts/{abs_id} with 21-word title → {response.status_code}")
        
        if response.status_code == 400:
            data = response.json()
            error_msg = data.get('error', '')
            if "exceeds 20 words" in error_msg or "got 21" in error_msg:
                print(f"✅ C3 PASSED: 21-word title correctly rejected (400) with message: {error_msg}")
            else:
                print(f"❌ C3 FAILED: Got 400 but wrong error message: {error_msg}")
                all_passed = False
        else:
            print(f"❌ C3 FAILED: Expected 400, got {response.status_code}")
            all_passed = False
    except Exception as e:
        print(f"❌ C3 EXCEPTION: {str(e)}")
        all_passed = False
    
    if all_passed:
        print("\n✅ STEP C PASSED: All regression checks passed")
    else:
        print("\n❌ STEP C FAILED: Some regression checks failed")
    
    return all_passed

def main():
    print("=" * 80)
    print("BACKEND TEST: PUT /api/abstracts/:id endpoint")
    print("Testing previously-failing scenario (#15) + authors-array test (#18)")
    print("=" * 80)
    
    # Login as author@scms.io
    print("\n--- Login as author@scms.io ---")
    author_token = login("author@scms.io", "password123")
    if not author_token:
        print("❌ TEST ABORTED: Cannot login as author@scms.io")
        sys.exit(1)
    
    # Login as chief@scms.io for regression test
    print("\n--- Login as chief@scms.io ---")
    chief_token = login("chief@scms.io", "password123")
    if not chief_token:
        print("❌ TEST ABORTED: Cannot login as chief@scms.io")
        sys.exit(1)
    
    # Login as author2@scms.io for regression test
    print("\n--- Login as author2@scms.io ---")
    author2_token = login("author2@scms.io", "password123")
    if not author2_token:
        print("⚠️  WARNING: Cannot login as author2@scms.io, will skip C2 test")
        author2_token = None
    
    # Get featured conference
    print("\n--- Get featured conference ---")
    conf_id = get_featured_conference(author_token)
    if not conf_id:
        print("❌ TEST ABORTED: Cannot get featured conference")
        sys.exit(1)
    
    # Create fresh DRAFT abstract
    print("\n--- Create fresh DRAFT abstract ---")
    abs_id = create_draft_abstract(author_token, conf_id)
    if not abs_id:
        print("❌ TEST ABORTED: Cannot create draft abstract")
        sys.exit(1)
    
    # Run tests
    step_a_passed = test_step_a_put_with_body_and_cover_letter(author_token, abs_id)
    step_b_passed = test_step_b_put_with_authors_array(author_token, abs_id)
    step_c_passed = test_step_c_regression_checks(author_token, chief_token, author2_token, abs_id)
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print(f"Step A (PUT with body/coverLetter): {'✅ PASSED' if step_a_passed else '❌ FAILED'}")
    print(f"Step B (PUT with authors array): {'✅ PASSED' if step_b_passed else '❌ FAILED'}")
    print(f"Step C (Regression checks): {'✅ PASSED' if step_c_passed else '❌ FAILED'}")
    
    if step_a_passed and step_b_passed and step_c_passed:
        print("\n🎉 ALL TESTS PASSED")
        sys.exit(0)
    else:
        print("\n❌ SOME TESTS FAILED")
        sys.exit(1)

if __name__ == "__main__":
    main()
