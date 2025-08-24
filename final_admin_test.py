#!/usr/bin/env python3
"""
Final comprehensive admin test with better error handling
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

def cleanup_all():
    """Clean up all sessions"""
    headers = {
        "X-Admin-Token": ADMIN_TOKEN,
        "Content-Type": "application/json"
    }
    
    # Force cleanup with max_active=0
    payload = {"dry_run": False, "idle_minutes": 0, "max_active": 0}
    response = requests.post(f"{BASE_URL}/hb/admin/cleanup", 
                           json=payload, headers=headers, timeout=30)
    
    if response.status_code == 200:
        data = response.json()
        print(f"   Cleaned up {data.get('count', 0)} sessions")
        return True
    return False

def get_active_sessions():
    """Get list of active sessions"""
    headers = {"X-Admin-Token": ADMIN_TOKEN}
    response = requests.get(f"{BASE_URL}/hb/admin/active", headers=headers, timeout=10)
    
    if response.status_code == 200:
        return response.json()
    return []

def create_session():
    """Create a session"""
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
    return response

def main():
    print("Final Admin Backend API Tests")
    print("=" * 50)
    
    results = []
    
    # Test 1: GET /api/hb/admin/active
    print("\n1. Testing GET /api/hb/admin/active")
    headers = {"X-Admin-Token": ADMIN_TOKEN}
    response = requests.get(f"{BASE_URL}/hb/admin/active", headers=headers, timeout=10)
    
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ PASS: Returns list with {len(data)} sessions")
        results.append(True)
    else:
        print(f"   ❌ FAIL: Status {response.status_code}")
        results.append(False)
    
    # Test 2: Admin auth required
    print("\n2. Testing admin authentication")
    response = requests.get(f"{BASE_URL}/hb/admin/active", timeout=10)
    
    if response.status_code == 401:
        print("   ✅ PASS: Returns 401 without X-Admin-Token")
        results.append(True)
    else:
        print(f"   ❌ FAIL: Expected 401, got {response.status_code}")
        results.append(False)
    
    # Test 3: Cleanup dry run
    print("\n3. Testing POST /api/hb/admin/cleanup (dry_run=true)")
    headers = {
        "X-Admin-Token": ADMIN_TOKEN,
        "Content-Type": "application/json"
    }
    payload = {"dry_run": True}
    response = requests.post(f"{BASE_URL}/hb/admin/cleanup", 
                           json=payload, headers=headers, timeout=10)
    
    if response.status_code == 200:
        data = response.json()
        if "dry_run" in data and data["dry_run"] is True:
            print(f"   ✅ PASS: Dry run would terminate {len(data.get('would_terminate', []))} sessions")
            results.append(True)
        else:
            print("   ❌ FAIL: Invalid dry run response")
            results.append(False)
    else:
        print(f"   ❌ FAIL: Status {response.status_code}")
        results.append(False)
    
    # Test 4: Admin terminate session
    print("\n4. Testing DELETE /api/hb/admin/sessions/{uuid}")
    
    # Clean up first
    cleanup_all()
    time.sleep(2)
    
    # Create session
    session_response = create_session()
    if session_response.status_code == 200:
        session_data = session_response.json()
        session_uuid = session_data.get("session_uuid")
        print(f"   Created session: {session_uuid}")
        
        # Terminate it
        admin_headers = {"X-Admin-Token": ADMIN_TOKEN}
        delete_response = requests.delete(f"{BASE_URL}/hb/admin/sessions/{session_uuid}", 
                                        headers=admin_headers, timeout=30)
        
        if delete_response.status_code == 200:
            delete_data = delete_response.json()
            if delete_data.get("session_uuid") == session_uuid:
                print("   ✅ PASS: Admin session termination successful")
                results.append(True)
            else:
                print("   ❌ FAIL: UUID mismatch in response")
                results.append(False)
        else:
            print(f"   ❌ FAIL: Delete status {delete_response.status_code}")
            results.append(False)
    else:
        print(f"   ❌ FAIL: Could not create session: {session_response.status_code}")
        results.append(False)
    
    # Test 5: MAX_ACTIVE enforcement
    print("\n5. Testing MAX_ACTIVE_SESSIONS enforcement")
    
    # Clean up completely
    cleanup_all()
    time.sleep(3)
    
    # Verify no active sessions
    active_sessions = get_active_sessions()
    print(f"   Active sessions after cleanup: {len(active_sessions)}")
    
    # Create first session
    response1 = create_session()
    if response1.status_code == 200:
        session1_data = response1.json()
        session1_uuid = session1_data.get("session_uuid")
        print(f"   First session created: {session1_uuid}")
        
        # Try second session immediately
        response2 = create_session()
        if response2.status_code == 429:
            error_data = response2.json()
            detail = error_data.get("detail", "")
            if "Max active sessions reached (1)" in detail:
                print("   ✅ PASS: MAX_ACTIVE enforcement working")
                results.append(True)
            else:
                print(f"   ❌ FAIL: Wrong error message: {detail}")
                results.append(False)
        else:
            print(f"   ❌ FAIL: Expected 429, got {response2.status_code}")
            results.append(False)
    else:
        print(f"   ❌ FAIL: First session creation failed: {response1.status_code}")
        results.append(False)
    
    # Test 6: Cleanup actual
    print("\n6. Testing POST /api/hb/admin/cleanup (dry_run=false)")
    
    # Ensure we have a session to clean up
    cleanup_all()
    time.sleep(1)
    
    session_response = create_session()
    if session_response.status_code == 200:
        session_data = session_response.json()
        session_uuid = session_data.get("session_uuid")
        print(f"   Created session to cleanup: {session_uuid}")
        
        time.sleep(1)
        
        # Clean it up
        cleanup_payload = {"dry_run": False, "idle_minutes": 0}
        cleanup_response = requests.post(f"{BASE_URL}/hb/admin/cleanup", 
                                       json=cleanup_payload, headers=headers, timeout=10)
        
        if cleanup_response.status_code == 200:
            cleanup_data = cleanup_response.json()
            if "terminated" in cleanup_data and "count" in cleanup_data:
                print(f"   ✅ PASS: Cleanup terminated {cleanup_data['count']} sessions")
                results.append(True)
            else:
                print("   ❌ FAIL: Invalid cleanup response format")
                results.append(False)
        else:
            print(f"   ❌ FAIL: Cleanup status {cleanup_response.status_code}")
            results.append(False)
    else:
        print(f"   ❌ FAIL: Could not create session for cleanup: {session_response.status_code}")
        results.append(False)
    
    # Final cleanup
    cleanup_all()
    
    # Summary
    print("\n" + "=" * 50)
    print("FINAL ADMIN TEST SUMMARY")
    print("=" * 50)
    
    test_names = [
        "GET /api/hb/admin/active",
        "Admin auth required", 
        "Cleanup dry run",
        "Admin terminate session",
        "MAX_ACTIVE enforcement",
        "Cleanup actual"
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