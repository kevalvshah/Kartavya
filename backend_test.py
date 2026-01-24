#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

class TaskFlowAPITester:
    def __init__(self, base_url: str = "https://taskflow-3029.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.session_token = "test_session_1769285107423"  # From seeded session
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test data storage
        self.created_category_id = None
        self.created_task_id = None

    def log_result(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name}")
        else:
            print(f"❌ {test_name} - {details}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "response_data": response_data
        })

    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                    expected_status: int = 200, use_auth: bool = True) -> tuple[bool, Any]:
        """Make API request and return success status and response data"""
        url = f"{self.api_url}/{endpoint.lstrip('/')}"
        headers = {'Content-Type': 'application/json'}
        
        if use_auth:
            headers['Authorization'] = f'Bearer {self.session_token}'

        try:
            if method.upper() == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method.upper() == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method.upper() == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method.upper() == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, timeout=30)
            elif method.upper() == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                return False, f"Unsupported method: {method}"

            success = response.status_code == expected_status
            try:
                response_data = response.json() if response.content else {}
            except:
                response_data = {"raw_response": response.text}
                
            if not success:
                print(f"   Status: {response.status_code}, Expected: {expected_status}")
                if response.content:
                    print(f"   Response: {response.text[:200]}")
                    
            return success, response_data

        except Exception as e:
            return False, f"Request failed: {str(e)}"

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n🔐 Testing Authentication...")
        
        # Test /auth/me with valid token
        success, data = self.make_request('GET', '/auth/me')
        self.log_result("GET /auth/me (authenticated)", success, 
                       "" if success else str(data), data)
        
        # Test /auth/me without token (should fail)
        success, data = self.make_request('GET', '/auth/me', use_auth=False, expected_status=401)
        self.log_result("GET /auth/me (unauthenticated)", success,
                       "" if success else "Should return 401", data)

    def test_dashboard_endpoints(self):
        """Test dashboard endpoints"""
        print("\n📊 Testing Dashboard...")
        
        success, data = self.make_request('GET', '/dashboard/summary')
        self.log_result("GET /dashboard/summary", success,
                       "" if success else str(data), data)
        
        if success and data:
            required_fields = ['todo', 'in_progress', 'done', 'overdue', 'due_24h']
            has_all_fields = all(field in data for field in required_fields)
            self.log_result("Dashboard summary has required fields", has_all_fields,
                           f"Missing fields: {[f for f in required_fields if f not in data]}")

    def test_categories_crud(self):
        """Test categories CRUD operations"""
        print("\n📁 Testing Categories CRUD...")
        
        # List categories (empty initially)
        success, data = self.make_request('GET', '/categories')
        self.log_result("GET /categories", success, "" if success else str(data), data)
        
        # Create category
        category_data = {
            "name": "Test Category",
            "color": "#FF5733"
        }
        success, data = self.make_request('POST', '/categories', category_data, expected_status=200)
        self.log_result("POST /categories", success, "" if success else str(data), data)
        
        if success and data:
            self.created_category_id = data.get('category_id')
            print(f"   Created category ID: {self.created_category_id}")
        
        # List categories again (should have 1)
        success, data = self.make_request('GET', '/categories')
        if success:
            category_count = len(data) if isinstance(data, list) else 0
            self.log_result("Categories list after creation", category_count > 0,
                           f"Expected >0 categories, got {category_count}")
        
        # Update category (if we have one)
        if self.created_category_id:
            update_data = {"name": "Updated Test Category", "color": "#33FF57"}
            success, data = self.make_request('PUT', f'/categories/{self.created_category_id}', 
                                            update_data)
            self.log_result("PUT /categories/{id}", success, "" if success else str(data))

    def test_tasks_crud(self):
        """Test tasks CRUD operations"""
        print("\n📝 Testing Tasks CRUD...")
        
        # List tasks (empty initially)
        success, data = self.make_request('GET', '/tasks')
        self.log_result("GET /tasks", success, "" if success else str(data), data)
        
        # Create task with comprehensive data
        due_date = (datetime.now() + timedelta(days=1)).isoformat()
        reminder_date = (datetime.now() + timedelta(hours=2)).isoformat()
        
        task_data = {
            "title": "Test Task",
            "description": "This is a test task with all fields",
            "status": "todo",
            "priority": "high",
            "category_id": self.created_category_id,
            "tags": ["test", "automation"],
            "due_at": due_date,
            "reminder_at": reminder_date,
            "estimated_minutes": 60,
            "recurrence": {"rule": "weekly", "interval": 1},
            "attachments": [{"name": "Test Doc", "url": "https://example.com/doc.pdf"}],
            "custom_fields": {"project": "testing", "priority_score": 8},
            "subtasks": [
                {"title": "Subtask 1", "is_done": False},
                {"title": "Subtask 2", "is_done": True}
            ]
        }
        
        success, data = self.make_request('POST', '/tasks', task_data, expected_status=200)
        self.log_result("POST /tasks (comprehensive)", success, "" if success else str(data), data)
        
        if success and data:
            self.created_task_id = data.get('task_id')
            print(f"   Created task ID: {self.created_task_id}")
        
        # Get specific task
        if self.created_task_id:
            success, data = self.make_request('GET', f'/tasks/{self.created_task_id}')
            self.log_result("GET /tasks/{id}", success, "" if success else str(data))
        
        # Update task
        if self.created_task_id:
            update_data = {
                "title": "Updated Test Task",
                "status": "in_progress",
                "priority": "urgent"
            }
            success, data = self.make_request('PUT', f'/tasks/{self.created_task_id}', update_data)
            self.log_result("PUT /tasks/{id}", success, "" if success else str(data))
        
        # Toggle task completion
        if self.created_task_id:
            success, data = self.make_request('PATCH', f'/tasks/{self.created_task_id}/toggle')
            self.log_result("PATCH /tasks/{id}/toggle", success, "" if success else str(data))
        
        # Move task (drag & drop simulation)
        if self.created_task_id:
            move_data = {"status": "done", "order": 0}
            success, data = self.make_request('PATCH', f'/tasks/{self.created_task_id}/move', move_data)
            self.log_result("PATCH /tasks/{id}/move", success, "" if success else str(data))

    def test_task_filtering(self):
        """Test task filtering options"""
        print("\n🔍 Testing Task Filtering...")
        
        # Test status filter
        success, data = self.make_request('GET', '/tasks?status=todo')
        self.log_result("GET /tasks?status=todo", success, "" if success else str(data))
        
        # Test category filter
        if self.created_category_id:
            success, data = self.make_request('GET', f'/tasks?category_id={self.created_category_id}')
            self.log_result("GET /tasks?category_id={id}", success, "" if success else str(data))
        
        # Test search filter
        success, data = self.make_request('GET', '/tasks?q=Test')
        self.log_result("GET /tasks?q=Test", success, "" if success else str(data))
        
        # Test due date filters
        success, data = self.make_request('GET', '/tasks?due=overdue')
        self.log_result("GET /tasks?due=overdue", success, "" if success else str(data))

    def cleanup_test_data(self):
        """Clean up created test data"""
        print("\n🧹 Cleaning up test data...")
        
        # Delete task
        if self.created_task_id:
            success, data = self.make_request('DELETE', f'/tasks/{self.created_task_id}')
            self.log_result("DELETE /tasks/{id}", success, "" if success else str(data))
        
        # Delete category
        if self.created_category_id:
            success, data = self.make_request('DELETE', f'/categories/{self.created_category_id}')
            self.log_result("DELETE /categories/{id}", success, "" if success else str(data))

    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting TaskFlow Backend API Tests")
        print(f"Base URL: {self.base_url}")
        print(f"Session Token: {self.session_token}")
        
        try:
            self.test_auth_endpoints()
            self.test_dashboard_endpoints()
            self.test_categories_crud()
            self.test_tasks_crud()
            self.test_task_filtering()
            self.cleanup_test_data()
            
        except Exception as e:
            print(f"\n💥 Test suite failed with error: {str(e)}")
            return False
        
        # Print summary
        print(f"\n📊 Test Results Summary:")
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        # Print failed tests
        failed_tests = [r for r in self.test_results if not r['success']]
        if failed_tests:
            print(f"\n❌ Failed Tests ({len(failed_tests)}):")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['details']}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = TaskFlowAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())