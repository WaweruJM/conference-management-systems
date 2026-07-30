#!/usr/bin/env python3
"""
Backend test for header logo endpoints:
- POST /api/conferences/:id/header-logo (multipart file + side='left'|'right')
- DELETE /api/conferences/:id/header-logo with JSON body {side:'left'|'right'}
"""

import requests
import json
import sys
import io
import struct

BASE_URL = "https://scms-platform-1.preview.emergentagent.com/api"

def login(email, password):
    """Login and return JWT token"""
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
        if resp.status_code == 200:
            data = resp.json()
            token = data.get("token")
            print(f"✅ Login successful for {email}")
            return token
        else:
            print(f"❌ Login failed for {email}: {resp.status_code} - {resp.text}")
            return None
    except Exception as e:
        print(f"❌ Login exception for {email}: {str(e)}")
        return None

def get_featured_conference():
    """Get featured conference ID and full conference object"""
    try:
        resp = requests.get(f"{BASE_URL}/public/config")
        if resp.status_code == 200:
            data = resp.json()
            conf = data.get("conference")
            if conf:
                conf_id = conf.get("id")
                print(f"✅ Featured conference ID: {conf_id}")
                print(f"   Conference name: {conf.get('name')}")
                return conf_id, conf
            else:
                print(f"❌ No conference object in response")
                return None, None
        else:
            print(f"❌ Failed to get featured conference: {resp.status_code}")
            return None, None
    except Exception as e:
        print(f"❌ Exception getting featured conference: {str(e)}")
        return None, None

