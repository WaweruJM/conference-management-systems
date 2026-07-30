#!/usr/bin/env python3
"""
Backend test for extended header assets endpoint with background support.
Tests POST/DELETE /api/conferences/:id/header-logo with side='background' in addition to 'left'/'right'.
"""

import requests
import io
import sys
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
    """Get featured conference ID"""
    try:
        resp = requests.get(f"{BASE_URL}/public/config")
        if resp.status_code == 200:
            data = resp.json()
            conf_id = data.get("conference", {}).get("id")
            conf_name = data.get("conference", {}).get("name")
            print(f"✅ Featured conference: {conf_name} (ID: {conf_id})")
            return conf_id
        else:
            print(f"❌ Failed to get featured conference: {resp.status_code}")
            return None
    except Exception as e:
        print(f"❌ Exception getting featured conference: {str(e)}")
        return None

def create_test_image(size_kb):
    """Create a minimal valid PNG of approximately the specified size in KB"""
    # PNG header
    png_header = b'\x89PNG\r\n\x1a\n'
    
    # Determine dimensions based on target size
    if size_kb < 100:
        width, height = 100, 100
    elif size_kb < 1000:
        width, height = 800, 600
    elif size_kb < 3000:
        width, height = 1500, 1000
    else:
        width, height = 2500, 1500
    
    # IHDR chunk
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    ihdr_chunk = b'IHDR' + ihdr_data
    ihdr_crc = struct.pack('>I', 0x00000000)  # Simplified CRC
    ihdr = struct.pack('>I', len(ihdr_data)) + ihdr_chunk + ihdr_crc
    
    # Create image data (RGB pixels)
    # Each pixel is 3 bytes (RGB), plus 1 filter byte per scanline
    bytes_per_row = 1 + (width * 3)
    total_data_size = bytes_per_row * height
    
    # Pad to reach target size
    target_bytes = size_kb * 1024
    padding_size = max(0, target_bytes - len(png_header) - len(ihdr) - 100)
    
    # IDAT chunk with image data
    idat_data = b'\x00' * min(total_data_size, padding_size)
    idat_chunk = b'IDAT' + idat_data
    idat_crc = struct.pack('>I', 0x00000000)
    idat = struct.pack('>I', len(idat_data)) + idat_chunk + idat_crc
    
    # IEND chunk
    iend = struct.pack('>I', 0) + b'IEND' + struct.pack('>I', 0xAE426082)
    
    # Combine all chunks
    png_bytes = png_header + ihdr + idat + iend
    
    actual_size = len(png_bytes)
    print(f"   Created test image: {actual_size / 1024:.1f} KB ({width}x{height})")
    
    return io.BytesIO(png_bytes)

