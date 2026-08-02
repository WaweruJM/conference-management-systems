#!/usr/bin/env python3
"""
Backend test for Presentation Package endpoints (Phase 1)
Tests POST/DELETE /api/abstracts/:id/presentation, POST/DELETE /api/abstracts/:id/author-photo, PUT /api/abstracts/:id/biography
"""
import requests
import json
import io
import os

BASE_URL = "https://scms-platform-1.preview.emergentagent.com/api"

def login(email, password="password123"):
    """Login and return JWT token"""
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password}, timeout=10)
        if resp.status_code == 200:
            token = resp.json().get("token")
            print(f"✅ Login as {email} → 200 (token: {token[:20]}...)")
            return token
        else:
            print(f"❌ Login as {email} → {resp.status_code}")
            return None
    except Exception as e:
        print(f"❌ Login as {email} failed: {e}")
        return None

def get_headers(token):
    """Return headers with Bearer token"""
    return {"Authorization": f"Bearer {token}"}

def create_fake_file(size_kb, extension="pptx"):
    """Create a fake file buffer of specified size"""
    content = b"X" * (size_kb * 1024)
    return io.BytesIO(content), f"test_file.{extension}"

def create_fake_image(size_kb, extension="png"):
    """Create a fake image buffer"""
    # Create a minimal PNG header to pass image type check
    if extension == "png":
        # Minimal PNG signature + IHDR chunk
        png_header = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde'
        content = png_header + (b"X" * (size_kb * 1024 - len(png_header)))
    else:
        content = b"X" * (size_kb * 1024)
    return io.BytesIO(content), f"test_photo.{extension}"

