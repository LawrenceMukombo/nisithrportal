async function test() {
  const res = await fetch("http://localhost:8080/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@nisit.gov.pg", password: "Admin123!" }),
  });
  const data = await res.json();
  console.log("LOGIN TEST STATUS:", res.status);
  console.log("LOGIN TEST DATA:", data);
}

test().catch(console.error);
