#!/usr/bin/env python3
"""
Backend API Tests for Coffee Table (Hyperbeam Proxy)
Tests the /api/hb endpoints as specified in the review request.
"""

import requests
import json
import os
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

print(f"Testing backend API at: {BASE_URL}")
print("=" * 60)

def test_health_check():
    """Test 1: Health check endpoint"""
    print("\n1. Testing Health Check: GET /api/hb/health")
    try:
        response = requests.get(f"{BASE_URL}/hb/health", timeout=10)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            
            # Verify required fields
            if "status" in data and data["status"] == "healthy" and "timestamp" in data:
                print("   ✅ PASS: Health check returned correct format")
                return True
            else:
                print("   ❌ FAIL: Missing required fields (status=healthy, timestamp)")
                return False
        else:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ FAIL: Exception occurred: {str(e)}")
        return False

def test_create_session():
    """Test 2: Create session endpoint"""
    print("\n2. Testing Create Session: POST /api/hb/sessions")
    
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
        
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            
            # Verify required fields
            if "session_uuid" in data and "embed_url" in data:
                print("   ✅ PASS: Session created successfully")
                return data["session_uuid"], data["embed_url"]
            else:
                print("   ❌ FAIL: Missing required fields (session_uuid, embed_url)")
                return None, None
        else:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            print(f"   Response: {response.text}")
            return None, None
            
    except Exception as e:
        print(f"   ❌ FAIL: Exception occurred: {str(e)}")
        return None, None

def test_get_session(session_uuid, expected_embed_url):
    """Test 3: Get session endpoint"""
    print(f"\n3. Testing Get Session: GET /api/hb/sessions/{session_uuid}")
    
    try:
        response = requests.get(f"{BASE_URL}/hb/sessions/{session_uuid}", timeout=10)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            
            # Verify the embed_url matches
            if data.get("embed_url") == expected_embed_url:
                print("   ✅ PASS: Session retrieved with correct embed_url")
                return True
            else:
                print(f"   ❌ FAIL: embed_url mismatch. Expected: {expected_embed_url}, Got: {data.get('embed_url')}")
                return False
        else:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ FAIL: Exception occurred: {str(e)}")
        return False

def test_terminate_session(session_uuid):
    """Test 4: Terminate session endpoint"""
    print(f"\n4. Testing Terminate Session: DELETE /api/hb/sessions/{session_uuid}")
    
    headers = {
        "Authorization": f"Bearer {API_KEY}"
    }
    
    try:
        response = requests.delete(f"{BASE_URL}/hb/sessions/{session_uuid}", 
                                 headers=headers, 
                                 timeout=30)
        
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            
            # Check if message contains "terminated" or acceptable local message
            message = data.get("message", "").lower()
            if "terminated" in message or "inactive" in message:
                print("   ✅ PASS: Session terminated successfully")
                return True
            else:
                print(f"   ❌ FAIL: Unexpected termination message: {data.get('message')}")
                return False
        else:
            print(f"   ❌ FAIL: Expected 200, got {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ FAIL: Exception occurred: {str(e)}")
        return False

def test_get_terminated_session(session_uuid):
    """Test 5: Verify terminated session returns 410"""
    print(f"\n5. Testing Get Terminated Session: GET /api/hb/sessions/{session_uuid}")
    
    try:
        response = requests.get(f"{BASE_URL}/hb/sessions/{session_uuid}", timeout=10)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 410:
            print("   ✅ PASS: Terminated session correctly returns 410")
            return True
        else:
            print(f"   ❌ FAIL: Expected 410, got {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ FAIL: Exception occurred: {str(e)}")
        return False

def test_missing_auth_create():
    """Test 6: Create session without authorization"""
    print("\n6. Testing Create Session without Authorization")
    
    payload = {
        "start_url": "https://www.google.com",
        "width": 1280,
        "height": 720,
        "kiosk": True
    }
    
    try:
        response = requests.post(f"{BASE_URL}/hb/sessions", 
                               json=payload, 
                               timeout=10)
        
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code in [401, 422]:
            print("   ✅ PASS: Missing auth correctly returns 401/422")
            return True
        else:
            print(f"   ❌ FAIL: Expected 401/422, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ FAIL: Exception occurred: {str(e)}")
        return False

def test_missing_auth_delete():
    """Test 7: Delete session without authorization"""
    print("\n7. Testing Delete Session without Authorization")
    
    # Use a dummy UUID for this test
    dummy_uuid = "test-uuid-123"
    
    try:
        response = requests.delete(f"{BASE_URL}/hb/sessions/{dummy_uuid}", timeout=10)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code in [401, 422]:
            print("   ✅ PASS: Missing auth correctly returns 401/422")
            return True
        else:
            print(f"   ❌ FAIL: Expected 401/422, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ FAIL: Exception occurred: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("Starting Backend API Tests for Coffee Table (Hyperbeam Proxy)")
    print(f"Base URL: {BASE_URL}")
    print(f"Using API Key: {API_KEY[:20]}...")
    
    results = []
    session_uuid = None
    embed_url = None
    
    # Test 1: Health check
    results.append(test_health_check())
    
    # Test 2: Create session
    session_uuid, embed_url = test_create_session()
    results.append(session_uuid is not None and embed_url is not None)
    
    # Only continue with session tests if creation was successful
    if session_uuid and embed_url:
        # Test 3: Get session
        results.append(test_get_session(session_uuid, embed_url))
        
        # Test 4: Terminate session
        results.append(test_terminate_session(session_uuid))
        
        # Test 5: Get terminated session (should return 410)
        results.append(test_get_terminated_session(session_uuid))
    else:
        print("\n⚠️  Skipping session-dependent tests due to creation failure")
        results.extend([False, False, False])
    
    # Test 6 & 7: Edge cases for missing auth
    results.append(test_missing_auth_create())
    results.append(test_missing_auth_delete())
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    test_names = [
        "Health Check",
        "Create Session",
        "Get Session", 
        "Terminate Session",
        "Get Terminated Session",
        "Missing Auth (Create)",
        "Missing Auth (Delete)"
    ]
    
    passed = sum(results)
    total = len(results)
    
    for i, (name, result) in enumerate(zip(test_names, results)):
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{i+1}. {name}: {status}")
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed!")
        return True
    else:
        print("⚠️  Some tests failed. Check the details above.")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)