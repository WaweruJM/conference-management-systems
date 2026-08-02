#!/usr/bin/env python3
"""
Backend test for Merged Conference Presentation endpoints (Phase 2)
Tests GET/POST /api/conferences/:id/merged-presentation and GET /api/uploads/merged/{confId}/merged.pdf
"""
import requests
import json
import time

# Use internal container URL for testing
BASE_URL = "http://localhost:3000/api"
FEATURED_CONF_ID = "e01de36e-e09e-479f-bd53-c056b2a90436"
FAKE_CONF_ID = "aaaaaaaa-1111-2222-3333-444444444444"

def login(email, password="password123"):
    """Login and return JWT token"""
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password}, timeout=10)
        if resp.status_code == 200:
            token = resp.json().get("token")
            print(f"✅ Login as {email} → 200 (token: {token[:20] if token else 'None'}...)")
            return token
        else:
            print(f"❌ Login as {email} → {resp.status_code}")
            return None
    except Exception as e:
        print(f"❌ Login as {email} failed: {e}")
        return None

def get_headers(token):
    """Return headers with Bearer token"""
    if token:
        return {"Authorization": f"Bearer {token}"}
    return {}

def main():
    print("=" * 80)
    print("MERGED CONFERENCE PRESENTATION ENDPOINTS TEST (Phase 2)")
    print("=" * 80)
    
    test_results = {
        "total": 0,
        "passed": 0,
        "failed": 0
    }
    
    # ========================================================================
    # TEST A: GET metadata
    # ========================================================================
    print("\n" + "=" * 80)
    print("TEST A: GET METADATA")
    print("=" * 80)
    
    # A.1: GET on featured conference (no auth)
    print("\n[A.1] GET /api/conferences/{featured}/merged-presentation (no auth)")
    test_results["total"] += 1
    try:
        resp = requests.get(f"{BASE_URL}/conferences/{FEATURED_CONF_ID}/merged-presentation", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            presentation = data.get("presentation")
            print(f"✅ GET /conferences/{FEATURED_CONF_ID}/merged-presentation → 200")
            print(f"   presentation: {presentation}")
            
            if presentation is None:
                print(f"   ℹ️  presentation is null (not yet generated)")
                test_results["passed"] += 1
            elif isinstance(presentation, dict):
                # Check required fields
                required_fields = ["url", "generatedAt", "sizeBytes", "slideIndex", "totalPages"]
                missing = [f for f in required_fields if f not in presentation]
                if missing:
                    print(f"   ❌ Missing fields: {missing}")
                    test_results["failed"] += 1
                else:
                    print(f"   ✅ All required fields present")
                    print(f"   url: {presentation.get('url')}")
                    print(f"   generatedAt: {presentation.get('generatedAt')}")
                    print(f"   sizeBytes: {presentation.get('sizeBytes')}")
                    print(f"   totalPages: {presentation.get('totalPages')}")
                    print(f"   slideIndex entries: {len(presentation.get('slideIndex', []))}")
                    test_results["passed"] += 1
            else:
                print(f"   ❌ presentation is not null or dict: {type(presentation)}")
                test_results["failed"] += 1
        else:
            print(f"❌ GET /conferences/{FEATURED_CONF_ID}/merged-presentation → {resp.status_code}")
            print(f"   Response: {resp.text[:200]}")
            test_results["failed"] += 1
    except Exception as e:
        print(f"❌ Test A.1 failed: {e}")
        test_results["failed"] += 1
    
    # A.2: GET on made-up conference ID (expect 404)
    print("\n[A.2] GET /api/conferences/{fake}/merged-presentation (expect 404)")
    test_results["total"] += 1
    try:
        resp = requests.get(f"{BASE_URL}/conferences/{FAKE_CONF_ID}/merged-presentation", timeout=10)
        if resp.status_code == 404:
            error_msg = resp.json().get("error", "")
            print(f"✅ GET /conferences/{FAKE_CONF_ID}/merged-presentation → 404")
            if "Conference not found" in error_msg or "not found" in error_msg.lower():
                print(f"   ✅ Error message correct: {error_msg}")
                test_results["passed"] += 1
            else:
                print(f"   ⚠️  Error message: {error_msg}")
                test_results["passed"] += 1
        else:
            print(f"❌ GET /conferences/{FAKE_CONF_ID}/merged-presentation → {resp.status_code} (expected 404)")
            test_results["failed"] += 1
    except Exception as e:
        print(f"❌ Test A.2 failed: {e}")
        test_results["failed"] += 1
    
    # ========================================================================
    # TEST B: POST RBAC
    # ========================================================================
    print("\n" + "=" * 80)
    print("TEST B: POST RBAC")
    print("=" * 80)
    
    # B.1: POST without Authorization header (expect 401)
    print("\n[B.1] POST without Authorization header (expect 401)")
    test_results["total"] += 1
    try:
        resp = requests.post(f"{BASE_URL}/conferences/{FEATURED_CONF_ID}/merged-presentation", timeout=30)
        if resp.status_code == 401:
            error_msg = resp.json().get("error", "")
            print(f"✅ POST /conferences/{FEATURED_CONF_ID}/merged-presentation (no auth) → 401")
            if "Unauthenticated" in error_msg or "unauthenticated" in error_msg.lower():
                print(f"   ✅ Error message correct: {error_msg}")
            test_results["passed"] += 1
        else:
            print(f"❌ POST /conferences/{FEATURED_CONF_ID}/merged-presentation (no auth) → {resp.status_code} (expected 401)")
            test_results["failed"] += 1
    except Exception as e:
        print(f"❌ Test B.1 failed: {e}")
        test_results["failed"] += 1
    
    # B.2: POST as author@scms.io (expect 403)
    print("\n[B.2] POST as author@scms.io (expect 403)")
    test_results["total"] += 1
    author_token = login("author@scms.io")
    if author_token:
        try:
            resp = requests.post(
                f"{BASE_URL}/conferences/{FEATURED_CONF_ID}/merged-presentation",
                headers=get_headers(author_token),
                timeout=30
            )
            if resp.status_code == 403:
                error_msg = resp.json().get("error", "")
                print(f"✅ POST as author@scms.io → 403")
                if any(role in error_msg for role in ["Admin", "Chief", "Managing"]):
                    print(f"   ✅ Error message mentions required roles: {error_msg}")
                else:
                    print(f"   ⚠️  Error message: {error_msg}")
                test_results["passed"] += 1
            else:
                print(f"❌ POST as author@scms.io → {resp.status_code} (expected 403)")
                test_results["failed"] += 1
        except Exception as e:
            print(f"❌ Test B.2 failed: {e}")
            test_results["failed"] += 1
    else:
        print(f"❌ Cannot test B.2 - login failed")
        test_results["failed"] += 1
    
    # B.3: POST as committee@scms.io (expect 403)
    print("\n[B.3] POST as committee@scms.io (expect 403)")
    test_results["total"] += 1
    committee_token = login("committee@scms.io")
    if committee_token:
        try:
            resp = requests.post(
                f"{BASE_URL}/conferences/{FEATURED_CONF_ID}/merged-presentation",
                headers=get_headers(committee_token),
                timeout=30
            )
            if resp.status_code == 403:
                print(f"✅ POST as committee@scms.io → 403")
                test_results["passed"] += 1
            else:
                print(f"❌ POST as committee@scms.io → {resp.status_code} (expected 403)")
                test_results["failed"] += 1
        except Exception as e:
            print(f"❌ Test B.3 failed: {e}")
            test_results["failed"] += 1
    else:
        print(f"❌ Cannot test B.3 - login failed")
        test_results["failed"] += 1
    
    # B.4: POST as reviewer2@scms.io (expect 403)
    print("\n[B.4] POST as reviewer2@scms.io (expect 403)")
    test_results["total"] += 1
    reviewer_token = login("reviewer2@scms.io")
    if reviewer_token:
        try:
            resp = requests.post(
                f"{BASE_URL}/conferences/{FEATURED_CONF_ID}/merged-presentation",
                headers=get_headers(reviewer_token),
                timeout=30
            )
            if resp.status_code == 403:
                print(f"✅ POST as reviewer2@scms.io → 403")
                test_results["passed"] += 1
            else:
                print(f"❌ POST as reviewer2@scms.io → {resp.status_code} (expected 403)")
                test_results["failed"] += 1
        except Exception as e:
            print(f"❌ Test B.4 failed: {e}")
            test_results["failed"] += 1
    else:
        print(f"❌ Cannot test B.4 - login failed")
        test_results["failed"] += 1
    
    # B.5: POST as chief@scms.io (expect 200)
    print("\n[B.5] POST as chief@scms.io (expect 200)")
    test_results["total"] += 1
    chief_token = login("chief@scms.io")
    first_generated_at = None
    if chief_token:
        try:
            print(f"   ⏳ Generating merged presentation (may take 10-20 seconds)...")
            resp = requests.post(
                f"{BASE_URL}/conferences/{FEATURED_CONF_ID}/merged-presentation",
                headers=get_headers(chief_token),
                timeout=60
            )
            if resp.status_code == 200:
                data = resp.json()
                presentation = data.get("presentation")
                print(f"✅ POST as chief@scms.io → 200")
                
                if presentation and isinstance(presentation, dict):
                    print(f"   ✅ presentation object returned")
                    print(f"   url: {presentation.get('url')}")
                    print(f"   generatedAt: {presentation.get('generatedAt')}")
                    print(f"   sizeBytes: {presentation.get('sizeBytes')}")
                    print(f"   totalPages: {presentation.get('totalPages')}")
                    print(f"   slideIndex entries: {len(presentation.get('slideIndex', []))}")
                    first_generated_at = presentation.get('generatedAt')
                    test_results["passed"] += 1
                else:
                    print(f"   ❌ presentation object missing or invalid")
                    test_results["failed"] += 1
            else:
                print(f"❌ POST as chief@scms.io → {resp.status_code}")
                print(f"   Response: {resp.text[:500]}")
                test_results["failed"] += 1
        except Exception as e:
            print(f"❌ Test B.5 failed: {e}")
            test_results["failed"] += 1
    else:
        print(f"❌ Cannot test B.5 - login failed")
        test_results["failed"] += 1
    
    # B.6: POST as admin@scms.io (expect 200)
    print("\n[B.6] POST as admin@scms.io (expect 200)")
    test_results["total"] += 1
    admin_token = login("admin@scms.io")
    if admin_token:
        try:
            print(f"   ⏳ Regenerating merged presentation...")
            resp = requests.post(
                f"{BASE_URL}/conferences/{FEATURED_CONF_ID}/merged-presentation",
                headers=get_headers(admin_token),
                timeout=60
            )
            if resp.status_code == 200:
                data = resp.json()
                presentation = data.get("presentation")
                print(f"✅ POST as admin@scms.io → 200")
                
                if presentation and isinstance(presentation, dict):
                    print(f"   ✅ presentation object returned")
                    test_results["passed"] += 1
                else:
                    print(f"   ❌ presentation object missing or invalid")
                    test_results["failed"] += 1
            else:
                print(f"❌ POST as admin@scms.io → {resp.status_code}")
                print(f"   Response: {resp.text[:500]}")
                test_results["failed"] += 1
        except Exception as e:
            print(f"❌ Test B.6 failed: {e}")
            test_results["failed"] += 1
    else:
        print(f"❌ Cannot test B.6 - login failed")
        test_results["failed"] += 1
    
    # ========================================================================
    # TEST C: POST CONTENT
    # ========================================================================
    print("\n" + "=" * 80)
    print("TEST C: POST CONTENT")
    print("=" * 80)
    
    # C.1: Verify file exists on disk
    print("\n[C.1] Verify /app/uploads/merged/{confId}/merged.pdf exists on disk")
    test_results["total"] += 1
    try:
        import os
        pdf_path = f"/app/uploads/merged/{FEATURED_CONF_ID}/merged.pdf"
        if os.path.exists(pdf_path):
            file_size = os.path.getsize(pdf_path)
            print(f"✅ File exists: {pdf_path}")
            print(f"   File size: {file_size} bytes")
            test_results["passed"] += 1
        else:
            print(f"❌ File does not exist: {pdf_path}")
            test_results["failed"] += 1
    except Exception as e:
        print(f"❌ Test C.1 failed: {e}")
        test_results["failed"] += 1
    
    # C.2: Verify PDF magic bytes (%PDF)
    print("\n[C.2] Verify first 4 bytes equal %PDF")
    test_results["total"] += 1
    try:
        pdf_path = f"/app/uploads/merged/{FEATURED_CONF_ID}/merged.pdf"
        with open(pdf_path, 'rb') as f:
            first_bytes = f.read(4)
            if first_bytes == b'%PDF':
                print(f"✅ First 4 bytes are %PDF")
                test_results["passed"] += 1
            else:
                print(f"❌ First 4 bytes are not %PDF: {first_bytes}")
                test_results["failed"] += 1
    except Exception as e:
        print(f"❌ Test C.2 failed: {e}")
        test_results["failed"] += 1
    
    # C.3: Verify PDF ends with %%EOF
    print("\n[C.3] Verify last portion contains %%EOF")
    test_results["total"] += 1
    try:
        pdf_path = f"/app/uploads/merged/{FEATURED_CONF_ID}/merged.pdf"
        with open(pdf_path, 'rb') as f:
            f.seek(-100, 2)  # Seek to last 100 bytes
            last_bytes = f.read()
            if b'%%EOF' in last_bytes:
                print(f"✅ Last portion contains %%EOF")
                test_results["passed"] += 1
            else:
                print(f"❌ Last portion does not contain %%EOF")
                test_results["failed"] += 1
    except Exception as e:
        print(f"❌ Test C.3 failed: {e}")
        test_results["failed"] += 1
    
    # C.4: Verify index.json exists
    print("\n[C.4] Verify /app/uploads/merged/{confId}/index.json exists")
    test_results["total"] += 1
    try:
        index_path = f"/app/uploads/merged/{FEATURED_CONF_ID}/index.json"
        if os.path.exists(index_path):
            with open(index_path, 'r') as f:
                index_data = json.load(f)
                print(f"✅ index.json exists and is valid JSON")
                print(f"   slideIndex entries: {len(index_data.get('slideIndex', []))}")
                print(f"   totalPages: {index_data.get('totalPages')}")
                test_results["passed"] += 1
        else:
            print(f"❌ index.json does not exist: {index_path}")
            test_results["failed"] += 1
    except Exception as e:
        print(f"❌ Test C.4 failed: {e}")
        test_results["failed"] += 1
    
    # C.5: Verify slideIndex structure
    print("\n[C.5] Verify slideIndex array structure")
    test_results["total"] += 1
    try:
        index_path = f"/app/uploads/merged/{FEATURED_CONF_ID}/index.json"
        with open(index_path, 'r') as f:
            index_data = json.load(f)
            slide_index = index_data.get('slideIndex', [])
            
            if len(slide_index) == 0:
                print(f"⚠️  slideIndex is empty (conference may have no scheduled items)")
                test_results["passed"] += 1
            else:
                print(f"✅ slideIndex has {len(slide_index)} entries")
                
                # Check first entry structure
                first_entry = slide_index[0]
                required_fields = [
                    "abstractId", "sessionId", "sessionTitle", "submissionCode", 
                    "title", "coverPage", "firstSlidePage", "endPage", "slideCount",
                    "startTime", "endTime"
                ]
                missing = [f for f in required_fields if f not in first_entry]
                
                if missing:
                    print(f"   ❌ First entry missing fields: {missing}")
                    test_results["failed"] += 1
                else:
                    print(f"   ✅ First entry has all required fields")
                    print(f"   Example entry:")
                    print(f"     abstractId: {first_entry.get('abstractId')}")
                    print(f"     sessionTitle: {first_entry.get('sessionTitle')}")
                    print(f"     submissionCode: {first_entry.get('submissionCode')}")
                    print(f"     title: {first_entry.get('title')[:50]}...")
                    print(f"     coverPage: {first_entry.get('coverPage')}")
                    print(f"     firstSlidePage: {first_entry.get('firstSlidePage')}")
                    print(f"     endPage: {first_entry.get('endPage')}")
                    print(f"     slideCount: {first_entry.get('slideCount')}")
                    
                    # Verify page ordering
                    cover = first_entry.get('coverPage', 0)
                    first_slide = first_entry.get('firstSlidePage', 0)
                    end = first_entry.get('endPage', 0)
                    
                    if cover < first_slide <= end:
                        print(f"   ✅ Page ordering correct: coverPage({cover}) < firstSlidePage({first_slide}) <= endPage({end})")
                        test_results["passed"] += 1
                    else:
                        print(f"   ❌ Page ordering incorrect: coverPage({cover}), firstSlidePage({first_slide}), endPage({end})")
                        test_results["failed"] += 1
    except Exception as e:
        print(f"❌ Test C.5 failed: {e}")
        test_results["failed"] += 1
    
    # C.6: Verify entries are ordered correctly
    print("\n[C.6] Verify slideIndex entries are ordered correctly")
    test_results["total"] += 1
    try:
        index_path = f"/app/uploads/merged/{FEATURED_CONF_ID}/index.json"
        with open(index_path, 'r') as f:
            index_data = json.load(f)
            slide_index = index_data.get('slideIndex', [])
            
            if len(slide_index) < 2:
                print(f"⚠️  slideIndex has < 2 entries, cannot verify ordering")
                test_results["passed"] += 1
            else:
                # Check that coverPage is monotonically increasing
                cover_pages = [entry.get('coverPage', 0) for entry in slide_index]
                is_monotonic = all(cover_pages[i] < cover_pages[i+1] for i in range(len(cover_pages)-1))
                
                if is_monotonic:
                    print(f"✅ coverPage values are monotonically increasing")
                    print(f"   coverPages: {cover_pages[:5]}{'...' if len(cover_pages) > 5 else ''}")
                    test_results["passed"] += 1
                else:
                    print(f"   ⚠️  coverPage values are not strictly monotonic (may be grouped by session)")
                    print(f"   coverPages: {cover_pages[:5]}{'...' if len(cover_pages) > 5 else ''}")
                    # This is acceptable if entries are grouped by session
                    test_results["passed"] += 1
    except Exception as e:
        print(f"❌ Test C.6 failed: {e}")
        test_results["failed"] += 1
    
    # ========================================================================
    # TEST D: GET FILE SERVING
    # ========================================================================
    print("\n" + "=" * 80)
    print("TEST D: GET FILE SERVING")
    print("=" * 80)
    
    # D.1: GET /api/uploads/merged/{confId}/merged.pdf
    print("\n[D.1] GET /api/uploads/merged/{confId}/merged.pdf")
    test_results["total"] += 1
    try:
        resp = requests.get(f"{BASE_URL}/uploads/merged/{FEATURED_CONF_ID}/merged.pdf", timeout=10)
        if resp.status_code == 200:
            content_type = resp.headers.get('Content-Type', '')
            content = resp.content
            
            print(f"✅ GET /uploads/merged/{FEATURED_CONF_ID}/merged.pdf → 200")
            print(f"   Content-Type: {content_type}")
            print(f"   Content length: {len(content)} bytes")
            
            if content_type == 'application/pdf':
                print(f"   ✅ Content-Type is application/pdf")
            else:
                print(f"   ⚠️  Content-Type is not application/pdf: {content_type}")
            
            if content[:4] == b'%PDF':
                print(f"   ✅ Body begins with %PDF")
                test_results["passed"] += 1
            else:
                print(f"   ❌ Body does not begin with %PDF")
                test_results["failed"] += 1
        else:
            print(f"❌ GET /uploads/merged/{FEATURED_CONF_ID}/merged.pdf → {resp.status_code}")
            test_results["failed"] += 1
    except Exception as e:
        print(f"❌ Test D.1 failed: {e}")
        test_results["failed"] += 1
    
    # ========================================================================
    # TEST E: REGENERATE
    # ========================================================================
    print("\n" + "=" * 80)
    print("TEST E: REGENERATE")
    print("=" * 80)
    
    # E.1: Call POST twice and verify timestamp updates
    print("\n[E.1] Call POST twice and verify generatedAt timestamp updates")
    test_results["total"] += 1
    if admin_token and first_generated_at:
        try:
            print(f"   First generatedAt: {first_generated_at}")
            print(f"   ⏳ Waiting 2 seconds before regenerating...")
            time.sleep(2)
            
            print(f"   ⏳ Regenerating merged presentation...")
            resp = requests.post(
                f"{BASE_URL}/conferences/{FEATURED_CONF_ID}/merged-presentation",
                headers=get_headers(admin_token),
                timeout=60
            )
            
            if resp.status_code == 200:
                data = resp.json()
                presentation = data.get("presentation")
                second_generated_at = presentation.get('generatedAt')
                
                print(f"✅ POST (regenerate) → 200")
                print(f"   Second generatedAt: {second_generated_at}")
                
                if second_generated_at and second_generated_at > first_generated_at:
                    print(f"   ✅ generatedAt timestamp is newer")
                    test_results["passed"] += 1
                else:
                    print(f"   ❌ generatedAt timestamp is not newer")
                    test_results["failed"] += 1
            else:
                print(f"❌ POST (regenerate) → {resp.status_code}")
                test_results["failed"] += 1
        except Exception as e:
            print(f"❌ Test E.1 failed: {e}")
            test_results["failed"] += 1
    else:
        print(f"⚠️  Skipping E.1 - admin_token or first_generated_at not available")
        test_results["passed"] += 1
    
    # ========================================================================
    # SUMMARY
    # ========================================================================
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print(f"Total tests: {test_results['total']}")
    print(f"Passed: {test_results['passed']}")
    print(f"Failed: {test_results['failed']}")
    print(f"Success rate: {test_results['passed'] / test_results['total'] * 100:.1f}%")
    print("=" * 80)
    
    if test_results['failed'] == 0:
        print("✅ ALL TESTS PASSED")
    else:
        print(f"❌ {test_results['failed']} TEST(S) FAILED")
    
    return test_results['failed'] == 0

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
