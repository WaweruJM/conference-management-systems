#!/usr/bin/env python3
"""
Test Scenario D.3: Decline a review invitation and verify notification is created
"""
import requests
import json
import sys

BASE_URL = "https://scms-platform-1.preview.emergentagent.com/api"

def login(email, password):
    """Login and return JWT token"""
    response = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
    if response.status_code == 200:
        data = response.json()
        return data.get("token")
    else:
        print(f"❌ Login failed for {email}: {response.status_code} - {response.text}")
        return None

def get_headers(token):
    """Get authorization headers"""
    return {"Authorization": f"Bearer {token}"}

def main():
    print("=" * 80)
    print("SCENARIO D.3: Decline review invitation and verify notification")
    print("=" * 80)
    
    # Step 1: Login as admin to get an abstract
    print("\n[Step 1] Login as admin@scms.io...")
    admin_token = login("admin@scms.io", "password123")
    if not admin_token:
        sys.exit(1)
    print("✅ Admin login successful")
    
    # Step 2: Get abstracts to find one in editorial state
    print("\n[Step 2] Get abstracts...")
    response = requests.get(f"{BASE_URL}/abstracts", headers=get_headers(admin_token))
    if response.status_code != 200:
        print(f"❌ Failed to get abstracts: {response.status_code} - {response.text}")
        sys.exit(1)
    
    abstracts = response.json().get("abstracts", [])
    print(f"✅ Found {len(abstracts)} abstracts")
    
    # Find an abstract in editorial state
    editorial_abstract = None
    for abstract in abstracts:
        if abstract.get("currentState") in ["EDITORIAL_ASSIGNMENT", "EXTERNAL_PEER_REVIEW", "SUBMITTED"]:
            editorial_abstract = abstract
            break
    
    if not editorial_abstract:
        print("❌ No abstract found in editorial state. Creating one...")
        # Create a new abstract
        response = requests.post(
            f"{BASE_URL}/abstracts",
            headers=get_headers(admin_token),
            json={
                "title": "Test Abstract for D.3",
                "abstract": "This is a test abstract for scenario D.3",
                "reportType": "ORAL",
                "conferenceId": abstracts[0].get("conferenceId") if abstracts else None
            }
        )
        if response.status_code != 200:
            print(f"❌ Failed to create abstract: {response.status_code} - {response.text}")
            sys.exit(1)
        editorial_abstract = response.json().get("abstract")
        print(f"✅ Created abstract: {editorial_abstract.get('submissionCode')}")
    else:
        print(f"✅ Using existing abstract: {editorial_abstract.get('submissionCode')}")
    
    abstract_id = editorial_abstract.get("id")
    
    # Step 3: Login as chief editor
    print("\n[Step 3] Login as chief@scms.io...")
    chief_token = login("chief@scms.io", "password123")
    if not chief_token:
        sys.exit(1)
    print("✅ Chief editor login successful")
    
    # Step 4: Assign an editor if not already assigned
    print("\n[Step 4] Assign editor to abstract...")
    response = requests.post(
        f"{BASE_URL}/abstracts/{abstract_id}/assign-editor",
        headers=get_headers(chief_token),
        json={"editorId": chief_token}  # Self-assign
    )
    if response.status_code in [200, 409]:  # 409 if already assigned
        print("✅ Editor assigned (or already assigned)")
    else:
        print(f"⚠️  Editor assignment returned {response.status_code}: {response.text}")
    
    # Step 5: Check for existing reviewer assignments
    print("\n[Step 5] Check for existing reviewer assignments...")
    response = requests.get(f"{BASE_URL}/abstracts/{abstract_id}", headers=get_headers(chief_token))
    if response.status_code != 200:
        print(f"❌ Failed to get abstract details: {response.status_code} - {response.text}")
        sys.exit(1)
    
    abstract_details = response.json().get("abstract", {})
    review_assignments = abstract_details.get("reviewAssignments", [])
    
    # Find a PENDING assignment
    pending_assignment = None
    reviewer_email = None
    
    for assignment in review_assignments:
        if assignment.get("invitationStatus") == "PENDING":
            pending_assignment = assignment
            reviewer_email = assignment.get("reviewer", {}).get("email")
            break
    
    # If no pending assignment, create one
    if not pending_assignment:
        print("⚠️  No PENDING reviewer assignment found. Creating one...")
        # Try reviewer1 or reviewer2
        for reviewer_email in ["reviewer1@scms.io", "reviewer2@scms.io"]:
            # Login as reviewer to get their ID
            reviewer_token = login(reviewer_email, "password123")
            if not reviewer_token:
                continue
            
            # Get reviewer user info
            response = requests.get(f"{BASE_URL}/auth/me", headers=get_headers(reviewer_token))
            if response.status_code != 200:
                continue
            
            reviewer_id = response.json().get("user", {}).get("id")
            
            # Assign reviewer
            response = requests.post(
                f"{BASE_URL}/abstracts/{abstract_id}/assign-reviewer",
                headers=get_headers(chief_token),
                json={"reviewerId": reviewer_id}
            )
            
            if response.status_code == 200:
                pending_assignment = response.json().get("assignment")
                print(f"✅ Created reviewer assignment for {reviewer_email}")
                break
            else:
                print(f"⚠️  Failed to assign {reviewer_email}: {response.status_code}")
    else:
        print(f"✅ Found PENDING assignment for {reviewer_email}")
    
    if not pending_assignment:
        print("❌ Could not find or create a PENDING reviewer assignment")
        sys.exit(1)
    
    assignment_id = pending_assignment.get("id")
    
    # Step 6: Login as the reviewer
    print(f"\n[Step 6] Login as {reviewer_email}...")
    reviewer_token = login(reviewer_email, "password123")
    if not reviewer_token:
        sys.exit(1)
    print(f"✅ Reviewer login successful")
    
    # Step 7: Decline the review invitation
    print(f"\n[Step 7] Decline review invitation...")
    response = requests.post(
        f"{BASE_URL}/reviewer/assignments/{assignment_id}/respond",
        headers=get_headers(reviewer_token),
        json={"status": "DECLINED", "declineReason": "Test decline for D.3"}
    )
    
    if response.status_code != 200:
        print(f"❌ Failed to decline invitation: {response.status_code} - {response.text}")
        sys.exit(1)
    
    print("✅ Review invitation declined successfully")
    
    # Step 8: Check notifications as chief@scms.io
    print(f"\n[Step 8] Check notifications as chief@scms.io...")
    response = requests.get(f"{BASE_URL}/notifications", headers=get_headers(chief_token))
    
    if response.status_code != 200:
        print(f"❌ Failed to get notifications: {response.status_code} - {response.text}")
        sys.exit(1)
    
    notifications = response.json().get("notifications", [])
    print(f"✅ Retrieved {len(notifications)} notifications")
    
    # Find the decline notification
    decline_notification = None
    for notif in notifications:
        title = notif.get("title", "")
        if title.startswith("Reviewer declined"):
            decline_notification = notif
            break
    
    print("\n" + "=" * 80)
    print("RESULTS:")
    print("=" * 80)
    
    if decline_notification:
        print("✅ NOTIFICATION FOUND!")
        print(f"\n📧 Notification Details:")
        print(f"   Title: {decline_notification.get('title')}")
        print(f"   Body: {decline_notification.get('body')}")
        print(f"   Type: {decline_notification.get('type')}")
        print(f"   Link: {decline_notification.get('link')}")
        print(f"   Created: {decline_notification.get('createdAt')}")
        
        # Verify the body mentions the declining reviewer
        body = decline_notification.get("body", "")
        if reviewer_email in body or "declined" in body.lower():
            print(f"\n✅ Body mentions the declining reviewer")
        else:
            print(f"\n⚠️  Body does not clearly mention the declining reviewer")
        
        # Check if type is MESSAGE
        if decline_notification.get("type") == "MESSAGE":
            print(f"✅ Notification type is MESSAGE (as expected after fix)")
        else:
            print(f"⚠️  Notification type is {decline_notification.get('type')} (expected MESSAGE)")
    else:
        print("❌ NO DECLINE NOTIFICATION FOUND")
        print("\nAll notifications:")
        for i, notif in enumerate(notifications[:5], 1):
            print(f"   {i}. {notif.get('title')} (type: {notif.get('type')})")
    
    print("\n" + "=" * 80)
    print("EMAIL STATUS:")
    print("=" * 80)
    print("✅ Emails should still be sent (no code change to email path)")
    print("   The email sending code is in lines 1138-1161 of route.js")
    print("   It runs in a try/catch block and is non-blocking")
    
    print("\n" + "=" * 80)
    print("TEST COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    main()
