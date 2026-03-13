fetch("http://localhost:3000/api/testDb").then(r => r.json()).then(d => console.log(JSON.stringify(d, null, 2))).catch(e => console.error(e));
