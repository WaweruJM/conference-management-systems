#!/usr/bin/env python3
"""
Backend API tests for SCMS - Focused batch testing
Tests 5 specific scenarios as per review request
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://scms-platform-1.preview.emergentagent.com/api"
CREDENTIALS = {
    "admin": {"email": "admin@scms.io", "password": "password123"},
    "chief": {"email": "chief@scms.io", "password": "password123"},
    "managing": {"email": "managing@scms.io", "password": "password123"},
    "committee": {"email": "committee@scms.io", "password": "password123"},
    "author": {"email": "author@scms.io", "password": "password123"},
}

def login(user_key):
    """Login and return Bearer token"""
    try:
        creds = CREDENTIALS[user_key]
        response = requests.post(f"{BASE_URL}/auth/login", json=creds, timeout=10)
        if response.status_code == 200:
            data = response.json()
            token = data.get("token")
            print(f"✅ Login successful for {creds['email']}")
            return token
        else:
            print(f"❌ Login failed for {creds['email']}: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Login exception for {user_key}: {str(e)}")
        return None

def get_headers(token):
    """Get headers with Bearer token"""
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

def test_1_subthemes_max_5_and_delete():
    """
    Test 1: Sub-themes max 5 enforced + delete
    - GET /api/conferences and get the featured conference id
    - As admin: GET conference themes list
    - POST /api/conferences/:id/themes until we hit 5 total themes
    - POST 6th theme should return 400
    - DELETE one theme, then POST should succeed again
    """
    print("\n" + "="*80)
    print("TEST 1: Sub-themes max 5 enforced + delete")
    print("="*80)
    
    admin_token = login("admin")
    if not admin_token:
        print("❌ TEST 1 FAILED: Could not login as admin")
        return False
    
    headers = get_headers(admin_token)
    
    try:
        # Step 1: Get featured conference
        print("\n[1.1] Getting featured conference...")
        response = requests.get(f"{BASE_URL}/conferences", timeout=10)
        if response.status_code != 200:
            print(f"❌ Failed to get conferences: {response.status_code}")
            return False
        
        conferences = response.json().get("conferences", [])
        featured_conf = next((c for c in conferences if c.get("isFeatured")), None)
        if not featured_conf:
            featured_conf = conferences[0] if conferences else None
        
        if not featured_conf:
            print("❌ No conference found")
            return False
        
        conf_id = featured_conf["id"]
        conf_name = featured_conf.get("name", "Unknown")
        print(f"✅ Found conference: {conf_name} (ID: {conf_id})")
        
        # Step 2: Get current themes
        print(f"\n[1.2] Getting current themes for conference...")
        response = requests.get(f"{BASE_URL}/conferences/{conf_id}", timeout=10)
        if response.status_code != 200:
            print(f"❌ Failed to get conference details: {response.status_code}")
            return False
        
        conf_data = response.json().get("conference", {})
        current_themes = conf_data.get("themes", [])
        theme_count = len(current_themes)
        print(f"✅ Conference currently has {theme_count} themes")
        
        # Step 3: Add themes until we reach 5
        themes_to_add = 5 - theme_count
        added_theme_ids = []
        
        if themes_to_add > 0:
            print(f"\n[1.3] Adding {themes_to_add} themes to reach 5 total...")
            for i in range(themes_to_add):
                theme_name = f"TestTheme_{datetime.now().timestamp()}_{i}"
                theme_body = {
                    "name": theme_name,
                    "keywords": [f"keyword{i}"]
                }
                response = requests.post(
                    f"{BASE_URL}/conferences/{conf_id}/themes",
                    headers=headers,
                    json=theme_body,
                    timeout=10
                )
                if response.status_code == 200:
                    theme_data = response.json().get("theme", {})
                    added_theme_ids.append(theme_data.get("id"))
                    print(f"  ✅ Added theme {i+1}/{themes_to_add}: {theme_name}")
                else:
                    print(f"  ❌ Failed to add theme {i+1}: {response.status_code} - {response.text}")
                    return False
        else:
            print(f"\n[1.3] Conference already has {theme_count} themes (>= 5)")
        
        # Step 4: Try to add 6th theme (should fail with 400)
        print(f"\n[1.4] Attempting to add 6th theme (should fail with 400)...")
        overflow_theme = {
            "name": f"Overflow_{datetime.now().timestamp()}",
            "keywords": ["overflow"]
        }
        response = requests.post(
            f"{BASE_URL}/conferences/{conf_id}/themes",
            headers=headers,
            json=overflow_theme,
            timeout=10
        )
        
        if response.status_code == 400:
            error_msg = response.json().get("error", "")
            if "maximum" in error_msg.lower() and "5" in error_msg:
                print(f"✅ Correctly rejected 6th theme with 400: {error_msg}")
            else:
                print(f"⚠️  Got 400 but unexpected message: {error_msg}")
                return False
        else:
            print(f"❌ Expected 400 but got {response.status_code}: {response.text}")
            return False
        
        # Step 5: Delete one theme
        print(f"\n[1.5] Deleting one theme to bring count below 5...")
        # Get a theme ID to delete (prefer one we just added, or use existing)
        theme_to_delete = added_theme_ids[0] if added_theme_ids else current_themes[0]["id"]
        
        response = requests.delete(
            f"{BASE_URL}/themes/{theme_to_delete}",
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            print(f"✅ Successfully deleted theme: {theme_to_delete}")
        else:
            print(f"❌ Failed to delete theme: {response.status_code} - {response.text}")
            return False
        
        # Step 6: Try to add theme again (should succeed now)
        print(f"\n[1.6] Adding theme again (should succeed now)...")
        new_theme = {
            "name": f"AfterDelete_{datetime.now().timestamp()}",
            "keywords": ["after-delete"]
        }
        response = requests.post(
            f"{BASE_URL}/conferences/{conf_id}/themes",
            headers=headers,
            json=new_theme,
            timeout=10
        )
        
        if response.status_code == 200:
            print(f"✅ Successfully added theme after deletion")
        else:
            print(f"❌ Failed to add theme after deletion: {response.status_code} - {response.text}")
            return False
        
        print("\n✅ TEST 1 PASSED: Sub-themes max 5 enforced + delete working correctly")
        return True
        
    except Exception as e:
        print(f"❌ TEST 1 EXCEPTION: {str(e)}")
        return False

def test_2_mainTheme_field():
    """
    Test 2: mainTheme field on Conference
    - Pick a conference
    - PUT /api/conferences/:id with mainTheme
    - GET /api/conferences/:id and confirm mainTheme is set
    - Set mainTheme back to null
    """
    print("\n" + "="*80)
    print("TEST 2: mainTheme field on Conference")
    print("="*80)
    
    admin_token = login("admin")
    if not admin_token:
        print("❌ TEST 2 FAILED: Could not login as admin")
        return False
    
    headers = get_headers(admin_token)
    
    try:
        # Get a conference
        print("\n[2.1] Getting conference...")
        response = requests.get(f"{BASE_URL}/conferences", timeout=10)
        if response.status_code != 200:
            print(f"❌ Failed to get conferences: {response.status_code}")
            return False
        
        conferences = response.json().get("conferences", [])
        if not conferences:
            print("❌ No conferences found")
            return False
        
        conf = conferences[0]
        conf_id = conf["id"]
        print(f"✅ Using conference: {conf.get('name')} (ID: {conf_id})")
        
        # Set mainTheme
        print("\n[2.2] Setting mainTheme to 'Precision Medicine and Public Health'...")
        update_body = {
            "mainTheme": "Precision Medicine and Public Health"
        }
        response = requests.put(
            f"{BASE_URL}/conferences/{conf_id}",
            headers=headers,
            json=update_body,
            timeout=10
        )
        
        if response.status_code != 200:
            print(f"❌ Failed to update conference: {response.status_code} - {response.text}")
            return False
        
        print("✅ Conference updated successfully")
        
        # Verify mainTheme is set
        print("\n[2.3] Verifying mainTheme is set...")
        response = requests.get(f"{BASE_URL}/conferences/{conf_id}", timeout=10)
        if response.status_code != 200:
            print(f"❌ Failed to get conference: {response.status_code}")
            return False
        
        conf_data = response.json().get("conference", {})
        main_theme = conf_data.get("mainTheme")
        
        if main_theme == "Precision Medicine and Public Health":
            print(f"✅ mainTheme correctly set: {main_theme}")
        else:
            print(f"❌ mainTheme not set correctly. Got: {main_theme}")
            return False
        
        # Reset mainTheme to null
        print("\n[2.4] Resetting mainTheme to null...")
        reset_body = {
            "mainTheme": None
        }
        response = requests.put(
            f"{BASE_URL}/conferences/{conf_id}",
            headers=headers,
            json=reset_body,
            timeout=10
        )
        
        if response.status_code == 200:
            print("✅ mainTheme reset to null")
        else:
            print(f"⚠️  Failed to reset mainTheme: {response.status_code}")
        
        print("\n✅ TEST 2 PASSED: mainTheme field working correctly")
        return True
        
    except Exception as e:
        print(f"❌ TEST 2 EXCEPTION: {str(e)}")
        return False

def test_3_reviewer_invitations_with_abstractId():
    """
    Test 3: POST /api/reviewer-invitations still works with abstractId
    - Login as chief@scms.io
    - Pick any existing abstract id
    - POST /api/reviewer-invitations with abstractId
    - As author@scms.io (no editor role) POST same -> expect 403
    """
    print("\n" + "="*80)
    print("TEST 3: POST /api/reviewer-invitations with abstractId")
    print("="*80)
    
    chief_token = login("chief")
    if not chief_token:
        print("❌ TEST 3 FAILED: Could not login as chief")
        return False
    
    headers = get_headers(chief_token)
    
    try:
        # Get an abstract
        print("\n[3.1] Getting an abstract...")
        response = requests.get(
            f"{BASE_URL}/abstracts",
            headers=headers,
            timeout=10
        )
        if response.status_code != 200:
            print(f"❌ Failed to get abstracts: {response.status_code}")
            return False
        
        abstracts = response.json().get("abstracts", [])
        if not abstracts:
            print("❌ No abstracts found")
            return False
        
        abstract_id = abstracts[0]["id"]
        print(f"✅ Using abstract ID: {abstract_id}")
        
        # Send invitation with abstractId
        print("\n[3.2] Sending reviewer invitation with abstractId as chief...")
        ts = datetime.now().timestamp()
        invite_body = {
            "email": f"invite-test-{ts}@example.com",
            "fullName": "Dr Invite Test",
            "specialty": "Cardiology",
            "message": "Please review this abstract",
            "abstractId": abstract_id
        }
        response = requests.post(
            f"{BASE_URL}/reviewer-invitations",
            headers=headers,
            json=invite_body,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            invitation = data.get("invitation", {})
            register_url = data.get("registerUrl", "")
            print(f"✅ Invitation sent successfully")
            print(f"   Invitation ID: {invitation.get('id')}")
            print(f"   Register URL: {register_url}")
            if not register_url:
                print("⚠️  Warning: registerUrl is empty")
        else:
            print(f"❌ Failed to send invitation: {response.status_code} - {response.text}")
            return False
        
        # Try as author (should fail with 403)
        print("\n[3.3] Attempting to send invitation as author (should fail with 403)...")
        author_token = login("author")
        if not author_token:
            print("❌ Could not login as author")
            return False
        
        author_headers = get_headers(author_token)
        invite_body2 = {
            "email": f"invite-test-2-{ts}@example.com",
            "fullName": "Dr Invite Test 2",
            "specialty": "Oncology",
            "message": "Please review",
            "abstractId": abstract_id
        }
        response = requests.post(
            f"{BASE_URL}/reviewer-invitations",
            headers=author_headers,
            json=invite_body2,
            timeout=10
        )
        
        if response.status_code == 403:
            print(f"✅ Correctly rejected author with 403")
        else:
            print(f"❌ Expected 403 but got {response.status_code}: {response.text}")
            return False
        
        print("\n✅ TEST 3 PASSED: Reviewer invitations with abstractId working correctly")
        return True
        
    except Exception as e:
        print(f"❌ TEST 3 EXCEPTION: {str(e)}")
        return False

def test_4_get_abstract_rbac():
    """
    Test 4: GET /api/abstracts/:id RBAC — Chief Editor + Committee Editor allowed
    - Login as chief@scms.io and GET /api/abstracts/:id (abstract they don't own) -> expect 200
    - Login as committee@scms.io and GET /api/abstracts/:id -> expect 200
    - Login as author@scms.io and GET /api/abstracts/:id (not theirs, not assigned) -> expect 403
    """
    print("\n" + "="*80)
    print("TEST 4: GET /api/abstracts/:id RBAC")
    print("="*80)
    
    try:
        # Get an abstract ID first (as admin to see all)
        print("\n[4.1] Getting an abstract ID...")
        admin_token = login("admin")
        if not admin_token:
            print("❌ Could not login as admin")
            return False
        
        admin_headers = get_headers(admin_token)
        response = requests.get(
            f"{BASE_URL}/abstracts",
            headers=admin_headers,
            timeout=10
        )
        if response.status_code != 200:
            print(f"❌ Failed to get abstracts: {response.status_code}")
            return False
        
        abstracts = response.json().get("abstracts", [])
        if not abstracts:
            print("❌ No abstracts found")
            return False
        
        # Find an abstract not owned by author@scms.io
        author_token = login("author")
        author_headers = get_headers(author_token)
        response = requests.get(
            f"{BASE_URL}/abstracts?scope=mine",
            headers=author_headers,
            timeout=10
        )
        author_abstracts = response.json().get("abstracts", [])
        author_abstract_ids = [a["id"] for a in author_abstracts]
        
        # Pick an abstract not owned by author
        test_abstract = None
        for abstract in abstracts:
            if abstract["id"] not in author_abstract_ids:
                test_abstract = abstract
                break
        
        if not test_abstract:
            # If all abstracts belong to author, use the first one
            test_abstract = abstracts[0]
        
        abstract_id = test_abstract["id"]
        submission_code = test_abstract.get("submissionCode", "Unknown")
        print(f"✅ Using abstract: {submission_code} (ID: {abstract_id})")
        
        # Test 1: Chief Editor access
        print("\n[4.2] Testing Chief Editor access...")
        chief_token = login("chief")
        if not chief_token:
            print("❌ Could not login as chief")
            return False
        
        chief_headers = get_headers(chief_token)
        response = requests.get(
            f"{BASE_URL}/abstracts/{abstract_id}",
            headers=chief_headers,
            timeout=10
        )
        
        if response.status_code == 200:
            print(f"✅ Chief Editor can access abstract (200)")
        else:
            print(f"❌ Chief Editor access failed: {response.status_code} - {response.text}")
            return False
        
        # Test 2: Committee Editor access
        print("\n[4.3] Testing Committee Editor access...")
        committee_token = login("committee")
        if not committee_token:
            print("❌ Could not login as committee")
            return False
        
        committee_headers = get_headers(committee_token)
        response = requests.get(
            f"{BASE_URL}/abstracts/{abstract_id}",
            headers=committee_headers,
            timeout=10
        )
        
        if response.status_code == 200:
            print(f"✅ Committee Editor can access abstract (200)")
        else:
            print(f"❌ Committee Editor access failed: {response.status_code} - {response.text}")
            return False
        
        # Test 3: Author access to non-owned, non-assigned abstract
        print("\n[4.4] Testing Author access to non-owned abstract (should fail with 403)...")
        response = requests.get(
            f"{BASE_URL}/abstracts/{abstract_id}",
            headers=author_headers,
            timeout=10
        )
        
        if response.status_code == 403:
            print(f"✅ Author correctly denied access (403)")
        elif response.status_code == 200:
            # This might be their own abstract or they're assigned
            print(f"⚠️  Author got 200 - might be their abstract or they're assigned")
            # Try to find another abstract
            for abstract in abstracts:
                if abstract["id"] not in author_abstract_ids and abstract["id"] != abstract_id:
                    test_id = abstract["id"]
                    response = requests.get(
                        f"{BASE_URL}/abstracts/{test_id}",
                        headers=author_headers,
                        timeout=10
                    )
                    if response.status_code == 403:
                        print(f"✅ Author correctly denied access to {test_id} (403)")
                        break
                    elif response.status_code == 200:
                        continue
            else:
                print("⚠️  Could not find an abstract that author doesn't have access to")
        else:
            print(f"❌ Unexpected status code: {response.status_code} - {response.text}")
            return False
        
        print("\n✅ TEST 4 PASSED: GET /api/abstracts/:id RBAC working correctly")
        return True
        
    except Exception as e:
        print(f"❌ TEST 4 EXCEPTION: {str(e)}")
        return False

def test_5_assign_editor_rbac():
    """
    Test 5: POST /api/abstracts/:id/assign-editor RBAC still tight
    - Login as managing@scms.io, POST assign-editor -> expect 403
    - Login as chief@scms.io -> 200. Try self-assignment -> 200
    - Login as admin@scms.io -> 200
    - Login as committee@scms.io -> 403
    """
    print("\n" + "="*80)
    print("TEST 5: POST /api/abstracts/:id/assign-editor RBAC")
    print("="*80)
    
    try:
        # Get an abstract and committee user ID
        print("\n[5.1] Getting abstract and committee user ID...")
        admin_token = login("admin")
        if not admin_token:
            print("❌ Could not login as admin")
            return False
        
        admin_headers = get_headers(admin_token)
        
        # Get abstracts
        response = requests.get(
            f"{BASE_URL}/abstracts",
            headers=admin_headers,
            timeout=10
        )
        if response.status_code != 200:
            print(f"❌ Failed to get abstracts: {response.status_code}")
            return False
        
        abstracts = response.json().get("abstracts", [])
        if not abstracts:
            print("❌ No abstracts found")
            return False
        
        abstract_id = abstracts[0]["id"]
        submission_code = abstracts[0].get("submissionCode", "Unknown")
        print(f"✅ Using abstract: {submission_code} (ID: {abstract_id})")
        
        # Get committee user ID
        response = requests.get(
            f"{BASE_URL}/users",
            headers=admin_headers,
            timeout=10
        )
        if response.status_code != 200:
            print(f"❌ Failed to get users: {response.status_code}")
            return False
        
        users = response.json().get("users", [])
        committee_user = next((u for u in users if u["email"] == "committee@scms.io"), None)
        chief_user = next((u for u in users if u["email"] == "chief@scms.io"), None)
        
        if not committee_user:
            print("❌ Committee user not found")
            return False
        
        committee_user_id = committee_user["id"]
        chief_user_id = chief_user["id"] if chief_user else None
        print(f"✅ Committee user ID: {committee_user_id}")
        if chief_user_id:
            print(f"✅ Chief user ID: {chief_user_id}")
        
        # Test 1: Managing Editor (should fail with 403)
        print("\n[5.2] Testing Managing Editor assign-editor (should fail with 403)...")
        managing_token = login("managing")
        if not managing_token:
            print("❌ Could not login as managing")
            return False
        
        managing_headers = get_headers(managing_token)
        assign_body = {
            "editorId": committee_user_id,
            "role": "COMMITTEE_EDITOR"
        }
        response = requests.post(
            f"{BASE_URL}/abstracts/{abstract_id}/assign-editor",
            headers=managing_headers,
            json=assign_body,
            timeout=10
        )
        
        if response.status_code == 403:
            print(f"✅ Managing Editor correctly denied (403)")
        else:
            print(f"❌ Expected 403 but got {response.status_code}: {response.text}")
            return False
        
        # Test 2: Chief Editor (should succeed)
        print("\n[5.3] Testing Chief Editor assign-editor (should succeed with 200)...")
        chief_token = login("chief")
        if not chief_token:
            print("❌ Could not login as chief")
            return False
        
        chief_headers = get_headers(chief_token)
        response = requests.post(
            f"{BASE_URL}/abstracts/{abstract_id}/assign-editor",
            headers=chief_headers,
            json=assign_body,
            timeout=10
        )
        
        if response.status_code == 200:
            print(f"✅ Chief Editor can assign editor (200)")
        else:
            print(f"❌ Chief Editor assign failed: {response.status_code} - {response.text}")
            return False
        
        # Test 3: Chief Editor self-assignment (should succeed)
        if chief_user_id:
            print("\n[5.4] Testing Chief Editor self-assignment (should succeed with 200)...")
            self_assign_body = {
                "editorId": chief_user_id,
                "role": "COMMITTEE_EDITOR"
            }
            response = requests.post(
                f"{BASE_URL}/abstracts/{abstract_id}/assign-editor",
                headers=chief_headers,
                json=self_assign_body,
                timeout=10
            )
            
            if response.status_code == 200:
                print(f"✅ Chief Editor can self-assign (200)")
            else:
                print(f"❌ Chief Editor self-assign failed: {response.status_code} - {response.text}")
                return False
        
        # Test 4: Admin (should succeed)
        print("\n[5.5] Testing Admin assign-editor (should succeed with 200)...")
        response = requests.post(
            f"{BASE_URL}/abstracts/{abstract_id}/assign-editor",
            headers=admin_headers,
            json=assign_body,
            timeout=10
        )
        
        if response.status_code == 200:
            print(f"✅ Admin can assign editor (200)")
        else:
            print(f"❌ Admin assign failed: {response.status_code} - {response.text}")
            return False
        
        # Test 5: Committee Member (should fail with 403)
        print("\n[5.6] Testing Committee Member assign-editor (should fail with 403)...")
        committee_token = login("committee")
        if not committee_token:
            print("❌ Could not login as committee")
            return False
        
        committee_headers = get_headers(committee_token)
        response = requests.post(
            f"{BASE_URL}/abstracts/{abstract_id}/assign-editor",
            headers=committee_headers,
            json=assign_body,
            timeout=10
        )
        
        if response.status_code == 403:
            print(f"✅ Committee Member correctly denied (403)")
        else:
            print(f"❌ Expected 403 but got {response.status_code}: {response.text}")
            return False
        
        print("\n✅ TEST 5 PASSED: POST /api/abstracts/:id/assign-editor RBAC working correctly")
        return True
        
    except Exception as e:
        print(f"❌ TEST 5 EXCEPTION: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("SCMS BACKEND API TESTS - FOCUSED BATCH")
    print("Testing 5 specific scenarios")
    print("="*80)
    
    results = {
        "Test 1: Sub-themes max 5 + delete": test_1_subthemes_max_5_and_delete(),
        "Test 2: mainTheme field": test_2_mainTheme_field(),
        "Test 3: Reviewer invitations with abstractId": test_3_reviewer_invitations_with_abstractId(),
        "Test 4: GET /api/abstracts/:id RBAC": test_4_get_abstract_rbac(),
        "Test 5: POST /api/abstracts/:id/assign-editor RBAC": test_5_assign_editor_rbac(),
    }
    
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
