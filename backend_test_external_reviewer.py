#!/usr/bin/env python3
"""
Backend test for SCMS External Reviewer Flow
Review request: Verify end-to-end external reviewer lifecycle with auto-assignment on registration
"""
import requests
import json
import sys
import time
from datetime import datetime

# Base URL from environment
BASE_URL = "https://scms-platform-1.preview.emergentagent.com/api"

# Test credentials (all password: password123)
CREDENTIALS = {
    "admin": {"email": "admin@scms.io", "password": "password123"},
    "chief": {"email": "chief@scms.io", "password": "password123"},
    "committee": {"email": "committee@scms.io", "password": "password123"},
    "author": {"email": "author@scms.io", "password": "password123"},
}

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

def get_user_id(token):
    """Get current user ID from /auth/me"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            user = data.get("user", {})
            user_id = user.get("id")
            print(f"✅ Got user ID: {user_id} ({user.get('email')})")
            return user_id
        else:
            print(f"❌ GET /auth/me failed: {resp.status_code} - {resp.text}")
            return None
    except Exception as e:
        print(f"❌ GET /auth/me exception: {e}")
        return None

def setup_get_abstract_id(admin_token):
    """Setup: Get an abstract ID to use for testing"""
    print("\n" + "="*80)
    print("SETUP: Get an abstract ID")
    print("="*80)
    
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        resp = requests.get(f"{BASE_URL}/abstracts", headers=headers, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            abstracts = data.get("abstracts", [])
            
            if abstracts:
                abstract = abstracts[0]
                abstract_id = abstract.get("id")
                submission_code = abstract.get("submissionCode")
                title = abstract.get("title")
                print(f"✅ Found abstract: {submission_code} - {title}")
                print(f"   Abstract ID: {abstract_id}")
                return abstract_id
            else:
                print("❌ No abstracts found")
                return None
        else:
            print(f"❌ GET /abstracts failed: {resp.status_code} - {resp.text}")
            return None
    except Exception as e:
        print(f"❌ GET /abstracts exception: {e}")
        return None

def setup_assign_committee_editor(chief_token, abstract_id, committee_editor_id):
    """Setup: Assign committee editor to abstract"""
    print("\n" + "="*80)
    print("SETUP: Assign committee editor to abstract")
    print("="*80)
    
    try:
        headers = {"Authorization": f"Bearer {chief_token}", "Content-Type": "application/json"}
        payload = {
            "editorId": committee_editor_id,
            "role": "COMMITTEE_EDITOR"
        }
        
        resp = requests.post(f"{BASE_URL}/abstracts/{abstract_id}/assign-editor", headers=headers, json=payload, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            assignment = data.get("assignment")
            print(f"✅ Committee editor assigned to abstract")
            print(f"   Assignment ID: {assignment.get('id')}")
            print(f"   Editor ID: {assignment.get('editorId')}")
            print(f"   Role: {assignment.get('role')}")
            return True
        else:
            print(f"❌ POST /abstracts/{abstract_id}/assign-editor failed: {resp.status_code} - {resp.text}")
            return False
    except Exception as e:
        print(f"❌ POST /abstracts/{abstract_id}/assign-editor exception: {e}")
        return False

def test_step1_invite_external_reviewer(committee_token, abstract_id):
    """Step 1: Committee editor invites external reviewer with abstractId"""
    print("\n" + "="*80)
    print("STEP 1: Committee editor invites external reviewer with abstractId")
    print("="*80)
    
    timestamp = int(time.time())
    reviewer_email = f"ext-{timestamp}@example.com"
    
    try:
        headers = {"Authorization": f"Bearer {committee_token}", "Content-Type": "application/json"}
        payload = {
            "email": reviewer_email,
            "fullName": "Dr External Test",
            "specialty": "Cardiology",
            "message": "Please review our abstract.",
            "abstractId": abstract_id
        }
        
        resp = requests.post(f"{BASE_URL}/reviewer-invitations", headers=headers, json=payload, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            invitation = data.get("invitation")
            delivery = data.get("delivery")
            
            # Verify invitation structure
            if not invitation:
                print("❌ Response missing 'invitation' object")
                return None, None
            
            token = invitation.get("token")
            inv_abstract_id = invitation.get("abstractId")
            
            if not token:
                print("❌ Invitation missing 'token' field")
                return None, None
            
            if inv_abstract_id != abstract_id:
                print(f"❌ Invitation abstractId mismatch: expected {abstract_id}, got {inv_abstract_id}")
                return None, None
            
            print(f"✅ POST /reviewer-invitations returned 200")
            print(f"   - Invitation ID: {invitation.get('id')}")
            print(f"   - Token: {token[:20]}...")
            print(f"   - Email: {invitation.get('email')}")
            print(f"   - Full Name: {invitation.get('fullName')}")
            print(f"   - Specialty: {invitation.get('specialty')}")
            print(f"   - Abstract ID: {inv_abstract_id} ✅ (CRITICAL: abstractId persisted)")
            
            if delivery:
                print(f"   - Delivery sent: {delivery.get('sent')}")
                if not delivery.get('sent'):
                    print(f"   ⚠️  Email delivery failed (502 expected) - we're testing DB persistence + auto-assignment")
            
            return token, reviewer_email
        elif resp.status_code == 502:
            print(f"⚠️  POST /reviewer-invitations returned 502 - email delivery failed")
            print("   Note: Invitation record may have been created before email failure")
            print("   Attempting to retrieve invitation from database...")
            
            # Wait a moment for DB write to complete
            time.sleep(1)
            
            # Try to get the invitation from the list
            try:
                headers_get = {"Authorization": f"Bearer {committee_token}"}
                resp_get = requests.get(f"{BASE_URL}/reviewer-invitations", headers=headers_get, timeout=10)
                
                if resp_get.status_code == 200:
                    data_get = resp_get.json()
                    invitations = data_get.get("invitations", [])
                    
                    # Find the invitation we just created (by email)
                    for inv in invitations:
                        if inv.get("email") == reviewer_email:
                            token = inv.get("token")
                            inv_abstract_id = inv.get("abstractId")
                            
                            print(f"✅ Found invitation in database despite 502 error")
                            print(f"   - Invitation ID: {inv.get('id')}")
                            print(f"   - Token: {token[:20]}...")
                            print(f"   - Email: {inv.get('email')}")
                            print(f"   - Full Name: {inv.get('fullName')}")
                            print(f"   - Specialty: {inv.get('specialty')}")
                            print(f"   - Abstract ID: {inv_abstract_id} ✅ (CRITICAL: abstractId persisted)")
                            print(f"   - Email delivery: FAILED (as expected - testing DB persistence + auto-assignment)")
                            
                            if inv_abstract_id != abstract_id:
                                print(f"   ❌ Invitation abstractId mismatch: expected {abstract_id}, got {inv_abstract_id}")
                                return None, None
                            
                            return token, reviewer_email
                    
                    print(f"   ❌ Invitation not found in database for email {reviewer_email}")
                    return None, None
            except Exception as e:
                print(f"   ❌ Failed to retrieve invitation: {e}")
                return None, None
        else:
            print(f"❌ POST /reviewer-invitations failed: {resp.status_code} - {resp.text[:200]}")
            return None, None
    except Exception as e:
        print(f"❌ POST /reviewer-invitations exception: {e}")
        return None, None

def test_step2_register_with_invite_token(invite_token, reviewer_email):
    """Step 2: External reviewer registers using invite token"""
    print("\n" + "="*80)
    print("STEP 2: External reviewer registers using invite token")
    print("="*80)
    
    try:
        payload = {
            "email": reviewer_email,
            "password": "Reviewer123!",
            "firstName": "External",
            "lastName": "Reviewer",
            "inviteToken": invite_token,
            "affiliation": "External Uni"
        }
        
        resp = requests.post(f"{BASE_URL}/auth/register", json=payload, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            user = data.get("user")
            token = data.get("token")
            
            if not user or not token:
                print("❌ Response missing 'user' or 'token'")
                return None
            
            # Verify EXTERNAL_REVIEWER role
            roles = user.get("roles", [])
            role_names = [r.get("role") for r in roles]
            
            if "EXTERNAL_REVIEWER" not in role_names:
                print(f"❌ User does not have EXTERNAL_REVIEWER role. Roles: {role_names}")
                return None
            
            print(f"✅ POST /auth/register returned 200")
            print(f"   - User ID: {user.get('id')}")
            print(f"   - Email: {user.get('email')}")
            print(f"   - Name: {user.get('firstName')} {user.get('lastName')}")
            print(f"   - Roles: {role_names} ✅ (EXTERNAL_REVIEWER role assigned)")
            print(f"   - JWT token: {token[:20]}...")
            
            return token
        else:
            print(f"❌ POST /auth/register failed: {resp.status_code} - {resp.text}")
            return None
    except Exception as e:
        print(f"❌ POST /auth/register exception: {e}")
        return None

def test_step3_verify_auto_assignment(reviewer_token, abstract_id):
    """Step 3: Verify auto-assignment fired - reviewer has assignment for the abstract"""
    print("\n" + "="*80)
    print("STEP 3: Verify auto-assignment fired (CRITICAL VERIFICATION)")
    print("="*80)
    
    try:
        headers = {"Authorization": f"Bearer {reviewer_token}"}
        resp = requests.get(f"{BASE_URL}/reviewer/assignments", headers=headers, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            assignments = data.get("assignments", [])
            
            print(f"✅ GET /reviewer/assignments returned 200")
            print(f"   - Total assignments: {len(assignments)}")
            
            # Find assignment for our abstract
            matching_assignment = None
            for assignment in assignments:
                abstract = assignment.get("abstract", {})
                if abstract.get("id") == abstract_id:
                    matching_assignment = assignment
                    break
            
            if not matching_assignment:
                print(f"❌ CRITICAL FAILURE: No assignment found for abstract {abstract_id}")
                print(f"   Available assignments:")
                for a in assignments:
                    print(f"   - Abstract ID: {a.get('abstract', {}).get('id')}")
                return False
            
            # Verify assignment details
            inv_status = matching_assignment.get("invitationStatus")
            review_type = matching_assignment.get("reviewType")
            assigned_at = matching_assignment.get("assignedAt")
            
            print(f"✅ CRITICAL SUCCESS: Auto-assignment found!")
            print(f"   - Assignment ID: {matching_assignment.get('id')}")
            print(f"   - Abstract ID: {matching_assignment.get('abstract', {}).get('id')} ✅")
            print(f"   - Invitation Status: {inv_status}")
            print(f"   - Review Type: {review_type}")
            print(f"   - Assigned At: {assigned_at}")
            
            # Verify critical fields
            if inv_status != "ACCEPTED":
                print(f"   ⚠️  Expected invitationStatus=ACCEPTED, got {inv_status}")
                return False
            
            if review_type != "EXTERNAL_REVIEWER":
                print(f"   ⚠️  Expected reviewType=EXTERNAL_REVIEWER, got {review_type}")
                return False
            
            print(f"   ✅ invitationStatus = ACCEPTED")
            print(f"   ✅ reviewType = EXTERNAL_REVIEWER")
            
            return True
        else:
            print(f"❌ GET /reviewer/assignments failed: {resp.status_code} - {resp.text}")
            return False
    except Exception as e:
        print(f"❌ GET /reviewer/assignments exception: {e}")
        return False

def test_step4_reviewer_access_abstract(reviewer_token, abstract_id):
    """Step 4: Reviewer can access abstract details"""
    print("\n" + "="*80)
    print("STEP 4: Reviewer can access abstract details")
    print("="*80)
    
    try:
        headers = {"Authorization": f"Bearer {reviewer_token}"}
        resp = requests.get(f"{BASE_URL}/abstracts/{abstract_id}", headers=headers, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            abstract = data.get("abstract")
            
            if not abstract:
                print("❌ Response missing 'abstract' object")
                return False
            
            print(f"✅ GET /abstracts/{abstract_id} returned 200")
            print(f"   - Submission Code: {abstract.get('submissionCode')}")
            print(f"   - Title: {abstract.get('title')}")
            print(f"   - Current State: {abstract.get('currentState')}")
            
            # Check for documents/versions
            versions = abstract.get("versions", [])
            documents = abstract.get("documents", [])
            
            print(f"   - Versions: {len(versions)}")
            print(f"   - Documents: {len(documents)}")
            
            if versions:
                print(f"   ✅ Abstract has {len(versions)} version(s)")
            
            if documents:
                print(f"   ✅ Abstract has {len(documents)} document(s)")
                for doc in documents:
                    print(f"      - Document: {doc.get('filename')} (ID: {doc.get('id')})")
            
            return True
        else:
            print(f"❌ GET /abstracts/{abstract_id} failed: {resp.status_code} - {resp.text}")
            if resp.status_code == 403:
                print("   ❌ CRITICAL: EXTERNAL_REVIEWER assigned to abstract cannot read it (403)")
            return False
    except Exception as e:
        print(f"❌ GET /abstracts/{abstract_id} exception: {e}")
        return False

def test_step5_submit_review_report(reviewer_token, assignment_id):
    """Step 5: Reviewer submits review report"""
    print("\n" + "="*80)
    print("STEP 5: Reviewer submits review report")
    print("="*80)
    
    try:
        headers = {"Authorization": f"Bearer {reviewer_token}", "Content-Type": "application/json"}
        payload = {
            "recommendation": "MINOR_REVISION",
            "commentsToAuthor": "Overall a solid abstract; please clarify the methods.",
            "commentsToEditor": "Ready to accept with minor revisions.",
            "originalityScore": 8,
            "significanceScore": 8,
            "methodologyScore": 7,
            "clarityScore": 8,
            "overallScore": 8
        }
        
        resp = requests.post(f"{BASE_URL}/reviewer/assignments/{assignment_id}/submit", headers=headers, json=payload, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            report = data.get("report")
            
            if not report:
                print("❌ Response missing 'report' object")
                return False
            
            print(f"✅ POST /reviewer/assignments/{assignment_id}/submit returned 200")
            print(f"   - Report ID: {report.get('id')}")
            print(f"   - Recommendation: {report.get('recommendation')}")
            print(f"   - Originality Score: {report.get('originalityScore')}")
            print(f"   - Methodology Score: {report.get('methodologyScore')}")
            print(f"   - Overall Score: {report.get('overallScore')}")
            print(f"   - Comments to Author: {report.get('commentsToAuthor')[:50]}...")
            
            # Verify assignment is marked complete
            print("\n   Verifying assignment marked complete...")
            headers_get = {"Authorization": f"Bearer {reviewer_token}"}
            resp_get = requests.get(f"{BASE_URL}/reviewer/assignments", headers=headers_get, timeout=10)
            
            if resp_get.status_code == 200:
                data_get = resp_get.json()
                assignments = data_get.get("assignments", [])
                
                for a in assignments:
                    if a.get("id") == assignment_id:
                        completed_at = a.get("completedAt")
                        if completed_at:
                            print(f"   ✅ Assignment completedAt: {completed_at}")
                        else:
                            print(f"   ⚠️  Assignment completedAt is null")
                        break
            
            return True
        else:
            print(f"❌ POST /reviewer/assignments/{assignment_id}/submit failed: {resp.status_code} - {resp.text}")
            return False
    except Exception as e:
        print(f"❌ POST /reviewer/assignments/{assignment_id}/submit exception: {e}")
        return False

def test_step6_editor_sees_completed_review(committee_token, abstract_id):
    """Step 6: Editor sees completed review"""
    print("\n" + "="*80)
    print("STEP 6: Editor sees completed review")
    print("="*80)
    
    try:
        headers = {"Authorization": f"Bearer {committee_token}"}
        resp = requests.get(f"{BASE_URL}/abstracts/{abstract_id}", headers=headers, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            abstract = data.get("abstract")
            
            if not abstract:
                print("❌ Response missing 'abstract' object")
                return False
            
            review_assignments = abstract.get("reviewAssignments", [])
            
            print(f"✅ GET /abstracts/{abstract_id} returned 200")
            print(f"   - Review Assignments: {len(review_assignments)}")
            
            # Find our external reviewer's assignment
            completed_found = False
            for ra in review_assignments:
                reviewer = ra.get("reviewer", {})
                completed_at = ra.get("completedAt")
                report = ra.get("report")
                
                print(f"\n   Review Assignment:")
                print(f"   - Reviewer: {reviewer.get('firstName')} {reviewer.get('lastName')}")
                print(f"   - Email: {reviewer.get('email')}")
                print(f"   - Status: {ra.get('invitationStatus')}")
                print(f"   - Completed At: {completed_at}")
                
                if completed_at:
                    completed_found = True
                    print(f"   ✅ Review completed")
                    
                    if report:
                        print(f"   - Report ID: {report.get('id')}")
                        print(f"   - Recommendation: {report.get('recommendation')}")
                        print(f"   ✅ Report object present")
            
            if completed_found:
                print(f"\n✅ Editor can see completed review")
                return True
            else:
                print(f"\n⚠️  No completed reviews found")
                return False
        else:
            print(f"❌ GET /abstracts/{abstract_id} failed: {resp.status_code} - {resp.text}")
            return False
    except Exception as e:
        print(f"❌ GET /abstracts/{abstract_id} exception: {e}")
        return False

def test_regression_auth():
    """Regression: Auth endpoints"""
    print("\n" + "="*80)
    print("REGRESSION: Auth endpoints")
    print("="*80)
    
    results = []
    
    for role, creds in CREDENTIALS.items():
        token = login(creds["email"], creds["password"])
        if token and token.startswith("eyJ"):
            results.append(True)
        else:
            results.append(False)
    
    return all(results)

def test_regression_abstracts(admin_token):
    """Regression: GET /abstracts"""
    print("\n" + "="*80)
    print("REGRESSION: GET /abstracts")
    print("="*80)
    
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        resp = requests.get(f"{BASE_URL}/abstracts", headers=headers, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            abstracts = data.get("abstracts", [])
            print(f"✅ GET /abstracts returned 200 with {len(abstracts)} abstracts")
            return True
        else:
            print(f"❌ GET /abstracts failed: {resp.status_code} - {resp.text}")
            return False
    except Exception as e:
        print(f"❌ GET /abstracts exception: {e}")
        return False

def main():
    print("="*80)
    print("SCMS BACKEND TEST — External Reviewer Flow End-to-End")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print()
    
    # Login all accounts
    print("Logging in all test accounts...")
    admin_token = login(CREDENTIALS["admin"]["email"], CREDENTIALS["admin"]["password"])
    chief_token = login(CREDENTIALS["chief"]["email"], CREDENTIALS["chief"]["password"])
    committee_token = login(CREDENTIALS["committee"]["email"], CREDENTIALS["committee"]["password"])
    author_token = login(CREDENTIALS["author"]["email"], CREDENTIALS["author"]["password"])
    
    if not all([admin_token, chief_token, committee_token, author_token]):
        print("\n❌ FAILED: Could not login all accounts")
        sys.exit(1)
    
    # Get committee editor user ID
    committee_editor_id = get_user_id(committee_token)
    if not committee_editor_id:
        print("\n❌ FAILED: Could not get committee editor user ID")
        sys.exit(1)
    
    # Setup: Get abstract ID
    abstract_id = setup_get_abstract_id(admin_token)
    if not abstract_id:
        print("\n❌ FAILED: Could not get abstract ID")
        sys.exit(1)
    
    # Setup: Assign committee editor to abstract
    if not setup_assign_committee_editor(chief_token, abstract_id, committee_editor_id):
        print("\n❌ FAILED: Could not assign committee editor")
        sys.exit(1)
    
    # Run test steps
    test_results = []
    
    # Step 1: Invite external reviewer
    invite_token, reviewer_email = test_step1_invite_external_reviewer(committee_token, abstract_id)
    if invite_token and reviewer_email:
        test_results.append(("Step 1: Invite external reviewer with abstractId", True))
    else:
        test_results.append(("Step 1: Invite external reviewer with abstractId", False))
        print("\n❌ CRITICAL FAILURE: Cannot continue without invite token")
        print_summary(test_results)
        sys.exit(1)
    
    # Step 2: Register with invite token
    reviewer_token = test_step2_register_with_invite_token(invite_token, reviewer_email)
    if reviewer_token:
        test_results.append(("Step 2: Register with invite token", True))
    else:
        test_results.append(("Step 2: Register with invite token", False))
        print("\n❌ CRITICAL FAILURE: Cannot continue without reviewer token")
        print_summary(test_results)
        sys.exit(1)
    
    # Step 3: Verify auto-assignment (CRITICAL)
    auto_assignment_success = test_step3_verify_auto_assignment(reviewer_token, abstract_id)
    test_results.append(("Step 3: Verify auto-assignment (CRITICAL)", auto_assignment_success))
    
    if not auto_assignment_success:
        print("\n❌ CRITICAL FAILURE: Auto-assignment did not work")
        print_summary(test_results)
        sys.exit(1)
    
    # Get assignment ID for step 5
    assignment_id = None
    try:
        headers = {"Authorization": f"Bearer {reviewer_token}"}
        resp = requests.get(f"{BASE_URL}/reviewer/assignments", headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            assignments = data.get("assignments", [])
            for a in assignments:
                if a.get("abstract", {}).get("id") == abstract_id:
                    assignment_id = a.get("id")
                    break
    except Exception:
        pass
    
    # Step 4: Reviewer access abstract
    step4_success = test_step4_reviewer_access_abstract(reviewer_token, abstract_id)
    test_results.append(("Step 4: Reviewer can access abstract", step4_success))
    
    # Step 5: Submit review report
    if assignment_id:
        step5_success = test_step5_submit_review_report(reviewer_token, assignment_id)
        test_results.append(("Step 5: Submit review report", step5_success))
    else:
        print("\n⚠️  Skipping Step 5: No assignment ID found")
        test_results.append(("Step 5: Submit review report", False))
    
    # Step 6: Editor sees completed review
    step6_success = test_step6_editor_sees_completed_review(committee_token, abstract_id)
    test_results.append(("Step 6: Editor sees completed review", step6_success))
    
    # Regression tests
    test_results.append(("Regression: Auth endpoints", test_regression_auth()))
    test_results.append(("Regression: GET /abstracts", test_regression_abstracts(admin_token)))
    
    # Summary
    print_summary(test_results)
    
    passed = sum(1 for _, result in test_results if result)
    total = len(test_results)
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED")
        sys.exit(0)
    else:
        print(f"\n❌ {total - passed} TEST(S) FAILED")
        sys.exit(1)

def print_summary(test_results):
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in test_results if result)
    total = len(test_results)
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print()
    print(f"Total: {passed}/{total} tests passed ({int(passed/total*100) if total > 0 else 0}%)")

if __name__ == "__main__":
    main()
