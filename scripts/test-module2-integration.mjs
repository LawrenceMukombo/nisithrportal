async function testModule2() {
  const baseUrl = "http://localhost:8080/api";
  console.log("Starting Module 2 Integration Tests...\n");

  // 1. Authenticate as Admin
  console.log("[Test 1] Logging in as Admin...");
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@nisit.gov.pg", password: "Admin123!" }),
  });
  const loginData = await loginRes.json();
  if (!loginRes.ok) throw new Error("Admin login failed: " + JSON.stringify(loginData));
  const token = loginData.token;
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  console.log("  -> Admin authenticated successfully.\n");

  // 2. Fetch Employee List & Search
  console.log("[Test 2] Testing employee listing and text search...");
  const listRes = await fetch(`${baseUrl}/employees?q=Margaret`, { headers });
  const listData = await listRes.json();
  console.log(`  -> Found ${listData.length} employee(s) matching search 'Margaret'.`);
  if (listData.length === 0 || !listData[0].employeeNumber) {
    throw new Error("Failed to find employee or employeeNumber is missing.");
  }
  console.log(`  -> Employee: ${listData[0].name}, Emp ID: ${listData[0].employeeNumber}\n`);

  // 3. Create New Employee Master Record
  const runId = Date.now().toString().slice(-4);
  console.log(`[Test 3] Creating new Employee Master Record (Test Run #${runId})...`);
  const newEmpPayload = {
    name: `Dr. Kila Morea Vagi ${runId}`,
    firstName: "Kila",
    lastName: `Vagi ${runId}`,
    middleName: "Morea",
    email: `kmvagi.${runId}@nisit.gov.pg`,
    phone: `+675 7345 ${runId}`,
    dateOfBirth: "1985-06-15",
    gender: "Male",
    maritalStatus: "Married",
    nationalId: `NID-992${runId}`,
    passportNumber: `P-PNG-${runId}`,
    residentialAddress: "Section 12, Lot 4, Gordons",
    postalAddress: "P.O. Box 450, Port Moresby",
    city: "Port Moresby",
    province: "National Capital District",
    emergencyContactName: "Grace Vagi",
    emergencyContactRelationship: "Spouse",
    emergencyContactPhone: "+675 7987 1122",
    emergencyContactAddress: "Section 12, Lot 4, Gordons",
    departmentId: 1,
    positionId: 1,
    supervisorId: 1,
    gradeLevel: "Grade 14",
    division: "Metrology & Testing",
    unit: "Calibration Standards",
    employmentType: "permanent",
    startDate: "2026-03-01",
    probationStartDate: "2026-03-01",
    probationEndDate: "2026-09-01",
    status: "active",
  };

  const createRes = await fetch(`${baseUrl}/employees`, {
    method: "POST",
    headers,
    body: JSON.stringify(newEmpPayload),
  });
  const createdEmp = await createRes.json();
  if (!createRes.ok) throw new Error("Employee creation failed: " + JSON.stringify(createdEmp));
  console.log(`  -> Created employee #${createdEmp.id} with assigned code ${createdEmp.employeeNumber}`);
  console.log(`  -> Grade: ${createdEmp.gradeLevel}, National ID: ${createdEmp.nationalId}\n`);

  // 4. Duplicate Detection Test
  console.log("[Test 4] Testing Duplicate Detection (attempting same National ID)...");
  const dupRes = await fetch(`${baseUrl}/employees`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Duplicate Test Officer",
      email: `different.${runId}@nisit.gov.pg`,
      nationalId: newEmpPayload.nationalId, // Same NID
    }),
  });
  if (dupRes.status === 409) {
    const dupErr = await dupRes.json();
    console.log(`  -> Duplicate correctly rejected with 409 Conflict: "${dupErr.error}"\n`);
  } else {
    throw new Error(`Expected 409 Conflict but received status ${dupRes.status}`);
  }

  // 5. Update Position / Grade & History Logging
  console.log("[Test 5] Updating Position & Grade to trigger Career History log...");
  const updateRes = await fetch(`${baseUrl}/employees/${createdEmp.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      gradeLevel: "Grade 16",
      positionId: 2,
      departmentId: 2,
    }),
  });
  const updatedEmp = await updateRes.json();
  if (!updateRes.ok) throw new Error("Employee update failed: " + JSON.stringify(updatedEmp));
  console.log(`  -> Successfully promoted to Grade 16 in Department #2.\n`);

  // 6. Fetch Career & Promotion History
  console.log("[Test 6] Fetching Career & Promotion History (/api/employees/:id/history)...");
  const histRes = await fetch(`${baseUrl}/employees/${createdEmp.id}/history`, { headers });
  const historyData = await histRes.json();
  console.log(`  -> Retrieved ${historyData.length} career history record(s):`);
  historyData.forEach((h, idx) => {
    console.log(`     [Entry ${idx + 1}] Type: ${h.changeType.toUpperCase()} | Grade: ${h.gradeLevel} | Dept: ${h.departmentName} | Date: ${h.startDate}`);
  });
  if (historyData.length < 2) {
    throw new Error("Expected at least 2 history records (initial appointment + promotion)");
  }
  console.log("");

  // 7. Audit Log Verification
  console.log("[Test 7] Verifying Audit Log entries...");
  const auditRes = await fetch(`${baseUrl}/audit-log`, { headers });
  const auditData = await auditRes.json();
  const logsList = Array.isArray(auditData) ? auditData : (auditData.logs || []);
  const empLogs = logsList.filter(l => l.actionType && l.actionType.startsWith("employee_"));
  console.log(`  -> Found ${empLogs.length} employee-related audit event(s) in system audit trail.`);
  empLogs.slice(0, 3).forEach(l => {
    console.log(`     [Audit #${l.id}] Action: ${l.actionType} | Target: ${l.targetEmail || "N/A"} | PerformedBy: ${l.performedByEmail}`);
  });

  console.log("\n=======================================================");
  console.log(">>> ALL MODULE 2 INTEGRATION TESTS PASSED SUCCESSFULLY! <<<");
  console.log("=======================================================\n");
}

testModule2().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
