#!/usr/bin/env python3
"""
Admin Backend API Tests for Coffee Table (Hyperbeam Proxy)
Tests the admin endpoints and MAX_ACTIVE enforcement as specified in the review request.
"""

import requests
import json
import os
import time
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
load_dotenv(Path(__file__).parent / 'frontend' / '.env')

# Get base URL from environment
REACT_APP_BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL')
if not REACT_APP_BACKEND_URL:
    print("ERROR: REACT_APP_BACKEND_URL not found in environment")
    exit(1)

BASE_URL = f"{REACT_APP_BACKEND_URL}/api"
API_KEY = "sk_test_JdZwpNJgNmT9146OlIhx8CZzerrk4PhofqwZv6Bxlkc"
ADMIN_TOKEN = "ct_admin_yPT4V9qJb2QHn7M3sLx8A1kR5cD0eWgZ"

print(f"Testing admin backend API at: {BASE_URL}")
print("=" * 60)

def test_admin_active_sessions():
    """Test 1: GET /api/hb/admin/active - List active sessions"""
    print("\n1. Testing Admin Active Sessions: GET /api/hb/admin/active")
    
    headers = {
        "X-Admin-Token": ADMIN_TOKEN
    }
    
    try:
        response = requests.get(f"{BASE_URL}/hb/admin/active", 
                               headers=headers, 
                               timeout=10)
        
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            
            # Verify it's a list
            if isinstance(data, list):
                print(f"   ✅ PASS: Admin active sessions returned list with {len(data)} sessions")
                return True, data
            else:
                print("   ❌ FAIL: Response is not a list")
                return False, []
        else:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            print(f"   Response: {response.text}")
            return False, []
            
    except Exception as e:
        print(f"   ❌ FAIL: Exception occurred: {str(e)}")
        return False, []

def test_admin_active_sessions_no_auth():
    """Test 2: GET /api/hb/admin/active without admin token"""
    print("\n2. Testing Admin Active Sessions without Admin Token")
    
    try:
        response = requests.get(f"{BASE_URL}/hb/admin/active", timeout=10)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 401:
            print("   ✅ PASS: Missing admin token correctly returns 401")
            return True
        else:
            print(f"   ❌ FAIL: Expected 401, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ FAIL: Exception occurred: {str(e)}")
        return False

def test_admin_cleanup_dry_run():
    """Test 3: POST /api/hb/admin/cleanup with dry_run=true"""
    print("\n3. Testing Admin Cleanup (Dry Run): POST /api/hb/admin/cleanup")
    
    headers = {
        "X-Admin-Token": ADMIN_TOKEN,
        "Content-Type": "application/json"
    }
    
    payload = {
        "dry_run": True
    }
    
    try:
        response = requests.post(f"{BASE_URL}/hb/admin/cleanup", 
                               json=payload,
                               headers=headers, 
                               timeout=10)
        
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            
            # Verify dry_run response format
            if "dry_run" in data and data["dry_run"] is True:
                print("   ✅ PASS: Dry run cleanup returned correct format")
                return True, data.get("would_terminate", [])
            else:
                print("   ❌ FAIL: Missing dry_run field or incorrect value")
                return False, []
        else:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            print(f"   Response: {response.text}")
            return False, []
            
    except Exception as e:
        print(f"   ❌ FAIL: Exception occurred: {str(e)}")
        return False, []

