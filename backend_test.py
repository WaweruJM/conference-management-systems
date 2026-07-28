#!/usr/bin/env python3
"""
Backend API test for SCMS - Attendee Registration Gate
Tests the new attendee registration gate feature added to POST /api/auth/register
"""

import requests
import json
import time
import sys

BASE_URL = "https://scms-platform-1.preview.emergentagent.com/api"

def log(msg):
    print(f"[TEST] {msg}")

def test_attendee_registration_gate():
    """
    Test the attendee registration gate feature:
    1. Setup: Login as admin, get featured conference, force attendeeRegistrationOpen=false
    2. Blocked ATTENDEE signup when gate is closed (expect 409)
    3. AUTHOR still works when gate is closed (expect 200)
    4. INDUSTRY_PARTNER still works when gate is closed (expect 200)
    5. Toggle gate ON (expect 200)
    6. ATTENDEE signup succeeds when gate is open (expect 200)
    7. Reset: Toggle back to false
    8. Regression: POST /api/conferences/:id/register with ATTENDEE type when gate is off
    """
    
    timestamp = int(time.time())
    
    try:
        # ============ STEP 1: BASELINE SETUP ============
        log("=" * 80)
        log("STEP 1: BASELINE SETUP")
        log("=" * 80)
        
        # Login as admin
        log("Logging in as admin@scms.io...")
        login_resp = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": "admin@scms.io", "password": "password123"},
            headers={"Content-Type": "application/json"}
        )
        
        if login_resp.status_code != 200:
            log(f"❌ FAILED: Admin login returned {login_resp.status_code}")
            log(f"Response: {login_resp.text}")
            return False
        
        admin_token = login_resp.json().get("token")
        log(f"✅ Admin login successful, token: {admin_token[:20]}...")
        
        # Get featured conference
        log("Getting featured conference from /api/public/config...")
        config_resp = requests.get(f"{BASE_URL}/public/config")
        
        if config_resp.status_code != 200:
            log(f"❌ FAILED: GET /public/config returned {config_resp.status_code}")
            return False
        
        conference = config_resp.json().get("conference")
        if not conference:
            log("❌ FAILED: No conference found in /public/config")
            return False
        
        conference_id = conference.get("id")
        conference_name = conference.get("name")
        log(f"✅ Featured conference: {conference_name} (ID: {conference_id})")
        
        # Force attendeeRegistrationOpen=false
        log("Setting attendeeRegistrationOpen=false...")
        toggle_resp = requests.put(
            f"{BASE_URL}/conferences/{conference_id}/attendee-registration",
            json={"open": False},
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {admin_token}"
            }
        )
        
        if toggle_resp.status_code != 200:
            log(f"❌ FAILED: PUT attendee-registration returned {toggle_resp.status_code}")
            log(f"Response: {toggle_resp.text}")
            return False
        
        updated_conf = toggle_resp.json().get("conference")
        log(f"✅ attendeeRegistrationOpen set to: {updated_conf.get('attendeeRegistrationOpen')}")
        
        # ============ STEP 2: BLOCKED ATTENDEE SIGNUP ============
        log("\n" + "=" * 80)
        log("STEP 2: BLOCKED ATTENDEE SIGNUP (gate closed)")
        log("=" * 80)
        
        blocked_email = f"gate-blocked-{timestamp}@test.io"
        log(f"Attempting to register as ATTENDEE with email: {blocked_email}")
        
        blocked_resp = requests.post(
            f"{BASE_URL}/auth/register",
            json={
                "email": blocked_email,
                "password": "password123",
                "firstName": "Gate",
                "lastName": "Blocked",
                "role": "ATTENDEE"
            },
            headers={"Content-Type": "application/json"}
        )
        
        if blocked_resp.status_code != 409:
            log(f"❌ FAILED: Expected 409, got {blocked_resp.status_code}")
            log(f"Response: {blocked_resp.text}")
            return False
        
        error_msg = blocked_resp.json().get("error", "")
        log(f"✅ Correctly returned 409")
        log(f"✅ Error message: {error_msg}")
        
        if "Attendee registration is not yet open" not in error_msg:
            log(f"❌ FAILED: Error message doesn't contain expected text")
            log(f"Expected: 'Attendee registration is not yet open'")
            log(f"Got: {error_msg}")
            return False
        
        log("✅ Error message contains 'Attendee registration is not yet open'")
        
        # ============ STEP 3: AUTHOR STILL WORKS ============
        log("\n" + "=" * 80)
        log("STEP 3: AUTHOR signup (gate closed - should still work)")
        log("=" * 80)
        
        author_email = f"gate-author-{timestamp}@test.io"
        log(f"Attempting to register as AUTHOR with email: {author_email}")
        
        author_resp = requests.post(
            f"{BASE_URL}/auth/register",
            json={
                "email": author_email,
                "password": "password123",
                "firstName": "Gate",
                "lastName": "Author",
                "role": "AUTHOR"
            },
            headers={"Content-Type": "application/json"}
        )
        
        if author_resp.status_code != 200:
            log(f"❌ FAILED: Expected 200, got {author_resp.status_code}")
            log(f"Response: {author_resp.text}")
            return False
        
        author_data = author_resp.json()
        if not author_data.get("token"):
            log(f"❌ FAILED: No token returned")
            return False
        
        log(f"✅ AUTHOR registration successful, token: {author_data['token'][:20]}...")
        
        # ============ STEP 4: INDUSTRY_PARTNER STILL WORKS ============
        log("\n" + "=" * 80)
        log("STEP 4: INDUSTRY_PARTNER signup (gate closed - should still work)")
        log("=" * 80)
        
        partner_email = f"gate-partner-{timestamp}@test.io"
        log(f"Attempting to register as INDUSTRY_PARTNER with email: {partner_email}")
        
        partner_resp = requests.post(
            f"{BASE_URL}/auth/register",
            json={
                "email": partner_email,
                "password": "password123",
                "firstName": "Gate",
                "lastName": "Partner",
                "role": "INDUSTRY_PARTNER"
            },
            headers={"Content-Type": "application/json"}
        )
        
        if partner_resp.status_code != 200:
            log(f"❌ FAILED: Expected 200, got {partner_resp.status_code}")
            log(f"Response: {partner_resp.text}")
            return False
        
        partner_data = partner_resp.json()
        if not partner_data.get("token"):
            log(f"❌ FAILED: No token returned")
            return False
        
        log(f"✅ INDUSTRY_PARTNER registration successful, token: {partner_data['token'][:20]}...")
        
        # ============ STEP 5: TOGGLE GATE ON ============
        log("\n" + "=" * 80)
        log("STEP 5: TOGGLE GATE ON")
        log("=" * 80)
        
        log("Setting attendeeRegistrationOpen=true...")
        toggle_on_resp = requests.put(
            f"{BASE_URL}/conferences/{conference_id}/attendee-registration",
            json={"open": True},
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {admin_token}"
            }
        )
        
        if toggle_on_resp.status_code != 200:
            log(f"❌ FAILED: PUT attendee-registration returned {toggle_on_resp.status_code}")
            log(f"Response: {toggle_on_resp.text}")
            return False
        
        updated_conf_on = toggle_on_resp.json().get("conference")
        log(f"✅ attendeeRegistrationOpen set to: {updated_conf_on.get('attendeeRegistrationOpen')}")
        
        # ============ STEP 6: ATTENDEE SIGNUP SUCCEEDS ============
        log("\n" + "=" * 80)
        log("STEP 6: ATTENDEE signup (gate open - should succeed)")
        log("=" * 80)
        
        allowed_email = f"gate-allowed-{timestamp}@test.io"
        log(f"Attempting to register as ATTENDEE with email: {allowed_email}")
        
        allowed_resp = requests.post(
            f"{BASE_URL}/auth/register",
            json={
                "email": allowed_email,
                "password": "password123",
                "firstName": "Gate",
                "lastName": "Allowed",
                "role": "ATTENDEE"
            },
            headers={"Content-Type": "application/json"}
        )
        
        if allowed_resp.status_code != 200:
            log(f"❌ FAILED: Expected 200, got {allowed_resp.status_code}")
            log(f"Response: {allowed_resp.text}")
            return False
        
        allowed_data = allowed_resp.json()
        if not allowed_data.get("token"):
            log(f"❌ FAILED: No token returned")
            return False
        
        log(f"✅ ATTENDEE registration successful, token: {allowed_data['token'][:20]}...")
        
        # ============ STEP 7: RESET GATE ============
        log("\n" + "=" * 80)
        log("STEP 7: RESET GATE (set back to false)")
        log("=" * 80)
        
        log("Setting attendeeRegistrationOpen=false...")
        reset_resp = requests.put(
            f"{BASE_URL}/conferences/{conference_id}/attendee-registration",
            json={"open": False},
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {admin_token}"
            }
        )
        
        if reset_resp.status_code != 200:
            log(f"❌ FAILED: PUT attendee-registration returned {reset_resp.status_code}")
            log(f"Response: {reset_resp.text}")
            return False
        
        reset_conf = reset_resp.json().get("conference")
        log(f"✅ attendeeRegistrationOpen reset to: {reset_conf.get('attendeeRegistrationOpen')}")
        
        # ============ STEP 8: REGRESSION TEST ============
        log("\n" + "=" * 80)
        log("STEP 8: REGRESSION TEST - Conference-level registration gate")
        log("=" * 80)
        
        # First create a new user to test conference registration
        regression_email = f"gate-regression-{timestamp}@test.io"
        log(f"Creating test user as AUTHOR: {regression_email}")
        
        regression_user_resp = requests.post(
            f"{BASE_URL}/auth/register",
            json={
                "email": regression_email,
                "password": "password123",
                "firstName": "Regression",
                "lastName": "Test",
                "role": "AUTHOR"
            },
            headers={"Content-Type": "application/json"}
        )
        
        if regression_user_resp.status_code != 200:
            log(f"❌ FAILED: User creation returned {regression_user_resp.status_code}")
            return False
        
        regression_token = regression_user_resp.json().get("token")
        log(f"✅ Test user created, token: {regression_token[:20]}...")
        
        # Now try to register for the conference as ATTENDEE (should fail because gate is closed)
        log(f"Attempting POST /api/conferences/{conference_id}/register with type=ATTENDEE...")
        
        conf_reg_resp = requests.post(
            f"{BASE_URL}/conferences/{conference_id}/register",
            json={"type": "ATTENDEE"},
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {regression_token}"
            }
        )
        
        if conf_reg_resp.status_code != 409:
            log(f"❌ FAILED: Expected 409, got {conf_reg_resp.status_code}")
            log(f"Response: {conf_reg_resp.text}")
            return False
        
        conf_error_msg = conf_reg_resp.json().get("error", "")
        log(f"✅ Correctly returned 409")
        log(f"✅ Error message: {conf_error_msg}")
        
        if "Attendee registration is not yet open" not in conf_error_msg:
            log(f"❌ FAILED: Conference registration error message doesn't contain expected text")
            log(f"Expected: 'Attendee registration is not yet open'")
            log(f"Got: {conf_error_msg}")
            return False
        
        log("✅ Conference-level registration gate working correctly")
        
        # ============ ALL TESTS PASSED ============
        log("\n" + "=" * 80)
        log("✅ ALL TESTS PASSED")
        log("=" * 80)
        log("Summary:")
        log("  ✅ Step 1: Baseline setup (admin login, get conference, set gate=false)")
        log("  ✅ Step 2: ATTENDEE signup blocked when gate closed (409)")
        log("  ✅ Step 3: AUTHOR signup works when gate closed (200)")
        log("  ✅ Step 4: INDUSTRY_PARTNER signup works when gate closed (200)")
        log("  ✅ Step 5: Toggle gate ON (200)")
        log("  ✅ Step 6: ATTENDEE signup succeeds when gate open (200)")
        log("  ✅ Step 7: Reset gate to false (200)")
        log("  ✅ Step 8: Conference-level registration gate still enforced (409)")
        
        return True
        
    except Exception as e:
        log(f"❌ EXCEPTION: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_attendee_registration_gate()
    sys.exit(0 if success else 1)
