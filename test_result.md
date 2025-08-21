#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

## user_problem_statement: Build Coffee Table, a shared virtual browser (Hyperbeam) with mobile-first UI. Backend FastAPI proxies Hyperbeam under /api, React uses REACT_APP_BACKEND_URL, Mongo via MONGO_URL. MVP: create/terminate session, embed view, basic customization.

## backend:
  - task: "HB proxy endpoints (/api/hb)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      -working: true
      -agent: "main"
      -comment: "Implemented POST /api/hb/sessions, GET /api/hb/sessions/{uuid}, DELETE /api/hb/sessions/{uuid}, health. Uses UUIDs, ISO dates, MONGO_URL, no hardcoded URLs."
      -working: true
      -agent: "testing"
      -comment: "All 7 backend API tests passed successfully. Health check returns correct format, session creation/retrieval/termination work properly with real Hyperbeam API, proper 410 response for terminated sessions, and correct 422 error handling for missing authorization. Backend is fully functional."
  - task: "HB rooms endpoints (/api/hb/rooms)"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      -working: true
      -agent: "main"
      -comment: "Added POST /api/hb/rooms (create share code) and GET /api/hb/rooms/{code} (resolve to session)."
      -working: "NA"
      -agent: "testing"
      -comment: "Cannot test rooms endpoints due to Hyperbeam API VM limit exceeded error. Session creation fails with 'err_exceeded_vm_limit' preventing room creation/join testing. Backend code appears correct but requires valid Hyperbeam plan to test."
  - task: "Status routes baseline"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "low"
    needs_retesting: false
    status_history:
      -working: true
      -agent: "main"
      -comment: "Hello world and status_checks maintained."

## frontend:
  - task: "MVP UI: API key, create/terminate, embed iframe, customization"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/App.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      -working: true
      -agent: "main"
      -comment: "Uses REACT_APP_BACKEND_URL + '/api', sleek UI, fullscreen, looping video background when inactive. Ready for automated frontend testing."
      -working: false
      -agent: "testing"
      -comment: "Comprehensive UI testing earlier found a terminate bug. Bug fixed; re-run requested."
      -working: true
      -agent: "main"
      -comment: "Fixed terminate flow (always clear local session in finally). Added share rooms and chat head overlay."
      -working: false
      -agent: "testing"
      -comment: "Session creation blocked due to Hyperbeam VM limit."
      -working: "NA"
      -agent: "main"
      -comment: "Added Mock Mode that simulates sessions/rooms locally. Ready to re-test end-to-end UI flows without Hyperbeam."
  - task: "Mock Mode flows (create/share/join/terminate)"
    implemented: true
    working: true
    file: "/app/frontend/src/App.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      -working: true
      -agent: "main"
      -comment: "Implemented Mock Mode with data URL browser, local room codes in localStorage, banner/labels, and disabled key input while mock is enabled."
      -working: true
      -agent: "testing"
      -comment: "COMPREHENSIVE TESTING COMPLETED: All Mock Mode flows work perfectly. ✅ Mock Mode toggle and banner ✅ Session creation with iframe and MOCK label ✅ Share code creation and capture (e.g., ZCSOF9) ✅ Session termination and rejoin flows ✅ Chat head positioning and draggable setup ✅ API key input disabled/enabled correctly ✅ All UI interactions function as expected. Mock Mode provides excellent fallback for testing without Hyperbeam API limits."
  - task: "Hyperbeam SDK + Browser Volume (fallback-safe)"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/App.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      -working: true
      -agent: "main"
      -comment: "Integrated @hyperbeam/web; live browser volume; auto fallback to iframe with badge; proper cleanup on terminate/switch."
  - task: "Styling"
    implemented: true
    working: true
    file: "/app/frontend/src/App.css"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      -working: true
      -agent: "main"
      -comment: "Advanced CSS for mobile/tablet."

## metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 0
  run_ui: false

## test_plan:
  current_focus:
    - "Hyperbeam API plan upgrade needed - VM limit exceeded"
  stuck_tasks:
    - "MVP UI: API key, create/terminate, embed iframe, customization"
  test_all: false
  test_priority: "high_first"

## agent_communication:
  -agent: "main"
  -message: "Please validate POST/GET/DELETE for /api/hb with Authorization Bearer using a real Hyperbeam key provided by user. Ensure 200 response for create and proper error handling."
  -agent: "testing"
  -message: "Backend testing completed successfully. All 7 HB proxy endpoint tests passed: health check, session creation with real Hyperbeam API, session retrieval, proper termination, 410 response for terminated sessions, and correct 422 error handling for missing auth. Backend is fully functional and ready for production."
  -agent: "testing"
  -message: "Frontend UI testing completed. CRITICAL ISSUE FOUND: Terminate session flow is broken - after clicking terminate and confirming, the session state is not properly cleared. The UI still shows 'Session Active' alert and 'Terminate' button instead of returning to 'Create Session' state. All other functionality works: app loading, form interactions, session creation with iframe, customization features. This is a high-priority bug that needs immediate fix."
  -agent: "testing"
  -message: "COMPREHENSIVE TESTING COMPLETED: Session creation fails with Hyperbeam 'err_exceeded_vm_limit' error, blocking all session-dependent testing. UI components work perfectly: ✅ App loads with correct header ✅ Chat head overlay present and draggable ✅ Join by code UI functional ✅ Form interactions work ✅ Customization features work. BLOCKER: Hyperbeam API plan needs upgrade to test core session functionality (create/terminate/share/join flows)."
