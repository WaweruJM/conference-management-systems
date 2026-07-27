#!/usr/bin/env python3
"""
SCMS Sponsorship Tiers Backend Test
Tests the new DB-backed sponsorship tiers CRUD feature
"""

import requests
import json
import time

# Base URL from .env
BASE_URL = "https://scms-platform-1.preview.emergentagent.com"
API_URL = f"{BASE_URL}/api"

# Test credentials (all password: password123)
CREDENTIALS = {
    "admin": {"email": "admin@scms.io", "password": "password123"},
    "chief_logistics": {"email": "chief.logistics@scms.io", "password": "password123"},
    "author": {"email": "author@scms.io", "password": "password123"},
    "sponsor": {"email": "sponsor@scms.io", "password": "password123"}
}

def login(email, password, retries=3):
    """Login and return JWT token with retry logic"""
    for attempt in range(retries):
        try:
            response = requests.post(
                f"{API_URL}/auth/login",
                json={"email": email, "password": password},
                timeout=15
            )
            if response.status_code == 200:
                data = response.json()
                return data.get("token")
            elif response.status_code == 502 and attempt < retries - 1:
                print(f"⚠️  Server restarting, retrying login for {email} (attempt {attempt + 1}/{retries})...")
                time.sleep(3)
                continue
            else:
                print(f"❌ Login failed for {email}: {response.status_code}")
                return None
        except Exception as e:
            if attempt < retries - 1:
                print(f"⚠️  Login exception for {email}, retrying (attempt {attempt + 1}/{retries}): {str(e)}")
                time.sleep(3)
                continue
            else:
                print(f"❌ Login exception for {email}: {str(e)}")
                return None
    return None

def test_1_get_sponsorship_tiers_auto_seeds():
    """Test 1: GET /api/sponsorship-tiers auto-seeds 4 defaults (unauthenticated)"""
    print("\n=== TEST 1: GET /api/sponsorship-tiers (Auto-seed Defaults) ===")
    
    try:
        response = requests.get(f"{API_URL}/sponsorship-tiers", timeout=10)
        
        if response.status_code != 200:
            print(f"❌ GET /api/sponsorship-tiers → {response.status_code} (expected 200)")
            return False
        
        data = response.json()
        tiers = data.get("tiers", [])
        
        if len(tiers) < 4:
            print(f"❌ GET /api/sponsorship-tiers → 200 but only {len(tiers)} tiers (expected at least 4)")
            return False
        
        # Check for the 4 default tiers
        tier_keys = [t.get("key") for t in tiers]
        expected_keys = ["PLATINUM", "GOLD", "SILVER", "BRONZE"]
        
        missing_keys = [k for k in expected_keys if k not in tier_keys]
        if missing_keys:
            print(f"❌ Missing default tier keys: {missing_keys}")
            return False
        
        # Validate structure of first tier
        first_tier = tiers[0]
        required_fields = ["id", "key", "label", "price", "currency", "benefits", "displayOrder", "isActive"]
        missing_fields = [f for f in required_fields if f not in first_tier]
        
        if missing_fields:
            print(f"❌ First tier missing required fields: {missing_fields}")
            return False
        
        # Check that benefits is an array
        if not isinstance(first_tier.get("benefits"), list):
            print(f"❌ First tier 'benefits' is not an array")
            return False
        
        # Check default currency is USD
        default_tiers = [t for t in tiers if t.get("key") in expected_keys]
        currencies = [t.get("currency") for t in default_tiers]
        if not all(c == "USD" for c in currencies):
            print(f"⚠️  Some default tiers have non-USD currency: {currencies}")
        
        print(f"✅ GET /api/sponsorship-tiers → 200 with {len(tiers)} tiers")
        print(f"   Default tiers present: {expected_keys}")
        print(f"   All required fields present: {required_fields}")
        print(f"   First tier: {first_tier.get('key')} - {first_tier.get('label')} - {first_tier.get('price')} {first_tier.get('currency')}")
        
        return True
        
    except Exception as e:
        print(f"❌ Exception in test_1: {str(e)}")
        return False