def test_header_background_endpoint():
    """Test extended header assets endpoint with background support"""
    print("\n" + "="*80)
    print("EXTENDED HEADER ASSETS ENDPOINT TEST")
    print("="*80)
    
    # Get featured conference
    featured_id = get_featured_conference()
    if not featured_id:
        print("❌ Cannot proceed without featured conference ID")
        return False
    
    all_passed = True
    
    # Test 1: Login as admin and verify /public/config returns headerBackground field
    print("\n--- Test 1: Verify /public/config returns headerBackground field ---")
    token_admin = login("admin@scms.io", "password123")
    if not token_admin:
        print("❌ Test 1 FAILED: Cannot login as admin@scms.io")
        return False
    
    try:
        resp = requests.get(f"{BASE_URL}/public/config")
        if resp.status_code == 200:
            data = resp.json()
            conf = data.get("conference", {})
            if "headerBackground" in conf:
                print(f"✅ Test 1 PASSED: /public/config returns headerBackground field (value: {conf.get('headerBackground')})")
            else:
                print(f"❌ Test 1 FAILED: headerBackground field not found in conference object")
                all_passed = False
        else:
            print(f"❌ Test 1 FAILED: GET /public/config returned {resp.status_code}")
            all_passed = False
    except Exception as e:
        print(f"❌ Test 1 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Test 2: Upload ~1 MB PNG with side='background' - expect 200
    print("\n--- Test 2: Upload ~1 MB PNG with side='background' ---")
    headers = {"Authorization": f"Bearer {token_admin}"}
    try:
        img_bytes = create_test_image(1000)  # ~1 MB
        files = {'file': ('test_background.png', img_bytes, 'image/png')}
        data = {'side': 'background'}
        resp = requests.post(f"{BASE_URL}/conferences/{featured_id}/header-logo", 
                           headers=headers, files=files, data=data)
        if resp.status_code == 200:
            result = resp.json()
            if result.get("side") == "background" and "imagePath" in result:
                print(f"✅ Test 2 PASSED: Upload background returned 200")
                print(f"   imagePath: {result.get('imagePath')}")
                print(f"   side: {result.get('side')}")
                
                # Verify /public/config now shows headerBackground
                resp2 = requests.get(f"{BASE_URL}/public/config")
                if resp2.status_code == 200:
                    conf = resp2.json().get("conference", {})
                    if conf.get("headerBackground") == result.get("imagePath"):
                        print(f"✅ Test 2: /public/config.headerBackground updated correctly")
                    else:
                        print(f"❌ Test 2: /public/config.headerBackground mismatch")
                        all_passed = False
            else:
                print(f"❌ Test 2 FAILED: Response missing expected fields: {result}")
                all_passed = False
        else:
            print(f"❌ Test 2 FAILED: Upload returned {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Test 2 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Test 3: Upload ~6 MB image with side='background' - expect 400
    print("\n--- Test 3: Upload ~6 MB image with side='background' (expect 400) ---")
    try:
        img_bytes = create_test_image(6000)  # ~6 MB
        files = {'file': ('test_large.png', img_bytes, 'image/png')}
        data = {'side': 'background'}
        resp = requests.post(f"{BASE_URL}/conferences/{featured_id}/header-logo", 
                           headers=headers, files=files, data=data)
        if resp.status_code == 400:
            error_msg = resp.json().get("error", "")
            if "5 MB" in error_msg or "too large" in error_msg.lower():
                print(f"✅ Test 3 PASSED: Upload >5 MB correctly returned 400")
                print(f"   Error message: {error_msg}")
            else:
                print(f"❌ Test 3 FAILED: Error message doesn't mention size limit: {error_msg}")
                all_passed = False
        else:
            print(f"❌ Test 3 FAILED: Expected 400, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Test 3 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Test 4: Upload ~3 MB image with side='left' - expect 400 (icons still capped at 2 MB)
    print("\n--- Test 4: Upload ~3 MB image with side='left' (expect 400) ---")
    try:
        img_bytes = create_test_image(3000)  # ~3 MB
        files = {'file': ('test_left_large.png', img_bytes, 'image/png')}
        data = {'side': 'left'}
        resp = requests.post(f"{BASE_URL}/conferences/{featured_id}/header-logo", 
                           headers=headers, files=files, data=data)
        if resp.status_code == 400:
            error_msg = resp.json().get("error", "")
            if "2 MB" in error_msg or "too large" in error_msg.lower():
                print(f"✅ Test 4 PASSED: Upload >2 MB for 'left' correctly returned 400")
                print(f"   Error message: {error_msg}")
            else:
                print(f"❌ Test 4 FAILED: Error message doesn't mention 2 MB limit: {error_msg}")
                all_passed = False
        else:
            print(f"❌ Test 4 FAILED: Expected 400, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Test 4 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Test 5: Upload with side='middle' - expect 400
    print("\n--- Test 5: Upload with side='middle' (expect 400) ---")
    try:
        img_bytes = create_test_image(50)  # Small image
        files = {'file': ('test_invalid.png', img_bytes, 'image/png')}
        data = {'side': 'middle'}
        resp = requests.post(f"{BASE_URL}/conferences/{featured_id}/header-logo", 
                           headers=headers, files=files, data=data)
        if resp.status_code == 400:
            error_msg = resp.json().get("error", "")
            if "left" in error_msg and "right" in error_msg and "background" in error_msg:
                print(f"✅ Test 5 PASSED: Invalid side correctly returned 400")
                print(f"   Error message: {error_msg}")
            else:
                print(f"❌ Test 5 FAILED: Error message doesn't mention valid sides: {error_msg}")
                all_passed = False
        else:
            print(f"❌ Test 5 FAILED: Expected 400, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Test 5 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Test 6: DELETE with {"side":"background"} - expect 200
    print("\n--- Test 6: DELETE with side='background' ---")
    try:
        resp = requests.delete(f"{BASE_URL}/conferences/{featured_id}/header-logo", 
                             headers=headers, json={"side": "background"})
        if resp.status_code == 200:
            result = resp.json()
            conf = result.get("conference", {})
            if conf.get("headerBackground") is None:
                print(f"✅ Test 6 PASSED: DELETE background returned 200, field now null")
                
                # Verify /public/config
                resp2 = requests.get(f"{BASE_URL}/public/config")
                if resp2.status_code == 200:
                    conf2 = resp2.json().get("conference", {})
                    if conf2.get("headerBackground") is None:
                        print(f"✅ Test 6: /public/config.headerBackground now null")
                    else:
                        print(f"❌ Test 6: /public/config.headerBackground not null: {conf2.get('headerBackground')}")
                        all_passed = False
            else:
                print(f"❌ Test 6 FAILED: headerBackground not null after delete: {conf.get('headerBackground')}")
                all_passed = False
        else:
            print(f"❌ Test 6 FAILED: DELETE returned {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Test 6 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Test 7: DELETE with {"side":"invalid"} - expect 400
    print("\n--- Test 7: DELETE with side='invalid' (expect 400) ---")
    try:
        resp = requests.delete(f"{BASE_URL}/conferences/{featured_id}/header-logo", 
                             headers=headers, json={"side": "invalid"})
        if resp.status_code == 400:
            error_msg = resp.json().get("error", "")
            print(f"✅ Test 7 PASSED: DELETE with invalid side returned 400")
            print(f"   Error message: {error_msg}")
        else:
            print(f"❌ Test 7 FAILED: Expected 400, got {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Test 7 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Test 8: As author@scms.io - POST with valid file+side='background' - expect 403
    print("\n--- Test 8: POST as author@scms.io (expect 403) ---")
    token_author = login("author@scms.io", "password123")
    if token_author:
        headers_author = {"Authorization": f"Bearer {token_author}"}
        try:
            img_bytes = create_test_image(50)
            files = {'file': ('test_author.png', img_bytes, 'image/png')}
            data = {'side': 'background'}
            resp = requests.post(f"{BASE_URL}/conferences/{featured_id}/header-logo", 
                               headers=headers_author, files=files, data=data)
            if resp.status_code == 403:
                print(f"✅ Test 8 PASSED: Author correctly denied with 403")
            else:
                print(f"❌ Test 8 FAILED: Expected 403, got {resp.status_code}: {resp.text}")
                all_passed = False
        except Exception as e:
            print(f"❌ Test 8 FAILED: Exception: {str(e)}")
            all_passed = False
    else:
        print(f"❌ Test 8 FAILED: Cannot login as author@scms.io")
        all_passed = False
    
    # Test 9: As chief@scms.io - POST valid background upload, then DELETE
    print("\n--- Test 9: POST and DELETE as chief@scms.io ---")
    token_chief = login("chief@scms.io", "password123")
    if token_chief:
        headers_chief = {"Authorization": f"Bearer {token_chief}"}
        try:
            # POST
            img_bytes = create_test_image(500)  # ~500 KB
            files = {'file': ('test_chief.png', img_bytes, 'image/png')}
            data = {'side': 'background'}
            resp = requests.post(f"{BASE_URL}/conferences/{featured_id}/header-logo", 
                               headers=headers_chief, files=files, data=data)
            if resp.status_code == 200:
                print(f"✅ Test 9a PASSED: Chief editor can POST background")
                
                # DELETE
                resp2 = requests.delete(f"{BASE_URL}/conferences/{featured_id}/header-logo", 
                                      headers=headers_chief, json={"side": "background"})
                if resp2.status_code == 200:
                    print(f"✅ Test 9b PASSED: Chief editor can DELETE background")
                else:
                    print(f"❌ Test 9b FAILED: DELETE returned {resp2.status_code}: {resp2.text}")
                    all_passed = False
            else:
                print(f"❌ Test 9a FAILED: POST returned {resp.status_code}: {resp.text}")
                all_passed = False
        except Exception as e:
            print(f"❌ Test 9 FAILED: Exception: {str(e)}")
            all_passed = False
    else:
        print(f"❌ Test 9 FAILED: Cannot login as chief@scms.io")
        all_passed = False
    
    # Test 10: Regression - upload side='left' ~50KB PNG, verify /public/config.headerLogoLeft updates
    print("\n--- Test 10: Regression - upload side='left' ---")
    try:
        img_bytes = create_test_image(50)  # ~50 KB
        files = {'file': ('test_left.png', img_bytes, 'image/png')}
        data = {'side': 'left'}
        resp = requests.post(f"{BASE_URL}/conferences/{featured_id}/header-logo", 
                           headers=headers, files=files, data=data)
        if resp.status_code == 200:
            result = resp.json()
            if result.get("side") == "left" and "imagePath" in result:
                print(f"✅ Test 10a PASSED: Upload left returned 200")
                
                # Verify /public/config
                resp2 = requests.get(f"{BASE_URL}/public/config")
                if resp2.status_code == 200:
                    conf = resp2.json().get("conference", {})
                    if conf.get("headerLogoLeft") == result.get("imagePath"):
                        print(f"✅ Test 10b PASSED: /public/config.headerLogoLeft updated")
                        
                        # Verify headerBackground is still null (unaffected)
                        if conf.get("headerBackground") is None:
                            print(f"✅ Test 10c PASSED: headerBackground unaffected (still null)")
                        else:
                            print(f"❌ Test 10c FAILED: headerBackground affected: {conf.get('headerBackground')}")
                            all_passed = False
                    else:
                        print(f"❌ Test 10b FAILED: headerLogoLeft mismatch")
                        all_passed = False
            else:
                print(f"❌ Test 10a FAILED: Response missing expected fields: {result}")
                all_passed = False
        else:
            print(f"❌ Test 10a FAILED: Upload returned {resp.status_code}: {resp.text}")
            all_passed = False
    except Exception as e:
        print(f"❌ Test 10 FAILED: Exception: {str(e)}")
        all_passed = False
    
    # Cleanup: Delete all logos to restore baseline
    print("\n--- Cleanup: Delete all logos ---")
    try:
        for side in ['left', 'right', 'background']:
            resp = requests.delete(f"{BASE_URL}/conferences/{featured_id}/header-logo", 
                                 headers=headers, json={"side": side})
            if resp.status_code == 200:
                print(f"✅ Cleanup: Deleted {side} logo")
            else:
                print(f"⚠️  Cleanup: Failed to delete {side} logo: {resp.status_code}")
        
        # Verify all null
        resp = requests.get(f"{BASE_URL}/public/config")
        if resp.status_code == 200:
            conf = resp.json().get("conference", {})
            if conf.get("headerLogoLeft") is None and conf.get("headerLogoRight") is None and conf.get("headerBackground") is None:
                print(f"✅ Cleanup: All logos now null")
            else:
                print(f"⚠️  Cleanup: Some logos still set: left={conf.get('headerLogoLeft')}, right={conf.get('headerLogoRight')}, background={conf.get('headerBackground')}")
    except Exception as e:
        print(f"⚠️  Cleanup: Exception: {str(e)}")
    
    return all_passed

def main():
    print("="*80)
    print("BACKEND TEST: Extended Header Assets Endpoint with Background Support")
    print("="*80)
    
    all_passed = test_header_background_endpoint()
    
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
