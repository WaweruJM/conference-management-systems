#!/usr/bin/env python3
"""
Backend test for external reviewer accept/decline workflow.
Tests POST /api/reviewer/assignments/:id/respond and GET /api/abstracts/:id RBAC.
"""

import requests
import json
import sys

BASE_URL = "https://scms-platform-1.preview.emergentagent.com/api"
PASSWORD = "password123"

# Test users
ADMIN_EMAIL = "admin@scms.io"
CHIEF_EMAIL = "chief@scms.io"
AUTHOR_EMAIL = "author@scms.io"
REVIEWER1_EMAIL = "reviewer1@scms.io"
REVIEWER2_EMAIL = "reviewer2@scms.io"

# Conference and theme IDs
CONFERENCE_ID = "e01de36e-e09e-479f-bd53-c056b2a90436"
THEME_ID = "33ebf4d7-b1d7-4a68-a1fd-0dbdd9a55705"

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

def get_user_id(token, email):
    """Get user ID by email"""
    try:
        resp = requests.get(f"{BASE_URL}/users?role=CHIEF_EDITOR", headers={"Authorization": f"Bearer {token}"}, timeout=10)
        if resp.status_code == 200:
            users = resp.json().get("users", [])
            for user in users:
                if user.get("email") == email:
                    return user.get("id")
        # Try getting current user if it's the logged-in user
        resp = requests.get(f"{BASE_URL}/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=10)
        if resp.status_code == 200:
            user = resp.json().get("user", {})
            if user.get("email") == email:
                return user.get("id")
        return None
    except Exception as e:
        print(f"❌ Get user ID exception: {e}")
        return None

def main():
    print("=" * 80)
    print("EXTERNAL REVIEWER ACCEPT/DECLINE WORKFLOW TEST")
    print("=" * 80)
    
    # Track test results
    tests_passed = 0
    tests_failed = 0
    
    # ========== SETUP ==========
    print("\n📋 SETUP PHASE")
    print("-" * 80)
    
    # Step 1: Login as author and create abstract
    print("\n[SETUP 1] Login as author and create abstract")
    author_token = login(AUTHOR_EMAIL, PASSWORD)
    if not author_token:
        print("❌ FATAL: Cannot login as author")
        sys.exit(1)
    
    # Create abstract
    try:
        abstract_data = {
            "conferenceId": CONFERENCE_ID,
            "title": "Reviewer Flow Test Abstract",
            "body": "This is a test abstract for reviewer accept/decline workflow testing.",
            "themeId": THEME_ID,
            "keywords": ["test", "reviewer", "workflow"]
        }
        resp = requests.post(f"{BASE_URL}/abstracts", json=abstract_data, headers={"Authorization": f"Bearer {author_token}"}, timeout=10)
        if resp.status_code == 200:
            abstract = resp.json().get("abstract", {})
            abstract_id = abstract.get("id")
            submission_code = abstract.get("submissionCode")
            print(f"✅ Abstract created: {submission_code} (ID: {abstract_id})")
        else:
            print(f"❌ FATAL: Cannot create abstract: {resp.status_code} - {resp.text}")
            sys.exit(1)
    except Exception as e:
        print(f"❌ FATAL: Exception creating abstract: {e}")
        sys.exit(1)
    
    # Submit abstract
    try:
        resp = requests.post(f"{BASE_URL}/abstracts/{abstract_id}/submit", headers={"Authorization": f"Bearer {author_token}"}, timeout=10)
        if resp.status_code == 200:
            print(f"✅ Abstract submitted successfully")
        else:
            print(f"❌ FATAL: Cannot submit abstract: {resp.status_code} - {resp.text}")
            sys.exit(1)
    except Exception as e:
        print(f"❌ FATAL: Exception submitting abstract: {e}")
        sys.exit(1)
    
    # Step 2: Login as admin and setup editorial workflow
    print("\n[SETUP 2] Login as admin and setup editorial workflow")
    admin_token = login(ADMIN_EMAIL, PASSWORD)
    if not admin_token:
        print("❌ FATAL: Cannot login as admin")
        sys.exit(1)
    
    # Get chief editor user ID
    try:
        resp = requests.get(f"{BASE_URL}/users?role=CHIEF_EDITOR", headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        if resp.status_code == 200:
            users = resp.json().get("users", [])
            chief_user = next((u for u in users if u.get("email") == CHIEF_EMAIL), None)
            if chief_user:
                chief_id = chief_user.get("id")
                print(f"✅ Found chief editor: {chief_id}")
            else:
                print(f"❌ FATAL: Cannot find chief editor user")
                sys.exit(1)
        else:
            print(f"❌ FATAL: Cannot get users: {resp.status_code}")
            sys.exit(1)
    except Exception as e:
        print(f"❌ FATAL: Exception getting chief ID: {e}")
        sys.exit(1)
    
    # Get reviewer1 and reviewer2 user IDs
    try:
        resp = requests.get(f"{BASE_URL}/users?role=EXTERNAL_REVIEWER", headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        if resp.status_code == 200:
            users = resp.json().get("users", [])
            reviewer1_user = next((u for u in users if u.get("email") == REVIEWER1_EMAIL), None)
            reviewer2_user = next((u for u in users if u.get("email") == REVIEWER2_EMAIL), None)
            if reviewer1_user and reviewer2_user:
                reviewer1_id = reviewer1_user.get("id")
                reviewer2_id = reviewer2_user.get("id")
                print(f"✅ Found reviewer1: {reviewer1_id}")
                print(f"✅ Found reviewer2: {reviewer2_id}")
            else:
                print(f"❌ FATAL: Cannot find reviewer users")
                sys.exit(1)
        else:
            print(f"❌ FATAL: Cannot get reviewers: {resp.status_code}")
            sys.exit(1)
    except Exception as e:
        print(f"❌ FATAL: Exception getting reviewer IDs: {e}")
        sys.exit(1)
    
    # Transition to editorial phase
    try:
        resp = requests.post(f"{BASE_URL}/abstracts/{abstract_id}/transition", 
                           json={"newState": "EDITORIAL_ASSIGNMENT", "comment": "assign"},
                           headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        if resp.status_code == 200:
            print(f"✅ Transitioned to EDITORIAL_ASSIGNMENT")
        else:
            print(f"⚠️  Transition warning: {resp.status_code} - may already be in correct state")
    except Exception as e:
        print(f"⚠️  Transition exception: {e}")
    
    # Assign chief as editor
    try:
        resp = requests.post(f"{BASE_URL}/abstracts/{abstract_id}/assign-editor",
                           json={"editorId": chief_id},
                           headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        if resp.status_code == 200:
            print(f"✅ Assigned chief editor")
        else:
            print(f"❌ FATAL: Cannot assign editor: {resp.status_code} - {resp.text}")
            sys.exit(1)
    except Exception as e:
        print(f"❌ FATAL: Exception assigning editor: {e}")
        sys.exit(1)
    
    # Assign reviewer1
    try:
        resp = requests.post(f"{BASE_URL}/abstracts/{abstract_id}/assign-reviewer",
                           json={"reviewerId": reviewer1_id, "reviewType": "EXTERNAL_REVIEWER", "dueDate": "2027-04-01"},
                           headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        if resp.status_code == 200:
            assignment1 = resp.json().get("assignment", {})
            a1_id = assignment1.get("id")
            print(f"✅ Assigned reviewer1: assignment ID = {a1_id}")
        else:
            print(f"❌ FATAL: Cannot assign reviewer1: {resp.status_code} - {resp.text}")
            sys.exit(1)
    except Exception as e:
        print(f"❌ FATAL: Exception assigning reviewer1: {e}")
        sys.exit(1)
    
    # Assign reviewer2
    try:
        resp = requests.post(f"{BASE_URL}/abstracts/{abstract_id}/assign-reviewer",
                           json={"reviewerId": reviewer2_id, "reviewType": "EXTERNAL_REVIEWER", "dueDate": "2027-04-01"},
                           headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        if resp.status_code == 200:
            assignment2 = resp.json().get("assignment", {})
            a2_id = assignment2.get("id")
            print(f"✅ Assigned reviewer2: assignment ID = {a2_id}")
        else:
            print(f"❌ FATAL: Cannot assign reviewer2: {resp.status_code} - {resp.text}")
            sys.exit(1)
    except Exception as e:
        print(f"❌ FATAL: Exception assigning reviewer2: {e}")
        sys.exit(1)
    
    print("\n✅ SETUP COMPLETE")
    print(f"   Abstract ID: {abstract_id}")
    print(f"   Submission Code: {submission_code}")
    print(f"   Assignment 1 (reviewer1): {a1_id}")
    print(f"   Assignment 2 (reviewer2): {a2_id}")
    
    # ========== TEST SCENARIOS ==========
    print("\n" + "=" * 80)
    print("TEST SCENARIOS")
    print("=" * 80)
    
    # Test A: PENDING reviewer cannot see abstract
    print("\n[TEST A] PENDING reviewer cannot see abstract")
    print("-" * 80)
    reviewer1_token = login(REVIEWER1_EMAIL, PASSWORD)
    if not reviewer1_token:
        print("❌ TEST A FAILED: Cannot login as reviewer1")
        tests_failed += 1
    else:
        try:
            resp = requests.get(f"{BASE_URL}/abstracts/{abstract_id}", 
                              headers={"Authorization": f"Bearer {reviewer1_token}"}, timeout=10)
            if resp.status_code == 403:
                error_msg = resp.json().get("error", "")
                if "accept the review invitation" in error_msg.lower():
                    print(f"✅ TEST A PASSED: PENDING reviewer got 403 with correct message")
                    print(f"   Message: {error_msg}")
                    tests_passed += 1
                else:
                    print(f"⚠️  TEST A PARTIAL: Got 403 but message doesn't mention invitation")
                    print(f"   Message: {error_msg}")
                    tests_passed += 1
            else:
                print(f"❌ TEST A FAILED: Expected 403, got {resp.status_code}")
                print(f"   Response: {resp.text}")
                tests_failed += 1
        except Exception as e:
            print(f"❌ TEST A FAILED: Exception: {e}")
            tests_failed += 1
    
    # Test B: Wrong reviewer cannot mutate someone else's assignment
    print("\n[TEST B] Wrong reviewer cannot mutate someone else's assignment")
    print("-" * 80)
    if reviewer1_token:
        try:
            resp = requests.post(f"{BASE_URL}/reviewer/assignments/{a2_id}/respond",
                               json={"status": "ACCEPTED"},
                               headers={"Authorization": f"Bearer {reviewer1_token}"}, timeout=10)
            if resp.status_code == 403:
                print(f"✅ TEST B PASSED: Wrong reviewer got 403 when trying to respond to another's assignment")
                tests_passed += 1
            else:
                print(f"❌ TEST B FAILED: Expected 403, got {resp.status_code}")
                print(f"   Response: {resp.text}")
                tests_failed += 1
        except Exception as e:
            print(f"❌ TEST B FAILED: Exception: {e}")
            tests_failed += 1
    else:
        print("❌ TEST B SKIPPED: No reviewer1 token")
        tests_failed += 1
    
    # Test C: Accept flow — abstract becomes accessible
    print("\n[TEST C] Accept flow — abstract becomes accessible")
    print("-" * 80)
    if reviewer1_token:
        try:
            # Accept invitation
            resp = requests.post(f"{BASE_URL}/reviewer/assignments/{a1_id}/respond",
                               json={"status": "ACCEPTED"},
                               headers={"Authorization": f"Bearer {reviewer1_token}"}, timeout=10)
            if resp.status_code == 200:
                assignment = resp.json().get("assignment", {})
                if assignment.get("invitationStatus") == "ACCEPTED":
                    print(f"✅ TEST C.1 PASSED: Reviewer1 accepted invitation (invitationStatus=ACCEPTED)")
                    tests_passed += 1
                else:
                    print(f"❌ TEST C.1 FAILED: invitationStatus is {assignment.get('invitationStatus')}, expected ACCEPTED")
                    tests_failed += 1
            else:
                print(f"❌ TEST C.1 FAILED: Accept response failed: {resp.status_code} - {resp.text}")
                tests_failed += 1
            
            # Try to access abstract
            resp = requests.get(f"{BASE_URL}/abstracts/{abstract_id}",
                              headers={"Authorization": f"Bearer {reviewer1_token}"}, timeout=10)
            if resp.status_code == 200:
                print(f"✅ TEST C.2 PASSED: Reviewer1 can now access abstract after accepting")
                tests_passed += 1
            else:
                print(f"❌ TEST C.2 FAILED: Expected 200, got {resp.status_code}")
                print(f"   Response: {resp.text}")
                tests_failed += 1
        except Exception as e:
            print(f"❌ TEST C FAILED: Exception: {e}")
            tests_failed += 2
    else:
        print("❌ TEST C SKIPPED: No reviewer1 token")
        tests_failed += 2
    
    # Test D: Decline flow — abstract becomes inaccessible + notifications
    print("\n[TEST D] Decline flow — abstract becomes inaccessible + notifications")
    print("-" * 80)
    reviewer2_token = login(REVIEWER2_EMAIL, PASSWORD)
    if not reviewer2_token:
        print("❌ TEST D FAILED: Cannot login as reviewer2")
        tests_failed += 3
    else:
        try:
            # Decline invitation
            resp = requests.post(f"{BASE_URL}/reviewer/assignments/{a2_id}/respond",
                               json={"status": "DECLINED", "declineReason": "Out of expertise"},
                               headers={"Authorization": f"Bearer {reviewer2_token}"}, timeout=10)
            if resp.status_code == 200:
                assignment = resp.json().get("assignment", {})
                if assignment.get("invitationStatus") == "DECLINED":
                    print(f"✅ TEST D.1 PASSED: Reviewer2 declined invitation (invitationStatus=DECLINED)")
                    tests_passed += 1
                else:
                    print(f"❌ TEST D.1 FAILED: invitationStatus is {assignment.get('invitationStatus')}, expected DECLINED")
                    tests_failed += 1
            else:
                print(f"❌ TEST D.1 FAILED: Decline response failed: {resp.status_code} - {resp.text}")
                tests_failed += 1
            
            # Try to access abstract (should be denied)
            resp = requests.get(f"{BASE_URL}/abstracts/{abstract_id}",
                              headers={"Authorization": f"Bearer {reviewer2_token}"}, timeout=10)
            if resp.status_code == 403:
                error_msg = resp.json().get("error", "")
                if "declined" in error_msg.lower():
                    print(f"✅ TEST D.2 PASSED: Reviewer2 got 403 with declined message")
                    print(f"   Message: {error_msg}")
                    tests_passed += 1
                else:
                    print(f"⚠️  TEST D.2 PARTIAL: Got 403 but message doesn't mention declined")
                    print(f"   Message: {error_msg}")
                    tests_passed += 1
            else:
                print(f"❌ TEST D.2 FAILED: Expected 403, got {resp.status_code}")
                print(f"   Response: {resp.text}")
                tests_failed += 1
            
            # Check notifications for chief editor
            chief_token = login(CHIEF_EMAIL, PASSWORD)
            if chief_token:
                resp = requests.get(f"{BASE_URL}/notifications",
                                  headers={"Authorization": f"Bearer {chief_token}"}, timeout=10)
                if resp.status_code == 200:
                    notifications = resp.json().get("notifications", [])
                    decline_notif = None
                    for notif in notifications:
                        if notif.get("type") == "REVIEW_DECLINED" and submission_code in notif.get("title", ""):
                            decline_notif = notif
                            break
                    
                    if decline_notif:
                        title = decline_notif.get("title", "")
                        body = decline_notif.get("body", "")
                        print(f"✅ TEST D.3 PASSED: Chief editor received REVIEW_DECLINED notification")
                        print(f"   Title: {title}")
                        print(f"   Body: {body}")
                        if "declined" in title.lower() and submission_code in title:
                            print(f"   ✓ Title contains 'declined' and submission code")
                        if REVIEWER2_EMAIL in body or "reviewer2" in body.lower():
                            print(f"   ✓ Body contains reviewer2 reference")
                        tests_passed += 1
                    else:
                        print(f"❌ TEST D.3 FAILED: No REVIEW_DECLINED notification found for chief editor")
                        print(f"   Total notifications: {len(notifications)}")
                        tests_failed += 1
                else:
                    print(f"❌ TEST D.3 FAILED: Cannot get notifications: {resp.status_code}")
                    tests_failed += 1
            else:
                print(f"❌ TEST D.3 FAILED: Cannot login as chief")
                tests_failed += 1
        except Exception as e:
            print(f"❌ TEST D FAILED: Exception: {e}")
            tests_failed += 3
    
    # Test E: Reviewer1 keeps access after Reviewer2 declines
    print("\n[TEST E] Reviewer1 keeps access after Reviewer2 declines")
    print("-" * 80)
    if reviewer1_token:
        try:
            resp = requests.get(f"{BASE_URL}/abstracts/{abstract_id}",
                              headers={"Authorization": f"Bearer {reviewer1_token}"}, timeout=10)
            if resp.status_code == 200:
                print(f"✅ TEST E PASSED: Reviewer1 still has access after Reviewer2 declined")
                tests_passed += 1
            else:
                print(f"❌ TEST E FAILED: Expected 200, got {resp.status_code}")
                print(f"   Response: {resp.text}")
                tests_failed += 1
        except Exception as e:
            print(f"❌ TEST E FAILED: Exception: {e}")
            tests_failed += 1
    else:
        print("❌ TEST E SKIPPED: No reviewer1 token")
        tests_failed += 1
    
    # Test F: Guard against double-mutation after submission
    print("\n[TEST F] Guard against double-mutation after submission")
    print("-" * 80)
    if reviewer1_token:
        try:
            # Submit review
            review_data = {
                "originalityScore": 7,
                "significanceScore": 7,
                "methodologyScore": 7,
                "clarityScore": 7,
                "overallScore": 7,
                "commentsToAuthor": "Good work",
                "recommendation": "ACCEPT"
            }
            resp = requests.post(f"{BASE_URL}/reviewer/assignments/{a1_id}/submit",
                               json=review_data,
                               headers={"Authorization": f"Bearer {reviewer1_token}"}, timeout=10)
            if resp.status_code == 200:
                print(f"✅ TEST F.1 PASSED: Reviewer1 submitted review successfully")
                tests_passed += 1
            else:
                print(f"❌ TEST F.1 FAILED: Review submission failed: {resp.status_code} - {resp.text}")
                tests_failed += 1
            
            # Try to change response after submission
            resp = requests.post(f"{BASE_URL}/reviewer/assignments/{a1_id}/respond",
                               json={"status": "DECLINED"},
                               headers={"Authorization": f"Bearer {reviewer1_token}"}, timeout=10)
            if resp.status_code == 409:
                error_msg = resp.json().get("error", "")
                if "already has a submitted review" in error_msg or "cannot be changed" in error_msg:
                    print(f"✅ TEST F.2 PASSED: Got 409 when trying to change response after submission")
                    print(f"   Message: {error_msg}")
                    tests_passed += 1
                else:
                    print(f"⚠️  TEST F.2 PARTIAL: Got 409 but message unclear")
                    print(f"   Message: {error_msg}")
                    tests_passed += 1
            else:
                print(f"❌ TEST F.2 FAILED: Expected 409, got {resp.status_code}")
                print(f"   Response: {resp.text}")
                tests_failed += 1
        except Exception as e:
            print(f"❌ TEST F FAILED: Exception: {e}")
            tests_failed += 2
    else:
        print("❌ TEST F SKIPPED: No reviewer1 token")
        tests_failed += 2
    
    # ========== NO REGRESSIONS ==========
    print("\n" + "=" * 80)
    print("REGRESSION CHECKS")
    print("=" * 80)
    
    # Check chief editor can still access abstract
    print("\n[REGRESSION 1] Chief editor can still access abstract")
    chief_token = login(CHIEF_EMAIL, PASSWORD)
    if chief_token:
        try:
            resp = requests.get(f"{BASE_URL}/abstracts/{abstract_id}",
                              headers={"Authorization": f"Bearer {chief_token}"}, timeout=10)
            if resp.status_code == 200:
                print(f"✅ REGRESSION 1 PASSED: Chief editor can access abstract")
                tests_passed += 1
            else:
                print(f"❌ REGRESSION 1 FAILED: Expected 200, got {resp.status_code}")
                tests_failed += 1
        except Exception as e:
            print(f"❌ REGRESSION 1 FAILED: Exception: {e}")
            tests_failed += 1
    else:
        print("❌ REGRESSION 1 SKIPPED: Cannot login as chief")
        tests_failed += 1
    
    # Check admin can still access abstract
    print("\n[REGRESSION 2] Admin can still access abstract")
    if admin_token:
        try:
            resp = requests.get(f"{BASE_URL}/abstracts/{abstract_id}",
                              headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
            if resp.status_code == 200:
                print(f"✅ REGRESSION 2 PASSED: Admin can access abstract")
                tests_passed += 1
            else:
                print(f"❌ REGRESSION 2 FAILED: Expected 200, got {resp.status_code}")
                tests_failed += 1
        except Exception as e:
            print(f"❌ REGRESSION 2 FAILED: Exception: {e}")
            tests_failed += 1
    else:
        print("❌ REGRESSION 2 SKIPPED: No admin token")
        tests_failed += 1
    
    # Check author can still access their abstract
    print("\n[REGRESSION 3] Author can still access their abstract")
    if author_token:
        try:
            resp = requests.get(f"{BASE_URL}/abstracts/{abstract_id}",
                              headers={"Authorization": f"Bearer {author_token}"}, timeout=10)
            if resp.status_code == 200:
                print(f"✅ REGRESSION 3 PASSED: Author can access their abstract")
                tests_passed += 1
            else:
                print(f"❌ REGRESSION 3 FAILED: Expected 200, got {resp.status_code}")
                tests_failed += 1
        except Exception as e:
            print(f"❌ REGRESSION 3 FAILED: Exception: {e}")
            tests_failed += 1
    else:
        print("❌ REGRESSION 3 SKIPPED: No author token")
        tests_failed += 1
    
    # ========== SUMMARY ==========
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    total_tests = tests_passed + tests_failed
    success_rate = (tests_passed / total_tests * 100) if total_tests > 0 else 0
    
    print(f"\nTotal Tests: {total_tests}")
    print(f"✅ Passed: {tests_passed}")
    print(f"❌ Failed: {tests_failed}")
    print(f"Success Rate: {success_rate:.1f}%")
    
    if tests_failed == 0:
        print("\n🎉 ALL TESTS PASSED!")
        return 0
    else:
        print(f"\n⚠️  {tests_failed} TEST(S) FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())
