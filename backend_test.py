#!/usr/bin/env python3
"""
Backend test for Phase 2b — Presentation Sequence Editor
Tests GET/PUT /api/conferences/:id/presentation-sequence + POST /api/conferences/:id/merged-presentation
"""

import requests
import json
import os
import shutil
from datetime import datetime

BASE_URL = "http://localhost:3000"
FEATURED_CONF_ID = "e01de36e-e09e-479f-bd53-c056b2a90436"
FAKE_CONF_ID = "bbbbbbbb-1111-2222-3333-444444444444"

# Test credentials (all password: password123)
CREDENTIALS = {
    "admin": {"email": "admin@scms.io", "password": "password123"},
    "chief": {"email": "chief@scms.io", "password": "password123"},
    "author": {"email": "author@scms.io", "password": "password123"},
    "committee": {"email": "committee@scms.io", "password": "password123"},
    "reviewer2": {"email": "reviewer2@scms.io", "password": "password123"},
}

tokens = {}

def login(role):
    """Login and get JWT token"""
    try:
        creds = CREDENTIALS[role]
        resp = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            token = data.get("token")
            tokens[role] = token
            print(f"✅ Login as {role}@scms.io successful")
            return token
        else:
            print(f"❌ Login as {role}@scms.io failed: {resp.status_code}")
            return None
    except Exception as e:
        print(f"❌ Login as {role}@scms.io exception: {e}")
        return None

def backup_sequence_file():
    """Backup the sequence.json file"""
    seq_path = f"/app/uploads/merged/{FEATURED_CONF_ID}/sequence.json"
    backup_path = f"/app/uploads/merged/{FEATURED_CONF_ID}/sequence.json.backup"
    try:
        if os.path.exists(seq_path):
            shutil.copy2(seq_path, backup_path)
            print(f"✅ Backed up sequence.json to {backup_path}")
            return True
        else:
            print(f"ℹ️  No sequence.json found at {seq_path}")
            return False
    except Exception as e:
        print(f"❌ Failed to backup sequence.json: {e}")
        return False

def restore_sequence_file():
    """Restore the sequence.json file from backup"""
    seq_path = f"/app/uploads/merged/{FEATURED_CONF_ID}/sequence.json"
    backup_path = f"/app/uploads/merged/{FEATURED_CONF_ID}/sequence.json.backup"
    try:
        if os.path.exists(backup_path):
            shutil.copy2(backup_path, seq_path)
            print(f"✅ Restored sequence.json from backup")
            return True
        else:
            print(f"ℹ️  No backup found at {backup_path}")
            return False
    except Exception as e:
        print(f"❌ Failed to restore sequence.json: {e}")
        return False

def delete_sequence_file():
    """Delete the sequence.json file"""
    seq_path = f"/app/uploads/merged/{FEATURED_CONF_ID}/sequence.json"
    try:
        if os.path.exists(seq_path):
            os.remove(seq_path)
            print(f"✅ Deleted sequence.json")
            return True
        else:
            print(f"ℹ️  No sequence.json to delete")
            return False
    except Exception as e:
        print(f"❌ Failed to delete sequence.json: {e}")
        return False

