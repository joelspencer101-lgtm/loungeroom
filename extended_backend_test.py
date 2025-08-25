#!/usr/bin/env python3
"""
Extended Backend API Tests for Coffee Table (Hyperbeam Proxy)
Tests multiple sessions and rooms functionality with the new API key.
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

print(f"Testing backend API at: {BASE_URL}")
print("=" * 60)

def create_session(session_name="Test Session"):
    """Helper function to create a session"""
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
            return data["session_uuid"], data["embed_url"]
        else:
            print(f"   Session creation failed: {response.status_code} - {response.text}")
            return None, None
            
    except Exception as e:
        print(f"   Exception creating session: {str(e)}")
        return None, None

def test_multiple_sessions():
    """Test creating multiple sessions to verify the 2-session limit"""
    print("\n🔍 Testing Multiple Session Creation (2-session limit verification)")
    
    sessions = []
    
    for i in range(3):  # Try to create 3 sessions to test the limit
        print(f"\n   Creating Session {i+1}...")
        session_uuid, embed_url = create_session(f"Session {i+1}")
        
        if session_uuid and embed_url:
            sessions.append((session_uuid, embed_url))
            print(f"   ✅ Session {i+1} created successfully: {session_uuid}")
            print(f"      Embed URL: {embed_url[:50]}...")
        else:
            print(f"   ❌ Session {i+1} creation failed")
            break
    
    print(f"\n   📊 Successfully created {len(sessions)} sessions")
    
    # Test if all sessions are still accessible
    print("\n   🔍 Verifying all sessions are accessible...")
    active_sessions = 0
    for i, (session_uuid, embed_url) in enumerate(sessions):
        try:
            response = requests.get(f"{BASE_URL}/hb/sessions/{session_uuid}", timeout=10)
            if response.status_code == 200:
                active_sessions += 1
                print(f"   ✅ Session {i+1} is active and accessible")
            else:
                print(f"   ❌ Session {i+1} is not accessible: {response.status_code}")
        except Exception as e:
            print(f"   ❌ Error checking Session {i+1}: {str(e)}")
    
    print(f"\n   📊 {active_sessions}/{len(sessions)} sessions are currently active")
    
    # Clean up sessions
    print("\n   🧹 Cleaning up sessions...")
    headers = {"Authorization": f"Bearer {API_KEY}"}
    for i, (session_uuid, _) in enumerate(sessions):
        try:
            response = requests.delete(f"{BASE_URL}/hb/sessions/{session_uuid}", 
                                     headers=headers, timeout=30)
            if response.status_code == 200:
                print(f"   ✅ Session {i+1} terminated successfully")
            else:
                print(f"   ⚠️  Session {i+1} termination returned: {response.status_code}")
        except Exception as e:
            print(f"   ❌ Error terminating Session {i+1}: {str(e)}")
    
    return len(sessions), active_sessions

def test_rooms_functionality():
    """Test rooms creation and retrieval"""
    print("\n🔍 Testing Rooms Functionality")
    
    # First create a session
    print("\n   Step 1: Creating a session for room testing...")
    session_uuid, embed_url = create_session("Room Test Session")
    
    if not session_uuid:
        print("   ❌ Cannot test rooms - session creation failed")
        return False
    
    print(f"   ✅ Session created: {session_uuid}")
    
    # Create a room
    print("\n   Step 2: Creating a room...")
    room_payload = {
        "session_uuid": session_uuid,
        "label": "Test Room"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/hb/rooms", 
                               json=room_payload, 
                               timeout=10)
        
        print(f"   Room creation status: {response.status_code}")
        
        if response.status_code == 200:
            room_data = response.json()
            room_code = room_data["code"]
            print(f"   ✅ Room created successfully: {room_code}")
            print(f"   Room data: {json.dumps(room_data, indent=4)}")
            
            # Test room retrieval
            print(f"\n   Step 3: Retrieving room by code: {room_code}")
            response = requests.get(f"{BASE_URL}/hb/rooms/{room_code}", timeout=10)
            
            if response.status_code == 200:
                session_data = response.json()
                print(f"   ✅ Room retrieval successful")
                print(f"   Session data: {json.dumps(session_data, indent=4)}")
                
                # Verify the session_uuid matches
                if session_data.get("session_uuid") == session_uuid:
                    print("   ✅ Session UUID matches - room linking works correctly")
                    room_success = True
                else:
                    print("   ❌ Session UUID mismatch in room retrieval")
                    room_success = False
            else:
                print(f"   ❌ Room retrieval failed: {response.status_code} - {response.text}")
                room_success = False
        else:
            print(f"   ❌ Room creation failed: {response.status_code} - {response.text}")
            room_success = False
            
    except Exception as e:
        print(f"   ❌ Exception in room testing: {str(e)}")
        room_success = False
    
    # Clean up
    print("\n   🧹 Cleaning up session...")
    headers = {"Authorization": f"Bearer {API_KEY}"}
    try:
        response = requests.delete(f"{BASE_URL}/hb/sessions/{session_uuid}", 
                                 headers=headers, timeout=30)
        if response.status_code == 200:
            print("   ✅ Session cleaned up successfully")
        else:
            print(f"   ⚠️  Session cleanup returned: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Error cleaning up session: {str(e)}")
    
    return room_success

def test_session_longevity():
    """Test if sessions stay active (no time limit claim)"""
    print("\n🔍 Testing Session Longevity (No Time Limit)")
    
    print("\n   Creating a session for longevity testing...")
    session_uuid, embed_url = create_session("Longevity Test")
    
    if not session_uuid:
        print("   ❌ Cannot test longevity - session creation failed")
        return False
    
    print(f"   ✅ Session created: {session_uuid}")
    
    # Check session immediately
    print("\n   Checking session immediately after creation...")
    response = requests.get(f"{BASE_URL}/hb/sessions/{session_uuid}", timeout=10)
    if response.status_code == 200:
        print("   ✅ Session is active immediately after creation")
    else:
        print(f"   ❌ Session check failed: {response.status_code}")
        return False
    
    # Wait a bit and check again
    print("\n   Waiting 10 seconds and checking again...")
    time.sleep(10)
    
    response = requests.get(f"{BASE_URL}/hb/sessions/{session_uuid}", timeout=10)
    if response.status_code == 200:
        print("   ✅ Session is still active after 10 seconds")
        longevity_success = True
    else:
        print(f"   ❌ Session became inactive: {response.status_code}")
        longevity_success = False
    
    # Clean up
    print("\n   🧹 Cleaning up session...")
    headers = {"Authorization": f"Bearer {API_KEY}"}
    try:
        response = requests.delete(f"{BASE_URL}/hb/sessions/{session_uuid}", 
                                 headers=headers, timeout=30)
        if response.status_code == 200:
            print("   ✅ Session cleaned up successfully")
        else:
            print(f"   ⚠️  Session cleanup returned: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Error cleaning up session: {str(e)}")
    
    return longevity_success

def main():
    """Run extended tests"""
    print("Starting Extended Backend API Tests for Coffee Table")
    print(f"Base URL: {BASE_URL}")
    print(f"Using API Key: {API_KEY[:20]}...")
    
    results = []
    
    # Test 1: Multiple sessions
    print("\n" + "=" * 60)
    sessions_created, sessions_active = test_multiple_sessions()
    results.append(("Multiple Sessions", sessions_created >= 2 and sessions_active >= 2))
    
    # Test 2: Rooms functionality
    print("\n" + "=" * 60)
    rooms_success = test_rooms_functionality()
    results.append(("Rooms Functionality", rooms_success))
    
    # Test 3: Session longevity
    print("\n" + "=" * 60)
    longevity_success = test_session_longevity()
    results.append(("Session Longevity", longevity_success))
    
    # Summary
    print("\n" + "=" * 60)
    print("EXTENDED TEST SUMMARY")
    print("=" * 60)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"• {test_name}: {status}")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    print(f"\nOverall: {passed}/{total} extended tests passed")
    
    if passed == total:
        print("🎉 All extended tests passed!")
        print("\n📋 KEY FINDINGS:")
        print("   • API key is fully functional")
        print("   • Multiple sessions can be created successfully")
        print("   • Rooms functionality is working")
        print("   • Sessions remain active (no immediate timeout)")
        print("   • Backend integration is working correctly")
        return True
    else:
        print("⚠️  Some extended tests failed. Check the details above.")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)