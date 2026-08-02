#!/usr/bin/env python3
"""
Regression test for Committee Editor workspace visibility bug fix.

Bug: Committee Editor with COMMITTEE_MEMBER role couldn't see abstracts assigned to them
in "My Editor Workspace" because GET /api/abstracts?scope=assigned was routing them to
the reviewer branch instead of the editor branch.

Fix: Backend now checks editor roles first (MANAGING_EDITOR, CHIEF_EDITOR, COMMITTEE_EDITOR,
COMMITTEE_MEMBER) → returns editorAssignments. Falls through to EXTERNAL_REVIEWER for reviewer branch.
"""

import requests
import json
import sys

BASE_URL = "https://scms-platform-1.preview.emergentagent.com/api"

# Test users (password: password123)
USERS = {
    "admin": {"email": "admin@scms.io", "password": "password123"},
    "chief": {"email": "chief@scms.io", "password": "password123"},
    "committee": {"email": "committee@scms.io", "password": "password123"},
    "committee2": {"email": "committee2@scms.io", "password": "password123"},
    "managing": {"email": "managing@scms.io", "password": "password123"},
    "author": {"email": "author@scms.io", "password": "password123"},
    "reviewer1": {"email": "reviewer1@scms.io", "password": "password123"},
}

def login(email, password):
    """Login and return JWT token"""
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
        if resp.status_code == 200:
            data = resp.json()
            token = data.get("token")
            user = data.get("user")
            print(f"✅ Login successful: {email} (roles: {[r['role'] for r in user.get('roles', [])]})")
            return token
        else:
            print(f"❌ Login failed for {email}: {resp.status_code} - {resp.text}")
            return None
    except Exception as e:
        print(f"❌ Login exception for {email}: {e}")
        return None

def get_featured_conference(token):
    """Get featured conference"""
    try:
        resp = requests.get(f"{BASE_URL}/public/config")
        if resp.status_code == 200:
            data = resp.json()
            conf = data.get("conference")
            if conf:
                print(f"✅ Featured conference: {conf['name']} (ID: {conf['id']})")
                return conf
        print(f"❌ Failed to get featured conference: {resp.status_code}")
        return None
    except Exception as e:
        print(f"❌ Exception getting featured conference: {e}")
        return None

def get_abstracts(token, scope=None, state=None):
    """Get abstracts with optional scope and state filters"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        params = {}
        if scope:
            params["scope"] = scope
        if state:
            params["state"] = state
        resp = requests.get(f"{BASE_URL}/abstracts", headers=headers, params=params)
        if resp.status_code == 200:
            data = resp.json()
            return data.get("abstracts", [])
        else:
            print(f"❌ GET /abstracts failed: {resp.status_code} - {resp.text}")
            return None
    except Exception as e:
        print(f"❌ Exception getting abstracts: {e}")
        return None

def get_abstract_detail(token, abstract_id):
    """Get abstract detail by ID"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.get(f"{BASE_URL}/abstracts/{abstract_id}", headers=headers)
        return resp.status_code, resp.json() if resp.status_code == 200 else resp.text
    except Exception as e:
        print(f"❌ Exception getting abstract detail: {e}")
        return None, str(e)

def assign_editor(token, abstract_id, editor_id, role="COMMITTEE_EDITOR"):
    """Assign editor to abstract"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        payload = {"editorId": editor_id, "role": role}
        resp = requests.post(f"{BASE_URL}/abstracts/{abstract_id}/assign-editor", headers=headers, json=payload)
        if resp.status_code == 200:
            print(f"✅ Assigned editor to abstract {abstract_id}")
            return True
        else:
            print(f"❌ Failed to assign editor: {resp.status_code} - {resp.text}")
            return False
    except Exception as e:
        print(f"❌ Exception assigning editor: {e}")
        return False

def get_notifications(token):
    """Get notifications for current user"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.get(f"{BASE_URL}/notifications", headers=headers)
        if resp.status_code == 200:
            data = resp.json()
            return data.get("notifications", [])
        else:
            print(f"❌ GET /notifications failed: {resp.status_code} - {resp.text}")
            return None
    except Exception as e:
        print(f"❌ Exception getting notifications: {e}")
        return None

