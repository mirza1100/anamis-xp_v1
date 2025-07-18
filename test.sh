#!/bin/bash

# Anamis-XP VPN Panel Test Script
# اسکریپت تست پنل VPN آنامیس-ایکس‌پی

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                Anamis-XP VPN Panel Test                      ║"
echo "║                   تست پنل VPN آنامیس                        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run test
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo -e "${YELLOW}Running test: $test_name${NC}"
    
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS: $test_name${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ FAIL: $test_name${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

echo -e "${BLUE}Testing Project Structure...${NC}"
echo ""

# Test 1: Check if install.sh exists and is executable
run_test "Install script exists and is executable" "[ -f './install.sh' ] && [ -x './install.sh' ]"

# Test 2: Check if CLI script exists and is executable
run_test "CLI script exists and is executable" "[ -f './cli/anamis-xp' ] && [ -x './cli/anamis-xp' ]"

# Test 3: Check if web server exists
run_test "Web server exists" "[ -f './web/server.js' ]"

# Test 4: Check if package.json exists
run_test "Package.json exists" "[ -f './web/package.json' ]"

# Test 5: Check if HTML file exists
run_test "HTML file exists" "[ -f './web/public/index.html' ]"

# Test 6: Check if CSS file exists
run_test "CSS file exists" "[ -f './web/public/styles.css' ]"

# Test 7: Check if JavaScript file exists
run_test "JavaScript file exists" "[ -f './web/public/app.js' ]"

# Test 8: Check if Xray config exists
run_test "Xray config exists" "[ -f './cores/xray/config.json' ]"

# Test 9: Check if OpenVPN config exists
run_test "OpenVPN config exists" "[ -f './cores/openvpn/server.conf' ]"

# Test 10: Check if tunnel configs exist
run_test "Gaming tunnel config exists" "[ -f './cores/tunnels/gaming-tunnel.conf' ]"
run_test "Standard tunnel config exists" "[ -f './cores/tunnels/standard-tunnel.conf' ]"

# Test 11: Check if documentation exists
run_test "README exists" "[ -f './README.md' ]"
run_test "Installation guide exists" "[ -f './docs/INSTALLATION.md' ]"
run_test "Changelog exists" "[ -f './CHANGELOG.md' ]"
run_test "License exists" "[ -f './LICENSE' ]"

# Test 12: Check if .gitignore exists
run_test ".gitignore exists" "[ -f './.gitignore' ]"

echo ""
echo -e "${BLUE}Testing File Content...${NC}"
echo ""

# Test 13: Check if install.sh has proper shebang
run_test "Install script has proper shebang" "head -1 './install.sh' | grep -q '#!/bin/bash'"

# Test 14: Check if CLI script has proper shebang
run_test "CLI script has proper shebang" "head -1 './cli/anamis-xp' | grep -q '#!/bin/bash'"

# Test 15: Check if package.json is valid JSON
run_test "Package.json is valid JSON" "python3 -m json.tool './web/package.json' > /dev/null"

# Test 16: Check if Xray config is valid JSON
run_test "Xray config is valid JSON" "python3 -m json.tool './cores/xray/config.json' > /dev/null"

# Test 17: Check if HTML contains required elements
run_test "HTML contains login form" "grep -q 'loginForm' './web/public/index.html'"
run_test "HTML contains dashboard" "grep -q 'dashboardPage' './web/public/index.html'"

# Test 18: Check if CSS contains required styles
run_test "CSS contains login styles" "grep -q 'login-container' './web/public/styles.css'"
run_test "CSS contains theme variables" "grep -q 'data-theme' './web/public/styles.css'"

# Test 19: Check if JavaScript contains required functions
run_test "JavaScript contains login function" "grep -q 'handleLogin' './web/public/app.js'"
run_test "JavaScript contains translations" "grep -q 'translations' './web/public/app.js'"

# Test 20: Check if server.js contains required endpoints
run_test "Server contains login endpoint" "grep -q '/api/login' './web/server.js'"
run_test "Server contains dashboard endpoint" "grep -q '/api/dashboard' './web/server.js'"

echo ""
echo -e "${BLUE}Testing Dependencies...${NC}"
echo ""

# Test 21: Check if required npm packages are listed
run_test "Express is in dependencies" "grep -q 'express' './web/package.json'"
run_test "CORS is in dependencies" "grep -q 'cors' './web/package.json'"
run_test "JWT is in dependencies" "grep -q 'jsonwebtoken' './web/package.json'"

echo ""
echo -e "${BLUE}Testing Configuration...${NC}"
echo ""

# Test 22: Check if config structure is correct
run_test "Config has panel section" "grep -q 'panel' './web/server.js'"
run_test "Config has VPN section" "grep -q 'vpn' './web/server.js'"

echo ""
echo -e "${BLUE}Test Results Summary${NC}"
echo "═══════════════════════════════════════════════════════════════"
echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
echo -e "${BLUE}Total Tests: $TOTAL_TESTS${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 All tests passed! The project structure is correct.${NC}"
    echo -e "${GREEN}🎉 تمام تست‌ها موفق بودند! ساختار پروژه صحیح است.${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}❌ Some tests failed. Please check the project structure.${NC}"
    echo -e "${RED}❌ برخی تست‌ها ناموفق بودند. لطفاً ساختار پروژه را بررسی کنید.${NC}"
    exit 1
fi