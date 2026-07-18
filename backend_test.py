#!/usr/bin/env python3
"""
Comprehensive backend API test for SCMS (Scientific Conference Management System)
Tests all 15 scenarios end-to-end with proper error handling and reporting.
"""

import requests
import json
import sys
from typing import Dict, Any, Optional
import io

# Base URL from environment
BASE_URL = "https://scms-platform-1.preview.emergentagent.com/api"

# Test results tracking
test_results = {
    "passed": [],
    "failed": [],
    "errors": []
}

# Seed accounts
SEED_ACCOUNTS = {
    "admin": {"email": "admin@scms.io", "password": "password123"},
    "managing": {"email": "managing@scms.io", "password": "password123"},
    "section": {"email": "section@scms.io", "password": "password123"},
    "committee": {"email": "committee@scms.io", "password": "password123"},
    "reviewer1": {"email": "reviewer1@scms.io", "password": "password123"},
    "reviewer2": {"email": "reviewer2@scms.io", "password": "password123"},
    "author": {"email": "author@scms.io", "password": "password123"},
    "attendee": {"email": "attendee@scms.io", "password": "password123"},
}

# Global state for test data
test_data = {
    "sessions": {},
    "users": {},
    "conference_id": None,
    "theme_id": None,
    "abstract_id": None,
    "assignment_id": None,
    "document_id": None,
}


def log_result(test_name: str, passed: bool, message: str = ""):
    """Log test result"""
    if passed:
        test_results["passed"].append(test_name)
        print(f"✅ PASS: {test_name}")
        if message:
            print(f"   {message}")
    else:
        test_results["failed"].append(test_name)
        print(f"❌ FAIL: {test_name}")
        if message:
            print(f"   {message}")


def log_error(test_name: str, error: str):
    """Log test error"""
    test_results["errors"].append({"test": test_name, "error": error})
    print(f"🔥 ERROR: {test_name}")
    print(f"   {error}")


def create_session(role: str) -> requests.Session:
    """Create a new session for a role"""
    session = requests.Session()
    test_data["sessions"][role] = session
    return session


def login(session: requests.Session, email: str, password: str) -> Optional[Dict[str, Any]]:
    """Login and return user data"""
    try:
        resp = session.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
        if resp.status_code == 200:
            data = resp.json()
            # Store token for Bearer auth if needed
            if "token" in data:
                session.headers.update({"Authorization": f"Bearer {data['token']}"})
            return data
        return None
    except Exception as e:
        print(f"Login error: {e}")
        return None


# ============ TEST SCENARIOS ============

def test_1_auth():
    """Test 1: Authentication - register, login, logout, me, invalid credentials"""
    print("\n" + "="*80)
    print("TEST 1: Authentication")
    print("="*80)
    
    # 1.1 Register new user
    try:
        new_email = f"testuser_{hash(str(test_data))}@test.com"
        resp = requests.post(f"{BASE_URL}/auth/register", json={
            "email": new_email,
            "password": "testpass123",
            "firstName": "Test",
            "lastName": "User"
        })
        if resp.status_code == 200:
            data = resp.json()
            if "user" in data and "token" in data:
                log_result("1.1 Register new user", True, f"User created: {data['user']['email']}")
            else:
                log_result("1.1 Register new user", False, f"Missing user or token in response")
        else:
            log_result("1.1 Register new user", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_error("1.1 Register new user", str(e))
    
    # 1.2 Login with each seed account and verify roles
    for role, creds in SEED_ACCOUNTS.items():
        try:
            session = create_session(role)
            data = login(session, creds["email"], creds["password"])
            if data and "user" in data:
                user = data["user"]
                test_data["users"][role] = user
                roles = [r["role"] for r in user.get("roles", [])]
                log_result(f"1.2 Login as {role}", True, f"Roles: {roles}")
            else:
                log_result(f"1.2 Login as {role}", False, "Login failed")
        except Exception as e:
            log_error(f"1.2 Login as {role}", str(e))
    
    # 1.3 GET /auth/me
    try:
        session = test_data["sessions"]["author"]
        resp = session.get(f"{BASE_URL}/auth/me")
        if resp.status_code == 200:
            data = resp.json()
            if "user" in data:
                log_result("1.3 GET /auth/me", True, f"User: {data['user']['email']}")
            else:
                log_result("1.3 GET /auth/me", False, "No user in response")
        else:
            log_result("1.3 GET /auth/me", False, f"Status {resp.status_code}")
    except Exception as e:
        log_error("1.3 GET /auth/me", str(e))
    
    # 1.4 Logout
    try:
        session = test_data["sessions"]["author"]
        resp = session.post(f"{BASE_URL}/auth/logout")
        if resp.status_code == 200:
            log_result("1.4 Logout", True)
            # Re-login for subsequent tests
            login(session, SEED_ACCOUNTS["author"]["email"], SEED_ACCOUNTS["author"]["password"])
        else:
            log_result("1.4 Logout", False, f"Status {resp.status_code}")
    except Exception as e:
        log_error("1.4 Logout", str(e))
    
    # 1.5 Invalid credentials
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpass"
        })
        if resp.status_code == 401:
            log_result("1.5 Invalid credentials → 401", True)
        else:
            log_result("1.5 Invalid credentials → 401", False, f"Expected 401, got {resp.status_code}")
    except Exception as e:
        log_error("1.5 Invalid credentials", str(e))


