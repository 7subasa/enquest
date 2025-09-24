// 管理者ユーザー作成スクリプト
const adminUser = {
  email: "admin@example.com",
  password: "admin123",
  name: "管理者",
  department: "管理部",
  role: "admin"
};

fetch('http://localhost:8000/api/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(adminUser)
})
.then(response => response.json())
.then(data => {
  console.log('Admin user created:', data);
  console.log('Login with: admin@example.com / admin123');
})
.catch(error => console.error('Error:', error));