def test_create_session():
    """Helper: Create a session for testing"""
    print("\n   Creating session for testing...")
    
    payload = {
        "start_url": "https://www.google.com",
        "width": 1280,
        "height": 720,
        "kiosk": True
    }
    
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/hb/sessions", 
                               json=payload, 
                               headers=headers, 
                               timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            session_uuid = data.get("session_uuid")
            print(f"   ✅ Session created: {session_uuid}")
            return session_uuid
        else:
            print(f"   ❌ Session creation failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return None
            
    except Exception as e:
        print(f"   ❌ Session creation exception: {str(e)}")
        return None

def test_admin_terminate_session():
    """Test 4: DELETE /api/hb/admin/sessions/{session_uuid}"""
    print("\n4. Testing Admin Terminate Session: DELETE /api/hb/admin/sessions/{session_uuid}")
    
    # First create a session
    session_uuid = test_create_session()
    if not session_uuid:
        print("   ❌ FAIL: Could not create session for termination test")
        return False
    
    headers = {
        "X-Admin-Token": ADMIN_TOKEN
    }
    
    try:
        response = requests.delete(f"{BASE_URL}/hb/admin/sessions/{session_uuid}", 
                                 headers=headers, 
                                 timeout=30)
        
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            
            # Verify session_uuid in response
            if data.get("session_uuid") == session_uuid:
                print("   ✅ PASS: Admin session termination successful")
                return True
            else:
                print("   ❌ FAIL: Session UUID mismatch in response")
                return False
        else:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ FAIL: Exception occurred: {str(e)}")
        return False

def test_max_active_enforcement():
    """Test 5: MAX_ACTIVE_SESSIONS enforcement (set to 1)"""
    print("\n5. Testing MAX_ACTIVE_SESSIONS Enforcement (limit=1)")
    
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
    
    # First, clean up any existing sessions
    print("   Cleaning up existing sessions...")
    cleanup_headers = {
        "X-Admin-Token": ADMIN_TOKEN,
        "Content-Type": "application/json"
    }
    cleanup_payload = {"dry_run": False}
    
    try:
        requests.post(f"{BASE_URL}/hb/admin/cleanup", 
                     json=cleanup_payload,
                     headers=cleanup_headers, 
                     timeout=10)
        print("   Cleanup completed")
    except:
        print("   Cleanup failed, continuing...")
    
    # Wait a moment for cleanup to complete
    time.sleep(2)
    
    # Create first session (should succeed)
    print("   Creating first session...")
    try:
        response1 = requests.post(f"{BASE_URL}/hb/sessions", 
                                json=payload, 
                                headers=headers, 
                                timeout=30)
        
        print(f"   First session status: {response1.status_code}")
        
        if response1.status_code == 200:
            session1_data = response1.json()
            session1_uuid = session1_data.get("session_uuid")
            print(f"   ✅ First session created: {session1_uuid}")
            
            # Immediately try to create second session (should fail with 429)
            print("   Creating second session (should fail)...")
            response2 = requests.post(f"{BASE_URL}/hb/sessions", 
                                    json=payload, 
                                    headers=headers, 
                                    timeout=30)
            
            print(f"   Second session status: {response2.status_code}")
            
            if response2.status_code == 429:
                error_data = response2.json()
                print(f"   Response: {json.dumps(error_data, indent=2)}")
                
                # Check error message
                detail = error_data.get("detail", "")
                if "Max active sessions reached" in detail and "(1)" in detail:
                    print("   ✅ PASS: MAX_ACTIVE enforcement working correctly")
                    
                    # Clean up the first session for next test
                    print("   Cleaning up first session...")
                    cleanup_payload = {"dry_run": False, "idle_minutes": 0}
                    cleanup_resp = requests.post(f"{BASE_URL}/hb/admin/cleanup", 
                                 json=cleanup_payload,
                                 headers=cleanup_headers, 
                                 timeout=10)
                    
                    print(f"   Cleanup response: {cleanup_resp.status_code}")
                    if cleanup_resp.status_code == 200:
                        cleanup_data = cleanup_resp.json()
                        print(f"   Cleanup result: {cleanup_data}")
                    
                    # Wait for cleanup
                    time.sleep(3)
                    
                    # Check active sessions after cleanup
                    active_resp = requests.get(f"{BASE_URL}/hb/admin/active", 
                                             headers=cleanup_headers, 
                                             timeout=10)
                    if active_resp.status_code == 200:
                        active_data = active_resp.json()
                        print(f"   Active sessions after cleanup: {len(active_data)}")
                    
                    # Try creating session again (should succeed now)
                    print("   Retrying session creation after cleanup...")
                    response3 = requests.post(f"{BASE_URL}/hb/sessions", 
                                            json=payload, 
                                            headers=headers, 
                                            timeout=30)
                    
                    if response3.status_code == 200:
                        print("   ✅ PASS: Session creation successful after cleanup")
                        return True
                    else:
                        print(f"   ❌ FAIL: Session creation failed after cleanup: {response3.status_code}")
                        print(f"   Response: {response3.text}")
                        return False
                else:
                    print(f"   ❌ FAIL: Incorrect error message: {detail}")
                    return False
            else:
                print(f"   ❌ FAIL: Expected 429, got {response2.status_code}")
                print(f"   Response: {response2.text}")
                return False
        else:
            print(f"   ❌ FAIL: First session creation failed: {response1.status_code}")
            print(f"   Response: {response1.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ FAIL: Exception occurred: {str(e)}")
        return False

def test_admin_cleanup_actual():
    """Test 6: POST /api/hb/admin/cleanup with dry_run=false"""
    print("\n6. Testing Admin Cleanup (Actual): POST /api/hb/admin/cleanup")
    
    # First create a session to clean up
    session_uuid = test_create_session()
    if not session_uuid:
        print("   ❌ FAIL: Could not create session for cleanup test")
        return False
    
    headers = {
        "X-Admin-Token": ADMIN_TOKEN,
        "Content-Type": "application/json"
    }
    
    payload = {
        "dry_run": False,
        "idle_minutes": 0  # Clean up immediately
    }
    
    try:
        response = requests.post(f"{BASE_URL}/hb/admin/cleanup", 
                               json=payload,
                               headers=headers, 
                               timeout=10)
        
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            
            # Verify cleanup response format
            if "terminated" in data and "count" in data:
                print(f"   ✅ PASS: Cleanup terminated {data['count']} sessions")
                return True
            else:
                print("   ❌ FAIL: Missing terminated or count fields")
                return False
        else:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ FAIL: Exception occurred: {str(e)}")
        return False

def main():
    """Run all admin tests"""
    print("Starting Admin Backend API Tests for Coffee Table")
    print(f"Base URL: {BASE_URL}")
    print(f"Using API Key: {API_KEY[:20]}...")
    print(f"Using Admin Token: {ADMIN_TOKEN[:20]}...")
    
    results = []
    
    # Test 1: List active sessions with admin token
    result1, active_sessions = test_admin_active_sessions()
    results.append(result1)
    
    # Test 2: List active sessions without admin token (should fail)
    results.append(test_admin_active_sessions_no_auth())
    
    # Test 3: Cleanup dry run
    result3, would_terminate = test_admin_cleanup_dry_run()
    results.append(result3)
    
    # Test 4: Admin terminate specific session
    results.append(test_admin_terminate_session())
    
    # Test 5: MAX_ACTIVE enforcement
    results.append(test_max_active_enforcement())
    
    # Test 6: Actual cleanup
    results.append(test_admin_cleanup_actual())
    
    # Summary
    print("\n" + "=" * 60)
    print("ADMIN TEST SUMMARY")
    print("=" * 60)
    
    test_names = [
        "Admin List Active Sessions",
        "Admin Auth Required",
        "Admin Cleanup (Dry Run)",
        "Admin Terminate Session",
        "MAX_ACTIVE Enforcement",
        "Admin Cleanup (Actual)"
    ]
    
    passed = sum(results)
    total = len(results)
    
    for i, (name, result) in enumerate(zip(test_names, results)):
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{i+1}. {name}: {status}")
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All admin tests passed!")
        return True
    else:
        print("⚠️  Some admin tests failed. Check the details above.")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)