def test_2_post_sponsorship_tiers_rbac():
    """Test 2: POST /api/sponsorship-tiers — RBAC (admin, chief.logistics can create; author, sponsor get 403)"""
    print("\n=== TEST 2: POST /api/sponsorship-tiers (RBAC) ===")
    
    results = []
    created_tier_ids = []
    
    # Test 2a: Admin can create TITANIUM tier
    print("\n--- Test 2a: Admin creates TITANIUM tier ---")
    admin_token = login(CREDENTIALS["admin"]["email"], CREDENTIALS["admin"]["password"])
    if not admin_token:
        print("❌ Admin login failed")
        return False
    
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    titanium_payload = {
        "key": "TITANIUM",
        "label": "Titanium Sponsor",
        "price": "50000",
        "currency": "KES",
        "benefits": ["Top billing", "VIP access"],
        "displayOrder": 0
    }
    
    try:
        response = requests.post(
            f"{API_URL}/sponsorship-tiers",
            json=titanium_payload,
            headers=admin_headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            tier = data.get("tier")
            if tier and tier.get("key") == "TITANIUM" and tier.get("currency") == "KES" and tier.get("displayOrder") == 0:
                created_tier_ids.append(tier.get("id"))
                print(f"✅ POST /api/sponsorship-tiers (admin@scms.io) → 200")
                print(f"   Created tier: {tier.get('key')} - {tier.get('label')} - {tier.get('price')} {tier.get('currency')}")
                results.append(True)
                
                # Verify TITANIUM appears in GET list with correct order
                response2 = requests.get(f"{API_URL}/sponsorship-tiers", timeout=10)
                if response2.status_code == 200:
                    tiers = response2.json().get("tiers", [])
                    titanium = next((t for t in tiers if t.get("key") == "TITANIUM"), None)
                    if titanium and titanium.get("displayOrder") == 0:
                        print(f"✅ GET /api/sponsorship-tiers confirms TITANIUM with displayOrder:0 (first position)")
                        results.append(True)
                    else:
                        print(f"❌ TITANIUM not found in GET list or displayOrder incorrect")
                        results.append(False)
                else:
                    print(f"❌ GET /api/sponsorship-tiers after create → {response2.status_code}")
                    results.append(False)
            else:
                print(f"❌ POST /api/sponsorship-tiers (admin) → 200 but tier data incorrect: {tier}")
                results.append(False)
        else:
            print(f"❌ POST /api/sponsorship-tiers (admin@scms.io) → {response.status_code}: {response.text}")
            results.append(False)
    except Exception as e:
        print(f"❌ Exception in test_2a: {str(e)}")
        results.append(False)
    
    # Test 2b: Chief Logistics can create COPPER tier
    print("\n--- Test 2b: Chief Logistics creates COPPER tier ---")
    chief_token = login(CREDENTIALS["chief_logistics"]["email"], CREDENTIALS["chief_logistics"]["password"])
    if not chief_token:
        print("❌ Chief Logistics login failed")
        return False
    
    chief_headers = {"Authorization": f"Bearer {chief_token}"}
    timestamp = int(time.time())
    copper_payload = {
        "key": f"COPPER{timestamp}",
        "label": "Copper Sponsor",
        "price": "1000",
        "currency": "USD",
        "benefits": ["Basic"]
    }
    
    try:
        response = requests.post(
            f"{API_URL}/sponsorship-tiers",
            json=copper_payload,
            headers=chief_headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            tier = data.get("tier")
            if tier and tier.get("key").startswith("COPPER"):
                created_tier_ids.append(tier.get("id"))
                print(f"✅ POST /api/sponsorship-tiers (chief.logistics@scms.io) → 200")
                print(f"   Created tier: {tier.get('key')} - {tier.get('label')} - {tier.get('price')} {tier.get('currency')}")
                results.append(True)
            else:
                print(f"❌ POST /api/sponsorship-tiers (chief.logistics) → 200 but tier data incorrect")
                results.append(False)
        else:
            print(f"❌ POST /api/sponsorship-tiers (chief.logistics@scms.io) → {response.status_code}: {response.text}")
            results.append(False)
    except Exception as e:
        print(f"❌ Exception in test_2b: {str(e)}")
        results.append(False)
    
    # Test 2c: Author cannot create IRON tier (should get 403)
    print("\n--- Test 2c: Author attempts to create IRON tier (should fail) ---")
    author_token = login(CREDENTIALS["author"]["email"], CREDENTIALS["author"]["password"])
    if not author_token:
        print("❌ Author login failed")
        return False
    
    author_headers = {"Authorization": f"Bearer {author_token}"}
    iron_payload = {
        "key": "IRON",
        "label": "Iron",
        "price": "100"
    }
    
    try:
        response = requests.post(
            f"{API_URL}/sponsorship-tiers",
            json=iron_payload,
            headers=author_headers,
            timeout=10
        )
        
        if response.status_code == 403:
            print(f"✅ POST /api/sponsorship-tiers (author@scms.io) → 403 (correctly denied)")
            results.append(True)
        else:
            print(f"❌ POST /api/sponsorship-tiers (author@scms.io) → {response.status_code} (expected 403)")
            results.append(False)
    except Exception as e:
        print(f"❌ Exception in test_2c: {str(e)}")
        results.append(False)
    
    # Test 2d: Sponsor cannot create tier (should get 403)
    print("\n--- Test 2d: Sponsor attempts to create tier (should fail) ---")
    sponsor_token = login(CREDENTIALS["sponsor"]["email"], CREDENTIALS["sponsor"]["password"])
    if not sponsor_token:
        print("❌ Sponsor login failed")
        return False
    
    sponsor_headers = {"Authorization": f"Bearer {sponsor_token}"}
    
    try:
        response = requests.post(
            f"{API_URL}/sponsorship-tiers",
            json=iron_payload,
            headers=sponsor_headers,
            timeout=10
        )
        
        if response.status_code == 403:
            print(f"✅ POST /api/sponsorship-tiers (sponsor@scms.io) → 403 (correctly denied)")
            results.append(True)
        else:
            print(f"❌ POST /api/sponsorship-tiers (sponsor@scms.io) → {response.status_code} (expected 403)")
            results.append(False)
    except Exception as e:
        print(f"❌ Exception in test_2d: {str(e)}")
        results.append(False)
    
    # Store created tier IDs for cleanup
    if created_tier_ids:
        print(f"\nℹ️  Created tier IDs for cleanup: {created_tier_ids}")
    
    return all(results), created_tier_ids

def test_3_put_sponsorship_tiers(tier_id):
    """Test 3: PUT /api/sponsorship-tiers/:id — edit (admin can edit; author gets 403)"""
    print("\n=== TEST 3: PUT /api/sponsorship-tiers/:id (Edit) ===")
    
    if not tier_id:
        print("❌ No tier ID provided for edit test")
        return False
    
    results = []
    
    # Test 3a: Admin can edit TITANIUM tier
    print(f"\n--- Test 3a: Admin edits tier {tier_id} ---")
    admin_token = login(CREDENTIALS["admin"]["email"], CREDENTIALS["admin"]["password"])
    if not admin_token:
        print("❌ Admin login failed")
        return False
    
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    update_payload = {
        "price": "75000",
        "currency": "KES",
        "label": "Titanium Sponsor - Premium"
    }
    
    try:
        response = requests.put(
            f"{API_URL}/sponsorship-tiers/{tier_id}",
            json=update_payload,
            headers=admin_headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            tier = data.get("tier")
            if tier and tier.get("price") == "75000" and tier.get("label") == "Titanium Sponsor - Premium":
                print(f"✅ PUT /api/sponsorship-tiers/{tier_id} (admin@scms.io) → 200")
                print(f"   Updated tier: {tier.get('label')} - {tier.get('price')} {tier.get('currency')}")
                results.append(True)
                
                # Verify changes persisted
                response2 = requests.get(f"{API_URL}/sponsorship-tiers", timeout=10)
                if response2.status_code == 200:
                    tiers = response2.json().get("tiers", [])
                    updated_tier = next((t for t in tiers if t.get("id") == tier_id), None)
                    if updated_tier and updated_tier.get("price") == "75000":
                        print(f"✅ GET /api/sponsorship-tiers confirms changes persisted")
                        results.append(True)
                    else:
                        print(f"❌ Changes not persisted in GET list")
                        results.append(False)
                else:
                    print(f"❌ GET /api/sponsorship-tiers after update → {response2.status_code}")
                    results.append(False)
            else:
                print(f"❌ PUT /api/sponsorship-tiers (admin) → 200 but tier data incorrect")
                results.append(False)
        else:
            print(f"❌ PUT /api/sponsorship-tiers/{tier_id} (admin@scms.io) → {response.status_code}: {response.text}")
            results.append(False)
    except Exception as e:
        print(f"❌ Exception in test_3a: {str(e)}")
        results.append(False)
    
    # Test 3b: Author cannot edit tier (should get 403)
    print(f"\n--- Test 3b: Author attempts to edit tier {tier_id} (should fail) ---")
    author_token = login(CREDENTIALS["author"]["email"], CREDENTIALS["author"]["password"])
    if not author_token:
        print("❌ Author login failed")
        return False
    
    author_headers = {"Authorization": f"Bearer {author_token}"}
    
    try:
        # Add small delay to avoid hitting server during restart
        time.sleep(2)
        response = requests.put(
            f"{API_URL}/sponsorship-tiers/{tier_id}",
            json={"price": "99999"},
            headers=author_headers,
            timeout=15
        )
        
        if response.status_code == 403:
            print(f"✅ PUT /api/sponsorship-tiers/{tier_id} (author@scms.io) → 403 (correctly denied)")
            results.append(True)
        else:
            print(f"❌ PUT /api/sponsorship-tiers/{tier_id} (author@scms.io) → {response.status_code} (expected 403)")
            results.append(False)
    except Exception as e:
        print(f"❌ Exception in test_3b: {str(e)}")
        results.append(False)
    
    return all(results)

def test_4_delete_sponsorship_tiers(copper_tier_id):
    """Test 4: DELETE /api/sponsorship-tiers/:id (chief.logistics can delete; author gets 403)"""
    print("\n=== TEST 4: DELETE /api/sponsorship-tiers/:id ===")
    
    if not copper_tier_id:
        print("❌ No COPPER tier ID provided for delete test")
        return False
    
    results = []
    
    # Test 4a: Author cannot delete tier (should get 403)
    print(f"\n--- Test 4a: Author attempts to delete tier {copper_tier_id} (should fail) ---")
    author_token = login(CREDENTIALS["author"]["email"], CREDENTIALS["author"]["password"])
    if not author_token:
        print("❌ Author login failed")
        return False
    
    author_headers = {"Authorization": f"Bearer {author_token}"}
    
    try:
        # Add small delay to avoid hitting server during restart
        time.sleep(2)
        response = requests.delete(
            f"{API_URL}/sponsorship-tiers/{copper_tier_id}",
            headers=author_headers,
            timeout=15
        )
        
        if response.status_code == 403:
            print(f"✅ DELETE /api/sponsorship-tiers/{copper_tier_id} (author@scms.io) → 403 (correctly denied)")
            results.append(True)
        else:
            print(f"❌ DELETE /api/sponsorship-tiers/{copper_tier_id} (author@scms.io) → {response.status_code} (expected 403)")
            results.append(False)
    except Exception as e:
        print(f"❌ Exception in test_4a: {str(e)}")
        results.append(False)
    
    # Test 4b: Chief Logistics can delete COPPER tier
    print(f"\n--- Test 4b: Chief Logistics deletes COPPER tier {copper_tier_id} ---")
    chief_token = login(CREDENTIALS["chief_logistics"]["email"], CREDENTIALS["chief_logistics"]["password"])
    if not chief_token:
        print("❌ Chief Logistics login failed")
        return False
    
    chief_headers = {"Authorization": f"Bearer {chief_token}"}
    
    try:
        # Add small delay to avoid hitting server during restart
        time.sleep(2)
        response = requests.delete(
            f"{API_URL}/sponsorship-tiers/{copper_tier_id}",
            headers=chief_headers,
            timeout=15
        )
        
        if response.status_code == 200:
            print(f"✅ DELETE /api/sponsorship-tiers/{copper_tier_id} (chief.logistics@scms.io) → 200")
            results.append(True)
            
            # Verify COPPER is gone from GET list
            response2 = requests.get(f"{API_URL}/sponsorship-tiers", timeout=10)
            if response2.status_code == 200:
                tiers = response2.json().get("tiers", [])
                copper = next((t for t in tiers if t.get("id") == copper_tier_id), None)
                if not copper:
                    print(f"✅ GET /api/sponsorship-tiers confirms COPPER tier is deleted")
                    results.append(True)
                else:
                    print(f"❌ COPPER tier still present in GET list after deletion")
                    results.append(False)
            else:
                print(f"❌ GET /api/sponsorship-tiers after delete → {response2.status_code}")
                results.append(False)
        else:
            print(f"❌ DELETE /api/sponsorship-tiers/{copper_tier_id} (chief.logistics@scms.io) → {response.status_code}: {response.text}")
            results.append(False)
    except Exception as e:
        print(f"❌ Exception in test_4b: {str(e)}")
        results.append(False)
    
    return all(results)

def test_5_regressions():
    """Test 5: Regressions (POST /sponsorship-requests, GET /abstracts, POST /auth/login)"""
    print("\n=== TEST 5: Regressions ===")
    
    results = []
    
    # Test 5a: POST /sponsorship-requests as sponsor
    print("\n--- Test 5a: POST /api/sponsorship-requests (sponsor@scms.io) ---")
    sponsor_token = login(CREDENTIALS["sponsor"]["email"], CREDENTIALS["sponsor"]["password"])
    if not sponsor_token:
        print("❌ Sponsor login failed")
        return False
    
    sponsor_headers = {"Authorization": f"Bearer {sponsor_token}"}
    
    # First, get the featured conference ID
    try:
        response = requests.get(f"{API_URL}/conferences", timeout=10)
        if response.status_code == 200:
            conferences = response.json().get("conferences", [])
            if conferences:
                conf_id = conferences[0].get("id")
                print(f"ℹ️  Using conference ID: {conf_id}")
                
                # Now create sponsorship request
                request_payload = {
                    "conferenceId": conf_id,
                    "companyName": "Test Company",
                    "sponsorTier": "TITANIUM",
                    "contactEmail": "sponsor@scms.io"
                }
                
                response2 = requests.post(
                    f"{API_URL}/sponsorship-requests",
                    json=request_payload,
                    headers=sponsor_headers,
                    timeout=10
                )
                
                if response2.status_code == 200:
                    print(f"✅ POST /api/sponsorship-requests (sponsor@scms.io) → 200")
                    results.append(True)
                else:
                    print(f"❌ POST /api/sponsorship-requests → {response2.status_code}: {response2.text}")
                    results.append(False)
            else:
                print(f"❌ No conferences found for sponsorship request test")
                results.append(False)
        else:
            print(f"❌ GET /api/conferences → {response.status_code}")
            results.append(False)
    except Exception as e:
        print(f"❌ Exception in test_5a: {str(e)}")
        results.append(False)
    
    # Test 5b: GET /abstracts as admin (still works)
    print("\n--- Test 5b: GET /api/abstracts (admin@scms.io) ---")
    admin_token = login(CREDENTIALS["admin"]["email"], CREDENTIALS["admin"]["password"])
    if not admin_token:
        print("❌ Admin login failed")
        return False
    
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    try:
        response = requests.get(f"{API_URL}/abstracts", headers=admin_headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            abstracts = data.get("abstracts", [])
            print(f"✅ GET /api/abstracts (admin@scms.io) → 200 with {len(abstracts)} abstracts")
            results.append(True)
        else:
            print(f"❌ GET /api/abstracts → {response.status_code}")
            results.append(False)
    except Exception as e:
        print(f"❌ Exception in test_5b: {str(e)}")
        results.append(False)
    
    # Test 5c: POST /auth/login for all four accounts
    print("\n--- Test 5c: POST /api/auth/login (all 4 test accounts) ---")
    login_results = []
    
    for role, creds in CREDENTIALS.items():
        try:
            response = requests.post(
                f"{API_URL}/auth/login",
                json=creds,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                token = data.get("token")
                if token:
                    print(f"✅ POST /api/auth/login ({creds['email']}) → 200 with JWT")
                    login_results.append(True)
                else:
                    print(f"❌ POST /api/auth/login ({creds['email']}) → 200 but no token")
                    login_results.append(False)
            else:
                print(f"❌ POST /api/auth/login ({creds['email']}) → {response.status_code}")
                login_results.append(False)
        except Exception as e:
            print(f"❌ Exception logging in {creds['email']}: {str(e)}")
            login_results.append(False)
    
    results.append(all(login_results))
    
    return all(results)

def cleanup_test_tiers(tier_ids):
    """Cleanup: Delete test tiers created during testing"""
    print("\n=== CLEANUP: Deleting Test Tiers ===")
    
    admin_token = login(CREDENTIALS["admin"]["email"], CREDENTIALS["admin"]["password"])
    if not admin_token:
        print("❌ Admin login failed - cannot cleanup")
        return
    
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    for tier_id in tier_ids:
        try:
            response = requests.delete(
                f"{API_URL}/sponsorship-tiers/{tier_id}",
                headers=admin_headers,
                timeout=10
            )
            
            if response.status_code == 200:
                print(f"✅ Deleted tier {tier_id}")
            else:
                print(f"⚠️  Failed to delete tier {tier_id}: {response.status_code}")
        except Exception as e:
            print(f"⚠️  Exception deleting tier {tier_id}: {str(e)}")

def main():
    """Run all sponsorship tiers tests"""
    print("=" * 80)
    print("SCMS SPONSORSHIP TIERS BACKEND TEST")
    print("Testing new DB-backed sponsorship tiers CRUD feature")
    print("=" * 80)
    
    results = {}
    created_tier_ids = []
    titanium_tier_id = None
    copper_tier_id = None
    
    # Test 1: GET /sponsorship-tiers auto-seeds defaults
    results["Test 1: GET /sponsorship-tiers (auto-seed)"] = test_1_get_sponsorship_tiers_auto_seeds()
    
    # Test 2: POST /sponsorship-tiers RBAC
    test_2_result, tier_ids = test_2_post_sponsorship_tiers_rbac()
    results["Test 2: POST /sponsorship-tiers (RBAC)"] = test_2_result
    created_tier_ids.extend(tier_ids)
    
    # Find TITANIUM and COPPER tier IDs for subsequent tests
    if len(tier_ids) >= 1:
        titanium_tier_id = tier_ids[0]  # First created is TITANIUM
    if len(tier_ids) >= 2:
        copper_tier_id = tier_ids[1]  # Second created is COPPER
    
    # Test 3: PUT /sponsorship-tiers/:id
    if titanium_tier_id:
        results["Test 3: PUT /sponsorship-tiers/:id (edit)"] = test_3_put_sponsorship_tiers(titanium_tier_id)
    else:
        print("\n⚠️  Skipping Test 3 - no TITANIUM tier ID available")
        results["Test 3: PUT /sponsorship-tiers/:id (edit)"] = False
    
    # Test 4: DELETE /sponsorship-tiers/:id
    if copper_tier_id:
        results["Test 4: DELETE /sponsorship-tiers/:id"] = test_4_delete_sponsorship_tiers(copper_tier_id)
        # Remove COPPER from cleanup list since it's already deleted
        if copper_tier_id in created_tier_ids:
            created_tier_ids.remove(copper_tier_id)
    else:
        print("\n⚠️  Skipping Test 4 - no COPPER tier ID available")
        results["Test 4: DELETE /sponsorship-tiers/:id"] = False
    
    # Test 5: Regressions
    results["Test 5: Regressions"] = test_5_regressions()
    
    # Cleanup remaining test tiers (TITANIUM)
    if created_tier_ids:
        cleanup_test_tiers(created_tier_ids)
    
    # Summary
    print("\n" + "=" * 80)
    print("SPONSORSHIP TIERS TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, passed_flag in results.items():
        status = "✅ PASS" if passed_flag else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print("=" * 80)
    print(f"TOTAL: {passed}/{total} test groups passed")
    print("=" * 80)
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
