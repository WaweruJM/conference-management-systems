#!/usr/bin/env python3
"""
Backend test for revised editorial process auto-tick behaviour.

Test Scope:
- POST /api/abstracts/:id/technical-scores now transitions to TECHNICAL_CHECK (was EDITORIAL_ASSIGNMENT)
- Guard: only trigger when state is SUBMITTED or EDITORIAL_ASSIGNMENT
- Regression: POST /api/abstracts/:id/assign-editor still works correctly
"""

import requests
import json
import sys

BASE_URL = "https://scms-platform-1.preview.emergentagent.com/api"

# Test users
USERS = {
    "admin": {"email": "admin@scms.io", "password": "password123"},
    "chief": {"email": "chief@scms.io", "password": "password123"},
    "committee": {"email": "committee@scms.io", "password": "password123"},
    "committee2": {"email": "committee2@scms.io", "password": "password123"},
    "author": {"email": "author@scms.io", "password": "password123"},
}

def login(email, password):
    """Login and return JWT token"""
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            token = data.get("token")
            print(f"✅ Login successful: {email}")
            return token
        else:
            print(f"❌ Login failed for {email}: {resp.status_code} - {resp.text}")
            return None
    except Exception as e:
        print(f"❌ Login exception for {email}: {e}")
        return None

def get_headers(token):
    """Get headers with Authorization"""
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