def test_2_conferences():
    """Test 2: Conference & themes - GET, POST with different roles"""
    print("\n" + "="*80)
    print("TEST 2: Conferences & Themes")
    print("="*80)
    
    # 2.1 GET /conferences (unauthenticated)
    try:
        resp = requests.get(f"{BASE_URL}/conferences")
        if resp.status_code == 200:
            data = resp.json()
            conferences = data.get("conferences", [])
            if conferences:
                # Find CONF2027
                conf2027 = next((c for c in conferences if c.get("code") == "CONF2027"), None)
                if conf2027:
                    test_data["conference_id"] = conf2027["id"]
                    if conf2027.get("themes"):
                        test_data["theme_id"] = conf2027["themes"][0]["id"]
                    log_result("2.1 GET /conferences (unauthenticated)", True, 
                              f"Found CONF2027 with {len(conf2027.get('themes', []))} themes")
                else:
                    log_result("2.1 GET /conferences (unauthenticated)", False, "CONF2027 not found")
            else:
                log_result("2.1 GET /conferences (unauthenticated)", False, "No conferences found")
        else:
            log_result("2.1 GET /conferences (unauthenticated)", False, f"Status {resp.status_code}")
    except Exception as e:
        log_error("2.1 GET /conferences", str(e))
    
    # 2.2 GET /conferences/{id}
    try:
        if test_data["conference_id"]:
            resp = requests.get(f"{BASE_URL}/conferences/{test_data['conference_id']}")
            if resp.status_code == 200:
                data = resp.json()
                if "conference" in data:
                    log_result("2.2 GET /conferences/{id}", True)
                else:
                    log_result("2.2 GET /conferences/{id}", False, "No conference in response")
            else:
                log_result("2.2 GET /conferences/{id}", False, f"Status {resp.status_code}")
    except Exception as e:
        log_error("2.2 GET /conferences/{id}", str(e))
    
    # 2.3 POST /conferences as author → 403
    try:
        session = test_data["sessions"]["author"]
        resp = session.post(f"{BASE_URL}/conferences", json={
            "code": "TEST2027",
            "name": "Test Conference",
            "startDate": "2027-06-01",
            "endDate": "2027-06-03"
        })
        if resp.status_code == 403:
            log_result("2.3 POST /conferences as author → 403", True)
        else:
            log_result("2.3 POST /conferences as author → 403", False, 
                      f"Expected 403, got {resp.status_code}")
    except Exception as e:
        log_error("2.3 POST /conferences as author", str(e))
    
    # 2.4 POST /conferences as admin → 200
    try:
        session = test_data["sessions"]["admin"]
        import time
        unique_code = f"TEST{int(time.time())}"
        resp = session.post(f"{BASE_URL}/conferences", json={
            "code": unique_code,
            "name": "Test Conference 2027",
            "startDate": "2027-06-01T00:00:00Z",
            "endDate": "2027-06-03T00:00:00Z",
            "venue": "Grand Convention Center",
            "city": "Test City",
            "country": "Test Country",
            "doubleBlind": True
        })
        if resp.status_code == 200:
            data = resp.json()
            if "conference" in data:
                log_result("2.4 POST /conferences as admin → 200", True)
            else:
                log_result("2.4 POST /conferences as admin → 200", False, "No conference in response")
        else:
            log_result("2.4 POST /conferences as admin → 200", False, 
                      f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_error("2.4 POST /conferences as admin", str(e))


def test_3_abstract_lifecycle():
    """Test 3: Abstract lifecycle - create, submit, get"""
    print("\n" + "="*80)
    print("TEST 3: Abstract Lifecycle")
    print("="*80)
    
    # 3.1 POST /abstracts (create)
    try:
        session = test_data["sessions"]["author"]
        resp = session.post(f"{BASE_URL}/abstracts", json={
            "conferenceId": test_data["conference_id"],
            "themeId": test_data["theme_id"],
            "title": "Novel Approach to Machine Learning in Healthcare",
            "body": "This study presents a comprehensive analysis of machine learning applications in healthcare diagnostics.",
            "keywords": ["machine learning", "healthcare", "diagnostics", "AI"]
        })
        if resp.status_code == 200:
            data = resp.json()
            abstract = data.get("abstract")
            if abstract:
                test_data["abstract_id"] = abstract["id"]
                submission_code = abstract.get("submissionCode")
                current_state = abstract.get("currentState")
                if submission_code and submission_code.startswith("CONF2027-") and current_state == "DRAFT":
                    log_result("3.1 POST /abstracts (create)", True, 
                              f"Created {submission_code}, state: {current_state}")
                else:
                    log_result("3.1 POST /abstracts (create)", False, 
                              f"Invalid submissionCode or state: {submission_code}, {current_state}")
            else:
                log_result("3.1 POST /abstracts (create)", False, "No abstract in response")
        else:
            log_result("3.1 POST /abstracts (create)", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_error("3.1 POST /abstracts", str(e))
    
    # 3.2 POST /abstracts/{id}/submit
    try:
        session = test_data["sessions"]["author"]
        resp = session.post(f"{BASE_URL}/abstracts/{test_data['abstract_id']}/submit")
        if resp.status_code == 200:
            data = resp.json()
            abstract = data.get("abstract")
            if abstract and abstract.get("currentState") == "SUBMITTED":
                log_result("3.2 POST /abstracts/{id}/submit", True, "State: SUBMITTED")
            else:
                log_result("3.2 POST /abstracts/{id}/submit", False, 
                          f"State not SUBMITTED: {abstract.get('currentState') if abstract else 'N/A'}")
        else:
            log_result("3.2 POST /abstracts/{id}/submit", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_error("3.2 POST /abstracts/{id}/submit", str(e))
    
    # 3.3 GET /abstracts?scope=mine
    try:
        session = test_data["sessions"]["author"]
        resp = session.get(f"{BASE_URL}/abstracts?scope=mine")
        if resp.status_code == 200:
            data = resp.json()
            abstracts = data.get("abstracts", [])
            found = any(a["id"] == test_data["abstract_id"] for a in abstracts)
            if found:
                log_result("3.3 GET /abstracts?scope=mine", True, f"Found {len(abstracts)} abstracts")
            else:
                log_result("3.3 GET /abstracts?scope=mine", False, "Created abstract not in list")
        else:
            log_result("3.3 GET /abstracts?scope=mine", False, f"Status {resp.status_code}")
    except Exception as e:
        log_error("3.3 GET /abstracts?scope=mine", str(e))


def test_4_editorial_workflow():
    """Test 4: Editorial workflow - assign editor, assign reviewer"""
    print("\n" + "="*80)
    print("TEST 4: Editorial Workflow")
    print("="*80)
    
    # 4.1 GET /abstracts (as managing editor)
    try:
        session = test_data["sessions"]["managing"]
        resp = session.get(f"{BASE_URL}/abstracts")
        if resp.status_code == 200:
            data = resp.json()
            abstracts = data.get("abstracts", [])
            found = any(a["id"] == test_data["abstract_id"] for a in abstracts)
            if found:
                log_result("4.1 GET /abstracts (as managing)", True, f"Found {len(abstracts)} abstracts")
            else:
                log_result("4.1 GET /abstracts (as managing)", False, "Submitted abstract not visible")
        else:
            log_result("4.1 GET /abstracts (as managing)", False, f"Status {resp.status_code}")
    except Exception as e:
        log_error("4.1 GET /abstracts (as managing)", str(e))
    
    # 4.2 POST /abstracts/{id}/assign-editor
    try:
        session = test_data["sessions"]["managing"]
        section_editor_id = test_data["users"]["section"]["id"]
        resp = session.post(f"{BASE_URL}/abstracts/{test_data['abstract_id']}/assign-editor", json={
            "editorId": section_editor_id,
            "role": "SECTION_EDITOR"
        })
        if resp.status_code == 200:
            data = resp.json()
            if "assignment" in data:
                # Check state transition
                resp2 = session.get(f"{BASE_URL}/abstracts/{test_data['abstract_id']}")
                if resp2.status_code == 200:
                    abstract = resp2.json().get("abstract")
                    if abstract and abstract.get("currentState") == "EDITORIAL_ASSIGNMENT":
                        log_result("4.2 POST /abstracts/{id}/assign-editor", True, 
                                  "State: EDITORIAL_ASSIGNMENT")
                    else:
                        log_result("4.2 POST /abstracts/{id}/assign-editor", False, 
                                  f"State not EDITORIAL_ASSIGNMENT: {abstract.get('currentState') if abstract else 'N/A'}")
                else:
                    log_result("4.2 POST /abstracts/{id}/assign-editor", True, "Assignment created")
            else:
                log_result("4.2 POST /abstracts/{id}/assign-editor", False, "No assignment in response")
        else:
            log_result("4.2 POST /abstracts/{id}/assign-editor", False, 
                      f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_error("4.2 POST /abstracts/{id}/assign-editor", str(e))
    
    # 4.3 POST /abstracts/{id}/assign-reviewer
    try:
        session = test_data["sessions"]["managing"]
        reviewer_id = test_data["users"]["reviewer1"]["id"]
        resp = session.post(f"{BASE_URL}/abstracts/{test_data['abstract_id']}/assign-reviewer", json={
            "reviewerId": reviewer_id,
            "reviewType": "EXTERNAL_REVIEWER"
        })
        if resp.status_code == 200:
            data = resp.json()
            if "assignment" in data:
                test_data["assignment_id"] = data["assignment"]["id"]
                # Check state transition
                resp2 = session.get(f"{BASE_URL}/abstracts/{test_data['abstract_id']}")
                if resp2.status_code == 200:
                    abstract = resp2.json().get("abstract")
                    if abstract and abstract.get("currentState") == "EXTERNAL_PEER_REVIEW":
                        log_result("4.3 POST /abstracts/{id}/assign-reviewer", True, 
                                  "State: EXTERNAL_PEER_REVIEW")
                    else:
                        log_result("4.3 POST /abstracts/{id}/assign-reviewer", False, 
                                  f"State not EXTERNAL_PEER_REVIEW: {abstract.get('currentState') if abstract else 'N/A'}")
                else:
                    log_result("4.3 POST /abstracts/{id}/assign-reviewer", True, "Assignment created")
            else:
                log_result("4.3 POST /abstracts/{id}/assign-reviewer", False, "No assignment in response")
        else:
            log_result("4.3 POST /abstracts/{id}/assign-reviewer", False, 
                      f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_error("4.3 POST /abstracts/{id}/assign-reviewer", str(e))


def test_5_reviewer_workflow():
    """Test 5: Reviewer workflow - list, accept, submit review, double-blind"""
    print("\n" + "="*80)
    print("TEST 5: Reviewer Workflow")
    print("="*80)
    
    # 5.1 GET /reviewer/assignments
    try:
        session = test_data["sessions"]["reviewer1"]
        resp = session.get(f"{BASE_URL}/reviewer/assignments")
        if resp.status_code == 200:
            data = resp.json()
            assignments = data.get("assignments", [])
            found = any(a["id"] == test_data["assignment_id"] for a in assignments)
            if found:
                assignment = next(a for a in assignments if a["id"] == test_data["assignment_id"])
                invitation_status = assignment.get("invitationStatus")
                # Check double-blind
                abstract = assignment.get("abstract", {})
                authors = abstract.get("authors")
                submitted_by = abstract.get("submittedBy")
                if authors is None or submitted_by is None:
                    log_result("5.1 GET /reviewer/assignments (double-blind)", True, 
                              f"Status: {invitation_status}, authors hidden")
                else:
                    log_result("5.1 GET /reviewer/assignments (double-blind)", False, 
                              "Authors not hidden in double-blind conference")
            else:
                log_result("5.1 GET /reviewer/assignments", False, "Assignment not found")
        else:
            log_result("5.1 GET /reviewer/assignments", False, f"Status {resp.status_code}")
    except Exception as e:
        log_error("5.1 GET /reviewer/assignments", str(e))
    
    # 5.2 POST /reviewer/assignments/{id}/respond (accept)
    try:
        session = test_data["sessions"]["reviewer1"]
        resp = session.post(f"{BASE_URL}/reviewer/assignments/{test_data['assignment_id']}/respond", json={
            "status": "ACCEPTED"
        })
        if resp.status_code == 200:
            data = resp.json()
            if "assignment" in data:
                log_result("5.2 POST /reviewer/assignments/{id}/respond", True, "Status: ACCEPTED")
            else:
                log_result("5.2 POST /reviewer/assignments/{id}/respond", False, "No assignment in response")
        else:
            log_result("5.2 POST /reviewer/assignments/{id}/respond", False, 
                      f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_error("5.2 POST /reviewer/assignments/{id}/respond", str(e))
    
    # 5.3 POST /reviewer/assignments/{id}/submit (review report)
    try:
        session = test_data["sessions"]["reviewer1"]
        resp = session.post(f"{BASE_URL}/reviewer/assignments/{test_data['assignment_id']}/submit", json={
            "originalityScore": 8,
            "significanceScore": 7,
            "methodologyScore": 8,
            "clarityScore": 9,
            "overallScore": 8,
            "recommendation": "MINOR_REVISION",
            "commentsToAuthor": "Nice work, please clarify the methodology section for better reproducibility.",
            "commentsToEditor": "Solid contribution with minor issues that can be addressed in revision."
        })
        if resp.status_code == 200:
            data = resp.json()
            if "report" in data:
                log_result("5.3 POST /reviewer/assignments/{id}/submit", True, "Review submitted")
            else:
                log_result("5.3 POST /reviewer/assignments/{id}/submit", False, "No report in response")
        else:
            log_result("5.3 POST /reviewer/assignments/{id}/submit", False, 
                      f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_error("5.3 POST /reviewer/assignments/{id}/submit", str(e))


def test_6_decision():
    """Test 6: Decision - make decision, check state and notifications"""
    print("\n" + "="*80)
    print("TEST 6: Editorial Decision")
    print("="*80)
    
    # 6.1 POST /abstracts/{id}/decision (MINOR_REVISION)
    try:
        session = test_data["sessions"]["managing"]
        resp = session.post(f"{BASE_URL}/abstracts/{test_data['abstract_id']}/decision", json={
            "decision": "MINOR_REVISION",
            "decisionLetter": "Thank you for your submission. The reviewers have recommended minor revisions. Please address the comments and resubmit."
        })
        if resp.status_code == 200:
            data = resp.json()
            if "decision" in data:
                log_result("6.1 POST /abstracts/{id}/decision", True, "Decision: MINOR_REVISION")
            else:
                log_result("6.1 POST /abstracts/{id}/decision", False, "No decision in response")
        else:
            log_result("6.1 POST /abstracts/{id}/decision", False, 
                      f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_error("6.1 POST /abstracts/{id}/decision", str(e))
    
    # 6.2 GET /abstracts/{id} - verify state and decision
    try:
        session = test_data["sessions"]["managing"]
        resp = session.get(f"{BASE_URL}/abstracts/{test_data['abstract_id']}")
        if resp.status_code == 200:
            data = resp.json()
            abstract = data.get("abstract")
            if abstract:
                current_state = abstract.get("currentState")
                decisions = abstract.get("decisions", [])
                if current_state == "MINOR_REVISION" and len(decisions) > 0:
                    log_result("6.2 GET /abstracts/{id} (verify decision)", True, 
                              f"State: {current_state}, Decisions: {len(decisions)}")
                else:
                    log_result("6.2 GET /abstracts/{id} (verify decision)", False, 
                              f"State: {current_state}, Decisions: {len(decisions)}")
            else:
                log_result("6.2 GET /abstracts/{id} (verify decision)", False, "No abstract in response")
        else:
            log_result("6.2 GET /abstracts/{id} (verify decision)", False, f"Status {resp.status_code}")
    except Exception as e:
        log_error("6.2 GET /abstracts/{id} (verify decision)", str(e))
    
    # 6.3 GET /notifications (as author) - check for decision notification
    try:
        session = test_data["sessions"]["author"]
        resp = session.get(f"{BASE_URL}/notifications")
        if resp.status_code == 200:
            data = resp.json()
            notifications = data.get("notifications", [])
            decision_notif = any(n.get("type") == "DECISION" for n in notifications)
            if decision_notif:
                log_result("6.3 GET /notifications (author)", True, 
                          f"Found {len(notifications)} notifications including decision")
            else:
                log_result("6.3 GET /notifications (author)", False, 
                          f"No decision notification found in {len(notifications)} notifications")
        else:
            log_result("6.3 GET /notifications (author)", False, f"Status {resp.status_code}")
    except Exception as e:
        log_error("6.3 GET /notifications (author)", str(e))


def test_7_revision():
    """Test 7: Revision - add new version, check state transition"""
    print("\n" + "="*80)
    print("TEST 7: Revision Workflow")
    print("="*80)
    
    # 7.1 POST /abstracts/{id}/versions (add revision)
    try:
        session = test_data["sessions"]["author"]
        resp = session.post(f"{BASE_URL}/abstracts/{test_data['abstract_id']}/versions", json={
            "title": "Novel Approach to Machine Learning in Healthcare (Revised)",
            "body": "This study presents a comprehensive analysis of machine learning applications in healthcare diagnostics. REVISED: Added detailed methodology section with reproducibility guidelines.",
            "keywords": ["machine learning", "healthcare", "diagnostics", "AI", "reproducibility"],
            "coverLetter": "We have addressed all reviewer comments, particularly clarifying the methodology section."
        })
        if resp.status_code == 200:
            data = resp.json()
            version = data.get("version")
            if version and version.get("versionNumber") == 2:
                log_result("7.1 POST /abstracts/{id}/versions", True, "Version 2 created")
            else:
                log_result("7.1 POST /abstracts/{id}/versions", False, 
                          f"Version number not 2: {version.get('versionNumber') if version else 'N/A'}")
        else:
            log_result("7.1 POST /abstracts/{id}/versions", False, 
                      f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_error("7.1 POST /abstracts/{id}/versions", str(e))
    
    # 7.2 GET /abstracts/{id} - verify versions and state
    try:
        session = test_data["sessions"]["author"]
        resp = session.get(f"{BASE_URL}/abstracts/{test_data['abstract_id']}")
        if resp.status_code == 200:
            data = resp.json()
            abstract = data.get("abstract")
            if abstract:
                versions = abstract.get("versions", [])
                current_state = abstract.get("currentState")
                if len(versions) == 2 and current_state == "REVISION_SUBMITTED":
                    log_result("7.2 GET /abstracts/{id} (verify versions)", True, 
                              f"Versions: {len(versions)}, State: {current_state}")
                else:
                    log_result("7.2 GET /abstracts/{id} (verify versions)", False, 
                              f"Versions: {len(versions)}, State: {current_state}")
            else:
                log_result("7.2 GET /abstracts/{id} (verify versions)", False, "No abstract in response")
        else:
            log_result("7.2 GET /abstracts/{id} (verify versions)", False, f"Status {resp.status_code}")
    except Exception as e:
        log_error("7.2 GET /abstracts/{id} (verify versions)", str(e))


def test_8_final_acceptance():
    """Test 8: Final acceptance - accept with presentation type"""
    print("\n" + "="*80)
    print("TEST 8: Final Acceptance")
    print("="*80)
    
    # 8.1 POST /abstracts/{id}/decision (ACCEPT with presentationType)
    try:
        session = test_data["sessions"]["managing"]
        resp = session.post(f"{BASE_URL}/abstracts/{test_data['abstract_id']}/decision", json={
            "decision": "ACCEPT",
            "decisionLetter": "Congratulations! Your revised submission has been accepted for oral presentation.",
            "presentationType": "ORAL",
            "isFinal": True
        })
        if resp.status_code == 200:
            data = resp.json()
            if "decision" in data:
                log_result("8.1 POST /abstracts/{id}/decision (ACCEPT)", True, "Decision: ACCEPT")
            else:
                log_result("8.1 POST /abstracts/{id}/decision (ACCEPT)", False, "No decision in response")
        else:
            log_result("8.1 POST /abstracts/{id}/decision (ACCEPT)", False, 
                      f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_error("8.1 POST /abstracts/{id}/decision (ACCEPT)", str(e))
    
    # 8.2 GET /abstracts/{id} - verify state is ACCEPTED
    try:
        session = test_data["sessions"]["managing"]
        resp = session.get(f"{BASE_URL}/abstracts/{test_data['abstract_id']}")
        if resp.status_code == 200:
            data = resp.json()
            abstract = data.get("abstract")
            if abstract:
                current_state = abstract.get("currentState")
                if current_state == "ACCEPTED":
                    log_result("8.2 GET /abstracts/{id} (verify ACCEPTED)", True, f"State: {current_state}")
                else:
                    log_result("8.2 GET /abstracts/{id} (verify ACCEPTED)", False, 
                              f"State not ACCEPTED: {current_state}")
            else:
                log_result("8.2 GET /abstracts/{id} (verify ACCEPTED)", False, "No abstract in response")
        else:
            log_result("8.2 GET /abstracts/{id} (verify ACCEPTED)", False, f"Status {resp.status_code}")
    except Exception as e:
        log_error("8.2 GET /abstracts/{id} (verify ACCEPTED)", str(e))


def test_9_documents():
    """Test 9: Documents - upload, list, download"""
    print("\n" + "="*80)
    print("TEST 9: Document Management")
    print("="*80)
    
    # 9.1 POST /abstracts/{id}/documents (upload)
    try:
        session = test_data["sessions"]["author"]
        # Create a test file
        test_file_content = b"This is a test supplementary document for the abstract submission."
        files = {"file": ("supplementary_data.txt", io.BytesIO(test_file_content), "text/plain")}
        data = {"category": "SUPPLEMENTARY"}
        resp = session.post(f"{BASE_URL}/abstracts/{test_data['abstract_id']}/documents", 
                           files=files, data=data)
        if resp.status_code == 200:
            result = resp.json()
            document = result.get("document")
            if document:
                test_data["document_id"] = document["id"]
                log_result("9.1 POST /abstracts/{id}/documents", True, 
                          f"Uploaded: {document.get('fileName')}")
            else:
                log_result("9.1 POST /abstracts/{id}/documents", False, "No document in response")
        else:
            log_result("9.1 POST /abstracts/{id}/documents", False, 
                      f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_error("9.1 POST /abstracts/{id}/documents", str(e))
    
    # 9.2 GET /abstracts/{id}/documents (list)
    try:
        session = test_data["sessions"]["author"]
        resp = session.get(f"{BASE_URL}/abstracts/{test_data['abstract_id']}/documents")
        if resp.status_code == 200:
            data = resp.json()
            documents = data.get("documents", [])
            found = any(d["id"] == test_data["document_id"] for d in documents)
            if found:
                log_result("9.2 GET /abstracts/{id}/documents", True, f"Found {len(documents)} documents")
            else:
                log_result("9.2 GET /abstracts/{id}/documents", False, "Uploaded document not in list")
        else:
            log_result("9.2 GET /abstracts/{id}/documents", False, f"Status {resp.status_code}")
    except Exception as e:
        log_error("9.2 GET /abstracts/{id}/documents", str(e))
    
    # 9.3 GET /documents/{id}/download
    try:
        session = test_data["sessions"]["author"]
        resp = session.get(f"{BASE_URL}/documents/{test_data['document_id']}/download")
        if resp.status_code == 200:
            content = resp.content
            if len(content) > 0:
                log_result("9.3 GET /documents/{id}/download", True, f"Downloaded {len(content)} bytes")
            else:
                log_result("9.3 GET /documents/{id}/download", False, "Empty file content")
        else:
            log_result("9.3 GET /documents/{id}/download", False, f"Status {resp.status_code}")
    except Exception as e:
        log_error("9.3 GET /documents/{id}/download", str(e))


def test_10_messages():
    """Test 10: Messages - create, list, notifications"""
    print("\n" + "="*80)
    print("TEST 10: Internal Messaging")
    print("="*80)
    
    # 10.1 POST /abstracts/{id}/messages (as managing editor)
    try:
        session = test_data["sessions"]["managing"]
        author_id = test_data["users"]["author"]["id"]
        resp = session.post(f"{BASE_URL}/abstracts/{test_data['abstract_id']}/messages", json={
            "channel": "EDITOR_AUTHOR",
            "recipientIds": [author_id],
            "subject": "Congratulations on acceptance",
            "body": "Your paper has been accepted. Please prepare your presentation for the conference."
        })
        if resp.status_code == 200:
            data = resp.json()
            if "message" in data:
                log_result("10.1 POST /abstracts/{id}/messages", True, "Message sent")
            else:
                log_result("10.1 POST /abstracts/{id}/messages", False, "No message in response")
        else:
            log_result("10.1 POST /abstracts/{id}/messages", False, 
                      f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_error("10.1 POST /abstracts/{id}/messages", str(e))
    
    # 10.2 GET /abstracts/{id}/messages
    try:
        session = test_data["sessions"]["author"]
        resp = session.get(f"{BASE_URL}/abstracts/{test_data['abstract_id']}/messages")
        if resp.status_code == 200:
            data = resp.json()
            messages = data.get("messages", [])
            if len(messages) > 0:
                log_result("10.2 GET /abstracts/{id}/messages", True, f"Found {len(messages)} messages")
            else:
                log_result("10.2 GET /abstracts/{id}/messages", False, "No messages found")
        else:
            log_result("10.2 GET /abstracts/{id}/messages", False, f"Status {resp.status_code}")
    except Exception as e:
        log_error("10.2 GET /abstracts/{id}/messages", str(e))
    
    # 10.3 GET /notifications (author should have message notification)
    try:
        session = test_data["sessions"]["author"]
        resp = session.get(f"{BASE_URL}/notifications")
        if resp.status_code == 200:
            data = resp.json()
            notifications = data.get("notifications", [])
            message_notif = any(n.get("type") == "MESSAGE" for n in notifications)
            if message_notif:
                log_result("10.3 GET /notifications (message)", True, 
                          f"Found message notification in {len(notifications)} total")
            else:
                log_result("10.3 GET /notifications (message)", False, "No message notification")
        else:
            log_result("10.3 GET /notifications (message)", False, f"Status {resp.status_code}")
    except Exception as e:
        log_error("10.3 GET /notifications (message)", str(e))


def test_11_notifications():
    """Test 11: Notifications - list, mark read, read-all"""
    print("\n" + "="*80)
    print("TEST 11: Notification Management")
    print("="*80)
    
    # 11.1 GET /notifications
    notification_id = None
    try:
        session = test_data["sessions"]["author"]
        resp = session.get(f"{BASE_URL}/notifications")
        if resp.status_code == 200:
            data = resp.json()
            notifications = data.get("notifications", [])
            if len(notifications) > 0:
                notification_id = notifications[0]["id"]
                log_result("11.1 GET /notifications", True, f"Found {len(notifications)} notifications")
            else:
                log_result("11.1 GET /notifications", False, "No notifications found")
        else:
            log_result("11.1 GET /notifications", False, f"Status {resp.status_code}")
    except Exception as e:
        log_error("11.1 GET /notifications", str(e))
    
    # 11.2 POST /notifications/{id}/read
    if notification_id:
        try:
            session = test_data["sessions"]["author"]
            resp = session.post(f"{BASE_URL}/notifications/{notification_id}/read")
            if resp.status_code == 200:
                log_result("11.2 POST /notifications/{id}/read", True)
            else:
                log_result("11.2 POST /notifications/{id}/read", False, f"Status {resp.status_code}")
        except Exception as e:
            log_error("11.2 POST /notifications/{id}/read", str(e))
    
    # 11.3 POST /notifications/read-all
    try:
        session = test_data["sessions"]["author"]
        resp = session.post(f"{BASE_URL}/notifications/read-all")
        if resp.status_code == 200:
            log_result("11.3 POST /notifications/read-all", True)
        else:
            log_result("11.3 POST /notifications/read-all", False, f"Status {resp.status_code}")
    except Exception as e:
        log_error("11.3 POST /notifications/read-all", str(e))


def test_12_analytics():
    """Test 12: Analytics - dashboard aggregations"""
    print("\n" + "="*80)
    print("TEST 12: Analytics Dashboard")
    print("="*80)
    
    # 12.1 GET /analytics/dashboard (as admin)
    try:
        session = test_data["sessions"]["admin"]
        resp = session.get(f"{BASE_URL}/analytics/dashboard")
        if resp.status_code == 200:
            data = resp.json()
            required_fields = ["totalUsers", "totalAbstracts", "usersByRole", "abstractsByState", 
                             "abstractsByTheme", "reviews", "decisions", "totalRegs"]
            missing = [f for f in required_fields if f not in data]
            if not missing:
                log_result("12.1 GET /analytics/dashboard", True, 
                          f"Users: {data['totalUsers']}, Abstracts: {data['totalAbstracts']}")
            else:
                log_result("12.1 GET /analytics/dashboard", False, f"Missing fields: {missing}")
        else:
            log_result("12.1 GET /analytics/dashboard", False, f"Status {resp.status_code}")
    except Exception as e:
        log_error("12.1 GET /analytics/dashboard", str(e))


def test_13_user_management():
    """Test 13: User management - list, create"""
    print("\n" + "="*80)
    print("TEST 13: User Management")
    print("="*80)
    
    # 13.1 GET /users (as admin)
    try:
        session = test_data["sessions"]["admin"]
        resp = session.get(f"{BASE_URL}/users")
        if resp.status_code == 200:
            data = resp.json()
            users = data.get("users", [])
            if len(users) > 0:
                log_result("13.1 GET /users", True, f"Found {len(users)} users")
            else:
                log_result("13.1 GET /users", False, "No users found")
        else:
            log_result("13.1 GET /users", False, f"Status {resp.status_code}")
    except Exception as e:
        log_error("13.1 GET /users", str(e))
    
    # 13.2 POST /users (as admin)
    try:
        session = test_data["sessions"]["admin"]
        new_email = f"newuser_{hash(str(test_data))}@test.com"
        resp = session.post(f"{BASE_URL}/users", json={
            "email": new_email,
            "firstName": "New",
            "lastName": "User",
            "role": "AUTHOR"
        })
        if resp.status_code == 200:
            data = resp.json()
            if "user" in data:
                log_result("13.2 POST /users (as admin)", True, f"Created user: {new_email}")
            else:
                log_result("13.2 POST /users (as admin)", False, "No user in response")
        else:
            log_result("13.2 POST /users (as admin)", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_error("13.2 POST /users (as admin)", str(e))


def test_14_audit():
    """Test 14: Audit - list logs"""
    print("\n" + "="*80)
    print("TEST 14: Audit Logging")
    print("="*80)
    
    # 14.1 GET /audit (as admin)
    try:
        session = test_data["sessions"]["admin"]
        resp = session.get(f"{BASE_URL}/audit")
        if resp.status_code == 200:
            data = resp.json()
            logs = data.get("logs", [])
            if len(logs) > 0:
                # Check for expected actions
                actions = [log.get("action") for log in logs]
                expected_actions = ["LOGIN", "CREATE_ABSTRACT"]
                found_actions = [a for a in expected_actions if a in actions]
                log_result("14.1 GET /audit (as admin)", True, 
                          f"Found {len(logs)} logs, actions include: {found_actions}")
            else:
                log_result("14.1 GET /audit (as admin)", False, "No audit logs found")
        else:
            log_result("14.1 GET /audit (as admin)", False, f"Status {resp.status_code}")
    except Exception as e:
        log_error("14.1 GET /audit (as admin)", str(e))
    
    # 14.2 GET /audit (as non-admin) → 403
    try:
        session = test_data["sessions"]["author"]
        resp = session.get(f"{BASE_URL}/audit")
        if resp.status_code == 403:
            log_result("14.2 GET /audit (as author) → 403", True)
        else:
            log_result("14.2 GET /audit (as author) → 403", False, 
                      f"Expected 403, got {resp.status_code}")
    except Exception as e:
        log_error("14.2 GET /audit (as author)", str(e))


def test_15_rbac():
    """Test 15: RBAC checks - various 403 scenarios"""
    print("\n" + "="*80)
    print("TEST 15: RBAC Authorization Checks")
    print("="*80)
    
    # 15.1 Author calling POST /abstracts/{id}/decision → 403
    try:
        session = test_data["sessions"]["author"]
        resp = session.post(f"{BASE_URL}/abstracts/{test_data['abstract_id']}/decision", json={
            "decision": "ACCEPT",
            "decisionLetter": "Test"
        })
        if resp.status_code == 403:
            log_result("15.1 Author POST decision → 403", True)
        else:
            log_result("15.1 Author POST decision → 403", False, 
                      f"Expected 403, got {resp.status_code}")
    except Exception as e:
        log_error("15.1 Author POST decision", str(e))
    
    # 15.2 Reviewer without assignment cannot GET other abstract → 403
    try:
        # Create another abstract first
        session = test_data["sessions"]["author"]
        resp = session.post(f"{BASE_URL}/abstracts", json={
            "conferenceId": test_data["conference_id"],
            "themeId": test_data["theme_id"],
            "title": "Another Test Abstract",
            "body": "Test body"
        })
        if resp.status_code == 200:
            other_abstract_id = resp.json()["abstract"]["id"]
            # Try to access as reviewer2 (not assigned)
            session2 = test_data["sessions"]["reviewer2"]
            resp2 = session2.get(f"{BASE_URL}/abstracts/{other_abstract_id}")
            if resp2.status_code == 403:
                log_result("15.2 Reviewer GET unassigned abstract → 403", True)
            else:
                log_result("15.2 Reviewer GET unassigned abstract → 403", False, 
                          f"Expected 403, got {resp2.status_code}")
        else:
            log_result("15.2 Reviewer GET unassigned abstract → 403", False, 
                      "Could not create test abstract")
    except Exception as e:
        log_error("15.2 Reviewer GET unassigned abstract", str(e))
    
    # 15.3 Non-admin calling POST /users → 403
    try:
        session = test_data["sessions"]["author"]
        resp = session.post(f"{BASE_URL}/users", json={
            "email": "test@test.com",
            "firstName": "Test",
            "lastName": "User"
        })
        if resp.status_code == 403:
            log_result("15.3 Author POST /users → 403", True)
        else:
            log_result("15.3 Author POST /users → 403", False, 
                      f"Expected 403, got {resp.status_code}")
    except Exception as e:
        log_error("15.3 Author POST /users", str(e))


def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    total = len(test_results["passed"]) + len(test_results["failed"]) + len(test_results["errors"])
    passed = len(test_results["passed"])
    failed = len(test_results["failed"])
    errors = len(test_results["errors"])
    
    print(f"\nTotal Tests: {total}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"🔥 Errors: {errors}")
    
    if test_results["failed"]:
        print("\n❌ FAILED TESTS:")
        for test in test_results["failed"]:
            print(f"  - {test}")
    
    if test_results["errors"]:
        print("\n🔥 ERROR TESTS:")
        for error in test_results["errors"]:
            print(f"  - {error['test']}: {error['error']}")
    
    success_rate = (passed / total * 100) if total > 0 else 0
    print(f"\nSuccess Rate: {success_rate:.1f}%")
    
    if errors > 0:
        print("\n⚠️  CRITICAL: Some tests encountered errors (500 errors or exceptions)")
        return 2
    elif failed > 0:
        print("\n⚠️  Some tests failed")
        return 1
    else:
        print("\n✅ All tests passed!")
        return 0


def main():
    """Main test execution"""
    print("="*80)
    print("SCMS Backend API Comprehensive Test Suite")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print("="*80)
    
    try:
        # Run all test scenarios in order
        test_1_auth()
        test_2_conferences()
        test_3_abstract_lifecycle()
        test_4_editorial_workflow()
        test_5_reviewer_workflow()
        test_6_decision()
        test_7_revision()
        test_8_final_acceptance()
        test_9_documents()
        test_10_messages()
        test_11_notifications()
        test_12_analytics()
        test_13_user_management()
        test_14_audit()
        test_15_rbac()
        
        # Print summary
        exit_code = print_summary()
        sys.exit(exit_code)
        
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n\nFatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
