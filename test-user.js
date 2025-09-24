// テストユーザー作成スクリプト
const testUser = {
  email: "test@example.com",
  password: "password123",
  name: "テストユーザー",
  department: "ITCS",
  role: "participant"
};

fetch('http://localhost:8000/api/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(testUser)
})
.then(response => response.json())
.then(data => console.log('Success:', data))
.catch(error => console.error('Error:', error));