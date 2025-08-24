#!/usr/bin/env python3
"""
Comprehensive Admin Backend API Tests for Coffee Table
Tests all admin endpoints as specified in the review request.
"""

import requests
import json
import os
import time
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
load_dotenv(Path(__file__).parent / 'frontend' / '.env')

BASE_URL = f"{os.getenv('REACT_APP_BACKEND_URL')}/api"
API_KEY = "sk_test_JdZwpNJgNmT9146OlIhx8CZzerrk4PhofqwZv6Bxlkc"
ADMIN_TOKEN = "ct_admin_yPT4V9qJb2QHn7M3sLx8A1kR5cD0eWgZ"

print(f"Testing admin endpoints at: {BASE_URL}")
print("=" * 60)

def test_admin_active_sessions():
    """Test GET /api/hb/admin/active with X-Admin-Token header"""
    print("\n1. Testing GET /api/hb/admin/active")
    
    headers = {"X-Admin-Token": ADMIN_TOKEN}
    
    try:
        response = requests.get(f"{BASE_URL}/hb/admin/active", headers=headers, timeout=10)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Found {len(data)} active sessions")
            
            # Verify response structure
            if isinstance(data, list):
                for session in data:
                    if "session_uuid" in session and "age_minutes" in session:
                        print(f"   ✅ Session {session['session_uuid']}: {session['age_minutes']:.1f} minutes old")
                    else:
                        print(f"   ❌ Invalid session structure: {session}")
                        return False
                print("   ✅ PASS: Admin active sessions endpoint working")
                return True, data
            else:
                print("   ❌ FAIL: Response is not a list")
                return False, []
        else:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            return False, []
            
    except Exception as e:
        print(f"   ❌ FAIL: Exception: {str(e)}")
        return False, []

def test_admin_auth_required():
    """Test that admin endpoints require X-Admin-Token"""
    print("\n2. Testing admin authentication requirement")
    
    try:
        # Test without header
        response = requests.get(f"{BASE_URL}/hb/admin/active", timeout=10)
        print(f"   No header status: {response.status_code}")
        
        # Test with wrong header
        wrong_headers = {"X-Admin-Token": "wrong_token"}
        response2 = requests.get(f"{BASE_URL}/hb/admin/active", headers=wrong_headers, timeout=10)
        print(f"   Wrong token status: {response2.status_code}")
        
        if response.status_code == 401 and response2.status_code == 401:
            print("   ✅ PASS: Admin authentication properly enforced")
            return True
        else:
            print("   ❌ FAIL: Admin authentication not properly enforced")
            return False
            
    except Exception as e:
        print(f"   ❌ FAIL: Exception: {str(e)}")
        return False

def test_admin_cleanup_dry_run():
    """Test POST /api/hb/admin/cleanup with dry_run=true"""
    print("\n3. Testing POST /api/hb/admin/cleanup (dry_run=true)")
    
    headers = {
        "X-Admin-Token": ADMIN_TOKEN,
        "Content-Type": "application/json"
    }
    
    payload = {"dry_run": True}
    
    try:
        response = requests.post(f"{BASE_URL}/hb/admin/cleanup", 
                               json=payload, headers=headers, timeout=10)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            
            if "dry_run" in data and data["dry_run"] is True and "would_terminate" in data:
                print(f"   ✅ PASS: Dry run would terminate {len(data['would_terminate'])} sessions")
                return True, data["would_terminate"]
            else:
                print("   ❌ FAIL: Invalid dry run response format")
                return False, []
        else:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            return False, []
            
    except Exception as e:
        print(f"   ❌ FAIL: Exception: {str(e)}")
        return False, []

def create_test_session():
    """Helper to create a test session"""
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "start_url": "https://www.google.com",
        "width": 1280,
        "height": 720,
        "kiosk": True
    }
    
    response = requests.post(f"{BASE_URL}/hb/sessions", 
                           json=payload, headers=headers, timeout=30)
    
    if response.status_code == 200:
        data = response.json()
        return data.get("session_uuid")
    return None