def get_featured_conference(token):
    """Get featured conference from /public/config"""
    try:
        resp = requests.get(f"{BASE_URL}/public/config", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            conf = data.get("conference") or data.get("featuredConference")
            if conf:
                print(f"✅ Featured conference: {conf.get('name')} (ID: {conf.get('id')})")
                return conf
            else:
                print("❌ No featured conference found")
                return None
        else:
            print(f"❌ Failed to get public config: {resp.status_code}")
            return None
    except Exception as e:
        print(f"❌ Exception getting featured conference: {e}")
        return None

def get_abstracts(token, scope=None, state=None):
    """Get abstracts list"""
    try:
        params = {}
        if scope:
            params["scope"] = scope
        if state:
            params["state"] = state
        
        resp = requests.get(f"{BASE_URL}/abstracts", headers=get_headers(token), params=params, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            abstracts = data.get("abstracts", [])
            print(f"✅ GET /abstracts returned {len(abstracts)} abstracts")
            return abstracts
        else:
            print(f"❌ GET /abstracts failed: {resp.status_code} - {resp.text}")
            return None
    except Exception as e:
        print(f"❌ Exception getting abstracts: {e}")
        return None

def get_abstract_detail(token, abs_id):
    """Get abstract detail"""
    try:
        resp = requests.get(f"{BASE_URL}/abstracts/{abs_id}", headers=get_headers(token), timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            abstract = data.get("abstract")
            print(f"✅ GET /abstracts/{abs_id} returned abstract: {abstract.get('submissionCode')} (state: {abstract.get('currentState')})")
            return abstract
        else:
            print(f"❌ GET /abstracts/{abs_id} failed: {resp.status_code} - {resp.text}")
            return None
    except Exception as e:
        print(f"❌ Exception getting abstract detail: {e}")
        return None

def create_abstract(token, conf_id):
    """Create a draft abstract"""
    try:
        payload = {
            "conferenceId": conf_id,
            "title": "Test Abstract for Technical Scores Auto-Tick",
            "body": "This is a test abstract body for verifying the revised editorial process auto-tick behaviour.",
            "keywords": ["test", "technical-scores", "auto-tick"],
            "reportType": "ORAL",
            "authors": [
                {
                    "fullName": "Test Author",
                    "email": "test@example.com",
                    "affiliation": "Test University",
                    "isCorresponding": True,
                    "orderIndex": 0
                }
            ]
        }
        resp = requests.post(f"{BASE_URL}/abstracts", headers=get_headers(token), json=payload, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            abstract = data.get("abstract")
            print(f"✅ Created abstract: {abstract.get('submissionCode')} (ID: {abstract.get('id')})")
            return abstract
        else:
            print(f"❌ Failed to create abstract: {resp.status_code} - {resp.text}")
            return None
    except Exception as e:
        print(f"❌ Exception creating abstract: {e}")
        return None

def submit_abstract(token, abs_id):
    """Submit abstract (DRAFT -> SUBMITTED)"""
    try:
        resp = requests.post(f"{BASE_URL}/abstracts/{abs_id}/submit", headers=get_headers(token), timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            abstract = data.get("abstract")
            print(f"✅ Submitted abstract: {abstract.get('submissionCode')} (state: {abstract.get('currentState')})")
            return abstract
        else:
            print(f"❌ Failed to submit abstract: {resp.status_code} - {resp.text}")
            return None
    except Exception as e:
        print(f"❌ Exception submitting abstract: {e}")
        return None

def transition_abstract(token, abs_id, new_state, comment):
    """Manually transition abstract state"""
    try:
        payload = {"newState": new_state, "comment": comment}
        resp = requests.post(f"{BASE_URL}/abstracts/{abs_id}/transition", headers=get_headers(token), json=payload, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            abstract = data.get("abstract")
            print(f"✅ Transitioned abstract to {new_state}: {abstract.get('submissionCode')}")
            return abstract
        else:
            print(f"❌ Failed to transition abstract: {resp.status_code} - {resp.text}")
            return None
    except Exception as e:
        print(f"❌ Exception transitioning abstract: {e}")
        return None

def assign_editor(token, abs_id, editor_id, role="COMMITTEE_EDITOR"):
    """Assign editor to abstract"""
    try:
        payload = {"editorId": editor_id, "role": role}
        resp = requests.post(f"{BASE_URL}/abstracts/{abs_id}/assign-editor", headers=get_headers(token), json=payload, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            assignment = data.get("assignment")
            print(f"✅ Assigned editor to abstract (assignment ID: {assignment.get('id')})")
            return assignment
        else:
            print(f"❌ Failed to assign editor: {resp.status_code} - {resp.text}")
            return None
    except Exception as e:
        print(f"❌ Exception assigning editor: {e}")
        return None

def post_technical_scores(token, abs_id, scores):
    """Post technical scores"""
    try:
        resp = requests.post(f"{BASE_URL}/abstracts/{abs_id}/scores", headers=get_headers(token), json=scores, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            score = data.get("score")
            print(f"✅ Posted technical scores (score ID: {score.get('id') if score else 'N/A'})")
            return score
        else:
            print(f"❌ Failed to post technical scores: {resp.status_code} - {resp.text}")
            return None
    except Exception as e:
        print(f"❌ Exception posting technical scores: {e}")
        return None

def get_notifications(token):
    """Get notifications"""
    try:
        resp = requests.get(f"{BASE_URL}/notifications", headers=get_headers(token), timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            notifications = data.get("notifications", [])
            print(f"✅ GET /notifications returned {len(notifications)} notifications")
            return notifications
        else:
            print(f"❌ GET /notifications failed: {resp.status_code} - {resp.text}")
            return None
    except Exception as e:
        print(f"❌ Exception getting notifications: {e}")
        return None

def get_user_id(token, email):
    """Get user ID by email"""
    try:
        resp = requests.get(f"{BASE_URL}/users", headers=get_headers(token), timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            users = data.get("users", [])
            for user in users:
                if user.get("email") == email:
                    print(f"✅ Found user ID for {email}: {user.get('id')}")
                    return user.get("id")
            print(f"❌ User not found: {email}")
            return None
        else:
            print(f"❌ GET /users failed: {resp.status_code} - {resp.text}")
            return None
    except Exception as e:
        print(f"❌ Exception getting user ID: {e}")
        return None

def main():
    print("=" * 80)
    print("BACKEND TEST: Revised Editorial Process Auto-Tick Behaviour")
    print("=" * 80)
    
    # Step 1: Login as admin and get featured conference
    print("\n" + "=" * 80)
    print("STEP 1: Setup - Login and get featured conference")
    print("=" * 80)
    
    admin_token = login(USERS["admin"]["email"], USERS["admin"]["password"])
    if not admin_token:
        print("❌ CRITICAL: Admin login failed")
        sys.exit(1)
    
    conf = get_featured_conference(admin_token)
    if not conf:
        print("❌ CRITICAL: Failed to get featured conference")
        sys.exit(1)
    
    conf_id = conf.get("id")
    
    # Get existing SUBMITTED or EDITORIAL_ASSIGNMENT abstract
    abstracts = get_abstracts(admin_token)
    if not abstracts:
        print("❌ CRITICAL: Failed to get abstracts")
        sys.exit(1)
    
    # Find a suitable abstract or create one
    test_abstract = None
    for abs in abstracts:
        if abs.get("currentState") in ["SUBMITTED", "EDITORIAL_ASSIGNMENT"]:
            test_abstract = abs
            print(f"✅ Found existing abstract in suitable state: {abs.get('submissionCode')} (state: {abs.get('currentState')})")
            break
    
    if not test_abstract:
        print("⚠️  No suitable abstract found, creating new one...")
        # Login as author to create abstract
        author_token = login(USERS["author"]["email"], USERS["author"]["password"])
        if not author_token:
            print("❌ CRITICAL: Author login failed")
            sys.exit(1)
        
        test_abstract = create_abstract(author_token, conf_id)
        if not test_abstract:
            print("❌ CRITICAL: Failed to create abstract")
            sys.exit(1)
        
        # Submit the abstract
        test_abstract = submit_abstract(author_token, test_abstract.get("id"))
        if not test_abstract:
            print("❌ CRITICAL: Failed to submit abstract")
            sys.exit(1)
        
        # Transition to SUBMITTED if needed
        if test_abstract.get("currentState") != "SUBMITTED":
            test_abstract = transition_abstract(admin_token, test_abstract.get("id"), "SUBMITTED", "prep for test")
            if not test_abstract:
                print("❌ CRITICAL: Failed to transition to SUBMITTED")
                sys.exit(1)
    
    abs_id = test_abstract.get("id")
    submission_code = test_abstract.get("submissionCode")
    
    print(f"\n✅ Test abstract ready: {submission_code} (ID: {abs_id})")
    
    # Step 2: Assign-editor regression test
    print("\n" + "=" * 80)
    print("STEP 2: Assign-editor regression test")
    print("=" * 80)
    
    # Login as chief
    chief_token = login(USERS["chief"]["email"], USERS["chief"]["password"])
    if not chief_token:
        print("❌ CRITICAL: Chief login failed")
        sys.exit(1)
    
    # Get committee user ID
    committee_id = get_user_id(admin_token, USERS["committee"]["email"])
    if not committee_id:
        print("❌ CRITICAL: Failed to get committee user ID")
        sys.exit(1)
    
    # Assign editor
    assignment = assign_editor(chief_token, abs_id, committee_id, "COMMITTEE_EDITOR")
    if not assignment:
        print("❌ TEST FAILED: assign-editor endpoint failed")
        sys.exit(1)
    
    # Verify state is EDITORIAL_ASSIGNMENT
    test_abstract = get_abstract_detail(admin_token, abs_id)
    if not test_abstract:
        print("❌ TEST FAILED: Failed to get abstract after assign-editor")
        sys.exit(1)
    
    if test_abstract.get("currentState") != "EDITORIAL_ASSIGNMENT":
        print(f"❌ TEST FAILED: Expected state EDITORIAL_ASSIGNMENT, got {test_abstract.get('currentState')}")
        sys.exit(1)
    
    print(f"✅ TEST PASSED: Abstract transitioned to EDITORIAL_ASSIGNMENT")
    
    # Login as committee and verify notification
    committee_token = login(USERS["committee"]["email"], USERS["committee"]["password"])
    if not committee_token:
        print("❌ CRITICAL: Committee login failed")
        sys.exit(1)
    
    notifications = get_notifications(committee_token)
    if notifications is None:
        print("❌ TEST FAILED: Failed to get notifications")
        sys.exit(1)
    
    # Find ASSIGNMENT notification
    assignment_notif = None
    for notif in notifications:
        if notif.get("type") == "ASSIGNMENT" and notif.get("title") == "New editor assignment" and submission_code in notif.get("body", ""):
            assignment_notif = notif
            break
    
    if not assignment_notif:
        print("❌ TEST FAILED: ASSIGNMENT notification not found")
        sys.exit(1)
    
    print(f"✅ TEST PASSED: ASSIGNMENT notification found with title 'New editor assignment'")
    
    # Verify abstract is in scope=assigned
    assigned_abstracts = get_abstracts(committee_token, scope="assigned")
    if assigned_abstracts is None:
        print("❌ TEST FAILED: Failed to get assigned abstracts")
        sys.exit(1)
    
    found_in_assigned = False
    for abs in assigned_abstracts:
        if abs.get("id") == abs_id:
            found_in_assigned = True
            break
    
    if not found_in_assigned:
        print("❌ TEST FAILED: Abstract not found in scope=assigned")
        sys.exit(1)
    
    print(f"✅ TEST PASSED: Abstract found in GET /abstracts?scope=assigned")
    
    # Step 3: Auto-tick technical check
    print("\n" + "=" * 80)
    print("STEP 3: Auto-tick technical check (EDITORIAL_ASSIGNMENT -> TECHNICAL_CHECK)")
    print("=" * 80)
    
    # Post technical scores as committee member
    scores = {
        "originality": 8,
        "methodology": 7,
        "relevance": 8,
        "language": 7,
        "themeAlignment": 8,
        "comments": "OK"
    }
    
    score = post_technical_scores(committee_token, abs_id, scores)
    if not score:
        print("❌ TEST FAILED: Failed to post technical scores")
        sys.exit(1)
    
    # Verify state is now TECHNICAL_CHECK
    test_abstract = get_abstract_detail(admin_token, abs_id)
    if not test_abstract:
        print("❌ TEST FAILED: Failed to get abstract after technical scores")
        sys.exit(1)
    
    if test_abstract.get("currentState") != "TECHNICAL_CHECK":
        print(f"❌ TEST FAILED: Expected state TECHNICAL_CHECK, got {test_abstract.get('currentState')}")
        sys.exit(1)
    
    print(f"✅ TEST PASSED: Abstract auto-transitioned to TECHNICAL_CHECK")
    
    # Step 4: Idempotent save
    print("\n" + "=" * 80)
    print("STEP 4: Idempotent save (state should remain TECHNICAL_CHECK)")
    print("=" * 80)
    
    # Post same scores again
    score = post_technical_scores(committee_token, abs_id, scores)
    if not score:
        print("❌ TEST FAILED: Failed to post technical scores (idempotent)")
        sys.exit(1)
    
    # Verify state is still TECHNICAL_CHECK
    test_abstract = get_abstract_detail(admin_token, abs_id)
    if not test_abstract:
        print("❌ TEST FAILED: Failed to get abstract after idempotent save")
        sys.exit(1)
    
    if test_abstract.get("currentState") != "TECHNICAL_CHECK":
        print(f"❌ TEST FAILED: State changed on idempotent save, got {test_abstract.get('currentState')}")
        sys.exit(1)
    
    print(f"✅ TEST PASSED: State remained TECHNICAL_CHECK on idempotent save")
    
    # Step 5: No transition when already past
    print("\n" + "=" * 80)
    print("STEP 5: No transition when already past (advance to COMMITTEE_REVIEW)")
    print("=" * 80)
    
    # Manually transition to COMMITTEE_REVIEW
    test_abstract = transition_abstract(admin_token, abs_id, "COMMITTEE_REVIEW", "advance for test")
    if not test_abstract:
        print("❌ TEST FAILED: Failed to transition to COMMITTEE_REVIEW")
        sys.exit(1)
    
    # Login as committee2 and post technical scores
    committee2_token = login(USERS["committee2"]["email"], USERS["committee2"]["password"])
    if not committee2_token:
        print("❌ CRITICAL: Committee2 login failed")
        sys.exit(1)
    
    score = post_technical_scores(committee2_token, abs_id, scores)
    if not score:
        print("❌ TEST FAILED: Failed to post technical scores (committee2)")
        sys.exit(1)
    
    # Verify state is still COMMITTEE_REVIEW (not rolled back)
    test_abstract = get_abstract_detail(admin_token, abs_id)
    if not test_abstract:
        print("❌ TEST FAILED: Failed to get abstract after downstream technical scores")
        sys.exit(1)
    
    if test_abstract.get("currentState") != "COMMITTEE_REVIEW":
        print(f"❌ TEST FAILED: State rolled back from COMMITTEE_REVIEW to {test_abstract.get('currentState')}")
        sys.exit(1)
    
    print(f"✅ TEST PASSED: State remained COMMITTEE_REVIEW (no rollback)")
    
    # Step 6: Auto-tick from SUBMITTED directly
    print("\n" + "=" * 80)
    print("STEP 6: Auto-tick from SUBMITTED directly")
    print("=" * 80)
    
    # Find or create an abstract in SUBMITTED state
    # First, try to find an existing SUBMITTED abstract
    all_abstracts = get_abstracts(admin_token)
    new_abstract = None
    
    if all_abstracts:
        for abs in all_abstracts:
            if abs.get("currentState") == "SUBMITTED":
                new_abstract = abs
                print(f"✅ Found existing SUBMITTED abstract: {abs.get('submissionCode')}")
                break
    
    # If no SUBMITTED abstract found, transition the test abstract back to SUBMITTED
    if not new_abstract:
        print("⚠️  No SUBMITTED abstract found, transitioning test abstract back to SUBMITTED...")
        # First transition to SUBMITTED
        test_abstract = transition_abstract(admin_token, abs_id, "SUBMITTED", "reset for SUBMITTED test")
        if not test_abstract:
            print("❌ TEST FAILED: Failed to transition test abstract to SUBMITTED")
            sys.exit(1)
        new_abstract = test_abstract
    
    new_abs_id = new_abstract.get("id")
    new_submission_code = new_abstract.get("submissionCode")
    
    print(f"✅ Abstract ready for SUBMITTED test: {new_submission_code} (state: {new_abstract.get('currentState')})")
    
    # Post technical scores as committee member
    score = post_technical_scores(committee_token, new_abs_id, scores)
    if not score:
        print("❌ TEST FAILED: Failed to post technical scores on SUBMITTED abstract")
        sys.exit(1)
    
    # Verify state is now TECHNICAL_CHECK
    new_abstract = get_abstract_detail(admin_token, new_abs_id)
    if not new_abstract:
        print("❌ TEST FAILED: Failed to get new abstract after technical scores")
        sys.exit(1)
    
    if new_abstract.get("currentState") != "TECHNICAL_CHECK":
        print(f"❌ TEST FAILED: Expected state TECHNICAL_CHECK from SUBMITTED, got {new_abstract.get('currentState')}")
        sys.exit(1)
    
    print(f"✅ TEST PASSED: Abstract auto-transitioned from SUBMITTED to TECHNICAL_CHECK")
    
    # Final summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print("✅ All tests passed successfully!")
    print("\nTest Results:")
    print("  ✅ Step 2: Assign-editor regression (EDITORIAL_ASSIGNMENT, notification, scope=assigned)")
    print("  ✅ Step 3: Auto-tick technical check (EDITORIAL_ASSIGNMENT -> TECHNICAL_CHECK)")
    print("  ✅ Step 4: Idempotent save (state remains TECHNICAL_CHECK)")
    print("  ✅ Step 5: No transition when already past (COMMITTEE_REVIEW unchanged)")
    print("  ✅ Step 6: Auto-tick from SUBMITTED directly (SUBMITTED -> TECHNICAL_CHECK)")
    print("\n" + "=" * 80)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
