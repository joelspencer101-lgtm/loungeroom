#!/usr/bin/env python3
"""
Focused test for MAX_ACTIVE_SESSIONS enforcement
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

def cleanup_all_sessions():
    """Clean up all existing sessions"""
    headers = {
        "X-Admin-Token": ADMIN_TOKEN,
        "Content-Type": "application/json"
    }
    
    payload = {"dry_run": False, "idle_minutes": 0}
    response = requests.post(f"{BASE_URL}/hb/admin/cleanup", 
                           json=payload, headers=headers, timeout=30)
    
    if response.status_code == 200:
        data = response.json()
        print(f"Cleaned up {data.get('count', 0)} sessions")
        return True
    else:
        print(f"Cleanup failed: {response.status_code} - {response.text}")
        return False

def get_active_count():
    """Get count of active sessions"""
    headers = {"X-Admin-Token": ADMIN_TOKEN}
    response = requests.get(f"{BASE_URL}/hb/admin/active", headers=headers, timeout=10)
    
    if response.status_code == 200:
        data = response.json()
        return len(data)
    return -1

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

def test_max_active():
    print("Testing MAX_ACTIVE_SESSIONS enforcement (limit=1)")
    print("=" * 50)
    
    # Step 1: Clean up all sessions
    print("1. Cleaning up all existing sessions...")
    cleanup_all_sessions()
    time.sleep(2)
    
    active_count = get_active_count()
    print(f"   Active sessions after cleanup: {active_count}")
    
    # Step 2: Create first session (should succeed)
    print("\n2. Creating first session...")
    response1 = create_session()
    print(f"   Status: {response1.status_code}")
    
    if response1.status_code == 200:
        data1 = response1.json()
        session1_uuid = data1.get("session_uuid")
        print(f"   ✅ First session created: {session1_uuid}")
        
        # Step 3: Immediately try second session (should fail)
        print("\n3. Creating second session (should fail with 429)...")
        response2 = create_session()
        print(f"   Status: {response2.status_code}")
        
        if response2.status_code == 429:
            error_data = response2.json()
            detail = error_data.get("detail", "")
            print(f"   Response: {detail}")
            
            if "Max active sessions reached (1)" in detail:
                print("   ✅ MAX_ACTIVE enforcement working correctly!")
                
                # Step 4: Use admin to terminate the first session
                print("\n4. Using admin to terminate first session...")
                admin_headers = {"X-Admin-Token": ADMIN_TOKEN}
                delete_response = requests.delete(f"{BASE_URL}/hb/admin/sessions/{session1_uuid}", 
                                                headers=admin_headers, timeout=30)
                
                print(f"   Admin delete status: {delete_response.status_code}")
                if delete_response.status_code == 200:
                    delete_data = delete_response.json()
                    print(f"   ✅ Session terminated: {delete_data}")
                    
                    # Step 5: Wait and try creating session again
                    print("\n5. Waiting and trying to create session again...")
                    time.sleep(2)
                    
                    response3 = create_session()
                    print(f"   Status: {response3.status_code}")
                    
                    if response3.status_code == 200:
                        data3 = response3.json()
                        session3_uuid = data3.get("session_uuid")
                        print(f"   ✅ New session created after cleanup: {session3_uuid}")
                        
                        # Clean up the final session
                        cleanup_all_sessions()
                        
                        return True
                    else:
                        print(f"   ❌ Failed to create session after cleanup: {response3.text}")
                        return False
                else:
                    print(f"   ❌ Admin delete failed: {delete_response.text}")
                    return False
            else:
                print(f"   ❌ Wrong error message: {detail}")
                return False
        else:
            print(f"   ❌ Expected 429, got {response2.status_code}: {response2.text}")
            return False
    else:
        print(f"   ❌ First session creation failed: {response1.status_code}: {response1.text}")
        return False

if __name__ == "__main__":
    success = test_max_active()
    if success:
        print("\n🎉 MAX_ACTIVE test PASSED!")
    else:
        print("\n❌ MAX_ACTIVE test FAILED!")
    exit(0 if success else 1)