def test_admin_terminate_session():
    """Test DELETE /api/hb/admin/sessions/{session_uuid}"""
    print("\n4. Testing DELETE /api/hb/admin/sessions/{session_uuid}")
    
    # Clean up first to ensure we can create a session
    cleanup_headers = {
        "X-Admin-Token": ADMIN_TOKEN,
        "Content-Type": "application/json"
    }
    requests.post(f"{BASE_URL}/hb/admin/cleanup", 
                 json={"dry_run": False, "idle_minutes": 0}, 
                 headers=cleanup_headers, timeout=10)
    time.sleep(1)
    
    # Create a test session
    session_uuid = create_test_session()
    if not session_uuid:
        print("   ❌ FAIL: Could not create test session")
        return False
    
    print(f"   Created test session: {session_uuid}")
    
    headers = {"X-Admin-Token": ADMIN_TOKEN}
    
    try:
        response = requests.delete(f"{BASE_URL}/hb/admin/sessions/{session_uuid}", 
                                 headers=headers, timeout=30)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            
            if data.get("session_uuid") == session_uuid:
                print("   ✅ PASS: Admin session termination successful")
                return True
            else:
                print("   ❌ FAIL: Session UUID mismatch in response")
                return False
        else:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ FAIL: Exception: {str(e)}")
        return False

def test_max_active_guard():
    """Test MAX_ACTIVE_SESSIONS enforcement"""
    print("\n5. Testing MAX_ACTIVE_SESSIONS guard (limit=1)")
    
    # Clean up all sessions first
    cleanup_headers = {
        "X-Admin-Token": ADMIN_TOKEN,
        "Content-Type": "application/json"
    }
    requests.post(f"{BASE_URL}/hb/admin/cleanup", 
                 json={"dry_run": False, "idle_minutes": 0}, 
                 headers=cleanup_headers, timeout=10)
    time.sleep(2)
    
    session_headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "start_url": "https://www.google.com",
        "width": 1280,
        "height": 720,
        "kiosk": True
    }
    
    try:
        # Create first session (should succeed)
        print("   Creating first session...")
        response1 = requests.post(f"{BASE_URL}/hb/sessions", 
                                json=payload, headers=session_headers, timeout=30)
        print(f"   First session status: {response1.status_code}")
        
        if response1.status_code == 200:
            session1_data = response1.json()
            session1_uuid = session1_data.get("session_uuid")
            print(f"   ✅ First session created: {session1_uuid}")
            
            # Try second session immediately (should fail)
            print("   Creating second session (should fail)...")
            response2 = requests.post(f"{BASE_URL}/hb/sessions", 
                                    json=payload, headers=session_headers, timeout=30)
            print(f"   Second session status: {response2.status_code}")
            
            if response2.status_code == 429:
                error_data = response2.json()
                detail = error_data.get("detail", "")
                print(f"   Error message: {detail}")
                
                if "Max active sessions reached (1)" in detail:
                    print("   ✅ PASS: MAX_ACTIVE guard working correctly")
                    
                    # Clean up using admin cleanup (dry_run=false)
                    print("   Cleaning up with admin cleanup...")
                    cleanup_response = requests.post(f"{BASE_URL}/hb/admin/cleanup", 
                                                   json={"dry_run": False}, 
                                                   headers=cleanup_headers, timeout=10)
                    
                    if cleanup_response.status_code == 200:
                        cleanup_data = cleanup_response.json()
                        print(f"   Cleanup result: {cleanup_data}")
                        
                        # Wait and try creating session again
                        time.sleep(2)
                        print("   Retrying session creation after cleanup...")
                        response3 = requests.post(f"{BASE_URL}/hb/sessions", 
                                                json=payload, headers=session_headers, timeout=30)
                        
                        if response3.status_code == 200:
                            session3_data = response3.json()
                            print(f"   ✅ Session created after cleanup: {session3_data.get('session_uuid')}")
                            return True
                        else:
                            print(f"   ❌ Failed to create session after cleanup: {response3.status_code}")
                            return False
                    else:
                        print(f"   ❌ Cleanup failed: {cleanup_response.status_code}")
                        return False
                else:
                    print(f"   ❌ Wrong error message: {detail}")
                    return False
            else:
                print(f"   ❌ Expected 429, got {response2.status_code}")
                return False
        else:
            print(f"   ❌ First session creation failed: {response1.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ FAIL: Exception: {str(e)}")
        return False