def main():
    print("=" * 80)
    print("PRESENTATION PACKAGE ENDPOINTS TEST (Phase 1)")
    print("=" * 80)
    
    # Step 1: Login as admin and find an ACCEPTED abstract owned by author@scms.io
    print("\n[STEP 1] Login as admin and find ACCEPTED abstract")
    admin_token = login("admin@scms.io")
    if not admin_token:
        print("❌ CRITICAL: Cannot login as admin")
        return
    
    # Get abstracts
    try:
        resp = requests.get(f"{BASE_URL}/abstracts", headers=get_headers(admin_token), timeout=10)
        if resp.status_code != 200:
            print(f"❌ GET /abstracts → {resp.status_code}")
            return
        abstracts = resp.json().get("abstracts", [])
        print(f"✅ GET /abstracts → 200 ({len(abstracts)} abstracts)")
        
        # Find an ACCEPTED abstract owned by author@scms.io
        accepted_abs = None
        author_email = "author@scms.io"
        for abs_item in abstracts:
            if abs_item.get("currentState") == "ACCEPTED" and abs_item.get("submittedBy", {}).get("email") == author_email:
                accepted_abs = abs_item
                break
        
        if not accepted_abs:
            # Try to find any abstract owned by author@scms.io and transition it
            print(f"⚠️  No ACCEPTED abstract found for {author_email}, looking for any abstract to transition...")
            author_abs = None
            for abs_item in abstracts:
                if abs_item.get("submittedBy", {}).get("email") == author_email:
                    author_abs = abs_item
                    break
            
            if not author_abs:
                print(f"❌ No abstract found for {author_email}")
                return
            
            # Transition to ACCEPTED
            abs_id = author_abs["id"]
            print(f"📝 Transitioning abstract {author_abs['submissionCode']} to ACCEPTED...")
            transition_resp = requests.post(
                f"{BASE_URL}/abstracts/{abs_id}/transition",
                headers=get_headers(admin_token),
                json={"newState": "ACCEPTED", "comment": "Test transition for presentation package testing"},
                timeout=10
            )
            if transition_resp.status_code == 200:
                print(f"✅ POST /abstracts/{abs_id}/transition → 200 (transitioned to ACCEPTED)")
                accepted_abs = transition_resp.json().get("abstract", author_abs)
                accepted_abs["id"] = abs_id
            else:
                print(f"❌ POST /abstracts/{abs_id}/transition → {transition_resp.status_code}")
                print(f"   Response: {transition_resp.text[:200]}")
                return
        
        abs_id = accepted_abs["id"]
        print(f"✅ Found ACCEPTED abstract: {accepted_abs['submissionCode']} (ID: {abs_id})")
        
    except Exception as e:
        print(f"❌ Error finding abstract: {e}")
        return
    
    # Step 2: Login as author@scms.io (owner)
    print("\n[STEP 2] Login as author@scms.io (owner)")
    author_token = login("author@scms.io")
    if not author_token:
        print("❌ CRITICAL: Cannot login as author@scms.io")
        return
    
    # Step 3: Happy path - Upload presentation (small .pptx)
    print("\n[STEP 3] Happy path - Upload presentation (~200 KB .pptx)")
    try:
        file_buf, filename = create_fake_file(200, "pptx")
        files = {"file": (filename, file_buf, "application/vnd.openxmlformats-officedocument.presentationml.presentation")}
        resp = requests.post(
            f"{BASE_URL}/abstracts/{abs_id}/presentation",
            headers=get_headers(author_token),
            files=files,
            timeout=15
        )
        if resp.status_code == 200:
            data = resp.json()
            pres_path = data.get("abstract", {}).get("presentationPath")
            print(f"✅ POST /abstracts/{abs_id}/presentation → 200")
            print(f"   presentationPath: {pres_path}")
            if pres_path and pres_path.startswith("/api/uploads/presentations/"):
                print(f"   ✅ Path format correct")
            else:
                print(f"   ❌ Path format incorrect: {pres_path}")
        else:
            print(f"❌ POST /abstracts/{abs_id}/presentation → {resp.status_code}")
            print(f"   Response: {resp.text[:200]}")
    except Exception as e:
        print(f"❌ Upload presentation failed: {e}")
    
    # Step 4: Size limit - Upload 55 MB file (expect 400)
    print("\n[STEP 4] Size limit - Upload 55 MB file (expect 400)")
    try:
        file_buf, filename = create_fake_file(55 * 1024, "pptx")  # 55 MB
        files = {"file": (filename, file_buf, "application/vnd.openxmlformats-officedocument.presentationml.presentation")}
        resp = requests.post(
            f"{BASE_URL}/abstracts/{abs_id}/presentation",
            headers=get_headers(author_token),
            files=files,
            timeout=20
        )
        if resp.status_code == 400:
            print(f"✅ POST /abstracts/{abs_id}/presentation (55 MB) → 400 (correctly rejected)")
            print(f"   Error: {resp.json().get('error', 'N/A')}")
        else:
            print(f"❌ POST /abstracts/{abs_id}/presentation (55 MB) → {resp.status_code} (expected 400)")
    except Exception as e:
        print(f"❌ Size limit test failed: {e}")
    
    # Step 5: Type restriction - Upload .txt file (expect 400)
    print("\n[STEP 5] Type restriction - Upload .txt file (expect 400)")
    try:
        file_buf, filename = create_fake_file(10, "txt")
        files = {"file": (filename, file_buf, "text/plain")}
        resp = requests.post(
            f"{BASE_URL}/abstracts/{abs_id}/presentation",
            headers=get_headers(author_token),
            files=files,
            timeout=15
        )
        if resp.status_code == 400:
            print(f"✅ POST /abstracts/{abs_id}/presentation (.txt) → 400 (correctly rejected)")
            print(f"   Error: {resp.json().get('error', 'N/A')}")
        else:
            print(f"❌ POST /abstracts/{abs_id}/presentation (.txt) → {resp.status_code} (expected 400)")
    except Exception as e:
        print(f"❌ Type restriction test failed: {e}")
    
    # Step 6: DELETE presentation
    print("\n[STEP 6] DELETE presentation")
    try:
        resp = requests.delete(
            f"{BASE_URL}/abstracts/{abs_id}/presentation",
            headers=get_headers(author_token),
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            pres_path = data.get("abstract", {}).get("presentationPath")
            print(f"✅ DELETE /abstracts/{abs_id}/presentation → 200")
            if pres_path is None:
                print(f"   ✅ presentationPath is null")
            else:
                print(f"   ❌ presentationPath not null: {pres_path}")
        else:
            print(f"❌ DELETE /abstracts/{abs_id}/presentation → {resp.status_code}")
    except Exception as e:
        print(f"❌ DELETE presentation failed: {e}")
    
    # Step 7: Author photo happy path - Upload small PNG
    print("\n[STEP 7] Author photo happy path - Upload ~50 KB PNG")
    try:
        file_buf, filename = create_fake_image(50, "png")
        files = {"file": (filename, file_buf, "image/png")}
        resp = requests.post(
            f"{BASE_URL}/abstracts/{abs_id}/author-photo",
            headers=get_headers(author_token),
            files=files,
            timeout=15
        )
        if resp.status_code == 200:
            data = resp.json()
            photo_path = data.get("abstract", {}).get("authorPhotoPath")
            print(f"✅ POST /abstracts/{abs_id}/author-photo → 200")
            print(f"   authorPhotoPath: {photo_path}")
            if photo_path and photo_path.startswith("/api/uploads/photos/"):
                print(f"   ✅ Path format correct")
            else:
                print(f"   ❌ Path format incorrect: {photo_path}")
        else:
            print(f"❌ POST /abstracts/{abs_id}/author-photo → {resp.status_code}")
            print(f"   Response: {resp.text[:200]}")
    except Exception as e:
        print(f"❌ Upload author photo failed: {e}")
    
    # Step 8: Photo size limit - Upload 3 MB image (expect 400)
    print("\n[STEP 8] Photo size limit - Upload 3 MB image (expect 400)")
    try:
        file_buf, filename = create_fake_image(3 * 1024, "png")  # 3 MB
        files = {"file": (filename, file_buf, "image/png")}
        resp = requests.post(
            f"{BASE_URL}/abstracts/{abs_id}/author-photo",
            headers=get_headers(author_token),
            files=files,
            timeout=15
        )
        if resp.status_code == 400:
            print(f"✅ POST /abstracts/{abs_id}/author-photo (3 MB) → 400 (correctly rejected)")
            print(f"   Error: {resp.json().get('error', 'N/A')}")
        else:
            print(f"❌ POST /abstracts/{abs_id}/author-photo (3 MB) → {resp.status_code} (expected 400)")
    except Exception as e:
        print(f"❌ Photo size limit test failed: {e}")
    
    # Step 9: Photo type check - Upload .pdf (expect 400)
    print("\n[STEP 9] Photo type check - Upload .pdf (expect 400)")
    try:
        file_buf, filename = create_fake_file(50, "pdf")
        files = {"file": (filename, file_buf, "application/pdf")}
        resp = requests.post(
            f"{BASE_URL}/abstracts/{abs_id}/author-photo",
            headers=get_headers(author_token),
            files=files,
            timeout=15
        )
        if resp.status_code == 400:
            print(f"✅ POST /abstracts/{abs_id}/author-photo (.pdf) → 400 (correctly rejected)")
            print(f"   Error: {resp.json().get('error', 'N/A')}")
        else:
            print(f"❌ POST /abstracts/{abs_id}/author-photo (.pdf) → {resp.status_code} (expected 400)")
    except Exception as e:
        print(f"❌ Photo type check test failed: {e}")
    
    # Step 10: DELETE photo
    print("\n[STEP 10] DELETE author photo")
    try:
        resp = requests.delete(
            f"{BASE_URL}/abstracts/{abs_id}/author-photo",
            headers=get_headers(author_token),
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            photo_path = data.get("abstract", {}).get("authorPhotoPath")
            print(f"✅ DELETE /abstracts/{abs_id}/author-photo → 200")
            if photo_path is None:
                print(f"   ✅ authorPhotoPath is null")
            else:
                print(f"   ❌ authorPhotoPath not null: {photo_path}")
        else:
            print(f"❌ DELETE /abstracts/{abs_id}/author-photo → {resp.status_code}")
    except Exception as e:
        print(f"❌ DELETE photo failed: {e}")
    
    # Step 11: Biography - PUT with normal text
    print("\n[STEP 11] Biography - PUT with normal text")
    try:
        bio_text = "Dr Test Author is a Cardiologist with 15 years of experience in interventional cardiology."
        resp = requests.put(
            f"{BASE_URL}/abstracts/{abs_id}/biography",
            headers=get_headers(author_token),
            json={"biography": bio_text},
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            bio = data.get("abstract", {}).get("biography")
            print(f"✅ PUT /abstracts/{abs_id}/biography → 200")
            if bio == bio_text:
                print(f"   ✅ Biography matches: {bio[:50]}...")
            else:
                print(f"   ❌ Biography mismatch. Expected: {bio_text[:50]}..., Got: {bio[:50] if bio else 'None'}...")
        else:
            print(f"❌ PUT /abstracts/{abs_id}/biography → {resp.status_code}")
            print(f"   Response: {resp.text[:200]}")
    except Exception as e:
        print(f"❌ Biography PUT failed: {e}")
    
    # Step 12: Biography truncation - PUT with 5000 chars (expect truncation to 4000)
    print("\n[STEP 12] Biography truncation - PUT with 5000 chars (expect truncation to 4000)")
    try:
        long_bio = "A" * 5000
        resp = requests.put(
            f"{BASE_URL}/abstracts/{abs_id}/biography",
            headers=get_headers(author_token),
            json={"biography": long_bio},
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            bio = data.get("abstract", {}).get("biography")
            print(f"✅ PUT /abstracts/{abs_id}/biography (5000 chars) → 200")
            if bio and len(bio) == 4000:
                print(f"   ✅ Biography truncated to 4000 chars (got {len(bio)})")
            else:
                print(f"   ❌ Biography length incorrect. Expected: 4000, Got: {len(bio) if bio else 0}")
        else:
            print(f"❌ PUT /abstracts/{abs_id}/biography (5000 chars) → {resp.status_code}")
    except Exception as e:
        print(f"❌ Biography truncation test failed: {e}")
    
    # Step 13: RBAC - author2@scms.io (NOT owner) attempts POST presentation (expect 403)
    print("\n[STEP 13] RBAC - author2@scms.io (NOT owner) attempts POST presentation (expect 403)")
    # First check if author2@scms.io exists, if not create it
    author2_token = login("author2@scms.io")
    if not author2_token:
        print("⚠️  author2@scms.io doesn't exist, creating...")
        try:
            register_resp = requests.post(
                f"{BASE_URL}/auth/register",
                json={
                    "email": "author2@scms.io",
                    "password": "password123",
                    "firstName": "Author",
                    "lastName": "Two",
                    "role": "AUTHOR"
                },
                timeout=10
            )
            if register_resp.status_code == 200:
                author2_token = register_resp.json().get("token")
                print(f"✅ Created author2@scms.io")
            else:
                print(f"❌ Failed to create author2@scms.io: {register_resp.status_code}")
                author2_token = None
        except Exception as e:
            print(f"❌ Error creating author2@scms.io: {e}")
            author2_token = None
    
    if author2_token:
        try:
            file_buf, filename = create_fake_file(100, "pptx")
            files = {"file": (filename, file_buf, "application/vnd.openxmlformats-officedocument.presentationml.presentation")}
            resp = requests.post(
                f"{BASE_URL}/abstracts/{abs_id}/presentation",
                headers=get_headers(author2_token),
                files=files,
                timeout=15
            )
            if resp.status_code == 403:
                print(f"✅ POST /abstracts/{abs_id}/presentation as author2 → 403 (correctly denied)")
            else:
                print(f"❌ POST /abstracts/{abs_id}/presentation as author2 → {resp.status_code} (expected 403)")
        except Exception as e:
            print(f"❌ RBAC test (author2 presentation) failed: {e}")
        
        # Also test photo and biography
        try:
            file_buf, filename = create_fake_image(50, "png")
            files = {"file": (filename, file_buf, "image/png")}
            resp = requests.post(
                f"{BASE_URL}/abstracts/{abs_id}/author-photo",
                headers=get_headers(author2_token),
                files=files,
                timeout=15
            )
            if resp.status_code == 403:
                print(f"✅ POST /abstracts/{abs_id}/author-photo as author2 → 403 (correctly denied)")
            else:
                print(f"❌ POST /abstracts/{abs_id}/author-photo as author2 → {resp.status_code} (expected 403)")
        except Exception as e:
            print(f"❌ RBAC test (author2 photo) failed: {e}")
        
        try:
            resp = requests.put(
                f"{BASE_URL}/abstracts/{abs_id}/biography",
                headers=get_headers(author2_token),
                json={"biography": "Unauthorized bio"},
                timeout=10
            )
            if resp.status_code == 403:
                print(f"✅ PUT /abstracts/{abs_id}/biography as author2 → 403 (correctly denied)")
            else:
                print(f"❌ PUT /abstracts/{abs_id}/biography as author2 → {resp.status_code} (expected 403)")
        except Exception as e:
            print(f"❌ RBAC test (author2 biography) failed: {e}")
    
    # Step 14: Editor override - chief@scms.io can POST presentation
    print("\n[STEP 14] Editor override - chief@scms.io can POST presentation")
    chief_token = login("chief@scms.io")
    if chief_token:
        try:
            file_buf, filename = create_fake_file(150, "pdf")
            files = {"file": (filename, file_buf, "application/pdf")}
            resp = requests.post(
                f"{BASE_URL}/abstracts/{abs_id}/presentation",
                headers=get_headers(chief_token),
                files=files,
                timeout=15
            )
            if resp.status_code == 200:
                data = resp.json()
                pres_path = data.get("abstract", {}).get("presentationPath")
                print(f"✅ POST /abstracts/{abs_id}/presentation as chief → 200 (editor can replace)")
                print(f"   presentationPath: {pres_path}")
            else:
                print(f"❌ POST /abstracts/{abs_id}/presentation as chief → {resp.status_code}")
        except Exception as e:
            print(f"❌ Editor override test failed: {e}")
    
    # Step 15: Committee editor 403 - committee@scms.io (COMMITTEE_MEMBER) attempts POST
    print("\n[STEP 15] Committee editor 403 - committee@scms.io attempts POST (expect 403)")
    committee_token = login("committee@scms.io")
    if committee_token:
        try:
            file_buf, filename = create_fake_file(100, "pptx")
            files = {"file": (filename, file_buf, "application/vnd.openxmlformats-officedocument.presentationml.presentation")}
            resp = requests.post(
                f"{BASE_URL}/abstracts/{abs_id}/presentation",
                headers=get_headers(committee_token),
                files=files,
                timeout=15
            )
            if resp.status_code == 403:
                print(f"✅ POST /abstracts/{abs_id}/presentation as committee → 403 (correctly denied)")
            else:
                print(f"❌ POST /abstracts/{abs_id}/presentation as committee → {resp.status_code} (expected 403)")
        except Exception as e:
            print(f"❌ Committee RBAC test failed: {e}")
        
        # Test photo
        try:
            file_buf, filename = create_fake_image(50, "png")
            files = {"file": (filename, file_buf, "image/png")}
            resp = requests.post(
                f"{BASE_URL}/abstracts/{abs_id}/author-photo",
                headers=get_headers(committee_token),
                files=files,
                timeout=15
            )
            if resp.status_code == 403:
                print(f"✅ POST /abstracts/{abs_id}/author-photo as committee → 403 (correctly denied)")
            else:
                print(f"❌ POST /abstracts/{abs_id}/author-photo as committee → {resp.status_code} (expected 403)")
        except Exception as e:
            print(f"❌ Committee photo RBAC test failed: {e}")
        
        # Test biography
        try:
            resp = requests.put(
                f"{BASE_URL}/abstracts/{abs_id}/biography",
                headers=get_headers(committee_token),
                json={"biography": "Unauthorized bio"},
                timeout=10
            )
            if resp.status_code == 403:
                print(f"✅ PUT /abstracts/{abs_id}/biography as committee → 403 (correctly denied)")
            else:
                print(f"❌ PUT /abstracts/{abs_id}/biography as committee → {resp.status_code} (expected 403)")
        except Exception as e:
            print(f"❌ Committee biography RBAC test failed: {e}")
    
    # Step 16: Reviewer 403 - reviewer1@scms.io attempts POST
    print("\n[STEP 16] Reviewer 403 - reviewer1@scms.io attempts POST (expect 403)")
    reviewer_token = login("reviewer1@scms.io")
    if reviewer_token:
        try:
            file_buf, filename = create_fake_file(100, "pptx")
            files = {"file": (filename, file_buf, "application/vnd.openxmlformats-officedocument.presentationml.presentation")}
            resp = requests.post(
                f"{BASE_URL}/abstracts/{abs_id}/presentation",
                headers=get_headers(reviewer_token),
                files=files,
                timeout=15
            )
            if resp.status_code == 403:
                print(f"✅ POST /abstracts/{abs_id}/presentation as reviewer → 403 (correctly denied)")
            else:
                print(f"❌ POST /abstracts/{abs_id}/presentation as reviewer → {resp.status_code} (expected 403)")
        except Exception as e:
            print(f"❌ Reviewer RBAC test failed: {e}")
    
    # Step 17: Regression - GET /api/abstracts/:id should return the new fields
    print("\n[STEP 17] Regression - GET /api/abstracts/:id returns new fields")
    try:
        resp = requests.get(
            f"{BASE_URL}/abstracts/{abs_id}",
            headers=get_headers(admin_token),
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            abstract = data.get("abstract", {})
            print(f"✅ GET /abstracts/{abs_id} → 200")
            
            # Check for new fields
            has_pres = "presentationPath" in abstract
            has_photo = "authorPhotoPath" in abstract
            has_bio = "biography" in abstract
            
            if has_pres and has_photo and has_bio:
                print(f"   ✅ All new fields present (presentationPath, authorPhotoPath, biography)")
                print(f"   presentationPath: {abstract.get('presentationPath', 'N/A')}")
                print(f"   authorPhotoPath: {abstract.get('authorPhotoPath', 'N/A')}")
                print(f"   biography: {abstract.get('biography', 'N/A')[:50] if abstract.get('biography') else 'N/A'}...")
            else:
                print(f"   ❌ Missing fields: presentationPath={has_pres}, authorPhotoPath={has_photo}, biography={has_bio}")
        else:
            print(f"❌ GET /abstracts/{abs_id} → {resp.status_code}")
    except Exception as e:
        print(f"❌ Regression test failed: {e}")
    
    print("\n" + "=" * 80)
    print("TEST COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    main()
