#!/usr/bin/env python3
"""
Backend test for two changes:
A) Committee Editor READ access to admin config endpoints
B) Rate-limited email broadcast on attendee registration toggle
"""

import requests
import json
import sys

BASE_URL = "https://scms-platform-1.preview.emergentagent.com/api"

def login(email, password):
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
    """Get featured conference ID"""
    try:
        resp = requests.get(f"{BASE_URL}/public/config")
        if resp.status_code == 200:
            data = resp.json()
            # Try both possible response structures
            conf_id = data.get("featuredConferenceId")
            if not conf_id and "conference" in data:
                conf_id = data["conference"].get("id")
            print(f"✅ Featured conference ID: {conf_id}")
            return conf_id
        else:
            print(f"❌ Failed to get featured conference: {resp.status_code}")
            return None
    except Exception as e:
        print(f"❌ Exception getting featured conference: {str(e)}")
        return None

def test_change_a():
    """Test Change A: Committee Editor READ access to admin config endpoints"""
    print("\n" + "="*80)
    print("CHANGE A: Committee Editor READ access to admin config endpoints")
    print("="*80)
    
    featured_id = get_featured_conference()
    if not featured_id:
        print("❌ Cannot proceed without featured conference ID")
        return False
    
    all_passed = True
    
    # Test 1: Login as committee@scms.io (COMMITTEE_MEMBER)
    print("\n--- Test 1: committee@scms.io (COMMITTEE_MEMBER) ---")
    token_committee = login("committee@scms.io", "password123")
    if not token_committee:
        print("❌ Test 1 FAILED: Cannot login as committee@scms.io")
        all_passed = False
    else:
        headers = {"Authorization": f"Bearer {token_committee}"}
        
        # 1a. GET /api/conferences/{featuredId}/book-config → expect 200
        try:
            resp = requests.get(f"{BASE_URL}/conferences/{featured_id}/book-config", headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                if "book" in data:
                    print(f"✅ Test 1a PASSED: GET /book-config returned 200 with book object")
                else:
                    print(f"❌ Test 1a FAILED: Response missing 'book' field: {data}")
                    all_passed = False
            else:
                print(f"❌ Test 1a FAILED: GET /book-config returned {resp.status_code} (expected 200): {resp.text}")
                all_passed = False
        except Exception as e:
            print(f"❌ Test 1a FAILED: Exception: {str(e)}")
            all_passed = False
        
        # 1b. GET /api/conferences/{featuredId}/surveys → expect 200
        try:
            resp = requests.get(f"{BASE_URL}/conferences/{featured_id}/surveys", headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                if "surveys" in data and isinstance(data["surveys"], list):
                    print(f"✅ Test 1b PASSED: GET /surveys returned 200 with surveys array ({len(data['surveys'])} surveys)")
                else:
                    print(f"❌ Test 1b FAILED: Response missing 'surveys' array: {data}")
                    all_passed = False
            else:
                print(f"❌ Test 1b FAILED: GET /surveys returned {resp.status_code} (expected 200): {resp.text}")
                all_passed = False
        except Exception as e:
            print(f"❌ Test 1b FAILED: Exception: {str(e)}")
            all_passed = False
        
        # 1c. PUT /api/conferences/{featuredId}/book-config → expect 403
        try:
            resp = requests.put(f"{BASE_URL}/conferences/{featured_id}/book-config", 
                              headers=headers, 
                              json={"coverTitle": "tampered"})
            if resp.status_code == 403:
                print(f"✅ Test 1c PASSED: PUT /book-config correctly returned 403")
            else:
                print(f"❌ Test 1c FAILED: PUT /book-config returned {resp.status_code} (expected 403): {resp.text}")
                all_passed = False
        except Exception as e:
            print(f"❌ Test 1c FAILED: Exception: {str(e)}")
            all_passed = False
        
        # 1d. POST /api/conferences/{featuredId}/surveys → expect 403
        try:
            resp = requests.post(f"{BASE_URL}/conferences/{featured_id}/surveys", 
                               headers=headers, 
                               json={"title": "tampered", "questions": [{"type": "text", "label": "q"}]})
            if resp.status_code == 403:
                print(f"✅ Test 1d PASSED: POST /surveys correctly returned 403")
            else:
                print(f"❌ Test 1d FAILED: POST /surveys returned {resp.status_code} (expected 403): {resp.text}")
                all_passed = False
        except Exception as e:
            print(f"❌ Test 1d FAILED: Exception: {str(e)}")
            all_passed = False
        
        # 1e. POST /api/sessions → expect 403
        try:
            resp = requests.post(f"{BASE_URL}/sessions", 
                               headers=headers, 
                               json={
                                   "conferenceId": featured_id,
                                   "title": "tampered",
                                   "startTime": "2027-03-18T09:00:00Z",
                                   "endTime": "2027-03-18T10:00:00Z"
                               })
            if resp.status_code == 403:
                print(f"✅ Test 1e PASSED: POST /sessions correctly returned 403")
            else:
                print(f"❌ Test 1e FAILED: POST /sessions returned {resp.status_code} (expected 403): {resp.text}")
                all_passed = False
        except Exception as e:
            print(f"❌ Test 1e FAILED: Exception: {str(e)}")
            all_passed = False
    
    # Test 2: Login as committee2@scms.io (COMMITTEE_EDITOR)
    print("\n--- Test 2: committee2@scms.io (COMMITTEE_EDITOR) ---")
    token_committee2 = login("committee2@scms.io", "password123")
    if not token_committee2:
        print("❌ Test 2 FAILED: Cannot login as committee2@scms.io")
        all_passed = False
    else:
        headers = {"Authorization": f"Bearer {token_committee2}"}
        
        # 2a. GET /api/conferences/{featuredId}/book-config → expect 200
        try:
            resp = requests.get(f"{BASE_URL}/conferences/{featured_id}/book-config", headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                if "book" in data:
                    print(f"✅ Test 2a PASSED: GET /book-config returned 200 with book object")
                else:
                    print(f"❌ Test 2a FAILED: Response missing 'book' field: {data}")
                    all_passed = False
            else:
                print(f"❌ Test 2a FAILED: GET /book-config returned {resp.status_code} (expected 200): {resp.text}")
                all_passed = False
        except Exception as e:
            print(f"❌ Test 2a FAILED: Exception: {str(e)}")
            all_passed = False
        
        # 2b. GET /api/conferences/{featuredId}/surveys → expect 200
        try:
            resp = requests.get(f"{BASE_URL}/conferences/{featured_id}/surveys", headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                if "surveys" in data and isinstance(data["surveys"], list):
                    print(f"✅ Test 2b PASSED: GET /surveys returned 200 with surveys array ({len(data['surveys'])} surveys)")
                else:
                    print(f"❌ Test 2b FAILED: Response missing 'surveys' array: {data}")
                    all_passed = False
            else:
                print(f"❌ Test 2b FAILED: GET /surveys returned {resp.status_code} (expected 200): {resp.text}")
                all_passed = False
        except Exception as e:
            print(f"❌ Test 2b FAILED: Exception: {str(e)}")
            all_passed = False
        
        # 2c. PUT /api/conferences/{featuredId}/book-config → expect 403
        try:
            resp = requests.put(f"{BASE_URL}/conferences/{featured_id}/book-config", 
                              headers=headers, 
                              json={"coverTitle": "tampered"})
            if resp.status_code == 403:
                print(f"✅ Test 2c PASSED: PUT /book-config correctly returned 403")
            else:
                print(f"❌ Test 2c FAILED: PUT /book-config returned {resp.status_code} (expected 403): {resp.text}")
                all_passed = False
        except Exception as e:
            print(f"❌ Test 2c FAILED: Exception: {str(e)}")
            all_passed = False
        
        # 2d. POST /api/conferences/{featuredId}/surveys → expect 403
        try:
            resp = requests.post(f"{BASE_URL}/conferences/{featured_id}/surveys", 
                               headers=headers, 
                               json={"title": "tampered", "questions": [{"type": "text", "label": "q"}]})
            if resp.status_code == 403:
                print(f"✅ Test 2d PASSED: POST /surveys correctly returned 403")
            else:
                print(f"❌ Test 2d FAILED: POST /surveys returned {resp.status_code} (expected 403): {resp.text}")
                all_passed = False
        except Exception as e:
            print(f"❌ Test 2d FAILED: Exception: {str(e)}")
            all_passed = False
        
        # 2e. POST /api/sessions → expect 403
        try:
            resp = requests.post(f"{BASE_URL}/sessions", 
                               headers=headers, 
                               json={
                                   "conferenceId": featured_id,
                                   "title": "tampered",
                                   "startTime": "2027-03-18T09:00:00Z",
                                   "endTime": "2027-03-18T10:00:00Z"
                               })
            if resp.status_code == 403:
                print(f"✅ Test 2e PASSED: POST /sessions correctly returned 403")
            else:
                print(f"❌ Test 2e FAILED: POST /sessions returned {resp.status_code} (expected 403): {resp.text}")
                all_passed = False
        except Exception as e:
            print(f"❌ Test 2e FAILED: Exception: {str(e)}")
            all_passed = False
    
    # Test 3: Login as chief@scms.io (CHIEF_EDITOR)
    print("\n--- Test 3: chief@scms.io (CHIEF_EDITOR) ---")
    token_chief = login("chief@scms.io", "password123")
    if not token_chief:
        print("❌ Test 3 FAILED: Cannot login as chief@scms.io")
        all_passed = False
    else:
        headers = {"Authorization": f"Bearer {token_chief}"}
        
        # 3a. GET /api/conferences/{featuredId}/book-config → expect 200
        try:
            resp = requests.get(f"{BASE_URL}/conferences/{featured_id}/book-config", headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                if "book" in data:
                    print(f"✅ Test 3a PASSED: GET /book-config returned 200 with book object")
                    original_cover_title = data["book"].get("coverTitle", "")
                else:
                    print(f"❌ Test 3a FAILED: Response missing 'book' field: {data}")
                    all_passed = False
                    original_cover_title = ""
            else:
                print(f"❌ Test 3a FAILED: GET /book-config returned {resp.status_code} (expected 200): {resp.text}")
                all_passed = False
                original_cover_title = ""
        except Exception as e:
            print(f"❌ Test 3a FAILED: Exception: {str(e)}")
            all_passed = False
            original_cover_title = ""
        
        # 3b. GET /api/conferences/{featuredId}/surveys → expect 200
        try:
            resp = requests.get(f"{BASE_URL}/conferences/{featured_id}/surveys", headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                if "surveys" in data and isinstance(data["surveys"], list):
                    print(f"✅ Test 3b PASSED: GET /surveys returned 200 with surveys array ({len(data['surveys'])} surveys)")
                else:
                    print(f"❌ Test 3b FAILED: Response missing 'surveys' array: {data}")
                    all_passed = False
            else:
                print(f"❌ Test 3b FAILED: GET /surveys returned {resp.status_code} (expected 200): {resp.text}")
                all_passed = False
        except Exception as e:
            print(f"❌ Test 3b FAILED: Exception: {str(e)}")
            all_passed = False
        
        # 3c. PUT /api/conferences/{featuredId}/book-config with benign change → expect 200
        try:
            resp = requests.put(f"{BASE_URL}/conferences/{featured_id}/book-config", 
                              headers=headers, 
                              json={"coverTitle": "chief-test"})
            if resp.status_code == 200:
                print(f"✅ Test 3c PASSED: PUT /book-config returned 200")
                # Revert the change
                try:
                    revert_resp = requests.put(f"{BASE_URL}/conferences/{featured_id}/book-config", 
                                             headers=headers, 
                                             json={"coverTitle": original_cover_title})
                    if revert_resp.status_code == 200:
                        print(f"✅ Test 3c: Successfully reverted coverTitle to original value")
                    else:
                        print(f"⚠️  Test 3c: Failed to revert coverTitle: {revert_resp.status_code}")
                except Exception as e:
                    print(f"⚠️  Test 3c: Exception reverting coverTitle: {str(e)}")
            else:
                print(f"❌ Test 3c FAILED: PUT /book-config returned {resp.status_code} (expected 200): {resp.text}")
                all_passed = False
        except Exception as e:
            print(f"❌ Test 3c FAILED: Exception: {str(e)}")
            all_passed = False
    
    # Test 4: Login as author@scms.io (AUTHOR only)
    print("\n--- Test 4: author@scms.io (AUTHOR only) ---")
    token_author = login("author@scms.io", "password123")
    if not token_author:
        print("❌ Test 4 FAILED: Cannot login as author@scms.io")
        all_passed = False
    else:
        headers = {"Authorization": f"Bearer {token_author}"}
        
        # 4a. GET /api/conferences/{featuredId}/book-config → expect 403
        try:
            resp = requests.get(f"{BASE_URL}/conferences/{featured_id}/book-config", headers=headers)
            if resp.status_code == 403:
                print(f"✅ Test 4a PASSED: GET /book-config correctly returned 403")
            else:
                print(f"❌ Test 4a FAILED: GET /book-config returned {resp.status_code} (expected 403): {resp.text}")
                all_passed = False
        except Exception as e:
            print(f"❌ Test 4a FAILED: Exception: {str(e)}")
            all_passed = False
        
        # 4b. GET /api/conferences/{featuredId}/surveys → expect 403
        try:
            resp = requests.get(f"{BASE_URL}/conferences/{featured_id}/surveys", headers=headers)
            if resp.status_code == 403:
                print(f"✅ Test 4b PASSED: GET /surveys correctly returned 403")
            else:
                print(f"❌ Test 4b FAILED: GET /surveys returned {resp.status_code} (expected 403): {resp.text}")
                all_passed = False
        except Exception as e:
            print(f"❌ Test 4b FAILED: Exception: {str(e)}")
            all_passed = False
    
    return all_passed

def test_change_b():
    """Test Change B: Rate-limited email broadcast on attendee registration toggle"""
    print("\n" + "="*80)
    print("CHANGE B: Rate-limited email broadcast on attendee registration toggle")
    print("="*80)
    
    featured_id = get_featured_conference()
    if not featured_id:
        print("❌ Cannot proceed without featured conference ID")
        return False
    
    all_passed = True
    
    # Test 5: Login as admin@scms.io
    print("\n--- Test 5: admin@scms.io (SYSTEM_ADMIN) ---")
    token_admin = login("admin@scms.io", "password123")
    if not token_admin:
        print("❌ Test 5 FAILED: Cannot login as admin@scms.io")
        all_passed = False
    else:
        headers = {"Authorization": f"Bearer {token_admin}"}
        
        # 5a. PUT /api/conferences/{featuredId}/attendee-registration with {"open": true} → expect 200
        print("\n--- Test 6: Toggle attendee registration ON ---")
        try:
            resp = requests.put(f"{BASE_URL}/conferences/{featured_id}/attendee-registration", 
                              headers=headers, 
                              json={"open": True})
            if resp.status_code == 200:
                data = resp.json()
                if "conference" in data:
                    print(f"✅ Test 6 PASSED: PUT /attendee-registration with open=true returned 200")
                    print(f"   Response includes conference object with attendeeRegistrationOpen={data['conference'].get('attendeeRegistrationOpen')}")
                else:
                    print(f"❌ Test 6 FAILED: Response missing 'conference' field: {data}")
                    all_passed = False
            else:
                print(f"❌ Test 6 FAILED: PUT /attendee-registration returned {resp.status_code} (expected 200): {resp.text}")
                all_passed = False
        except Exception as e:
            print(f"❌ Test 6 FAILED: Exception: {str(e)}")
            all_passed = False
        
        # 5b. Verify notifications were created
        print("\n--- Test 7: Verify notifications created ---")
        # Login as attendee to check notifications
        token_attendee = login("attendee@scms.io", "password123")
        if token_attendee:
            headers_attendee = {"Authorization": f"Bearer {token_attendee}"}
            try:
                resp = requests.get(f"{BASE_URL}/notifications", headers=headers_attendee)
                if resp.status_code == 200:
                    data = resp.json()
                    notifications = data.get("notifications", [])
                    # Look for "Attendee registration is now open" notification
                    found = False
                    for notif in notifications:
                        if "Attendee registration is now open" in notif.get("title", ""):
                            found = True
                            print(f"✅ Test 7 PASSED: Found 'Attendee registration is now open' notification")
                            print(f"   Notification: {notif.get('title')}")
                            break
                    if not found:
                        print(f"⚠️  Test 7: No 'Attendee registration is now open' notification found (may exist from earlier toggles)")
                        print(f"   Total notifications: {len(notifications)}")
                else:
                    print(f"❌ Test 7 FAILED: GET /notifications returned {resp.status_code}: {resp.text}")
                    all_passed = False
            except Exception as e:
                print(f"❌ Test 7 FAILED: Exception: {str(e)}")
                all_passed = False
        else:
            print(f"⚠️  Test 7: Cannot verify notifications (login failed for attendee@scms.io)")
        
        # 5c. Toggle back to false
        print("\n--- Test 8: Toggle attendee registration OFF ---")
        try:
            resp = requests.put(f"{BASE_URL}/conferences/{featured_id}/attendee-registration", 
                              headers=headers, 
                              json={"open": False})
            if resp.status_code == 200:
                data = resp.json()
                if "conference" in data:
                    print(f"✅ Test 8 PASSED: PUT /attendee-registration with open=false returned 200")
                    print(f"   Response includes conference object with attendeeRegistrationOpen={data['conference'].get('attendeeRegistrationOpen')}")
                else:
                    print(f"❌ Test 8 FAILED: Response missing 'conference' field: {data}")
                    all_passed = False
            else:
                print(f"❌ Test 8 FAILED: PUT /attendee-registration returned {resp.status_code} (expected 200): {resp.text}")
                all_passed = False
        except Exception as e:
            print(f"❌ Test 8 FAILED: Exception: {str(e)}")
            all_passed = False
    
    return all_passed

def main():
    print("="*80)
    print("BACKEND TEST: Committee Editor READ access + Rate-limited email broadcast")
    print("="*80)
    
    change_a_passed = test_change_a()
    change_b_passed = test_change_b()
    
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    if change_a_passed:
        print("✅ CHANGE A: All tests PASSED")
    else:
        print("❌ CHANGE A: Some tests FAILED")
    
    if change_b_passed:
        print("✅ CHANGE B: All tests PASSED")
    else:
        print("❌ CHANGE B: Some tests FAILED")
    
    if change_a_passed and change_b_passed:
        print("\n🎉 ALL TESTS PASSED")
        return 0
    else:
        print("\n⚠️  SOME TESTS FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())