def test_a_get_sequence():
    """Test A: GET sequence scenarios"""
    print("\n" + "="*80)
    print("TEST A: GET /api/conferences/:id/presentation-sequence")
    print("="*80)
    
    # A1: GET on featured conference with saved sequence
    print("\n--- A1: GET on featured conference (should have saved sequence) ---")
    try:
        resp = requests.get(f"{BASE_URL}/api/conferences/{FEATURED_CONF_ID}/presentation-sequence", timeout=10)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            seq = data.get("sequence", {})
            print(f"✅ GET returned 200")
            print(f"   Source: {seq.get('source')}")
            print(f"   Items count: {len(seq.get('items', []))}")
            print(f"   UpdatedAt: {seq.get('updatedAt')}")
            print(f"   UpdatedBy: {seq.get('updatedBy')}")
            if seq.get('source') == 'saved':
                print(f"✅ Source is 'saved' as expected")
            else:
                print(f"⚠️  Source is '{seq.get('source')}', expected 'saved'")
            if len(seq.get('items', [])) >= 1:
                print(f"✅ Has {len(seq.get('items', []))} items")
                # Show first item
                first_item = seq['items'][0]
                print(f"   First item type: {first_item.get('type')}")
            else:
                print(f"⚠️  No items in sequence")
        else:
            print(f"❌ GET failed with status {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"❌ GET exception: {e}")
    
    # A2: GET on non-existent conference
    print("\n--- A2: GET on non-existent conference (should return 404) ---")
    try:
        resp = requests.get(f"{BASE_URL}/api/conferences/{FAKE_CONF_ID}/presentation-sequence", timeout=10)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 404:
            print(f"✅ GET returned 404 as expected")
        else:
            print(f"❌ GET returned {resp.status_code}, expected 404")
    except Exception as e:
        print(f"❌ GET exception: {e}")
    
    # A3: GET with auto-derived sequence (delete sequence.json first)
    print("\n--- A3: GET with auto-derived sequence (delete sequence.json first) ---")
    backup_exists = backup_sequence_file()
    delete_sequence_file()
    try:
        resp = requests.get(f"{BASE_URL}/api/conferences/{FEATURED_CONF_ID}/presentation-sequence", timeout=10)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            seq = data.get("sequence", {})
            print(f"✅ GET returned 200")
            print(f"   Source: {seq.get('source')}")
            print(f"   Items count: {len(seq.get('items', []))}")
            if seq.get('source') == 'auto':
                print(f"✅ Source is 'auto' as expected (no saved sequence)")
            else:
                print(f"⚠️  Source is '{seq.get('source')}', expected 'auto'")
            # Check that items are talks only
            items = seq.get('items', [])
            if items:
                all_talks = all(item.get('type') == 'talk' for item in items)
                if all_talks:
                    print(f"✅ All items are talks (auto-derived from programme)")
                else:
                    print(f"⚠️  Not all items are talks")
        else:
            print(f"❌ GET failed with status {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"❌ GET exception: {e}")
    finally:
        if backup_exists:
            restore_sequence_file()

def test_b_put_rbac():
    """Test B: PUT RBAC"""
    print("\n" + "="*80)
    print("TEST B: PUT /api/conferences/:id/presentation-sequence RBAC")
    print("="*80)
    
    test_payload = {
        "items": [
            {
                "id": "test-break-1",
                "type": "break",
                "kind": "tea",
                "title": "Morning Tea",
                "durationMin": 15
            }
        ]
    }
    
    # B1: PUT without Authorization header
    print("\n--- B1: PUT without Authorization header (should return 401) ---")
    try:
        resp = requests.put(
            f"{BASE_URL}/api/conferences/{FEATURED_CONF_ID}/presentation-sequence",
            json=test_payload,
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 401:
            print(f"✅ PUT returned 401 as expected")
        else:
            print(f"❌ PUT returned {resp.status_code}, expected 401")
    except Exception as e:
        print(f"❌ PUT exception: {e}")
    
    # B2: PUT as author
    print("\n--- B2: PUT as author@scms.io (should return 403) ---")
    try:
        headers = {"Authorization": f"Bearer {tokens['author']}"}
        resp = requests.put(
            f"{BASE_URL}/api/conferences/{FEATURED_CONF_ID}/presentation-sequence",
            json=test_payload,
            headers=headers,
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 403:
            print(f"✅ PUT returned 403 as expected")
            error_msg = resp.json().get('error', '')
            if 'Admin' in error_msg or 'Chief' in error_msg or 'Managing' in error_msg:
                print(f"✅ Error message mentions required roles: {error_msg}")
            else:
                print(f"⚠️  Error message doesn't mention required roles: {error_msg}")
        else:
            print(f"❌ PUT returned {resp.status_code}, expected 403")
    except Exception as e:
        print(f"❌ PUT exception: {e}")
    
    # B3: PUT as committee
    print("\n--- B3: PUT as committee@scms.io (should return 403) ---")
    try:
        headers = {"Authorization": f"Bearer {tokens['committee']}"}
        resp = requests.put(
            f"{BASE_URL}/api/conferences/{FEATURED_CONF_ID}/presentation-sequence",
            json=test_payload,
            headers=headers,
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 403:
            print(f"✅ PUT returned 403 as expected")
        else:
            print(f"❌ PUT returned {resp.status_code}, expected 403")
    except Exception as e:
        print(f"❌ PUT exception: {e}")
    
    # B4: PUT as reviewer2
    print("\n--- B4: PUT as reviewer2@scms.io (should return 403) ---")
    try:
        headers = {"Authorization": f"Bearer {tokens['reviewer2']}"}
        resp = requests.put(
            f"{BASE_URL}/api/conferences/{FEATURED_CONF_ID}/presentation-sequence",
            json=test_payload,
            headers=headers,
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 403:
            print(f"✅ PUT returned 403 as expected")
        else:
            print(f"❌ PUT returned {resp.status_code}, expected 403")
    except Exception as e:
        print(f"❌ PUT exception: {e}")
    
    # B5: PUT as chief
    print("\n--- B5: PUT as chief@scms.io (should return 200) ---")
    try:
        headers = {"Authorization": f"Bearer {tokens['chief']}"}
        resp = requests.put(
            f"{BASE_URL}/api/conferences/{FEATURED_CONF_ID}/presentation-sequence",
            json=test_payload,
            headers=headers,
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            seq = data.get("sequence", {})
            print(f"✅ PUT returned 200")
            print(f"   Source: {seq.get('source')}")
            print(f"   UpdatedBy: {seq.get('updatedBy')}")
            if seq.get('source') == 'saved':
                print(f"✅ Source is 'saved' as expected")
            else:
                print(f"⚠️  Source is '{seq.get('source')}', expected 'saved'")
        else:
            print(f"❌ PUT returned {resp.status_code}, expected 200: {resp.text}")
    except Exception as e:
        print(f"❌ PUT exception: {e}")
    
    # B6: PUT as admin
    print("\n--- B6: PUT as admin@scms.io (should return 200) ---")
    try:
        headers = {"Authorization": f"Bearer {tokens['admin']}"}
        resp = requests.put(
            f"{BASE_URL}/api/conferences/{FEATURED_CONF_ID}/presentation-sequence",
            json=test_payload,
            headers=headers,
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            print(f"✅ PUT returned 200")
        else:
            print(f"❌ PUT returned {resp.status_code}, expected 200: {resp.text}")
    except Exception as e:
        print(f"❌ PUT exception: {e}")

def test_c_put_validation():
    """Test C: PUT validation"""
    print("\n" + "="*80)
    print("TEST C: PUT /api/conferences/:id/presentation-sequence validation")
    print("="*80)
    
    headers = {"Authorization": f"Bearer {tokens['admin']}"}
    
    # C1: Unknown type items (should be dropped)
    print("\n--- C1: PUT with unknown type 'xyz' (should be dropped) ---")
    try:
        payload = {
            "items": [
                {"id": "valid-1", "type": "break", "kind": "tea", "durationMin": 10},
                {"id": "invalid-1", "type": "xyz", "durationMin": 10},
                {"id": "valid-2", "type": "break", "kind": "lunch", "durationMin": 20}
            ]
        }
        resp = requests.put(
            f"{BASE_URL}/api/conferences/{FEATURED_CONF_ID}/presentation-sequence",
            json=payload,
            headers=headers,
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            items = data.get("sequence", {}).get("items", [])
            print(f"✅ PUT returned 200")
            print(f"   Items count: {len(items)} (sent 3, expected 2 after dropping unknown type)")
            if len(items) == 2:
                print(f"✅ Unknown type item was dropped")
            else:
                print(f"⚠️  Expected 2 items, got {len(items)}")
        else:
            print(f"❌ PUT returned {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"❌ PUT exception: {e}")
    
    # C2: durationMin clamping (9999 → 480)
    print("\n--- C2: PUT with durationMin=9999 (should clamp to 480) ---")
    try:
        payload = {
            "items": [
                {"id": "test-1", "type": "break", "kind": "tea", "durationMin": 9999}
            ]
        }
        resp = requests.put(
            f"{BASE_URL}/api/conferences/{FEATURED_CONF_ID}/presentation-sequence",
            json=payload,
            headers=headers,
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            items = data.get("sequence", {}).get("items", [])
            print(f"✅ PUT returned 200")
            if items and items[0].get('durationMin') == 480:
                print(f"✅ durationMin clamped to 480")
            else:
                print(f"⚠️  durationMin is {items[0].get('durationMin')}, expected 480")
        else:
            print(f"❌ PUT returned {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"❌ PUT exception: {e}")
    
    # C3: durationMin clamping (0 → 1)
    print("\n--- C3: PUT with durationMin=0 (should clamp to 1) ---")
    try:
        payload = {
            "items": [
                {"id": "test-1", "type": "break", "kind": "tea", "durationMin": 0}
            ]
        }
        resp = requests.put(
            f"{BASE_URL}/api/conferences/{FEATURED_CONF_ID}/presentation-sequence",
            json=payload,
            headers=headers,
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            items = data.get("sequence", {}).get("items", [])
            print(f"✅ PUT returned 200")
            if items and items[0].get('durationMin') == 1:
                print(f"✅ durationMin clamped to 1")
            else:
                print(f"⚠️  durationMin is {items[0].get('durationMin')}, expected 1")
        else:
            print(f"❌ PUT returned {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"❌ PUT exception: {e}")
    
    # C4: durationMin clamping (negative → 1)
    print("\n--- C4: PUT with durationMin=-10 (should clamp to 1) ---")
    try:
        payload = {
            "items": [
                {"id": "test-1", "type": "break", "kind": "tea", "durationMin": -10}
            ]
        }
        resp = requests.put(
            f"{BASE_URL}/api/conferences/{FEATURED_CONF_ID}/presentation-sequence",
            json=payload,
            headers=headers,
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            items = data.get("sequence", {}).get("items", [])
            print(f"✅ PUT returned 200")
            if items and items[0].get('durationMin') == 1:
                print(f"✅ durationMin clamped to 1")
            else:
                print(f"⚠️  durationMin is {items[0].get('durationMin')}, expected 1")
        else:
            print(f"❌ PUT returned {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"❌ PUT exception: {e}")
    
    # C5: kind coercion (invalid → 'tea')
    print("\n--- C5: PUT with kind='party' (should coerce to 'tea') ---")
    try:
        payload = {
            "items": [
                {"id": "test-1", "type": "break", "kind": "party", "durationMin": 15}
            ]
        }
        resp = requests.put(
            f"{BASE_URL}/api/conferences/{FEATURED_CONF_ID}/presentation-sequence",
            json=payload,
            headers=headers,
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            items = data.get("sequence", {}).get("items", [])
            print(f"✅ PUT returned 200")
            if items and items[0].get('kind') == 'tea':
                print(f"✅ kind coerced to 'tea'")
            else:
                print(f"⚠️  kind is '{items[0].get('kind')}', expected 'tea'")
        else:
            print(f"❌ PUT returned {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"❌ PUT exception: {e}")
    
    # C6: String truncation (title 500 chars → 200)
    print("\n--- C6: PUT with title=500 chars (should truncate to 200) ---")
    try:
        long_title = "A" * 500
        payload = {
            "items": [
                {"id": "test-1", "type": "break", "kind": "tea", "title": long_title, "durationMin": 15}
            ]
        }
        resp = requests.put(
            f"{BASE_URL}/api/conferences/{FEATURED_CONF_ID}/presentation-sequence",
            json=payload,
            headers=headers,
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            items = data.get("sequence", {}).get("items", [])
            print(f"✅ PUT returned 200")
            if items and len(items[0].get('title', '')) == 200:
                print(f"✅ title truncated to 200 chars")
            else:
                print(f"⚠️  title length is {len(items[0].get('title', ''))}, expected 200")
        else:
            print(f"❌ PUT returned {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"❌ PUT exception: {e}")
    
    # C7: String truncation (speakerBio 6000 chars → 4000)
    print("\n--- C7: PUT with speakerBio=6000 chars (should truncate to 4000) ---")
    try:
        long_bio = "B" * 6000
        payload = {
            "items": [
                {
                    "id": "test-1",
                    "type": "sponsor",
                    "sponsorName": "Test Sponsor",
                    "title": "Test Talk",
                    "speakerName": "Dr. Test",
                    "speakerBio": long_bio,
                    "description": "Test description",
                    "durationMin": 20
                }
            ]
        }
        resp = requests.put(
            f"{BASE_URL}/api/conferences/{FEATURED_CONF_ID}/presentation-sequence",
            json=payload,
            headers=headers,
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            items = data.get("sequence", {}).get("items", [])
            print(f"✅ PUT returned 200")
            if items and len(items[0].get('speakerBio', '')) == 4000:
                print(f"✅ speakerBio truncated to 4000 chars")
            else:
                print(f"⚠️  speakerBio length is {len(items[0].get('speakerBio', ''))}, expected 4000")
        else:
            print(f"❌ PUT returned {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"❌ PUT exception: {e}")
    
    # C8: Idempotency
    print("\n--- C8: PUT idempotency (same payload twice) ---")
    try:
        payload = {
            "items": [
                {"id": "test-1", "type": "break", "kind": "tea", "title": "Test Break", "durationMin": 15}
            ]
        }
        # First PUT
        resp1 = requests.put(
            f"{BASE_URL}/api/conferences/{FEATURED_CONF_ID}/presentation-sequence",
            json=payload,
            headers=headers,
            timeout=10
        )
        print(f"First PUT status: {resp1.status_code}")
        if resp1.status_code == 200:
            data1 = resp1.json()
            items1 = data1.get("sequence", {}).get("items", [])
            
            # Second PUT with same payload
            resp2 = requests.put(
                f"{BASE_URL}/api/conferences/{FEATURED_CONF_ID}/presentation-sequence",
                json=payload,
                headers=headers,
                timeout=10
            )
            print(f"Second PUT status: {resp2.status_code}")
            if resp2.status_code == 200:
                data2 = resp2.json()
                items2 = data2.get("sequence", {}).get("items", [])
                print(f"✅ Both PUTs returned 200")
                
                # Compare items (excluding updatedAt which will differ)
                if len(items1) == len(items2):
                    print(f"✅ Items count matches ({len(items1)})")
                    # Compare first item fields
                    if items1 and items2:
                        item1 = {k: v for k, v in items1[0].items() if k != 'updatedAt'}
                        item2 = {k: v for k, v in items2[0].items() if k != 'updatedAt'}
                        if item1 == item2:
                            print(f"✅ Items have identical shape (idempotent)")
                        else:
                            print(f"⚠️  Items differ: {item1} vs {item2}")
                else:
                    print(f"⚠️  Items count differs: {len(items1)} vs {len(items2)}")
            else:
                print(f"❌ Second PUT returned {resp2.status_code}: {resp2.text}")
        else:
            print(f"❌ First PUT returned {resp1.status_code}: {resp1.text}")
    except Exception as e:
        print(f"❌ PUT exception: {e}")

def test_d_post_integration():
    """Test D: POST integration — sequence-driven generation"""
    print("\n" + "="*80)
    print("TEST D: POST /api/conferences/:id/merged-presentation integration")
    print("="*80)
    
    headers = {"Authorization": f"Bearer {tokens['admin']}"}
    
    # D1: POST with saved sequence
    print("\n--- D1: POST with saved sequence (usedSequence='saved') ---")
    # First ensure we have a saved sequence
    try:
        payload = {
            "items": [
                {"id": "test-1", "type": "break", "kind": "tea", "title": "Opening Remarks", "durationMin": 10}
            ]
        }
        put_resp = requests.put(
            f"{BASE_URL}/api/conferences/{FEATURED_CONF_ID}/presentation-sequence",
            json=payload,
            headers=headers,
            timeout=10
        )
        print(f"PUT sequence status: {put_resp.status_code}")
        
        if put_resp.status_code == 200:
            # Now POST to generate
            post_resp = requests.post(
                f"{BASE_URL}/api/conferences/{FEATURED_CONF_ID}/merged-presentation",
                headers=headers,
                timeout=30
            )
            print(f"POST merged-presentation status: {post_resp.status_code}")
            if post_resp.status_code == 200:
                data = post_resp.json()
                pres = data.get("presentation", {})
                print(f"✅ POST returned 200")
                print(f"   usedSequence: {pres.get('usedSequence')}")
                if pres.get('usedSequence') == 'saved':
                    print(f"✅ usedSequence is 'saved' as expected")
                else:
                    print(f"⚠️  usedSequence is '{pres.get('usedSequence')}', expected 'saved'")
                
                # Check slideIndex has type field
                slide_index = pres.get('slideIndex', [])
                if slide_index:
                    print(f"   slideIndex entries: {len(slide_index)}")
                    first_entry = slide_index[0]
                    if 'type' in first_entry:
                        print(f"✅ slideIndex entries have 'type' field: {first_entry.get('type')}")
                    else:
                        print(f"⚠️  slideIndex entries missing 'type' field")
            else:
                print(f"❌ POST returned {post_resp.status_code}: {post_resp.text}")
        else:
            print(f"❌ PUT returned {put_resp.status_code}: {put_resp.text}")
    except Exception as e:
        print(f"❌ POST exception: {e}")
    
    # D2: POST without saved sequence (auto-derived)
    print("\n--- D2: POST without saved sequence (usedSequence='auto') ---")
    backup_exists = backup_sequence_file()
    delete_sequence_file()
    try:
        post_resp = requests.post(
            f"{BASE_URL}/api/conferences/{FEATURED_CONF_ID}/merged-presentation",
            headers=headers,
            timeout=30
        )
        print(f"POST merged-presentation status: {post_resp.status_code}")
        if post_resp.status_code == 200:
            data = post_resp.json()
            pres = data.get("presentation", {})
            print(f"✅ POST returned 200")
            print(f"   usedSequence: {pres.get('usedSequence')}")
            if pres.get('usedSequence') == 'auto':
                print(f"✅ usedSequence is 'auto' as expected")
            else:
                print(f"⚠️  usedSequence is '{pres.get('usedSequence')}', expected 'auto'")
        else:
            print(f"❌ POST returned {post_resp.status_code}: {post_resp.text}")
    except Exception as e:
        print(f"❌ POST exception: {e}")
    finally:
        if backup_exists:
            restore_sequence_file()
    
    # D3: POST with only breaks (edge case)
    print("\n--- D3: POST with only breaks (source='saved') ---")
    try:
        # PUT a sequence with only breaks
        payload = {
            "items": [
                {"id": "test-1", "type": "break", "kind": "tea", "title": "Morning Tea", "durationMin": 15},
                {"id": "test-2", "type": "break", "kind": "lunch", "title": "Lunch Break", "durationMin": 60}
            ]
        }
        put_resp = requests.put(
            f"{BASE_URL}/api/conferences/{FEATURED_CONF_ID}/presentation-sequence",
            json=payload,
            headers=headers,
            timeout=10
        )
        print(f"PUT sequence (only breaks) status: {put_resp.status_code}")
        
        if put_resp.status_code == 200:
            # Now POST to generate
            post_resp = requests.post(
                f"{BASE_URL}/api/conferences/{FEATURED_CONF_ID}/merged-presentation",
                headers=headers,
                timeout=30
            )
            print(f"POST merged-presentation status: {post_resp.status_code}")
            if post_resp.status_code == 200:
                print(f"✅ POST returned 200 (sequence with only breaks is allowed when explicitly saved)")
                data = post_resp.json()
                pres = data.get("presentation", {})
                print(f"   usedSequence: {pres.get('usedSequence')}")
            elif post_resp.status_code == 400:
                print(f"⚠️  POST returned 400 (sequence with only breaks rejected): {post_resp.text}")
            else:
                print(f"❌ POST returned {post_resp.status_code}: {post_resp.text}")
        else:
            print(f"❌ PUT returned {put_resp.status_code}: {put_resp.text}")
    except Exception as e:
        print(f"❌ POST exception: {e}")
    finally:
        # Restore original sequence
        if backup_exists:
            restore_sequence_file()

def test_e_disk_artifacts():
    """Test E: Disk artifacts"""
    print("\n" + "="*80)
    print("TEST E: Disk artifacts")
    print("="*80)
    
    headers = {"Authorization": f"Bearer {tokens['admin']}"}
    
    # E1: Verify sequence.json exists after PUT
    print("\n--- E1: Verify sequence.json exists after PUT ---")
    try:
        payload = {
            "items": [
                {"id": "test-1", "type": "break", "kind": "tea", "title": "Test Break", "durationMin": 15}
            ]
        }
        resp = requests.put(
            f"{BASE_URL}/api/conferences/{FEATURED_CONF_ID}/presentation-sequence",
            json=payload,
            headers=headers,
            timeout=10
        )
        print(f"PUT status: {resp.status_code}")
        
        if resp.status_code == 200:
            seq_path = f"/app/uploads/merged/{FEATURED_CONF_ID}/sequence.json"
            if os.path.exists(seq_path):
                print(f"✅ sequence.json exists at {seq_path}")
                # Read and verify content
                with open(seq_path, 'r') as f:
                    content = json.load(f)
                    if 'items' in content and isinstance(content['items'], list):
                        print(f"✅ sequence.json contains 'items' array with {len(content['items'])} items")
                        if content['items'] and content['items'][0].get('type') == 'break':
                            print(f"✅ First item type matches payload")
                    else:
                        print(f"⚠️  sequence.json missing 'items' array")
            else:
                print(f"❌ sequence.json does not exist at {seq_path}")
        else:
            print(f"❌ PUT returned {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"❌ Test exception: {e}")

def main():
    """Main test runner"""
    print("="*80)
    print("PHASE 2B — PRESENTATION SEQUENCE EDITOR BACKEND TESTS")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Featured Conference ID: {FEATURED_CONF_ID}")
    print(f"Test started at: {datetime.now().isoformat()}")
    
    # Login all users
    print("\n" + "="*80)
    print("SETUP: Login all test users")
    print("="*80)
    for role in CREDENTIALS.keys():
        login(role)
    
    # Run tests
    test_a_get_sequence()
    test_b_put_rbac()
    test_c_put_validation()
    test_d_post_integration()
    test_e_disk_artifacts()
    
    print("\n" + "="*80)
    print("ALL TESTS COMPLETED")
    print("="*80)
    print(f"Test completed at: {datetime.now().isoformat()}")

if __name__ == "__main__":
    main()
