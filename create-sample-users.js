// サンプルユーザー10人作成スクリプト
const sampleUsers = [
  { name: "田中太郎", email: "tanaka@example.com", department: "開発部" },
  { name: "佐藤花子", email: "sato@example.com", department: "営業部" },
  { name: "山田次郎", email: "yamada@example.com", department: "企画部" },
  { name: "鈴木三郎", email: "suzuki@example.com", department: "総務部" },
  { name: "高橋美咲", email: "takahashi@example.com", department: "人事部" },
  { name: "伊藤健一", email: "ito@example.com", department: "開発部" },
  { name: "渡辺由美", email: "watanabe@example.com", department: "営業部" },
  { name: "中村大輔", email: "nakamura@example.com", department: "企画部" },
  { name: "小林麻衣", email: "kobayashi@example.com", department: "総務部" },
  { name: "加藤雄介", email: "kato@example.com", department: "人事部" }
];

async function createUsers() {
  console.log('サンプルユーザー10人を作成中...');
  
  for (let i = 0; i < sampleUsers.length; i++) {
    const user = sampleUsers[i];
    const userData = {
      ...user,
      password: "password123",
      role: "participant"
    };
    
    try {
      const response = await fetch('http://localhost:8000/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ ${user.name} (${user.department}) - シェアコード: ${result.shortCode}`);
      } else {
        console.log(`❌ ${user.name} - 作成失敗`);
      }
    } catch (error) {
      console.log(`❌ ${user.name} - エラー: ${error.message}`);
    }
    
    // 少し待機してサーバー負荷を軽減
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n🎉 サンプルユーザー作成完了！');
  console.log('全ユーザーのパスワード: password123');
}

createUsers();