def create_test_image(size_kb):
    """Create a minimal valid PNG image of approximately the specified size in KB"""
    import zlib
    
    # PNG signature
    png_signature = b'\x89PNG\r\n\x1a\n'
    
    # Determine dimensions based on target size
    if size_kb <= 30:
        width, height = 100, 100
    elif size_kb <= 100:
        width, height = 200, 200
    elif size_kb <= 500:
        width, height = 400, 400
    else:
        # For large files (>2MB), create a simple large file
        # We'll just pad with extra data to reach the size
        width, height = 500, 500
    
    # IHDR chunk (image header)
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    ihdr_chunk = b'IHDR' + ihdr_data
    ihdr_crc = struct.pack('>I', 0x00000000)  # Simplified CRC
    ihdr = struct.pack('>I', len(ihdr_data)) + ihdr_chunk + ihdr_crc
    
    # IDAT chunk (image data)
    # For small files, simple pattern
    idat_data = b''
    for _ in range(height):
        idat_data += b'\x00' + (b'\x00' * (width * 3))
    
    compressed_data = zlib.compress(idat_data, 9)
    
    # For large files, pad the compressed data
    if size_kb > 2000:
        target_size = size_kb * 1024
        padding_needed = target_size - len(png_signature) - len(ihdr) - len(compressed_data) - 100
        if padding_needed > 0:
            # Add padding as repeated pattern (won't compress well)
            compressed_data += b'\x00\xFF' * (padding_needed // 2)
    
    idat_chunk = b'IDAT' + compressed_data
    idat_crc = struct.pack('>I', 0x00000000)  # Simplified CRC
    idat = struct.pack('>I', len(compressed_data)) + idat_chunk + idat_crc
    
    # IEND chunk (end of image)
    iend = struct.pack('>I', 0) + b'IEND' + struct.pack('>I', 0xAE426082)
    
    # Combine all chunks
    png_data = png_signature + ihdr + idat + iend
    
    buf = io.BytesIO(png_data)
    buf.seek(0)
    
    actual_size = len(png_data)
    print(f"   Created test image: {width}x{height}, size: {actual_size / 1024:.1f} KB")
    
    return buf

def test_header_logo_endpoints():
    """Test all header logo endpoint scenarios"""
    print("\n" + "="*80)
    print("HEADER LOGO ENDPOINTS TEST")
    print("="*80)
    
    # Step 1: Login as admin and get featured conference
    print("\n--- Step 1: Login as admin@scms.io and get featured conference ---")
    token_admin = login("admin@scms.io", "password123")
    if not token_admin:
        print("❌ Cannot proceed without admin token")
        return False
    
    conf_id, conf = get_featured_conference()
    if not conf_id:
        print("❌ Cannot proceed without featured conference ID")
        return False
    
    all_passed = True
    
    # Step 2: Baseline read - verify headerLogoLeft and headerLogoRight fields exist
    print("\n--- Step 2: Baseline read - GET /api/public/config ---")
    try:
        resp = requests.get(f"{BASE_URL}/public/config")
        if resp.status_code == 200:
            data = resp.json()
            conf = data.get("conference", {})
            has_left = "headerLogoLeft" in conf
            has_right = "headerLogoRight" in conf
            if has_left and has_right:
                print(f"✅ Step 2 PASSED: Conference object contains headerLogoLeft and headerLogoRight fields")
                print(f"   headerLogoLeft: {conf.get('headerLogoLeft')}")
                print(f"   headerLogoRight: {conf.get('headerLogoRight')}")
            else:
                print(f"❌ Step 2 FAILED: Missing fields - headerLogoLeft: {has_left}, headerLogoRight: {has_right}")
                all_passed = False
        else:
            print(f"❌ Step 2 FAILED: GET /public/config returned {resp.status_code}")
            all_passed = False
    except Exception as e:
        print(f"❌ Step 2 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Step 3: Upload LEFT logo
    print("\n--- Step 3: Upload LEFT logo ---")
    try:
        headers = {"Authorization": f"Bearer {token_admin}"}
        img_buf = create_test_image(20)  # ~20 KB image
        files = {'file': ('test_left.png', img_buf, 'image/png')}
        data = {'side': 'left'}
        resp = requests.post(f"{BASE_URL}/conferences/{conf_id}/header-logo", 
                           headers=headers, files=files, data=data)
        if resp.status_code == 200:
            result = resp.json()
            if 'conference' in result and 'imagePath' in result and result.get('side') == 'left':
                image_path = result.get('imagePath')
                print(f"✅ Step 3 PASSED: POST /header-logo with side='left' returned 200")
                print(f"   imagePath: {image_path}")
                print(f"   side: {result.get('side')}")
                
                # Verify imagePath format
                if image_path and '/api/uploads/header/' in image_path and '/header_left_' in image_path:
                    print(f"✅ Step 3: imagePath format is correct")
                else:
                    print(f"⚠️  Step 3: imagePath format unexpected: {image_path}")
                
                # Verify GET /public/config reflects the change
                resp2 = requests.get(f"{BASE_URL}/public/config")
                if resp2.status_code == 200:
                    conf2 = resp2.json().get("conference", {})
                    if conf2.get('headerLogoLeft') == image_path:
                        print(f"✅ Step 3: GET /public/config confirms headerLogoLeft = {image_path}")
                    else:
                        print(f"❌ Step 3: GET /public/config shows headerLogoLeft = {conf2.get('headerLogoLeft')} (expected {image_path})")
                        all_passed = False
            else:
                print(f"❌ Step 3 FAILED: Response missing required fields: {result}")
                all_passed = False
        else:
            print(f"❌ Step 3 FAILED: POST /header-logo returned {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Step 3 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Step 4: Upload RIGHT logo
    print("\n--- Step 4: Upload RIGHT logo ---")
    try:
        headers = {"Authorization": f"Bearer {token_admin}"}
        img_buf = create_test_image(25)  # ~25 KB image
        files = {'file': ('test_right.png', img_buf, 'image/png')}
        data = {'side': 'right'}
        resp = requests.post(f"{BASE_URL}/conferences/{conf_id}/header-logo", 
                           headers=headers, files=files, data=data)
        if resp.status_code == 200:
            result = resp.json()
            if 'conference' in result and 'imagePath' in result and result.get('side') == 'right':
                image_path = result.get('imagePath')
                print(f"✅ Step 4 PASSED: POST /header-logo with side='right' returned 200")
                print(f"   imagePath: {image_path}")
                print(f"   side: {result.get('side')}")
                
                # Verify imagePath format
                if image_path and '/api/uploads/header/' in image_path and '/header_right_' in image_path:
                    print(f"✅ Step 4: imagePath format is correct")
                else:
                    print(f"⚠️  Step 4: imagePath format unexpected: {image_path}")
                
                # Verify GET /public/config reflects the change
                resp2 = requests.get(f"{BASE_URL}/public/config")
                if resp2.status_code == 200:
                    conf2 = resp2.json().get("conference", {})
                    if conf2.get('headerLogoRight') == image_path:
                        print(f"✅ Step 4: GET /public/config confirms headerLogoRight = {image_path}")
                    else:
                        print(f"❌ Step 4: GET /public/config shows headerLogoRight = {conf2.get('headerLogoRight')} (expected {image_path})")
                        all_passed = False
            else:
                print(f"❌ Step 4 FAILED: Response missing required fields: {result}")
                all_passed = False
        else:
            print(f"❌ Step 4 FAILED: POST /header-logo returned {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Step 4 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Step 5: Reject oversize file (>2 MB)
    print("\n--- Step 5: Reject oversize file (>2 MB) ---")
    try:
        headers = {"Authorization": f"Bearer {token_admin}"}
        img_buf = create_test_image(3000)  # ~3 MB image
        files = {'file': ('test_large.png', img_buf, 'image/png')}
        data = {'side': 'left'}
        resp = requests.post(f"{BASE_URL}/conferences/{conf_id}/header-logo", 
                           headers=headers, files=files, data=data)
        if resp.status_code == 400:
            error_msg = resp.json().get('error', '') if resp.headers.get('content-type', '').startswith('application/json') else resp.text
            if 'too large' in error_msg.lower() or '2 mb' in error_msg.lower() or '2mb' in error_msg.lower():
                print(f"✅ Step 5 PASSED: POST with >2MB file returned 400 with appropriate error")
                print(f"   Error message: {error_msg}")
            else:
                print(f"⚠️  Step 5: Returned 400 but error message unclear: {error_msg}")
        else:
            print(f"❌ Step 5 FAILED: POST with >2MB file returned {resp.status_code} (expected 400): {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Step 5 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Step 6: Reject invalid side
    print("\n--- Step 6: Reject invalid side='center' ---")
    try:
        headers = {"Authorization": f"Bearer {token_admin}"}
        img_buf = create_test_image(20)
        files = {'file': ('test_invalid.png', img_buf, 'image/png')}
        data = {'side': 'center'}
        resp = requests.post(f"{BASE_URL}/conferences/{conf_id}/header-logo", 
                           headers=headers, files=files, data=data)
        if resp.status_code == 400:
            error_msg = resp.json().get('error', '') if resp.headers.get('content-type', '').startswith('application/json') else resp.text
            if 'left' in error_msg.lower() or 'right' in error_msg.lower():
                print(f"✅ Step 6 PASSED: POST with side='center' returned 400 with appropriate error")
                print(f"   Error message: {error_msg}")
            else:
                print(f"⚠️  Step 6: Returned 400 but error message unclear: {error_msg}")
        else:
            print(f"❌ Step 6 FAILED: POST with side='center' returned {resp.status_code} (expected 400): {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Step 6 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Step 7: Reject non-privileged users (author)
    print("\n--- Step 7: Reject non-privileged user (author@scms.io) ---")
    token_author = login("author@scms.io", "password123")
    if token_author:
        try:
            headers = {"Authorization": f"Bearer {token_author}"}
            img_buf = create_test_image(20)
            files = {'file': ('test_author.png', img_buf, 'image/png')}
            data = {'side': 'left'}
            resp = requests.post(f"{BASE_URL}/conferences/{conf_id}/header-logo", 
                               headers=headers, files=files, data=data)
            if resp.status_code == 403:
                print(f"✅ Step 7a PASSED: POST as author@scms.io returned 403")
            else:
                print(f"❌ Step 7a FAILED: POST as author@scms.io returned {resp.status_code} (expected 403): {resp.text}")
                all_passed = False
        except Exception as e:
            print(f"❌ Step 7a FAILED: Exception: {str(e)}")
            all_passed = False
    else:
        print(f"⚠️  Step 7a: Cannot test (login failed for author@scms.io)")
    
    # Step 7b: Reject non-privileged users (committee)
    print("\n--- Step 7b: Reject non-privileged user (committee@scms.io) ---")
    token_committee = login("committee@scms.io", "password123")
    if token_committee:
        try:
            headers = {"Authorization": f"Bearer {token_committee}"}
            img_buf = create_test_image(20)
            files = {'file': ('test_committee.png', img_buf, 'image/png')}
            data = {'side': 'left'}
            resp = requests.post(f"{BASE_URL}/conferences/{conf_id}/header-logo", 
                               headers=headers, files=files, data=data)
            if resp.status_code == 403:
                print(f"✅ Step 7b PASSED: POST as committee@scms.io returned 403")
            else:
                print(f"❌ Step 7b FAILED: POST as committee@scms.io returned {resp.status_code} (expected 403): {resp.text}")
                all_passed = False
        except Exception as e:
            print(f"❌ Step 7b FAILED: Exception: {str(e)}")
            all_passed = False
    else:
        print(f"⚠️  Step 7b: Cannot test (login failed for committee@scms.io)")
    
    # Step 8: Clear LEFT logo
    print("\n--- Step 8: Clear LEFT logo (DELETE) ---")
    try:
        headers = {"Authorization": f"Bearer {token_admin}"}
        resp = requests.delete(f"{BASE_URL}/conferences/{conf_id}/header-logo", 
                             headers=headers, 
                             json={"side": "left"})
        if resp.status_code == 200:
            result = resp.json()
            if 'conference' in result:
                conf_obj = result.get('conference')
                if conf_obj.get('headerLogoLeft') is None:
                    print(f"✅ Step 8 PASSED: DELETE with side='left' returned 200 and headerLogoLeft is null")
                else:
                    print(f"❌ Step 8 FAILED: headerLogoLeft is not null: {conf_obj.get('headerLogoLeft')}")
                    all_passed = False
            else:
                print(f"❌ Step 8 FAILED: Response missing 'conference' field: {result}")
                all_passed = False
        else:
            print(f"❌ Step 8 FAILED: DELETE returned {resp.status_code} (expected 200): {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Step 8 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Step 9: Clear RIGHT logo
    print("\n--- Step 9: Clear RIGHT logo (DELETE) ---")
    try:
        headers = {"Authorization": f"Bearer {token_admin}"}
        resp = requests.delete(f"{BASE_URL}/conferences/{conf_id}/header-logo", 
                             headers=headers, 
                             json={"side": "right"})
        if resp.status_code == 200:
            result = resp.json()
            if 'conference' in result:
                conf_obj = result.get('conference')
                if conf_obj.get('headerLogoRight') is None:
                    print(f"✅ Step 9 PASSED: DELETE with side='right' returned 200 and headerLogoRight is null")
                else:
                    print(f"❌ Step 9 FAILED: headerLogoRight is not null: {conf_obj.get('headerLogoRight')}")
                    all_passed = False
            else:
                print(f"❌ Step 9 FAILED: Response missing 'conference' field: {result}")
                all_passed = False
        else:
            print(f"❌ Step 9 FAILED: DELETE returned {resp.status_code} (expected 200): {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Step 9 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Step 10: DELETE with bad side
    print("\n--- Step 10: DELETE with bad side (empty string) ---")
    try:
        headers = {"Authorization": f"Bearer {token_admin}"}
        resp = requests.delete(f"{BASE_URL}/conferences/{conf_id}/header-logo", 
                             headers=headers, 
                             json={"side": ""})
        if resp.status_code == 400:
            error_msg = resp.json().get('error', '') if resp.headers.get('content-type', '').startswith('application/json') else resp.text
            print(f"✅ Step 10 PASSED: DELETE with side='' returned 400")
            print(f"   Error message: {error_msg}")
        else:
            print(f"❌ Step 10 FAILED: DELETE with side='' returned {resp.status_code} (expected 400): {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Step 10 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Step 11: DELETE reject non-privileged (author)
    print("\n--- Step 11: DELETE reject non-privileged user (author@scms.io) ---")
    if token_author:
        try:
            headers = {"Authorization": f"Bearer {token_author}"}
            resp = requests.delete(f"{BASE_URL}/conferences/{conf_id}/header-logo", 
                                 headers=headers, 
                                 json={"side": "left"})
            if resp.status_code == 403:
                print(f"✅ Step 11 PASSED: DELETE as author@scms.io returned 403")
            else:
                print(f"❌ Step 11 FAILED: DELETE as author@scms.io returned {resp.status_code} (expected 403): {resp.text}")
                all_passed = False
        except Exception as e:
            print(f"❌ Step 11 FAILED: Exception: {str(e)}")
            all_passed = False
    else:
        print(f"⚠️  Step 11: Cannot test (login failed for author@scms.io)")
    
    # Step 12: Chief editor works (POST and DELETE)
    print("\n--- Step 12: Chief editor (chief@scms.io) can POST and DELETE ---")
    token_chief = login("chief@scms.io", "password123")
    if token_chief:
        # 12a: POST as chief
        try:
            headers = {"Authorization": f"Bearer {token_chief}"}
            img_buf = create_test_image(20)
            files = {'file': ('test_chief.png', img_buf, 'image/png')}
            data = {'side': 'left'}
            resp = requests.post(f"{BASE_URL}/conferences/{conf_id}/header-logo", 
                               headers=headers, files=files, data=data)
            if resp.status_code == 200:
                print(f"✅ Step 12a PASSED: POST as chief@scms.io returned 200")
            else:
                print(f"❌ Step 12a FAILED: POST as chief@scms.io returned {resp.status_code}: {resp.text}")
                all_passed = False
        except Exception as e:
            print(f"❌ Step 12a FAILED: Exception: {str(e)}")
            all_passed = False
        
        # 12b: DELETE as chief
        try:
            headers = {"Authorization": f"Bearer {token_chief}"}
            resp = requests.delete(f"{BASE_URL}/conferences/{conf_id}/header-logo", 
                                 headers=headers, 
                                 json={"side": "left"})
            if resp.status_code == 200:
                print(f"✅ Step 12b PASSED: DELETE as chief@scms.io returned 200")
            else:
                print(f"❌ Step 12b FAILED: DELETE as chief@scms.io returned {resp.status_code}: {resp.text}")
                all_passed = False
        except Exception as e:
            print(f"❌ Step 12b FAILED: Exception: {str(e)}")
            all_passed = False
    else:
        print(f"⚠️  Step 12: Cannot test (login failed for chief@scms.io)")
    
    # Step 13: Regression check - GET /public/config still works and heroImages intact
    print("\n--- Step 13: Regression check - GET /api/public/config ---")
    try:
        resp = requests.get(f"{BASE_URL}/public/config")
        if resp.status_code == 200:
            data = resp.json()
            conf = data.get("conference", {})
            has_hero_images = "heroImages" in conf
            hero_images = conf.get("heroImages", [])
            if has_hero_images and isinstance(hero_images, list):
                print(f"✅ Step 13 PASSED: GET /public/config returns 200 with well-formed conference object")
                print(f"   heroImages array present with {len(hero_images)} items")
                print(f"   headerLogoLeft: {conf.get('headerLogoLeft')}")
                print(f"   headerLogoRight: {conf.get('headerLogoRight')}")
            else:
                print(f"❌ Step 13 FAILED: heroImages field missing or not an array")
                all_passed = False
        else:
            print(f"❌ Step 13 FAILED: GET /public/config returned {resp.status_code}")
            all_passed = False
    except Exception as e:
        print(f"❌ Step 13 FAILED: Exception: {str(e)}")
        all_passed = False
    
    return all_passed

def main():
    print("="*80)
    print("BACKEND TEST: Header Logo Endpoints")
    print("="*80)
    
    all_passed = test_header_logo_endpoints()
    
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    if all_passed:
        print("✅ ALL TESTS PASSED")
        return 0
    else:
        print("❌ SOME TESTS FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())