def get_reviewer_assignments(token):
    """Get reviewer assignments"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.get(f"{BASE_URL}/reviewer/assignments", headers=headers)
        if resp.status_code == 200:
            data = resp.json()
            return data.get("assignments", [])
        else:
            print(f"❌ GET /reviewer/assignments failed: {resp.status_code} - {resp.text}")
            return None
    except Exception as e:
        print(f"❌ Exception getting reviewer assignments: {e}")
        return None

def get_user_id_by_email(token, email):
    """Get user ID by email (admin only)"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.get(f"{BASE_URL}/users", headers=headers)
        if resp.status_code == 200:
            data = resp.json()
            users = data.get("users", [])
            for user in users:
                if user.get("email") == email:
                    return user.get("id")
        return None
    except Exception as e:
        print(f"❌ Exception getting user ID: {e}")
        return None

def main():
    print("=" * 80)
    print("COMMITTEE EDITOR WORKSPACE VISIBILITY REGRESSION TEST")
    print("=" * 80)
    print()
    
    # Track test results
    tests_passed = 0
    tests_failed = 0
    
    # Step 1: Setup - Login as chief and prepare abstracts
    print("\n" + "=" * 80)
    print("STEP 1: SETUP - Prepare test data")
    print("=" * 80)
    
    chief_token = login(USERS["chief"]["email"], USERS["chief"]["password"])
    if not chief_token:
        print("❌ CRITICAL: Cannot login as chief@scms.io")
        return
    
    # Get featured conference
    conf = get_featured_conference(chief_token)
    if not conf:
        print("❌ CRITICAL: Cannot get featured conference")
        return
    
    # Get admin token to fetch user IDs
    admin_token = login(USERS["admin"]["email"], USERS["admin"]["password"])
    if not admin_token:
        print("❌ CRITICAL: Cannot login as admin@scms.io")
        return
    
    # Get user IDs for committee@scms.io, committee2@scms.io, managing@scms.io
    committee_id = get_user_id_by_email(admin_token, "committee@scms.io")
    committee2_id = get_user_id_by_email(admin_token, "committee2@scms.io")
    managing_id = get_user_id_by_email(admin_token, "managing@scms.io")
    
    if not committee_id or not committee2_id or not managing_id:
        print(f"❌ CRITICAL: Cannot get user IDs (committee: {committee_id}, committee2: {committee2_id}, managing: {managing_id})")
        return
    
    print(f"✅ User IDs: committee={committee_id}, committee2={committee2_id}, managing={managing_id}")
    
    # Get abstracts in suitable states (SUBMITTED, TECHNICAL_CHECK, EDITORIAL_ASSIGNMENT)
    all_abstracts = get_abstracts(admin_token)
    if not all_abstracts:
        print("❌ CRITICAL: Cannot get abstracts")
        return
    
    suitable_abstracts = [
        a for a in all_abstracts 
        if a.get("currentState") in ["SUBMITTED", "TECHNICAL_CHECK", "EDITORIAL_ASSIGNMENT"]
    ]
    
    if len(suitable_abstracts) < 3:
        print(f"❌ CRITICAL: Need at least 3 suitable abstracts, found {len(suitable_abstracts)}")
        return
    
    # Assign editors to 3 different abstracts
    abs1 = suitable_abstracts[0]
    abs2 = suitable_abstracts[1]
    abs3 = suitable_abstracts[2]
    
    print(f"\n📋 Test abstracts:")
    print(f"   Abstract 1: {abs1['submissionCode']} (ID: {abs1['id']}) - will assign to committee@scms.io")
    print(f"   Abstract 2: {abs2['submissionCode']} (ID: {abs2['id']}) - will assign to committee2@scms.io")
    print(f"   Abstract 3: {abs3['submissionCode']} (ID: {abs3['id']}) - will assign to managing@scms.io")
    
    # Assign committee@scms.io to abstract 1
    if assign_editor(chief_token, abs1["id"], committee_id, "COMMITTEE_EDITOR"):
        tests_passed += 1
    else:
        tests_failed += 1
    
    # Assign committee2@scms.io to abstract 2
    if assign_editor(chief_token, abs2["id"], committee2_id, "COMMITTEE_EDITOR"):
        tests_passed += 1
    else:
        tests_failed += 1
    
    # Assign managing@scms.io to abstract 3
    if assign_editor(chief_token, abs3["id"], managing_id, "COMMITTEE_EDITOR"):
        tests_passed += 1
    else:
        tests_failed += 1
    
    print(f"\n✅ Setup complete: Assigned 3 editors to 3 abstracts")
    
    # Step 2: Fix verified - Committee Editor with COMMITTEE_MEMBER sees editor assignments
    print("\n" + "=" * 80)
    print("STEP 2: FIX VERIFIED - Committee Editor with COMMITTEE_MEMBER role")
    print("=" * 80)
    
    committee_token = login(USERS["committee"]["email"], USERS["committee"]["password"])
    if not committee_token:
        print("❌ TEST FAILED: Cannot login as committee@scms.io")
        tests_failed += 1
    else:
        # GET /api/abstracts?scope=assigned should return abstracts assigned to committee@scms.io
        assigned_abstracts = get_abstracts(committee_token, scope="assigned")
        if assigned_abstracts is None:
            print("❌ TEST FAILED: GET /abstracts?scope=assigned returned error")
            tests_failed += 1
        elif len(assigned_abstracts) == 0:
            print("❌ TEST FAILED: GET /abstracts?scope=assigned returned empty list (BUG NOT FIXED)")
            tests_failed += 1
        else:
            # Check if abs1 is in the list
            found = any(a["id"] == abs1["id"] for a in assigned_abstracts)
            if found:
                print(f"✅ TEST PASSED: committee@scms.io sees assigned abstract {abs1['submissionCode']}")
                print(f"   Total assigned abstracts: {len(assigned_abstracts)}")
                tests_passed += 1
            else:
                print(f"❌ TEST FAILED: committee@scms.io does NOT see assigned abstract {abs1['submissionCode']}")
                print(f"   Assigned abstracts: {[a['submissionCode'] for a in assigned_abstracts]}")
                tests_failed += 1
        
        # Verify committee@scms.io does NOT see abstracts they were NOT assigned to
        sees_abs2 = any(a["id"] == abs2["id"] for a in (assigned_abstracts or []))
        sees_abs3 = any(a["id"] == abs3["id"] for a in (assigned_abstracts or []))
        if not sees_abs2 and not sees_abs3:
            print(f"✅ TEST PASSED: committee@scms.io does NOT see unassigned abstracts")
            tests_passed += 1
        else:
            print(f"❌ TEST FAILED: committee@scms.io sees unassigned abstracts (abs2: {sees_abs2}, abs3: {sees_abs3})")
            tests_failed += 1
    
    # Step 3: Committee Editor with COMMITTEE_EDITOR role sees editor assignments
    print("\n" + "=" * 80)
    print("STEP 3: REGRESSION - Committee Editor with COMMITTEE_EDITOR role")
    print("=" * 80)
    
    committee2_token = login(USERS["committee2"]["email"], USERS["committee2"]["password"])
    if not committee2_token:
        print("❌ TEST FAILED: Cannot login as committee2@scms.io")
        tests_failed += 1
    else:
        assigned_abstracts = get_abstracts(committee2_token, scope="assigned")
        if assigned_abstracts is None:
            print("❌ TEST FAILED: GET /abstracts?scope=assigned returned error")
            tests_failed += 1
        else:
            # Check if abs2 is in the list
            found = any(a["id"] == abs2["id"] for a in assigned_abstracts)
            if found:
                print(f"✅ TEST PASSED: committee2@scms.io sees assigned abstract {abs2['submissionCode']}")
                print(f"   Total assigned abstracts: {len(assigned_abstracts)}")
                tests_passed += 1
            else:
                print(f"❌ TEST FAILED: committee2@scms.io does NOT see assigned abstract {abs2['submissionCode']}")
                tests_failed += 1
            
            # Verify they don't see abs1 (assigned to committee@scms.io)
            sees_abs1 = any(a["id"] == abs1["id"] for a in assigned_abstracts)
            if not sees_abs1:
                print(f"✅ TEST PASSED: committee2@scms.io does NOT see abstracts assigned to others")
                tests_passed += 1
            else:
                print(f"❌ TEST FAILED: committee2@scms.io sees abstract assigned to committee@scms.io")
                tests_failed += 1
    
    # Step 4: Managing Editor sees editor assignments
    print("\n" + "=" * 80)
    print("STEP 4: REGRESSION - Managing Editor")
    print("=" * 80)
    
    managing_token = login(USERS["managing"]["email"], USERS["managing"]["password"])
    if not managing_token:
        print("❌ TEST FAILED: Cannot login as managing@scms.io")
        tests_failed += 1
    else:
        assigned_abstracts = get_abstracts(managing_token, scope="assigned")
        if assigned_abstracts is None:
            print("❌ TEST FAILED: GET /abstracts?scope=assigned returned error")
            tests_failed += 1
        else:
            # Check if abs3 is in the list
            found = any(a["id"] == abs3["id"] for a in assigned_abstracts)
            if found:
                print(f"✅ TEST PASSED: managing@scms.io sees assigned abstract {abs3['submissionCode']}")
                print(f"   Total assigned abstracts: {len(assigned_abstracts)}")
                tests_passed += 1
            else:
                print(f"❌ TEST FAILED: managing@scms.io does NOT see assigned abstract {abs3['submissionCode']}")
                tests_failed += 1
    
    # Step 5: External Reviewer path still works
    print("\n" + "=" * 80)
    print("STEP 5: REGRESSION - External Reviewer path")
    print("=" * 80)
    
    reviewer1_token = login(USERS["reviewer1"]["email"], USERS["reviewer1"]["password"])
    if not reviewer1_token:
        print("❌ TEST FAILED: Cannot login as reviewer1@scms.io")
        tests_failed += 1
    else:
        assigned_abstracts = get_abstracts(reviewer1_token, scope="assigned")
        if assigned_abstracts is None:
            print("❌ TEST FAILED: GET /abstracts?scope=assigned returned error")
            tests_failed += 1
        else:
            # Should filter by review assignments (may be empty, that's OK)
            print(f"✅ TEST PASSED: reviewer1@scms.io GET /abstracts?scope=assigned returns 200")
            print(f"   Reviewer assignments: {len(assigned_abstracts)}")
            tests_passed += 1
    
    # Step 6: Notification on assign-editor
    print("\n" + "=" * 80)
    print("STEP 6: REGRESSION - Notification on assign-editor")
    print("=" * 80)
    
    # Check notifications for committee@scms.io
    notifications = get_notifications(committee_token)
    if notifications is None:
        print("❌ TEST FAILED: Cannot get notifications for committee@scms.io")
        tests_failed += 1
    else:
        # Look for ASSIGNMENT notification with title "New editor assignment"
        assignment_notifs = [
            n for n in notifications 
            if n.get("type") == "ASSIGNMENT" and "assignment" in n.get("title", "").lower()
        ]
        if assignment_notifs:
            print(f"✅ TEST PASSED: Found {len(assignment_notifs)} ASSIGNMENT notification(s)")
            print(f"   Latest: {assignment_notifs[0].get('title')} - {assignment_notifs[0].get('body')}")
            tests_passed += 1
        else:
            print(f"❌ TEST FAILED: No ASSIGNMENT notification found")
            print(f"   Total notifications: {len(notifications)}")
            tests_failed += 1
    
    # Step 7: Abstract accessible via detail endpoint
    print("\n" + "=" * 80)
    print("STEP 7: Abstract accessible via detail endpoint")
    print("=" * 80)
    
    status, result = get_abstract_detail(committee_token, abs1["id"])
    if status == 200:
        print(f"✅ TEST PASSED: committee@scms.io can access abstract detail {abs1['submissionCode']}")
        tests_passed += 1
    else:
        print(f"❌ TEST FAILED: committee@scms.io cannot access abstract detail (status: {status})")
        tests_failed += 1
    
    # Step 8: Non-regression on other endpoints
    print("\n" + "=" * 80)
    print("STEP 8: Non-regression on other endpoints")
    print("=" * 80)
    
    # GET /abstracts (no scope) as committee@scms.io
    all_abstracts_committee = get_abstracts(committee_token)
    if all_abstracts_committee is not None:
        print(f"✅ TEST PASSED: GET /abstracts (no scope) works for committee@scms.io")
        print(f"   Total abstracts: {len(all_abstracts_committee)}")
        tests_passed += 1
    else:
        print(f"❌ TEST FAILED: GET /abstracts (no scope) failed for committee@scms.io")
        tests_failed += 1
    
    # GET /reviewer/assignments as committee@scms.io
    reviewer_assignments = get_reviewer_assignments(committee_token)
    if reviewer_assignments is not None:
        print(f"✅ TEST PASSED: GET /reviewer/assignments works for committee@scms.io")
        print(f"   Total reviewer assignments: {len(reviewer_assignments)}")
        tests_passed += 1
    else:
        print(f"❌ TEST FAILED: GET /reviewer/assignments failed for committee@scms.io")
        tests_failed += 1
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    total_tests = tests_passed + tests_failed
    print(f"Total tests: {total_tests}")
    print(f"✅ Passed: {tests_passed}")
    print(f"❌ Failed: {tests_failed}")
    print(f"Success rate: {tests_passed / total_tests * 100:.1f}%")
    print("=" * 80)
    
    if tests_failed == 0:
        print("\n🎉 ALL TESTS PASSED - Bug fix verified successfully!")
        return 0
    else:
        print(f"\n⚠️  {tests_failed} TEST(S) FAILED - Review required")
        return 1

if __name__ == "__main__":
    sys.exit(main())
