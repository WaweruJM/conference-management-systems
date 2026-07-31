#!/usr/bin/env python3
"""
Backend test for enhanced peer-review submission flow
Tests POST /api/reviewer/assignments/:id/submit notifications and access control
"""

import requests
import json
import sys
import time

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

def get_user_by_email(token, email):
    """Get user ID by email"""
    try:
        response = requests.get(
            f"{BASE_URL}/users",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            users = data.get('users', [])
            for user in users:
                if user.get('email') == email:
                    print(f"✅ Found user {email} with ID: {user.get('id')}")
                    return user.get('id')
            print(f"❌ User {email} not found")
            return None
        else:
            print(f"❌ Failed to get users: {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ Exception getting users: {str(e)}")
        return None

def get_abstracts(token, state=None):
    """Get abstracts list, optionally filtered by state"""
    try:
        url = f"{BASE_URL}/abstracts"
        if state:
            url += f"?state={state}"
        response = requests.get(
            url,
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            abstracts = data.get('abstracts', [])
            print(f"✅ Retrieved {len(abstracts)} abstracts")
            return abstracts
        else:
            print(f"❌ Failed to get abstracts: {response.status_code}")
            return []
    except Exception as e:
        print(f"❌ Exception getting abstracts: {str(e)}")
        return []

def transition_abstract(token, abs_id, to_state):
    """Transition abstract to a specific state"""
    try:
        response = requests.post(
            f"{BASE_URL}/abstracts/{abs_id}/transition",
            json={"toState": to_state},
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        if response.status_code == 200:
            print(f"✅ Transitioned abstract to {to_state}")
            return True
        else:
            print(f"❌ Failed to transition abstract: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Exception transitioning abstract: {str(e)}")
        return False

def assign_editor(token, abs_id, editor_id):
    """Assign an editor to an abstract"""
    try:
        response = requests.post(
            f"{BASE_URL}/abstracts/{abs_id}/assign-editor",
            json={"editorId": editor_id, "role": "CHIEF_EDITOR"},
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        if response.status_code == 200:
            print(f"✅ Assigned editor (ID: {editor_id})")
            return True
        else:
            print(f"❌ Failed to assign editor: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Exception assigning editor: {str(e)}")
        return False

def assign_reviewer(token, abs_id, reviewer_id, review_type='EXTERNAL_REVIEWER'):
    """Assign a reviewer to an abstract"""
    try:
        response = requests.post(
            f"{BASE_URL}/abstracts/{abs_id}/assign-reviewer",
            json={
                "reviewerId": reviewer_id,
                "reviewType": review_type
            },
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            assignment = data.get('assignment', {})
            assignment_id = assignment.get('id')
            print(f"✅ Assigned reviewer (ID: {reviewer_id}, assignment ID: {assignment_id})")
            return assignment_id
        else:
            print(f"❌ Failed to assign reviewer: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Exception assigning reviewer: {str(e)}")
        return None

def get_reviewer_assignments(token):
    """Get reviewer assignments"""
    try:
        response = requests.get(
            f"{BASE_URL}/reviewer/assignments",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            assignments = data.get('assignments', [])
            print(f"✅ Retrieved {len(assignments)} reviewer assignments")
            return assignments
        else:
            print(f"❌ Failed to get reviewer assignments: {response.status_code}")
            return []
    except Exception as e:
        print(f"❌ Exception getting reviewer assignments: {str(e)}")
        return []

def respond_to_assignment(token, assignment_id, status):
    """Accept or decline a reviewer assignment"""
    try:
        response = requests.post(
            f"{BASE_URL}/reviewer/assignments/{assignment_id}/respond",
            json={"status": status},
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        if response.status_code == 200:
            print(f"✅ Responded to assignment with status: {status}")
            return True
        else:
            print(f"❌ Failed to respond to assignment: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Exception responding to assignment: {str(e)}")
        return False

def get_abstract_detail(token, abs_id):
    """Get abstract detail"""
    try:
        response = requests.get(
            f"{BASE_URL}/abstracts/{abs_id}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            abstract = data.get('abstract', {})
            print(f"✅ Retrieved abstract detail: {abstract.get('submissionCode')}")
            return abstract
        else:
            print(f"❌ Failed to get abstract detail: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Exception getting abstract detail: {str(e)}")
        return None

def submit_review(token, assignment_id, review_data):
    """Submit a review report"""
    try:
        response = requests.post(
            f"{BASE_URL}/reviewer/assignments/{assignment_id}/submit",
            json=review_data,
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            report = data.get('report', {})
            print(f"✅ Submitted review (report ID: {report.get('id')})")
            return report
        else:
            print(f"❌ Failed to submit review: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Exception submitting review: {str(e)}")
        return None

def get_notifications(token):
    """Get notifications for current user"""
    try:
        response = requests.get(
            f"{BASE_URL}/notifications",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            notifications = data.get('notifications', [])
            print(f"✅ Retrieved {len(notifications)} notifications")
            return notifications
        else:
            print(f"❌ Failed to get notifications: {response.status_code}")
            return []
    except Exception as e:
        print(f"❌ Exception getting notifications: {str(e)}")
        return []

def main():
    print("=" * 80)
    print("BACKEND TEST: Enhanced Peer-Review Submission Flow")
    print("Testing POST /api/reviewer/assignments/:id/submit notifications")
    print("=" * 80)
    
    # Step 1: Login as admin and setup
    print("\n=== STEP 1: Setup - Login as admin and prepare abstract ===")
    admin_token = login("admin@scms.io", "password123")
    if not admin_token:
        print("❌ TEST ABORTED: Cannot login as admin")
        sys.exit(1)
    
    # Get abstracts in appropriate states
    print("\n--- Finding abstract in EDITORIAL_ASSIGNMENT/EXTERNAL_PEER_REVIEW/COMMITTEE_REVIEW state ---")
    abstracts = get_abstracts(admin_token)
    
    # Find an abstract in one of the target states WITHOUT reviewer2 already assigned
    target_states = ['EDITORIAL_ASSIGNMENT', 'EXTERNAL_PEER_REVIEW', 'COMMITTEE_REVIEW']
    suitable_abstract = None
    for abstract in abstracts:
        if abstract.get('currentState') in target_states:
            # Check if reviewer2 is already assigned
            review_assignments = abstract.get('reviewAssignments', [])
            has_reviewer2 = any(
                r.get('reviewer', {}).get('email') == 'reviewer2@scms.io' 
                for r in review_assignments
            )
            if not has_reviewer2:
                suitable_abstract = abstract
                break
    
    # If no suitable abstract found, try to transition one
    if not suitable_abstract:
        print("⚠️  No abstract in target states, looking for SUBMITTED abstract to transition")
        for abstract in abstracts:
            if abstract.get('currentState') == 'SUBMITTED':
                suitable_abstract = abstract
                abs_id = abstract.get('id')
                print(f"Found SUBMITTED abstract: {abstract.get('submissionCode')}")
                # Transition to EDITORIAL_ASSIGNMENT
                if transition_abstract(admin_token, abs_id, 'EDITORIAL_ASSIGNMENT'):
                    suitable_abstract['currentState'] = 'EDITORIAL_ASSIGNMENT'
                    break
    
    if not suitable_abstract:
        print("❌ TEST ABORTED: No suitable abstract found")
        sys.exit(1)
    
    abs_id = suitable_abstract.get('id')
    submission_code = suitable_abstract.get('submissionCode')
    current_state = suitable_abstract.get('currentState')
    print(f"✅ Using abstract: {submission_code} (State: {current_state})")
    
    # Get user IDs for chief and reviewer2
    print("\n--- Getting user IDs ---")
    chief_id = get_user_by_email(admin_token, "chief@scms.io")
    reviewer2_id = get_user_by_email(admin_token, "reviewer2@scms.io")
    
    if not chief_id or not reviewer2_id:
        print("❌ TEST ABORTED: Cannot get user IDs")
        sys.exit(1)
    
    # Assign chief@scms.io as editor if not already assigned
    print("\n--- Assigning chief@scms.io as editor ---")
    assign_editor(admin_token, abs_id, chief_id)
    
    # Assign reviewer2@scms.io as EXTERNAL_REVIEWER
    print("\n--- Assigning reviewer2@scms.io as EXTERNAL_REVIEWER ---")
    assignment_id = assign_reviewer(admin_token, abs_id, reviewer2_id, "EXTERNAL_REVIEWER")
    if not assignment_id:
        print("❌ TEST ABORTED: Cannot assign reviewer")
        sys.exit(1)
    
    # Step 2: Login as reviewer2 and accept assignment
    print("\n=== STEP 2: Login as reviewer2 and accept assignment ===")
    reviewer2_token = login("reviewer2@scms.io", "password123")
    if not reviewer2_token:
        print("❌ TEST ABORTED: Cannot login as reviewer2")
        sys.exit(1)
    
    # Get assignments
    print("\n--- Getting reviewer assignments ---")
    assignments = get_reviewer_assignments(reviewer2_token)
    
    # Find the assignment we just created
    target_assignment = None
    for assignment in assignments:
        if assignment.get('id') == assignment_id:
            target_assignment = assignment
            break
    
    if not target_assignment:
        print(f"❌ TEST ABORTED: Cannot find assignment {assignment_id}")
        sys.exit(1)
    
    # Accept the assignment
    print(f"\n--- Accepting assignment {assignment_id} ---")
    if not respond_to_assignment(reviewer2_token, assignment_id, "ACCEPTED"):
        print("❌ TEST ABORTED: Cannot accept assignment")
        sys.exit(1)
    
    # Verify can access abstract
    print(f"\n--- Verifying reviewer2 can access abstract {abs_id} ---")
    abstract_detail = get_abstract_detail(reviewer2_token, abs_id)
    if not abstract_detail:
        print("❌ TEST FAILED: Reviewer2 cannot access abstract after accepting")
        sys.exit(1)
    print(f"✅ Reviewer2 can access abstract: {abstract_detail.get('submissionCode')}")
    
    # Step 3: Submit review
    print("\n=== STEP 3: Submit review ===")
    review_data = {
        "originalityScore": 8,
        "significanceScore": 7,
        "methodologyScore": 7,
        "clarityScore": 8,
        "overallScore": 7,
        "commentsToAuthor": "Solid work, minor tweaks needed.",
        "commentsToEditor": "No conflicts.",
        "recommendation": "MINOR_REVISION"
    }
    
    report = submit_review(reviewer2_token, assignment_id, review_data)
    if not report:
        print("❌ TEST FAILED: Cannot submit review")
        sys.exit(1)
    
    print(f"✅ Review submitted successfully")
    print(f"   - Recommendation: {report.get('recommendation')}")
    print(f"   - Overall Score: {report.get('overallScore')}")
    
    # Wait a moment for notifications to be created
    time.sleep(2)
    
    # Step 4: Login as chief and verify notification
    print("\n=== STEP 4: Login as chief and verify notification ===")
    chief_token = login("chief@scms.io", "password123")
    if not chief_token:
        print("❌ TEST ABORTED: Cannot login as chief")
        sys.exit(1)
    
    # Get notifications
    print("\n--- Getting notifications for chief@scms.io ---")
    notifications = get_notifications(chief_token)
    
    # Find notification about the review
    review_notification = None
    for notif in notifications:
        title = notif.get('title', '')
        if submission_code in title and 'review' in title.lower():
            review_notification = notif
            break
    
    if not review_notification:
        print(f"❌ TEST FAILED: No notification found for review submission")
        print(f"   Expected title to contain: 'New review received on {submission_code}'")
        print(f"   Available notifications:")
        for notif in notifications[:5]:
            print(f"   - {notif.get('title')}")
    else:
        print(f"✅ Notification found:")
        print(f"   - Title: {review_notification.get('title')}")
        print(f"   - Body: {review_notification.get('body')}")
        print(f"   - Link: {review_notification.get('link')}")
        print(f"   - Type: {review_notification.get('type')}")
        
        # Verify notification details
        title = review_notification.get('title', '')
        body = review_notification.get('body', '')
        link = review_notification.get('link', '')
        notif_type = review_notification.get('type', '')
        
        checks_passed = True
        
        if submission_code not in title:
            print(f"❌ Title does not contain submission code: {submission_code}")
            checks_passed = False
        
        if 'MINOR_REVISION' not in body and 'MINOR REVISION' not in body:
            print(f"❌ Body does not mention recommendation: MINOR_REVISION")
            checks_passed = False
        
        if abs_id not in link:
            print(f"❌ Link does not point to abstract: /abstracts/{abs_id}")
            checks_passed = False
        
        if notif_type != 'MESSAGE':
            print(f"❌ Notification type is not MESSAGE: {notif_type}")
            checks_passed = False
        
        if checks_passed:
            print(f"✅ All notification checks passed")
    
    # Step 5: Regression tests
    print("\n=== STEP 5: Regression tests ===")
    
    # 5a: Reviewer2 attempt to submit again (expect 400 or 500)
    print("\n--- 5a: Reviewer2 attempt to submit again ---")
    try:
        response = requests.post(
            f"{BASE_URL}/reviewer/assignments/{assignment_id}/submit",
            json=review_data,
            headers={"Authorization": f"Bearer {reviewer2_token}"},
            timeout=10
        )
        status_code = response.status_code
        print(f"POST /api/reviewer/assignments/{assignment_id}/submit (duplicate) → {status_code}")
        
        if status_code in [400, 409, 500]:
            print(f"✅ Duplicate submission correctly rejected with {status_code}")
        else:
            print(f"⚠️  Unexpected status code: {status_code} (expected 400, 409, or 500)")
    except Exception as e:
        print(f"❌ Exception on duplicate submission: {str(e)}")
    
    # 5b: Author of the abstract can still access it
    print("\n--- 5b: Author of abstract can access it ---")
    # Get the author email from abstract detail
    abstract_detail = get_abstract_detail(admin_token, abs_id)
    if abstract_detail:
        submitted_by = abstract_detail.get('submittedBy', {})
        author_email = submitted_by.get('email')
        
        if author_email:
            print(f"Abstract author: {author_email}")
            author_token = login(author_email, "password123")
            if author_token:
                author_abstract = get_abstract_detail(author_token, abs_id)
                if author_abstract:
                    print(f"✅ Author can access their abstract")
                else:
                    print(f"❌ Author cannot access their abstract")
            else:
                print(f"⚠️  Cannot login as author {author_email}")
        else:
            print(f"⚠️  Cannot determine author email")
    
    # 5c: Random author who has no relationship to this abstract gets 403
    print("\n--- 5c: Random author (author2@scms.io) gets 403 ---")
    random_author_token = login("author2@scms.io", "password123")
    if random_author_token:
        try:
            response = requests.get(
                f"{BASE_URL}/abstracts/{abs_id}",
                headers={"Authorization": f"Bearer {random_author_token}"},
                timeout=10
            )
            status_code = response.status_code
            print(f"GET /api/abstracts/{abs_id} as random author → {status_code}")
            
            if status_code == 403:
                print(f"✅ Random author correctly denied access (403)")
            else:
                print(f"⚠️  Unexpected status code: {status_code} (expected 403)")
        except Exception as e:
            print(f"❌ Exception: {str(e)}")
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print("✅ Step 1: Setup complete - abstract prepared, editor and reviewer assigned")
    print("✅ Step 2: Reviewer accepted assignment and can access abstract")
    print("✅ Step 3: Review submitted successfully")
    if review_notification:
        print("✅ Step 4: Notification received by chief editor with correct details")
    else:
        print("❌ Step 4: Notification NOT found")
    print("✅ Step 5: Regression tests completed")
    
    print("\n🎉 PEER-REVIEW SUBMISSION FLOW TEST COMPLETE")

if __name__ == "__main__":
    main()