def test_admin_cleanup_actual():
    """Test POST /api/hb/admin/cleanup with dry_run=false"""
    print("\n6. Testing POST /api/hb/admin/cleanup (dry_run=false)")
    
    # Clean up first, then create a session to clean up
    cleanup_headers = {
        "X-Admin-Token": ADMIN_TOKEN,
        "Content-Type": "application/json"
    }
    requests.post(f"{BASE_URL}/hb/admin/cleanup", 
                 json={"dry_run": False, "idle_minutes": 0}, 
                 headers=cleanup_headers, timeout=10)
    time.sleep(1)
    
    # Create a test session
    session_uuid = create_test_session()
    if not session_uuid:
        print("   ❌ FAIL: Could not create test session")
        return False
    
    print(f"   Created test session: {session_uuid}")
    time.sleep(1)
    
    try:
        response = requests.post(f"{BASE_URL}/hb/admin/cleanup", 
                               json={"dry_run": False, "idle_minutes": 0}, 
                               headers=cleanup_headers, timeout=10)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            
            if "terminated" in data and "count" in data:
                print(f"   ✅ PASS: Cleanup terminated {data['count']} sessions")
                return True
            else:
                print("   ❌ FAIL: Invalid cleanup response format")
                return False
        else:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ FAIL: Exception: {str(e)}")
        return False

def main():
    """Run all comprehensive admin tests"""
    print("Starting Comprehensive Admin Backend API Tests")
    print(f"Base URL: {BASE_URL}")
    print(f"API Key: {API_KEY[:20]}...")
    print(f"Admin Token: {ADMIN_TOKEN[:20]}...")
    
    results = []
    
    # Test 1: Admin list active sessions
    result1, active_sessions = test_admin_active_sessions()
    results.append(result1)
    
    # Test 2: Admin authentication required
    results.append(test_admin_auth_required())
    
    # Test 3: Admin cleanup dry run
    result3, would_terminate = test_admin_cleanup_dry_run()
    results.append(result3)
    
    # Test 4: Admin terminate specific session
    results.append(test_admin_terminate_session())
    
    # Test 5: MAX_ACTIVE guard enforcement
    results.append(test_max_active_guard())
    
    # Test 6: Admin cleanup actual
    results.append(test_admin_cleanup_actual())
    
    # Final cleanup
    cleanup_headers = {
        "X-Admin-Token": ADMIN_TOKEN,
        "Content-Type": "application/json"
    }
    requests.post(f"{BASE_URL}/hb/admin/cleanup", 
                 json={"dry_run": False, "idle_minutes": 0}, 
                 headers=cleanup_headers, timeout=10)
    
    # Summary
    print("\n" + "=" * 60)
    print("COMPREHENSIVE ADMIN TEST SUMMARY")
    print("=" * 60)
    
    test_names = [
        "GET /api/hb/admin/active (with X-Admin-Token)",
        "Admin authentication enforcement",
        "POST /api/hb/admin/cleanup (dry_run=true)",
        "DELETE /api/hb/admin/sessions/{uuid} (with X-Admin-Token)",
        "MAX_ACTIVE_SESSIONS guard (limit=1)",
        "POST /api/hb/admin/cleanup (dry_run=false)"
    ]
    
    passed = sum(results)
    total = len(results)
    
    for i, (name, result) in enumerate(zip(test_names, results)):
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{i+1}. {name}: {status}")
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ALL ADMIN TESTS PASSED!")
        return True
    else:
        print("⚠️  Some admin tests failed.")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)